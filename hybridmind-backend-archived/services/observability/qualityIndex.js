/**
 * Quality Index
 * 
 * Agent self-reporting system for quality assessment and improvement.
 * Tracks:
 * - Confidence scores for each action
 * - Quality metrics per agent
 * - Error patterns and classifications
 * - Improvement suggestions
 * - Performance benchmarks
 */

const logger = require('../../utils/logger');

/**
 * Quality dimensions
 */
const QUALITY_DIMENSIONS = {
  ACCURACY: 'accuracy',           // Correctness of output
  COMPLETENESS: 'completeness',   // Coverage of requirements
  RELEVANCE: 'relevance',         // Alignment with task
  COHERENCE: 'coherence',         // Logical consistency
  EFFICIENCY: 'efficiency',       // Resource usage
  TIMELINESS: 'timeliness'        // Response time
};

/**
 * Confidence levels
 */
const CONFIDENCE_LEVELS = {
  VERY_LOW: { min: 0, max: 20, label: 'very_low' },
  LOW: { min: 20, max: 40, label: 'low' },
  MEDIUM: { min: 40, max: 60, label: 'medium' },
  HIGH: { min: 60, max: 80, label: 'high' },
  VERY_HIGH: { min: 80, max: 100, label: 'very_high' }
};

/**
 * Error classifications
 */
const ERROR_TYPES = {
  HALLUCINATION: 'hallucination',
  INCOMPLETE: 'incomplete',
  IRRELEVANT: 'irrelevant',
  INCOHERENT: 'incoherent',
  TIMEOUT: 'timeout',
  TOOL_FAILURE: 'tool_failure',
  RESOURCE_LIMIT: 'resource_limit',
  CONTEXT_OVERFLOW: 'context_overflow',
  MODEL_ERROR: 'model_error'
};

class QualityIndex {
  constructor() {
    this.qualityReports = []; // All quality reports
    this.agentProfiles = new Map(); // agentRole -> quality profile
    this.errorPatterns = new Map(); // errorType -> occurrences
    this.improvementSuggestions = [];
    
    this.metrics = {
      totalReports: 0,
      avgQualityScore: 0,
      avgConfidence: 0,
      totalErrors: 0,
      errorsByType: {},
      reportsByDimension: {}
    };

    // Initialize error counters
    for (const errorType of Object.values(ERROR_TYPES)) {
      this.metrics.errorsByType[errorType] = 0;
    }

    // Initialize dimension counters
    for (const dimension of Object.values(QUALITY_DIMENSIONS)) {
      this.metrics.reportsByDimension[dimension] = 0;
    }
  }

  /**
   * Report quality for an action
   */
  reportQuality({
    sessionId,
    traceId,
    agentId,
    agentRole,
    action,
    task,
    output,
    dimensions = {},
    confidence,
    reasoning = '',
    errors = [],
    metadata = {}
  }) {
    // Calculate overall quality score
    const qualityScore = this._calculateQualityScore(dimensions);
    
    // Determine confidence level
    const confidenceLevel = this._getConfidenceLevel(confidence);

    const report = {
      reportId: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sessionId,
      traceId,
      agentId,
      agentRole,
      action,
      task,
      output,
      quality: {
        dimensions,
        overallScore: qualityScore,
        confidence,
        confidenceLevel,
        reasoning
      },
      errors,
      metadata
    };

    this.qualityReports.push(report);

    // Update agent profile
    this._updateAgentProfile(agentRole, report);

    // Track errors
    for (const error of errors) {
      this._trackError(error, agentRole, report);
    }

    // Update metrics
    this.metrics.totalReports++;
    this._updateMetrics(report);

    // Generate improvement suggestions if needed
    if (qualityScore < 60 || confidence < 50) {
      this._generateImprovementSuggestion(report);
    }

    // Keep only last 50,000 reports
    if (this.qualityReports.length > 50000) {
      this.qualityReports = this.qualityReports.slice(-50000);
    }

    logger.debug(`Quality report: ${agentRole} - Score: ${qualityScore}, Confidence: ${confidence}%`);

    return report.reportId;
  }

  /**
   * Calculate overall quality score
   */
  _calculateQualityScore(dimensions) {
    const scores = Object.values(dimensions);
    if (scores.length === 0) return 0;

    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round(sum / scores.length);
  }

  /**
   * Get confidence level label
   */
  _getConfidenceLevel(confidence) {
    for (const [level, range] of Object.entries(CONFIDENCE_LEVELS)) {
      if (confidence >= range.min && confidence < range.max) {
        return range.label;
      }
    }
    return CONFIDENCE_LEVELS.VERY_HIGH.label;
  }

