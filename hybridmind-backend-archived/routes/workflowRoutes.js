const express = require('express');
const router = express.Router();
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const tierValidator = require('../middleware/tierValidator');
const { 
  WORKFLOW_MODES, 
  getAvailableWorkflows, 
  getRecommendedWorkflow,
  validateWorkflowMode
} = require('../config/workflowModes');
const workflowOptimizer = require('../services/workflows/workflowOptimizer');

/**
 * Get available workflow modes for user's tier
 * GET /workflow/modes
 */
router.get('/modes', tierValidator.validateTier, async (req, res, next) => {
  try {
    const tier = req.tier || req.user?.tier || 'free';
    const availableWorkflows = getAvailableWorkflows(tier);

    res.json(responseFormatter.success({
      tier,
      workflows: availableWorkflows,
      count: availableWorkflows.length
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get recommended workflow for task
 * POST /workflow/recommend
 */
router.post('/recommend', tierValidator.validateTier, async (req, res, next) => {
  try {
    const tier = req.tier || req.user?.tier || 'free';
    const { modelCount, goal = 'quality' } = req.body;

    const recommended = getRecommendedWorkflow(tier, modelCount, goal);

    if (!recommended) {
      return res.status(400).json(
        responseFormatter.error(
          `No compatible workflow found for ${modelCount} models on ${tier} tier`,
          null,
          'NO_WORKFLOW_MATCH'
        )
      );
    }

    res.json(responseFormatter.success({
      recommended,
      tier,
      modelCount,
      goal
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Validate workflow mode
 * POST /workflow/validate
 */
router.post('/validate', tierValidator.validateTier, async (req, res, next) => {
  try {
    const tier = req.tier || req.user?.tier || 'free';
    const { workflowMode, modelCount } = req.body;

    const validation = validateWorkflowMode(tier, workflowMode, modelCount);

    res.json(responseFormatter.success({
      valid: validation.valid,
      error: validation.error || null,
      tier,
      workflowMode,
      modelCount
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Optimize workflow steps
 * POST /workflow/optimize
 */
router.post('/optimize', tierValidator.validateTier, async (req, res, next) => {
  try {
    const { steps, context = {} } = req.body;

    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json(
        responseFormatter.error('Steps array is required', null, 'INVALID_STEPS')
      );
    }

    logger.info(`Optimizing workflow with ${steps.length} steps`);

    const optimization = workflowOptimizer.optimizeWorkflow(steps, context);

    res.json(responseFormatter.success({
      optimization: optimization.metrics,
      optimizedSteps: optimization.optimizedSteps,
      parallelGroups: optimization.parallelGroups,
      contextOptimization: optimization.contextOptimization,
      removed: optimization.removed,
      bottlenecks: optimization.bottlenecks
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Create optimized execution plan
 * POST /workflow/plan
 */
router.post('/plan', tierValidator.validateTier, async (req, res, next) => {
  try {
    const { steps, context = {} } = req.body;

    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json(
        responseFormatter.error('Steps array is required', null, 'INVALID_STEPS')
      );
    }

    logger.info(`Creating optimized execution plan for ${steps.length} steps`);

    const executionPlan = workflowOptimizer.createOptimizedExecutionPlan(steps, context);

    res.json(responseFormatter.success({
      executionPlan: executionPlan.batches,
      optimization: executionPlan.optimization,
      summary: executionPlan.summary
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get optimizer metrics
 * GET /workflow/metrics
 */
router.get('/metrics', tierValidator.validateTier, async (req, res, next) => {
  try {
    const metrics = workflowOptimizer.getMetrics();

    res.json(responseFormatter.success({
      metrics,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Clear optimizer cache
 * POST /workflow/cache/clear
 */
router.post('/cache/clear', tierValidator.requireFeature('agentic-chains'), async (req, res, next) => {
  try {
    workflowOptimizer.clearCache();

    res.json(responseFormatter.success({
      message: 'Optimizer cache cleared successfully'
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
