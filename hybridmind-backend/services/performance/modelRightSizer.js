/**
 * Model Right-Sizing Optimizer
 * 
 * Automatically selects the smallest viable model for each task:
 * - Analyzes task complexity
 * - Maps task types to optimal models
 * - Tracks quality vs cost tradeoffs
 * - Auto-downgrades when quality allows
 * - Maintains quality thresholds
 */

const logger = require('../../utils/logger');
const performanceBenchmark = require('./performanceBenchmark');

/**
 * Task complexity levels
 */
const COMPLEXITY_LEVELS = {
  TRIVIAL: 'trivial',       // Simple responses, <100 tokens
  SIMPLE: 'simple',         // Basic tasks, <500 tokens
  MODERATE: 'moderate',     // Standard tasks, <2000 tokens
  COMPLEX: 'complex',       // Advanced tasks, <5000 tokens
  ADVANCED: 'advanced'      // Sophisticated tasks, >5000 tokens
};

/**
 * Model tiers by capability and cost
 */
const MODEL_TIERS = {
  NANO: {
    models: [
      'groq/llama-3.1-8b-instant',
      'openrouter/meta-llama/llama-3-8b-instruct'
    ],
    costMultiplier: 0.1,
    maxComplexity: COMPLEXITY_LEVELS.SIMPLE,
    avgQuality: 70
  },
  SMALL: {
    models: [
      'groq/llama-3.1-70b-versatile',
      'openrouter/meta-llama/llama-3.1-70b-instruct'
    ],
    costMultiplier: 0.3,
    maxComplexity: COMPLEXITY_LEVELS.MODERATE,
    avgQuality: 80
  },
  MEDIUM: {
    models: [
      'openrouter/anthropic/claude-3.5-sonnet',
      'openrouter/google/gemini-pro-1.5'
    ],
    costMultiplier: 1.0,
    maxComplexity: COMPLEXITY_LEVELS.COMPLEX,
    avgQuality: 90
  },
  LARGE: {
    models: [
      'openrouter/anthropic/claude-3-opus',
      'openrouter/openai/gpt-4-turbo'
    ],
    costMultiplier: 3.0,
    maxComplexity: COMPLEXITY_LEVELS.ADVANCED,
    avgQuality: 95
  }
};

class ModelRightSizer {
  constructor() {
    this.taskTypeMapping = new Map(); // taskType -> recommended model tier
    this.qualityThresholds = {
      minimum: 70,    // Absolute minimum quality score
      target: 85,     // Target quality score
      excellent: 95   // Excellent quality score
    };
    
    this.stats = {
      totalOptimizations: 0,
      downgrades: 0,
      upgrades: 0,
      costSavings: 0,
      qualityMaintained: 0
    };

    // Initialize default mappings
    this._initializeDefaultMappings();
  }

  /**
   * Initialize default task-to-model mappings
   */
  _initializeDefaultMappings() {
    // Trivial tasks -> NANO
    this.taskTypeMapping.set('simple_response', 'NANO');
    this.taskTypeMapping.set('formatting', 'NANO');
    this.taskTypeMapping.set('extraction', 'NANO');

    // Simple tasks -> SMALL
    this.taskTypeMapping.set('summarization', 'SMALL');
    this.taskTypeMapping.set('classification', 'SMALL');
    this.taskTypeMapping.set('translation', 'SMALL');

    // Moderate tasks -> MEDIUM
    this.taskTypeMapping.set('code_generation', 'MEDIUM');
    this.taskTypeMapping.set('analysis', 'MEDIUM');
    this.taskTypeMapping.set('planning', 'MEDIUM');

    // Complex tasks -> LARGE
    this.taskTypeMapping.set('complex_reasoning', 'LARGE');
    this.taskTypeMapping.set('research', 'LARGE');
    this.taskTypeMapping.set('architecture', 'LARGE');
  }

