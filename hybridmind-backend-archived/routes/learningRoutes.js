/**
 * Learning Routes
 * 
 * API endpoints for adaptive learning system
 */

const express = require('express');
const router = express.Router();
const learningEngine = require('../services/learning/learningEngine');
const { validateTier } = require('../middleware/tierValidator');
const logger = require('../utils/logger');

/**
 * POST /api/learning/feedback
 * Submit user feedback
 */
router.post('/feedback', validateTier, (req, res) => {
  try {
    const { userId, workflowId, evaluationId, feedbackType, rating, comment, corrections, context } = req.body;

    if (!userId || !feedbackType) {
      return res.status(400).json({
        error: 'userId and feedbackType required'
      });
    }

    const feedbackId = learningEngine.recordFeedback({
      userId,
      workflowId,
      evaluationId,
      feedbackType,
      rating,
      comment,
      corrections,
      context
    });

    res.json({
      success: true,
      feedbackId
    });

  } catch (error) {
    logger.error('Feedback recording error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/learning/recommendations
 * Get recommendations based on learned patterns
 */
router.get('/recommendations', validateTier, (req, res) => {
  try {
    const context = {
      taskType: req.query.taskType,
      complexity: req.query.complexity,
      budget: req.query.budget ? parseFloat(req.query.budget) : undefined,
      costTarget: req.query.costTarget ? parseFloat(req.query.costTarget) : undefined
    };

    const recommendations = learningEngine.generateRecommendations(context);

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });

  } catch (error) {
    logger.error('Recommendations generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/learning/recommendations/:id/apply
 * Mark recommendation as applied
 */
router.post('/recommendations/:id/apply', validateTier, (req, res) => {
  try {
    const { result } = req.body;

    learningEngine.applyRecommendation(req.params.id, result);

    res.json({
      success: true,
      message: 'Recommendation marked as applied'
    });

  } catch (error) {
    logger.error('Apply recommendation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/learning/patterns
 * Get learned patterns
 */
router.get('/patterns', validateTier, (req, res) => {
  const patterns = learningEngine.getPatterns();

  res.json({
    success: true,
    patterns
  });
});

/**
 * GET /api/learning/feedback
 * Get feedback history
 */
router.get('/feedback', validateTier, (req, res) => {
  const filters = {
    userId: req.query.userId,
    feedbackType: req.query.feedbackType,
    minRating: req.query.minRating ? parseFloat(req.query.minRating) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit) : 100
  };

  const feedback = learningEngine.getFeedbackHistory(filters);

  res.json({
    success: true,
    count: feedback.length,
    feedback
  });
});

/**
 * GET /api/learning/metrics
 * Get learning metrics
 */
router.get('/metrics', validateTier, (req, res) => {
  const metrics = learningEngine.getMetrics();

  res.json({
    success: true,
    metrics
  });
});

/**
 * GET /api/learning/export
 * Export learning data
 */
router.get('/export', validateTier, (req, res) => {
  const data = learningEngine.exportLearningData();

  res.json({
    success: true,
    data
  });
});

module.exports = router;
