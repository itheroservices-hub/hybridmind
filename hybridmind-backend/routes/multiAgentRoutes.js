/**
 * HybridMind Multi-Agent System - API Routes
 * 
 * REST API endpoints for multi-agent management, monitoring,
 * and collaboration.
 */

const express = require('express');
const router = express.Router();
const agentCoordinator = require('../services/agents/agentCoordinator');
const { agentProtocol } = require('../services/agents/agentProtocol');
const resourceManager = require('../services/agents/resourceManager');
const agentDecisionLogger = require('../services/agents/agentDecisionLogger');
const { getAgentsForTier, getBestAgentsForTask } = require('../config/agentRoles');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Initialize multi-agent system for tier
 * POST /multi-agent/initialize
 */
router.post('/initialize', async (req, res, next) => {
  try {
    const { tier = 'free', strategy = 'balanced' } = req.body;

    logger.info(`Initializing multi-agent system: ${tier} tier`);

    const result = agentCoordinator.initialize(tier, strategy);

    res.json(responseFormatter.success(result, {
      message: `Multi-agent system initialized for ${tier} tier`
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Execute task with multi-agent collaboration
 * POST /multi-agent/execute
 */
router.post('/execute', async (req, res, next) => {
  try {
    const {
      task,
      taskType = 'code-generation',
      context = {},
      priority = 'normal',
      strategy = null
    } = req.body;

    if (!task) {
      return res.status(400).json(
        responseFormatter.error('Task is required')
      );
    }

    logger.info(`Executing multi-agent task: ${taskType}`);

    const result = await agentCoordinator.executeTask({
      task,
      taskType,
      context,
      priority,
      strategy
    });

    res.json(responseFormatter.success(result, {
      taskType,
      duration: result.duration
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get workflow status
 * GET /multi-agent/workflows/:workflowId
 */
router.get('/workflows/:workflowId', (req, res, next) => {
  try {
    const { workflowId } = req.params;

    const workflow = agentCoordinator.getWorkflowStatus(workflowId);

    if (!workflow) {
      return res.status(404).json(
        responseFormatter.error('Workflow not found')
      );
    }

    res.json(responseFormatter.success(workflow));
  } catch (error) {
    next(error);
  }
});

/**
 * Get all active workflows
 * GET /multi-agent/workflows
 */
router.get('/workflows', (req, res, next) => {
  try {
    const workflows = agentCoordinator.getActiveWorkflows();

    res.json(responseFormatter.success({
      workflows,
      count: workflows.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get agent pool status
 * GET /multi-agent/pool
 */
router.get('/pool', (req, res, next) => {
  try {
    const agents = agentCoordinator.getAgentPoolStatus();

    res.json(responseFormatter.success({
      agents,
      total: agents.length,
      busy: agents.filter(a => a.status === 'busy').length,
      idle: agents.filter(a => a.status === 'idle').length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get system statistics
 * GET /multi-agent/statistics
 */
router.get('/statistics', (req, res, next) => {
  try {
    const stats = agentCoordinator.getStatistics();

    res.json(responseFormatter.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * Get tier configuration
 * GET /multi-agent/tiers/:tier
 */
router.get('/tiers/:tier', (req, res, next) => {
  try {
    const { tier } = req.params;

    const config = getAgentsForTier(tier);

    res.json(responseFormatter.success(config));
  } catch (error) {
    next(error);
  }
});

/**
 * Get best agents for task type
 * GET /multi-agent/recommend/:taskType
 */
router.get('/recommend/:taskType', (req, res, next) => {
  try {
    const { taskType } = req.params;
    const { tier = 'free' } = req.query;

    const agents = getBestAgentsForTask(taskType, tier);

    res.json(responseFormatter.success({
      taskType,
      tier,
      recommendedAgents: agents,
      count: agents.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get communication logs
 * GET /multi-agent/communication
 */
router.get('/communication', (req, res, next) => {
  try {
    const { agentId, type, since } = req.query;

    const logs = agentProtocol.getCommunicationLog({
      agentId,
      type,
      since
    });

    res.json(responseFormatter.success({
      logs,
      count: logs.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get protocol statistics
 * GET /multi-agent/protocol/stats
 */
router.get('/protocol/stats', (req, res, next) => {
  try {
    const stats = agentProtocol.getStatistics();

    res.json(responseFormatter.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * Get resource statistics
 * GET /multi-agent/resources
 */
router.get('/resources', (req, res, next) => {
  try {
    const stats = resourceManager.getStatistics();

    res.json(responseFormatter.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * Get agent resource usage
 * GET /multi-agent/resources/:agentId
 */
router.get('/resources/:agentId', (req, res, next) => {
  try {
    const { agentId } = req.params;

    const resources = resourceManager.getAgentResources(agentId);

    res.json(responseFormatter.success({
      agentId,
      resources
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get agent decisions
 * GET /multi-agent/decisions/:agentId
 */
router.get('/decisions/:agentId', (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { limit = 50 } = req.query;

    const decisions = agentDecisionLogger.getAgentDecisions(agentId, parseInt(limit));

    res.json(responseFormatter.success({
      agentId,
      decisions,
      count: decisions.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get agent messages
 * GET /multi-agent/messages/:agentId
 */
router.get('/messages/:agentId', (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { otherId, limit = 50 } = req.query;

    const messages = agentDecisionLogger.getAgentMessages(agentId, otherId, parseInt(limit));

    res.json(responseFormatter.success({
      agentId,
      messages,
      count: messages.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get collaboration patterns
 * GET /multi-agent/collaboration
 */
router.get('/collaboration', (req, res, next) => {
  try {
    const { pattern, since } = req.query;

    const patterns = agentDecisionLogger.getCollaborationPatterns({ pattern, since });

    res.json(responseFormatter.success({
      patterns,
      count: patterns.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get agent performance metrics
 * GET /multi-agent/performance/:agentId
 */
router.get('/performance/:agentId', (req, res, next) => {
  try {
    const { agentId } = req.params;

    const metrics = agentDecisionLogger.getAgentMetrics(agentId);

    res.json(responseFormatter.success({
      agentId,
      metrics
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get all performance metrics
 * GET /multi-agent/performance
 */
router.get('/performance', (req, res, next) => {
  try {
    const metrics = agentDecisionLogger.getAllMetrics();

    res.json(responseFormatter.success({
      metrics,
      agentCount: Object.keys(metrics).length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Generate debug report
 * POST /multi-agent/debug/report
 */
router.post('/debug/report', async (req, res, next) => {
  try {
    const {
      agentId = null,
      since = new Date(Date.now() - 3600000), // Last hour
      includeMessages = true,
      includePerformance = true
    } = req.body;

    const report = await agentDecisionLogger.generateDebugReport({
      agentId,
      since,
      includeMessages,
      includePerformance
    });

    res.json(responseFormatter.success(report, {
      message: 'Debug report generated successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Query decision logs
 * POST /multi-agent/query
 */
router.post('/query', (req, res, next) => {
  try {
    const query = req.body;

    const logs = agentDecisionLogger.queryLogs(query);

    res.json(responseFormatter.success({
      logs,
      count: logs.length,
      query
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Health check
 * GET /multi-agent/health
 */
router.get('/health', (req, res, next) => {
  try {
    const stats = agentCoordinator.getStatistics();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: {
        initialized: stats.tier !== 'Not initialized',
        tier: stats.tier,
        activeAgents: stats.activeAgents,
        activeWorkflows: stats.activeWorkflows
      },
      resources: resourceManager.getStatistics(),
      protocol: {
        activeAgents: agentProtocol.getStatistics().activeAgents,
        pendingMessages: agentProtocol.getStatistics().pendingMessages
      }
    };

    res.json(responseFormatter.success(health));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
