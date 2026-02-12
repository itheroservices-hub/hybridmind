const modelProxy = require('../modelProxy');
const { models } = require('../../config/models');

/**
 * Model Registry - Central registry for all available models
 * ALL models route through OpenRouter via modelProxy
 */
class ModelRegistry {
  constructor() {
    // All providers now route through OpenRouter
    this.modelProxy = modelProxy;
    this.modelConfigs = models;
  }

  /**
   * Get provider service for a model - always returns modelProxy (OpenRouter)
   */
  getProvider(modelId) {
    const config = this.modelConfigs[modelId];
    if (!config) {
      throw new Error(`Model '${modelId}' not found in registry`);
    }
    
    // Always return modelProxy - all models route through OpenRouter
    return this.modelProxy;
  }

  /**
   * Get model configuration
   */
  getConfig(modelId) {
    const config = this.modelConfigs[modelId];
    if (!config) {
      throw new Error(`Model '${modelId}' not found in registry`);
    }
    return config;
  }

  /**
   * Get all available models
   */
  getAllModels() {
    return Object.keys(this.modelConfigs).map(id => ({
      id,
      ...this.modelConfigs[id]
    }));
  }

  /**
   * Find models by capability
   */
  findByCapability(capability) {
    return Object.entries(this.modelConfigs)
      .filter(([_, config]) => config.capabilities.includes(capability))
      .map(([id, config]) => ({ id, ...config }));
  }

  /**
   * Find models by strength
   */
  findByStrength(strength) {
    return Object.entries(this.modelConfigs)
      .filter(([_, config]) => config.strengths.includes(strength))
      .map(([id, config]) => ({ id, ...config }));
  }

  /**
   * Get best model for task
   */
  getBestModelForTask(task, options = {}) {
    const { costTier, speedRequirement } = options;
    
    let candidates = Object.entries(this.modelConfigs)
      .filter(([_, config]) => config.capabilities.includes(task))
      .map(([id, config]) => ({ id, ...config }));

    // Filter by cost tier if specified
    if (costTier) {
      candidates = candidates.filter(m => m.costTier === costTier);
    }

    // Filter by speed if specified
    if (speedRequirement) {
      const speedOrder = { 'very-fast': 4, 'fast': 3, 'medium': 2, 'slow': 1 };
      const requiredSpeed = speedOrder[speedRequirement] || 0;
      candidates = candidates.filter(m => speedOrder[m.speed] >= requiredSpeed);
    }

    // Return the first candidate (models are ordered by preference in config)
    return candidates[0]?.id || null;
  }
}

module.exports = new ModelRegistry();
