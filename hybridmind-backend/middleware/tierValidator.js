/**
 * HybridMind v1.1 - Tier Validator Middleware
 * Enforces free vs pro tier limits on backend requests
 */

const logger = require('../utils/logger');

/**
 * Tier configuration
 */
const TIER_CONFIG = {
  free: {
    maxModelsPerRequest: 2,
    maxContextTokens: 8000,
    maxRequestsPerHour: 100,
    maxRequestsPerDay: 500,
    allowedModels: [
      'groq-llama3-70b',
      'deepseek-coder',
      'gemini-1.5-flash',
      'qwen-max'
    ],
    features: [
      'basic-completion',
      'code-explanation',
      'code-review',
      'single-step',
      'chat-window',
      'standard-speed',
      'context-8k'
    ]
  },
  pro: {
    maxModelsPerRequest: 4,
    maxContextTokens: 128000,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000,
    allowedModels: 'all', // All models available
    features: [
      'basic-completion',
      'code-explanation',
      'code-review',
      'agentic-chains',
      'multi-step-autonomous',
      'chat-window',
      'premium-models',
      'all-models',
      'ultra-fast-inference',
      'multi-model-orchestration',
      'advanced-workflows',
      'priority-support',
      '4-model-chains',
      'context-128k'
    ]
  }
};

/**
 * In-memory request tracking (in production, use Redis)
 */
const requestTracking = new Map();

/**
 * Get tier configuration for a user
 */
function getTierConfig(tier = 'free') {
  return TIER_CONFIG[tier] || TIER_CONFIG.free;
}

/**
 * Middleware: Validate tier access for requests
 */
async function validateTier(req, res, next) {
  try {
    // Extract tier from request (set by auth middleware or default to PRO for development)
    const tier = req.user?.tier || process.env.DEFAULT_TIER || 'pro'; // Changed from 'free' to 'pro' for development
    const config = getTierConfig(tier);

    // Attach tier info to request
    req.tier = tier;
    req.tierConfig = config;

    // Check model count limit
    if (req.body.models && Array.isArray(req.body.models)) {
      if (req.body.models.length > config.maxModelsPerRequest) {
        return res.status(403).json({
          error: 'Model limit exceeded',
          message: `${tier === 'free' ? 'Free tier' : 'Your tier'} allows up to ${config.maxModelsPerRequest} models per request`,
          tier,
          limit: config.maxModelsPerRequest,
          requested: req.body.models.length,
          upgradeUrl: 'https://hybridmind.dev/pricing'
        });
      }

      // Check if models are allowed for tier
      if (config.allowedModels !== 'all') {
        const invalidModels = req.body.models.filter(
          model => !config.allowedModels.includes(model)
        );

        if (invalidModels.length > 0) {
          return res.status(403).json({
            error: 'Premium models require Pro tier',
            message: `Models ${invalidModels.join(', ')} require HybridMind Pro`,
            tier,
            invalidModels,
            upgradeUrl: 'https://hybridmind.dev/pricing'
          });
        }
      }
    }

    // Check context token limit
    if (req.body.maxTokens && req.body.maxTokens > config.maxContextTokens) {
      req.body.maxTokens = config.maxContextTokens;
      logger.warn(`Context tokens capped to ${config.maxContextTokens} for ${tier} tier`);
    }

    // Check rate limits
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const hourKey = `${userId}:${Math.floor(now / 3600000)}`;
    const dayKey = `${userId}:${Math.floor(now / 86400000)}`;

    // Initialize tracking
    if (!requestTracking.has(hourKey)) {
      requestTracking.set(hourKey, 0);
    }
    if (!requestTracking.has(dayKey)) {
      requestTracking.set(dayKey, 0);
    }

    // Increment counters
    const hourlyCount = requestTracking.get(hourKey) + 1;
    const dailyCount = requestTracking.get(dayKey) + 1;

    // Check limits
    if (hourlyCount > config.maxRequestsPerHour) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `${tier === 'free' ? 'Free tier' : 'Your tier'} allows ${config.maxRequestsPerHour} requests per hour`,
        tier,
        limit: config.maxRequestsPerHour,
        resetIn: 3600 - (now % 3600000),
        upgradeUrl: 'https://hybridmind.dev/pricing'
      });
    }

    if (dailyCount > config.maxRequestsPerDay) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        message: `${tier === 'free' ? 'Free tier' : 'Your tier'} allows ${config.maxRequestsPerDay} requests per day`,
        tier,
        limit: config.maxRequestsPerDay,
        resetIn: 86400 - (now % 86400000),
        upgradeUrl: 'https://hybridmind.dev/pricing'
      });
    }

    // Update tracking
    requestTracking.set(hourKey, hourlyCount);
    requestTracking.set(dayKey, dailyCount);

    // Cleanup old tracking data (older than 24 hours)
    const cutoff = Math.floor(now / 3600000) - 24;
    for (const key of requestTracking.keys()) {
      const timestamp = parseInt(key.split(':')[1]);
      if (timestamp < cutoff) {
        requestTracking.delete(key);
      }
    }

    // Add tier metadata to response
    res.locals.tierMetadata = {
      tier,
      requestsRemainingHour: config.maxRequestsPerHour - hourlyCount,
      requestsRemainingDay: config.maxRequestsPerDay - dailyCount,
      modelsAllowed: config.maxModelsPerRequest,
      contextLimit: config.maxContextTokens
    };

    next();
  } catch (error) {
    logger.error('Tier validation error:', error);
    next(error);
  }
}

/**
 * Middleware: Check if feature is available for tier
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    const tier = req.tier || process.env.DEFAULT_TIER || 'pro'; // Changed from 'free' to 'pro' for development
    const config = getTierConfig(tier);

    if (!config.features.includes(featureName)) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `${featureName} requires HybridMind Pro`,
        tier,
        requiredTier: 'pro',
        upgradeUrl: 'https://hybridmind.dev/pricing'
      });
    }

    next();
  };
}

/**
 * Get tier statistics for a user
 */
function getTierStats(userId) {
  const now = Date.now();
  const hourKey = `${userId}:${Math.floor(now / 3600000)}`;
  const dayKey = `${userId}:${Math.floor(now / 86400000)}`;

  return {
    requestsThisHour: requestTracking.get(hourKey) || 0,
    requestsToday: requestTracking.get(dayKey) || 0
  };
}

module.exports = {
  validateTier,
  requireFeature,
  getTierConfig,
  getTierStats,
  TIER_CONFIG
};
