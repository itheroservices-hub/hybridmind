/**
 * Observability Engine
 * 
 * Comprehensive logging and monitoring system that tracks:
 * - Every agent action with rationale
 * - All tool calls with parameters and results
 * - Input/output for every step
 * - Duration and performance metrics
 * - Context and decision chains
 * 
 * Supports real-time streaming and historical queries.
 */

const logger = require('../../utils/logger');
const { EventEmitter } = require('events');

/**
 * Log levels for filtering
 */
const LOG_LEVELS = {
  TRACE: 'trace',     // Most detailed
  DEBUG: 'debug',     // Debug information
  INFO: 'info',       // General information
  WARN: 'warn',       // Warnings
  ERROR: 'error',     // Errors
  CRITICAL: 'critical' // Critical issues
};

/**
 * Event types for observability
 */
const EVENT_TYPES = {
  AGENT_START: 'agent_start',
  AGENT_THINKING: 'agent_thinking',
  AGENT_ACTION: 'agent_action',
  AGENT_COMPLETE: 'agent_complete',
  AGENT_ERROR: 'agent_error',
  
  TOOL_CALL_START: 'tool_call_start',
  TOOL_CALL_COMPLETE: 'tool_call_complete',
  TOOL_CALL_ERROR: 'tool_call_error',
  
  WORKFLOW_START: 'workflow_start',
  WORKFLOW_STEP: 'workflow_step',
  WORKFLOW_COMPLETE: 'workflow_complete',
  WORKFLOW_ERROR: 'workflow_error',
  
  DECISION_MADE: 'decision_made',
  CONTEXT_UPDATED: 'context_updated',
  
  PERFORMANCE_METRIC: 'performance_metric',
  QUALITY_REPORT: 'quality_report'
};

class ObservabilityEngine extends EventEmitter {
  constructor() {
    super();
    this.logs = []; // All observability logs
    this.sessions = new Map(); // sessionId -> session data
    this.activeTraces = new Map(); // traceId -> active trace
    
    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      eventsByLevel: {},
      totalSessions: 0,
      activeSessions: 0,
      avgEventRate: 0,
      lastEventTime: null
    };

    // Initialize event type counters
    for (const eventType of Object.values(EVENT_TYPES)) {
      this.metrics.eventsByType[eventType] = 0;
    }

