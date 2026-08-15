/**
 * Metrics Tracker
 * 
 * Tracks comprehensive metrics with zoom-in (trace logs) and zoom-out (trend analysis) capabilities:
 * - Success rates
 * - Hallucination rates
 * - ROI tracking
 * - Performance metrics
 * - Cost tracking
 * - Trace-level logging
 * - Trend analysis
 */

const logger = require('../../utils/logger');

/**
 * Metric types for categorization
 */
const METRIC_TYPES = {
  SUCCESS: 'success',
  HALLUCINATION: 'hallucination',
  ROI: 'roi',
  PERFORMANCE: 'performance',
  COST: 'cost',
  QUALITY: 'quality'
};

/**
 * Time windows for trend analysis
 */
const TIME_WINDOWS = {
  HOUR: 3600000,      // 1 hour
  DAY: 86400000,      // 24 hours
  WEEK: 604800000,    // 7 days
  MONTH: 2592000000   // 30 days
};

class MetricsTracker {
  constructor() {
    this.traces = []; // Detailed trace logs (zoom-in)
    this.aggregates = new Map(); // Aggregated metrics (zoom-out)
    this.trends = new Map(); // Trend data by time window
    
    this.metrics = {
      // Success metrics
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      successRate: 0,
      
      // Hallucination metrics
      totalHallucinationChecks: 0,
      hallucinationsDetected: 0,
      hallucinationRate: 0,
      avgHallucinationSeverity: 0,
      
      // ROI metrics
      totalValueGenerated: 0,
      totalCostIncurred: 0,
      avgROI: 0,
      bestROI: 0,
      worstROI: Infinity,
      
      // Performance metrics
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      
      // Cost metrics
      totalTokens: 0,
      totalCost: 0,
      avgCostPerRun: 0,
      
      // Quality metrics
      avgQualityScore: 0,
      avgAccuracy: 0,
      avgCompleteness: 0
    };
    
    // Initialize trend tracking
    this._initializeTrends();
  }

  /**
   * Initialize trend tracking for all time windows
   */
  _initializeTrends() {
    for (const [name, duration] of Object.entries(TIME_WINDOWS)) {
      this.trends.set(name, {
        window: duration,
        dataPoints: [],
        aggregated: null
      });
    }
  }

  /**
   * Record a trace (zoom-in level)
   */
  recordTrace({
    traceId,
    type,
    level = 'info',
    message,
    metadata = {},
    timestamp = new Date()
  }) {
    const trace = {
      traceId: traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      level,
      message,
      metadata,
      timestamp
    };

    this.traces.push(trace);

    // Keep only last 10,000 traces
    if (this.traces.length > 10000) {
      this.traces = this.traces.slice(-10000);
    }

    logger.debug(`Trace recorded: ${type} - ${message}`);

    return trace.traceId;
  }

  /**
   * Record workflow execution
   */
  recordWorkflowExecution({
    workflowId,
    success,
    duration,
    agents,
    model,
    tokens,
    cost,
    evaluation,
    error = null
  }) {
    this.metrics.totalRuns++;

    if (success) {
      this.metrics.successfulRuns++;
    } else {
      this.metrics.failedRuns++;
    }

    this.metrics.successRate = this.metrics.totalRuns > 0 
      ? this.metrics.successfulRuns / this.metrics.totalRuns 
      : 0;

    // Record trace
    const traceId = this.recordTrace({
      type: METRIC_TYPES.SUCCESS,
      level: success ? 'info' : 'error',
      message: `Workflow ${workflowId} ${success ? 'completed' : 'failed'}`,
      metadata: {
        workflowId,
        success,
        duration,
        agents,
        model,
        tokens,
        cost,
        evaluation: evaluation?.id,
        error
      }
    });

    // Update performance metrics
    this._updatePerformanceMetrics(duration);

    // Update cost metrics
    if (tokens && cost) {
      this._updateCostMetrics(tokens, cost);
    }

    // Update quality metrics
    if (evaluation) {
      this._updateQualityMetrics(evaluation);
    }

    // Add to trend data
    this._addToTrends({
      type: METRIC_TYPES.SUCCESS,
      timestamp: new Date(),
      value: success ? 1 : 0,
      metadata: { workflowId, duration, cost }
    });

    return traceId;
  }

