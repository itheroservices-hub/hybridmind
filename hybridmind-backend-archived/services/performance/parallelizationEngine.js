/**
 * Parallelization Engine
 * 
 * Identifies and executes independent operations in parallel:
 * - Batch model calls
 * - Parallel agent execution
 * - Concurrent tool calls
 * - Database queries
 * 
 * Uses Promise.all(), Promise.allSettled(), and worker pools.
 */

const logger = require('../../utils/logger');
const performanceBenchmark = require('./performanceBenchmark');

class ParallelizationEngine {
  constructor() {
    this.stats = {
      totalParallelExecutions: 0,
      totalTasksExecuted: 0,
      avgSpeedup: 0,
      maxConcurrency: 10 // Safety limit
    };
  }

  /**
   * Execute tasks in parallel with batching
   */
  async executeParallel({
    tasks,
    maxConcurrency = 10,
    mode = 'all', // 'all', 'allSettled', 'race'
    onProgress = null
  }) {
    const measurementId = performanceBenchmark.startMeasurement({
      operationType: 'parallel_execution',
      metadata: {
        taskCount: tasks.length,
        maxConcurrency,
        mode
      }
    });

    this.stats.totalParallelExecutions++;
    const startTime = Date.now();

    try {
      let results;

      if (tasks.length <= maxConcurrency) {
        // Execute all tasks in parallel
        results = await this._executeMode(tasks, mode, onProgress);
      } else {
        // Batch execution to respect concurrency limit
        results = await this._executeBatched(tasks, maxConcurrency, mode, onProgress);
      }

      const duration = Date.now() - startTime;
      this.stats.totalTasksExecuted += tasks.length;

      // Calculate speedup (estimated sequential time / actual parallel time)
      const estimatedSequentialTime = tasks.length * 1000; // Rough estimate
      const speedup = estimatedSequentialTime / duration;
      this.stats.avgSpeedup = 
        ((this.stats.avgSpeedup * (this.stats.totalParallelExecutions - 1)) + speedup) / 
        this.stats.totalParallelExecutions;

      performanceBenchmark.endMeasurement(measurementId, {
        success: true,
        metadata: {
          taskCount: tasks.length,
          duration,
          speedup: speedup.toFixed(2)
        }
      });

      logger.debug(`Parallel execution: ${tasks.length} tasks in ${duration}ms (${speedup.toFixed(2)}x speedup)`);

      return results;

    } catch (error) {
      performanceBenchmark.endMeasurement(measurementId, {
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute based on mode
   */
  async _executeMode(tasks, mode, onProgress) {
    const taskPromises = tasks.map((task, index) => {
      return this._wrapWithProgress(task, index, onProgress);
    });

    if (mode === 'all') {
      return await Promise.all(taskPromises);
    } else if (mode === 'allSettled') {
      return await Promise.allSettled(taskPromises);
    } else if (mode === 'race') {
      return await Promise.race(taskPromises);
    }

    throw new Error(`Unknown mode: ${mode}`);
  }

  /**
   * Execute in batches to respect concurrency limit
   */
  async _executeBatched(tasks, maxConcurrency, mode, onProgress) {
    const results = [];
    const batches = [];

    // Split into batches
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      batches.push(tasks.slice(i, i + maxConcurrency));
    }

    // Execute batches sequentially (tasks within batch run in parallel)
    for (const batch of batches) {
      const batchResults = await this._executeMode(batch, mode, onProgress);
      
      if (mode === 'race') {
        return batchResults; // Race returns single result
      }
      
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Wrap task with progress callback
   */
  async _wrapWithProgress(task, index, onProgress) {
    const result = await task();
    
    if (onProgress) {
      onProgress(index, result);
    }
    
    return result;
  }

  /**
   * Parallel model calls (batch multiple prompts)
   */
  async batchModelCalls({
    modelService,
    calls,
    maxConcurrency = 5
  }) {
    const tasks = calls.map(({ prompt, options }) => {
      return async () => {
        const measurementId = performanceBenchmark.startMeasurement({
          operationType: 'model_call',
          provider: options.provider,
          model: options.model,
          metadata: { promptLength: prompt.length }
        });

        try {
          const result = await modelService.generate(prompt, options);
          
          performanceBenchmark.endMeasurement(measurementId, {
            success: true,
            tokensInput: result.tokensInput || 0,
            tokensOutput: result.tokensOutput || 0,
            cost: result.cost || 0
          });

          return result;
        } catch (error) {
          performanceBenchmark.endMeasurement(measurementId, {
            success: false,
            error: error.message
          });
          throw error;
        }
      };
    });

    return await this.executeParallel({
      tasks,
      maxConcurrency,
      mode: 'allSettled'
    });
  }

  /**
   * Parallel agent execution
   */
  async executeAgentsInParallel({
    agents,
    task,
    maxConcurrency = 4
  }) {
    const tasks = agents.map((agent) => {
      return async () => {
        const measurementId = performanceBenchmark.startMeasurement({
          operationType: 'agent_execution',
          metadata: {
            agentRole: agent.role,
            agentId: agent.id
          }
        });

        try {
          const result = await agent.execute(task);
          
          performanceBenchmark.endMeasurement(measurementId, {
            success: true,
            metadata: { agentRole: agent.role }
          });

          return result;
        } catch (error) {
          performanceBenchmark.endMeasurement(measurementId, {
            success: false,
            error: error.message
          });
          throw error;
        }
      };
    });

    return await this.executeParallel({
      tasks,
      maxConcurrency,
      mode: 'allSettled'
    });
  }

  /**
   * Parallel tool calls
   */
  async executeToolsInParallel({
    toolCalls,
    maxConcurrency = 8
  }) {
    const tasks = toolCalls.map(({ toolName, toolFn, parameters }) => {
      return async () => {
        const measurementId = performanceBenchmark.startMeasurement({
          operationType: 'tool_call',
          metadata: {
            toolName,
            paramCount: Object.keys(parameters).length
          }
        });

        try {
          const result = await toolFn(parameters);
          
          performanceBenchmark.endMeasurement(measurementId, {
            success: true,
            metadata: { toolName }
          });

          return { toolName, result, success: true };
        } catch (error) {
          performanceBenchmark.endMeasurement(measurementId, {
            success: false,
            error: error.message,
            metadata: { toolName }
          });

          return { toolName, error: error.message, success: false };
        }
      };
    });

    return await this.executeParallel({
      tasks,
      maxConcurrency,
      mode: 'allSettled'
    });
  }

  /**
   * Identify parallelizable subtasks
   */
  identifyParallelizableSubtasks(workflow) {
    const parallelBatches = [];
    const dependencies = new Map();

    // Build dependency graph
    for (const step of workflow.steps) {
      dependencies.set(step.id, {
        step,
        dependsOn: step.dependsOn || [],
        canRunWith: []
      });
    }

    // Identify steps that can run in parallel
    for (const [stepId, data] of dependencies.entries()) {
      for (const [otherStepId, otherData] of dependencies.entries()) {
        if (stepId === otherStepId) continue;

        // Can run in parallel if no dependencies between them
        const noDependency = 
          !data.dependsOn.includes(otherStepId) &&
          !otherData.dependsOn.includes(stepId);

        if (noDependency) {
          data.canRunWith.push(otherStepId);
        }
      }
    }

    // Group into parallel batches
    const processed = new Set();
    
    for (const [stepId, data] of dependencies.entries()) {
      if (processed.has(stepId)) continue;

      const batch = [stepId];
      processed.add(stepId);

      // Add steps that can run with this one
      for (const otherId of data.canRunWith) {
        if (!processed.has(otherId)) {
          batch.push(otherId);
          processed.add(otherId);
        }
      }

      if (batch.length > 1) {
        parallelBatches.push({
          steps: batch.map(id => dependencies.get(id).step),
          estimatedSpeedup: batch.length
        });
      }
    }

    return {
      parallelBatches,
      totalSteps: workflow.steps.length,
      parallelizableSteps: parallelBatches.reduce((sum, batch) => sum + batch.steps.length, 0),
      estimatedTotalSpeedup: parallelBatches.reduce((sum, batch) => sum + (batch.estimatedSpeedup - 1), 1)
    };
  }

  /**
   * Get parallelization stats
   */
  getStats() {
    return {
      ...this.stats,
      avgTasksPerExecution: this.stats.totalTasksExecuted / Math.max(1, this.stats.totalParallelExecutions)
    };
  }

  /**
   * Set max concurrency
   */
  setMaxConcurrency(max) {
    this.stats.maxConcurrency = max;
    logger.info(`Max concurrency set to ${max}`);
  }
}

// Singleton instance
module.exports = new ParallelizationEngine();
