/**
 * Planning & Reflection API Routes
 * Provides endpoints for planning, reflection, and iterative improvement
 */

const express = require('express');
const router = express.Router();
const planningModule = require('../services/planning/planningModule');
const reflectionEngine = require('../services/planning/reflectionEngine');
const revisionRouter = require('../services/planning/revisionRouter');
const reflectionOrchestrator = require('../services/planning/reflectionOrchestrator');
const logger = require('../utils/logger');

// ========================================
// Planning Endpoints
// ========================================

/**
 * POST /api/planning/generate
 * Generate a structured execution plan
 */
router.post('/generate', async (req, res) => {
  try {
    const { goal, context = '', taskType = 'general', constraints = {} } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'Goal is required'
      });
    }

    logger.info(`📋 Generating plan for: ${goal.substring(0, 50)}...`);

    const result = await planningModule.generatePlan({
      goal,
      context,
      taskType,
      constraints
    });

    res.json(result);

  } catch (error) {
    logger.error(`Plan generation failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/planning/refine
 * Refine an existing plan
 */
router.post('/refine', async (req, res) => {
  try {
    const { plan, feedback, context = '' } = req.body;

    if (!plan || !feedback) {
      return res.status(400).json({
        success: false,
        error: 'Plan and feedback are required'
      });
    }

    logger.info('🔧 Refining plan based on feedback');

    const result = await planningModule.refinePlan({
      plan,
      feedback,
      context
    });

    res.json(result);

  } catch (error) {
    logger.error(`Plan refinement failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Reflection Endpoints
// ========================================

/**
 * POST /api/planning/reflect
 * Perform reflection on output
 */
router.post('/reflect', async (req, res) => {
  try {
    const { goal, output, plan = null, context = '' } = req.body;

    if (!goal || !output) {
      return res.status(400).json({
        success: false,
        error: 'Goal and output are required'
      });
    }

    logger.info('🤔 Performing reflection on output');

    const result = await reflectionEngine.reflect({
      goal,
      output,
      plan,
      context
    });

    res.json(result);

  } catch (error) {
    logger.error(`Reflection failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/planning/reflect/multi-pass
 * Perform multi-pass reflection
 */
router.post('/reflect/multi-pass', async (req, res) => {
  try {
    const { goal, output, plan = null, context = '', passes = 2 } = req.body;

    if (!goal || !output) {
      return res.status(400).json({
        success: false,
        error: 'Goal and output are required'
      });
    }

    logger.info(`🤔 Performing ${passes}-pass reflection`);

    const result = await reflectionEngine.multiPassReflection({
      goal,
      output,
      plan,
      context,
      passes
    });

    res.json(result);

  } catch (error) {
    logger.error(`Multi-pass reflection failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Revision Endpoints
// ========================================

/**
 * POST /api/planning/revise
 * Generate revision plan
 */
router.post('/revise', async (req, res) => {
  try {
    const { reflection, originalOutput, plan = null } = req.body;

    if (!reflection || !originalOutput) {
      return res.status(400).json({
        success: false,
        error: 'Reflection and original output are required'
      });
    }

    logger.info('🧭 Routing revisions');

    const result = await revisionRouter.routeRevisions({
      reflection,
      originalOutput,
      plan
    });

    res.json(result);

  } catch (error) {
    logger.error(`Revision routing failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Full Reflection Cycle Endpoint
// ========================================

/**
 * POST /api/planning/execute
 * Execute full V1 → Reflection → V2 → Review cycle
 */
router.post('/execute', async (req, res) => {
  try {
    const { 
      goal, 
      context = '', 
      taskType = 'general',
      constraints = {},
      enablePlanning = true,
      enableReflection = true,
      maxCycles = 3
    } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'Goal is required'
      });
    }

    logger.info(`🎯 Executing full reflection cycle for: ${goal.substring(0, 50)}...`);

    const result = await reflectionOrchestrator.executeWithReflection({
      goal,
      context,
      taskType,
      constraints,
      enablePlanning,
      enableReflection,
      maxCycles
    });

    res.json(result);

  } catch (error) {
    logger.error(`Reflection execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Configuration & Statistics
// ========================================

/**
 * POST /api/planning/configure
 * Configure planning and reflection system
 */
router.post('/configure', async (req, res) => {
  try {
    const { 
      maxRevisionCycles,
      qualityThreshold,
      enableAutoRevision
    } = req.body;

    if (maxRevisionCycles !== undefined) {
      reflectionOrchestrator.configure({ maxRevisionCycles });
    }
    if (qualityThreshold !== undefined) {
      reflectionOrchestrator.configure({ qualityThreshold });
    }
    if (enableAutoRevision !== undefined) {
      reflectionOrchestrator.configure({ enableAutoRevision });
    }

    res.json({
      success: true,
      message: 'Configuration updated'
    });

  } catch (error) {
    logger.error(`Configuration failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/planning/stats
 * Get planning and reflection statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // TODO: Implement statistics tracking
    res.json({
      success: true,
      statistics: {
        totalPlansGenerated: 0,
        totalReflections: 0,
        averageQualityImprovement: 0,
        averageRevisionsPerCycle: 0
      }
    });

  } catch (error) {
    logger.error(`Statistics retrieval failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
