/**
 * HybridMind Guardrail System - REST API Routes
 * 
 * Endpoints for action evaluation, approval workflows, and guardrail management.
 */

const express = require('express');
const router = express.Router();
const guardrailEngine = require('../services/guardrails/guardrailEngine');
const approvalWorkflow = require('../services/guardrails/approvalWorkflow');
const {
  getTierAutonomyConfig,
  TIER_AUTONOMY_CONFIG,
  ACTION_RISK_LEVELS,
  RISK_LEVELS
} = require('../config/actionRiskLevels');
const logger = require('../utils/logger');

/**
 * GET /api/guardrails/config
 * Get guardrail configuration for all tiers
 */
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      tiers: TIER_AUTONOMY_CONFIG,
      riskLevels: RISK_LEVELS,
      actionRiskLevels: ACTION_RISK_LEVELS
    });
  } catch (error) {
    logger.error('Error fetching guardrail config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/config/:tier
 * Get guardrail configuration for specific tier
 */
router.get('/config/:tier', (req, res) => {
  try {
    const { tier } = req.params;
    const config = getTierAutonomyConfig(tier);

    res.json({
      success: true,
      tier,
      config
    });
  } catch (error) {
    logger.error('Error fetching tier config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/evaluate
 * Evaluate if an action requires approval
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { actionType, tier, userId, details, context, skipApproval } =
      req.body;

    if (!actionType || !tier || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: actionType, tier, userId'
      });
    }

    const evaluation = await guardrailEngine.evaluateAction({
      actionType,
      tier,
      userId,
      details: details || {},
      context: context || {},
      skipApproval: skipApproval || false
    });

    res.json({
      success: true,
      evaluation
    });
  } catch (error) {
    logger.error('Error evaluating action:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/request-approval
 * Request approval for an action (creates workflow)
 */
router.post('/request-approval', async (req, res) => {
  try {
    const { actionType, tier, userId, details, context, timeout } = req.body;

    if (!actionType || !tier || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: actionType, tier, userId'
      });
    }

    const result = await approvalWorkflow.requestApproval({
      actionType,
      tier,
      userId,
      details: details || {},
      context: context || {},
      timeout
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error requesting approval:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/approve/:approvalId
 * Approve a pending action
 */
router.post('/approve/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { approvedBy } = req.body;

    const result = await approvalWorkflow.approve(
      approvalId,
      approvedBy || 'user'
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      message: 'Action approved',
      approvalId
    });
  } catch (error) {
    logger.error('Error approving action:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/deny/:approvalId
 * Deny a pending action
 */
router.post('/deny/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { reason } = req.body;

    const result = await approvalWorkflow.deny(
      approvalId,
      reason || 'User denied'
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      message: 'Action denied',
      approvalId,
      reason
    });
  } catch (error) {
    logger.error('Error denying action:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/pending
 * Get all pending approvals (optionally filtered by userId)
 */
router.get('/pending', (req, res) => {
  try {
    const { userId } = req.query;

    const pending = userId
      ? guardrailEngine.getPendingApprovals(userId)
      : Array.from(guardrailEngine.pendingApprovals.values()).filter(
          a => a.status === 'pending'
        );

    res.json({
      success: true,
      count: pending.length,
      pending
    });
  } catch (error) {
    logger.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/pending/:approvalId
 * Get specific pending approval
 */
router.get('/pending/:approvalId', (req, res) => {
  try {
    const { approvalId } = req.params;
    const approval = guardrailEngine.getApproval(approvalId);

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
    }

    res.json({
      success: true,
      approval
    });
  } catch (error) {
    logger.error('Error fetching approval:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/history
 * Get approval history (optionally filtered by userId)
 */
router.get('/history', (req, res) => {
  try {
    const { userId, limit } = req.query;
    const history = guardrailEngine.getApprovalHistory(
      userId,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    logger.error('Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/statistics
 * Get guardrail system statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = guardrailEngine.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/workflows/active
 * Get active approval workflows (optionally filtered by userId)
 */
router.get('/workflows/active', (req, res) => {
  try {
    const { userId } = req.query;
    const workflows = approvalWorkflow.getActiveWorkflows(userId);

    res.json({
      success: true,
      count: workflows.length,
      workflows
    });
  } catch (error) {
    logger.error('Error fetching active workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/workflows/statistics
 * Get workflow system statistics
 */
router.get('/workflows/statistics', (req, res) => {
  try {
    const stats = approvalWorkflow.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error('Error fetching workflow statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/batch/evaluate
 * Batch evaluate multiple actions
 */
router.post('/batch/evaluate', async (req, res) => {
  try {
    const { actions, tier, userId } = req.body;

    if (!actions || !Array.isArray(actions) || !tier || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: actions (array), tier, userId'
      });
    }

    const result = await guardrailEngine.bulkEvaluateActions(
      actions,
      tier,
      userId
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error batch evaluating actions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/batch/request-approval
 * Batch request approvals for multiple actions
 */
router.post('/batch/request-approval', async (req, res) => {
  try {
    const { actions, tier, userId, context } = req.body;

    if (!actions || !Array.isArray(actions) || !tier || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: actions (array), tier, userId'
      });
    }

    const result = await approvalWorkflow.requestBatchApproval({
      actions,
      tier,
      userId,
      context: context || {}
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error batch requesting approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/batch/approve
 * Batch approve multiple pending actions
 */
router.post('/batch/approve', async (req, res) => {
  try {
    const { approvalIds, approvedBy } = req.body;

    if (!approvalIds || !Array.isArray(approvalIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: approvalIds (array)'
      });
    }

    const result = await approvalWorkflow.approveBatch(
      approvalIds,
      approvedBy || 'user'
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error batch approving actions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/guardrails/prompt/:approvalId
 * Get formatted approval prompt for UI
 */
router.get('/prompt/:approvalId', (req, res) => {
  try {
    const { approvalId } = req.params;
    const prompt = approvalWorkflow.createApprovalPrompt(approvalId);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Approval workflow not found'
      });
    }

    res.json({
      success: true,
      prompt
    });
  } catch (error) {
    logger.error('Error creating approval prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/guardrails/pending/:approvalId
 * Cancel a pending approval (same as deny)
 */
router.delete('/pending/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params;

    const result = await approvalWorkflow.deny(approvalId, 'Cancelled by user');

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      message: 'Approval cancelled',
      approvalId
    });
  } catch (error) {
    logger.error('Error cancelling approval:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/guardrails/test
 * Test guardrail system with sample action
 */
router.post('/test', async (req, res) => {
  try {
    const {
      actionType = 'edit_file',
      tier = 'free',
      userId = 'test-user'
    } = req.body;

    const evaluation = await guardrailEngine.evaluateAction({
      actionType,
      tier,
      userId,
      details: {
        filePath: '/test/file.js',
        description: 'Test action'
      }
    });

    res.json({
      success: true,
      message: 'Test evaluation complete',
      evaluation,
      note: 'This is a test evaluation and does not affect the system'
    });
  } catch (error) {
    logger.error('Error testing guardrails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
