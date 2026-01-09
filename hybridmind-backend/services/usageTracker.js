/**
 * HybridMind v1.1 - Usage Tracker Service
 * Tracks API usage, costs, and provides analytics
 */

const logger = require('../utils/logger');

class UsageTracker {
  constructor() {
    this.usage = new Map();
    this.dailyStats = new Map();
  }

  /**
   * Track a model request
   */
  trackRequest({ userId, model, tokens, cost, duration, success }) {
    const key = userId || 'anonymous';
    const now = Date.now();
    const dayKey = this.getDayKey(now);

    // Initialize user tracking
    if (!this.usage.has(key)) {
      this.usage.set(key, {
        requests: [],
        totalCost: 0,
        totalTokens: 0,
        totalDuration: 0,
        successfulRequests: 0,
        failedRequests: 0
      });
    }

    // Initialize daily stats
    if (!this.dailyStats.has(dayKey)) {
      this.dailyStats.set(dayKey, {
        requests: 0,
        cost: 0,
        tokens: 0,
        models: {}
      });
    }

    const userData = this.usage.get(key);
    const dayData = this.dailyStats.get(dayKey);

    // Track request
    const requestData = {
      timestamp: now,
      model,
      tokens: tokens || 0,
      cost: cost || 0,
      duration: duration || 0,
      success: success !== false
    };

    userData.requests.push(requestData);
    userData.totalCost += requestData.cost;
    userData.totalTokens += requestData.tokens;
    userData.totalDuration += requestData.duration;
    
    if (requestData.success) {
      userData.successfulRequests++;
    } else {
      userData.failedRequests++;
    }

    // Update daily stats
    dayData.requests++;
    dayData.cost += requestData.cost;
    dayData.tokens += requestData.tokens;
    dayData.models[model] = (dayData.models[model] || 0) + 1;

    // Keep only last 30 days of requests
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    userData.requests = userData.requests.filter(r => r.timestamp > thirtyDaysAgo);
  }

  /**
   * Get usage stats for a user
   */
  getUserStats(userId) {
    const key = userId || 'anonymous';
    const userData = this.usage.get(key);

    if (!userData) {
      return this.getEmptyStats();
    }

    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    const weekAgo = now - (7 * 86400000);
    const monthAgo = now - (30 * 86400000);

    return {
      totalRequests: userData.requests.length,
      successfulRequests: userData.successfulRequests,
      failedRequests: userData.failedRequests,
      successRate: (userData.successfulRequests / (userData.requests.length || 1) * 100).toFixed(2),
      
      totalCost: userData.totalCost.toFixed(4),
      totalTokens: userData.totalTokens,
      totalDuration: userData.totalDuration,
      averageDuration: (userData.totalDuration / (userData.requests.length || 1)).toFixed(0),

      lastHour: this.filterStats(userData.requests, hourAgo),
      lastDay: this.filterStats(userData.requests, dayAgo),
      lastWeek: this.filterStats(userData.requests, weekAgo),
      lastMonth: this.filterStats(userData.requests, monthAgo),

      topModels: this.getTopModels(userData.requests),
      recentRequests: userData.requests.slice(-10).reverse()
    };
  }

  /**
   * Get daily statistics
   */
  getDailyStats(daysBack = 7) {
    const stats = [];
    const now = Date.now();

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(now - (i * 86400000));
      const dayKey = this.getDayKey(date.getTime());
      const dayData = this.dailyStats.get(dayKey);

      stats.push({
        date: date.toISOString().split('T')[0],
        requests: dayData?.requests || 0,
        cost: dayData?.cost?.toFixed(4) || '0.0000',
        tokens: dayData?.tokens || 0,
        topModel: this.getTopModel(dayData?.models || {})
      });
    }

    return stats.reverse();
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    let totalUsers = this.usage.size;
    let totalRequests = 0;
    let totalCost = 0;
    let totalTokens = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    for (const userData of this.usage.values()) {
      totalRequests += userData.requests.length;
      totalCost += userData.totalCost;
      totalTokens += userData.totalTokens;
      successfulRequests += userData.successfulRequests;
      failedRequests += userData.failedRequests;
    }

