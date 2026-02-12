/**
 * Profit Margin Protection
 * 
 * Ensures at LEAST 71% profit margin while scaling:
 * - Real-time cost tracking per request
 * - Automatic model downgrading when margin drops
 * - Cost alerts and warnings
 * - Profit analytics dashboard
 * - Budget enforcement
 */

const logger = require('../../utils/logger');
const modelRightSizer = require('./modelRightSizer');

/**
 * Pricing configuration (cost per 1M tokens)
 */
const MODEL_PRICING = {
  // Groq (ultra-cheap)
  'groq/llama-3.1-8b-instant': {
    input: 0.05,
    output: 0.08
  },
  'groq/llama-3.1-70b-versatile': {
    input: 0.59,
    output: 0.79
  },

  // OpenRouter
  'openrouter/meta-llama/llama-3.1-70b-instruct': {
    input: 0.88,
    output: 0.88
  },
  'openrouter/anthropic/claude-3.5-sonnet': {
    input: 3.00,
    output: 15.00
  },
  'openrouter/google/gemini-pro-1.5': {
    input: 1.25,
    output: 5.00
  },
  'openrouter/anthropic/claude-3-opus': {
    input: 15.00,
    output: 75.00
  },
  'openrouter/openai/gpt-4-turbo': {
    input: 10.00,
    output: 30.00
  },

  // OpenAI
  'gpt-3.5-turbo': {
    input: 0.50,
    output: 1.50
  },
  'gpt-4-turbo': {
    input: 10.00,
    output: 30.00
  }
};

/**
 * Tier pricing (what we charge users per month)
 */
const TIER_PRICING = {
  free: 0,
  pro: 19,
  proPlus: 49
};

/**
 * Target margins by tier
 * With optimizations (context trimming, right-sizing, cheap models):
 * - Expected margins: 80-85%+
 * - Minimum acceptable: 71% (Pro), 75% (Pro Plus)
 */
const TARGET_MARGINS = {
  free: 0,        // Free tier - just don't lose money
  pro: {
    target: 0.85,   // 85% target margin with optimizations
    minimum: 0.71   // 71% absolute floor
  },
  proPlus: {
    target: 0.87,   // 87% target margin with optimizations
    minimum: 0.75   // 75% absolute floor
  }
};

class ProfitMarginProtector {
  constructor() {
    this.userCosts = new Map(); // userId -> cost tracking
    this.dailyBudget = 2.0; // $2/day total budget
    this.minimumMargin = 0.71; // 71% minimum profit margin
    
    this.stats = {
      totalRevenue: 0,
      totalCosts: 0,
      totalProfit: 0,
      currentMargin: 0,
      downgrades: 0,
      budgetExceeded: 0,
      alertsSent: 0
    };

    this.alerts = [];
  }