  /**
   * Analyze task complexity
   */
  analyzeComplexity({
    task,
    taskType = null,
    context = {},
    expectedOutputTokens = null
  }) {
    let complexityScore = 0;
    let factors = [];

    // Task length
    const taskLength = task.length;
    if (taskLength < 100) {
      complexityScore += 1;
      factors.push('short_task');
    } else if (taskLength < 500) {
      complexityScore += 2;
      factors.push('medium_task');
    } else if (taskLength < 2000) {
      complexityScore += 3;
      factors.push('long_task');
    } else {
      complexityScore += 4;
      factors.push('very_long_task');
    }

    // Expected output size
    if (expectedOutputTokens) {
      if (expectedOutputTokens < 100) {
        complexityScore += 0.5;
      } else if (expectedOutputTokens < 500) {
        complexityScore += 1;
      } else if (expectedOutputTokens < 2000) {
        complexityScore += 2;
      } else {
        complexityScore += 3;
      }
    }

    // Context size
    const contextSize = JSON.stringify(context).length;
    if (contextSize > 5000) {
      complexityScore += 1;
      factors.push('large_context');
    }

    // Keywords indicating complexity
    const complexKeywords = [
      'complex', 'advanced', 'sophisticated', 'comprehensive',
      'research', 'analyze deeply', 'architectural', 'multi-step'
    ];
    
    const simpleKeywords = [
      'simple', 'basic', 'quick', 'extract', 'format', 'list'
    ];

    for (const keyword of complexKeywords) {
      if (task.toLowerCase().includes(keyword)) {
        complexityScore += 1;
        factors.push(`keyword:${keyword}`);
      }
    }

    for (const keyword of simpleKeywords) {
      if (task.toLowerCase().includes(keyword)) {
        complexityScore -= 0.5;
        factors.push(`keyword:${keyword}`);
      }
    }

    // Task type override
    if (taskType) {
      const mapping = this.taskTypeMapping.get(taskType);
      if (mapping === 'NANO') complexityScore = Math.min(complexityScore, 2);
      if (mapping === 'LARGE') complexityScore = Math.max(complexityScore, 4);
    }

    // Determine complexity level
    let complexityLevel;
    if (complexityScore < 1.5) {
      complexityLevel = COMPLEXITY_LEVELS.TRIVIAL;
    } else if (complexityScore < 3) {
      complexityLevel = COMPLEXITY_LEVELS.SIMPLE;
    } else if (complexityScore < 5) {
      complexityLevel = COMPLEXITY_LEVELS.MODERATE;
    } else if (complexityScore < 7) {
      complexityLevel = COMPLEXITY_LEVELS.COMPLEX;
    } else {
      complexityLevel = COMPLEXITY_LEVELS.ADVANCED;
    }

    return {
      complexityLevel,
      complexityScore,
      factors,
      taskLength,
      contextSize
    };
  }

  /**
   * Select optimal model for task
   */
  selectOptimalModel({
    task,
    taskType = null,
    context = {},
    expectedOutputTokens = null,
    qualityRequirement = 'target', // 'minimum', 'target', 'excellent'
    currentModel = null
  }) {
    const complexity = this.analyzeComplexity({
      task,
      taskType,
      context,
      expectedOutputTokens
    });

    // Select tier based on complexity
    let recommendedTier;
    
    switch (complexity.complexityLevel) {
      case COMPLEXITY_LEVELS.TRIVIAL:
        recommendedTier = 'NANO';
        break;
      case COMPLEXITY_LEVELS.SIMPLE:
        recommendedTier = 'SMALL';
        break;
      case COMPLEXITY_LEVELS.MODERATE:
        recommendedTier = 'MEDIUM';
        break;
      case COMPLEXITY_LEVELS.COMPLEX:
      case COMPLEXITY_LEVELS.ADVANCED:
        recommendedTier = 'LARGE';
        break;
      default:
        recommendedTier = 'MEDIUM';
    }

    // Adjust for quality requirement
    if (qualityRequirement === 'excellent') {
      if (recommendedTier === 'NANO') recommendedTier = 'SMALL';
      if (recommendedTier === 'SMALL') recommendedTier = 'MEDIUM';
    } else if (qualityRequirement === 'minimum') {
      if (recommendedTier === 'LARGE') recommendedTier = 'MEDIUM';
      if (recommendedTier === 'MEDIUM' && complexity.complexityLevel === COMPLEXITY_LEVELS.SIMPLE) {
        recommendedTier = 'SMALL';
      }
    }

    const tier = MODEL_TIERS[recommendedTier];
    const selectedModel = tier.models[0]; // Use first model in tier

    // Track optimization
    this.stats.totalOptimizations++;
    
    if (currentModel) {
      const currentTier = this._getModelTier(currentModel);
      if (currentTier && MODEL_TIERS[currentTier].costMultiplier > tier.costMultiplier) {
        this.stats.downgrades++;
        const savings = MODEL_TIERS[currentTier].costMultiplier - tier.costMultiplier;
        this.stats.costSavings += savings;
      } else if (currentTier && MODEL_TIERS[currentTier].costMultiplier < tier.costMultiplier) {
        this.stats.upgrades++;
      }
    }

    return {
      model: selectedModel,
      tier: recommendedTier,
      complexity: complexity.complexityLevel,
      expectedQuality: tier.avgQuality,
      costMultiplier: tier.costMultiplier,
      reasoning: this._buildReasoning(complexity, recommendedTier, qualityRequirement)
    };
  }

