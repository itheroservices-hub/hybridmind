/**
 * HybridMind v1.5 - Rate Limiter Middleware
 * CRITICAL: Prevents abuse and manages API quotas to protect against excessive costs
 * STUDENT BUDGET MODE: Very conservative limits to protect API costs
 */

const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.costs = new Map();
    this.tokens = new Map(); // Track token usage
    this.CLEANUP_INTERVAL = 60000; // 1 minute
    
    // Start cleanup timer
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Create rate limit middleware
   * @param {Object} options - Rate limit options
   * @param {number} options.windowMs - Time window in milliseconds
   * @param {number} options.maxRequests - Max requests per window
   * @param {string} options.message - Error message
   */
  createLimiter({ windowMs = 3600000, maxRequests = 100, message = 'Too many requests' }) {
    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get requests for this key
      let timestamps = this.requests.get(key) || [];
      
      // Filter requests within current window
      timestamps = timestamps.filter(time => time > windowStart);

      // Check if limit exceeded
      if (timestamps.length >= maxRequests) {
        const oldestTimestamp = timestamps[0];
        const resetIn = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);

        logger.warn(`Rate limit exceeded for ${key}: ${timestamps.length}/${maxRequests} requests`);

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          limit: maxRequests,
          current: timestamps.length,
          resetIn,
          retryAfter: resetIn
        });
      }

      // Add current request
      timestamps.push(now);
      this.requests.set(key, timestamps);

      // Calculate usage percentage
      const usagePercent = Math.round((timestamps.length / maxRequests) * 100);
      const tier = 'free'; // TODO: Get from req.user?.tier

      // Set rate limit headers with usage info
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': maxRequests - timestamps.length,
        'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000),
        'X-Usage-Percent': usagePercent,
        'X-Usage-Tier': tier,
        'X-Usage-Warning': usagePercent >= 80 ? 'true' : 'false'
      });

      next();
    };
  }

  /**
   * Token-based rate limiting (for monthly quotas)
   * @param {Object} options - Token limit options
   */
  createTokenLimiter({ maxTokensPerMonth = 8000, message = 'Monthly token limit exceeded' }) {
    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      const monthStart = now - (30 * 86400000); // 30 days

      // Get token usage for this key
      let tokenEntries = this.tokens.get(key) || [];
      
      // Filter tokens within last 30 days
      tokenEntries = tokenEntries.filter(entry => entry.timestamp > monthStart);

      // Calculate total tokens used
      const totalTokens = tokenEntries.reduce((sum, entry) => sum + entry.tokens, 0);

      // Check if limit exceeded
      if (totalTokens >= maxTokensPerMonth) {
        const usagePercent = Math.round((totalTokens / maxTokensPerMonth) * 100);
        
        return res.status(429).json({
          error: 'Token limit exceeded',
          message,
          monthlyLimit: maxTokensPerMonth,
          tokensUsed: totalTokens,
          usagePercent,
          resetDate: new Date(monthStart + (30 * 86400000)).toISOString()
        });
      }

      // Store for response tracking (will be updated after request)
      req.tokenLimiter = {
        key,
        maxTokensPerMonth,
        totalTokens,
        entries: tokenEntries
      };

      // Set usage headers
      const usagePercent = Math.round((totalTokens / maxTokensPerMonth) * 100);
      res.set({
        'X-Token-Limit': maxTokensPerMonth,
        'X-Tokens-Used': totalTokens,
        'X-Tokens-Remaining': maxTokensPerMonth - totalTokens,
        'X-Usage-Percent': usagePercent,
        'X-Usage-Warning': usagePercent >= 80 ? 'true' : 'false'
      });

      next();
    };
  }

  /**
   * Cost-based rate limiting (for API costs)
   * @param {Object} options - Cost limit options
   */
  createCostLimiter({ maxCostPerDay = 10.0, message = 'Daily cost limit exceeded' }) {
    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      const dayStart = now - 86400000; // 24 hours

      // Get costs for this key
      let costEntries = this.costs.get(key) || [];
      
      // Filter costs within last 24 hours
      costEntries = costEntries.filter(entry => entry.timestamp > dayStart);

      // Calculate total cost
      const totalCost = costEntries.reduce((sum, entry) => sum + entry.cost, 0);
      
      // Estimate cost of this request
      const estimatedCost = this.estimateRequestCost(req);

      // Check if adding this request would exceed limit
      if (totalCost + estimatedCost > maxCostPerDay) {
        const usagePercent = Math.round((totalCost / maxCostPerDay) * 100);
        
        return res.status(429).json({
          error: 'Cost limit exceeded',
          message,
          dailyLimit: maxCostPerDay,
          currentCost: totalCost.toFixed(4),
          estimatedCost: estimatedCost.toFixed(4),
          resetIn: Math.ceil((86400000 - (now % 86400000)) / 1000),
          usagePercent,
          upgradeMessage: '💎 Upgrade to Pro for higher limits: $50/day instead of $2/day!'
        });
      }

      // Store estimated cost (will be updated with actual cost later)
      req.estimatedCost = estimatedCost;
      req.recordCost = (actualCost) => {
        costEntries.push({ timestamp: now, cost: actualCost });
        this.costs.set(key, costEntries);
      };

      const usagePercent = Math.round(((totalCost + estimatedCost) / maxCostPerDay) * 100);

      res.set({
        'X-Cost-Limit': maxCostPerDay,
        'X-Cost-Used': totalCost.toFixed(4),
        'X-Cost-Remaining': (maxCostPerDay - totalCost).toFixed(4),
        'X-Cost-Percent': usagePercent,
        'X-Cost-Warning': usagePercent >= 80 ? 'true' : 'false'
      });

      next();
    };
  }

  /**
   * Estimate request cost based on parameters
   * UPDATED: OpenRouter-only pricing (Jan 2026)
   */
  estimateRequestCost(req) {
    const modelCosts = {
      // OpenRouter models (cost per 1M tokens)
      'meta-llama/llama-3.3-70b-instruct': 0.00, // FREE!
      'google/gemini-2.5-flash': 0.10,
      'google/gemini-2.5-pro': 1.25,
      'anthropic/claude-3.5-sonnet': 3.00,
      'anthropic/claude-opus-4.5': 15.00,
      'openai/gpt-4o': 5.00,
      'deepseek/deepseek-r1': 0.55,
      'qwen/qwen3-coder-plus': 0.40,
      'x-ai/grok-4': 10.00,
      'mistralai/mistral-large': 2.00,
      
      // Fallback for unknown models
      'default': 2.00
    };

    const model = req.body.model || 'meta-llama/llama-3.3-70b-instruct';
    const code = req.body.code || '';
    const prompt = req.body.prompt || req.body.goal || '';
    
    // Estimate tokens (rough: 1 token ≈ 4 characters)
    const inputTokens = Math.ceil((code.length + prompt.length) / 4);
    const outputTokens = req.body.maxTokens || 4000; // Conservative estimate
    
    const costPerMillionTokens = modelCosts[model] || modelCosts.default;
    
    // Total cost = (input + output) / 1M * cost per 1M
    const estimatedCost = ((inputTokens + outputTokens) / 1000000) * costPerMillionTokens;
    
    logger.debug(`Cost estimate for ${model}: $${estimatedCost.toFixed(6)} (${inputTokens + outputTokens} tokens)`);
    
    return estimatedCost;
  }

  /**
   * Get unique key for rate limiting (user ID or IP)
   */
  getKey(req) {
    return req.user?.id || req.user?.licenseKey || req.ip || 'anonymous';
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const dayAgo = now - 86400000;

    // Cleanup requests
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(time => time > dayAgo);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }

    // Cleanup costs
    for (const [key, entries] of this.costs.entries()) {
      const filtered = entries.filter(entry => entry.timestamp > dayAgo);
      if (filtered.length === 0) {
        this.costs.delete(key);
      } else {
        this.costs.set(key, filtered);
      }
    }

    logger.info(`Rate limiter cleanup completed. Active keys: ${this.requests.size}`);
  }

  /**
   * Get stats for a specific key
   */
  getStats(key) {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;

    const timestamps = this.requests.get(key) || [];
    const costEntries = this.costs.get(key) || [];

    return {
      requestsLastHour: timestamps.filter(t => t > hourAgo).length,
      requestsLastDay: timestamps.filter(t => t > dayAgo).length,
      costLastDay: costEntries
        .filter(e => e.timestamp > dayAgo)
        .reduce((sum, e) => sum + e.cost, 0)
    };
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Export pre-configured limiters
module.exports = {
  rateLimiter,
  
  // Free tier: 8k tokens/month
  freeTokenLimiter: rateLimiter.createTokenLimiter({
    maxTokensPerMonth: 8000,
    message: '⚠️ Free tier limit: 8,000 tokens/month. Upgrade to Pro for 128k tokens!'
  }),

  // Pro tier: 128k tokens/month ($19.99/month)
  proTokenLimiter: rateLimiter.createTokenLimiter({
    maxTokensPerMonth: 128000,
    message: '⚠️ Pro tier limit: 128,000 tokens/month reached.'
  }),

  // Free tier: 50 requests/hour (burst protection)
  freeTierLimiter: rateLimiter.createLimiter({
    windowMs: 3600000,
    maxRequests: 50,
    message: '⚠️ Free tier limit: 50 requests/hour.'
  }),

  // Pro tier: 500 requests/hour (burst protection)
  proTierLimiter: rateLimiter.createLimiter({
    windowMs: 3600000,
    maxRequests: 500,
    message: 'Pro tier limit: 500 requests/hour reached.'
  }),

  // PROFIT MARGIN PROTECTION: 71% margin (industry-standard for AI SaaS)
  
  // Free tier cost limiter: $0.10/day (testing/trial only)
  freeCostLimiter: rateLimiter.createCostLimiter({
    maxCostPerDay: 0.10,
    message: '⚠️ Free tier daily limit reached. Upgrade to Pro ($19.99/mo) for higher limits!'
  }),

  // Pro tier cost limiter: $0.19/day = $5.80/month (71% margin on $19.99)
  // Revenue: $19.99/month
  // Max Cost: $5.80/month ($0.19/day)
  // Profit: $14.19/month
  // Margin: 71% ✅
  proCostLimiter: rateLimiter.createCostLimiter({
    maxCostPerDay: 0.19,
    message: '⚠️ Pro daily limit reached ($0.19/day). Upgrade to Pro Plus for 2.5x higher limits!'
  }),

  // Pro Plus tier cost limiter: $0.48/day = $14.50/month (71% margin on $49.99)
  // Revenue: $49.99/month
  // Max Cost: $14.50/month ($0.48/day)
  // Profit: $35.49/month
  // Margin: 71% ✅
  proPlusCostLimiter: rateLimiter.createCostLimiter({
    maxCostPerDay: 0.48,
    message: '⚠️ Pro Plus daily limit reached ($0.48/day). Contact sales for Enterprise tier!'
  }),

  // Burst protection: 10 requests per minute (prevents accidental runaway costs)
  burstLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 10,
    message: '⚠️ Slow down! Max 10 requests/minute to protect your API costs.'
  })
};
