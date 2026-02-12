/**
 * Workflow Optimizer
 * 
 * Identifies redundant work, detects bottlenecks, runs independent tasks async,
 * and routes only essential context to the next step.
 */

const logger = require('../../utils/logger');
const crypto = require('crypto');

class WorkflowOptimizer {
  constructor() {
    // Cache for detecting redundant work
    this.taskCache = new Map();
    
    // Performance metrics
    this.metrics = {
      redundancyDetections: 0,
      bottlenecksIdentified: 0,
      asyncOptimizations: 0,
      contextReductions: 0
    };
  }

  /**
   * Analyze workflow for optimization opportunities
   */
  analyzeWorkflow(steps, context = {}) {
    logger.info(`Analyzing workflow with ${steps.length} steps for optimization`);
    
    const analysis = {
      redundancy: this._detectRedundancy(steps),
      bottlenecks: this._identifyBottlenecks(steps),
      parallelizable: this._findParallelizableTasks(steps),
      contextOptimization: this._analyzeContextUsage(steps, context)
    };
    
    logger.info(`Workflow analysis: ${analysis.redundancy.length} redundant, ${analysis.parallelizable.length} parallelizable, ${analysis.bottlenecks.length} bottlenecks`);
    
    return analysis;
  }

  /**
   * Detect redundant work across steps
   * Returns steps that are doing the same work
   */
  _detectRedundancy(steps) {
    const redundant = [];
    const taskSignatures = new Map();
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const signature = this._generateTaskSignature(step);
      
      if (taskSignatures.has(signature)) {
        redundant.push({
          stepIndex: i,
          duplicateOf: taskSignatures.get(signature),
          step: step,
          reason: 'Same task signature - identical work detected'
        });
        this.metrics.redundancyDetections++;
      } else {
        taskSignatures.set(signature, i);
      }
    }
    
