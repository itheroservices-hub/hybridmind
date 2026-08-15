/**
 * Provider Speed Tester
 * 
 * Tests response times across different providers:
 * - OpenRouter (multiple models)
 * - Groq (ultra-fast inference)
 * - OpenAI (GPT models)
 * 
 * Measures:
 * - Time to First Byte (TTFB)
 * - Tokens per second
 * - Total latency
 * - Success rate
 * 
 * Auto-routes to fastest provider for each task type.
 */

const logger = require('../../utils/logger');
const performanceBenchmark = require('./performanceBenchmark');

/**
 * Provider configurations
 */
const PROVIDERS = {
  GROQ: {
    name: 'groq',
    models: [
      'groq/llama-3.1-8b-instant',
      'groq/llama-3.1-70b-versatile'
    ],
    expectedSpeed: 'ultra-fast',
    expectedTTFB: 100 // ms
  },
  OPENROUTER: {
    name: 'openrouter',
    models: [
      'openrouter/meta-llama/llama-3.1-70b-instruct',
      'openrouter/anthropic/claude-3.5-sonnet',
      'openrouter/google/gemini-pro-1.5'
    ],
    expectedSpeed: 'fast',
    expectedTTFB: 500 // ms
  },
  OPENAI: {
    name: 'openai',
    models: [
      'gpt-3.5-turbo',
      'gpt-4-turbo'
    ],
    expectedSpeed: 'moderate',
    expectedTTFB: 1000 // ms
  }
};

class ProviderSpeedTester {
  constructor() {
    this.providerStats = new Map(); // provider -> performance stats
    this.modelStats = new Map(); // model -> performance stats
    this.fastestProviders = new Map(); // taskType -> fastest provider
    
    this.stats = {
      totalTests: 0,
      totalProviders: Object.keys(PROVIDERS).length
    };

    // Initialize stats
    for (const provider of Object.keys(PROVIDERS)) {
      this.providerStats.set(provider, {
        tests: 0,
        avgTTFB: 0,
        avgLatency: 0,
        avgTokensPerSec: 0,
        successRate: 0,
        successCount: 0,
        failureCount: 0
      });
    }
  }

  /**
   * Test provider speed
   */
  async testProvider({
    provider,
    model,
    testPrompt = 'Respond with "OK" in one word.',
    modelService
  }) {
    const measurementId = performanceBenchmark.startMeasurement({
      operationType: 'provider_speed_test',
      provider,
      model,
      metadata: { testPrompt }
    });

    const startTime = Date.now();
    let ttfb = null;
    let success = false;
    let tokensPerSec = 0;
    let error = null;

    try {
      // Make request
      const result = await modelService.generate(testPrompt, {
        provider,
        model,
        maxTokens: 100,
        temperature: 0
      });

      ttfb = result.ttfb || (Date.now() - startTime);
      success = true;

      // Calculate tokens/sec
      const duration = Date.now() - startTime;
      if (result.tokensOutput && duration > 0) {
        tokensPerSec = (result.tokensOutput / duration) * 1000;
      }

      performanceBenchmark.endMeasurement(measurementId, {
        success: true,
        tokensInput: result.tokensInput || 0,
        tokensOutput: result.tokensOutput || 0,
        cost: result.cost || 0,
        metadata: { ttfb, tokensPerSec }
      });

      performanceBenchmark.markFirstByte(measurementId);

    } catch (err) {
      error = err.message;
      success = false;

      performanceBenchmark.endMeasurement(measurementId, {
        success: false,
        error: error
      });
    }

    const latency = Date.now() - startTime;

    // Update stats
    this._updateProviderStats(provider, {
      ttfb,
      latency,
      tokensPerSec,
      success
    });

    this._updateModelStats(model, {
      ttfb,
      latency,
      tokensPerSec,
      success
    });

    this.stats.totalTests++;

    return {
      provider,
      model,
      ttfb,
      latency,
      tokensPerSec,
      success,
      error
    };
  }