  /**
   * Record hallucination detection
   */
  recordHallucination({
    evaluationId,
    detected,
    severity,
    agentRole,
    model,
    details
  }) {
    this.metrics.totalHallucinationChecks++;

    if (detected) {
      this.metrics.hallucinationsDetected++;
    }

    this.metrics.hallucinationRate = this.metrics.totalHallucinationChecks > 0
      ? this.metrics.hallucinationsDetected / this.metrics.totalHallucinationChecks
      : 0;

    // Update average severity
    const n = this.metrics.hallucinationsDetected;
    if (n > 0 && detected) {
      this.metrics.avgHallucinationSeverity = 
        (this.metrics.avgHallucinationSeverity * (n - 1) + severity) / n;
    }

    // Record trace
    const traceId = this.recordTrace({
      type: METRIC_TYPES.HALLUCINATION,
      level: detected ? 'warning' : 'info',
      message: detected 
        ? `Hallucination detected (severity: ${severity}/10)` 
        : 'No hallucination detected',
      metadata: {
        evaluationId,
        detected,
        severity,
        agentRole,
        model,
        details
      }
    });

    // Add to trend data
    this._addToTrends({
      type: METRIC_TYPES.HALLUCINATION,
      timestamp: new Date(),
      value: detected ? severity : 0,
      metadata: { agentRole, model }
    });

    return traceId;
  }

  /**
   * Record ROI
   */
  recordROI({
    workflowId,
    roi,
    valueGenerated,
    costIncurred,
    breakdown
  }) {
    this.metrics.totalValueGenerated += valueGenerated;
    this.metrics.totalCostIncurred += costIncurred;

    // Update ROI stats
    const n = this.metrics.totalRuns;
    this.metrics.avgROI = n > 0 
      ? (this.metrics.avgROI * (n - 1) + roi) / n 
      : roi;

    this.metrics.bestROI = Math.max(this.metrics.bestROI, roi);
    this.metrics.worstROI = Math.min(this.metrics.worstROI, roi);

    // Record trace
    const traceId = this.recordTrace({
      type: METRIC_TYPES.ROI,
      level: roi > 1 ? 'info' : 'warning',
      message: `ROI: ${roi.toFixed(2)}x (Value: $${valueGenerated.toFixed(2)}, Cost: $${costIncurred.toFixed(2)})`,
      metadata: {
        workflowId,
        roi,
        valueGenerated,
        costIncurred,
        breakdown
      }
    });

    // Add to trend data
    this._addToTrends({
      type: METRIC_TYPES.ROI,
      timestamp: new Date(),
      value: roi,
      metadata: { valueGenerated, costIncurred }
    });

    return traceId;
  }

  /**
   * Update performance metrics
   */
  _updatePerformanceMetrics(duration) {
    const n = this.metrics.totalRuns;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (n - 1) + duration) / n;

    // Update percentiles (simplified - would need proper percentile calculation in production)
    const recentDurations = this.traces
      .filter(t => t.type === METRIC_TYPES.PERFORMANCE || t.metadata?.duration)
      .map(t => t.metadata?.duration || 0)
      .filter(d => d > 0)
      .slice(-100)
      .sort((a, b) => a - b);

    if (recentDurations.length > 0) {
      this.metrics.p50ResponseTime = recentDurations[Math.floor(recentDurations.length * 0.5)];
      this.metrics.p95ResponseTime = recentDurations[Math.floor(recentDurations.length * 0.95)];
      this.metrics.p99ResponseTime = recentDurations[Math.floor(recentDurations.length * 0.99)];
    }