  /**
   * Track cost for a request
   */
  trackCost({
    userId,
    tier,
    model,
    tokensInput,
    tokensOutput,
    metadata = {}
  }) {
    const cost = this.calculateCost(model, tokensInput, tokensOutput);
    
    // Initialize user tracking
    if (!this.userCosts.has(userId)) {
      this.userCosts.set(userId, {
        userId,
        tier,
        dailyCost: 0,
        monthlyCost: 0,
        requests: 0,
        lastReset: Date.now(),
        costHistory: []
      });
    }

    const userTracking = this.userCosts.get(userId);
    
    // Reset daily if needed
    const daysSinceReset = (Date.now() - userTracking.lastReset) / 86400000;
    if (daysSinceReset >= 1) {
      userTracking.dailyCost = 0;
      userTracking.lastReset = Date.now();
    }

    // Update tracking
    userTracking.dailyCost += cost;
    userTracking.monthlyCost += cost;
    userTracking.requests++;
    userTracking.costHistory.push({
      timestamp: Date.now(),
      cost,
      model,
      tokensInput,
      tokensOutput,
      metadata
    });

    // Keep only last 1000 costs
    if (userTracking.costHistory.length > 1000) {
      userTracking.costHistory = userTracking.costHistory.slice(-1000);
    }

    // Update global stats
    this.stats.totalCosts += cost;

    // Calculate revenue for this tier
    const monthlyRevenue = TIER_PRICING[tier] || 0;
    const dailyRevenue = monthlyRevenue / 30;
    
    // Check margin
    const currentMargin = dailyRevenue > 0 
      ? (dailyRevenue - userTracking.dailyCost) / dailyRevenue 
      : 0;

    const targetMargin = TARGET_MARGINS[tier]?.target || TARGET_MARGINS[tier] || 0.85;
    const minimumMargin = TARGET_MARGINS[tier]?.minimum || TARGET_MARGINS[tier] || 0.71;

    // Alert if below target (warning) or below minimum (critical)
    if (currentMargin < minimumMargin && tier !== 'free') {
      this._sendAlert({
        type: 'margin_critical',
        severity: 'critical',
        userId,
        tier,
        currentMargin,
        minimumMargin,
        targetMargin,
        dailyCost: userTracking.dailyCost,
        dailyRevenue
      });
    } else if (currentMargin < targetMargin && tier !== 'free') {
      this._sendAlert({
        type: 'margin_below_target',
        severity: 'warning',
        userId,
        tier,
        currentMargin,
        minimumMargin,
        targetMargin,
        dailyCost: userTracking.dailyCost,
        dailyRevenue
      });
    }

    // Check budget
    if (userTracking.dailyCost > this.dailyBudget) {
      this.stats.budgetExceeded++;
      
      this._sendAlert({
        type: 'budget_exceeded',
        severity: 'critical',
        userId,
        tier,
        dailyCost: userTracking.dailyCost,
        dailyBudget: this.dailyBudget
      });
    }

    return {
      cost,
      dailyCost: userTracking.dailyCost,
      currentMargin,
      targetMargin,
      minimumMargin,
      marginOk: currentMargin >= minimumMargin || tier === 'free',
      budgetOk: userTracking.dailyCost <= this.dailyBudget
    };
  }