  /**
   * Update provider stats
   */
  _updateProviderStats(provider, { ttfb, latency, tokensPerSec, success }) {
    const stats = this.providerStats.get(provider);
    
    if (!stats) return;

    stats.tests++;

    if (success) {
      stats.successCount++;
      
      // Update running averages
      if (ttfb) {
        stats.avgTTFB = ((stats.avgTTFB * (stats.successCount - 1)) + ttfb) / stats.successCount;
      }
      
      stats.avgLatency = ((stats.avgLatency * (stats.successCount - 1)) + latency) / stats.successCount;
      
      if (tokensPerSec > 0) {
        stats.avgTokensPerSec = ((stats.avgTokensPerSec * (stats.successCount - 1)) + tokensPerSec) / stats.successCount;
      }
    } else {
      stats.failureCount++;
    }

    stats.successRate = stats.successCount / stats.tests;
  }

  /**
   * Update model stats
   */
  _updateModelStats(model, { ttfb, latency, tokensPerSec, success }) {
    if (!this.modelStats.has(model)) {
      this.modelStats.set(model, {
        tests: 0,
        avgTTFB: 0,
        avgLatency: 0,
        avgTokensPerSec: 0,
        successCount: 0
      });
    }

    const stats = this.modelStats.get(model);
    stats.tests++;

    if (success) {
      stats.successCount++;
      
      if (ttfb) {
        stats.avgTTFB = ((stats.avgTTFB * (stats.successCount - 1)) + ttfb) / stats.successCount;
      }
      
      stats.avgLatency = ((stats.avgLatency * (stats.successCount - 1)) + latency) / stats.successCount;
      
      if (tokensPerSec > 0) {
        stats.avgTokensPerSec = ((stats.avgTokensPerSec * (stats.successCount - 1)) + tokensPerSec) / stats.successCount;
      }
    }
  }