    // Record trace
    this.recordTrace({
      type: METRIC_TYPES.PERFORMANCE,
      level: 'debug',
      message: `Response time: ${duration}ms`,
      metadata: { duration }
    });
  }

  /**
   * Update cost metrics
   */
  _updateCostMetrics(tokens, cost) {
    this.metrics.totalTokens += tokens;
    this.metrics.totalCost += cost;

    const n = this.metrics.totalRuns;
    this.metrics.avgCostPerRun = n > 0 
      ? this.metrics.totalCost / n 
      : 0;

    // Record trace
    this.recordTrace({
      type: METRIC_TYPES.COST,
      level: 'debug',
      message: `Cost: $${cost.toFixed(4)} (${tokens} tokens)`,
      metadata: { tokens, cost }
    });
  }

  /**
   * Update quality metrics
   */
  _updateQualityMetrics(evaluation) {
    const n = this.metrics.totalRuns;

    this.metrics.avgQualityScore = 
      (this.metrics.avgQualityScore * (n - 1) + evaluation.overallScore) / n;

    if (evaluation.scores?.accuracy) {
      this.metrics.avgAccuracy = 
        (this.metrics.avgAccuracy * (n - 1) + evaluation.scores.accuracy) / n;
    }

    if (evaluation.scores?.completeness) {
      this.metrics.avgCompleteness = 
        (this.metrics.avgCompleteness * (n - 1) + evaluation.scores.completeness) / n;
    }

    // Record trace
    this.recordTrace({
      type: METRIC_TYPES.QUALITY,
      level: 'info',
      message: `Quality score: ${evaluation.overallScore.toFixed(2)}/10`,
      metadata: {
        evaluationId: evaluation.id,
        overallScore: evaluation.overallScore,
        scores: evaluation.scores
      }
    });
  }

  /**
   * Add data point to trend tracking
   */
  _addToTrends(dataPoint) {
    for (const [name, trend] of this.trends.entries()) {
      trend.dataPoints.push(dataPoint);

      // Remove old data points outside the window
      const cutoff = Date.now() - trend.window;
      trend.dataPoints = trend.dataPoints.filter(
        dp => dp.timestamp.getTime() > cutoff
      );

      // Recalculate aggregated trend
      trend.aggregated = this._calculateTrendAggregate(trend.dataPoints, dataPoint.type);
    }
  }

  /**
   * Calculate aggregate for trend data
   */
  _calculateTrendAggregate(dataPoints, type) {
    if (dataPoints.length === 0) return null;

    const values = dataPoints.map(dp => dp.value);
    
    return {
      count: dataPoints.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
      trend: this._calculateTrendDirection(values)
    };
  }

  /**
   * Calculate trend direction (improving, declining, stable)
   */
  _calculateTrendDirection(values) {
    if (values.length < 2) return 'stable';

    const recentAvg = values.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, values.length);
    const olderAvg = values.slice(0, -10).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 10);

    const change = ((recentAvg - olderAvg) / Math.max(0.01, olderAvg)) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  /**
   * Get traces (zoom-in)
   */
  getTraces(filters = {}) {
    let traces = [...this.traces];

    if (filters.type) {
      traces = traces.filter(t => t.type === filters.type);
    }

    if (filters.level) {
      traces = traces.filter(t => t.level === filters.level);
    }

    if (filters.traceId) {
      traces = traces.filter(t => t.traceId === filters.traceId);
    }

    if (filters.startTime) {
      traces = traces.filter(t => t.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      traces = traces.filter(t => t.timestamp <= filters.endTime);
    }

    // Sort by timestamp (newest first)
    traces.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    const limit = filters.limit || 100;
    return traces.slice(0, limit);
  }

  /**
   * Get trends (zoom-out)
   */
  getTrends(window = 'DAY') {
    const trend = this.trends.get(window);
    
    if (!trend) {
      return null;
    }

    return {
      window,
      duration: trend.window,
      dataPoints: trend.dataPoints.length,
      ...trend.aggregated
    };
  }

  /**
   * Get all metrics (zoom-out)
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  /**
   * Get detailed analytics
   */
  getAnalytics(timeWindow = 'DAY') {
    const trend = this.getTrends(timeWindow);
    const metrics = this.getMetrics();

    return {
      summary: metrics,
      trend,
      insights: this._generateInsights(metrics, trend)
    };
  }

  /**
   * Generate insights from metrics
   */
  _generateInsights(metrics, trend) {
    const insights = [];

    // Success rate insights
    if (metrics.successRate < 0.8) {
      insights.push({
        type: 'warning',
        area: 'success-rate',
        message: `Success rate is ${(metrics.successRate * 100).toFixed(1)}%, below target of 80%`,
        recommendation: 'Review failed runs and improve error handling'
      });
    }

    // Hallucination insights
    if (metrics.hallucinationRate > 0.1) {
      insights.push({
        type: 'critical',
        area: 'hallucination',
        message: `Hallucination rate is ${(metrics.hallucinationRate * 100).toFixed(1)}%, above acceptable threshold`,
        recommendation: 'Review model selection and prompting strategies'
      });
    }

    // ROI insights
    if (metrics.avgROI < 1) {
      insights.push({
        type: 'warning',
        area: 'roi',
        message: `Average ROI is ${metrics.avgROI.toFixed(2)}x, below break-even`,
        recommendation: 'Optimize costs or improve output quality'
      });
    }

    // Performance insights
    if (metrics.p95ResponseTime > 10000) {
      insights.push({
        type: 'info',
        area: 'performance',
        message: `P95 response time is ${(metrics.p95ResponseTime / 1000).toFixed(1)}s`,
        recommendation: 'Consider parallelization or faster models'
      });
    }

    // Trend insights
    if (trend?.trend === 'declining' && trend.aggregated) {
      insights.push({
        type: 'warning',
        area: 'trend',
        message: `Declining trend detected over ${trend.window}`,
        recommendation: 'Investigate recent changes that may have impacted quality'
      });
    }

    return insights;
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(format = 'json') {
    const data = {
      metrics: this.getMetrics(),
      trends: {},
      traces: this.traces.slice(-1000) // Last 1000 traces
    };

    // Export all trends
    for (const [name, trend] of this.trends.entries()) {
      data.trends[name] = this.getTrends(name);
    }

    if (format === 'csv') {
      // Simple CSV export (would need proper CSV library in production)
      return this._exportCSV(data);
    }

    return data;
  }

  /**
   * Simple CSV export
   */
  _exportCSV(data) {
    const rows = [
      ['Metric', 'Value'],
      ...Object.entries(data.metrics).map(([key, value]) => [key, value])
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Clear old traces
   */
  clearOldTraces(olderThan = 86400000) { // 24 hours default
    const cutoff = Date.now() - olderThan;
    const before = this.traces.length;
    
    this.traces = this.traces.filter(t => t.timestamp.getTime() > cutoff);
    
    const cleared = before - this.traces.length;
    logger.info(`Cleared ${cleared} traces older than ${olderThan}ms`);
    
    return cleared;
  }

  /**
   * Reset metrics (for testing)
   */
  reset() {
    this.traces = [];
    this.aggregates.clear();
    this.trends.clear();
    
    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      successRate: 0,
      totalHallucinationChecks: 0,
      hallucinationsDetected: 0,
      hallucinationRate: 0,
      avgHallucinationSeverity: 0,
      totalValueGenerated: 0,
      totalCostIncurred: 0,
      avgROI: 0,
      bestROI: 0,
      worstROI: Infinity,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      totalTokens: 0,
      totalCost: 0,
      avgCostPerRun: 0,
      avgQualityScore: 0,
      avgAccuracy: 0,
      avgCompleteness: 0
    };

    this._initializeTrends();
    logger.info('Metrics tracker reset');
  }
}

// Singleton instance
module.exports = new MetricsTracker();
