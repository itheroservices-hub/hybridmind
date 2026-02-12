/**
 * Metrics Routes
 * 
 * API endpoints for metrics tracking with zoom-in/zoom-out capabilities
 */

const express = require('express');
const router = express.Router();
const metricsTracker = require('../services/evaluation/metricsTracker');
const { validateTier } = require('../middleware/tierValidator');
const logger = require('../utils/logger');

/**
 * POST /api/metrics/workflow
 * Record workflow execution
 */
router.post('/workflow', validateTier, (req, res) => {
  try {
    const { workflowId, success, duration, agents, model, tokens, cost, evaluation, error } = req.body;

    const traceId = metricsTracker.recordWorkflowExecution({
      workflowId,
      success,
      duration,
      agents,
      model,
      tokens,
      cost,
      evaluation,
      error
    });

    res.json({
      success: true,
      traceId
    });

  } catch (error) {
    logger.error('Workflow metrics recording error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics
 * Get overall metrics (zoom-out)
 */
router.get('/', validateTier, (req, res) => {
  const metrics = metricsTracker.getMetrics();

  res.json({
    success: true,
    metrics
  });
});

/**
 * GET /api/metrics/traces
 * Get detailed traces (zoom-in)
 */
router.get('/traces', validateTier, (req, res) => {
  const filters = {
    type: req.query.type,
    level: req.query.level,
    traceId: req.query.traceId,
    startTime: req.query.startTime ? new Date(req.query.startTime) : undefined,
    endTime: req.query.endTime ? new Date(req.query.endTime) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit) : 100
  };

  const traces = metricsTracker.getTraces(filters);

  res.json({
    success: true,
    count: traces.length,
    traces
  });
});

/**
 * GET /api/metrics/trends
 * Get trend analysis (zoom-out)
 */
router.get('/trends', validateTier, (req, res) => {
  const window = req.query.window || 'DAY';
  const trend = metricsTracker.getTrends(window);

  res.json({
    success: true,
    trend
  });
});

/**
 * GET /api/metrics/analytics
 * Get detailed analytics with insights
 */
router.get('/analytics', validateTier, (req, res) => {
  const timeWindow = req.query.window || 'DAY';
  const analytics = metricsTracker.getAnalytics(timeWindow);

  res.json({
    success: true,
    analytics
  });
});

/**
 * GET /api/metrics/export
 * Export metrics data
 */
router.get('/export', validateTier, (req, res) => {
  const format = req.query.format || 'json';
  const data = metricsTracker.exportMetrics(format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
    res.send(data);
  } else {
    res.json({
      success: true,
      data
    });
  }
});

/**
 * POST /api/metrics/clear
 * Clear old traces
 */
router.post('/clear', validateTier, (req, res) => {
  const olderThan = req.body.olderThan || 86400000; // 24 hours default
  const cleared = metricsTracker.clearOldTraces(olderThan);

  res.json({
    success: true,
    cleared
  });
});

module.exports = router;
