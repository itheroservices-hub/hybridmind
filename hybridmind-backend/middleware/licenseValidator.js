/**
 * HybridMind v1.5 - License Validator Middleware
 * Validates Pro licenses and sets user tier
 */

const logger = require('../utils/logger');

function normalizeTier(tier = 'free') {
  const value = String(tier || 'free').toLowerCase();
  if (value === 'proplus' || value === 'pro_plus' || value === 'pro-plus' || value === 'pro plus') {
    return 'pro-plus';
  }
  return value;
}

// Cache for license verification (avoid hitting landing page API too often)
const licenseCache = new Map();
const CACHE_DURATION = 3600000; // 1 hour

/**
 * Middleware: Validate license key and set tier
 */
async function validateLicense(req, res, next) {
  try {
    // Extract license key from header
    const licenseKey = req.headers['x-license-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    // No license = free tier
    if (!licenseKey) {
      req.user = { tier: 'free' };
      req.tier = 'free';
      return next();
    }

    // Check cache first
    const cached = licenseCache.get(licenseKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      logger.debug(`License cache hit: ${licenseKey.substring(0, 8)}...`);
      req.user = { tier: cached.tier, licenseKey };
      req.tier = cached.tier;
      return next();
    }

    // Verify with license APIs (primary + fallback)
    try {
      const verificationUrls = [
        process.env.LICENSE_VERIFY_URL,
        'https://api.hybridmind.dev/v1/license/verify',
        'https://hybridmind.ca/api/license/verify'
      ].filter(Boolean);

      let data = null;
      let verified = false;

      for (const verifyUrl of verificationUrls) {
        try {
          const response = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey })
          });

          if (!response.ok) {
            logger.warn(`License verification failed at ${verifyUrl}: ${response.status}`);
            continue;
          }

          data = await response.json();
          verified = true;
          break;
        } catch (endpointError) {
          logger.warn(`License verification endpoint error at ${verifyUrl}: ${endpointError.message}`);
        }
      }

      if (!verified || !data) {
        req.user = { tier: 'free' };
        req.tier = 'free';
        return next();
      }

      const normalizedTier = normalizeTier(data.tier);

      // Support both 'pro' ($19.99) and 'proplus' ($49.99) tiers
      if (data.valid && (normalizedTier === 'pro' || normalizedTier === 'pro-plus' || normalizedTier === 'enterprise')) {
        // Valid Pro or Pro Plus license
        licenseCache.set(licenseKey, {
          tier: normalizedTier,
          timestamp: Date.now()
        });

        req.user = { tier: normalizedTier, licenseKey };
        req.tier = normalizedTier;
        
        logger.info(`✅ ${normalizedTier === 'pro-plus' ? 'Pro Plus' : normalizedTier === 'enterprise' ? 'Enterprise' : 'Pro'} license validated: ${licenseKey.substring(0, 8)}...`);
        return next();
      } else {
        // Invalid or expired license
        req.user = { tier: 'free' };
        req.tier = 'free';
        return next();
      }

    } catch (error) {
      logger.error(`License API error: ${error.message}`);
      
      // Fallback: if landing page API is down, check cache or allow temporarily
      if (cached) {
        logger.warn('Using cached license (API unavailable)');
        req.user = { tier: cached.tier, licenseKey };
        req.tier = cached.tier;
      } else {
        // Default to free if we can't verify
        req.user = { tier: 'free' };
        req.tier = 'free';
      }
      
      return next();
    }

  } catch (error) {
    logger.error(`License validation error: ${error.message}`);
    req.user = { tier: 'free' };
    req.tier = 'free';
    next();
  }
}

/**
 * Clear license cache (call when license is revoked)
 */
function clearLicenseCache(licenseKey) {
  if (licenseKey) {
    licenseCache.delete(licenseKey);
    logger.info(`License cache cleared: ${licenseKey.substring(0, 8)}...`);
  } else {
    licenseCache.clear();
    logger.info('All license cache cleared');
  }
}

/**
 * Get cache stats (for monitoring)
 */
function getCacheStats() {
  return {
    size: licenseCache.size,
    keys: Array.from(licenseCache.keys()).map(k => k.substring(0, 8) + '...')
  };
}

module.exports = {
  validateLicense,
  clearLicenseCache,
  getCacheStats
};