  /**
   * Test all providers
   */
  async testAllProviders({
    modelService,
    testPrompt = 'Respond with "OK" in one word.'
  }) {
    const results = [];

    for (const [providerKey, config] of Object.entries(PROVIDERS)) {
      for (const model of config.models) {
        try {
          const result = await this.testProvider({
            provider: config.name,
            model,
            testPrompt,
            modelService
          });
          results.push(result);
        } catch (error) {
          logger.error(`Failed to test ${config.name}/${model}: ${error.message}`);
          results.push({
            provider: config.name,
            model,
            success: false,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Get fastest provider for task type
   */
  getFastestProvider(taskType = 'default') {
    // Check cache
    if (this.fastestProviders.has(taskType)) {
      return this.fastestProviders.get(taskType);
    }

    // Find fastest based on average latency
    let fastest = null;
    let lowestLatency = Infinity;

    for (const [provider, stats] of this.providerStats.entries()) {
      if (stats.successCount > 0 && stats.avgLatency < lowestLatency) {
        lowestLatency = stats.avgLatency;
        fastest = provider;
      }
    }

    if (fastest) {
      this.fastestProviders.set(taskType, fastest);
    }

    return fastest;
  }

  /**
   * Get provider comparison
   */
  compareProviders() {
    const comparison = [];

    for (const [provider, stats] of this.providerStats.entries()) {
      if (stats.tests > 0) {
        comparison.push({
          provider,
          tests: stats.tests,
          successRate: (stats.successRate * 100).toFixed(1) + '%',
          avgTTFB: stats.avgTTFB.toFixed(0) + 'ms',
          avgLatency: stats.avgLatency.toFixed(0) + 'ms',
          avgTokensPerSec: stats.avgTokensPerSec.toFixed(0),
          speedRating: this._getSpeedRating(stats.avgLatency)
        });
      }
    }

    // Sort by latency (fastest first)
    comparison.sort((a, b) => {
      const aLatency = parseFloat(a.avgLatency);
      const bLatency = parseFloat(b.avgLatency);
      return aLatency - bLatency;
    });

    return comparison;
  }

  /**
   * Get speed rating
   */
  _getSpeedRating(latency) {
    if (latency < 200) return 'ultra-fast';
    if (latency < 500) return 'very-fast';
    if (latency < 1000) return 'fast';
    if (latency < 2000) return 'moderate';
    return 'slow';
  }

  /**
   * Get model comparison
   */
  compareModels() {
    const comparison = [];

    for (const [model, stats] of this.modelStats.entries()) {
      if (stats.tests > 0) {
        comparison.push({
          model,
          tests: stats.tests,
          avgTTFB: stats.avgTTFB.toFixed(0) + 'ms',
          avgLatency: stats.avgLatency.toFixed(0) + 'ms',
          avgTokensPerSec: stats.avgTokensPerSec.toFixed(0),
          speedRating: this._getSpeedRating(stats.avgLatency)
        });
      }
    }

    comparison.sort((a, b) => {
      const aLatency = parseFloat(a.avgLatency);
      const bLatency = parseFloat(b.avgLatency);
      return aLatency - bLatency;
    });

    return comparison;
  }

  /**
   * Auto-route to fastest provider
   */
  async autoRoute({
    task,
    taskType = 'default',
    modelService,
    fallbackProvider = 'groq'
  }) {
    const fastest = this.getFastestProvider(taskType);

    if (!fastest) {
      logger.warn(`No speed data for task type '${taskType}', using fallback: ${fallbackProvider}`);
      return fallbackProvider;
    }

    // Check if fastest provider is available
    const stats = this.providerStats.get(fastest);
    if (stats.successRate < 0.9) {
      logger.warn(`Provider ${fastest} has low success rate (${(stats.successRate * 100).toFixed(1)}%), using fallback`);
      return fallbackProvider;
    }

    logger.debug(`Auto-routing to fastest provider: ${fastest} (${stats.avgLatency.toFixed(0)}ms avg)`);
    return fastest;
  }

  /**
   * Get recommendations
   */
  getRecommendations() {
    const recommendations = [];

    // Find ultra-fast providers
    for (const [provider, stats] of this.providerStats.entries()) {
      if (stats.avgLatency < 200 && stats.successRate > 0.95) {
        recommendations.push({
          type: 'use_for_speed',
          provider,
          reason: `Ultra-fast response time (${stats.avgLatency.toFixed(0)}ms avg)`,
          priority: 'high'
        });
      }
    }

    // Find slow providers to avoid
    for (const [provider, stats] of this.providerStats.entries()) {
      if (stats.avgLatency > 2000) {
        recommendations.push({
          type: 'avoid_for_speed',
          provider,
          reason: `Slow response time (${stats.avgLatency.toFixed(0)}ms avg)`,
          priority: 'medium'
        });
      }
    }

    // Find unreliable providers
    for (const [provider, stats] of this.providerStats.entries()) {
      if (stats.successRate < 0.8) {
        recommendations.push({
          type: 'reliability_issue',
          provider,
          reason: `Low success rate (${(stats.successRate * 100).toFixed(1)}%)`,
          priority: 'high'
        });
      }
    }

    return recommendations;
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      ...this.stats,
      providers: this.providerStats.size,
      models: this.modelStats.size,
      fastestProviderCache: this.fastestProviders.size
    };
  }

  /**
   * Reset stats
   */
  reset() {
    this.providerStats.clear();
    this.modelStats.clear();
    this.fastestProviders.clear();
    this.stats.totalTests = 0;

    for (const provider of Object.keys(PROVIDERS)) {
      this.providerStats.set(provider, {
        tests: 0,
        avgTTFB: 0,
        avgLatency: 0,
        avgTokensPerSec: 0,
        successRate: 0,
        successCount: 0,
        failureCount: 0
      });
    }

    logger.info('Provider speed tester stats reset');
  }
}

// Singleton instance
module.exports = new ProviderSpeedTester();
