/**
 * Tool API Routes - REST endpoints for tool discovery and execution
 */

const express = require('express');
const router = express.Router();
const toolRegistry = require('../services/tools/toolRegistry');
const toolExecutor = require('../services/tools/toolExecutor');
const permissionManager = require('../services/tools/permissionManager');
const toolLogger = require('../services/tools/toolLogger');
const logger = require('../utils/logger');

// ========================================
// Tool Discovery
// ========================================

/**
 * GET /api/tools
 * List all available tools
 */
router.get('/', (req, res) => {
  try {
    const { category, enabled, riskLevel } = req.query;
    
    const tools = toolRegistry.getAllTools({
      category,
      enabled: enabled !== undefined ? enabled === 'true' : undefined,
      riskLevel
    });

    res.json({
      success: true,
      tools,
      totalTools: tools.length
    });
  } catch (error) {
    logger.error(`Tool listing failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/:toolName
 * Get specific tool information
 */
router.get('/:toolName', (req, res) => {
  try {
    const { toolName } = req.params;
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: `Tool '${toolName}' not found`
      });
    }

    // Include examples
    const examples = toolRegistry.getExamples(toolName);

    res.json({
      success: true,
      tool,
      examples
    });
  } catch (error) {
    logger.error(`Tool info retrieval failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/categories/list
 * List all tool categories
 */
router.get('/categories/list', (req, res) => {
  try {
    const categories = toolRegistry.getCategories();

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error(`Category listing failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/search/:query
 * Search tools by description or name
 */
router.get('/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const results = toolRegistry.searchTools(query);

    res.json({
      success: true,
      query,
      results,
      totalResults: results.length
    });
  } catch (error) {
    logger.error(`Tool search failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Tool Execution
// ========================================

/**
 * POST /api/tools/execute
 * Execute a tool
 */
router.post('/execute', async (req, res) => {
  try {
    const { toolName, parameters, agentId = 'system' } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'toolName is required'
      });
    }

    if (!parameters) {
      return res.status(400).json({
        success: false,
        error: 'parameters are required'
      });
    }

    logger.info(`Tool execution request: ${toolName} by ${agentId}`);

    const result = await toolExecutor.executeTool({
      toolName,
      parameters,
      agentId
    });

    res.json(result);

  } catch (error) {
    logger.error(`Tool execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tools/execute-chain
 * Execute multiple tools in sequence
 */
router.post('/execute-chain', async (req, res) => {
  try {
    const { toolCalls, agentId = 'system' } = req.body;

    if (!toolCalls || !Array.isArray(toolCalls)) {
      return res.status(400).json({
        success: false,
        error: 'toolCalls array is required'
      });
    }

    logger.info(`Tool chain execution: ${toolCalls.length} tools by ${agentId}`);

    const results = await toolExecutor.executeToolChain(toolCalls, agentId);

    res.json({
      success: true,
      results,
      totalTools: toolCalls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (error) {
    logger.error(`Tool chain execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tools/execute-parallel
 * Execute multiple tools in parallel
 */
router.post('/execute-parallel', async (req, res) => {
  try {
    const { toolCalls, agentId = 'system' } = req.body;

    if (!toolCalls || !Array.isArray(toolCalls)) {
      return res.status(400).json({
        success: false,
        error: 'toolCalls array is required'
      });
    }

    logger.info(`Parallel tool execution: ${toolCalls.length} tools by ${agentId}`);

    const results = await toolExecutor.executeToolParallel(toolCalls, agentId);

    res.json({
      success: true,
      results,
      totalTools: toolCalls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (error) {
    logger.error(`Parallel tool execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tools/parse-prompt
 * Parse declarative prompt into tool calls
 */
router.post('/parse-prompt', async (req, res) => {
  try {
    const { prompt, agentId = 'system' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'prompt is required'
      });
    }

    logger.info(`Parsing declarative prompt for ${agentId}`);

    const result = await toolExecutor.parseDeclarativePrompt(prompt, agentId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error(`Prompt parsing failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Permissions
// ========================================

/**
 * POST /api/tools/agents/create
 * Create agent with permissions
 */
router.post('/agents/create', (req, res) => {
  try {
    const { agentId, role, customPermissions } = req.body;

    if (!agentId || !role) {
      return res.status(400).json({
        success: false,
        error: 'agentId and role are required'
      });
    }

    const agent = permissionManager.createAgent(agentId, role, customPermissions);

    res.json({
      success: true,
      agent
    });

  } catch (error) {
    logger.error(`Agent creation failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/agents/:agentId
 * Get agent information
 */
router.get('/agents/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = permissionManager.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: `Agent '${agentId}' not found`
      });
    }

    res.json({
      success: true,
      agent
    });

  } catch (error) {
    logger.error(`Agent retrieval failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/agents
 * List all agents
 */
router.get('/agents', (req, res) => {
  try {
    const agents = permissionManager.listAgents();

    res.json({
      success: true,
      agents,
      totalAgents: agents.length
    });

  } catch (error) {
    logger.error(`Agent listing failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/roles
 * Get available roles
 */
router.get('/roles/list', (req, res) => {
  try {
    const roles = permissionManager.getRoles();

    res.json({
      success: true,
      roles
    });

  } catch (error) {
    logger.error(`Role listing failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Statistics & Logging
// ========================================

/**
 * GET /api/tools/stats
 * Get tool usage statistics
 */
router.get('/stats/usage', async (req, res) => {
  try {
    const stats = toolExecutor.getStatistics();
    const logStats = await toolLogger.getStatistics();

    res.json({
      success: true,
      registry: stats,
      usage: logStats
    });

  } catch (error) {
    logger.error(`Statistics retrieval failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/logs
 * Get tool execution logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { agentId, toolName, success, limit = 100 } = req.query;

    const logs = await toolLogger.getLogs({
      agentId,
      toolName,
      success: success !== undefined ? success === 'true' : undefined
    });

    res.json({
      success: true,
      logs: logs.slice(0, parseInt(limit)),
      totalLogs: logs.length
    });

  } catch (error) {
    logger.error(`Log retrieval failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools/permissions/log
 * Get permission request log
 */
router.get('/permissions/log', (req, res) => {
  try {
    const { agentId, toolName, granted } = req.query;

    const log = permissionManager.getPermissionLog({
      agentId,
      toolName,
      granted: granted !== undefined ? granted === 'true' : undefined
    });

    res.json({
      success: true,
      log,
      totalEntries: log.length
    });

  } catch (error) {
    logger.error(`Permission log retrieval failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
