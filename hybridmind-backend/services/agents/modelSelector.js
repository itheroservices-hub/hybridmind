const { modelSelectionStrategies } = require('../../config/models');
const modelRegistry = require('../models/modelRegistry');

/**
 * Model Selector - Intelligently selects models for tasks
 */
class ModelSelector {
  /**
   * Select best model for a step
   */
  selectModelForStep(step) {
    const { action, priority, estimatedComplexity } = step;

    // Map action to task capability
    const taskMapping = {
      analyze: 'analysis',
      refactor: 'refactoring',
      optimize: 'optimization',
      document: 'documentation',
      test: 'testing',
      review: 'code-review',
      fix: 'debugging'
    };

    const task = taskMapping[action] || 'code-generation';

    // Determine strategy based on priority and complexity
    let strategy;
    if (priority === 'high' || estimatedComplexity === 'complex') {
      strategy = 'quality';
    } else if (priority === 'low' && estimatedComplexity === 'simple') {
      strategy = 'cost';
    } else {
      strategy = 'balanced';
    }

    return this.selectModelForTask(task, strategy);
  }

  /**
   * Select model for specific task with strategy
   */
  selectModelForTask(task, strategy = 'balanced') {
    // Get task-based recommendations
    const taskBasedModels = modelSelectionStrategies.taskBased[task];

    if (taskBasedModels && taskBasedModels.length > 0) {
      // Apply strategy
      if (strategy === 'cost') {
        // Find cheapest model that can handle task
        const model = this.findCheapestModel(taskBasedModels);
        return model || taskBasedModels[0];
      } else if (strategy === 'quality') {
        // Use best model for task
        return taskBasedModels[0];
      } else {
        // Balanced - use second-best if available
        return taskBasedModels[Math.min(1, taskBasedModels.length - 1)];
      }
    }

    // Fallback to default models
    return this.getDefaultModel(strategy);
  }

  /**
   * Select models for agent workflow
   */
  selectModelsForWorkflow(workflowType = 'balanced') {
    const strategies = {
      'cost-optimized': modelSelectionStrategies.costOptimized,
      'quality-optimized': modelSelectionStrategies.qualityOptimized,
      'balanced': modelSelectionStrategies.balanced
    };

    const selected = strategies[workflowType] || strategies.balanced;

    return {
      planner: selected.planner,
      executor: selected.executor,
      reviewer: selected.reviewer
    };
  }

  /**
   * Select model based on code characteristics
   */
  selectModelForCode({ language, size, complexity }) {
    // For large files, prefer models with large context windows
    if (size === 'large') {
      return this.findModelWithLargestContext();
    }

    // For complex code, use best reasoning models
    if (complexity === 'high') {
      return 'gpt-4';
    }

    // For specific languages
    if (language === 'chinese' || language === 'zh') {
      return 'qwen-max';
    }

    // Default
    return 'claude-3-sonnet';
  }

  /**
   * Find cheapest model from list
   */
  findCheapestModel(modelIds) {
    const costOrder = { 'low': 1, 'medium': 2, 'high': 3 };
    
    let cheapest = modelIds[0];
    let lowestCost = 999;

    for (const modelId of modelIds) {
      try {
        const config = modelRegistry.getConfig(modelId);
        const cost = costOrder[config.costTier] || 999;
        
        if (cost < lowestCost) {
          lowestCost = cost;
          cheapest = modelId;
        }
      } catch (error) {
        // Skip invalid models
        continue;
      }
    }

    return cheapest;
  }

  /**
   * Find model with largest context window
   */
  findModelWithLargestContext() {
    const allModels = modelRegistry.getAllModels();
    
    let largest = allModels[0];
    let maxTokens = 0;

    for (const model of allModels) {
      if (model.maxTokens > maxTokens) {
        maxTokens = model.maxTokens;
        largest = model;
      }
    }

    return largest.id;
  }

  /**
   * Get default model for strategy
   */
  getDefaultModel(strategy) {
    const defaults = {
      cost: 'gpt-3.5-turbo',
      balanced: 'claude-3-sonnet',
      quality: 'gpt-4'
    };

    return defaults[strategy] || defaults.balanced;
  }

  /**
   * Recommend model for comparison
   */
  recommendModelsForComparison(task, count = 3) {
    const taskModels = modelSelectionStrategies.taskBased[task];
    
    if (!taskModels) {
      // Default comparison set
      return ['gpt-4', 'claude-3-opus', 'qwen-max'].slice(0, count);
    }

    return taskModels.slice(0, count);
  }
}

module.exports = new ModelSelector();