  /**
   * Update agent quality profile
   */
  _updateAgentProfile(agentRole, report) {
    let profile = this.agentProfiles.get(agentRole);

    if (!profile) {
      profile = {
        agentRole,
        totalActions: 0,
        avgQualityScore: 0,
        avgConfidence: 0,
        dimensionScores: {},
        errorCount: 0,
        errorRate: 0,
        strengths: [],
        weaknesses: [],
        lastUpdated: new Date()
      };
      this.agentProfiles.set(agentRole, profile);
    }

    profile.totalActions++;
    
    // Update average quality score
    profile.avgQualityScore = 
      ((profile.avgQualityScore * (profile.totalActions - 1)) + report.quality.overallScore) / 
      profile.totalActions;

    // Update average confidence
    profile.avgConfidence = 
      ((profile.avgConfidence * (profile.totalActions - 1)) + report.quality.confidence) / 
      profile.totalActions;

    // Update dimension scores
    for (const [dimension, score] of Object.entries(report.quality.dimensions)) {
      if (!profile.dimensionScores[dimension]) {
        profile.dimensionScores[dimension] = {
          count: 0,
          avgScore: 0
        };
      }

      const dimProfile = profile.dimensionScores[dimension];
      dimProfile.count++;
      dimProfile.avgScore = 
        ((dimProfile.avgScore * (dimProfile.count - 1)) + score) / 
        dimProfile.count;
    }

    // Update error count
    if (report.errors.length > 0) {
      profile.errorCount += report.errors.length;
      profile.errorRate = profile.errorCount / profile.totalActions;
    }

    // Identify strengths and weaknesses
    profile.strengths = this._identifyStrengths(profile.dimensionScores);
    profile.weaknesses = this._identifyWeaknesses(profile.dimensionScores);

    profile.lastUpdated = new Date();
  }

  /**
   * Identify agent strengths
   */
  _identifyStrengths(dimensionScores) {
    const strengths = [];

    for (const [dimension, data] of Object.entries(dimensionScores)) {
      if (data.avgScore >= 80) {
        strengths.push({
          dimension,
          score: data.avgScore,
          sampleSize: data.count
        });
      }
    }

    return strengths.sort((a, b) => b.score - a.score);
  }

  /**
   * Identify agent weaknesses
   */
  _identifyWeaknesses(dimensionScores) {
    const weaknesses = [];

    for (const [dimension, data] of Object.entries(dimensionScores)) {
      if (data.avgScore < 60) {
        weaknesses.push({
          dimension,
          score: data.avgScore,
          sampleSize: data.count
        });
      }
    }

    return weaknesses.sort((a, b) => a.score - b.score);
  }

  /**
   * Track error patterns
   */
  _trackError(error, agentRole, report) {
    const errorType = error.type || ERROR_TYPES.MODEL_ERROR;
    
    if (!this.errorPatterns.has(errorType)) {
      this.errorPatterns.set(errorType, {
        type: errorType,
        count: 0,
        byAgent: {},
        occurrences: []
      });
    }

    const pattern = this.errorPatterns.get(errorType);
    pattern.count++;
    pattern.byAgent[agentRole] = (pattern.byAgent[agentRole] || 0) + 1;
    pattern.occurrences.push({
      timestamp: new Date(),
      agentRole,
      reportId: report.reportId,
      error
    });

    // Keep only last 1000 occurrences per error type
    if (pattern.occurrences.length > 1000) {
      pattern.occurrences = pattern.occurrences.slice(-1000);
    }

    this.metrics.totalErrors++;
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
  }

