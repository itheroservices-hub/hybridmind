/**
 * Model Selection Integration with Profit Margin Protection
 * 
 * Automatically adjusts model selection based on profit margins.
 * Downgrades to cheaper models when margins drop below target (85-87%).
 */

const modelSelector = require('./modelSelector');
const profitMarginProtector = require('../performance/profitMarginProtector');
const logger = require('../../utils/logger');

class ModelSelectionIntegration {
  constructor() {
    this.targetMargin = 85; // Minimum acceptable profit margin
    this.optimalMargin = 87;
    this.lastMarginCheck = null;
    this.adaptiveMode = true; // Auto-adjust based on margins
  }

  /**
   * Select model with profit margin awareness
   */
  async selectModelWithMarginProtection({
    taskType,
    role,
    tier,
    budget = 'medium',
    prioritize = 'balanced',
    userId
  }) {
    // Check current profit margin
    const currentMargin = await this._getCurrentMargin(userId);
    
    logger.info(`Current profit margin: ${currentMargin}% (target: ${this.targetMargin}%)`);

    // Adjust budget/prioritization based on margin
    const adjustedParams = this._adjustForMargin(currentMargin, budget, prioritize);

    // Select model with adjusted parameters
    const selection = modelSelector.selectModel({
      taskType,
      role,
      tier,
      budget: adjustedParams.budget,
      prioritize: adjustedParams.prioritize
    });

    // Log selection reasoning
    logger.info(`Selected ${selection.modelId} (margin-adjusted: budget=${adjustedParams.budget}, prioritize=${adjustedParams.prioritize})`);

    return {
      ...selection,
      marginAdjusted: adjustedParams.wasAdjusted,
      currentMargin,
      targetMargin: this.targetMargin
    };
  }

  /**
   * Select chain with profit margin awareness
   */
  async selectChainWithMarginProtection({
    chainType,
    tier,
    budget = 'medium',
    template = null,
    userId
  }) {
    const currentMargin = await this._getCurrentMargin(userId);
    
    logger.info(`Selecting chain with margin protection (current: ${currentMargin}%, target: ${this.targetMargin}%)`);

    // Critical: If margin below target, force budget mode
    if (currentMargin < this.targetMargin) {
      logger.warn(`Margin ${currentMargin}% below target ${this.targetMargin}%, forcing budget mode`);
      
      // Override to budget template
      if (template === 'coding-premium') {
        template = 'coding-standard';
        logger.info('Downgraded from coding-premium to coding-standard');
      } else if (template === 'coding-standard') {
        template = 'coding-budget';
        logger.info('Downgraded from coding-standard to coding-budget');
      }
      
      budget = 'low';
    }

    // Warning: If margin approaching target, use medium budget
    if (currentMargin >= this.targetMargin && currentMargin < this.optimalMargin) {
      logger.info(`Margin ${currentMargin}% near target, using medium budget`);
      budget = 'medium';
    }

    // Optimal: If margin above optimal, allow higher budget
    if (currentMargin >= this.optimalMargin) {
      logger.info(`Margin ${currentMargin}% above optimal, allowing flexible budget`);
      // Keep user's original budget preference
    }

    const chainSelection = modelSelector.selectChain({
      chainType,
      tier,
      budget,
      template
    });

    return {
      ...chainSelection,
      marginAdjusted: currentMargin < this.optimalMargin,
      currentMargin,
      targetMargin: this.targetMargin,
      budgetOverride: currentMargin < this.targetMargin ? budget : null
    };
  }

  /**
   * Get current profit margin
   */
  async _getCurrentMargin(userId) {
    try {
      const metrics = await profitMarginProtector.getMetrics(userId);
      return metrics.currentMargin || 87; // Default to optimal if no data
    } catch (error) {
      logger.error('Failed to get current margin:', error);
      return 87; // Fail-safe: assume optimal margin
    }
  }

  /**
   * Adjust parameters based on margin
   */
  _adjustForMargin(currentMargin, budget, prioritize) {
    let wasAdjusted = false;

    // Critical zone: margin below target (< 85%)
    if (currentMargin < this.targetMargin) {
      budget = 'low';
      prioritize = 'cost';
      wasAdjusted = true;
      logger.warn(`CRITICAL: Margin ${currentMargin}% < ${this.targetMargin}%, forcing cost optimization`);
    }
    
    // Warning zone: margin below optimal but above target (85-87%)
    else if (currentMargin < this.optimalMargin) {
      // Downgrade budget if currently high
      if (budget === 'unlimited' || budget === 'high') {
        budget = 'medium';
        wasAdjusted = true;
        logger.info(`WARNING: Margin ${currentMargin}% < ${this.optimalMargin}%, downgrading to medium budget`);
      }
      
      // Adjust prioritization to be more cost-aware
      if (prioritize === 'quality') {
        prioritize = 'balanced';
        wasAdjusted = true;
      }
    }

    return {
      budget,
      prioritize,
      wasAdjusted
    };
  }

  /**
   * Get model cost estimate
   */
  getModelCost(modelId, tokensInput, tokensOutput) {
    const { MODEL_CAPABILITIES } = require('../../config/modelCapabilities');
    const model = MODEL_CAPABILITIES[modelId];
    
    if (!model) return 0;

    const inputCost = (tokensInput / 1000000) * model.pricing.input;
    const outputCost = (tokensOutput / 1000000) * model.pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Get chain cost estimate
   */
  getChainCost(chain, estimatedTokens = { input: 10000, output: 5000 }) {
    const { MODEL_CAPABILITIES } = require('../../config/modelCapabilities');
    let totalCost = 0;

    for (const [role, modelId] of Object.entries(chain)) {
      const model = MODEL_CAPABILITIES[modelId];
      if (model) {
        const inputCost = (estimatedTokens.input / 1000000) * model.pricing.input;
        const outputCost = (estimatedTokens.output / 1000000) * model.pricing.output;
        totalCost += inputCost + outputCost;
      }
    }

    return totalCost;
  }

  /**
   * Get recommended chain based on margin
   */
  getRecommendedChain(currentMargin, tier) {
    if (currentMargin < this.targetMargin) {
      return {
        template: 'coding-budget',
        reason: `Profit margin ${currentMargin}% below target ${this.targetMargin}%`,
        expectedCost: 'very-low'
      };
    } else if (currentMargin < this.optimalMargin) {
      return {
        template: 'coding-standard',
        reason: `Profit margin ${currentMargin}% approaching target`,
        expectedCost: 'medium'
      };
    } else if (tier === 'proPlus') {
      return {
        template: 'coding-premium',
        reason: `Profit margin ${currentMargin}% healthy, using premium models`,
        expectedCost: 'high'
      };
    } else {
      return {
        template: 'coding-standard',
        reason: `Profit margin ${currentMargin}% healthy`,
        expectedCost: 'medium'
      };
    }
  }

  /**
   * Enable/disable adaptive mode
   */
  setAdaptiveMode(enabled) {
    this.adaptiveMode = enabled;
    logger.info(`Adaptive margin protection: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set target margin
   */
  setTargetMargin(margin) {
    this.targetMargin = margin;
    logger.info(`Target profit margin set to: ${margin}%`);
  }
}

// Singleton instance
module.exports = new ModelSelectionIntegration();
