/**
 * Multi-Model Chain Orchestrator
 * 
 * Orchestrates execution of multi-model agent chains where different AI models
 * collaborate based on their strengths (e.g., o1 for planning, Qwen for coding, Claude for review).
 * 
 * Supports three modes:
 * - Auto: System intelligently selects best models for each role
 * - Manual: User specifies exact models to use
 * - Template: Uses pre-configured chain templates
 */

const modelSelector = require('../models/modelSelector');
const { MODEL_CAPABILITIES } = require('../../config/modelCapabilities');
const roleRegistry = require('../agents/roleRegistry');
const agentContextComposer = require('../agents/agentContextComposer');
const graphitiMemoryClient = require('../memory/graphitiMemoryClient');
const mcpClient = require('./mcpClient');
const { SelfHealingLoop } = require('./selfHealingLoop');
const modelProxy = require('../modelProxy');
const multiAgentPrompt = require('../../config/multiAgentOrchestratorPrompt');
const logger = require('../../utils/logger');
const { EventEmitter } = require('events');

class ChainOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.selfHealingLoop = new SelfHealingLoop({
      mcpClient,
      maxAttempts: 3
    });
    this.activeChains = new Map();
    this.stats = {
      totalChains: 0,
      byMode: { auto: 0, manual: 0, template: 0 },
      byType: {},
      completedChains: 0,
      failedChains: 0
    };
  }

  /**
   * Execute a multi-model agent chain
   */
  async executeChain({
    chainId: providedChainId,
    task,
    mode = 'auto', // 'auto', 'manual', 'template'
    tier = 'pro',
    chainType = 'coding',
    template = null,
    models = null, // For manual mode: { planner: 'model-id', builder: 'model-id', ... }
    workspacePath,
    targetFile,
    searchQuery,
    testCommand,
    metadata = {},
    budget = 'medium',
    prioritize = 'balanced',
    onProgress = null,
    onSelfHealingTelemetry = null,
    onModelTelemetry = null, // Callback for model streaming telemetry (tokens, thinking)
    stream = true, // Enable streaming by default for telemetry
    autonomyLevel = 2, // 0=Manual, 1=Assisted, 2=Semi-Autonomous, 3=Full Autonomy
    abortSignal = null
  }) {
    const chainId = providedChainId || this._generateChainId();
    this.stats.totalChains++;
    this.stats.byMode[mode]++;
    this.stats.byType[chainType] = (this.stats.byType[chainType] || 0) + 1;

    logger.info(`Starting chain ${chainId} (mode: ${mode}, type: ${chainType})`);

    try {
      // 1. Select models based on mode
      const chainConfig = await this._selectModels({
        mode,
        tier,
        chainType,
        template,
        models,
        budget,
        prioritize
      });

      logger.info(`Chain ${chainId} configuration:`, chainConfig);

      // 2. Initialize chain state
      const chainState = {
        id: chainId,
        task,
        config: chainConfig,
        results: {},
        context: {},
        projectId: this._extractProjectId(task, chainId),
        memoryContext: null,
        selfHealingTelemetry: [],
        mcpContext: {
          workspacePath: workspacePath || (typeof task === 'object' ? task.workspacePath : undefined),
          targetFile: targetFile || (typeof task === 'object' ? task.targetFile : undefined),
          searchQuery: searchQuery || (typeof task === 'object' ? task.searchQuery : undefined),
          testCommand: testCommand || (typeof task === 'object' ? task.testCommand : undefined),
          metadata: {
            ...(typeof task === 'object' ? (task.metadata || {}) : {}),
            ...(metadata || {})
          }
        },
        status: 'running',
        startTime: Date.now()
      };

      chainState.memoryContext = this._initializeMemoryContext(chainState);

      this.activeChains.set(chainId, chainState);
      this.emit('chain:started', { chainId, config: chainConfig });

      // 3. Execute roles in sequence
      const execution = await this._executeRoles({
        chainId,
        chainState,
        onProgress,
        onSelfHealingTelemetry,
        onModelTelemetry,
        stream,
        autonomyLevel,
        abortSignal
      });

      // 4. Mark complete
      chainState.status = 'completed';
      chainState.endTime = Date.now();
      chainState.duration = chainState.endTime - chainState.startTime;

      this.stats.completedChains++;
      this.emit('chain:completed', { chainId, results: execution });

      logger.info(`Chain ${chainId} completed in ${chainState.duration}ms`);

      return {
        chainId,
        success: true,
        results: execution,
        config: chainConfig,
        selfHealingTelemetry: chainState.selfHealingTelemetry,
        duration: chainState.duration
      };

    } catch (error) {
      this.stats.failedChains++;
      this.emit('chain:failed', { chainId, error });
      logger.error(`Chain ${chainId} failed:`, error);

      return {
        chainId,
        success: false,
        error: error.message,
        results: null
      };
    } finally {
      this.activeChains.delete(chainId);
    }
  }

  /**
   * Select models for chain based on mode
   */
  async _selectModels({
    mode,
    tier,
    chainType,
    template,
    models,
    budget,
    prioritize
  }) {
    if (mode === 'manual' && models) {
      // Manual mode: use user-specified models
      return {
        mode: 'manual',
        models,
        roles: this._getRolesForChainType(chainType),
        tier
      };
    }

    if (mode === 'template' && template) {
      // Template mode: use pre-configured template
      const templateConfig = modelSelector.getTemplate(template);
      if (!templateConfig) {
        throw new Error(`Template '${template}' not found`);
      }

      return {
        mode: 'template',
        template,
        models: templateConfig.roles,
        roles: Object.keys(templateConfig.roles),
        estimatedCost: templateConfig.estimatedCost,
        estimatedSpeed: templateConfig.estimatedSpeed,
        tier
      };
    }

    // Auto mode: intelligently select models
    const selection = modelSelector.selectChain({
      chainType,
      tier,
      budget,
      customRoles: null
    });

    return {
      mode: 'auto',
      models: selection.chain,
      roles: selection.roles,
      estimatedCost: selection.estimatedCost,
      breakdown: selection.breakdown,
      tier
    };
  }

  /**
   * Execute all roles in sequence
   */
  async _executeRoles({ chainId, chainState, onProgress, onSelfHealingTelemetry, onModelTelemetry, stream = true, autonomyLevel = 2, abortSignal }) {
    const { config, task } = chainState;
    const results = {};
    let previousOutput = null;

    const roles = Array.isArray(config.roles) 
      ? config.roles 
      : Object.keys(config.roles);

    for (let i = 0; i < roles.length; i++) {
      if (abortSignal?.aborted) {
        const abortError = new Error('Chain aborted by user');
        abortError.code = 'ABORT_ERR';
        throw abortError;
      }

      const roleName = Array.isArray(config.roles) ? config.models[roles[i]] : roles[i];
      const modelId = config.models[roleName] || config.models[roles[i]];

      logger.info(`Chain ${chainId}: Executing role ${roleName} with model ${modelId}`);

      // Get role definition
      const roleConfig = this._getRoleConfig(roleName);

      // Emit progress
      if (onProgress) {
        onProgress({
          chainId,
          currentRole: roleName,
          currentModel: modelId,
          step: i + 1,
          totalSteps: roles.length,
          progress: ((i + 1) / roles.length) * 100
        });
      }

      this.emit('role:started', {
        chainId,
        role: roleName,
        model: modelId
      });

      try {
        // Execute role with streaming telemetry support
        const result = await this._executeRole({
          role: roleName,
          roleConfig,
          modelId,
          task,
          previousOutput,
          chainContext: chainState.context,
          memoryContext: chainState.memoryContext,
          mcpContext: chainState.mcpContext,
          tier: chainState.config.tier,
          chainId,
          stream,
          autonomyLevel,
          onModelTelemetry: onModelTelemetry ? (telemetry) => {
            // Emit telemetry with chain context
            onModelTelemetry({
              chainId,
              role: roleName,
              model: modelId,
              ...telemetry
            });
            // Also emit as event for listeners
            this.emit('model:telemetry', {
              chainId,
              role: roleName,
              model: modelId,
              ...telemetry
            });
          } : null
        });

        results[roleName] = result;
        previousOutput = result.output;
        chainState.context[roleName] = result.output;

        agentContextComposer.persistRoleOutput({
          projectId: chainState.projectId,
          role: roleName,
          output: result.output
        });

        chainState.memoryContext = agentContextComposer.composeRoleContext({
          projectId: chainState.projectId,
          role: roleName,
          task,
          tags: chainState.mcpContext.metadata.memoryTags || []
        });

        if (this._shouldRunSelfHealing(roleName, chainState)) {
          const healingResult = await this.selfHealingLoop.executeWithRecovery({
            projectId: chainState.projectId,
            runCommand: chainState.mcpContext.testCommand || 'npm test',
            codeContext: previousOutput,
            memoryContext: chainState.memoryContext,
            chainId,
            abortSignal,
            onTelemetry: (event) => {
              chainState.selfHealingTelemetry.push(event);
              this.emit('selfhealing:telemetry', {
                chainId,
                ...event
              });

              if (typeof onSelfHealingTelemetry === 'function') {
                onSelfHealingTelemetry({ chainId, ...event });
              }
            }
          });

          results.selfHealing = healingResult;
          chainState.context.selfHealing = JSON.stringify(healingResult);

          if (!healingResult.success) {
            throw new Error('Self-healing exhausted; user intervention required');
          }

          previousOutput = healingResult.finalCode;
          chainState.context.healedOutput = healingResult.finalCode;
        }

        this.emit('role:completed', {
          chainId,
          role: roleName,
          result
        });

      } catch (error) {
        logger.error(`Chain ${chainId}: Role ${roleName} failed:`, error);
        throw new Error(`Role ${roleName} failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Execute a single role
   */
  async _executeRole({
    role,
    roleConfig,
    modelId,
    task,
    previousOutput,
    chainContext,
    memoryContext,
    mcpContext,
    tier,
    chainId,
    stream = true,
    autonomyLevel = 2,
    onModelTelemetry = null
  }) {
    const startTime = Date.now();

    const resolvedRole = roleRegistry.resolveRole(role, {
      tier: tier || 'free',
      strategy: 'balanced'
    });

    const mcpActions = this._isMcpManagedRole(role)
      ? await this._runMcpInteractions({ role, task, previousOutput, mcpContext })
      : [];

    // Build system prompt with goal and backstory (includes multi-agent orchestration prompt)
    const systemPrompt = this._buildSystemPrompt(roleConfig, role, resolvedRole, mcpActions, memoryContext, autonomyLevel);

    // Build task prompt with context
    const taskPrompt = this._buildTaskPrompt({
      role,
      task,
      previousOutput,
      chainContext,
      memoryContext,
      mcpActions
    });

    logger.info(`Executing ${role} with ${modelId}`);
    logger.debug(`System prompt: ${systemPrompt.substring(0, 200)}...`);
    logger.debug(`Task prompt: ${taskPrompt.substring(0, 200)}...`);

    // Combine system prompt and task prompt into full prompt
    // Format: System prompt provides role context, task prompt provides the actual task
    const fullPrompt = `${systemPrompt}\n\n${taskPrompt}`;

    // Call real AI model via modelProxy with streaming support
    let output = '';
    let thinking = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    try {
      const result = await modelProxy.call(modelId, fullPrompt, {
        temperature: 0.3, // Lower temperature for more focused agent responses
        maxTokens: 8192, // Allow longer responses for complex tasks
        userId: mcpContext?.metadata?.userId, // Pass userId if available
        stream: stream && !!onModelTelemetry, // Stream only if callback provided
        onToken: onModelTelemetry ? (token, accumulated) => {
          // Emit token telemetry
          onModelTelemetry({
            type: 'token',
            token,
            accumulated,
            role,
            model: modelId
          });
        } : null,
        onThinking: onModelTelemetry ? (thinkingChunk, accumulatedThinking) => {
          // Emit thinking/reasoning telemetry for models that support it
          thinking = accumulatedThinking;
          onModelTelemetry({
            type: 'thinking',
            thinking: thinkingChunk,
            accumulated: accumulatedThinking,
            role,
            model: modelId
          });
        } : null
      });
      
      // Extract content from result (modelProxy returns { content, thinking, usage, ... })
      output = result.content || result.text || '';
      thinking = result.thinking || '';
      usage = result.usage || usage;
      
      if (!output) {
        logger.warn(`Model ${modelId} returned empty response for role ${role}`);
        output = `[Empty response from ${modelId} for ${role}]`;
      }
    } catch (error) {
      logger.error(`Model call failed for ${modelId} (role: ${role}):`, error);
      // Fallback to simulated response on error (for graceful degradation)
      output = await this._simulateModelCall({
        modelId,
        systemPrompt,
        taskPrompt,
        role
      });
      logger.warn(`Using simulated response as fallback for ${role}`);
    }

    const endTime = Date.now();

    return {
      role,
      model: modelId,
      output,
      thinking: thinking || undefined, // Include thinking if available
      mcpActions,
      usage,
      duration: endTime - startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build system prompt with goal and backstory
   * Now includes multi-agent orchestration prompt
   */
  _buildSystemPrompt(roleConfig, role, resolvedRole, mcpActions = [], memoryContext = null, autonomyLevel = 2) {
    // Get role-specific prompt from multi-agent orchestrator
    const rolePrompt = multiAgentPrompt.getRoleSpecificPrompt(role, autonomyLevel);
    
    if (!roleConfig) {
      return `${rolePrompt}\n\nYou are executing as the ${role} agent in this multi-agent chain.`;
    }

    const registryLine = resolvedRole
      ? `\n## Role Registry\n- Canonical Role: ${resolvedRole.id}\n- Tier Allowed: ${resolvedRole.tierAllowed}\n- Selected Model Hint: ${resolvedRole.selectedModel || 'n/a'}`
      : '';

    const mcpLine = mcpActions.length > 0
      ? `\n## MCP Tool Context\n${mcpActions.map(a => `- ${a.server}.${a.tool} (${a.success ? 'ok' : 'failed'})`).join('\n')}`
      : '';

    const memoryLine = memoryContext && memoryContext.promptBlock
      ? `\n## Shared Memory\n${memoryContext.promptBlock}`
      : '';

    return `${rolePrompt}

# Role: ${roleConfig.name}

${roleConfig.description}

## Your Goal
${roleConfig.goal}

## Your Backstory
${roleConfig.backstory}

## Your Capabilities
${roleConfig.capabilities.map(c => `- ${c}`).join('\n')}
${registryLine}
${mcpLine}
${memoryLine}

## Instructions
- Focus on your specific role and expertise
- Build upon the work of previous agents in the chain
- Provide clear, actionable output for the next agent
- Maintain high quality and attention to detail
- Work collaboratively as part of the multi-agent system
- Follow the autonomy level guidelines above`;
  }

  /**
   * Build task prompt with context
   */
  _buildTaskPrompt({ role, task, previousOutput, chainContext, memoryContext, mcpActions = [] }) {
    let prompt = `# Task\n${task}\n\n`;

    if (previousOutput) {
      prompt += `# Previous Agent Output\n${previousOutput}\n\n`;
    }

    if (Object.keys(chainContext).length > 0) {
      prompt += `# Chain Context\n`;
      for (const [agentRole, output] of Object.entries(chainContext)) {
        prompt += `\n## ${agentRole}\n${output.substring(0, 500)}${output.length > 500 ? '...' : ''}\n`;
      }
    }

    if (mcpActions.length > 0) {
      prompt += `\n# MCP Interaction Results\n`;
      for (const action of mcpActions) {
        const summary = action.success ? 'success' : `failed: ${action.error || 'unknown error'}`;
        prompt += `- ${action.server}.${action.tool}: ${summary}\n`;
      }
    }

    if (memoryContext && memoryContext.promptBlock) {
      prompt += `\n# Graphiti Memory Context\n${memoryContext.promptBlock}\n`;
    }

    prompt += `\n# Your Task as ${role}\nPerform your role's responsibilities on the above task. Provide clear output that the next agent can build upon.`;

    return prompt;
  }

  /**
   * Get role configuration from ROLE_DEFINITIONS
   */
  _getRoleConfig(roleName) {
    const resolved = roleRegistry.resolveRole(roleName, {
      tier: 'enterprise',
      strategy: 'balanced'
    });

    return resolved || null;
  }

  _isMcpManagedRole(roleName) {
    const normalized = String(roleName || '').toLowerCase();
    return normalized === 'coder' || normalized === 'builder' || normalized === 'researcher';
  }

  async _runMcpInteractions({ role, task, previousOutput, mcpContext = {} }) {
    const normalized = String(role || '').toLowerCase();

    if (normalized === 'researcher') {
      return mcpClient.batchInvoke([
        {
          server: 'filesystem',
          tool: 'searchSymbols',
          args: {
            query: mcpContext.searchQuery || this._deriveSearchQuery(task),
            workspacePath: mcpContext.workspacePath
          }
        },
        {
          server: 'web-search',
          tool: 'search',
          args: {
            query: this._deriveSearchQuery(task),
            maxResults: 5
          }
        }
      ]);
    }

    return mcpClient.batchInvoke([
      {
        server: 'filesystem',
        tool: 'readFile',
        args: {
          targetFile: mcpContext.targetFile,
          workspacePath: mcpContext.workspacePath
        }
      },
      {
        server: 'terminal',
        tool: 'runCommand',
        args: {
          command: mcpContext.testCommand || 'npm test -- --help',
          dryRun: true
        }
      },
      {
        server: 'filesystem',
        tool: 'previewPatch',
        args: {
          previousOutput: typeof previousOutput === 'string' ? previousOutput.slice(0, 2000) : '',
          task: String(task || '').slice(0, 1000)
        }
      }
    ]);
  }

  _deriveSearchQuery(task) {
    if (typeof task === 'string') {
      return task.split('\n')[0].slice(0, 180);
    }
    return 'HybridMind implementation reference';
  }

  _extractProjectId(task, chainId) {
    if (typeof task === 'object' && task.projectId) {
      return String(task.projectId);
    }

    return `project-${chainId}`;
  }

  _initializeMemoryContext(chainState) {
    const task = chainState.task;
    const metadata = typeof task === 'object' ? (task.metadata || {}) : {};
    const conventions = Array.isArray(metadata.conventions) ? metadata.conventions : [];

    for (const convention of conventions) {
      if (convention && convention.key && convention.value) {
        graphitiMemoryClient.upsertConvention(
          chainState.projectId,
          convention.key,
          convention.value,
          convention.source || 'task-metadata',
          convention.tags || []
        );
      }
    }

    return agentContextComposer.composeRoleContext({
      projectId: chainState.projectId,
      role: 'shared',
      task,
      tags: metadata.memoryTags || []
    });
  }

  _shouldRunSelfHealing(roleName, chainState) {
    const normalizedRole = String(roleName || '').toLowerCase();
    const metadata = chainState?.mcpContext?.metadata || {};

    if (metadata.selfHealing === false) {
      return false;
    }

    return normalizedRole === 'tester';
  }

  /**
   * Get roles for chain type
   */
  _getRolesForChainType(chainType) {
    const roleTemplates = {
      'coding': {
        planner: { taskType: 'planning', prioritize: 'quality' },
        builder: { taskType: 'code-generation', prioritize: 'speed' },
        reviewer: { taskType: 'code-review', prioritize: 'quality' }
      },
      'coding-full': {
        analyst: { taskType: 'planning', prioritize: 'quality' },
        planner: { taskType: 'planning', prioritize: 'quality' },
        builder: { taskType: 'code-generation', prioritize: 'balanced' },
        reviewer: { taskType: 'code-review', prioritize: 'quality' },
        documenter: { taskType: 'documentation', prioritize: 'balanced' }
      },
      'research': {
        researcher: { taskType: 'research', prioritize: 'quality' },
        analyst: { taskType: 'planning', prioritize: 'quality' },
        documenter: { taskType: 'documentation', prioritize: 'balanced' }
      },
      'debugging': {
        debugger: { taskType: 'debugging', prioritize: 'quality' },
        reviewer: { taskType: 'code-review', prioritize: 'quality' }
      },
      'optimization': {
        analyst: { taskType: 'planning', prioritize: 'quality' },
        optimizer: { taskType: 'refactoring', prioritize: 'quality' },
        reviewer: { taskType: 'code-review', prioritize: 'quality' }
      },
      'self-healing': {
        coder: { taskType: 'code-generation', prioritize: 'balanced' },
        tester: { taskType: 'testing', prioritize: 'quality' },
        reviewer: { taskType: 'code-review', prioritize: 'quality' }
      }
    };

    return roleTemplates[chainType] || roleTemplates.coding;
  }

  /**
   * Simulate AI model call (replace with actual AI integration)
   */
  async _simulateModelCall({ modelId, systemPrompt, taskPrompt, role }) {
    // TODO: Replace with actual AI model integration
    
    const model = MODEL_CAPABILITIES[modelId];
    const simulatedLatency = model ? 
      (10 - model.capabilities.speed) * 500 : 
      2000;

    await new Promise(resolve => setTimeout(resolve, simulatedLatency));

    return `[Simulated ${role} output from ${modelId}]\n\nThis is where the actual AI model response would appear. The model would process the task based on the system prompt (with goal and backstory) and the task context.\n\nCapabilities: ${model ? model.capabilities.codeGeneration : 'N/A'}`;
  }

  /**
   * Generate unique chain ID
   */
  _generateChainId() {
    return `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active chains
   */
  getActiveChains() {
    return Array.from(this.activeChains.values()).map(chain => ({
      id: chain.id,
      status: chain.status,
      task: chain.task,
      config: chain.config,
      startTime: chain.startTime
    }));
  }

  /**
   * Get chain status
   */
  getChainStatus(chainId) {
    return this.activeChains.get(chainId);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      activeChains: this.activeChains.size,
      successRate: this.stats.totalChains > 0 
        ? (this.stats.completedChains / this.stats.totalChains * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Stop a running chain
   */
  stopChain(chainId) {
    const chain = this.activeChains.get(chainId);
    if (chain) {
      chain.status = 'stopped';
      this.activeChains.delete(chainId);
      this.emit('chain:stopped', { chainId });
      logger.info(`Chain ${chainId} stopped`);
      return true;
    }
    return false;
  }
}

// Singleton instance
module.exports = new ChainOrchestrator();