  /**
   * Generate improvement suggestion
   */
  _generateImprovementSuggestion(report) {
    const suggestions = [];

    // Low quality suggestions
    if (report.quality.overallScore < 60) {
      const weakDimensions = Object.entries(report.quality.dimensions)
        .filter(([_, score]) => score < 60)
        .map(([dim, _]) => dim);

      if (weakDimensions.includes(QUALITY_DIMENSIONS.ACCURACY)) {
        suggestions.push({
          type: 'model_upgrade',
          dimension: QUALITY_DIMENSIONS.ACCURACY,
          suggestion: 'Consider upgrading to a higher-tier model for better accuracy',
          priority: 'high'
        });
      }

      if (weakDimensions.includes(QUALITY_DIMENSIONS.COMPLETENESS)) {
        suggestions.push({
          type: 'context_enhancement',
          dimension: QUALITY_DIMENSIONS.COMPLETENESS,
          suggestion: 'Provide more comprehensive context or examples',
          priority: 'medium'
        });
      }

      if (weakDimensions.includes(QUALITY_DIMENSIONS.EFFICIENCY)) {
        suggestions.push({
          type: 'workflow_optimization',
          dimension: QUALITY_DIMENSIONS.EFFICIENCY,
          suggestion: 'Optimize workflow to reduce token usage and latency',
          priority: 'medium'
        });
      }
    }

    // Low confidence suggestions
    if (report.quality.confidence < 50) {
      suggestions.push({
        type: 'verification',
        dimension: 'confidence',
        suggestion: 'Add verification step or use multiple agents for consensus',
        priority: 'high'
      });
    }

    // Error-specific suggestions
    for (const error of report.errors) {
      if (error.type === ERROR_TYPES.HALLUCINATION) {
        suggestions.push({
          type: 'hallucination_prevention',
          dimension: QUALITY_DIMENSIONS.ACCURACY,
          suggestion: 'Enable hallucination detection and add grounding sources',
          priority: 'critical'
        });
      } else if (error.type === ERROR_TYPES.TIMEOUT) {
        suggestions.push({
          type: 'performance_optimization',
          dimension: QUALITY_DIMENSIONS.TIMELINESS,
          suggestion: 'Break task into smaller chunks or increase timeout',
          priority: 'high'
        });
      }
    }

    if (suggestions.length > 0) {
      const improvement = {
        suggestionId: `is_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        reportId: report.reportId,
        agentRole: report.agentRole,
        qualityScore: report.quality.overallScore,
        confidence: report.quality.confidence,
        suggestions,
        applied: false
      };

      this.improvementSuggestions.push(improvement);

      // Keep only last 10,000 suggestions
      if (this.improvementSuggestions.length > 10000) {
        this.improvementSuggestions = this.improvementSuggestions.slice(-10000);
      }

      logger.info(`Generated ${suggestions.length} improvement suggestions for ${report.agentRole}`);
    }
  }

  /**
   * Update overall metrics
   */
  _updateMetrics(report) {
    // Update average quality score
    this.metrics.avgQualityScore = 
      ((this.metrics.avgQualityScore * (this.metrics.totalReports - 1)) + report.quality.overallScore) / 
      this.metrics.totalReports;

    // Update average confidence
    this.metrics.avgConfidence = 
      ((this.metrics.avgConfidence * (this.metrics.totalReports - 1)) + report.quality.confidence) / 
      this.metrics.totalReports;

    // Count dimension reports
    for (const dimension of Object.keys(report.quality.dimensions)) {
      this.metrics.reportsByDimension[dimension] = 
        (this.metrics.reportsByDimension[dimension] || 0) + 1;
    }
  }

  /**
   * Query quality reports
   */
  queryReports(filters = {}) {
    let results = [...this.qualityReports];

    // Filter by session
    if (filters.sessionId) {
      results = results.filter(r => r.sessionId === filters.sessionId);
    }

    // Filter by trace
    if (filters.traceId) {
      results = results.filter(r => r.traceId === filters.traceId);
    }

    // Filter by agent role
    if (filters.agentRole) {
      results = results.filter(r => r.agentRole === filters.agentRole);
    }

    // Filter by minimum quality score
    if (filters.minQualityScore !== undefined) {
      results = results.filter(r => r.quality.overallScore >= filters.minQualityScore);
    }

    // Filter by maximum quality score
    if (filters.maxQualityScore !== undefined) {
      results = results.filter(r => r.quality.overallScore <= filters.maxQualityScore);
    }

    // Filter by minimum confidence
    if (filters.minConfidence !== undefined) {
      results = results.filter(r => r.quality.confidence >= filters.minConfidence);
    }

    // Filter by confidence level
    if (filters.confidenceLevel) {
      results = results.filter(r => r.quality.confidenceLevel === filters.confidenceLevel);
    }

    // Filter by errors
    if (filters.hasErrors !== undefined) {
      results = results.filter(r => 
        filters.hasErrors ? r.errors.length > 0 : r.errors.length === 0
      );
    }

    // Filter by error type
    if (filters.errorType) {
      results = results.filter(r => 
        r.errors.some(e => e.type === filters.errorType)
      );
    }

    // Filter by time range
    if (filters.startTime) {
      results = results.filter(r => r.timestamp >= new Date(filters.startTime));
    }

    if (filters.endTime) {
      results = results.filter(r => r.timestamp <= new Date(filters.endTime));
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
   * Get agent profile
   */
  getAgentProfile(agentRole) {
    return this.agentProfiles.get(agentRole);
  }

  /**
   * Get all agent profiles
   */
  getAllAgentProfiles() {
    return Array.from(this.agentProfiles.values());
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(errorType = null) {
    if (errorType) {
      return this.errorPatterns.get(errorType);
    }

    return Array.from(this.errorPatterns.values());
  }

  /**
   * Get improvement suggestions
   */
  getImprovementSuggestions(filters = {}) {
    let results = [...this.improvementSuggestions];

    // Filter by agent role
    if (filters.agentRole) {
      results = results.filter(s => s.agentRole === filters.agentRole);
    }

    // Filter by applied status
    if (filters.applied !== undefined) {
      results = results.filter(s => s.applied === filters.applied);
    }

    // Filter by priority
    if (filters.priority) {
      results = results.filter(s => 
        s.suggestions.some(sug => sug.priority === filters.priority)
      );
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    const limit = filters.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Mark suggestion as applied
   */
  applySuggestion(suggestionId) {
    const suggestion = this.improvementSuggestions.find(s => s.suggestionId === suggestionId);
    
    if (suggestion) {
      suggestion.applied = true;
      suggestion.appliedAt = new Date();
      logger.info(`Improvement suggestion ${suggestionId} marked as applied`);
      return true;
    }

    return false;
  }

  /**
   * Get quality benchmark
   */
  getBenchmark() {
    return {
      overall: {
        avgQualityScore: this.metrics.avgQualityScore,
        avgConfidence: this.metrics.avgConfidence,
        totalReports: this.metrics.totalReports,
        errorRate: this.metrics.totalErrors / this.metrics.totalReports
      },
      byAgent: this.getAllAgentProfiles().map(profile => ({
        agentRole: profile.agentRole,
        avgQualityScore: profile.avgQualityScore,
        avgConfidence: profile.avgConfidence,
        errorRate: profile.errorRate,
        strengths: profile.strengths,
        weaknesses: profile.weaknesses
      })),
      topPerformers: this._getTopPerformers(),
      needsImprovement: this._getNeedsImprovement()
    };
  }

  /**
   * Get top performing agents
   */
  _getTopPerformers() {
    return this.getAllAgentProfiles()
      .filter(p => p.totalActions >= 10) // Minimum sample size
      .sort((a, b) => b.avgQualityScore - a.avgQualityScore)
      .slice(0, 5)
      .map(p => ({
        agentRole: p.agentRole,
        avgQualityScore: p.avgQualityScore,
        avgConfidence: p.avgConfidence,
        totalActions: p.totalActions
      }));
  }

  /**
   * Get agents needing improvement
   */
  _getNeedsImprovement() {
    return this.getAllAgentProfiles()
      .filter(p => p.totalActions >= 10 && (p.avgQualityScore < 70 || p.errorRate > 0.1))
      .sort((a, b) => a.avgQualityScore - b.avgQualityScore)
      .slice(0, 5)
      .map(p => ({
        agentRole: p.agentRole,
        avgQualityScore: p.avgQualityScore,
        errorRate: p.errorRate,
        weaknesses: p.weaknesses
      }));
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalQualityReports: this.qualityReports.length,
      agentProfiles: this.agentProfiles.size,
      errorPatterns: this.errorPatterns.size,
      pendingSuggestions: this.improvementSuggestions.filter(s => !s.applied).length
    };
  }

  /**
   * Export reports
   */
  exportReports(format = 'json', filters = {}) {
    const reports = this.queryReports(filters);

    if (format === 'csv') {
      return this._exportCSV(reports);
    } else if (format === 'ndjson') {
      return reports.map(report => JSON.stringify(report)).join('\n');
    }

    return reports;
  }

  /**
   * Export to CSV
   */
  _exportCSV(reports) {
    const headers = ['reportId', 'timestamp', 'agentRole', 'qualityScore', 'confidence', 'confidenceLevel', 'errorCount'];
    const rows = [headers.join(',')];

    for (const report of reports) {
      const row = [
        report.reportId,
        report.timestamp.toISOString(),
        report.agentRole,
        report.quality.overallScore,
        report.quality.confidence,
        report.quality.confidenceLevel,
        report.errors.length
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

// Singleton instance
module.exports = new QualityIndex();
