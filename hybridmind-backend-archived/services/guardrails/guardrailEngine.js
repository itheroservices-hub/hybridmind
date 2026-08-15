/**
 * HybridMind Multi-Tiered Guardrail Engine
 * 
 * Core engine that evaluates actions and determines if approval is required
 * based on user tier, action risk level, and context.
 * 
 * Implements stop-and-ask checkpoints for sensitive actions.
 */

const {
  RISK_LEVELS,
  getActionRiskLevel,
  requiresApproval,
  isSensitiveAction,
  getApprovalTimeout,
  canOverride,
  getTierAutonomyConfig
} = require('../../config/actionRiskLevels');
const logger = require('../../utils/logger');
const guardrailLogger = require('./guardrailLogger');

class GuardrailEngine {
  constructor() {
    // In-memory approval queue (use Redis in production)
    this.pendingApprovals = new Map();
    this.approvalHistory = [];
    this.statistics = {
      totalEvaluations: 0,
      approvalRequests: 0,
      autoApproved: 0,
      userApproved: 0,
      denied: 0,
      overridden: 0,
      timedOut: 0,
      byTier: {},
      byRiskLevel: {},
      byActionType: {}
    };
  }

  /**
   * Evaluate if an action should be allowed
   * Returns: { allowed: boolean, requiresApproval: boolean, reason: string, approvalId?: string }
   */
  async evaluateAction({
    actionType,
    tier,
    userId,
    details = {},
    context = {},
    skipApproval = false // For emergency override
  }) {
    this.statistics.totalEvaluations++;
    this._updateStats('byTier', tier);
    this._updateStats('byActionType', actionType);

    const riskLevel = getActionRiskLevel(actionType);
    this._updateStats('byRiskLevel', riskLevel);

    const tierConfig = getTierAutonomyConfig(tier);

    logger.info('Guardrail evaluation:', {
      actionType,
      tier,
      riskLevel,
      userId
    });

    // 1. Check if action type is recognized
    if (riskLevel === RISK_LEVELS.CRITICAL && !actionType.startsWith('database_')) {
      // Unknown actions default to CRITICAL
      logger.warn(`Unknown action type defaulting to CRITICAL: ${actionType}`);
    }

    // 2. Check if tier allows auto-approval for this risk level
    const needsApproval = requiresApproval(actionType, tier);

    if (!needsApproval) {
      // Auto-approved based on tier
      this.statistics.autoApproved++;
      logger.info(`Action auto-approved for ${tier} tier:`, {
        actionType,
        riskLevel
      });

      // Log to guardrail logger
      guardrailLogger.logActionEvaluation({
        actionType,
        tier,
        userId,
        riskLevel,
        requiresApproval: false,
        autoApproved: true,
        details
      });

      return {
        allowed: true,
        requiresApproval: false,
        reason: `Auto-approved: ${tierConfig.name} tier allows ${riskLevel} risk actions`,
        riskLevel,
        tier
      };
    }

    // 3. Check for sensitive patterns (elevates risk)
    const isSensitive = isSensitiveAction(actionType, details);
    if (isSensitive) {
      logger.warn('Sensitive action detected:', {
        actionType,
        details
      });
    }

    // 4. Check rate limits for tier
    const rateLimitResult = this._checkRateLimits(userId, tier, tierConfig);
    if (!rateLimitResult.allowed) {
      this.statistics.denied++;
      return {
        allowed: false,
        requiresApproval: false,
        reason: rateLimitResult.reason,
        riskLevel,
        tier
      };
    }

    // 5. Check for emergency override (Pro-Plus and Enterprise only)
    if (skipApproval && canOverride(tier, riskLevel)) {
      this.statistics.overridden++;
      logger.warn('Guardrail overridden:', {
        actionType,
        tier,
        riskLevel,
        userId
      });

      return {
        allowed: true,
        requiresApproval: false,
        reason: 'Override granted by tier privileges',
        overridden: true,
        riskLevel,
        tier
      };
    }

    // 6. Requires approval - create approval request
    this.statistics.approvalRequests++;
    const approvalId = this._createApprovalRequest({
      actionType,
      tier,
      userId,
      riskLevel,
      details,
      context,
      isSensitive
    });

    // Log to guardrail logger
    guardrailLogger.logActionEvaluation({
      actionType,
      tier,
      userId,
      riskLevel,
      requiresApproval: true,
      autoApproved: false,
      approvalId,
      details
    });

    return {
      allowed: false,
      requiresApproval: true,
      reason: `Approval required: ${riskLevel} risk action for ${tier} tier`,
      approvalId,
      timeout: getApprovalTimeout(actionType),
      riskLevel,
      tier,
      message: this._generateApprovalMessage(actionType, riskLevel, details)
    };
  }