  /**
   * Get tier for a model
   */
  _getModelTier(model) {
    for (const [tierName, tier] of Object.entries(MODEL_TIERS)) {
      if (tier.models.includes(model)) {
        return tierName;
      }
    }
    return null;
  }

  /**
   * Build reasoning for model selection
   */
  _buildReasoning(complexity, tier, qualityRequirement) {
    const reasons = [
      `Task complexity: ${complexity.complexityLevel} (score: ${complexity.complexityScore.toFixed(1)})`,
      `Selected tier: ${tier} (${MODEL_TIERS[tier].models[0]})`,
      `Expected quality: ${MODEL_TIERS[tier].avgQuality}%`,
      `Quality requirement: ${qualityRequirement}`
    ];

    if (complexity.factors.length > 0) {
      reasons.push(`Complexity factors: ${complexity.factors.join(', ')}`);
    }

    return reasons.join('; ');
  }

  /**
   * Learn from execution results
   */
  learnFromExecution({
    taskType,
    model,
    qualityScore,
    cost,
    success
  }) {
    if (!success || qualityScore < this.qualityThresholds.minimum) {
      // Quality too low - upgrade for this task type
      const currentTier = this._getModelTier(model);
      if (currentTier) {
        const tierIndex = Object.keys(MODEL_TIERS).indexOf(currentTier);
        if (tierIndex < Object.keys(MODEL_TIERS).length - 1) {
          const nextTier = Object.keys(MODEL_TIERS)[tierIndex + 1];
          this.taskTypeMapping.set(taskType, nextTier);
          logger.info(`Upgraded task type '${taskType}' to ${nextTier} due to low quality`);
        }
      }
    } else if (qualityScore > this.qualityThresholds.excellent) {
      // Quality exceeds target - can potentially downgrade
      const currentTier = this._getModelTier(model);
      if (currentTier) {
        const tierIndex = Object.keys(MODEL_TIERS).indexOf(currentTier);
        if (tierIndex > 0) {
          // Track that we could downgrade next time
          logger.debug(`Task type '${taskType}' quality exceeds target - could use smaller model`);
        }
      }
    }

    if (qualityScore >= this.qualityThresholds.target) {
      this.stats.qualityMaintained++;
    }
  }

  /**
   * Get model recommendations for batch
   */
  getBatchRecommendations(tasks) {
    const recommendations = tasks.map(task => {
      return this.selectOptimalModel(task);
    });

    // Group by model for batch efficiency
    const modelGroups = {};
    
    recommendations.forEach((rec, index) => {
      if (!modelGroups[rec.model]) {
        modelGroups[rec.model] = {
          model: rec.model,
          tier: rec.tier,
          tasks: []
        };
      }
      modelGroups[rec.model].tasks.push({ index, task: tasks[index] });
    });

    return {
      recommendations,
      modelGroups: Object.values(modelGroups),
      totalCostReduction: this._estimateCostReduction(recommendations)
    };
  }

  /**
   * Estimate cost reduction from right-sizing
   */
  _estimateCostReduction(recommendations) {
    // Compare against using MEDIUM tier for everything
    const baselineCost = recommendations.length * MODEL_TIERS.MEDIUM.costMultiplier;
    const optimizedCost = recommendations.reduce((sum, rec) => {
      return sum + rec.costMultiplier;
    }, 0);

    return ((baselineCost - optimizedCost) / baselineCost) * 100;
  }

  /**
   * Get optimization stats
   */
  getStats() {
    return {
      ...this.stats,
      taskTypeMappings: this.taskTypeMapping.size,
      avgCostSaving: this.stats.downgrades > 0 
        ? (this.stats.costSavings / this.stats.downgrades).toFixed(2)
        : 0,
      qualityMaintenanceRate: this.stats.totalOptimizations > 0
        ? ((this.stats.qualityMaintained / this.stats.totalOptimizations) * 100).toFixed(1)
        : 0
    };
  }

  /**
   * Update quality thresholds
   */
  setQualityThresholds(thresholds) {
    this.qualityThresholds = {
      ...this.qualityThresholds,
      ...thresholds
    };
    logger.info('Quality thresholds updated', this.qualityThresholds);
  }

  /**
   * Get task type mappings
   */
  getTaskTypeMappings() {
    return Object.fromEntries(this.taskTypeMapping);
  }
}

// Singleton instance
module.exports = new ModelRightSizer();
