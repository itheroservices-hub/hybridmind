const planner = require('../agents/planner');
const executor = require('../agents/executor');
const reviewer = require('../agents/reviewer');
const modelSelector = require('../agents/modelSelector');
const workflowPresets = require('../../config/workflows');
const logger = require('../../utils/logger');

/**
 * Workflow Engine - Orchestrates complete agent workflows
 * Enhanced for autonomous, step-by-step execution
 */
class WorkflowEngine {
  constructor() {
    // State for autonomous execution
    this.activePlan = null;
    this.executionContext = {};
  }
  /**
   * Execute a preset workflow
   * @param {Object} params
   * @param {string} params.workflowId - Preset workflow ID
   * @param {string} params.code - Code to process
   * @param {Object} params.options - Execution options
   * @returns {Promise<Object>} Workflow execution result
   */
  async executePreset({ workflowId, code, options = {} }) {
    const preset = workflowPresets[workflowId];
    
    if (!preset) {
      throw new Error(`Workflow preset '${workflowId}' not found`);
    }

    logger.info(`Starting preset workflow: ${preset.name}`);

    const startTime = Date.now();
    const stepResults = [];
    let currentCode = code;

    // Execute each step in the preset
    for (let i = 0; i < preset.steps.length; i++) {
      const stepDef = preset.steps[i];
      
      // Create step object
      const step = {
        name: stepDef.name,
        description: stepDef.prompt,
        action: this.inferActionFromPrompt(stepDef.prompt),
        priority: 'high',
        estimatedComplexity: 'moderate'
      };

      // Determine input: use original code if requiresInput, else use current output
      const input = stepDef.requiresInput ? code : currentCode;

      // Execute step
      const result = await executor.executeStep({
        step: {
          ...step,
          description: stepDef.prompt
        },
        code: input,
        context: {
          workflowName: preset.name,
          stepNumber: i + 1,
          totalSteps: preset.steps.length
        },
        model: stepDef.model
      });

      stepResults.push(result);

      if (result.success) {
        currentCode = result.output;
      } else if (options.stopOnError) {
        logger.error(`Workflow stopped at step ${i + 1} due to error`);
        break;
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      workflowId,
      workflowName: preset.name,
      finalOutput: currentCode,
      outputFormat: preset.outputFormat,
      steps: stepResults,
      success: stepResults.every(r => r.success),
      duration,
      totalUsage: this.aggregateUsage(stepResults)
    };
  }

  /**
   * Execute custom agentic workflow
   * @param {Object} params
   * @param {string} params.goal - High-level goal
   * @param {string} params.code - Code to process
   * @param {Object} params.options - Execution options
   * @returns {Promise<Object>} Workflow execution result
   */
  async executeCustom({ goal, code, options = {} }) {
    logger.info(`Starting custom agentic workflow: ${goal}`);

    const startTime = Date.now();
    
    // Select models for workflow
    const models = modelSelector.selectModelsForWorkflow(options.strategy || 'balanced');

    // Phase 1: Planning
    logger.info('Phase 1: Planning');
    const planResult = await planner.createPlan({
      goal,
      code,
      model: options.plannerModel || models.planner
    });

    if (!planResult.steps || planResult.steps.length === 0) {
      throw new Error('Planning failed: no steps generated');
    }

    // Phase 2: Execution
    logger.info(`Phase 2: Execution (${planResult.steps.length} steps)`);
    const executionResult = await executor.executeSteps({
      steps: planResult.steps,
      code,
      context: {
        goal,
        strategy: planResult.strategy,
        readOnly: options.readOnly || options.dryRun
      },
      options: {
        model: options.executorModel || models.executor,
        stopOnError: options.stopOnError !== false,
        readOnly: options.readOnly || options.dryRun
      }
    });

    // Phase 3: Review (if enabled)
    let reviewResult = null;
    let refinedCode = executionResult.finalCode;

    if (options.enableReview !== false) {
      logger.info('Phase 3: Review');
      
      reviewResult = await reviewer.review({
        originalGoal: goal,
        originalCode: code,
        finalCode: executionResult.finalCode,
        steps: executionResult.results,
        model: options.reviewerModel || models.reviewer
      });

      // Refine if issues found
      if (options.enableRefinement !== false && reviewResult.issues && reviewResult.issues.length > 0) {
        logger.info('Phase 4: Refinement');
        
        const refinementResult = await reviewer.refine({
          code: executionResult.finalCode,
          review: reviewResult,
          model: options.reviewerModel || models.reviewer
        });

        if (refinementResult.improved) {
          refinedCode = refinementResult.refinedCode;
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      goal,
      plan: planResult,
      execution: executionResult,
      review: reviewResult,
      finalOutput: refinedCode,
      success: executionResult.successCount === executionResult.results.length,
      duration,
      totalUsage: this.aggregateTotalUsage(planResult, executionResult, reviewResult)
    };
  }

  /**
   * Execute comparison workflow (run multiple models on same task)
   */
  async executeComparison({ prompt, code, models, options = {} }) {
    logger.info(`Starting comparison workflow with ${models.length} models`);

    const startTime = Date.now();
    const results = [];

    for (const modelId of models) {
      try {
        const result = await executor.executeStep({
          step: {
            name: `compare-${modelId}`,
            description: prompt,
            action: 'analyze',
            priority: 'medium',
            estimatedComplexity: 'moderate'
          },
          code,
          model: modelId,
          context: {
            readOnly: options.readOnly || options.dryRun
          }
        });

        results.push({
          model: modelId,
          ...result
        });
      } catch (error) {
        logger.error(`Model ${modelId} failed: ${error.message}`);
        results.push({
          model: modelId,
          success: false,
          error: error.message
        });
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      prompt,
      models,
      results,
      duration,
      totalUsage: this.aggregateUsage(results)
    };
  }

  /**
   * Execute chain workflow (sequential model chaining)
   */
  async executeChain({ prompt, code, models, options = {} }) {
    logger.info(`Starting chain workflow with ${models.length} models`);

    const startTime = Date.now();
    const results = [];
    let currentCode = code;

    for (let i = 0; i < models.length; i++) {
      const modelId = models[i];
      
      try {
        const result = await executor.executeStep({
          step: {
            name: `chain-step-${i + 1}`,
            description: prompt,
            action: 'refactor',
            priority: 'medium',
            estimatedComplexity: 'moderate'
          },
          code: currentCode,
          context: {
            chainPosition: i + 1,
            totalModels: models.length,
            readOnly: options.readOnly || options.dryRun
          },
          model: modelId
        });

        results.push({
          model: modelId,
          step: i + 1,
          ...result
        });

        if (result.success) {
          currentCode = result.output;
        }
      } catch (error) {
        logger.error(`Chain step ${i + 1} (${modelId}) failed: ${error.message}`);
        
        if (options.stopOnError) {
          break;
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      prompt,
      models,
      results,
      finalOutput: currentCode,
      success: results.every(r => r.success),
      duration,
      totalUsage: this.aggregateUsage(results)
    };
  }

  /**
   * Get available workflow presets
   */
  getPresets() {
    return Object.entries(workflowPresets).map(([id, preset]) => ({
      id,
      name: preset.name,
      description: preset.description,
      steps: preset.steps.length,
      outputFormat: preset.outputFormat
    }));
  }

  /**
   * Get workflow status (for future use with async workflows)
   */
  async getStatus(workflowId) {
    // Placeholder for future async workflow tracking
    return {
      workflowId,
      status: 'unknown',
      message: 'Async workflows not yet implemented'
    };
  }

  /**
   * Infer action from prompt text
   */
  inferActionFromPrompt(prompt) {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('analyze')) return 'analyze';
    if (lower.includes('refactor')) return 'refactor';
    if (lower.includes('optimize')) return 'optimize';
    if (lower.includes('document')) return 'document';
    if (lower.includes('test')) return 'test';
    if (lower.includes('review')) return 'review';
    if (lower.includes('fix')) return 'fix';
    
    return 'analyze';
  }

  /**
   * Aggregate usage from step results
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
   * Aggregate total usage across all phases
   */
  aggregateTotalUsage(plan, execution, review) {
    const usages = [
      plan?.usage,
      execution?.totalUsage,
      review?.usage
    ].filter(Boolean);

    return usages.reduce(
      (acc, usage) => ({
        promptTokens: acc.promptTokens + (usage.promptTokens || 0),
        completionTokens: acc.completionTokens + (usage.completionTokens || 0),
        totalTokens: acc.totalTokens + (usage.totalTokens || 0)
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  /**
   * Initialize plan for autonomous execution
   * @param {Object} params
   * @param {string} params.goal - High-level goal
   * @param {string} params.code - Code context
   * @param {Object} params.options - Execution options
   * @returns {Promise<Object>} Plan initialization result
   */
  async initializePlan({ goal, code, options = {} }) {
    logger.info(`🚀 Initializing autonomous plan: ${goal}`);

    // Create plan with autonomous mode enabled
    const planResult = await planner.createPlan({
      goal,
      code,
      model: options.plannerModel,
      autonomous: true
    });

    // Validate plan
    const validation = planner.validatePlan(planResult);

    if (!validation.valid) {
      logger.warn(`Plan validation issues: ${validation.issues.join(', ')}`);
    }

    // Initialize executor with plan
    executor.setPlan(planResult);
    this.activePlan = planResult;
    this.executionContext = { goal, code, options };

    logger.info(`📋 Plan initialized: ${validation.stepCount} steps`);

    return {
      plan: planResult,
      validation,
      status: executor.getStatus()
    };
  }

  /**
   * Execute next step in active plan
   * @param {Object} params
   * @param {string} params.code - Current code state
   * @param {Object} params.context - Additional context
   * @returns {Promise<Object>} Execution result
   */
  async executeNext({ code, context = {} }) {
    if (!this.activePlan) {
      throw new Error('No active plan. Call /agent/plan first to initialize.');
    }

    logger.info('▶️  Executing next step...');

    const result = await executor.executeNext({
      code,
      context: {
        ...this.executionContext,
        ...context
      }
    });

    return result;
  }

  /**
   * Undo last executed step
   * @returns {Promise<Object>} Undo result
   */
  async undo() {
    logger.info('↩️  Undoing last step...');
    return await executor.undo();
  }

  /**
   * Get current execution status
   * @returns {Object} Status information
   */
  getExecutionStatus() {
    return {
      ...executor.getStatus(),
      activePlan: this.activePlan ? {
        strategy: this.activePlan.strategy,
        totalSteps: this.activePlan.steps?.length || 0
      } : null,
      context: this.executionContext
    };
  }

  /**
   * Execute specific step by index
   * @param {Object} params
   * @param {number} params.stepIndex - Step index (0-based)
   * @param {string} params.code - Current code state
   * @param {Object} params.context - Additional context
   * @returns {Promise<Object>} Execution result
   */
  async executeStepByIndex({ stepIndex, code, context = {} }) {
    if (!this.activePlan) {
      throw new Error('No active plan. Call /agent/plan first to initialize.');
    }

    const step = this.activePlan.steps[stepIndex];
    
    if (!step) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    logger.info(`🎯 Executing selected step [${stepIndex + 1}]: ${step.name}`);

    const result = await executor.executeStep({
      step,
      code,
      context: {
        ...this.executionContext,
        ...context,
        selectedStep: stepIndex
      },
      autonomous: true
    });

    return result;
  }

  /**
   * Reset execution state
   */
  reset() {
    this.activePlan = null;
    this.executionContext = {};
    executor.setPlan({ steps: [] });
    logger.info('🔄 Execution state reset');
  }
}

module.exports = new WorkflowEngine();
