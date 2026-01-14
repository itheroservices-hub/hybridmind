/**
 * HybridMind v1.1 - Rate Limiter Middleware
 * Prevents abuse and manages API quotas
 */

const logger = require('../utils/logger');

class RateLimiter {
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.costs = new Map();
    this.hashTable = {};
    this.CLEANUP_INTERVAL = 60000; // 1 minute
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }
}  constructor() {
    this.requests = new Map();
    this.costs = new Map();
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
function extractRateLimitingLogic() {
  // Extracted logic will be placed here
}

function createLimiter({ windowMs = 3600000, maxRequests = 100, message = 'Too many requests' }) {
  return (req, res, next) => {
    // Rate limiting logic
  };
}
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

      // Estimate cost of current request (rough estimate)
      const estimatedCost = this.estimateRequestCost(req);

      // Check if adding this request would exceed limit
      if (totalCost + estimatedCost > maxCostPerDay) {
        return res.status(429).json({
          error: 'Cost limit exceeded',
          message,
          dailyLimit: maxCostPerDay,
          currentCost: totalCost.toFixed(4),
          estimatedCost: estimatedCost.toFixed(4),
          resetIn: Math.ceil((86400000 - (now % 86400000)) / 1000)
        });
      }

      // Store estimated cost (will be updated with actual cost later)
      req.estimatedCost = estimatedCost;
      req.recordCost = (actualCost) => {
        costEntries.push({ timestamp: now, cost: actualCost });
        this.costs.set(key, costEntries);
      };

      res.set({
        'X-Cost-Limit': maxCostPerDay,
        'X-Cost-Used': totalCost.toFixed(4),
        'X-Cost-Remaining': (maxCostPerDay - totalCost).toFixed(4)
      });

      next();
    };
  }

  /**
   * Estimate request cost based on parameters
   */
  estimateRequestCost(req) {
    const modelCosts = {
      // Premium models
      'gpt-4': 0.03 / 1000,
      'gpt-4-turbo': 0.01 / 1000,
      'gpt-4o': 0.0025 / 1000,
      'claude-3-opus': 0.015 / 1000,
      'claude-3-sonnet': 0.003 / 1000,
      'claude-3-5-sonnet': 0.003 / 1000,
      'claude-3-5-sonnet-20241022': 0.003 / 1000,
      'gemini-pro': 0.00025 / 1000,
      'gemini-1.5-pro': 0.00125 / 1000,
      'gemini-2.0-flash-exp': 0.0,
      'qwen-max': 0.0003 / 1000,
      
      // Free tier models (via Groq/OpenRouter)
      'llama-3.3-70b-versatile': 0.0, // Free via Groq
      'deepseek-chat': 0.0, // Free tier
      'deepseek-reasoner': 0.0, // Free tier
      'deepseek-coder': 0.0002 / 1000,
      'groq-llama3-70b': 0.0,
      
      // OpenRouter pricing
      'openrouter/anthropic/claude-3.5-sonnet': 0.003 / 1000,
      'openrouter/google/gemini-2.0-flash-exp': 0.0
    };

    const model = req.body.model || 'gpt-4';
    const tokens = req.body.maxTokens || 4000;
    const costPerToken = modelCosts[model] || 0.01 / 1000;

    // Rough estimate: 2x for input + output
    return tokens * costPerToken * 2;
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
  
  // Free tier: 200 requests/hour (increased for autonomous workflows)
  freeTierLimiter: rateLimiter.createLimiter({
    windowMs: 3600000,
    maxRequests: 200,
    message: 'Free tier limit: 200 requests/hour. Upgrade to Pro for higher limits.'
  }),

  // Pro tier: 1000 requests/hour
  proTierLimiter: rateLimiter.createLimiter({
    windowMs: 3600000,
    maxRequests: 1000,
    message: 'Pro tier limit: 1000 requests/hour reached.'
  }),

  // Cost limiter: $10/day max
  costLimiter: rateLimiter.createCostLimiter({
    maxCostPerDay: 10.0,
    message: 'Daily cost limit reached. Your usage will reset in 24 hours.'
  }),

  // Burst protection: 30 requests per minute (allows autonomous multi-step)
  burstLimiter: rateLimiter.createLimiter({
    windowMs: 60000,
    maxRequests: 30,
    message: 'Too many requests. Please slow down.'
  })
};
