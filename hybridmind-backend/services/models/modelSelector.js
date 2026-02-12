/**
 * Intelligent Model Selector
 * 
 * Selects optimal AI models based on task requirements, user tier, budget, and performance needs.
 * Integrates with model capabilities database for smart selection.
 */

const { 
  MODEL_CAPABILITIES, 
  TASK_CAPABILITY_REQUIREMENTS,
  MODEL_CHAIN_TEMPLATES 
} = require('../../config/modelCapabilities');
const logger = require('../../utils/logger');

class ModelSelector {
  constructor() {
    this.stats = {
      totalSelections: 0,
      autoSelections: 0,
      manualSelections: 0,
      byTaskType: {},
      byModel: {}
    };
  }

  /**
   * Select best model for a specific task
   */
  selectModel({
    taskType,
    role,
    requirements = {},
    tier = 'free',
    budget = 'medium',
    prioritize = 'balanced', // 'speed', 'quality', 'cost', 'balanced'
    excludeModels = [],
    availableModels = null
  }) {
    this.stats.totalSelections++;
    this.stats.autoSelections++;
    
    logger.info(`Selecting model for ${taskType} (role: ${role}, priority: ${prioritize})`);

    // Get available models based on tier
    const models = availableModels || this._getModelsForTier(tier);
    
    // Filter out excluded models
    const candidates = models.filter(m => !excludeModels.includes(m));

    if (candidates.length === 0) {
      logger.warn('No models available for selection');
      return this._getFallbackModel(tier);
    }

    // Get task requirements
    const taskReqs = TASK_CAPABILITY_REQUIREMENTS[taskType] || {
      primary: 'reasoning',
      secondary: [],
      minimum: 6
    };

    // Score each model
    const scored = candidates.map(modelId => {
      const capabilities = MODEL_CAPABILITIES[modelId];
      
      if (!capabilities) {
        return { modelId, score: 0 };
      }

      const score = this._scoreModel({
        capabilities,
        taskReqs,
        requirements,
        prioritize,
        budget,
        role
      });

      return { modelId, score, capabilities };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0];
    
    // Track stats
    this.stats.byTaskType[taskType] = (this.stats.byTaskType[taskType] || 0) + 1;
    this.stats.byModel[selected.modelId] = (this.stats.byModel[selected.modelId] || 0) + 1;

    logger.info(`Selected ${selected.modelId} (score: ${selected.score.toFixed(2)})`);

    return {
      modelId: selected.modelId,
      capabilities: selected.capabilities,
      score: selected.score,
      reasoning: this._explainSelection(selected, scored.slice(1, 3))
    };
  }

  /**
   * Select models for a multi-agent chain
   */
  selectChain({
    chainType,
    tier = 'free',
    budget = 'medium',
    customRoles = null,
    template = null
  }) {
    logger.info(`Selecting model chain: ${chainType} (tier: ${tier}, budget: ${budget})`);

    // Use template if provided
    if (template && MODEL_CHAIN_TEMPLATES[template]) {
      const chainTemplate = MODEL_CHAIN_TEMPLATES[template];
      return {
        chain: chainTemplate.roles,
        template: template,
        estimatedCost: chainTemplate.estimatedCost,
        estimatedSpeed: chainTemplate.estimatedSpeed
      };
    }

    // Define roles based on chain type
    const roles = customRoles || this._getDefaultRoles(chainType);

    // Select model for each role
    const chain = {};
    const totalCost = { input: 0, output: 0 };

    for (const [roleName, roleConfig] of Object.entries(roles)) {
      const selection = this.selectModel({
        taskType: roleConfig.taskType,
        role: roleName,
        requirements: roleConfig.requirements || {},
        tier,
        budget,
        prioritize: roleConfig.prioritize || 'balanced'
      });

      chain[roleName] = selection.modelId;
      
      // Accumulate cost
      const capabilities = MODEL_CAPABILITIES[selection.modelId];
      if (capabilities) {
        totalCost.input += capabilities.pricing.input;
        totalCost.output += capabilities.pricing.output;
      }
    }

    return {
      chain,
      estimatedCost: this._categorizeCost(totalCost),
      roles,
      breakdown: Object.entries(chain).map(([role, modelId]) => ({
        role,
        model: modelId,
        capabilities: MODEL_CAPABILITIES[modelId]
      }))
    };
  }

  /**
   * Get pre-configured template
   */
  getTemplate(templateName) {
    return MODEL_CHAIN_TEMPLATES[templateName];
  }

  /**
   * List all available templates
   */
  listTemplates() {
    return Object.entries(MODEL_CHAIN_TEMPLATES).map(([key, template]) => ({
      id: key,
      ...template
    }));
  }

  /**
   * Score a model for a task
   */
  _scoreModel({
    capabilities,
    taskReqs,
    requirements,
    prioritize,
    budget,
    role
  }) {
    let score = 0;

    // Primary capability (weight: 40%)
    const primaryScore = capabilities.capabilities[taskReqs.primary] || 0;
    if (primaryScore < taskReqs.minimum) {
      return 0; // Doesn't meet minimum
    }
    score += primaryScore * 4.0;

    // Secondary capabilities (weight: 20%)
    for (const secondary of taskReqs.secondary) {
      const secondaryScore = capabilities.capabilities[secondary] || 0;
      score += secondaryScore * (2.0 / taskReqs.secondary.length);
    }

    // Apply prioritization adjustments (weight: 30%)
    if (prioritize === 'speed') {
      score += capabilities.capabilities.speed * 3.0;
    } else if (prioritize === 'cost') {
      score += capabilities.capabilities.costEfficiency * 3.0;
    } else if (prioritize === 'quality') {
      score += primaryScore * 3.0;
    } else {
      // Balanced: average of all three
      score += (capabilities.capabilities.speed + 
                capabilities.capabilities.costEfficiency + 
                primaryScore) / 3 * 3.0;
    }

    // Budget constraints (weight: 10%)
    const budgetScore = this._getBudgetScore(capabilities, budget);
    score += budgetScore * 1.0;

    // Role compatibility bonus
    if (capabilities.bestFor.includes(role)) {
      score += 5.0;
    }

    // Penalty for not recommended
    if (capabilities.notRecommendedFor.includes(role) || 
        capabilities.notRecommendedFor.includes(taskReqs.primary)) {
      score -= 10.0;
    }

    return Math.max(0, score);
  }

  /**
   * Get budget score for model
   */
  _getBudgetScore(capabilities, budget) {
    const avgCost = (capabilities.pricing.input + capabilities.pricing.output) / 2;

    if (budget === 'unlimited') {
      return 10; // No budget constraint
    } else if (budget === 'high') {
      return avgCost < 30 ? 10 : avgCost < 50 ? 7 : 5;
    } else if (budget === 'medium') {
      return avgCost < 10 ? 10 : avgCost < 20 ? 7 : avgCost < 40 ? 4 : 0;
    } else { // 'low'
      return avgCost < 2 ? 10 : avgCost < 5 ? 5 : 0;
    }
  }

  /**
   * Get models available for tier
   */
  _getModelsForTier(tier) {
    if (tier === 'free') {
      return [
        'groq/llama-3.1-8b-instant',
        'groq/llama-3.1-70b-versatile',
        'openai/gpt-3.5-turbo'
      ];
    } else if (tier === 'pro') {
      return [
        'groq/llama-3.1-8b-instant',
        'groq/llama-3.1-70b-versatile',
        'openai/gpt-3.5-turbo',
        'openai/gpt-4-turbo',
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'deepseek/qwen-3-480b-coder',
        'google/gemini-pro-1.5'
      ];
    } else { // proPlus
      return Object.keys(MODEL_CAPABILITIES);
    }
  }

  /**
   * Get fallback model for tier
   */
  _getFallbackModel(tier) {
    const fallbacks = {
      free: 'groq/llama-3.1-70b-versatile',
      pro: 'anthropic/claude-3.5-sonnet',
      proPlus: 'openai/o1'
    };

    const modelId = fallbacks[tier] || fallbacks.free;
    
    return {
      modelId,
      capabilities: MODEL_CAPABILITIES[modelId],
      score: 0,
      reasoning: 'Fallback model (no suitable models found)'
    };
  }

  /**
   * Get default roles for chain type
   */
  _getDefaultRoles(chainType) {
    const roleTemplates = {
      'coding': {
        planner: {
          taskType: 'planning',
          prioritize: 'quality'
        },
        builder: {
          taskType: 'code-generation',
          prioritize: 'speed'
        },
        reviewer: {
          taskType: 'code-review',
          prioritize: 'quality'
        }
      },
      'research': {
        researcher: {
          taskType: 'research',
          prioritize: 'quality'
        },
        analyst: {
          taskType: 'planning',
          prioritize: 'quality'
        },
        documenter: {
          taskType: 'documentation',
          prioritize: 'balanced'
        }
      },
      'review': {
        reviewer1: {
          taskType: 'code-review',
          prioritize: 'quality'
        },
        reviewer2: {
          taskType: 'code-review',
          prioritize: 'quality'
        },
        synthesizer: {
          taskType: 'documentation',
          prioritize: 'balanced'
        }
      }
    };

    return roleTemplates[chainType] || roleTemplates.coding;
  }

  /**
   * Categorize cost level
   */
  _categorizeCost(totalCost) {
    const avg = (totalCost.input + totalCost.output) / 2;
    
    if (avg < 2) return 'very-low';
    if (avg < 5) return 'low';
    if (avg < 15) return 'medium';
    if (avg < 40) return 'high';
    return 'very-high';
  }

  /**
   * Explain why model was selected
   */
  _explainSelection(selected, alternatives) {
    const cap = selected.capabilities;
    const reasons = [];

    // Primary strengths
    reasons.push(`Strong in ${cap.strengths[0].toLowerCase()}`);

    // Cost/speed advantages
    if (cap.capabilities.speed >= 9) {
      reasons.push('ultra-fast response time');
    }
    if (cap.capabilities.costEfficiency >= 9) {
      reasons.push('very cost-effective');
    }

    // Comparison with alternatives
    if (alternatives.length > 0) {
      const alt = alternatives[0];
      const scoreDiff = selected.score - alt.score;
      reasons.push(`${scoreDiff.toFixed(1)} points better than ${alt.modelId}`);
    }

    return reasons.join(', ');
  }

  /**
   * Get recommendations for user
   */
  getRecommendations({
    taskType,
    tier,
    userPreferences = {}
  }) {
    const models = this._getModelsForTier(tier);
    
    const recommendations = models.map(modelId => {
      const capabilities = MODEL_CAPABILITIES[modelId];
      const selection = this.selectModel({
        taskType,
        role: 'general',
        tier,
        budget: userPreferences.budget || 'medium',
        prioritize: userPreferences.prioritize || 'balanced',
        availableModels: [modelId]
      });

      return {
        modelId,
        name: capabilities.name,
        score: selection.score,
        bestFor: capabilities.bestFor,
        cost: capabilities.pricing,
        speed: capabilities.capabilities.speed,
        quality: capabilities.capabilities[TASK_CAPABILITY_REQUIREMENTS[taskType]?.primary || 'reasoning']
      };
    });

    recommendations.sort((a, b) => b.score - a.score);

    return {
      recommended: recommendations[0],
      alternatives: recommendations.slice(1, 4),
      all: recommendations
    };
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      topModels: Object.entries(this.stats.byModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([model, count]) => ({ model, count })),
      topTasks: Object.entries(this.stats.byTaskType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([task, count]) => ({ task, count }))
    };
  }
}

// Singleton instance
module.exports = new ModelSelector();
