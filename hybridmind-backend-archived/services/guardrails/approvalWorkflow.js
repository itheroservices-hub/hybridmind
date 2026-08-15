/**
 * HybridMind Approval Workflow System
 * 
 * Manages stop-and-ask checkpoints for sensitive actions.
 * Handles user prompts, approval routing, and timeout management.
 */

const guardrailEngine = require('./guardrailEngine');
const logger = require('../../utils/logger');
const EventEmitter = require('events');

class ApprovalWorkflow extends EventEmitter {
  constructor() {
    super();
    this.activeWorkflows = new Map();
    this.approvalCallbacks = new Map();
  }

  /**
   * Request approval for an action
   * Returns a promise that resolves when user approves/denies
   */
  async requestApproval({
    actionType,
    tier,
    userId,
    details = {},
    context = {},
    timeout = null
  }) {
    // Evaluate action with guardrail engine
    const evaluation = await guardrailEngine.evaluateAction({
      actionType,
      tier,
      userId,
      details,
      context
    });

    // If auto-approved, return immediately
    if (!evaluation.requiresApproval) {
      logger.info('Action auto-approved:', { actionType, tier });
      return {
        approved: evaluation.allowed,
        reason: evaluation.reason,
        autoApproved: true
      };
    }

    // Create approval workflow
    const approvalId = evaluation.approvalId;
    const workflowTimeout = timeout || evaluation.timeout;

    logger.info('Creating approval workflow:', {
      approvalId,
      actionType,
      tier,
      timeout: workflowTimeout
    });

    // Create promise that resolves when user responds
    const approvalPromise = new Promise((resolve, reject) => {
      // Store callback
      this.approvalCallbacks.set(approvalId, { resolve, reject });

      // Set timeout
      const timeoutId = setTimeout(() => {
        this._handleTimeout(approvalId);
      }, workflowTimeout * 1000);

      // Store workflow state
      this.activeWorkflows.set(approvalId, {
        id: approvalId,
        actionType,
        tier,
        userId,
        details,
        context,
        evaluation,
        timeoutId,
        createdAt: Date.now()
      });

      // Emit event for clients to listen to
      this.emit('approvalRequired', {
        approvalId,
        actionType,
        tier,
        userId,
        details,
        evaluation,
        timeout: workflowTimeout
      });
    });

    return approvalPromise;
  }

  /**
   * User approves an action
   */
  async approve(approvalId, approvedBy = 'user') {
    const workflow = this.activeWorkflows.get(approvalId);
    if (!workflow) {
      return {
        success: false,
        error: 'Workflow not found or already completed'
      };
    }

    // Approve in guardrail engine
    const result = guardrailEngine.approveAction(approvalId, approvedBy);

    if (!result.success) {
      return result;
    }

    // Clear timeout
    clearTimeout(workflow.timeoutId);

    // Resolve promise
    const callback = this.approvalCallbacks.get(approvalId);
    if (callback) {
      callback.resolve({
        approved: true,
        approvalId,
        approvedBy,
        approvedAt: new Date().toISOString()
      });
    }

    // Cleanup
    this._cleanup(approvalId);

    this.emit('actionApproved', {
      approvalId,
      actionType: workflow.actionType,
      approvedBy
    });

    return { success: true };
  }

  /**
   * User denies an action
   */
  async deny(approvalId, reason = 'User denied') {
    const workflow = this.activeWorkflows.get(approvalId);
    if (!workflow) {
      return {
        success: false,
        error: 'Workflow not found or already completed'
      };
    }

    // Deny in guardrail engine
    const result = guardrailEngine.denyApproval(approvalId, reason);

    // Clear timeout
    clearTimeout(workflow.timeoutId);

    // Resolve promise with denial
    const callback = this.approvalCallbacks.get(approvalId);
    if (callback) {
      callback.resolve({
        approved: false,
        approvalId,
        deniedReason: reason,
        deniedAt: new Date().toISOString()
      });
    }

    // Cleanup
    this._cleanup(approvalId);

    this.emit('actionDenied', {
      approvalId,
      actionType: workflow.actionType,
      reason
    });

    return { success: true };
  }

  /**
   * Handle timeout
   */
  _handleTimeout(approvalId) {
    const workflow = this.activeWorkflows.get(approvalId);
    if (!workflow) return;

    logger.warn('Approval workflow timed out:', {
      approvalId,
      actionType: workflow.actionType
    });

    // Deny in guardrail engine
    guardrailEngine.denyApproval(approvalId, 'Timed out');

    // Reject promise
    const callback = this.approvalCallbacks.get(approvalId);
    if (callback) {
      callback.resolve({
        approved: false,
        approvalId,
        deniedReason: 'Timed out',
        timedOut: true,
        deniedAt: new Date().toISOString()
      });
    }

    // Cleanup
    this._cleanup(approvalId);

    this.emit('actionTimedOut', {
      approvalId,
      actionType: workflow.actionType
    });
  }

  /**
   * Cleanup workflow
   */
  _cleanup(approvalId) {
    this.activeWorkflows.delete(approvalId);
    this.approvalCallbacks.delete(approvalId);
  }