    return {
      totalUsers,
      totalRequests,
      totalCost: totalCost.toFixed(4),
      totalTokens,
      successfulRequests,
      failedRequests,
      successRate: (successfulRequests / (totalRequests || 1) * 100).toFixed(2),
      averageCostPerRequest: (totalCost / (totalRequests || 1)).toFixed(4),
      averageTokensPerRequest: Math.round(totalTokens / (totalRequests || 1))
    };
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(model, tokens) {
    const costMap = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-pro': { input: 0.00025, output: 0.001 },
      'deepseek-coder': { input: 0.0002, output: 0.0006 },
      'groq-llama3-70b': { input: 0.0005, output: 0.0008 },
      'qwen-max': { input: 0.0003, output: 0.0009 },
      'mistral-large': { input: 0.004, output: 0.012 }
    };

    const costs = costMap[model] || { input: 0.001, output: 0.003 };
    const inputTokens = Math.floor(tokens * 0.7); // Rough estimate
    const outputTokens = Math.floor(tokens * 0.3);

    return (inputTokens * costs.input / 1000) + (outputTokens * costs.output / 1000);
  }

  /**
   * Check if user has exceeded cost limit
   */
  checkCostLimit(userId, limit = 10.0) {
    const stats = this.getUserStats(userId);
    const dailyCost = parseFloat(stats.lastDay.cost);

    return {
      exceeded: dailyCost >= limit,
      current: dailyCost,
      limit,
      remaining: Math.max(0, limit - dailyCost),
      percentage: (dailyCost / limit * 100).toFixed(2)
    };
  }

  /**
   * Helper: Get day key for grouping
   */
  getDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Helper: Filter stats by time window
   */
  filterStats(requests, sinceTimestamp) {
    const filtered = requests.filter(r => r.timestamp > sinceTimestamp);
    
    return {
      count: filtered.length,
      cost: filtered.reduce((sum, r) => sum + r.cost, 0).toFixed(4),
      tokens: filtered.reduce((sum, r) => sum + r.tokens, 0),
      successRate: (filtered.filter(r => r.success).length / (filtered.length || 1) * 100).toFixed(2)
    };
  }

  /**
   * Helper: Get top models
   */
  getTopModels(requests) {
    const modelCounts = {};
    
    requests.forEach(r => {
      modelCounts[r.model] = (modelCounts[r.model] || 0) + 1;
    });

    return Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));
  }

  /**
   * Helper: Get top model from model counts
   */
  getTopModel(modelCounts) {
    if (Object.keys(modelCounts).length === 0) return 'N/A';
    
    return Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Helper: Get empty stats object
   */
  getEmptyStats() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: '0.00',
      totalCost: '0.0000',
      totalTokens: 0,
      totalDuration: 0,
      averageDuration: '0',
      lastHour: { count: 0, cost: '0.0000', tokens: 0, successRate: '0.00' },
      lastDay: { count: 0, cost: '0.0000', tokens: 0, successRate: '0.00' },
      lastWeek: { count: 0, cost: '0.0000', tokens: 0, successRate: '0.00' },
      lastMonth: { count: 0, cost: '0.0000', tokens: 0, successRate: '0.00' },
      topModels: [],
      recentRequests: []
    };
  }

  /**
   * Clear old data (cleanup)
   */
  cleanup() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Clean up user requests
    for (const [key, userData] of this.usage.entries()) {
      userData.requests = userData.requests.filter(r => r.timestamp > thirtyDaysAgo);
      
      if (userData.requests.length === 0) {
        this.usage.delete(key);
      }
    }

    // Clean up daily stats
    for (const [dayKey] of this.dailyStats.entries()) {
      const [year, month, day] = dayKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (date.getTime() < thirtyDaysAgo) {
        this.dailyStats.delete(dayKey);
      }
    }

    logger.info(`Usage tracker cleanup completed. Active users: ${this.usage.size}`);
  }
}

// Create singleton instance
const usageTracker = new UsageTracker();

// Run cleanup daily
setInterval(() => {
  usageTracker.cleanup();
}, 24 * 60 * 60 * 1000);

module.exports = usageTracker;
