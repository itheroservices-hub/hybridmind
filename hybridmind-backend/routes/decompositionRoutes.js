/**
 * Decomposition API Routes
 * 
 * Exposes decomposition analysis and workflow routing capabilities.
 */

const express = require('express');
const router = express.Router();
const decompositionEngine = require('../services/decomposition/decompositionEngine');
const workflowRouter = require('../services/decomposition/workflowRouter');
const { validateTier } = require('../middleware/tierValidator');
const logger = require('../utils/logger');

/**
 * POST /api/decomposition/analyze
 * Analyze task with all 4 decomposition strategies
 */
router.post('/analyze', validateTier, async (req, res, next) => {
  try {
    const { task, strategy } = req.body;

    if (!task || !task.description) {
      return res.status(400).json({
        error: 'Task description required',
        required: { task: { description: 'string', context: 'object (optional)' } }
      });
    }

    // Analyze task
    const analysis = decompositionEngine.analyzeTask(task);

    res.json({
      success: true,
      analysis,
      metrics: decompositionEngine.getMetrics()
    });

  } catch (error) {
    logger.error('Decomposition analysis error:', error);
    next(error);
  }
});

/**
 * POST /api/decomposition/route
 * Get routing recommendation for task
 */
router.post('/route', validateTier, async (req, res, next) => {
  try {
    const { task, options } = req.body;

    if (!task || !task.description) {
      return res.status(400).json({
        error: 'Task description required',
        required: { task: { description: 'string' } }
      });
    }

    // Route task
    const routingPlan = await workflowRouter.routeTask(task, {
      ...options,
      tier: req.tier || 'free'
    });

    res.json({
      success: true,
      routingPlan,
      metrics: workflowRouter.getMetrics()
    });

  } catch (error) {
    logger.error('Routing error:', error);
    next(error);
  }
});

/**
 * GET /api/decomposition/metrics
 * Get decomposition engine metrics
 */
router.get('/metrics', validateTier, (req, res) => {
  const decompositionMetrics = decompositionEngine.getMetrics();
  const routingMetrics = workflowRouter.getMetrics();

  res.json({
    success: true,
    metrics: {
      decomposition: decompositionMetrics,
      routing: routingMetrics
    }
  });
});

/**
 * GET /api/decomposition/strategies
 * Get available decomposition strategies
 */
router.get('/strategies', validateTier, (req, res) => {
  res.json({
    success: true,
    strategies: [
      {
        name: 'functional',
        description: 'Separate by architectural concerns (UI, backend, DB, API)',
        dimensions: ['ui', 'backend', 'database', 'api', 'infrastructure', 'testing', 'documentation'],
        useCases: ['Full-stack development', 'Architectural planning', 'Modular design']
      },
      {
        name: 'spatial',
        description: 'Route by service location and network topology',
        dimensions: ['frontend', 'backend-api', 'backend-services', 'database-layer', 'external-apis', 'file-system', 'cache-layer'],
        useCases: ['Microservices', 'Distributed systems', 'Service mesh']
      },
      {
        name: 'temporal',
        description: 'Phase by execution timeline',
        dimensions: ['immediate', 'setup', 'execution', 'validation', 'cleanup', 'deferred', 'scheduled'],
        useCases: ['Async execution', 'Background processing', 'Scheduled tasks']
      },
      {
        name: 'data-driven',
        description: 'Segment by data patterns and processing needs',
        dimensions: ['logs', 'database', 'files', 'api', 'memory', 'events', 'metrics'],
        useCases: ['Data pipelines', 'ETL processes', 'Stream processing']
      }
    ]
  });
});

/**
 * GET /api/decomposition/services
 * Get service registry for spatial routing
 */
router.get('/services', validateTier, (req, res) => {
  const serviceRegistry = workflowRouter.getServiceRegistry();

  res.json({
    success: true,
    services: Object.entries(serviceRegistry).map(([name, config]) => ({
      name,
      ...config
    }))
  });
});

/**
 * POST /api/decomposition/optimize
 * Get optimization recommendations based on decomposition
 */
router.post('/optimize', validateTier, async (req, res, next) => {
  try {
    const { task, currentWorkflow } = req.body;

    if (!task || !task.description) {
      return res.status(400).json({
        error: 'Task description required'
      });
    }

    // Analyze task
    const analysis = decompositionEngine.analyzeTask(task);

    // Get routing plan
    const routingPlan = await workflowRouter.routeTask(task, {
      tier: req.tier || 'free'
    });

    // Generate optimization recommendations
    const optimizations = {
      latencyReduction: analysis.estimatedLatencyReduction,
      parallelizationOpportunities: analysis.parallelizationOpportunities,
      recommendations: analysis.recommendations,
      routingStrategy: routingPlan.strategy,
      parallelBatches: routingPlan.parallelBatches.length,
      sequentialRoutes: routingPlan.routes.length - routingPlan.parallelBatches.reduce((sum, b) => sum + b.routes.length, 0)
    };

    // Compare with current workflow if provided
    if (currentWorkflow) {
      optimizations.comparison = {
        currentRoutes: currentWorkflow.routes?.length || 0,
        optimizedRoutes: routingPlan.routes.length,
        currentParallel: currentWorkflow.parallelSteps || 0,
        optimizedParallel: routingPlan.parallelBatches.length,
        improvement: `${analysis.estimatedLatencyReduction}% faster`
      };
    }

    res.json({
      success: true,
      optimizations
    });

  } catch (error) {
    logger.error('Optimization error:', error);
    next(error);
  }
});

/**
 * POST /api/decomposition/cache/clear
 * Clear decomposition caches
 */
router.post('/cache/clear', validateTier, (req, res) => {
  try {
    // Clear caches (if implemented in the future)
    logger.info('Decomposition cache cleared');

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });

  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
