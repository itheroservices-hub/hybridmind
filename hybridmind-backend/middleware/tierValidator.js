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
    maxContextTokens: 8000,   // Reduced from 16K to 8K
    maxRequestsPerHour: 20,   // Reduced from 50 to 20 (tight control)
    maxRequestsPerDay: 50,    // Reduced from 200 to 50 (prevent abuse)
    maxTokensPerDay: 100000,  // Reduced from 500K to 100K (80% reduction)
    allowedModels: [
      // Ultra-cheap models ONLY (under $0.20/M tokens)
      'deepseek/deepseek-r1-distill-llama-70b',   // $0.09/M - cheapest!
      'qwen/qwen3-coder-flash',                   // $0.10/M
      'google/gemini-2.5-flash',                  // $0.075/M - ultra cheap
      'qwen/qwen-2.5-coder-32b-instruct',         // $0.18/M
      'meta-llama/llama-3.3-70b-instruct'         // $0.18/M
      // NO premium models on free tier - use 7-day trial instead
    ],
    features: [
      'basic-completion',
      'code-explanation',
      'code-review',
      'single-step',
      'chat-window',
      'standard-speed',
      'context-8k',
      'ultra-cheap-models',
      '7-day-trial'  // All Pro features for 7 days
    ]
  },
  pro: {
    maxModelsPerRequest: 4,
    maxContextTokens: 128000,  // Reduced from 200K to 128K
    maxRequestsPerHour: 200,   // Reduced from 500 to 200
    maxRequestsPerDay: 800,    // Reduced from 2000 to 800
    maxTokensPerDay: 5000000,  // Reduced from 10M to 5M (50% reduction)
    allowedModels: 'all',      // All models available including o1, Claude Opus 4.5, etc.
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
      'context-128k',
      'o1-access',
      'claude-opus-access',
      'unlimited-reasoning'
    ]
  },
  'pro-plus': {
    maxModelsPerRequest: 6,      // Can chain 6 models
    maxContextTokens: 1000000,   // 1M context (for Gemini Pro)
    maxRequestsPerHour: 1000,    // Reduced from 2000 to 1000
    maxRequestsPerDay: 3000,     // Reduced from 10000 to 3000
    maxTokensPerDay: 20000000,   // Reduced from 50M to 20M (60% reduction)
    allowedModels: 'all',
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
      '6-model-chains',
      'context-1m',
      'o1-access',
      'claude-opus-access',
      'unlimited-reasoning',
      'priority-routing',
      'dedicated-support',
      'team-collaboration',
      'api-access',
      'custom-workflows',
      'extended-history',
      'batch-processing'
    ]
  },
  enterprise: {
    maxModelsPerRequest: 10,     // Can chain up to 10 models
    maxContextTokens: 2000000,   // 2M context
    maxRequestsPerHour: 5000,    // Reduced from 10000 to 5000 (still huge)
    maxRequestsPerDay: 15000,    // Reduced from 50000 to 15000
    maxTokensPerDay: 100000000,  // 100M cap instead of unlimited (prevent abuse)
    allowedModels: 'all',
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
      '10-model-chains',
      'context-2m',
      'o1-access',
      'claude-opus-access',
      'unlimited-reasoning',
      'priority-routing',
      'dedicated-support',
      'team-collaboration',
      'api-access',
      'custom-workflows',
      'extended-history',
      'batch-processing',
      'sla-guarantee',
      'white-label',
      'custom-integration',
      'dedicated-account-manager'
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
    // Get tier from license validation middleware (should run before this)
    // License validator sets req.tier and req.user
    const tier = req.tier || req.user?.tier || 'free';
    const config = getTierConfig(tier);
tier === 'pro' ? 'Pro tier' : tier === 'pro-plus' ? 'Pro Plus tier' : 'Your tier'} allows ${config.maxTokensPerDay.toLocaleString()} tokens per day`,
        tier,
        tokensUsed: dailyTokens,
        tokensLimit: config.maxTokensPerDay,
        resetIn: 86400 - (now % 86400000),
        upgradeUrl: 'https://hybridmind.dev/pricing',
        suggestedTier: tier === 'free' ? 'pro' : tier === 'pro' ? 'pro-plus' : 'enterprise
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
    const tokenDayKey = `${userId}:tokens:${Math.floor(now / 86400000)}`;

    // Initialize tracking
    if (!requestTracking.has(hourKey)) {
      requestTracking.set(hourKey, 0);
    }
    if (!requestTracking.has(dayKey)) {
      requestTracking.set(dayKey, 0);
    }
    if (!requestTracking.has(tokenDayKey)) {
      requestTracking.set(tokenDayKey, 0);
    }

    // Increment counters
    const hourlyCount = requestTracking.get(hourKey) + 1;
    const dailyCount = requestTracking.get(dayKey) + 1;
    const dailyTokens = requestTracking.get(tokenDayKey);

    // Estimate token usage for this request
    const estimatedTokens = (req.body.maxTokens || 4000) + (req.body.prompt?.length || 0) * 0.25;
    
    // Check token limit (if configured)
    if (config.maxTokensPerDay && dailyTokens + estimatedTokens > config.maxTokensPerDay) {
      return res.status(429).json({
        error: 'Daily token limit exceeded',
        message: `${tier === 'free' ? 'Free tier' : 'Your tier'} allows ${config.maxTokensPerDay.toLocaleString()} tokens per day`,
        tier,
        tokensUsed: dailyTokens,
        tokensLimit: config.maxTokensPerDay,
        resetIn: 86400 - (now % 86400000),
        upgradeUrl: 'https://hybridmind.dev/pricing'
      });
    }

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
    requestTracking.set(tokenDayKey, dailyTokens + estimatedTokens);

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
      tokensRemainingDay: config.maxTokensPerDay ? config.maxTokensPerDay - dailyTokens : 'unlimited',
      tokensUsedDay: dailyTokens,
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
