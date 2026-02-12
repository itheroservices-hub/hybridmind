/**
 * HybridMind v1.5 - License Validator Middleware
 * Validates Pro licenses and sets user tier
 */

const logger = require('../utils/logger');

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

    // Verify with landing page API
    try {
      const response = await fetch('https://hybridmind.ca/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });

      if (!response.ok) {
        logger.warn(`License verification failed: ${response.status}`);
        req.user = { tier: 'free' };
        req.tier = 'free';
        return next();
      }

      const data = await response.json();

      // Support both 'pro' ($19.99) and 'proplus' ($49.99) tiers
      if (data.valid && (data.tier === 'pro' || data.tier === 'proplus')) {
        // Valid Pro or Pro Plus license
        licenseCache.set(licenseKey, {
          tier: data.tier,
          timestamp: Date.now()
        });

        req.user = { tier: data.tier, licenseKey };
        req.tier = data.tier;
        
        logger.info(`✅ ${data.tier === 'proplus' ? 'Pro Plus' : 'Pro'} license validated: ${licenseKey.substring(0, 8)}...`);
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
