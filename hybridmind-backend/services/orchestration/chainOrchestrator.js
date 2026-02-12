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
const { ROLE_DEFINITIONS, AGENT_ROLES } = require('../../config/agentRoles');
const logger = require('../../utils/logger');
const { EventEmitter } = require('events');

class ChainOrchestrator extends EventEmitter {
  constructor() {
    super();
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
    task,
    mode = 'auto', // 'auto', 'manual', 'template'
    tier = 'pro',
    chainType = 'coding',
    template = null,
    models = null, // For manual mode: { planner: 'model-id', builder: 'model-id', ... }
    budget = 'medium',
    prioritize = 'balanced',
    onProgress = null
  }) {
    const chainId = this._generateChainId();
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
        status: 'running',
        startTime: Date.now()
      };

      this.activeChains.set(chainId, chainState);
      this.emit('chain:started', { chainId, config: chainConfig });

      // 3. Execute roles in sequence
      const execution = await this._executeRoles({
        chainId,
        chainState,
        onProgress
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
        roles: this._getRolesForChainType(chainType)
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
        estimatedSpeed: templateConfig.estimatedSpeed
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
      breakdown: selection.breakdown
    };
  }

  /**
   * Execute all roles in sequence
   */
  async _executeRoles({ chainId, chainState, onProgress }) {
    const { config, task } = chainState;
    const results = {};
    let previousOutput = null;

    const roles = Array.isArray(config.roles) 
      ? config.roles 
      : Object.keys(config.roles);

    for (let i = 0; i < roles.length; i++) {
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
        // Execute role
        const result = await this._executeRole({
          role: roleName,
          roleConfig,
          modelId,
          task,
          previousOutput,
          chainContext: chainState.context
        });

        results[roleName] = result;
        previousOutput = result.output;
        chainState.context[roleName] = result.output;

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
    chainContext
  }) {
    const startTime = Date.now();

    // Build system prompt with goal and backstory
    const systemPrompt = this._buildSystemPrompt(roleConfig, role);

    // Build task prompt with context
    const taskPrompt = this._buildTaskPrompt({
      role,
      task,
      previousOutput,
      chainContext
    });

    logger.info(`Executing ${role} with ${modelId}`);
    logger.debug(`System prompt: ${systemPrompt.substring(0, 200)}...`);
    logger.debug(`Task prompt: ${taskPrompt.substring(0, 200)}...`);

    // TODO: Actually call the AI model here
    // For now, return simulated response
    const output = await this._simulateModelCall({
      modelId,
      systemPrompt,
      taskPrompt,
      role
    });

    const endTime = Date.now();

    return {
      role,
      model: modelId,
      output,
      duration: endTime - startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build system prompt with goal and backstory
   */
  _buildSystemPrompt(roleConfig, role) {
    if (!roleConfig) {
      return `You are a ${role} agent in a multi-agent system.`;
    }

    return `# Role: ${roleConfig.name}

${roleConfig.description}

## Your Goal
${roleConfig.goal}

## Your Backstory
${roleConfig.backstory}

## Your Capabilities
${roleConfig.capabilities.map(c => `- ${c}`).join('\n')}

## Instructions
- Focus on your specific role and expertise
- Build upon the work of previous agents in the chain
- Provide clear, actionable output for the next agent
- Maintain high quality and attention to detail
- Work collaboratively as part of the multi-agent system`;
  }

  /**
   * Build task prompt with context
   */
  _buildTaskPrompt({ role, task, previousOutput, chainContext }) {
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

    prompt += `\n# Your Task as ${role}\nPerform your role's responsibilities on the above task. Provide clear output that the next agent can build upon.`;

    return prompt;
  }

  /**
   * Get role configuration from ROLE_DEFINITIONS
   */
  _getRoleConfig(roleName) {
    // Map role names to AGENT_ROLES
    const roleMapping = {
      'planner': AGENT_ROLES.PLANNER,
      'builder': AGENT_ROLES.CODER,
      'coder': AGENT_ROLES.CODER,
      'reviewer': AGENT_ROLES.REVIEWER,
      'optimizer': AGENT_ROLES.OPTIMIZER,
      'researcher': AGENT_ROLES.RESEARCHER,
      'analyst': AGENT_ROLES.ANALYST,
      'documenter': AGENT_ROLES.DOCUMENTER,
      'tester': AGENT_ROLES.TESTER,
      'debugger': AGENT_ROLES.DEBUGGER,
      'architect': AGENT_ROLES.ARCHITECT
    };

    const roleKey = roleMapping[roleName.toLowerCase()] || roleName;
    return ROLE_DEFINITIONS[roleKey];
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
