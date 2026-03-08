/**
 * HybridMind License Validator Middleware
 * - Negative cache (10-min TTL) for invalid keys to reduce API load
 * - Per-key rate limiting on verification calls (10/60s)
 * - Admin alerting on consecutive outage threshold
 */

const axios = require('axios');
const logger = require('../utils/logger');

const POSITIVE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const NEGATIVE_CACHE_DURATION = 600000;           // 10 minutes
const VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 1000;   // 60 seconds
const MAX_VERIFY_CALLS_PER_WINDOW = 10;
const LICENSE_API_TIMEOUT_MS = 5000;
const OUTAGE_ALERT_THRESHOLD = 3;
const ONE_HOUR_MS = 60 * 60 * 1000;

const RECOGNIZED_TIERS = new Set(['free', 'pro', 'pro-plus', 'enterprise']);

const licenseCache = new Map();    // licenseKey -> { valid, tier, expiresAt }
const verifyCallMap = new Map();   // licenseKey -> number[] (timestamps)
const licenseVerifyFailures = new Map(); // licenseKey -> consecutive outage count
const outageEvents = [];           // timestamps of network outages in last hour

const LICENSE_VERIFY_ENDPOINTS = (
  process.env.LICENSE_VERIFY_ENDPOINTS ||
  process.env.LICENSE_API_URL ||
  ''
)
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

class LicenseOutageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LicenseOutageError';
  }
}

function getCachedLicense(licenseKey) {
  const cached = licenseCache.get(licenseKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    licenseCache.delete(licenseKey);
    return null;
  }
  return cached;
}

function setCachedLicense(licenseKey, result) {
  const isNegative = result.valid === false || !RECOGNIZED_TIERS.has(result.tier);
  const ttl = isNegative ? NEGATIVE_CACHE_DURATION : POSITIVE_CACHE_DURATION;
  licenseCache.set(licenseKey, {
    valid: !isNegative,
    tier: isNegative ? 'free' : result.tier,
    expiresAt: Date.now() + ttl
  });
}

function normalizeVerificationData(data) {
  const valid = Boolean(data && data.valid === true);
  const rawTier = typeof data?.tier === 'string' ? data.tier.toLowerCase() : 'free';
  const tier = rawTier === 'proplus' || rawTier === 'pro_plus' ? 'pro-plus' : rawTier;
  return { valid, tier };
}

function isRateLimited(licenseKey) {
  const now = Date.now();
  const windowStart = now - VERIFY_RATE_LIMIT_WINDOW_MS;
  const timestamps = verifyCallMap.get(licenseKey) || [];
  const recent = timestamps.filter((ts) => ts >= windowStart);
  if (recent.length >= MAX_VERIFY_CALLS_PER_WINDOW) {
    verifyCallMap.set(licenseKey, recent);
    return true;
  }
  recent.push(now);
  verifyCallMap.set(licenseKey, recent);
  return false;
}

function getOutageCountLastHour() {
  const cutoff = Date.now() - ONE_HOUR_MS;
  while (outageEvents.length > 0 && outageEvents[0] < cutoff) {
    outageEvents.shift();
  }
  return outageEvents.length;
}

function notifyAdminOfLicenseOutage() {
  const affectedCount = getOutageCountLastHour();
  logger.error(
    `ALERT [LICENSE_OUTAGE] Consecutive verification outage threshold reached. ` +
    `Affected verification failures in the last hour: ${affectedCount}`
  );
}

function recordOutageFailure(licenseKey) {
  const count = (licenseVerifyFailures.get(licenseKey) || 0) + 1;
  licenseVerifyFailures.set(licenseKey, count);
  outageEvents.push(Date.now());
  if (count === OUTAGE_ALERT_THRESHOLD) {
    notifyAdminOfLicenseOutage();
  }
}

function clearOutageFailure(licenseKey) {
  licenseVerifyFailures.delete(licenseKey);
}

function isNetworkOutageError(error) {
  return Boolean(
    error &&
      (error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        !error.response)
  );
}

