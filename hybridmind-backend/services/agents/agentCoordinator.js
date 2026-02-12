/**
 * HybridMind Multi-Agent System - Agent Coordinator
 * 
 * Central orchestrator that manages multiple agents working together.
 * Handles task assignment, workflow coordination, and agent collaboration
 * based on subscription tier (2/4/6/10 agents).
 * 
 * Features:
 * - Tier-based agent allocation
 * - Smart task-to-agent assignment
 * - Workflow orchestration (sequential, parallel, collaborative)
 * - Resource coordination
 * - Error handling and fallbacks
 * - Decision logging
 */

const { AGENT_ROLES, getAgentsForTier, getBestAgentsForTask, getModelForAgent } = require('../../config/agentRoles');
const { agentProtocol, MESSAGE_TYPES, RESOURCE_TYPES } = require('./agentProtocol');
const resourceManager = require('./resourceManager');
const agentDecisionLogger = require('./agentDecisionLogger');
const modelSelector = require('./modelSelector');
const decompositionEngine = require('../decomposition/decompositionEngine');
const workflowRouter = require('../decomposition/workflowRouter');
const logger = require('../../utils/logger');

/**
 * Workflow Execution Modes
 */
const WORKFLOW_MODES = {
  SEQUENTIAL: 'sequential',   // Agents work one after another
  PARALLEL: 'parallel',       // Agents work simultaneously
  PIPELINE: 'pipeline',       // Structured pipeline (plan → code → review)
  COLLABORATIVE: 'collaborative', // Agents collaborate and communicate
  INTELLIGENT: 'intelligent'  // AI-driven dynamic coordination
};

/**
 * Agent Coordinator Class
 */
class AgentCoordinator {
  constructor() {
    this.activeWorkflows = new Map(); // workflowId -> workflow state
    this.agentPool = new Map(); // agentId -> agent state
    this.tierConfig = null;
    this.workflowCounter = 0;
  }

  /**
   * Initialize coordinator for specific tier
   */
  initialize(tier = 'free', strategy = 'balanced') {
    this.tierConfig = getAgentsForTier(tier);
    this.strategy = strategy; // 'cost', 'balanced', 'quality'

    logger.info(`Agent coordinator initialized: ${tier} tier (${this.tierConfig.maxAgents} agents)`);
    logger.info(`Workflow mode: ${this.tierConfig.workflow}`);

    // Initialize agent pool
    this.tierConfig.agents.forEach((role, index) => {
      const agentId = `${role}-${index + 1}`;
      this.agentPool.set(agentId, {
        id: agentId,
        role,
        status: 'idle',
        currentTask: null,
        model: getModelForAgent(role, strategy)
      });

      // Register with protocol
      agentProtocol.registerAgent(agentId, role);
    });

    agentDecisionLogger.logDecision({
      agentId: 'coordinator',
      role: 'coordinator',
      action: 'initialize',
      decision: `Initialized ${tier} tier with ${this.tierConfig.maxAgents} agents`,
      reasoning: `User tier allows ${this.tierConfig.maxAgents} concurrent agents in ${this.tierConfig.workflow} mode`,
      context: { tier, strategy, agents: this.tierConfig.agents }
    });

    return {
      tier,
      maxAgents: this.tierConfig.maxAgents,
      workflow: this.tierConfig.workflow,
      agents: Array.from(this.agentPool.values())
    };
  }