    return redundant;
  }

  /**
   * Generate unique signature for a task
   */
  _generateTaskSignature(step) {
    const taskData = {
      type: step.type || step.action || 'unknown',
      description: (step.description || step.prompt || '').toLowerCase().trim(),
      target: step.target || step.file || ''
    };
    
    const signature = JSON.stringify(taskData);
    return crypto.createHash('md5').update(signature).digest('hex');
  }

  /**
   * Identify bottlenecks in the workflow
   * Bottlenecks are steps that block many subsequent steps
   */
  _identifyBottlenecks(steps) {
    const bottlenecks = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const dependencies = step.dependencies || [];
      
      // Count how many subsequent steps depend on this one
      let dependentCount = 0;
      for (let j = i + 1; j < steps.length; j++) {
        const laterStep = steps[j];
        const laterDeps = laterStep.dependencies || [];
        
        if (laterDeps.includes(step.id || `step-${i}`)) {
          dependentCount++;
        }
      }
      
      // If 3+ steps depend on this one, it's a bottleneck
      if (dependentCount >= 3) {
        bottlenecks.push({
          stepIndex: i,
          step: step,
          dependentCount,
          reason: `${dependentCount} steps blocked by this step`,
          suggestion: 'Consider breaking this step into smaller parallel tasks'
        });
        this.metrics.bottlenecksIdentified++;
      }
    }
    
    return bottlenecks;
  }

  /**
   * Find tasks that can run in parallel
   * Tasks are parallelizable if they have no dependencies or same dependencies
   */
  _findParallelizableTasks(steps) {
    const parallelGroups = [];
    const processed = new Set();
    
    for (let i = 0; i < steps.length; i++) {
      if (processed.has(i)) continue;
      
      const step = steps[i];
      const deps = step.dependencies || [];
      const depsKey = deps.sort().join(',');
      
      // Find all steps with same dependencies
      const group = [i];
      
      for (let j = i + 1; j < steps.length; j++) {
        if (processed.has(j)) continue;
        
        const otherStep = steps[j];
        const otherDeps = otherStep.dependencies || [];
        const otherDepsKey = otherDeps.sort().join(',');
        
        // Same dependencies = can run in parallel
        if (depsKey === otherDepsKey) {
          group.push(j);
          processed.add(j);
        }
      }
      
      // If 2+ steps can run together, mark as parallelizable
      if (group.length >= 2) {
        parallelGroups.push({
          steps: group.map(idx => ({ index: idx, step: steps[idx] })),
          dependencies: deps,
          reason: 'No conflicting dependencies - can execute simultaneously',
          expectedSpeedup: `~${group.length}x faster`
        });
        this.metrics.asyncOptimizations++;
      }
      
      processed.add(i);
    }
    
    return parallelGroups;
  }

  /**
   * Analyze context usage and identify essential vs. redundant context
   */
  _analyzeContextUsage(steps, fullContext) {
    const contextSize = JSON.stringify(fullContext).length;
    const recommendations = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const essentialKeys = this._identifyEssentialContext(step, fullContext);
      
      if (essentialKeys.length < Object.keys(fullContext).length) {
        const reducedContext = {};
        essentialKeys.forEach(key => {
          if (fullContext[key] !== undefined) {
            reducedContext[key] = fullContext[key];
          }
        });
        
        const reducedSize = JSON.stringify(reducedContext).length;
        const reduction = ((1 - reducedSize / contextSize) * 100).toFixed(1);
        
        recommendations.push({
          stepIndex: i,
          step: step,
          essentialKeys,
          reducedContext,
          originalSize: contextSize,
          reducedSize,
          reductionPercentage: `${reduction}%`,
          reason: 'Only route essential context keys to reduce token usage'
        });
        
        this.metrics.contextReductions++;
      }
    }
    
    return recommendations;
  }

  /**
   * Identify essential context keys for a step
   */
  _identifyEssentialContext(step, fullContext) {
    const essentialKeys = ['prompt', 'task', 'goal']; // Always include
    
    const stepText = JSON.stringify(step).toLowerCase();
    
    // Check which context keys are referenced in step
    Object.keys(fullContext).forEach(key => {
      const keyLower = key.toLowerCase();
      if (stepText.includes(keyLower)) {
        if (!essentialKeys.includes(key)) {
          essentialKeys.push(key);
        }
      }
    });
    
    return essentialKeys;
  }

  /**
   * Optimize workflow based on analysis
   * Returns optimized workflow with redundancy removed, bottlenecks noted, parallel groups
   */
  optimizeWorkflow(steps, context = {}) {
    const analysis = this.analyzeWorkflow(steps, context);
    
    // Remove redundant steps
    const redundantIndices = new Set(analysis.redundancy.map(r => r.stepIndex));
    let optimizedSteps = steps.filter((_, idx) => !redundantIndices.has(idx));
    
    // Mark bottlenecks (don't remove, just flag for monitoring)
    const bottleneckIndices = new Set(analysis.bottlenecks.map(b => b.stepIndex));
    optimizedSteps = optimizedSteps.map((step, idx) => {
      if (bottleneckIndices.has(idx)) {
        return {
          ...step,
          _isBottleneck: true,
          _bottleneckInfo: analysis.bottlenecks.find(b => b.stepIndex === idx)
        };
      }
      return step;
    });
    
    // Add parallel execution hints
    const parallelGroups = analysis.parallelizable;
    
    return {
      optimizedSteps,
      parallelGroups,
      contextOptimization: analysis.contextOptimization,
      removed: {
        redundant: analysis.redundancy,
        count: redundantIndices.size
      },
      bottlenecks: analysis.bottlenecks,
      metrics: {
        originalSteps: steps.length,
        optimizedSteps: optimizedSteps.length,
        stepsRemoved: redundantIndices.size,
        parallelGroups: parallelGroups.length,
        estimatedSpeedup: parallelGroups.length > 0 ? 
          `${Math.max(...parallelGroups.map(g => g.steps.length))}x` : '1x'
      }
    };
  }

  /**
   * Route only essential context to a step
   */
  routeEssentialContext(step, fullContext, stepIndex) {
    const essentialKeys = this._identifyEssentialContext(step, fullContext);
    const reducedContext = {};
    
    essentialKeys.forEach(key => {
      if (fullContext[key] !== undefined) {
        reducedContext[key] = fullContext[key];
      }
    });
    
    // Add step-specific metadata
    reducedContext._stepIndex = stepIndex;
    reducedContext._essentialKeysOnly = true;
    reducedContext._originalKeys = Object.keys(fullContext);
    
    return reducedContext;
  }

  /**
   * Execute steps with optimization
   * Returns execution plan with parallel batches and context routing
   */
  createOptimizedExecutionPlan(steps, context = {}) {
    const optimization = this.optimizeWorkflow(steps, context);
    const executionPlan = [];
    
    // Group steps into execution batches
    const processed = new Set();
    let batchIndex = 0;
    
    for (let i = 0; i < optimization.optimizedSteps.length; i++) {
      if (processed.has(i)) continue;
      
      const step = optimization.optimizedSteps[i];
      const batch = {
        batchIndex,
        type: 'sequential',
        steps: [
          {
            stepIndex: i,
            step,
            context: this.routeEssentialContext(step, context, i)
          }
        ]
      };
      
      // Check if this step is part of a parallel group
      const parallelGroup = optimization.parallelGroups.find(g => 
        g.steps.some(s => s.index === i)
      );
      
      if (parallelGroup) {
        // Execute entire group in parallel
        batch.type = 'parallel';
        batch.steps = parallelGroup.steps.map(s => ({
          stepIndex: s.index,
          step: s.step,
          context: this.routeEssentialContext(s.step, context, s.index)
        }));
        
        // Mark all as processed
        parallelGroup.steps.forEach(s => processed.add(s.index));
      } else {
        processed.add(i);
      }
      
      executionPlan.push(batch);
      batchIndex++;
    }
    
    return {
      batches: executionPlan,
      optimization: optimization.metrics,
      summary: {
        totalBatches: executionPlan.length,
        parallelBatches: executionPlan.filter(b => b.type === 'parallel').length,
        sequentialBatches: executionPlan.filter(b => b.type === 'sequential').length,
        removedRedundancy: optimization.removed.count,
        identifiedBottlenecks: optimization.bottlenecks.length
      }
    };
  }

  /**
   * Get optimization metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.taskCache.size
    };
  }

  /**
   * Clear optimization cache
   */
  clearCache() {
    this.taskCache.clear();
    logger.info('Workflow optimizer cache cleared');
  }
}

// Singleton instance
module.exports = new WorkflowOptimizer();
