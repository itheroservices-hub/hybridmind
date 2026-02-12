/**
 * Observability Routes
 * 
 * REST API endpoints for observability dashboard:
 * - Logs and traces
 * - Audit trails
 * - Quality reports
 * - Real-time monitoring
 * - Analytics and exports
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const observabilityEngine = require('../services/observability/observabilityEngine');
const auditLogger = require('../services/observability/auditLogger');
const qualityIndex = require('../services/observability/qualityIndex');
const realtimeMonitor = require('../services/observability/realtimeMonitor');

/**
 * Start observability session
 * POST /api/observability/sessions
 */
router.post('/sessions', async (req, res) => {
  try {
    const { userId, tier, context } = req.body;

    const sessionId = observabilityEngine.startSession({
      userId,
      tier,
      context
    });

    res.json({
      success: true,
      sessionId,
      message: 'Observability session started'
    });
  } catch (error) {
    logger.error('Error starting observability session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * End observability session
 * POST /api/observability/sessions/:sessionId/end
 */
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    observabilityEngine.endSession(sessionId);

    const session = observabilityEngine.getSession(sessionId);

    res.json({
      success: true,
      session,
      message: 'Session ended'
    });
  } catch (error) {
    logger.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get session details
 * GET /api/observability/sessions/:sessionId
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = observabilityEngine.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    logger.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Query observability logs
 * GET /api/observability/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const filters = {
      sessionId: req.query.sessionId,
      traceId: req.query.traceId,
      workflowId: req.query.workflowId,
      type: req.query.type,
      level: req.query.level,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      search: req.query.search,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const logs = observabilityEngine.queryLogs(filters);

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    logger.error('Error querying logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get trace details
 * GET /api/observability/traces/:traceId
 */
router.get('/traces/:traceId', async (req, res) => {
  try {
    const { traceId } = req.params;

    const trace = observabilityEngine.getTrace(traceId);

    if (!trace) {
      return res.status(404).json({
        success: false,
        error: 'Trace not found'
      });
    }

    res.json({
      success: true,
      trace
    });
  } catch (error) {
    logger.error('Error getting trace:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export logs
 * GET /api/observability/logs/export
 */
router.get('/logs/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filters = {
      sessionId: req.query.sessionId,
      traceId: req.query.traceId,
      type: req.query.type,
      level: req.query.level,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      limit: req.query.limit ? parseInt(req.query.limit) : 10000
    };

    const data = observabilityEngine.exportLogs(format, filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=observability-logs.csv');
    } else if (format === 'ndjson') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename=observability-logs.ndjson');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(data);
  } catch (error) {
    logger.error('Error exporting logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get observability metrics
 * GET /api/observability/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = observabilityEngine.getMetrics();

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Query audit logs
 * GET /api/observability/audits
 */
router.get('/audits', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      sessionId: req.query.sessionId,
      category: req.query.category,
      action: req.query.action,
      severity: req.query.severity,
      resource: req.query.resource,
      complianceFramework: req.query.complianceFramework,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const audits = auditLogger.queryAudits(filters);

    res.json({
      success: true,
      count: audits.length,
      audits
    });
  } catch (error) {
    logger.error('Error querying audits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Verify audit chain integrity
 * GET /api/observability/audits/verify
 */
router.get('/audits/verify', async (req, res) => {
  try {
    const verification = auditLogger.verifyChain();

    res.json({
      success: true,
      verification
    });
  } catch (error) {
    logger.error('Error verifying audit chain:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate compliance report
 * POST /api/observability/audits/compliance-report
 */
router.post('/audits/compliance-report', async (req, res) => {
  try {
    const { framework, startTime, endTime, userId } = req.body;

    const report = auditLogger.generateComplianceReport({
      framework,
      startTime,
      endTime,
      userId
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    logger.error('Error generating compliance report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export audits
 * GET /api/observability/audits/export
 */
router.get('/audits/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filters = {
      userId: req.query.userId,
      category: req.query.category,
      severity: req.query.severity,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      limit: req.query.limit ? parseInt(req.query.limit) : 10000
    };

    const data = auditLogger.exportAudits(format, filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    } else if (format === 'ndjson') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.ndjson');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(data);
  } catch (error) {
    logger.error('Error exporting audits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get audit metrics
 * GET /api/observability/audits/metrics
 */
router.get('/audits/metrics', async (req, res) => {
  try {
    const metrics = auditLogger.getMetrics();

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting audit metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Query quality reports
 * GET /api/observability/quality
 */
router.get('/quality', async (req, res) => {
  try {
    const filters = {
      sessionId: req.query.sessionId,
      traceId: req.query.traceId,
      agentRole: req.query.agentRole,
      minQualityScore: req.query.minQualityScore ? parseFloat(req.query.minQualityScore) : undefined,
      maxQualityScore: req.query.maxQualityScore ? parseFloat(req.query.maxQualityScore) : undefined,
      minConfidence: req.query.minConfidence ? parseFloat(req.query.minConfidence) : undefined,
      confidenceLevel: req.query.confidenceLevel,
      hasErrors: req.query.hasErrors !== undefined ? req.query.hasErrors === 'true' : undefined,
      errorType: req.query.errorType,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const reports = qualityIndex.queryReports(filters);

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    logger.error('Error querying quality reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get agent quality profile
 * GET /api/observability/quality/agents/:agentRole
 */
router.get('/quality/agents/:agentRole', async (req, res) => {
  try {
    const { agentRole } = req.params;

    const profile = qualityIndex.getAgentProfile(agentRole);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Agent profile not found'
      });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    logger.error('Error getting agent profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all agent profiles
 * GET /api/observability/quality/agents
 */
router.get('/quality/agents', async (req, res) => {
  try {
    const profiles = qualityIndex.getAllAgentProfiles();

    res.json({
      success: true,
      count: profiles.length,
      profiles
    });
  } catch (error) {
    logger.error('Error getting agent profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get error patterns
 * GET /api/observability/quality/errors
 */
router.get('/quality/errors', async (req, res) => {
  try {
    const { errorType } = req.query;

    const patterns = qualityIndex.getErrorPatterns(errorType);

    res.json({
      success: true,
      patterns
    });
  } catch (error) {
    logger.error('Error getting error patterns:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get improvement suggestions
 * GET /api/observability/quality/suggestions
 */
router.get('/quality/suggestions', async (req, res) => {
  try {
    const filters = {
      agentRole: req.query.agentRole,
      applied: req.query.applied !== undefined ? req.query.applied === 'true' : undefined,
      priority: req.query.priority,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const suggestions = qualityIndex.getImprovementSuggestions(filters);

    res.json({
      success: true,
      count: suggestions.length,
      suggestions
    });
  } catch (error) {
    logger.error('Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Apply improvement suggestion
 * POST /api/observability/quality/suggestions/:suggestionId/apply
 */
router.post('/quality/suggestions/:suggestionId/apply', async (req, res) => {
  try {
    const { suggestionId } = req.params;

    const success = qualityIndex.applySuggestion(suggestionId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }

    res.json({
      success: true,
      message: 'Suggestion marked as applied'
    });
  } catch (error) {
    logger.error('Error applying suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get quality benchmark
 * GET /api/observability/quality/benchmark
 */
router.get('/quality/benchmark', async (req, res) => {
  try {
    const benchmark = qualityIndex.getBenchmark();

    res.json({
      success: true,
      benchmark
    });
  } catch (error) {
    logger.error('Error getting benchmark:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export quality reports
 * GET /api/observability/quality/export
 */
router.get('/quality/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filters = {
      sessionId: req.query.sessionId,
      agentRole: req.query.agentRole,
      minQualityScore: req.query.minQualityScore ? parseFloat(req.query.minQualityScore) : undefined,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      limit: req.query.limit ? parseInt(req.query.limit) : 10000
    };

    const data = qualityIndex.exportReports(format, filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=quality-reports.csv');
    } else if (format === 'ndjson') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename=quality-reports.ndjson');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(data);
  } catch (error) {
    logger.error('Error exporting quality reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get quality metrics
 * GET /api/observability/quality/metrics
 */
router.get('/quality/metrics', async (req, res) => {
  try {
    const metrics = qualityIndex.getMetrics();

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting quality metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Start monitoring workspace
 * POST /api/observability/monitor/start
 */
router.post('/monitor/start', async (req, res) => {
  try {
    const { workspaceId, config } = req.body;

    const monitor = realtimeMonitor.startMonitoring(workspaceId, config);

    res.json({
      success: true,
      monitor,
      message: 'Monitoring started'
    });
  } catch (error) {
    logger.error('Error starting monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop monitoring workspace
 * POST /api/observability/monitor/stop
 */
router.post('/monitor/stop', async (req, res) => {
  try {
    const { workspaceId } = req.body;

    const monitor = realtimeMonitor.stopMonitoring(workspaceId);

    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: 'Monitor not found'
      });
    }

    res.json({
      success: true,
      monitor,
      message: 'Monitoring stopped'
    });
  } catch (error) {
    logger.error('Error stopping monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get active monitors
 * GET /api/observability/monitor/active
 */
router.get('/monitor/active', async (req, res) => {
  try {
    const monitors = realtimeMonitor.getActiveMonitors();

    res.json({
      success: true,
      count: monitors.length,
      monitors
    });
  } catch (error) {
    logger.error('Error getting monitors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get alert history
 * GET /api/observability/monitor/alerts
 */
router.get('/monitor/alerts', async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      severity: req.query.severity,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const alerts = realtimeMonitor.getAlertHistory(filters);

    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update alert thresholds
 * POST /api/observability/monitor/thresholds
 */
router.post('/monitor/thresholds', async (req, res) => {
  try {
    const thresholds = req.body;

    realtimeMonitor.updateThresholds(thresholds);

    res.json({
      success: true,
      thresholds: realtimeMonitor.alertThresholds,
      message: 'Thresholds updated'
    });
  } catch (error) {
    logger.error('Error updating thresholds:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get monitoring stats
 * GET /api/observability/monitor/stats
 */
router.get('/monitor/stats', async (req, res) => {
  try {
    const stats = realtimeMonitor.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting monitoring stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clear old logs
 * POST /api/observability/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThan } = req.body;

    const cleared = observabilityEngine.clearOldLogs(olderThan);

    res.json({
      success: true,
      cleared,
      message: `Cleared ${cleared} old logs`
    });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