  /**
   * Execute task with multi-agent collaboration
   */
  async executeTask({
    task,
    taskType,
    context = {},
    priority = 'normal',
    strategy = null,
    useDecomposition = true
  }) {
    const workflowId = `workflow_${++this.workflowCounter}`;
    const execStrategy = strategy || this.strategy;

    logger.info(`Starting workflow ${workflowId}: ${taskType}`);

    // Use decomposition engine for intelligent routing
    let decompositionAnalysis = null;
    let routingPlan = null;

    if (useDecomposition) {
      try {
        decompositionAnalysis = decompositionEngine.analyzeTask({
          name: taskType,
          description: task,
          context
        });

        routingPlan = await workflowRouter.routeTask({
          name: taskType,
          description: task,
          context
        }, {
          tier: this.tierConfig?.tier || 'free',
          preferredStrategy: context.decompositionStrategy
        });

        logger.info(`Decomposition analysis complete: ${decompositionAnalysis.parallelizationOpportunities.length} parallel opportunities, ${decompositionAnalysis.estimatedLatencyReduction}% latency reduction`);
        logger.info(`Routing plan generated: ${routingPlan.routes.length} routes, ${routingPlan.parallelBatches.length} parallel batches`);

      } catch (error) {
        logger.warn(`Decomposition failed, falling back to standard routing: ${error.message}`);
      }
    }

    // Log decision
    agentDecisionLogger.logDecision({
      agentId: 'coordinator',
      role: 'coordinator',
      action: 'task_assignment',
      decision: `Starting ${taskType} workflow with ${decompositionAnalysis ? 'decomposition-based' : 'standard'} routing`,
      reasoning: decompositionAnalysis 
        ? `Decomposition analysis suggests ${routingPlan.strategy} routing with ${decompositionAnalysis.estimatedLatencyReduction}% latency reduction`
        : `Task requires ${taskType} capabilities, using ${this.tierConfig.workflow} workflow mode`,
      context: { 
        workflowId, 
        task, 
        taskType, 
        priority,
        decomposition: decompositionAnalysis?.decompositions,
        routingPlan: routingPlan?.strategy
      }
    });

    // Get best agents for this task type (enhanced by decomposition if available)
    const assignedAgents = routingPlan 
      ? this._assignAgentsFromRoutingPlan(routingPlan, execStrategy)
      : this._assignAgentsToTask(taskType, execStrategy);

    if (assignedAgents.length === 0) {
      logger.error(`No agents available for task type: ${taskType}`);
      return {
        success: false,
        error: 'No suitable agents available',
        workflowId
      };
    }

    // Create workflow state
    const workflow = {
      id: workflowId,
      taskType,
      task,
      context,
      priority,
      agents: assignedAgents,
      mode: this.tierConfig.workflow,
      status: 'running',
      startedAt: new Date(),
      steps: [],
      results: {},
      errors: [],
      decomposition: decompositionAnalysis,
      routingPlan
    };

    this.activeWorkflows.set(workflowId, workflow);

    try {
      // Execute based on workflow mode (enhanced with decomposition)
      let result;
      
      if (routingPlan && routingPlan.parallelBatches.length > 0) {
        // Use decomposition-based parallel execution
        result = await this._executeDecomposed(workflow);
      } else {
        // Use standard workflow mode
        switch (this.tierConfig.workflow) {
          case 'sequential':
            result = await this._executeSequential(workflow);
            break;
          case 'pipeline':
            result = await this._executePipeline(workflow);
            break;
          case 'collaborative':
            result = await this._executeCollaborative(workflow);
            break;
          case 'intelligent':
            result = await this._executeIntelligent(workflow);
            break;
          default:
            result = await this._executeSequential(workflow);
        }
      }

      workflow.status = 'completed';
      workflow.completedAt = new Date();
      workflow.duration = workflow.completedAt - workflow.startedAt;

      // Log collaboration
      agentDecisionLogger.logCollaboration({
        agents: assignedAgents.map(a => a.id),
        pattern: routingPlan ? `decomposed-${routingPlan.strategy}` : this.tierConfig.workflow,
        task: taskType,
        outcome: result.success ? 'success' : 'failure',
        duration: workflow.duration,
        reasoning: `${assignedAgents.length} agents collaborated in ${routingPlan ? 'decomposed' : this.tierConfig.workflow} mode`,
        decomposition: decompositionAnalysis ? {
          latencyReduction: decompositionAnalysis.estimatedLatencyReduction,
          parallelOpportunities: decompositionAnalysis.parallelizationOpportunities.length,
          recommendations: decompositionAnalysis.recommendations.length
        } : null
      });

      return result;

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;

      logger.error(`Workflow ${workflowId} failed: ${error.message}`);

      // Log error
      agentDecisionLogger.logError({
        agentId: 'coordinator',
        role: 'coordinator',
        error,
        context: { workflowId, task, taskType }
      });

      return {
        success: false,
        error: error.message,
        workflowId
      };
    }
  }

