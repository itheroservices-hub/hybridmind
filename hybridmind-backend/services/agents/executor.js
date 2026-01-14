const fs = require('fs');
const path = require('path');
const modelFactory = require('../models/modelFactory');
const modelSelector = require('./modelSelector');
const logger = require('../../utils/logger');

/**
 * Executor Agent - Executes individual steps of a plan
 * Enhanced for autonomous, action-oriented execution
 */
class Executor {
  constructor() {
    // State tracking for autonomous execution
    this.executionHistory = [];
    this.currentPlan = null;
    this.currentStepIndex = -1;
    this.lastExecutedStep = null;
    this.codeStateHistory = [];
  }
  /**
   * Execute a single step with full autonomy
   * @param {Object} params
   * @param {Object} params.step - Step to execute
   * @param {string} params.code - Current code state
   * @param {Object} params.context - Additional context
   * @param {string} params.model - Model override (optional)
   * @param {boolean} params.autonomous - Execute with full autonomy (default: true)
   * @returns {Promise<Object>} Execution result
   */
  async executeStep({ step, code, context = {}, model, autonomous = true }) {
    logger.info(`🚀 EXECUTING: ${step.name} (${step.action})`);

    // Loop prevention: skip immediate duplicate executions unless explicitly allowed
    if (this.isDuplicateStep(step.name, context)) {
      logger.warn(`Skipping duplicate step: ${step.name}`);
      return {
        stepName: step.name,
        action: step.action,
        output: code,
        model: model || null,
        success: false,
        error: 'Duplicate step prevented',
        timestamp: new Date().toISOString(),
        confirmation: `Step skipped: duplicate execution prevented`
      };
    }

    // Save state for undo capability
    this.saveState(code, step);

    // Select best model for this step if not specified
    const selectedModel = model || modelSelector.selectModelForStep(step);

    // Build prompt based on step action
    const prompt = this.buildPrompt(step, context, autonomous);

    try {
      const result = await modelFactory.call({
        model: selectedModel,
        prompt,
        code,
        temperature: this.getTemperatureForAction(step.action)
      });

      const executionResult = {
        stepName: step.name,
        action: step.action,
        output: result.content,
        model: selectedModel,
        usage: result.usage,
        success: true,
        timestamp: new Date().toISOString(),
        // Enhanced confirmation data
        confirmation: this.generateConfirmation(step, result.content),
        changes: this.detectChanges(code, result.content)
      };

      // Persist output to disk when a target file is provided (unless read-only)
      this.persistOutput(result.content, context, step);

      // Track execution
      this.lastExecutedStep = executionResult;
      this.executionHistory.push(executionResult);

      logger.info(`✅ COMPLETED: ${step.name}`);
      return executionResult;
    } catch (error) {
      logger.error(`❌ FAILED: ${step.name} - ${error.message}`);
      
      const failureResult = {
        stepName: step.name,
        action: step.action,
        output: null,
        model: selectedModel,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString(),
        confirmation: `Step failed: ${error.message}`
      };

      this.executionHistory.push(failureResult);
      return failureResult;
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
      
      if (this.isDuplicateStep(step.name, context, options)) {
        logger.warn(`Skipping duplicate step in sequence: ${step.name}`);
        results.push({
          stepName: step.name,
          action: step.action,
          output: currentCode,
          model: options.model || null,
          success: false,
          error: 'Duplicate step prevented',
          timestamp: new Date().toISOString(),
          confirmation: `Step skipped: duplicate execution prevented`
        });
        continue;
      }

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
          previousResults: results,
          readOnly: options.readOnly || context.readOnly
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
   * Build prompt for step with autonomous execution instructions
   */
  buildPrompt(step, context, autonomous = true) {
    const basePrompt = step.description;
    
    let prompt = `Task: ${basePrompt}\n\n`;

    // Add context if available
    if (context.stepNumber) {
      prompt += `This is step ${context.stepNumber} of ${context.totalSteps}.\n\n`;
    }

    // Add autonomous execution directive
    if (autonomous) {
      prompt += `EXECUTION MODE: AUTONOMOUS\n`;
      prompt += `You must produce COMPLETE, WORKING code. No placeholders, no pseudo-code, no TODOs.\n`;
      prompt += `Implement the full solution immediately.\n\n`;
    }

    // Add action-specific instructions
    const actionInstructions = {
      analyze: 'Provide a thorough analysis. Identify patterns, issues, and opportunities. Return complete findings.',
      refactor: 'Refactor the code while preserving functionality. Return COMPLETE, working code with all functions implemented.',
      optimize: 'Optimize for performance and efficiency. Return the COMPLETE optimized code. Explain optimizations made.',
      document: 'Add comprehensive documentation. Return the COMPLETE documented code with all comments and examples.',
      test: 'Generate COMPLETE test suite covering edge cases and common scenarios. Return fully implemented tests.',
      review: 'Review the code critically. Return detailed findings with specific line numbers and concrete suggestions.',
      fix: 'Fix ALL identified issues. Return COMPLETE, corrected code. No partial fixes.'
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

  /**
   * Execute next step in current plan
   */
  async executeNext({ code, context = {} }) {
    if (!this.currentPlan || !this.currentPlan.steps) {
      throw new Error('No active plan. Initialize a plan first.');
    }

    this.currentStepIndex++;
    
    if (this.currentStepIndex >= this.currentPlan.steps.length) {
      return {
        success: false,
        message: '✅ All steps completed!',
        completedSteps: this.currentStepIndex,
        totalSteps: this.currentPlan.steps.length
      };
    }

    const step = this.currentPlan.steps[this.currentStepIndex];
    logger.info(`▶️  Executing next step [${this.currentStepIndex + 1}/${this.currentPlan.steps.length}]: ${step.name}`);

    if (this.isDuplicateStep(step.name, context)) {
      logger.warn(`Skipping duplicate step in executeNext: ${step.name}`);
      return {
        success: false,
        result: {
          stepName: step.name,
          action: step.action,
          output: code,
          success: false,
          error: 'Duplicate step prevented',
          confirmation: `Step skipped: duplicate execution prevented`
        },
        progress: {
          current: this.currentStepIndex + 1,
          total: this.currentPlan.steps.length,
          remaining: this.currentPlan.steps.length - this.currentStepIndex - 1
        }
      };
    }

    const result = await this.executeStep({
      step,
      code,
      context: {
        ...context,
        stepNumber: this.currentStepIndex + 1,
        totalSteps: this.currentPlan.steps.length
      }
    });

    return {
      success: true,
      result,
      progress: {
        current: this.currentStepIndex + 1,
        total: this.currentPlan.steps.length,
        remaining: this.currentPlan.steps.length - this.currentStepIndex - 1
      }
    };
  }

  /**
   * Undo last executed step
   */
  async undo() {
    if (this.codeStateHistory.length === 0) {
      return {
        success: false,
        message: 'Nothing to undo'
      };
    }

    const previousState = this.codeStateHistory.pop();
    const undoneStep = this.executionHistory.pop();
    this.lastExecutedStep = this.executionHistory[this.executionHistory.length - 1] || null;
    this.currentStepIndex--;

    logger.info(`↩️  Undone: ${undoneStep?.stepName || 'last step'}`);

    return {
      success: true,
      message: `Reverted: ${undoneStep?.stepName}`,
      restoredCode: previousState.code,
      undoneStep: undoneStep?.stepName
    };
  }

  /**
   * Initialize plan for sequential execution
   */
  setPlan(plan) {
    this.currentPlan = plan;
    this.currentStepIndex = -1;
    this.executionHistory = [];
    this.codeStateHistory = [];
    logger.info(`📋 Plan initialized with ${plan.steps?.length || 0} steps`);
  }

  /**
   * Save state for undo capability
   */
  saveState(code, step) {
    this.codeStateHistory.push({
      code,
      step: step.name,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 states to prevent memory bloat
    if (this.codeStateHistory.length > 10) {
      this.codeStateHistory.shift();
    }
  }

  /**
   * Generate confirmation message
   */
  generateConfirmation(step, output) {
    const lineCount = output ? output.split('\n').length : 0;
    return {
      message: `Completed: ${step.name}`,
      action: step.action,
      outputSize: output?.length || 0,
      lineCount,
      summary: this.generateSummary(step.action, output)
    };
  }

  /**
   * Generate execution summary
   */
  generateSummary(action, output) {
    if (!output) return 'No output generated';

    const summaries = {
      analyze: 'Analysis complete',
      refactor: 'Code refactored',
      optimize: 'Optimization applied',
      document: 'Documentation added',
      test: 'Tests generated',
      review: 'Review completed',
      fix: 'Issues fixed'
    };

    return summaries[action] || 'Step executed';
  }

  /**
   * Detect changes between code states
   */
  detectChanges(oldCode, newCode) {
    if (!oldCode || !newCode) return { modified: false };

    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');

    return {
      modified: oldCode !== newCode,
      linesAdded: Math.max(0, newLines.length - oldLines.length),
      linesRemoved: Math.max(0, oldLines.length - newLines.length),
      totalLines: newLines.length
    };
  }

  /**
   * Get execution status
   */
  getStatus() {
    return {
      hasActivePlan: !!this.currentPlan,
      currentStep: this.currentStepIndex + 1,
      totalSteps: this.currentPlan?.steps?.length || 0,
      executedSteps: this.executionHistory.length,
      canUndo: this.codeStateHistory.length > 0,
      lastExecuted: this.lastExecutedStep?.stepName || null
    };
  }

  /**
   * Determine duplicate step execution
   */
  isDuplicateStep(stepName, context = {}, options = {}) {
    if (options.allowRepeat || context.allowRepeat) return false;
    return this.lastExecutedStep && this.lastExecutedStep.stepName === stepName;
  }

  /**
   * Persist model output to disk when a file path is provided
   */
  persistOutput(output, context = {}, step) {
    if (context.readOnly) {
      logger.info(`🛑 Read-only mode: not persisting output for ${step.name}`);
      return;
    }

    const targetPath = context.filePath || context.persistToFilePath;
    if (!targetPath || !output) return;

    try {
      const resolved = path.resolve(targetPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, output, 'utf8');
      logger.info(`📝 Persisted output of ${step.name} to ${resolved}`);
    } catch (err) {
      logger.error(`Failed to persist output for ${step.name}: ${err.message}`);
    }
  }
}

module.exports = new Executor();
