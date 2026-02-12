/**
 * Real-Time Monitor
 * 
 * Integrates observability with WebSocket collaboration server
 * for live monitoring and instant alerts.
 */

const logger = require('../../utils/logger');
const observabilityEngine = require('./observabilityEngine');
const auditLogger = require('./auditLogger');
const qualityIndex = require('./qualityIndex');

class RealtimeMonitor {
  constructor() {
    this.collaborationServer = null;
    this.alertThresholds = {
      qualityScore: 60,
      confidence: 50,
      errorRate: 0.1,
      responseTime: 10000 // 10 seconds
    };
    
    this.activeMonitors = new Map(); // workspaceId -> monitor config
    this.alertHistory = [];
  }

  /**
   * Initialize with collaboration server
   */
  initialize(collaborationServer) {
    this.collaborationServer = collaborationServer;

    // Subscribe to observability events
    this._subscribeToObservabilityEvents();

    logger.info('Real-time monitor initialized');
  }

  /**
   * Subscribe to observability engine events
   */
  _subscribeToObservabilityEvents() {
    // Agent thinking events
    observabilityEngine.on('agent_thinking', (data) => {
      this._broadcastEvent('observability:agent_thinking', data);
    });

    // Agent action events
    observabilityEngine.on('agent_action', (data) => {
      this._broadcastEvent('observability:agent_action', data);
      this._checkActionQuality(data);
    });

    // Tool call events
    observabilityEngine.on('tool_call', (data) => {
      this._broadcastEvent('observability:tool_call', data);
      
      if (!data.success) {
        this._sendAlert({
          type: 'tool_failure',
          severity: 'warning',
          message: `Tool ${data.toolName} failed`,
          data
        });
      }
    });

    // Decision events
    observabilityEngine.on('decision_made', (data) => {
      this._broadcastEvent('observability:decision', data);
      
      if (data.confidence < this.alertThresholds.confidence) {
        this._sendAlert({
          type: 'low_confidence',
          severity: 'warning',
          message: `Low confidence decision (${data.confidence}%)`,
          data
        });
      }
    });

    // Agent completion events
    observabilityEngine.on('agent_complete', (data) => {
      this._broadcastEvent('observability:agent_complete', data);
      
      if (!data.success) {
        this._sendAlert({
          type: 'agent_failure',
          severity: 'error',
          message: `Agent failed to complete task`,
          data
        });
      }
    });

    // Workflow step events
    observabilityEngine.on('workflow_step', (data) => {
      this._broadcastEvent('observability:workflow_step', data);
    });

    // Log events
    observabilityEngine.on('log_event', (event) => {
      // Only broadcast errors and critical events to reduce noise
      if (event.level === 'error' || event.level === 'critical') {
        this._broadcastEvent('observability:log', event);
        
        this._sendAlert({
          type: 'system_error',
          severity: event.level === 'critical' ? 'critical' : 'error',
          message: event.message,
          data: event
        });
      }
    });
  }

  /**
   * Check action quality and send alerts
   */
  _checkActionQuality(actionData) {
    const session = observabilityEngine.getSession(actionData.sessionId);
    
    if (!session) return;

    // Check for quality issues
    if (actionData.duration && actionData.duration > this.alertThresholds.responseTime) {
      this._sendAlert({
        type: 'slow_response',
        severity: 'warning',
        message: `Slow action response (${actionData.duration}ms)`,
        data: actionData
      });
    }
  }

  /**
   * Broadcast event to WebSocket clients
   */
  _broadcastEvent(eventType, data) {
    if (!this.collaborationServer) {
      logger.warn('Collaboration server not initialized');
      return;
    }

    const workspaceId = data.sessionId || 'global';
    
    // Send to specific workspace if session exists
    if (data.sessionId) {
      this.collaborationServer.io.to(workspaceId).emit(eventType, {
        timestamp: new Date(),
        ...data
      });
    }
  }

  /**
   * Send alert to dashboard
   */
  _sendAlert(alert) {
    const alertData = {
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alert
    };

    this.alertHistory.push(alertData);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    if (this.collaborationServer) {
      // Broadcast to all workspaces
      this.collaborationServer.io.emit('observability:alert', alertData);
    }

    logger.warn(`Alert: ${alert.type} - ${alert.message}`);
  }

  /**
   * Start monitoring a workspace
   */
  startMonitoring(workspaceId, config = {}) {
    const monitor = {
      workspaceId,
      startTime: new Date(),
      config: {
        ...this.alertThresholds,
        ...config
      },
      stats: {
        eventsProcessed: 0,
        alertsSent: 0
      }
    };

    this.activeMonitors.set(workspaceId, monitor);

    logger.info(`Started monitoring workspace: ${workspaceId}`);

    return monitor;
  }

  /**
   * Stop monitoring a workspace
   */
  stopMonitoring(workspaceId) {
    const monitor = this.activeMonitors.get(workspaceId);
    
    if (monitor) {
      monitor.endTime = new Date();
      monitor.duration = monitor.endTime - monitor.startTime;
      this.activeMonitors.delete(workspaceId);
      
      logger.info(`Stopped monitoring workspace: ${workspaceId} (${monitor.duration}ms)`);
      
      return monitor;
    }

    return null;
  }

  /**
   * Broadcast quality report
   */
  broadcastQualityReport(report) {
    if (!this.collaborationServer) return;

    this.collaborationServer.io.emit('observability:quality_report', {
      timestamp: new Date(),
      report
    });

    // Send alert if quality is low
    if (report.quality.overallScore < this.alertThresholds.qualityScore) {
      this._sendAlert({
        type: 'low_quality',
        severity: 'warning',
        message: `Low quality score (${report.quality.overallScore})`,
        data: report
      });
    }
  }

  /**
   * Broadcast audit event
   */
  broadcastAuditEvent(audit) {
    if (!this.collaborationServer) return;

    // Only broadcast critical audits
    if (audit.severity === 'critical') {
      this.collaborationServer.io.emit('observability:audit', {
        timestamp: new Date(),
        audit
      });
    }
  }

  /**
   * Get active monitors
   */
  getActiveMonitors() {
    return Array.from(this.activeMonitors.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(filters = {}) {
    let results = [...this.alertHistory];

    if (filters.type) {
      results = results.filter(a => a.type === filters.type);
    }

    if (filters.severity) {
      results = results.filter(a => a.severity === filters.severity);
    }

    if (filters.startTime) {
      results = results.filter(a => a.timestamp >= new Date(filters.startTime));
    }

    if (filters.endTime) {
      results = results.filter(a => a.timestamp <= new Date(filters.endTime));
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    const limit = filters.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(thresholds) {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds
    };

    logger.info('Alert thresholds updated', this.alertThresholds);
  }

  /**
   * Get monitoring stats
   */
  getStats() {
    return {
      activeMonitors: this.activeMonitors.size,
      totalAlerts: this.alertHistory.length,
      alertThresholds: this.alertThresholds
    };
  }
}

// Singleton instance
module.exports = new RealtimeMonitor();
