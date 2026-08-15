/**
 * HybridMind Guardrail Logger
 * 
 * Specialized logging for guardrail system with compliance tracking.
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class GuardrailLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'guardrail-actions.log');
    this.logBuffer = [];
    this.bufferSize = 50;
    this.flushInterval = 5000; // 5 seconds
    this.statistics = {
      totalActions: 0,
      autoApproved: 0,
      userApproved: 0,
      denied: 0,
      timedOut: 0,
      overridden: 0,
      byTier: {},
      byActionType: {},
      byRiskLevel: {},
      byUser: {}
    };

    this._ensureLogDirectory();
    this._startFlushInterval();
  }

  /**
   * Ensure log directory exists
   */
  async _ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create guardrail log directory:', error);
    }
  }

  /**
   * Log action evaluation
   */
  logActionEvaluation({
    actionType,
    tier,
    userId,
    riskLevel,
    requiresApproval,
    autoApproved,
    approvalId,
    details = {}
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'evaluation',
      actionType,
      tier,
      userId: this._sanitizeUserId(userId),
      riskLevel,
      requiresApproval,
      autoApproved,
      approvalId,
      details: this._sanitizeDetails(details)
    };

    this._addToBuffer(logEntry);
    this._updateStats('totalActions');
    this._updateStats('byTier', tier);
    this._updateStats('byActionType', actionType);
    this._updateStats('byRiskLevel', riskLevel);
    this._updateStats('byUser', userId);

    if (autoApproved) {
      this._updateStats('autoApproved');
    }

    logger.info('Guardrail evaluation logged:', {
      actionType,
      tier,
      riskLevel,
      requiresApproval
    });
  }

  /**
   * Log approval/denial
   */
  logApprovalDecision({
    approvalId,
    actionType,
    tier,
    userId,
    decision, // 'approved', 'denied', 'timeout'
    approvedBy,
    reason,
    overridden = false
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'decision',
      approvalId,
      actionType,
      tier,
      userId: this._sanitizeUserId(userId),
      decision,
      approvedBy,
      reason,
      overridden
    };

    this._addToBuffer(logEntry);

    if (decision === 'approved') {
      this._updateStats('userApproved');
    } else if (decision === 'denied') {
      this._updateStats('denied');
    } else if (decision === 'timeout') {
      this._updateStats('timedOut');
    }

    if (overridden) {
      this._updateStats('overridden');
    }

    logger.info('Approval decision logged:', {
      approvalId,
      decision,
      actionType
    });
  }

  /**
   * Log action execution (after approval)
   */
  logActionExecution({
    approvalId,
    actionType,
    tier,
    userId,
    success,
    executionTime,
    error
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'execution',
      approvalId,
      actionType,
      tier,
      userId: this._sanitizeUserId(userId),
      success,
      executionTime,
      error: error ? error.message : null
    };

    this._addToBuffer(logEntry);

    logger.info('Action execution logged:', {
      approvalId,
      actionType,
      success,
      executionTime: `${executionTime}ms`
    });
  }

  /**
   * Log tier violation attempt
   */
  logTierViolation({
    actionType,
    tier,
    userId,
    requiredTier,
    details
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'violation',
      actionType,
      tier,
      userId: this._sanitizeUserId(userId),
      requiredTier,
      details: this._sanitizeDetails(details),
      severity: 'warning'
    };

    this._addToBuffer(logEntry);

    logger.warn('Tier violation logged:', {
      actionType,
      tier,
      requiredTier
    });
  }

  /**
   * Log override event
   */
  logOverride({
    approvalId,
    actionType,
    tier,
    userId,
    riskLevel,
    reason
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'override',
      approvalId,
      actionType,
      tier,
      userId: this._sanitizeUserId(userId),
      riskLevel,
      reason,
      severity: 'high'
    };

    this._addToBuffer(logEntry);

    logger.warn('Guardrail override logged:', {
      approvalId,
      actionType,
      tier,
      riskLevel
    });
  }

  /**
   * Add entry to buffer
   */
  _addToBuffer(entry) {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffer to file
   */
  async flush() {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const logLines = entries.map(entry => JSON.stringify(entry)).join('\n');
      await fs.appendFile(this.logFile, logLines + '\n');
      logger.debug(`Flushed ${entries.length} guardrail log entries`);
    } catch (error) {
      logger.error('Failed to flush guardrail logs:', error);
      // Put entries back in buffer
      this.logBuffer.unshift(...entries);
    }
  }

  /**
   * Start auto-flush interval
   */
  _startFlushInterval() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Read logs from file
   */
  async readLogs({ limit = 100, type, tier, userId, startDate, endDate }) {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      let logs = content
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line));

      // Apply filters
      if (type) {
        logs = logs.filter(log => log.type === type);
      }
      if (tier) {
        logs = logs.filter(log => log.tier === tier);
      }
      if (userId) {
        logs = logs.filter(log => log.userId === this._sanitizeUserId(userId));
      }
      if (startDate) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
      }
      if (endDate) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate));
      }

      // Return most recent first, limited
      return logs.slice(-limit).reverse();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // File doesn't exist yet
      }
      logger.error('Failed to read guardrail logs:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      approvalRate:
        this.statistics.totalActions > 0
          ? (
              ((this.statistics.userApproved + this.statistics.autoApproved) /
                this.statistics.totalActions) *
              100
            ).toFixed(2) + '%'
          : '0%',
      denialRate:
        this.statistics.totalActions > 0
          ? (
              (this.statistics.denied / this.statistics.totalActions) *
              100
            ).toFixed(2) + '%'
          : '0%',
      timeoutRate:
        this.statistics.totalActions > 0
          ? (
              (this.statistics.timedOut / this.statistics.totalActions) *
              100
            ).toFixed(2) + '%'
          : '0%',
      overrideRate:
        this.statistics.totalActions > 0
          ? (
              (this.statistics.overridden / this.statistics.totalActions) *
              100
            ).toFixed(2) + '%'
          : '0%'
    };
  }

  /**
   * Get compliance report
   */
  async getComplianceReport({ startDate, endDate }) {
    const logs = await this.readLogs({
      limit: 10000,
      startDate,
      endDate
    });

    const report = {
      period: {
        start: startDate || 'all time',
        end: endDate || 'now'
      },
      summary: {
        totalActions: logs.length,
        evaluations: logs.filter(l => l.type === 'evaluation').length,
        decisions: logs.filter(l => l.type === 'decision').length,
        executions: logs.filter(l => l.type === 'execution').length,
        violations: logs.filter(l => l.type === 'violation').length,
        overrides: logs.filter(l => l.type === 'override').length
      },
      byTier: this._groupBy(logs, 'tier'),
      byActionType: this._groupBy(logs, 'actionType'),
      byRiskLevel: this._groupBy(
        logs.filter(l => l.riskLevel),
        'riskLevel'
      ),
      criticalActions: logs.filter(
        l => l.riskLevel === 'critical' || l.severity === 'high'
      ),
      deniedActions: logs.filter(
        l => l.type === 'decision' && l.decision === 'denied'
      ),
      timeouts: logs.filter(
        l => l.type === 'decision' && l.decision === 'timeout'
      )
    };

    return report;
  }

  /**
   * Update statistics
   */
  _updateStats(category, key = null) {
    if (key === null) {
      this.statistics[category]++;
    } else {
      if (!this.statistics[category]) {
        this.statistics[category] = {};
      }
      this.statistics[category][key] =
        (this.statistics[category][key] || 0) + 1;
    }
  }

  /**
   * Group logs by field
   */
  _groupBy(logs, field) {
    const grouped = {};
    logs.forEach(log => {
      const key = log[field] || 'unknown';
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return grouped;
  }

  /**
   * Sanitize user ID for logging
   */
  _sanitizeUserId(userId) {
    if (!userId) return 'anonymous';
    // Hash or truncate user IDs for privacy
    return userId.substring(0, 16) + (userId.length > 16 ? '...' : '');
  }

  /**
   * Sanitize sensitive details
   */
  _sanitizeDetails(details) {
    if (!details) return {};

    const sanitized = { ...details };
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'credentials'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Clear old logs (retention policy)
   */
  async clearOldLogs(daysToKeep = 90) {
    try {
      const logs = await this.readLogs({ limit: 100000 });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const recentLogs = logs.filter(
        log => new Date(log.timestamp) >= cutoffDate
      );

      // Rewrite file with recent logs only
      const logLines = recentLogs.map(log => JSON.stringify(log)).join('\n');
      await fs.writeFile(this.logFile, logLines + '\n');

      logger.info(`Cleared logs older than ${daysToKeep} days`, {
        total: logs.length,
        kept: recentLogs.length,
        removed: logs.length - recentLogs.length
      });

      return {
        total: logs.length,
        kept: recentLogs.length,
        removed: logs.length - recentLogs.length
      };
    } catch (error) {
      logger.error('Failed to clear old logs:', error);
      throw error;
    }
  }
}

// Singleton instance
const guardrailLogger = new GuardrailLogger();

// Flush on process exit
process.on('SIGINT', () => {
  guardrailLogger.flush().then(() => process.exit());
});

process.on('SIGTERM', () => {
  guardrailLogger.flush().then(() => process.exit());
});

module.exports = guardrailLogger;
