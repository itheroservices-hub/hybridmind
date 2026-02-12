const planner = require('../agents/planner');
const executor = require('../agents/executor');
const reviewer = require('../agents/reviewer');
const modelSelector = require('../agents/modelSelector');
const workflowPresets = require('../../config/workflows');
const logger = require('../../utils/logger');
const ContextManager = require('../context/contextManager');
const reflectionOrchestrator = require('../planning/reflectionOrchestrator');
const toolExecutor = require('../tools/toolExecutor');
const workflowOptimizer = require('./workflowOptimizer');

/**
 * Workflow Engine - Orchestrates complete agent workflows
 * Enhanced for autonomous, step-by-step execution with dynamic context management
 * and intelligent planning/reflection capabilities
 */
class WorkflowEngine {
  constructor() {
    // State for autonomous execution
    this.activePlan = null;
    this.executionContext = {};
    
    // Context management system
    this.contextManager = new ContextManager();
    
    // Planning and reflection
    this.reflectionOrchestrator = reflectionOrchestrator;
    
    // Tool execution system
    this.toolExecutor = toolExecutor;
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

    // ENHANCEMENT: Optimize context before planning
    let optimizedContext = null;
    if (options.useContextManagement !== false && code && code.length > 5000) {
      try {
        logger.info('Optimizing context for workflow planning');
        optimizedContext = await this.contextManager.processContext({
          rawContext: code,
          task: goal,
          taskType: 'analysis',
          maxTokens: 10000
        });
        
        logger.info(`Context optimized: ${optimizedContext.metadata.compressionRatio.toFixed(2)}x reduction`);
      } catch (error) {
        logger.warn(`Context optimization failed: ${error.message}`);
      }
    }

    // Phase 1: Planning (use optimized context if available)
    logger.info('Phase 1: Planning');
    const planResult = await planner.createPlan({
      goal,
      code: optimizedContext ? optimizedContext.context : code,
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
        readOnly: options.readOnly || options.dryRun,
        optimizedContext: !!optimizedContext
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
      totalUsage: this.aggregateTotalUsage(planResult, executionResult, reviewResult),
      contextOptimization: optimizedContext ? {
        enabled: true,
        originalTokens: optimizedContext.metadata.originalTokens,
        optimizedTokens: optimizedContext.metadata.optimizedTokens,
        compressionRatio: optimizedContext.metadata.compressionRatio,
        chunksUsed: optimizedContext.metadata.chunksUsed
      } : { enabled: false }
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
   * Execute chain workflow (sequential model chaining with intelligent context routing)
   */
  async executeChain({ prompt, code, models, options = {} }) {
    logger.info(`Starting chain workflow with ${models.length} models`);

    const startTime = Date.now();
    const results = [];
    let currentCode = code;

    // ENHANCEMENT: Use context management for chains
    let contextRouting = null;
    if (options.useContextManagement !== false && code && code.length > 2000) {
      try {
        // Create chain steps for context routing
        const chainSteps = models.map((modelId, i) => ({
          id: `step-${i}`,
          name: `chain-step-${i + 1}`,
          description: prompt,
          type: 'refactor',
          dependencies: i > 0 ? [`step-${i-1}`] : []
        }));

        // Process context with intelligent routing
        contextRouting = await this.contextManager.processChainContext({
          rawContext: code,
          chainSteps,
          globalContext: { prompt, models }
        });

        logger.info(`Context routing created: ${contextRouting.metadata.totalChunks} chunks distributed across ${models.length} steps`);
      } catch (error) {
        logger.warn(`Context routing failed, using full context: ${error.message}`);
      }
    }

    for (let i = 0; i < models.length; i++) {
      const modelId = models[i];
      
      try {
        // Get optimized context for this step if available
        let stepContext = currentCode;
        if (contextRouting && contextRouting.contextMap[`step-${i}`]) {
          const optimizedContext = contextRouting.contextMap[`step-${i}`];
          stepContext = optimizedContext.context;
          
          logger.info(`Step ${i + 1}: Using optimized context (${optimizedContext.metadata.chunksUsed} chunks, ${optimizedContext.metadata.tokens} tokens)`);
        }

        const result = await executor.executeStep({
          step: {
            name: `chain-step-${i + 1}`,
            description: prompt,
            action: 'refactor',
            priority: 'medium',
            estimatedComplexity: 'moderate'
          },
          code: stepContext,
          context: {
            chainPosition: i + 1,
            totalModels: models.length,
            readOnly: options.readOnly || options.dryRun,
            optimizedContext: !!contextRouting
          },
          model: modelId
        });

        results.push({
          model: modelId,
          step: i + 1,
          ...result,
          contextMetadata: contextRouting ? contextRouting.contextMap[`step-${i}`]?.metadata : null
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
      totalUsage: this.aggregateUsage(results),
      contextOptimization: contextRouting ? {
        enabled: true,
        totalChunks: contextRouting.metadata.totalChunks,
        reuseEfficiency: contextRouting.metadata.reuseEfficiency,
        processingTime: contextRouting.metadata.processingTime
      } : { enabled: false }
    };
  }

  /**
   * Execute All-to-All workflow (mesh network where all models communicate with each other)
   * Pro+ tier only
   */
  async executeAllToAll({ prompt, code, models, options = {} }) {
    logger.info(`Starting all-to-all mesh workflow with ${models.length} models`);

    const startTime = Date.now();
    const iterations = options.iterations || 2; // Number of communication rounds
    const allResults = [];
    
    // Initialize each model with the original prompt
    let modelStates = models.map(modelId => ({
      modelId,
      currentOutput: null,
      history: [],
      messagesReceived: [],
      messagesSent: []
    }));

    // Round 1: Initial execution - all models process original task
    logger.info('All-to-All Round 1: Initial independent processing');
    const round1Results = [];
    
    for (const state of modelStates) {
      try {
        const result = await executor.executeStep({
          step: {
            name: `all-to-all-${state.modelId}-initial`,
            description: prompt,
            action: 'analyze',
            priority: 'medium',
            estimatedComplexity: 'moderate'
          },
          code,
          context: {
            mode: 'all-to-all',
            round: 1,
            modelCount: models.length
          },
          model: state.modelId
        });

        state.currentOutput = result.output;
        state.history.push(result.output);
        round1Results.push({
          model: state.modelId,
          round: 1,
          ...result
        });
      } catch (error) {
        logger.error(`Model ${state.modelId} failed in round 1: ${error.message}`);
        round1Results.push({
          model: state.modelId,
          round: 1,
          success: false,
          error: error.message
        });
      }
    }
    
    allResults.push(...round1Results);

    // Subsequent rounds: Models see and react to each other's outputs
    for (let round = 2; round <= iterations; round++) {
      logger.info(`All-to-All Round ${round}: Cross-model refinement`);
      const roundResults = [];
      
      for (let i = 0; i < modelStates.length; i++) {
        const state = modelStates[i];
        
        // Gather outputs from all OTHER models
        const otherOutputs = modelStates
          .filter((_, idx) => idx !== i)
          .map(s => ({
            model: s.modelId,
            output: s.currentOutput
          }))
          .filter(o => o.output); // Only include successful outputs
        
        if (otherOutputs.length === 0) {
          logger.warn(`No other outputs available for ${state.modelId} in round ${round}`);
          continue;
        }
        
        // Create mesh context: original task + other models' solutions
        const meshContext = `Original Task: ${prompt}

Your Previous Output:
${state.currentOutput || 'N/A'}

Other Models' Solutions:
${otherOutputs.map((o, idx) => `
Model ${idx + 1} (${o.model}):
${o.output}
`).join('\n---\n')}

Instructions: Review the other models' approaches and refine your solution. Consider:
1. What unique insights do other models provide?
2. What can you improve in your approach based on their solutions?
3. Can you synthesize the best aspects of all solutions?

Provide your refined solution:`;

        try {
          const result = await executor.executeStep({
            step: {
              name: `all-to-all-${state.modelId}-round${round}`,
              description: meshContext,
              action: 'refine',
              priority: 'medium',
              estimatedComplexity: 'moderate'
            },
            code: state.currentOutput || code,
            context: {
              mode: 'all-to-all',
              round,
              modelCount: models.length,
              receivedFrom: otherOutputs.map(o => o.model)
            },
            model: state.modelId
          });

          // Track communication
          state.messagesReceived.push({
            round,
            from: otherOutputs.map(o => o.model),
            content: otherOutputs
          });
          
          state.messagesSent.push({
            round,
            to: 'all',
            content: result.output
          });

          state.currentOutput = result.output;
          state.history.push(result.output);
          
          roundResults.push({
            model: state.modelId,
            round,
            ...result,
            collaboratedWith: otherOutputs.map(o => o.model)
          });
        } catch (error) {
          logger.error(`Model ${state.modelId} failed in round ${round}: ${error.message}`);
          roundResults.push({
            model: state.modelId,
            round,
            success: false,
            error: error.message
          });
        }
      }
      
      allResults.push(...roundResults);
    }

    // Synthesize final output from all models
    const successfulModels = modelStates.filter(s => s.currentOutput);
    const finalOutput = this._synthesizeAllToAllOutput(successfulModels, prompt);

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      prompt,
      models,
      mode: 'all-to-all',
      iterations,
      results: allResults,
      modelStates: modelStates.map(s => ({
        modelId: s.modelId,
        finalOutput: s.currentOutput,
        evolutionSteps: s.history.length,
        messagesReceived: s.messagesReceived.length,
        messagesSent: s.messagesSent.length
      })),
      finalOutput,
      synthesis: {
        modelsContributed: successfulModels.length,
        totalInteractions: allResults.length,
        communicationRounds: iterations
      },
      duration,
      totalUsage: this.aggregateUsage(allResults)
    };
  }

  /**
   * Synthesize final output from all-to-all mesh results
   */
  _synthesizeAllToAllOutput(modelStates, originalPrompt) {
    if (modelStates.length === 0) {
      return 'All models failed to produce output';
    }
    
    if (modelStates.length === 1) {
      return modelStates[0].currentOutput;
    }
    
    // For now, return the last model's output with metadata
    // In production, you might want to use an additional LLM call to synthesize
    const bestModel = modelStates[modelStates.length - 1];
    
    return `${bestModel.currentOutput}

---
Synthesis Note: This solution emerged from ${modelStates.length} models collaborating in an all-to-all mesh network, each refining based on others' insights. Models involved: ${modelStates.map(s => s.modelId).join(', ')}`;
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

  /**
   * Process context for a single task using context manager
   * @param {Object} params
   * @param {string} params.rawContext - Raw context to process
   * @param {string} params.task - Task description
   * @param {string} params.taskType - Type of task
   * @param {number} params.maxTokens - Max tokens
   * @returns {Promise<Object>} Optimized context
   */
  async processContext({ rawContext, task, taskType = 'general', maxTokens = 8000 }) {
    logger.info('Processing context with context manager');
    
    return await this.contextManager.processContext({
      rawContext,
      task,
      taskType,
      maxTokens
    });
  }

  /**
   * Process and route context for agent chains
   * @param {Object} params
   * @param {string} params.rawContext - Raw context
   * @param {Array} params.chainSteps - Chain steps
   * @param {Object} params.globalContext - Global context
   * @returns {Promise<Object>} Context routing map
   */
  async processChainContext({ rawContext, chainSteps, globalContext = {} }) {
    logger.info('Processing chain context with intelligent routing');
    
    return await this.contextManager.processChainContext({
      rawContext,
      chainSteps,
      globalContext
    });
  }

  /**
   * Configure context manager
   * @param {Object} options - Configuration options
   */
  configureContextManager(options) {
    this.contextManager.configure(options);
    logger.info('Context manager configured');
  }

  /**
   * Get context manager statistics
   * @returns {Promise<Object>} Context statistics
   */
  async getContextStatistics() {
    return await this.contextManager.getStatistics();
  }

  /**
   * Clear context cache
   * @returns {Promise<void>}
   */
  async clearContextCache() {
    await this.contextManager.clearCache();
    logger.info('Context cache cleared');
  }

  /**
   * Execute workflow with planning and reflection
   * Implements V1 → Reflection → V2 → Review cycle for high-quality results
   * @param {Object} options
   * @param {string} options.goal - High-level goal
   * @param {string} options.code - Code/context
   * @param {string} options.taskType - Task type (refactor/feature/debug/optimize/general)
   * @param {Object} options.constraints - Constraints
   * @param {boolean} options.enablePlanning - Generate plan first (default: true)
   * @param {boolean} options.enableReflection - Enable reflection loop (default: true)
   * @returns {Promise<Object>} Workflow execution with reflections
   */
  async executeWithReflection({ goal, code = '', taskType = 'general', constraints = {}, enablePlanning = true, enableReflection = true }) {
    logger.info(`🎯 Executing workflow with planning and reflection`);
    
    try {
      // Optimize context if code is large
      let optimizedContext = code;
      if (code.length > 5000) {
        logger.info('Optimizing large context...');
        const contextResult = await this.contextManager.processContext({
          code,
          task: { description: goal },
          maxTokens: 8000
        });
        
        if (contextResult.success) {
          optimizedContext = contextResult.optimizedCode;
          logger.info(`Context optimized: ${code.length} → ${optimizedContext.length} chars`);
        }
      }

      // Execute with reflection
      const result = await this.reflectionOrchestrator.executeWithReflection({
        goal,
        context: optimizedContext,
        taskType,
        constraints,
        enablePlanning,
        enableReflection
      });

      logger.info(`✅ Workflow completed with ${result.metadata.totalCycles} cycle(s)`);
      logger.info(`   Final score: ${(result.metadata.finalScore * 100).toFixed(1)}%`);

      return result;

    } catch (error) {
      logger.error(`Workflow with reflection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute custom workflow with optional reflection
   * Backwards compatible with existing executeCustom, adds optional reflection
   * @param {Object} params
   * @param {string} params.goal - High-level goal
   * @param {string} params.code - Code to process
   * @param {Object} params.options - Execution options
   * @param {boolean} params.options.useReflection - Enable reflection (default: false for compatibility)
   * @param {string} params.options.taskType - Task type for planning
   * @returns {Promise<Object>} Workflow execution result
   */
  async executeCustomWithOptionalReflection({ goal, code, options = {} }) {
    // If reflection enabled, use new system
    if (options.useReflection) {
      return await this.executeWithReflection({
        goal,
        code,
        taskType: options.taskType || 'general',
        constraints: options.constraints || {},
        enablePlanning: options.enablePlanning !== false,
        enableReflection: true
      });
    }

    // Otherwise, use existing executeCustom logic (backwards compatible)
    return await this.executeCustom({ goal, code, options });
  }

  /**
   * Execute workflow with tool calls
   * Supports declarative prompts for tool discovery and execution
   * @param {Object} options
   * @param {string} options.prompt - Natural language prompt
   * @param {string} options.agentId - Agent identifier
   * @param {Array} options.toolCalls - Explicit tool calls (optional)
   * @param {Object} options.context - Additional context
   * @returns {Promise<Object>} Tool execution results
   */
  async executeWithTools({ prompt, agentId = 'system', toolCalls = null, context = {} }) {
    logger.info(`🔧 Executing workflow with tools for agent: ${agentId}`);

    const startTime = Date.now();

    try {
      // If no explicit tool calls, parse from prompt
      if (!toolCalls) {
        const parseResult = await this.toolExecutor.parseDeclarativePrompt(prompt, agentId);
        
        if (!parseResult.parsed) {
          return {
            success: false,
            error: 'Could not parse tool calls from prompt',
            prompt,
            suggestion: 'Provide explicit toolCalls array or refine prompt'
          };
        }

        toolCalls = parseResult.toolCalls;
        logger.info(`📋 Parsed ${toolCalls.length} tool call(s) from prompt`);
      }

      // Execute tools
      const results = await this.toolExecutor.executeToolChain(toolCalls, agentId);

      const duration = Date.now() - startTime;
      const successful = results.filter(r => r.success).length;

      logger.info(`✅ Tool workflow completed: ${successful}/${results.length} successful (${duration}ms)`);

      return {
        success: successful > 0,
        prompt,
        agentId,
        toolCalls,
        results,
        summary: {
          totalTools: results.length,
          successful,
          failed: results.length - successful,
          duration
        }
      };

    } catch (error) {
      logger.error(`Tool workflow failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        prompt,
        agentId,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute tool by name
   * Convenience method for single tool execution
   * @param {Object} options
   * @param {string} options.toolName - Tool to execute
   * @param {Object} options.parameters - Tool parameters
   * @param {string} options.agentId - Agent identifier
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool({ toolName, parameters, agentId = 'system' }) {
    logger.info(`🔨 Executing single tool: ${toolName}`);

    return await this.toolExecutor.executeTool({
      toolName,
      parameters,
      agentId
    });
  }
}

module.exports = new WorkflowEngine();