    // Initialize level counters
    for (const level of Object.values(LOG_LEVELS)) {
      this.metrics.eventsByLevel[level] = 0;
    }
  }

  /**
   * Start observability session
   */
  startSession({
    sessionId,
    userId,
    tier,
    context = {}
  }) {
    const session = {
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      tier,
      context,
      startTime: new Date(),
      endTime: null,
      events: [],
      traces: [],
      summary: {
        totalEvents: 0,
        totalAgentActions: 0,
        totalToolCalls: 0,
        totalDecisions: 0,
        duration: 0
      }
    };

    this.sessions.set(session.sessionId, session);
    this.metrics.totalSessions++;
    this.metrics.activeSessions++;

    this.logEvent({
      sessionId: session.sessionId,
      type: 'session_start',
      level: LOG_LEVELS.INFO,
      message: `Session started for user ${userId}`,
      data: { userId, tier, context }
    });

    logger.info(`Observability session started: ${session.sessionId}`);

    return session.sessionId;
  }

  /**
   * End observability session
   */
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    session.endTime = new Date();
    session.summary.duration = session.endTime - session.startTime;

    this.logEvent({
      sessionId,
      type: 'session_end',
      level: LOG_LEVELS.INFO,
      message: `Session ended`,
      data: { summary: session.summary }
    });

    this.metrics.activeSessions--;
    logger.info(`Observability session ended: ${sessionId} (${session.summary.duration}ms)`);
  }

  /**
   * Log agent start
   */
  logAgentStart({
    sessionId,
    agentId,
    agentRole,
    task,
    model,
    context = {}
  }) {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trace = {
      traceId,
      sessionId,
      agentId,
      agentRole,
      task,
      model,
      context,
      startTime: new Date(),
      endTime: null,
      events: [],
      actions: [],
      toolCalls: [],
      decisions: [],
      output: null,
      duration: 0,
      status: 'running'
    };

    this.activeTraces.set(traceId, trace);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.traces.push(traceId);
    }

    this.logEvent({
      sessionId,
      traceId,
      type: EVENT_TYPES.AGENT_START,
      level: LOG_LEVELS.INFO,
      message: `Agent ${agentRole} started`,
      data: {
        agentId,
        agentRole,
        task,
        model,
        context
      }
    });

    return traceId;
  }

  /**
   * Log agent thinking/reasoning
   */
  logAgentThinking({
    sessionId,
    traceId,
    agentId,
    reasoning,
    rationale,
    options = []
  }) {
    const trace = this.activeTraces.get(traceId);
    
    if (trace) {
      trace.events.push({
        type: 'thinking',
        timestamp: new Date(),
        reasoning,
        rationale,
        options
      });
    }

    this.logEvent({
      sessionId,
      traceId,
      type: EVENT_TYPES.AGENT_THINKING,
      level: LOG_LEVELS.DEBUG,
      message: `Agent thinking: ${rationale}`,
      data: {
        agentId,
        reasoning,
        rationale,
        options
      }
    });

    // Emit real-time event
    this.emit('agent_thinking', {
      sessionId,
      traceId,
      agentId,
      reasoning,
      rationale,
      timestamp: new Date()
    });
  }

  /**
   * Log agent action
   */
  logAgentAction({
    sessionId,
    traceId,
    agentId,
    action,
    rationale,
    input,
    output,
    duration,
    success = true
  }) {
    const trace = this.activeTraces.get(traceId);
    
    const actionLog = {
      action,
      rationale,
      input,
      output,
      duration,
      success,
      timestamp: new Date()
    };

    if (trace) {
      trace.actions.push(actionLog);
      trace.events.push({
        type: 'action',
        timestamp: new Date(),
        ...actionLog
      });
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.summary.totalAgentActions++;
    }

    this.logEvent({
      sessionId,
      traceId,
      type: EVENT_TYPES.AGENT_ACTION,
      level: success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN,
      message: `Action: ${action} - ${rationale}`,
      data: {
        agentId,
        action,
        rationale,
        input,
        output,
        duration,
        success
      }
    });

    // Emit real-time event
    this.emit('agent_action', {
      sessionId,
      traceId,
      agentId,
      action,
      rationale,
      success,
      timestamp: new Date()
    });
  }

  /**
   * Log tool call
   */
  logToolCall({
    sessionId,
    traceId,
    agentId,
    toolName,
    parameters,
    rationale,
    result,
    duration,
    success = true,
    error = null
  }) {
    const trace = this.activeTraces.get(traceId);
    
    const toolCallLog = {
      toolName,
      parameters,
      rationale,
      result,
      duration,
      success,
      error,
      timestamp: new Date()
    };

    if (trace) {
      trace.toolCalls.push(toolCallLog);
      trace.events.push({
        type: 'tool_call',
        timestamp: new Date(),
        ...toolCallLog
      });
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.summary.totalToolCalls++;
    }

    const eventType = success ? EVENT_TYPES.TOOL_CALL_COMPLETE : EVENT_TYPES.TOOL_CALL_ERROR;
    const level = success ? LOG_LEVELS.INFO : LOG_LEVELS.ERROR;

    this.logEvent({
      sessionId,
      traceId,
      type: eventType,
      level,
      message: `Tool ${toolName}: ${rationale}`,
      data: {
        agentId,
        toolName,
        parameters,
        rationale,
        result,
        duration,
        success,
        error
      }
    });

    // Emit real-time event
    this.emit('tool_call', {
      sessionId,
      traceId,
      agentId,
      toolName,
      rationale,
      success,
      error,
      timestamp: new Date()
    });
  }

  /**
   * Log decision made by agent
   */
  logDecision({
    sessionId,
    traceId,
    agentId,
    decision,
    reasoning,
    alternatives = [],
    confidence,
    context = {}
  }) {
    const trace = this.activeTraces.get(traceId);
    
    const decisionLog = {
      decision,
      reasoning,
      alternatives,
      confidence,
      context,
      timestamp: new Date()
    };

    if (trace) {
      trace.decisions.push(decisionLog);
      trace.events.push({
        type: 'decision',
        timestamp: new Date(),
        ...decisionLog
      });
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.summary.totalDecisions++;
    }

    this.logEvent({
      sessionId,
      traceId,
      type: EVENT_TYPES.DECISION_MADE,
      level: LOG_LEVELS.INFO,
      message: `Decision: ${decision}`,
      data: {
        agentId,
        decision,
        reasoning,
        alternatives,
        confidence,
        context
      }
    });

    // Emit real-time event
    this.emit('decision_made', {
      sessionId,
      traceId,
      agentId,
      decision,
      reasoning,
      confidence,
      timestamp: new Date()
    });
  }

  /**
   * Log agent completion
   */
  logAgentComplete({
    sessionId,
    traceId,
    agentId,
    output,
    qualityMetrics = {},
    success = true
  }) {
    const trace = this.activeTraces.get(traceId);
    
    if (trace) {
      trace.endTime = new Date();
      trace.duration = trace.endTime - trace.startTime;
      trace.output = output;
      trace.status = success ? 'completed' : 'failed';
      trace.qualityMetrics = qualityMetrics;
    }

    this.logEvent({
      sessionId,
      traceId,
      type: EVENT_TYPES.AGENT_COMPLETE,
      level: success ? LOG_LEVELS.INFO : LOG_LEVELS.ERROR,
      message: `Agent completed: ${success ? 'success' : 'failed'}`,
      data: {
        agentId,
        output,
        duration: trace?.duration,
        qualityMetrics,
        success
      }
    });

    // Move from active to session traces
    if (trace) {
      this.activeTraces.delete(traceId);
    }

    // Emit real-time event
    this.emit('agent_complete', {
      sessionId,
      traceId,
      agentId,
      success,
      duration: trace?.duration,
      timestamp: new Date()
    });
  }

  /**
   * Log workflow step
   */
  logWorkflowStep({
    sessionId,
    workflowId,
    stepNumber,
    stepName,
    agentId,
    input,
    output,
    duration,
    success = true
  }) {
    this.logEvent({
      sessionId,
      workflowId,
      type: EVENT_TYPES.WORKFLOW_STEP,
      level: success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN,
      message: `Workflow step ${stepNumber}: ${stepName}`,
      data: {
        workflowId,
        stepNumber,
        stepName,
        agentId,
        input,
        output,
        duration,
        success
      }
    });

    // Emit real-time event
    this.emit('workflow_step', {
      sessionId,
      workflowId,
      stepNumber,
      stepName,
      success,
      timestamp: new Date()
    });
  }

  /**
   * Core event logging
   */
  logEvent({
    sessionId,
    traceId = null,
    workflowId = null,
    type,
    level,
    message,
    data = {}
  }) {
    const event = {
      eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      traceId,
      workflowId,
      type,
      level,
      message,
      data,
      timestamp: new Date()
    };

    this.logs.push(event);

    // Update session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.events.push(event.eventId);
      session.summary.totalEvents++;
    }

    // Update metrics
    this.metrics.totalEvents++;
    this.metrics.eventsByType[type] = (this.metrics.eventsByType[type] || 0) + 1;
    this.metrics.eventsByLevel[level] = (this.metrics.eventsByLevel[level] || 0) + 1;
    this.metrics.lastEventTime = event.timestamp;

    // Keep only last 50,000 events
    if (this.logs.length > 50000) {
      this.logs = this.logs.slice(-50000);
    }

    // Emit real-time event
    this.emit('log_event', event);

    logger.debug(`Observability event: ${type} - ${message}`);

    return event.eventId;
  }

  /**
   * Query logs with filters
   */
  queryLogs(filters = {}) {
    let results = [...this.logs];

    // Filter by session
    if (filters.sessionId) {
      results = results.filter(e => e.sessionId === filters.sessionId);
    }

    // Filter by trace
    if (filters.traceId) {
      results = results.filter(e => e.traceId === filters.traceId);
    }

    // Filter by workflow
    if (filters.workflowId) {
      results = results.filter(e => e.workflowId === filters.workflowId);
    }

    // Filter by type
    if (filters.type) {
      results = results.filter(e => e.type === filters.type);
    }

    // Filter by level
    if (filters.level) {
      results = results.filter(e => e.level === filters.level);
    }

    // Filter by time range
    if (filters.startTime) {
      results = results.filter(e => e.timestamp >= new Date(filters.startTime));
    }

    if (filters.endTime) {
      results = results.filter(e => e.timestamp <= new Date(filters.endTime));
    }

    // Search in message
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(e => 
        e.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(e.data).toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first by default)
    results.sort((a, b) => {
      const order = filters.sortOrder === 'asc' ? 1 : -1;
      return order * (b.timestamp - a.timestamp);
    });

    // Limit results
    const limit = filters.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Get session details
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Get trace details
   */
  getTrace(traceId) {
    // Check active traces first
    let trace = this.activeTraces.get(traceId);
    
    if (!trace) {
      // Search in completed sessions
      for (const session of this.sessions.values()) {
        if (session.traces.includes(traceId)) {
          // Reconstruct trace from logs
          const traceLogs = this.queryLogs({ traceId, limit: 10000 });
          trace = this._reconstructTrace(traceId, traceLogs);
          break;
        }
      }
    }

    return trace;
  }

  /**
   * Reconstruct trace from logs
   */
  _reconstructTrace(traceId, logs) {
    const trace = {
      traceId,
      events: [],
      actions: [],
      toolCalls: [],
      decisions: []
    };

    for (const log of logs) {
      if (log.type === EVENT_TYPES.AGENT_START) {
        trace.agentId = log.data.agentId;
        trace.agentRole = log.data.agentRole;
        trace.task = log.data.task;
        trace.model = log.data.model;
        trace.startTime = log.timestamp;
      } else if (log.type === EVENT_TYPES.AGENT_ACTION) {
        trace.actions.push(log.data);
      } else if (log.type.includes('tool_call')) {
        trace.toolCalls.push(log.data);
      } else if (log.type === EVENT_TYPES.DECISION_MADE) {
        trace.decisions.push(log.data);
      } else if (log.type === EVENT_TYPES.AGENT_COMPLETE) {
        trace.endTime = log.timestamp;
        trace.output = log.data.output;
        trace.duration = log.data.duration;
      }

      trace.events.push(log);
    }

    return trace;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSessions: this.metrics.activeSessions,
      activeTraces: this.activeTraces.size,
      totalLogs: this.logs.length
    };
  }

  /**
   * Clear old logs
   */
  clearOldLogs(olderThan = 86400000) { // 24 hours default
    const cutoff = Date.now() - olderThan;
    const before = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp.getTime() > cutoff);
    
    const cleared = before - this.logs.length;
    logger.info(`Cleared ${cleared} observability logs older than ${olderThan}ms`);
    
    return cleared;
  }

  /**
   * Export logs
   */
  exportLogs(format = 'json', filters = {}) {
    const logs = this.queryLogs(filters);

    if (format === 'csv') {
      return this._exportCSV(logs);
    } else if (format === 'ndjson') {
      return logs.map(log => JSON.stringify(log)).join('\n');
    }

    return logs;
  }

  /**
   * Export to CSV
   */
  _exportCSV(logs) {
    const headers = ['eventId', 'timestamp', 'sessionId', 'traceId', 'type', 'level', 'message'];
    const rows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.eventId,
        log.timestamp.toISOString(),
        log.sessionId || '',
        log.traceId || '',
        log.type,
        log.level,
        `"${log.message.replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

// Singleton instance
module.exports = new ObservabilityEngine();