  /**
   * Sequential execution (Free tier: 2 agents)
   */
  async _executeSequential(workflow) {
    logger.info(`Executing sequential workflow: ${workflow.id}`);

    const results = [];

    for (const agent of workflow.agents) {
      const stepId = `step_${workflow.steps.length + 1}`;
      
      logger.info(`Step ${stepId}: ${agent.role} starting`);

      const stepStart = Date.now();

      try {
        // Allocate resources
        await this._allocateResources(agent.id, workflow.context);

        // Execute agent's task
        const result = await this._executeAgentTask(agent, workflow, results);

        const stepDuration = Date.now() - stepStart;

        // Log performance
        agentDecisionLogger.logPerformance(
          agent.id,
          agent.role,
          stepDuration,
          true,
          { step: stepId, workflowId: workflow.id }
        );

        workflow.steps.push({
          id: stepId,
          agent: agent.id,
          role: agent.role,
          status: 'completed',
          duration: stepDuration,
          output: result
        });

        results.push(result);

        // Release resources
        this._releaseResources(agent.id);

      } catch (error) {
        logger.error(`Step ${stepId} failed: ${error.message}`);

        workflow.errors.push({
          step: stepId,
          agent: agent.id,
          error: error.message
        });

        // Try fallback
        const fallbackResult = await this._tryFallback(agent, workflow, error);
        
        if (fallbackResult) {
          results.push(fallbackResult);
        } else {
          throw error;
        }
      }
    }

    return {
      success: true,
      workflowId: workflow.id,
      results,
      finalOutput: results[results.length - 1],
      steps: workflow.steps
    };
  }

  /**
   * Pipeline execution (Pro tier: 4 agents)
   */
  async _executePipeline(workflow) {
    logger.info(`Executing pipeline workflow: ${workflow.id}`);

    // Pipeline stages: Researcher → Planner → Coder → Reviewer
    const stages = ['researcher', 'planner', 'coder', 'reviewer'];
    let currentOutput = workflow.task;

    for (const stageName of stages) {
      const agent = workflow.agents.find(a => a.role === stageName);
      
      if (!agent) continue; // Skip if agent not available in tier

      logger.info(`Pipeline stage: ${stageName}`);

      try {
        // Allocate resources
        await this._allocateResources(agent.id, workflow.context);

        // Execute with previous stage's output as input
        const result = await this._executeAgentTask(agent, {
          ...workflow,
          task: currentOutput
        });

        workflow.steps.push({
          stage: stageName,
          agent: agent.id,
          input: currentOutput,
          output: result,
          status: 'completed'
        });

        currentOutput = result;

        // Hand off to next stage
        const nextStage = stages[stages.indexOf(stageName) + 1];
        if (nextStage) {
          const nextAgent = workflow.agents.find(a => a.role === nextStage);
          if (nextAgent) {
            agentProtocol.handoffTask({
              from: agent.id,
              to: nextAgent.id,
              task: currentOutput,
              context: { stage: stageName, workflowId: workflow.id }
            });
          }
        }

        this._releaseResources(agent.id);

      } catch (error) {
        logger.error(`Pipeline stage ${stageName} failed: ${error.message}`);
        
        const fallbackResult = await this._tryFallback(agent, workflow, error);
        if (fallbackResult) {
          currentOutput = fallbackResult;
        } else {
          throw error;
        }
      }
    }

    return {
      success: true,
      workflowId: workflow.id,
      finalOutput: currentOutput,
      stages: workflow.steps
    };
  }

