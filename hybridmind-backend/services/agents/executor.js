const modelFactory = require('../models/modelFactory');
const modelSelector = require('./modelSelector');
const logger = require('../../utils/logger');

/**
 * Executor Agent - Executes individual steps of a plan
 */
class Executor {
  /**
   * Execute a single step
   * @param {Object} params
   * @param {Object} params.step - Step to execute
   * @param {string} params.code - Current code state
   * @param {Object} params.context - Additional context
   * @param {string} params.model - Model override (optional)
   * @returns {Promise<Object>} Execution result
   */
  async executeStep({ step, code, context = {}, model }) {
    logger.info(`Executing step: ${step.name} (${step.action})`);

    // Select best model for this step if not specified
    const selectedModel = model || modelSelector.selectModelForStep(step);

    // Build prompt based on step action
    const prompt = this.buildPrompt(step, context);

    try {
      const result = await modelFactory.call({
        model: selectedModel,
        prompt,
        code,
        temperature: this.getTemperatureForAction(step.action)
      });

      return {
        stepName: step.name,
        action: step.action,
        output: result.content,
        model: selectedModel,
        usage: result.usage,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Step execution failed: ${step.name} - ${error.message}`);
      
      return {
        stepName: step.name,
        action: step.action,
        output: null,
        model: selectedModel,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute multiple steps in sequence
   */
  async executeSteps({ steps, code, context = {}, options = {} }) {
    const results = [];
    let currentCode = code;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Check if we should stop on error
      if (options.stopOnError && results.some(r => !r.success)) {
        logger.warn(`Stopping execution due to previous error`);
        break;
      }

      // Execute step
      const result = await this.executeStep({
        step,
        code: currentCode,
        context: {
          ...context,
          stepNumber: i + 1,
          totalSteps: steps.length,
          previousResults: results
        },
        model: options.model
      });

      results.push(result);

      // Update current code if step succeeded
      if (result.success && result.output) {
        currentCode = result.output;
      }

      // Optional delay between steps
      if (options.delayBetweenSteps && i < steps.length - 1) {
        await this.sleep(options.delayBetweenSteps);
      }
    }

    return {
      results,
      finalCode: currentCode,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      totalUsage: this.aggregateUsage(results)
    };
  }

  /**
   * Execute steps with parallel processing where possible
   */
  async executeStepsParallel({ steps, code, context = {} }) {
    // Identify independent steps that can run in parallel
    const groups = this.groupStepsByDependency(steps);

    let currentCode = code;
    const allResults = [];

    for (const group of groups) {
      if (group.length === 1) {
        // Single step - execute normally
        const result = await this.executeStep({
          step: group[0],
          code: currentCode,
          context
        });
        allResults.push(result);
        if (result.success) {
          currentCode = result.output;
        }
      } else {
        // Multiple independent steps - execute in parallel
        const promises = group.map(step =>
          this.executeStep({ step, code: currentCode, context })
        );
        const results = await Promise.all(promises);
        allResults.push(...results);

        // Merge results (use first successful output)
        const successfulResult = results.find(r => r.success);
        if (successfulResult) {
          currentCode = successfulResult.output;
        }
      }
    }

    return {
      results: allResults,
      finalCode: currentCode,
      successCount: allResults.filter(r => r.success).length,
      failureCount: allResults.filter(r => !r.success).length,
      totalUsage: this.aggregateUsage(allResults)
    };
  }

  /**
   * Build prompt for step
   */
  buildPrompt(step, context) {
    const basePrompt = step.description;
    
    let prompt = `Task: ${basePrompt}\n\n`;

    // Add context if available
    if (context.stepNumber) {
      prompt += `This is step ${context.stepNumber} of ${context.totalSteps}.\n\n`;
    }

    // Add action-specific instructions
    const actionInstructions = {
      analyze: 'Provide a thorough analysis. Identify patterns, issues, and opportunities.',
      refactor: 'Refactor the code while preserving functionality. Provide clean, well-structured code.',
      optimize: 'Optimize for performance and efficiency. Explain the optimizations made.',
      document: 'Add comprehensive documentation. Include purpose, parameters, and examples.',
      test: 'Generate comprehensive tests covering edge cases and common scenarios.',
      review: 'Review the code critically. Identify issues and suggest improvements.',
      fix: 'Fix the identified issues. Provide corrected code with explanations.'
    };

    if (actionInstructions[step.action]) {
      prompt += actionInstructions[step.action] + '\n\n';
    }

    return prompt;
  }

  /**
   * Get appropriate temperature for action type
   */
  getTemperatureForAction(action) {
    const temperatures = {
      analyze: 0.3,
      refactor: 0.5,
      optimize: 0.4,
      document: 0.4,
      test: 0.6,
      review: 0.3,
      fix: 0.5
    };

    return temperatures[action] || 0.5;
  }

  /**
   * Group steps by dependency (simple version - can be enhanced)
   */
  groupStepsByDependency(steps) {
    // For now, treat all steps as sequential
    // In future, can analyze dependencies and create parallel groups
    return steps.map(step => [step]);
  }

  /**
   * Aggregate usage stats
   */
  aggregateUsage(results) {
    return results.reduce(
      (acc, result) => ({
        promptTokens: acc.promptTokens + (result.usage?.promptTokens || 0),
        completionTokens: acc.completionTokens + (result.usage?.completionTokens || 0),
        totalTokens: acc.totalTokens + (result.usage?.totalTokens || 0)
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new Executor();
