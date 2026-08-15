/**
 * HybridMind Multi-Agent System - Agent Decision Logger
 * 
 * Comprehensive logging system that tracks agent decisions, reasoning,
 * inter-agent communications, and collaboration patterns.
 * 
 * Purpose: Make debugging scenarios easier by understanding WHY each agent
 * made specific decisions and how agents collaborated.
 * 
 * Features:
 * - Decision logging with reasoning
 * - Inter-agent message tracking
 * - Collaboration pattern analysis
 * - Performance metrics
 * - Debug-friendly output
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class AgentDecisionLogger {
  constructor() {
    this.logPath = path.join(__dirname, '../../logs/agent-decisions.log');
    this.decisionLog = [];
    this.messageLog = [];
    this.performanceMetrics = new Map();
    this.bufferSize = 50;
    this.buffer = [];
    
    // Ensure log directory exists
    this._ensureLogDirectory();
  }

  /**
   * Log agent decision with reasoning
   */
  logDecision({
    agentId,
    role,
    action,
    decision,
    reasoning,
    context = {},
    alternatives = [],
    confidence = null,
    modelUsed = null
  }) {
    const entry = {
      type: 'decision',
      timestamp: new Date().toISOString(),
      agentId,
      role,
      action,
      decision,
      reasoning,
      context,
      alternatives,
      confidence,
      modelUsed,
      metadata: {
        threadId: context.threadId || null,
        taskId: context.taskId || null,
        priority: context.priority || 'normal'
      }
    };

    this.decisionLog.push(entry);
    this.buffer.push(entry);

    logger.debug(`Decision logged: ${agentId} (${role}) - ${action} → ${decision}`);
    logger.debug(`  Reasoning: ${reasoning}`);

    if (this.buffer.length >= this.bufferSize) {
      this._flushBuffer();
    }

    return entry;
  }

  /**
   * Log inter-agent message
   */
  logMessage({
    from,
    to,
    messageType,
    payload,
    reasoning,
    response = null
  }) {
    const entry = {
      type: 'message',
      timestamp: new Date().toISOString(),
      from,
      to,
      messageType,
      payload,
      reasoning,
      response,
      roundTripTime: response ? Date.now() - new Date(response.timestamp).getTime() : null
    };

    this.messageLog.push(entry);
    this.buffer.push(entry);

    logger.debug(`Message logged: ${from} → ${to} (${messageType})`);

    if (this.buffer.length >= this.bufferSize) {
      this._flushBuffer();
    }

    return entry;
  }

  /**
   * Log collaboration pattern
   */
  logCollaboration({
    agents,
    pattern,
    task,
    outcome,
    duration,
    reasoning
  }) {
    const entry = {
      type: 'collaboration',
      timestamp: new Date().toISOString(),
      agents,
      pattern, // 'sequential', 'parallel', 'hierarchical', 'consensus'
      task,
      outcome,
      duration,
      reasoning,
      metrics: {
        agentCount: agents.length,
        efficiency: this._calculateEfficiency(duration, agents.length)
      }
    };

    this.decisionLog.push(entry);
    this.buffer.push(entry);

    logger.info(`Collaboration logged: ${pattern} pattern with ${agents.length} agents`);

    if (this.buffer.length >= this.bufferSize) {
      this._flushBuffer();
    }

    return entry;
  }

  /**
   * Log agent performance
   */
  logPerformance(agentId, action, duration, success, metrics = {}) {
    const entry = {
      type: 'performance',
      timestamp: new Date().toISOString(),
      agentId,
      action,
      duration,
      success,
      metrics
    };

    // Update aggregated metrics
    const key = `${agentId}:${action}`;
    const existing = this.performanceMetrics.get(key) || {
      count: 0,
      totalDuration: 0,
      successes: 0,
      failures: 0
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.successes += success ? 1 : 0;
    existing.failures += success ? 0 : 1;
    existing.avgDuration = existing.totalDuration / existing.count;
    existing.successRate = (existing.successes / existing.count) * 100;

    this.performanceMetrics.set(key, existing);

    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      this._flushBuffer();
    }

    return entry;
  }

  /**
   * Log model selection reasoning
   */
  logModelSelection({
    agentId,
    role,
    task,
    selectedModel,
    reasoning,
    alternatives = [],
    factors = {}
  }) {
    const entry = {
      type: 'model_selection',
      timestamp: new Date().toISOString(),
      agentId,
      role,
      task,
      selectedModel,
      reasoning,
      alternatives,
      factors, // { cost, quality, speed, context }
      selectionStrategy: factors.strategy || 'balanced'
    };

    this.decisionLog.push(entry);
    this.buffer.push(entry);

    logger.debug(`Model selection: ${agentId} chose ${selectedModel} for ${task}`);
    logger.debug(`  Reasoning: ${reasoning}`);

    if (this.buffer.length >= this.bufferSize) {
      this._flushBuffer();
    }

    return entry;
  }

  /**
   * Log error with context
   */
  logError({
    agentId,
    role,
    error,
    context,
    recoveryAttempt = null,
    fallbackUsed = null
  }) {
    const entry = {
      type: 'error',
      timestamp: new Date().toISOString(),
      agentId,
      role,
      error: {
        message: error.message || error,
        stack: error.stack || null,
        code: error.code || null
      },
      context,
      recoveryAttempt,
      fallbackUsed,
      severity: this._classifyErrorSeverity(error)
    };

    this.decisionLog.push(entry);
    this.buffer.push(entry);

    logger.error(`Agent error: ${agentId} (${role}) - ${error.message || error}`);

    if (this.buffer.length >= this.bufferSize) {
      this._flushBuffer();
    }

    return entry;
  }

  /**
   * Get decisions for agent
   */
  getAgentDecisions(agentId, limit = 50) {
    return this.decisionLog
      .filter(entry => entry.agentId === agentId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get messages between agents
   */
  getAgentMessages(agentId, otherId = null, limit = 50) {
    let messages = this.messageLog;

    if (otherId) {
      messages = messages.filter(
        m => (m.from === agentId && m.to === otherId) ||
             (m.from === otherId && m.to === agentId)
      );
    } else {
      messages = messages.filter(m => m.from === agentId || m.to === agentId);
    }

    return messages.slice(-limit).reverse();
  }

  /**
   * Get collaboration patterns
   */
  getCollaborationPatterns(filter = {}) {
    let patterns = this.decisionLog.filter(entry => entry.type === 'collaboration');

    if (filter.pattern) {
      patterns = patterns.filter(p => p.pattern === filter.pattern);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      patterns = patterns.filter(p => new Date(p.timestamp) > since);
    }

    return patterns;
  }

  /**
   * Get performance metrics for agent
   */
  getAgentMetrics(agentId) {
    const metrics = {};

    for (const [key, value] of this.performanceMetrics.entries()) {
      if (key.startsWith(agentId)) {
        const action = key.split(':')[1];
        metrics[action] = value;
      }
    }

    return metrics;
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics() {
    const metrics = {};

    for (const [key, value] of this.performanceMetrics.entries()) {
      metrics[key] = value;
    }

    return metrics;
  }

  /**
   * Generate debugging report
   */
  async generateDebugReport(options = {}) {
    const {
      agentId = null,
      since = new Date(Date.now() - 3600000), // Last hour
      includeMessages = true,
      includePerformance = true
    } = options;

    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        since: since.toISOString(),
        until: new Date().toISOString()
      },
      summary: {},
      decisions: [],
      messages: [],
      collaborations: [],
      performance: {},
      errors: []
    };

    // Filter by time
    const sinceDate = new Date(since);
    
    let decisions = this.decisionLog.filter(
      entry => new Date(entry.timestamp) > sinceDate
    );
    
    let messages = this.messageLog.filter(
      entry => new Date(entry.timestamp) > sinceDate
    );

    // Filter by agent if specified
    if (agentId) {
      decisions = decisions.filter(entry => entry.agentId === agentId);
      messages = messages.filter(
        entry => entry.from === agentId || entry.to === agentId
      );
    }

    report.decisions = decisions;
    report.messages = includeMessages ? messages : [];
    report.collaborations = decisions.filter(d => d.type === 'collaboration');
    report.errors = decisions.filter(d => d.type === 'error');

    // Summary statistics
    report.summary = {
      totalDecisions: decisions.length,
      totalMessages: messages.length,
      totalCollaborations: report.collaborations.length,
      totalErrors: report.errors.length,
      agentsInvolved: new Set(
        [...decisions.map(d => d.agentId), ...messages.map(m => m.from), ...messages.map(m => m.to)]
          .filter(Boolean)
      ).size
    };

    // Performance metrics
    if (includePerformance) {
      report.performance = agentId 
        ? this.getAgentMetrics(agentId)
        : this.getAllMetrics();
    }

    return report;
  }

  /**
   * Query logs
   */
  queryLogs(query = {}) {
    let logs = [...this.decisionLog, ...this.messageLog];

    if (query.type) {
      logs = logs.filter(log => log.type === query.type);
    }

    if (query.agentId) {
      logs = logs.filter(log => 
        log.agentId === query.agentId || 
        log.from === query.agentId || 
        log.to === query.agentId
      );
    }

    if (query.since) {
      const since = new Date(query.since);
      logs = logs.filter(log => new Date(log.timestamp) > since);
    }

    if (query.until) {
      const until = new Date(query.until);
      logs = logs.filter(log => new Date(log.timestamp) < until);
    }

    return logs.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  /**
   * Flush buffer to disk
   */
  async _flushBuffer() {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    
    try {
      await fs.appendFile(this.logPath, entries);
      this.buffer = [];
      logger.debug(`Flushed ${this.buffer.length} log entries to disk`);
    } catch (error) {
      logger.error(`Failed to flush log buffer: ${error.message}`);
    }
  }

  /**
   * Ensure log directory exists
   */
  async _ensureLogDirectory() {
    const logDir = path.dirname(this.logPath);
    
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create log directory: ${error.message}`);
    }
  }

  /**
   * Calculate collaboration efficiency
   */
  _calculateEfficiency(duration, agentCount) {
    // Simple efficiency metric: ideal time / actual time
    const idealTime = duration / agentCount; // If agents worked in parallel
    const efficiency = (idealTime / duration) * 100;
    return Math.min(100, efficiency).toFixed(1);
  }

  /**
   * Classify error severity
   */
  _classifyErrorSeverity(error) {
    const message = error.message || error;

    if (/quota|rate.*limit|timeout/i.test(message)) {
      return 'medium';
    }

    if (/critical|fatal|crash/i.test(message)) {
      return 'critical';
    }

    return 'low';
  }

  /**
   * Clear old logs
   */
  async clearOldLogs(daysToKeep = 7) {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 3600 * 1000);

    const originalDecisionCount = this.decisionLog.length;
    const originalMessageCount = this.messageLog.length;

    this.decisionLog = this.decisionLog.filter(
      entry => new Date(entry.timestamp) > cutoff
    );

    this.messageLog = this.messageLog.filter(
      entry => new Date(entry.timestamp) > cutoff
    );

    const cleared = 
      (originalDecisionCount - this.decisionLog.length) +
      (originalMessageCount - this.messageLog.length);

    logger.info(`Cleared ${cleared} old agent log entries`);

    return cleared;
  }
}

// Singleton instance
const agentDecisionLogger = new AgentDecisionLogger();

// Auto-flush buffer every 30 seconds
setInterval(() => {
  agentDecisionLogger._flushBuffer();
}, 30000);

// Clear old logs daily
setInterval(() => {
  agentDecisionLogger.clearOldLogs(7);
}, 24 * 3600 * 1000);

module.exports = agentDecisionLogger;
