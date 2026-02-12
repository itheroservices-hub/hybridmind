/**
 * Context Management Routes
 * Provides endpoints for context optimization and management
 */

const express = require('express');
const router = express.Router();
const workflowEngine = require('../services/workflows/workflowEngine');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Optimize context for a single task
 * POST /api/context/optimize
 */
router.post('/optimize', async (req, res, next) => {
  try {
    const { rawContext, task, taskType = 'general', maxTokens = 8000 } = req.body;

    if (!rawContext || !task) {
      return res.status(400).json(
        responseFormatter.error('rawContext and task are required')
      );
    }

    logger.info(`Optimizing context for ${taskType} task (${rawContext.length} chars)`);

    const result = await workflowEngine.processContext({
      rawContext,
      task,
      taskType,
      maxTokens
    });

    res.json(responseFormatter.success(result));
  } catch (error) {
    next(error);
  }
});

/**
 * Process context for agent chains
 * POST /api/context/chain
 */
router.post('/chain', async (req, res, next) => {
  try {
    const { rawContext, chainSteps, globalContext = {} } = req.body;

    if (!rawContext || !chainSteps || !Array.isArray(chainSteps)) {
      return res.status(400).json(
        responseFormatter.error('rawContext and chainSteps array are required')
      );
    }

    logger.info(`Processing context for ${chainSteps.length} chain steps`);

    const result = await workflowEngine.processChainContext({
      rawContext,
      chainSteps,
      globalContext
    });

    res.json(responseFormatter.success(result));
  } catch (error) {
    next(error);
  }
});

/**
 * Get context manager statistics
 * GET /api/context/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await workflowEngine.getContextStatistics();
    res.json(responseFormatter.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * Clear context cache
 * POST /api/context/cache/clear
 */
router.post('/cache/clear', async (req, res, next) => {
  try {
    await workflowEngine.clearContextCache();
    res.json(responseFormatter.success({ message: 'Context cache cleared' }));
  } catch (error) {
    next(error);
  }
});

/**
 * Configure context manager
 * POST /api/context/configure
 */
router.post('/configure', async (req, res, next) => {
  try {
    const config = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json(
        responseFormatter.error('Configuration object required')
      );
    }

    workflowEngine.configureContextManager(config);

    res.json(responseFormatter.success({
      message: 'Context manager configured',
      config
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