  /**
   * Calculate cost for model usage
   */
  calculateCost(model, tokensInput, tokensOutput) {
    const pricing = MODEL_PRICING[model];
    
    if (!pricing) {
      logger.warn(`No pricing for model: ${model}`);
      return 0;
    }

    const inputCost = (tokensInput / 1_000_000) * pricing.input;
    const outputCost = (tokensOutput / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Select cost-effective model with margin protection
   */
  selectModelWithMarginProtection({
    userId,
    tier,
    task,
    taskType,
    context = {},
    currentModel = null
  }) {
    const userTracking = this.userCosts.get(userId);
    
    // Calculate current margin
    const monthlyRevenue = TIER_PRICING[tier] || 0;
    const dailyRevenue = monthlyRevenue / 30;
    const dailyCost = userTracking?.dailyCost || 0;
    const currentMargin = dailyRevenue > 0 
      ? (dailyRevenue - dailyCost) / dailyRevenue 
      : 0;

    const targetMargin = TARGET_MARGINS[tier]?.target || TARGET_MARGINS[tier] || 0.85;
    const minimumMargin = TARGET_MARGINS[tier]?.minimum || TARGET_MARGINS[tier] || 0.71;

    // Downgrade aggressiveness based on margin
    let qualityRequirement = 'target';
    
    if (currentMargin < minimumMargin && tier !== 'free') {
      // CRITICAL: Below minimum margin - AGGRESSIVE downgrade
      qualityRequirement = 'minimum';
      logger.error(`Critical margin (${(currentMargin * 100).toFixed(1)}% < ${(minimumMargin * 100).toFixed(0)}% minimum), aggressive downgrade`);
      this.stats.downgrades++;
    } else if (currentMargin < targetMargin * 0.9 && tier !== 'free') {
      // WARNING: Below 90% of target - downgrade to minimum
      qualityRequirement = 'minimum';
      logger.warn(`Low margin (${(currentMargin * 100).toFixed(1)}% < ${(targetMargin * 0.9 * 100).toFixed(0)}% target), downgrading to minimum quality`);
      this.stats.downgrades++;
    } else if (currentMargin >= targetMargin) {
      // GOOD: At or above target - can use excellent quality
      qualityRequirement = 'excellent';
    }

    // Use model right-sizer with quality adjustment
    const recommendation = modelRightSizer.selectOptimalModel({
      task,
      taskType,
      context,
      qualityRequirement,
      currentModel
    });

    return {
      ...recommendation,
      marginProtection: {
        currentMargin,
        targetMargin,
        minimumMargin,
        dailyCost,
        dailyRevenue,
        downgraded: qualityRequirement === 'minimum',
        marginStatus: currentMargin >= targetMargin ? 'excellent' : 
                     currentMargin >= minimumMargin ? 'acceptable' : 'critical'
      }
    };
  }

  /**
   * Send alert
   */
  _sendAlert(alert) {
    const alertData = {
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alert
    };

    this.alerts.push(alertData);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.stats.alertsSent++;

    logger.warn(`Profit alert: ${alert.type}`, alert);
  }

  /**
   * Get user cost tracking
   */
  getUserTracking(userId) {
    return this.userCosts.get(userId);
  }

  /**
   * Get profit analytics
   */
  getAnalytics() {
    // Calculate overall margin
    const totalRevenue = this.stats.totalRevenue || 1; // Prevent division by zero
    const currentMargin = (totalRevenue - this.stats.totalCosts) / totalRevenue;
    this.stats.currentMargin = currentMargin;
    this.stats.totalProfit = totalRevenue - this.stats.totalCosts;

    return {
      revenue: {
        total: this.stats.totalRevenue,
        perUser: this.stats.totalRevenue / Math.max(1, this.userCosts.size)
      },
      costs: {
        total: this.stats.totalCosts,
        perUser: this.stats.totalCosts / Math.max(1, this.userCosts.size)
      },
      profit: {
        total: this.stats.totalProfit,
        margin: currentMargin,
        marginPercent: (currentMargin * 100).toFixed(2) + '%',
        targetMargin: this.minimumMargin,
        targetMarginPercent: (this.minimumMargin * 100).toFixed(0) + '%',
        aboveTarget: currentMargin >= this.minimumMargin
      },
      protection: {
        downgrades: this.stats.downgrades,
        budgetExceeded: this.stats.budgetExceeded,
        alertsSent: this.stats.alertsSent
      },
      users: {
        total: this.userCosts.size,
        byTier: this._getUsersByTier()
      }
    };
  }

  /**
   * Get users grouped by tier
   */
  _getUsersByTier() {
    const byTier = { free: 0, pro: 0, enterprise: 0 };
    
    for (const tracking of this.userCosts.values()) {
      byTier[tracking.tier] = (byTier[tracking.tier] || 0) + 1;
    }

    return byTier;
  }

  /**
   * Get cost-effective models
   */
  getCostEffectiveModels() {
    const models = [];

    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      const avgCost = (pricing.input + pricing.output) / 2;
      
      models.push({
        model,
        inputCost: pricing.input,
        outputCost: pricing.output,
        avgCost,
        costRating: this._getCostRating(avgCost)
      });
    }

    // Sort by cost (cheapest first)
    models.sort((a, b) => a.avgCost - b.avgCost);

    return models;
  }

  /**
   * Get cost rating
   */
  _getCostRating(avgCost) {
    if (avgCost < 0.5) return 'ultra-cheap';
    if (avgCost < 2) return 'cheap';
    if (avgCost < 10) return 'moderate';
    if (avgCost < 30) return 'expensive';
    return 'very-expensive';
  }

  /**
   * Get recent alerts
   */
  getAlerts(filters = {}) {
    let results = [...this.alerts];

    if (filters.type) {
      results = results.filter(a => a.type === filters.type);
    }

    if (filters.severity) {
      results = results.filter(a => a.severity === filters.severity);
    }

    if (filters.userId) {
      results = results.filter(a => a.userId === filters.userId);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    const limit = filters.limit || 50;
    return results.slice(0, limit);
  }

  /**
   * Set daily budget
   */
  setDailyBudget(budget) {
    this.dailyBudget = budget;
    logger.info(`Daily budget set to $${budget}`);
  }

  /**
   * Set minimum margin
   */
  setMinimumMargin(margin) {
    this.minimumMargin = margin;
    logger.info(`Minimum profit margin set to ${(margin * 100).toFixed(0)}%`);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      activeUsers: this.userCosts.size,
      dailyBudget: this.dailyBudget,
      minimumMargin: this.minimumMargin
    };
  }

  /**
   * Reset monthly costs
   */
  resetMonthlyCosts() {
    for (const tracking of this.userCosts.values()) {
      tracking.monthlyCost = 0;
    }
    logger.info('Monthly costs reset for all users');
  }
}

// Singleton instance
module.exports = new ProfitMarginProtector();