async function verifyLicenseWithEndpoints(licenseKey) {
  if (LICENSE_VERIFY_ENDPOINTS.length === 0) {
    throw new LicenseOutageError('No license verification endpoints configured');
  }

  let sawNonOutageResponse = false;

  for (const endpoint of LICENSE_VERIFY_ENDPOINTS) {
    try {
      const response = await axios.post(
        endpoint,
        { licenseKey },
        { timeout: LICENSE_API_TIMEOUT_MS }
      );
      sawNonOutageResponse = true;
      return normalizeVerificationData(response.data);
    } catch (error) {
      if (isNetworkOutageError(error)) {
        logger.warn(`License API endpoint unreachable (${endpoint}): ${error.message}`);
        continue;
      }
      sawNonOutageResponse = true;
      logger.error(`License API endpoint returned error (${endpoint}): ${error.message}`);
      if (error.response?.data) {
        return normalizeVerificationData(error.response.data);
      }
      return { valid: false, tier: 'free' };
    }
  }

  if (!sawNonOutageResponse) {
    throw new LicenseOutageError('All license verification endpoints unreachable');
  }

  return { valid: false, tier: 'free' };
}

/**
 * Express middleware: validate license key and assign req.user / req.tier.
 */
async function licenseValidator(req, res, next) {
  const licenseKey = req.header('x-license-key') ||
    String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() ||
    null;

  // Allow test bypass in NODE_ENV=test only
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.TEST_LICENSE_KEY &&
    licenseKey === process.env.TEST_LICENSE_KEY
  ) {
    req.user = { tier: 'pro', licenseKey };
    req.tier = 'pro';
    return next();
  }

  if (!licenseKey) {
    req.user = { tier: 'free' };
    req.tier = 'free';
    return next();
  }

  const normalizedKey = licenseKey.trim();
  const cached = getCachedLicense(normalizedKey);

  if (cached) {
    req.user = { tier: cached.tier, licenseKey: normalizedKey };
    req.tier = cached.tier;
    return next();
  }

  if (isRateLimited(normalizedKey)) {
    logger.warn(`License verification rate limit exceeded for key: ${normalizedKey.slice(0, 8)}...`);
    req.user = { tier: 'free' };
    req.tier = 'free';
    return next();
  }

  try {
    const verification = await verifyLicenseWithEndpoints(normalizedKey);
    clearOutageFailure(normalizedKey);

    const tierRecognized = RECOGNIZED_TIERS.has(verification.tier);
    const finalResult = verification.valid && tierRecognized
      ? verification
      : { valid: false, tier: 'free' };

    setCachedLicense(normalizedKey, finalResult);
    req.user = { tier: finalResult.tier, licenseKey: normalizedKey };
    req.tier = finalResult.tier;
    return next();
  } catch (error) {
    if (error instanceof LicenseOutageError) {
      recordOutageFailure(normalizedKey);
      logger.warn(`License verification outage for key: ${normalizedKey.slice(0, 8)}...: ${error.message}`);
    } else {
      logger.error(`License validation error for key: ${normalizedKey.slice(0, 8)}...: ${error.message}`);
    }
    // Fail open: grant free tier during outage
    req.user = { tier: 'free' };
    req.tier = 'free';
    return next();
  }
}

/**
 * Clear license cache (call when license is revoked).
 */
function clearLicenseCache(licenseKey) {
  if (licenseKey) {
    licenseCache.delete(licenseKey);
    logger.info(`License cache cleared: ${licenseKey.slice(0, 8)}...`);
  } else {
    licenseCache.clear();
    logger.info('All license cache cleared');
  }
}

/**
 * Get cache stats (for monitoring).
 */
function getCacheStats() {
  return {
    size: licenseCache.size,
    keys: Array.from(licenseCache.keys()).map((k) => k.slice(0, 8) + '...')
  };
}

module.exports = {
  validateLicense: licenseValidator,
  clearLicenseCache,
  getCacheStats
};