  /**
   * Collaborative execution (Pro-Plus tier: 6 agents)
   */
  async _executeCollaborative(workflow) {
    logger.info(`Executing collaborative workflow: ${workflow.id}`);

    // Agents collaborate by passing messages and sharing results
    const results = {};
    const promises = [];

    // Analyst starts first
    const analyst = workflow.agents.find(a => a.role === AGENT_ROLES.ANALYST);
    if (analyst) {
      const analysisResult = await this._executeAgentTask(analyst, workflow);
      results.analysis = analysisResult;

      // Share analysis with all agents
      workflow.agents.forEach(agent => {
        if (agent.id !== analyst.id) {
          agentProtocol.sendMessage({
            from: analyst.id,
            to: agent.id,
            type: MESSAGE_TYPES.QUERY,
            payload: { analysis: analysisResult },
            priority: 'high'
          });
        }
      });
    }

    // Parallel execution of Researcher and Planner
    const researcher = workflow.agents.find(a => a.role === AGENT_ROLES.RESEARCHER);
    const planner = workflow.agents.find(a => a.role === AGENT_ROLES.PLANNER);

    if (researcher && planner) {
      const [researchResult, planResult] = await Promise.all([
        this._executeAgentTask(researcher, { ...workflow, context: { ...workflow.context, analysis: results.analysis } }),
        this._executeAgentTask(planner, { ...workflow, context: { ...workflow.context, analysis: results.analysis } })
      ]);

      results.research = researchResult;
      results.plan = planResult;
    }

    // Coder uses research and plan
    const coder = workflow.agents.find(a => a.role === AGENT_ROLES.CODER);
    if (coder) {
      results.code = await this._executeAgentTask(coder, {
        ...workflow,
        context: { ...workflow.context, research: results.research, plan: results.plan }
      });
    }

    // Reviewer and Optimizer work in parallel
    const reviewer = workflow.agents.find(a => a.role === AGENT_ROLES.REVIEWER);
    const optimizer = workflow.agents.find(a => a.role === AGENT_ROLES.OPTIMIZER);

    if (reviewer && optimizer) {
      const [reviewResult, optimizedResult] = await Promise.all([
        this._executeAgentTask(reviewer, { ...workflow, task: results.code }),
        this._executeAgentTask(optimizer, { ...workflow, task: results.code })
      ]);

      results.review = reviewResult;
      results.optimized = optimizedResult;
    }

    return {
      success: true,
      workflowId: workflow.id,
      results,
      finalOutput: results.optimized || results.code,
      collaborationPattern: 'hierarchical-parallel'
    };
  }

  /**
   * Intelligent execution (Enterprise tier: 10 agents)
   */
  async _executeIntelligent(workflow) {
    logger.info(`Executing intelligent workflow: ${workflow.id}`);

    // AI-driven coordination - agents self-organize
    // This would use planning AI to determine optimal collaboration pattern

    return {
      success: true,
      workflowId: workflow.id,
      message: 'Intelligent mode - implementation in progress'
    };
  }