  /**
   * Create a pending approval request
   */
  _createApprovalRequest({
    actionType,
    tier,
    userId,
    riskLevel,
    details,
    context,
    isSensitive
  }) {
    const approvalId = `approval_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const timeout = getApprovalTimeout(actionType);
    const expiresAt = Date.now() + timeout * 1000;

    const approval = {
      id: approvalId,
      actionType,
      tier,
      userId,
      riskLevel,
      details,
      context,
      isSensitive,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      timeout
    };

    this.pendingApprovals.set(approvalId, approval);

    // Auto-deny after timeout
    setTimeout(() => {
      const current = this.pendingApprovals.get(approvalId);
      if (current && current.status === 'pending') {
        this.denyApproval(approvalId, 'Timed out');
        this.statistics.timedOut++;
      }
    }, timeout * 1000);

    logger.info('Approval request created:', {
      approvalId,
      actionType,
      timeout: `${timeout}s`
    });

    return approvalId;
  }

  /**
   * Grant approval for a pending request
   */
  approveAction(approvalId, approvedBy = 'user') {
    const approval = this.pendingApprovals.get(approvalId);

    if (!approval) {
      return {
        success: false,
        error: 'Approval request not found or expired'
      };
    }

    if (approval.status !== 'pending') {
      return {
        success: false,
        error: `Approval already ${approval.status}`
      };
    }

    // Check if expired
    if (new Date() > new Date(approval.expiresAt)) {
      this.denyApproval(approvalId, 'Expired');
      return {
        success: false,
        error: 'Approval request expired'
      };
    }

    approval.status = 'approved';
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date().toISOString();

    this.statistics.userApproved++;
    this._archiveApproval(approval);

    // Log approval decision
    guardrailLogger.logApprovalDecision({
      approvalId,
      actionType: approval.actionType,
      tier: approval.tier,
      userId: approval.userId,
      decision: 'approved',
      approvedBy
    });

    logger.info('Action approved:', {
      approvalId,
      actionType: approval.actionType,
      approvedBy
    });

    return {
      success: true,
      approval
    };
  }

  /**
   * Deny approval for a pending request
   */
  denyApproval(approvalId, reason = 'User denied') {
    const approval = this.pendingApprovals.get(approvalId);

    if (!approval) {
      return {
        success: false,
        error: 'Approval request not found'
      };
    }

    approval.status = 'denied';
    approval.deniedReason = reason;
    approval.deniedAt = new Date().toISOString();

    this.statistics.denied++;
    this._archiveApproval(approval);

    // Log denial decision
    guardrailLogger.logApprovalDecision({
      approvalId,
      actionType: approval.actionType,
      tier: approval.tier,
      userId: approval.userId,
      decision: 'denied',
      reason
    });

    logger.info('Action denied:', {
      approvalId,
      actionType: approval.actionType,
      reason
    });

    return {
      success: true,
      approval
    };
  }

  /**
   * Get pending approval by ID
   */
  getApproval(approvalId) {
    return this.pendingApprovals.get(approvalId);
  }

  /**
   * Get all pending approvals for a user
   */
  getPendingApprovals(userId) {
    const pending = [];
    for (const [id, approval] of this.pendingApprovals.entries()) {
      if (approval.userId === userId && approval.status === 'pending') {
        pending.push(approval);
      }
    }
    return pending;
  }

  /**
   * Get approval history
   */
  getApprovalHistory(userId, limit = 50) {
    return this.approvalHistory
      .filter(a => (userId ? a.userId === userId : true))
      .slice(-limit)
      .reverse();
  }

  /**
   * Check rate limits for user/tier
   */
  _checkRateLimits(userId, tier, tierConfig) {
    // This is a simplified version - in production, use Redis with sliding windows
    const now = Date.now();
    const hourAgo = now - 3600 * 1000;
    const dayAgo = now - 24 * 3600 * 1000;

    const recentApprovals = this.approvalHistory.filter(
      a => a.userId === userId && new Date(a.createdAt).getTime() > dayAgo
    );

    const hourlyCount = recentApprovals.filter(
      a => new Date(a.createdAt).getTime() > hourAgo
    ).length;

    const dailyCount = recentApprovals.length;

    if (hourlyCount >= tierConfig.maxActionsPerHour) {
      return {
        allowed: false,
        reason: `Hourly action limit exceeded (${tierConfig.maxActionsPerHour} for ${tier} tier)`
      };
    }

    if (dailyCount >= tierConfig.maxActionsPerDay) {
      return {
        allowed: false,
        reason: `Daily action limit exceeded (${tierConfig.maxActionsPerDay} for ${tier} tier)`
      };
    }

    return { allowed: true };
  }

  /**
   * Archive completed approval to history
   */
  _archiveApproval(approval) {
    this.pendingApprovals.delete(approval.id);
    this.approvalHistory.push(approval);

    // Keep only last 1000 approvals in memory
    if (this.approvalHistory.length > 1000) {
      this.approvalHistory.shift();
    }
  }

  /**
   * Update statistics
   */
  _updateStats(category, key) {
    if (!this.statistics[category]) {
      this.statistics[category] = {};
    }
    this.statistics[category][key] =
      (this.statistics[category][key] || 0) + 1;
  }

  /**
   * Generate user-friendly approval message
   */
  _generateApprovalMessage(actionType, riskLevel, details) {
    const messages = {
      delete_file: `Delete file: ${details.filePath || 'unknown'}`,
      delete_directory: `Delete directory: ${details.dirPath || 'unknown'}`,
      terminal_execute: `Execute command: ${details.command || 'unknown'}`,
      database_delete: `Delete database records: ${details.query || 'unknown'}`,
      database_drop: `DROP DATABASE/TABLE: ${details.query || 'unknown'}`,
      database_truncate: `TRUNCATE table: ${details.query || 'unknown'}`,
      package_remove: `Uninstall package: ${details.package || 'unknown'}`,
      modify_dependencies: `Modify dependencies in package.json`,
      git_force_push: `Force push to Git repository`,
      production_deployment: `Deploy to production environment`,
      system_command: `Execute system command: ${details.command || 'unknown'}`,
      environment_modify: `Modify environment variables`,
      security_config_change: `Change security configuration`,
      api_key_change: `Modify API keys or credentials`
    };

    return (
      messages[actionType] ||
      `Execute ${actionType} (${riskLevel} risk)${
        details.description ? `: ${details.description}` : ''
      }`
    );
  }

  /**
   * Get guardrail statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      pendingCount: this.pendingApprovals.size,
      historyCount: this.approvalHistory.length,
      approvalRate:
        this.statistics.approvalRequests > 0
          ? (
              (this.statistics.userApproved /
                this.statistics.approvalRequests) *
              100
            ).toFixed(2) + '%'
          : '0%',
      autoApprovalRate:
        this.statistics.totalEvaluations > 0
          ? (
              (this.statistics.autoApproved /
                this.statistics.totalEvaluations) *
              100
            ).toFixed(2) + '%'
          : '0%'
    };
  }

  /**
   * Bulk approve actions (for trusted workflows)
   */
  async bulkEvaluateActions(actions, tier, userId) {
    const results = [];

    for (const action of actions) {
      const result = await this.evaluateAction({
        ...action,
        tier,
        userId
      });
      results.push(result);
    }

    return {
      total: actions.length,
      autoApproved: results.filter(r => !r.requiresApproval).length,
      requiresApproval: results.filter(r => r.requiresApproval).length,
      results
    };
  }

  /**
   * Clear expired approvals (maintenance)
   */
  clearExpiredApprovals() {
    const now = new Date();
    let cleared = 0;

    for (const [id, approval] of this.pendingApprovals.entries()) {
      if (
        approval.status === 'pending' &&
        new Date(approval.expiresAt) < now
      ) {
        this.denyApproval(id, 'Expired (cleanup)');
        cleared++;
      }
    }

    logger.info(`Cleared ${cleared} expired approvals`);
    return cleared;
  }
}

// Singleton instance
const guardrailEngine = new GuardrailEngine();

// Run cleanup every hour
setInterval(() => {
  guardrailEngine.clearExpiredApprovals();
}, 3600 * 1000);

module.exports = guardrailEngine;
