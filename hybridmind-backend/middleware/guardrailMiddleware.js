/**
 * HybridMind Guardrail Middleware
 * 
 * Middleware that intercepts actions and enforces guardrails
 * before execution based on tier and action type.
 */

const guardrailEngine = require('../services/guardrails/guardrailEngine');
const approvalWorkflow = require('../services/guardrails/approvalWorkflow');
const logger = require('../utils/logger');

/**
 * Derive action type from the request method and path.
 * Never trust client-supplied actionType — derive it server-side.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function deriveActionType(req) {
  const method = String(req.method || '').toUpperCase();
  const p = req.path || '/';

  if (method === 'DELETE') return 'delete_file';
  if (method === 'GET' && p.startsWith('/mcp/filesystem/')) return 'read_file';
  if (method === 'POST' && p.startsWith('/mcp/filesystem/')) return 'edit_file';
  if (method === 'POST' && p.startsWith('/mcp/terminal/')) return 'terminal_execute';
  if (method === 'POST' && p.startsWith('/mcp/web-search/')) return 'search_web';
  if (method === 'POST' && (p === '/run' || p.startsWith('/run/'))) return 'generate_code';
  if (method === 'POST' && (p === '/agent' || p.startsWith('/agent/'))) return 'generate_code';
  return 'generate_code';
}

/**
 * Guardrail middleware for action enforcement
 * Checks if action requires approval before proceeding
 */
async function enforceGuardrails(req, res, next) {
  try {
    // Extract action details from request
    const actionType = deriveActionType(req);
    const tier = req.tier || req.user?.tier || 'free';
    const userId = req.user?.id || req.ip;

    // Skip guardrails for safe routes
    if (req.path.startsWith('/api/guardrails')) {
      return next();
    }

    // Evaluate action
    const evaluation = await guardrailEngine.evaluateAction({
      actionType,
      tier,
      userId,
      details: req.body.details || {},
      context: {
        path: req.path,
        method: req.method,
        ip: req.ip
      }
    });

    // If auto-approved, continue
    if (!evaluation.requiresApproval) {
      logger.info('Action auto-approved by guardrails:', {
        actionType,
        tier,
        userId
      });
      req.guardrailResult = evaluation;
      return next();
    }

    // If requires approval, return pending status
    logger.info('Action requires approval:', {
      actionType,
      tier,
      userId,
      approvalId: evaluation.approvalId
    });

    return res.status(202).json({
      success: false,
      requiresApproval: true,
      approvalId: evaluation.approvalId,
      message: evaluation.message,
      timeout: evaluation.timeout,
      riskLevel: evaluation.riskLevel,
      nextSteps: {
        approve: `POST /api/guardrails/approve/${evaluation.approvalId}`,
        deny: `POST /api/guardrails/deny/${evaluation.approvalId}`,
        status: `GET /api/guardrails/pending/${evaluation.approvalId}`
      }
    });
  } catch (error) {
    logger.error('Guardrail middleware error:', error);
    next(error);
  }
}

/**
 * Optional middleware: Only apply guardrails to specific routes
 * Usage: router.use('/dangerous', applyGuardrails(['delete_file', 'terminal_execute']))
 */
function applyGuardrails(actionTypes = []) {
  return async (req, res, next) => {
    const actionType = deriveActionType(req);
    const tier = req.tier || req.user?.tier || 'free';
    const userId = req.user?.id || req.ip;

    // If actionTypes specified, only apply to those
    if (actionTypes.length > 0 && !actionTypes.includes(actionType)) {
      return next();
    }

    return enforceGuardrails(req, res, next);
  };
}

/**
 * Middleware: Wait for approval before proceeding
 * Only use this for synchronous approval flows
 */
async function waitForApproval(req, res, next) {
  try {
    const actionType = deriveActionType(req);
    const tier = req.tier || req.user?.tier || 'free';
    const userId = req.user?.id || req.ip;

    if (!actionType) {
      return next();
    }

    // Request approval and wait
    const result = await approvalWorkflow.requestApproval({
      actionType,
      tier,
      userId,
      details: req.body.details || {},
      context: {
        path: req.path,
        method: req.method
      }
    });

    // If auto-approved, continue
    if (result.autoApproved && result.approved) {
      req.guardrailResult = result;
      return next();
    }

    // If approved by user, continue
    if (result.approved) {
      req.guardrailResult = result;
      return next();
    }

    // If denied or timed out, block
    return res.status(403).json({
      success: false,
      error: 'Action denied by guardrails',
      reason: result.deniedReason || 'Approval denied',
      timedOut: result.timedOut || false
    });
  } catch (error) {
    logger.error('Wait for approval error:', error);
    next(error);
  }
}

/**
 * Middleware: Check tier autonomy level
 * Ensures request tier has proper autonomy configuration
 */
function checkTierAutonomy(req, res, next) {
  const tier = req.tier || req.user?.tier || 'free';
  const { getTierAutonomyConfig } = require('../config/actionRiskLevels');

  const autonomyConfig = getTierAutonomyConfig(tier);
  req.autonomyConfig = autonomyConfig;

  logger.debug('Tier autonomy check:', {
    tier,
    autonomyLevel: autonomyConfig.name
  });

  next();
}

/**
 * Middleware: Log all guarded actions
 * Adds guardrail logging to request lifecycle
 */
function logGuardedAction(req, res, next) {
  const actionType = deriveActionType(req);

  if (!actionType) {
    return next();
  }

  const tier = req.tier || req.user?.tier || 'free';
  const userId = req.user?.id || req.ip;

  logger.info('Guarded action initiated:', {
    actionType,
    tier,
    userId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Log response
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    logger.info('Guarded action completed:', {
      actionType,
      tier,
      userId,
      success: data.success !== false,
      status: res.statusCode
    });
    return originalJson(data);
  };

  next();
}

/**
 * WebSocket event handler for real-time approval notifications
 */
function setupApprovalEvents(io) {
  approvalWorkflow.on('approvalRequired', data => {
    logger.info('Emitting approval required event:', data.approvalId);
    io.to(data.userId).emit('approval:required', {
      approvalId: data.approvalId,
      actionType: data.actionType,
      tier: data.tier,
      details: data.details,
      timeout: data.timeout,
      message: data.evaluation.message
    });
  });

  approvalWorkflow.on('actionApproved', data => {
    logger.info('Emitting action approved event:', data.approvalId);
    io.to(data.userId).emit('approval:granted', {
      approvalId: data.approvalId,
      actionType: data.actionType
    });
  });

  approvalWorkflow.on('actionDenied', data => {
    logger.info('Emitting action denied event:', data.approvalId);
    io.to(data.userId).emit('approval:denied', {
      approvalId: data.approvalId,
      actionType: data.actionType,
      reason: data.reason
    });
  });

  approvalWorkflow.on('actionTimedOut', data => {
    logger.info('Emitting action timed out event:', data.approvalId);
    io.to(data.userId).emit('approval:timeout', {
      approvalId: data.approvalId,
      actionType: data.actionType
    });
  });
}

module.exports = {
  enforceGuardrails,
  applyGuardrails,
  waitForApproval,
  checkTierAutonomy,
  logGuardedAction,
  setupApprovalEvents
};