  /**
   * Get active workflows for a user
   */
  getActiveWorkflows(userId) {
    const workflows = [];
    for (const [id, workflow] of this.activeWorkflows.entries()) {
      if (!userId || workflow.userId === userId) {
        workflows.push({
          id,
          actionType: workflow.actionType,
          tier: workflow.tier,
          userId: workflow.userId,
          details: workflow.details,
          createdAt: workflow.createdAt,
          expiresAt: workflow.createdAt + workflow.evaluation.timeout * 1000,
          message: workflow.evaluation.message,
          riskLevel: workflow.evaluation.riskLevel
        });
      }
    }
    return workflows;
  }

  /**
   * Batch request approvals for multiple actions
   */
  async requestBatchApproval({
    actions,
    tier,
    userId,
    context = {}
  }) {
    const results = await guardrailEngine.bulkEvaluateActions(
      actions,
      tier,
      userId
    );

    const autoApproved = [];
    const requiresApproval = [];

    for (const result of results.results) {
      if (result.requiresApproval) {
        // Create approval workflows for actions that need approval
        requiresApproval.push({
          approvalId: result.approvalId,
          actionType: result.actionType || actions[results.results.indexOf(result)].actionType,
          message: result.message,
          timeout: result.timeout
        });

        // Store workflow
        this.activeWorkflows.set(result.approvalId, {
          id: result.approvalId,
          actionType: result.actionType || actions[results.results.indexOf(result)].actionType,
          tier,
          userId,
          details: actions[results.results.indexOf(result)].details || {},
          context,
          evaluation: result,
          createdAt: Date.now()
        });
      } else {
        autoApproved.push({
          actionType: actions[results.results.indexOf(result)].actionType,
          allowed: result.allowed,
          reason: result.reason
        });
      }
    }

    return {
      total: actions.length,
      autoApproved,
      requiresApproval,
      batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Approve all pending workflows for a batch
   */
  async approveBatch(batchApprovalIds, approvedBy = 'user') {
    const results = [];

    for (const approvalId of batchApprovalIds) {
      const result = await this.approve(approvalId, approvedBy);
      results.push({ approvalId, ...result });
    }

    return {
      total: batchApprovalIds.length,
      approved: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Create approval prompt data for UI
   */
  createApprovalPrompt(approvalId) {
    const workflow = this.activeWorkflows.get(approvalId);
    if (!workflow) {
      return null;
    }

    const { actionType, details, evaluation, tier } = workflow;

    return {
      id: approvalId,
      title: this._getPromptTitle(actionType),
      message: evaluation.message,
      actionType,
      riskLevel: evaluation.riskLevel,
      tier,
      details: {
        ...details,
        // Sanitize sensitive data
        password: details.password ? '[REDACTED]' : undefined,
        apiKey: details.apiKey ? '[REDACTED]' : undefined,
        token: details.token ? '[REDACTED]' : undefined
      },
      timeout: evaluation.timeout,
      expiresAt: new Date(
        workflow.createdAt + evaluation.timeout * 1000
      ).toISOString(),
      buttons: [
        { label: 'Approve', action: 'approve', style: 'primary' },
        { label: 'Deny', action: 'deny', style: 'danger' },
        {
          label: 'View Details',
          action: 'details',
          style: 'secondary'
        }
      ],
      warnings: this._getWarnings(actionType, evaluation.riskLevel)
    };
  }

  /**
   * Get prompt title based on action type
   */
  _getPromptTitle(actionType) {
    const titles = {
      delete_file: '🗑️ Delete File',
      delete_directory: '🗑️ Delete Directory',
      terminal_execute: '⚡ Execute Terminal Command',
      database_delete: '🗄️ Delete Database Records',
      database_drop: '⚠️ DROP Table/Database',
      database_truncate: '⚠️ TRUNCATE Table',
      package_remove: '📦 Uninstall Package',
      modify_dependencies: '📦 Modify Dependencies',
      git_force_push: '🔀 Force Push to Git',
      production_deployment: '🚀 Production Deployment',
      system_command: '💻 System Command',
      environment_modify: '🔐 Modify Environment',
      security_config_change: '🔒 Security Configuration',
      api_key_change: '🔑 API Key Change'
    };

    return titles[actionType] || `⚠️ ${actionType}`;
  }

  /**
   * Get warnings for action
   */
  _getWarnings(actionType, riskLevel) {
    const warnings = [];

    if (riskLevel === 'critical') {
      warnings.push('⚠️ CRITICAL: This action cannot be undone');
      warnings.push('⚠️ May cause data loss or system instability');
    } else if (riskLevel === 'high') {
      warnings.push('⚠️ HIGH RISK: Use with caution');
      warnings.push('⚠️ May be difficult to reverse');
    } else if (riskLevel === 'moderate') {
      warnings.push('⚠️ MODERATE RISK: Review carefully');
    }

    // Action-specific warnings
    if (actionType.includes('delete')) {
      warnings.push('🗑️ Files/data will be permanently deleted');
    }
    if (actionType.includes('production')) {
      warnings.push('🚀 Will affect production environment');
    }
    if (actionType.includes('security') || actionType.includes('api_key')) {
      warnings.push('🔒 Security-sensitive operation');
    }

    return warnings;
  }

  /**
   * Get workflow statistics
   */
  getStatistics() {
    return {
      activeWorkflows: this.activeWorkflows.size,
      engineStats: guardrailEngine.getStatistics()
    };
  }
}

// Singleton instance
const approvalWorkflow = new ApprovalWorkflow();

module.exports = approvalWorkflow;
