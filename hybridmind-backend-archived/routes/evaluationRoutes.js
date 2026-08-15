/**
 * Evaluation Routes
 * 
 * API endpoints for LLM-as-judge evaluation system
 */

const express = require('express');
const router = express.Router();
const evaluationEngine = require('../services/evaluation/evaluationEngine');
const metricsTracker = require('../services/evaluation/metricsTracker');
const { validateTier } = require('../middleware/tierValidator');
const logger = require('../utils/logger');

/**
 * POST /api/evaluation/component
 * Evaluate component-level output
 */
router.post('/component', validateTier, async (req, res, next) => {
  try {
    const { task, output, agentId, agentRole, model, context } = req.body;

    if (!task || !output) {
      return res.status(400).json({
        error: 'Task and output required'
      });
    }

    const evaluation = await evaluationEngine.evaluateComponent({
      task,
      output,
      agentId,
      agentRole,
      model,
      context
    });

    // Record in metrics tracker
    metricsTracker.recordHallucination({
      evaluationId: evaluation.id,
      detected: evaluation.hallucinationDetected,
      severity: evaluation.scores.hallucination,
      agentRole,
      model,
      details: evaluation.issues
    });

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    logger.error('Component evaluation error:', error);
    next(error);
  }
});

/**
 * POST /api/evaluation/end-to-end
 * Evaluate end-to-end workflow
 */
router.post('/end-to-end', validateTier, async (req, res, next) => {
  try {
    const { task, workflow, finalOutput, agents, duration, context } = req.body;

    if (!task || !finalOutput) {
      return res.status(400).json({
        error: 'Task and final output required'
      });
    }

    const evaluation = await evaluationEngine.evaluateEndToEnd({
      task,
      workflow,
      finalOutput,
      agents,
      duration,
      context
    });

    // Record in metrics tracker
    metricsTracker.recordHallucination({
      evaluationId: evaluation.id,
      detected: evaluation.hallucinationDetected,
      severity: evaluation.scores.hallucination,
      agentRole: 'e2e',
      model: workflow.model,
      details: evaluation.issues
    });

    if (evaluation.roi) {
      metricsTracker.recordROI({
        workflowId: workflow.id,
        roi: evaluation.roi.value,
        valueGenerated: evaluation.roi.valueGenerated,
        costIncurred: evaluation.roi.totalCost,
        breakdown: evaluation.roi.breakdown
      });
    }

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    logger.error('E2E evaluation error:', error);
    next(error);
  }
});

/**
 * GET /api/evaluation/:id
 * Get evaluation by ID
 */
router.get('/:id', validateTier, (req, res) => {
  const evaluation = evaluationEngine.getEvaluation(req.params.id);

  if (!evaluation) {
    return res.status(404).json({
      error: 'Evaluation not found'
    });
  }

  res.json({
    success: true,
    evaluation
  });
});

/**
 * GET /api/evaluation
 * Get all evaluations with filters
 */
router.get('/', validateTier, (req, res) => {
  const filters = {
    type: req.query.type,
    agentRole: req.query.agentRole,
    minScore: req.query.minScore ? parseFloat(req.query.minScore) : undefined,
    hallucinationDetected: req.query.hallucinationDetected === 'true'
  };

  const evaluations = evaluationEngine.getAllEvaluations(filters);

  res.json({
    success: true,
    count: evaluations.length,
    evaluations
  });
});

/**
 * GET /api/evaluation/metrics
 * Get evaluation metrics
 */
router.get('/metrics', validateTier, (req, res) => {
  const metrics = evaluationEngine.getMetrics();

  res.json({
    success: true,
    metrics
  });
});

module.exports = router;