  /**
   * Execute individual agent task
   */
  async _executeAgentTask(agent, workflow, previousResults = []) {
    logger.debug(`Executing task for agent: ${agent.id} (${agent.role})`);

    // Mark agent as busy
    agent.status = 'busy';
    agent.currentTask = workflow.task;

    // Log decision
    agentDecisionLogger.logDecision({
      agentId: agent.id,
      role: agent.role,
      action: 'task_execution',
      decision: `Starting ${workflow.taskType} task`,
      reasoning: `Agent assigned based on role capabilities and task requirements`,
      context: { workflowId: workflow.id, model: agent.model },
      modelUsed: agent.model
    });

    try {
      // This would call the actual AI model
      // For now, simulate with placeholder
      const result = {
        agent: agent.id,
        role: agent.role,
        output: `${agent.role} result for: ${workflow.task}`,
        model: agent.model,
        timestamp: new Date()
      };

      agent.status = 'idle';
      agent.currentTask = null;

      return result;

    } catch (error) {
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Assign agents to task based on capabilities
   */
  _assignAgentsToTask(taskType, strategy) {
    const bestAgents = getBestAgentsForTask(taskType, this.tierConfig.tier || 'free');
    const assigned = [];

    for (const agentDef of bestAgents) {
      // Find available agent with this role
      const agent = Array.from(this.agentPool.values()).find(
        a => a.role === agentDef.name.toLowerCase() && a.status === 'idle'
      );

      if (agent) {
        assigned.push(agent);
        
        if (assigned.length >= this.tierConfig.maxAgents) {
          break;
        }
      }
    }

    // If we don't have enough, use tier defaults
    if (assigned.length < this.tierConfig.agents.length) {
      for (const role of this.tierConfig.agents) {
        if (!assigned.find(a => a.role === role)) {
          const agent = Array.from(this.agentPool.values()).find(
            a => a.role === role && !assigned.includes(a)
          );
          if (agent) assigned.push(agent);
        }
      }
    }

    logger.debug(`Assigned ${assigned.length} agents: ${assigned.map(a => a.role).join(', ')}`);

    return assigned;
  }

  /**
   * Allocate resources for agent
   */
  async _allocateResources(agentId, context) {
    // Allocate context memory (estimate based on task)
    const contextTokens = context.complexity === 'high' ? 50000 : 20000;
    
    resourceManager.allocateContext(agentId, contextTokens, context.priority || 'normal');

    // Check API quota
    resourceManager.consumeApiQuota(agentId, 1);
  }

  /**
   * Release resources for agent
   */
  _releaseResources(agentId) {
    resourceManager.clearAgentResources(agentId);
  }

  /**
   * Assign agents from decomposition routing plan
   */
  _assignAgentsFromRoutingPlan(routingPlan, strategy) {
    const assigned = [];
    const seenRoles = new Set();

    // Collect all agent roles from routing plan
    routingPlan.routes.forEach(route => {
      if (route.agents) {
        route.agents.forEach(role => {
          if (!seenRoles.has(role) && assigned.length < this.tierConfig.maxAgents) {
            const agent = Array.from(this.agentPool.values()).find(
              a => a.role === role && a.status === 'idle'
            );
            
            if (agent) {
              assigned.push(agent);
              seenRoles.add(role);
            }
          }
        });
      }
    });

    // Fill remaining slots with tier defaults if needed
    if (assigned.length < this.tierConfig.agents.length) {
      for (const role of this.tierConfig.agents) {
        if (!seenRoles.has(role) && assigned.length < this.tierConfig.maxAgents) {
          const agent = Array.from(this.agentPool.values()).find(
            a => a.role === role && !assigned.includes(a)
          );
          if (agent) {
            assigned.push(agent);
            seenRoles.add(role);
          }
        }
      }
    }

    logger.debug(`Assigned ${assigned.length} agents from routing plan: ${assigned.map(a => a.role).join(', ')}`);
    return assigned;
  }

  /**
   * Execute workflow using decomposition-based routing
   */
  async _executeDecomposed(workflow) {
    logger.info(`Executing decomposed workflow: ${workflow.id}`);

    const { routingPlan } = workflow;
    const results = {
      routes: {},
      batches: {},
      synthesis: null
    };

    // Execute parallel batches
    for (const batch of routingPlan.parallelBatches) {
      logger.info(`Executing parallel batch: ${batch.batchId} (${batch.routes.length} routes)`);

      const batchPromises = batch.routes.map(async (routeId) => {
        const route = routingPlan.routes.find(r => r.routeId === routeId);
        if (!route) return null;

        // Find agent(s) for this route
        const agent = workflow.agents.find(a => route.agents.includes(a.role));
        if (!agent) {
          logger.warn(`No agent found for route ${routeId}`);
          return null;
        }

        // Execute route
        const routeResult = await this._executeAgentTask(agent, {
          ...workflow,
          context: {
            ...workflow.context,
            route,
            routingPlan
          }
        });

        return { routeId, result: routeResult };
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(br => {
        if (br) {
          results.routes[br.routeId] = br.result;
        }
      });

      results.batches[batch.batchId] = {
        completed: batchResults.filter(br => br !== null).length,
        total: batch.routes.length
      };
    }

    // Execute remaining sequential routes
    const parallelRouteIds = new Set(
      routingPlan.parallelBatches.flatMap(b => b.routes)
    );

    const sequentialRoutes = routingPlan.routes.filter(
      r => !parallelRouteIds.has(r.routeId)
    );

    for (const route of sequentialRoutes) {
      const agent = workflow.agents.find(a => route.agents.includes(a.role));
      if (agent) {
        const routeResult = await this._executeAgentTask(agent, {
          ...workflow,
          context: {
            ...workflow.context,
            route,
            routingPlan,
            previousResults: results.routes
          }
        });

        results.routes[route.routeId] = routeResult;
      }
    }

    // Synthesize final output
    results.synthesis = this._synthesizeDecomposedResults(
      results,
      routingPlan,
      workflow
    );

    return {
      success: true,
      workflowId: workflow.id,
      output: results.synthesis,
      decomposition: {
        strategy: routingPlan.strategy,
        routes: Object.keys(results.routes).length,
        parallelBatches: Object.keys(results.batches).length,
        estimatedLatencyReduction: workflow.decomposition.estimatedLatencyReduction
      },
      results
    };
  }

  /**
   * Synthesize results from decomposed execution
   */
  _synthesizeDecomposedResults(results, routingPlan, workflow) {
    const { strategy } = routingPlan;
    
    let synthesis = {
      strategy,
      summary: '',
      components: {},
      recommendations: []
    };

    switch (strategy) {
      case 'functional':
        // Combine functional layers
        synthesis.summary = 'Functional decomposition executed successfully.';
        synthesis.components = this._synthesizeFunctional(results, routingPlan);
        break;

      case 'spatial':
        // Combine service results
        synthesis.summary = 'Spatial routing completed across all services.';
        synthesis.components = this._synthesizeSpatial(results, routingPlan);
        break;

      case 'temporal':
        // Combine temporal phases
        synthesis.summary = 'Temporal phases executed in sequence.';
        synthesis.components = this._synthesizeTemporal(results, routingPlan);
        break;

      case 'data-driven':
        // Combine data segments
        synthesis.summary = 'Data-driven processing completed.';
        synthesis.components = this._synthesizeDataDriven(results, routingPlan);
        break;

      default:
        synthesis.summary = 'Hybrid decomposition executed.';
        synthesis.components = results.routes;
    }

    // Add decomposition recommendations
    if (workflow.decomposition && workflow.decomposition.recommendations) {
      synthesis.recommendations = workflow.decomposition.recommendations;
    }

    return synthesis;
  }

  /**
   * Synthesize functional decomposition results
   */
  _synthesizeFunctional(results, routingPlan) {
    const components = {
      ui: null,
      backend: null,
      database: null,
      api: null,
      infrastructure: null,
      testing: null,
      documentation: null
    };

    routingPlan.routes
      .filter(r => r.type === 'functional')
      .forEach(route => {
        const result = results.routes[route.routeId];
        if (result && route.layer) {
          components[route.layer] = result;
        }
      });

    return components;
  }

  /**
   * Synthesize spatial decomposition results
   */
  _synthesizeSpatial(results, routingPlan) {
    const components = {};

    routingPlan.routes
      .filter(r => r.type === 'spatial')
      .forEach(route => {
        const result = results.routes[route.routeId];
        if (result && route.zone) {
          components[route.zone] = result;
        }
      });

    return components;
  }

  /**
   * Synthesize temporal decomposition results
   */
  _synthesizeTemporal(results, routingPlan) {
    const components = {
      immediate: [],
      setup: [],
      execution: [],
      validation: [],
      cleanup: [],
      deferred: [],
      scheduled: []
    };

    routingPlan.routes
      .filter(r => r.type === 'temporal')
      .forEach(route => {
        const result = results.routes[route.routeId];
        if (result && route.phase) {
          components[route.phase].push(result);
        }
      });

    return components;
  }

  /**
   * Synthesize data-driven decomposition results
   */
  _synthesizeDataDriven(results, routingPlan) {
    const components = {};

    routingPlan.routes
      .filter(r => r.type === 'data-driven')
      .forEach(route => {
        const result = results.routes[route.routeId];
        if (result && route.dataType) {
          components[route.dataType] = result;
        }
      });

    return components;
  }

  /**
   * Try fallback strategy
   */
  async _tryFallback(agent, workflow, error) {
    logger.warn(`Attempting fallback for ${agent.id}`);

    agentDecisionLogger.logError({
      agentId: agent.id,
      role: agent.role,
      error,
      context: { workflowId: workflow.id },
      recoveryAttempt: 'Trying fallback agent'
    });

    // Try different model
    const fallbackModel = this.strategy === 'quality' 
      ? getModelForAgent(agent.role, 'balanced')
      : getModelForAgent(agent.role, 'quality');

    logger.info(`Fallback: Switching ${agent.id} from ${agent.model} to ${fallbackModel}`);

    agent.model = fallbackModel;

    try {
      return await this._executeAgentTask(agent, workflow);
    } catch (fallbackError) {
      logger.error(`Fallback also failed: ${fallbackError.message}`);
      return null;
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId) {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get agent pool status
   */
  getAgentPoolStatus() {
    return Array.from(this.agentPool.values());
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    return {
      tier: this.tierConfig?.name || 'Not initialized',
      maxAgents: this.tierConfig?.maxAgents || 0,
      activeAgents: Array.from(this.agentPool.values()).filter(a => a.status === 'busy').length,
      idleAgents: Array.from(this.agentPool.values()).filter(a => a.status === 'idle').length,
      activeWorkflows: this.activeWorkflows.size,
      totalWorkflows: this.workflowCounter,
      resources: resourceManager.getStatistics(),
      communication: agentProtocol.getStatistics()
    };
  }
}

// Export singleton
module.exports = new AgentCoordinator();
