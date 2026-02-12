/**
 * Learning Engine
 * 
 * Adaptive learning system that improves over time through:
 * - User feedback analysis
 * - Pattern recognition
 * - Model performance tracking
 * - Automatic optimization recommendations
 */

const logger = require('../../utils/logger');

/**
 * Feedback types
 */
const FEEDBACK_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  CORRECTION: 'correction'
};

/**
 * Learning patterns
 */
const PATTERN_TYPES = {
  MODEL_PERFORMANCE: 'model_performance',
  AGENT_SELECTION: 'agent_selection',
  WORKFLOW_EFFICIENCY: 'workflow_efficiency',
  COST_OPTIMIZATION: 'cost_optimization',
  QUALITY_IMPROVEMENT: 'quality_improvement'
};

class LearningEngine {
  constructor() {
    this.feedbackHistory = []; // All user feedback
    this.patterns = new Map(); // Learned patterns
    this.recommendations = new Map(); // Active recommendations
    
    this.metrics = {
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      correctionsReceived: 0,
      patternsIdentified: 0,
      recommendationsGenerated: 0,
      recommendationsApplied: 0,
      learningAccuracy: 0
    };

    // Initialize pattern tracking
    for (const patternType of Object.values(PATTERN_TYPES)) {
      this.patterns.set(patternType, {
        type: patternType,
        observations: [],
        confidence: 0,
        rules: []
      });
    }
  }

  /**
   * Record user feedback
   */
  recordFeedback({
    userId,
    workflowId,
    evaluationId,
    feedbackType,
    rating,
    comment,
    corrections = {},
    context = {}
  }) {
    const feedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      workflowId,
      evaluationId,
      feedbackType,
      rating,
      comment,
      corrections,
      context,
      timestamp: new Date()
    };

    this.feedbackHistory.push(feedback);

    // Update metrics
    this.metrics.totalFeedback++;
    
    switch (feedbackType) {
      case FEEDBACK_TYPES.POSITIVE:
        this.metrics.positiveFeedback++;
        break;
      case FEEDBACK_TYPES.NEGATIVE:
        this.metrics.negativeFeedback++;
        break;
      case FEEDBACK_TYPES.CORRECTION:
        this.metrics.correctionsReceived++;
        break;
    }

    // Analyze feedback for patterns
    this._analyzeFeedback(feedback);

    // Keep only last 10,000 feedback entries
    if (this.feedbackHistory.length > 10000) {
      this.feedbackHistory = this.feedbackHistory.slice(-10000);
    }

    logger.info(`Feedback recorded: ${feedbackType} for workflow ${workflowId}`);

    return feedback.id;
  }

  /**
   * Analyze feedback for learning
   */
  _analyzeFeedback(feedback) {
    // Model performance pattern
    if (feedback.context.model) {
      this._learnModelPerformance(feedback);
    }

    // Agent selection pattern
    if (feedback.context.agents) {
      this._learnAgentSelection(feedback);
    }

    // Workflow efficiency pattern
    if (feedback.context.workflow) {
      this._learnWorkflowEfficiency(feedback);
    }

    // Cost optimization pattern
    if (feedback.context.cost) {
      this._learnCostOptimization(feedback);
    }

    // Quality improvement pattern
    if (feedback.context.evaluation) {
      this._learnQualityImprovement(feedback);
    }
  }

  /**
   * Learn model performance patterns
   */
  _learnModelPerformance(feedback) {
    const pattern = this.patterns.get(PATTERN_TYPES.MODEL_PERFORMANCE);
    
    pattern.observations.push({
      model: feedback.context.model,
      taskType: feedback.context.taskType,
      rating: feedback.rating,
      success: feedback.feedbackType === FEEDBACK_TYPES.POSITIVE,
      timestamp: feedback.timestamp
    });

    // Identify top-performing models for each task type
    const modelsByTask = this._groupBy(pattern.observations, 'taskType');
    
    pattern.rules = Object.entries(modelsByTask).map(([taskType, obs]) => {
      const modelScores = this._aggregateByField(obs, 'model', 'rating');
      const bestModel = Object.entries(modelScores).reduce((best, [model, score]) => 
        score > best.score ? { model, score } : best,
        { model: null, score: 0 }
      );

      return {
        taskType,
        recommendedModel: bestModel.model,
        confidence: this._calculateConfidence(obs.length),
        avgRating: bestModel.score
      };
    });

    pattern.confidence = this._calculateOverallConfidence(pattern.observations);
    this.metrics.patternsIdentified++;
  }

  /**
   * Learn agent selection patterns
   */
  _learnAgentSelection(feedback) {
    const pattern = this.patterns.get(PATTERN_TYPES.AGENT_SELECTION);
    
    const agents = feedback.context.agents || [];
    
    pattern.observations.push({
      agents: agents.map(a => a.role),
      taskType: feedback.context.taskType,
      complexity: feedback.context.complexity,
      rating: feedback.rating,
      success: feedback.feedbackType === FEEDBACK_TYPES.POSITIVE,
      timestamp: feedback.timestamp
    });

    // Identify effective agent combinations
    pattern.rules = this._identifyEffectiveAgentCombos(pattern.observations);
    pattern.confidence = this._calculateOverallConfidence(pattern.observations);
  }

  /**
   * Learn workflow efficiency patterns
   */
  _learnWorkflowEfficiency(feedback) {
    const pattern = this.patterns.get(PATTERN_TYPES.WORKFLOW_EFFICIENCY);
    
    pattern.observations.push({
      workflowMode: feedback.context.workflow?.mode,
      duration: feedback.context.workflow?.duration,
      agentCount: feedback.context.workflow?.agents?.length || 0,
      rating: feedback.rating,
      success: feedback.feedbackType === FEEDBACK_TYPES.POSITIVE,
      timestamp: feedback.timestamp
    });

    // Identify optimal workflow modes
    const modeScores = this._aggregateByField(pattern.observations, 'workflowMode', 'rating');
    
    pattern.rules = Object.entries(modeScores).map(([mode, score]) => ({
      workflowMode: mode,
      avgRating: score,
      confidence: this._calculateConfidence(
        pattern.observations.filter(o => o.workflowMode === mode).length
      )
    })).sort((a, b) => b.avgRating - a.avgRating);

    pattern.confidence = this._calculateOverallConfidence(pattern.observations);
  }

  /**
   * Learn cost optimization patterns
   */
  _learnCostOptimization(feedback) {
    const pattern = this.patterns.get(PATTERN_TYPES.COST_OPTIMIZATION);
    
    pattern.observations.push({
      cost: feedback.context.cost,
      quality: feedback.context.evaluation?.overallScore || feedback.rating,
      model: feedback.context.model,
      roi: feedback.context.roi,
      rating: feedback.rating,
      success: feedback.feedbackType === FEEDBACK_TYPES.POSITIVE,
      timestamp: feedback.timestamp
    });

    // Identify cost-effective strategies
    pattern.rules = this._identifyCostEffectiveStrategies(pattern.observations);
    pattern.confidence = this._calculateOverallConfidence(pattern.observations);
  }

  /**
   * Learn quality improvement patterns
   */
  _learnQualityImprovement(feedback) {
    const pattern = this.patterns.get(PATTERN_TYPES.QUALITY_IMPROVEMENT);
    
    const evaluation = feedback.context.evaluation || {};
    
    pattern.observations.push({
      qualityScore: evaluation.overallScore,
      hallucination: evaluation.scores?.hallucination,
      accuracy: evaluation.scores?.accuracy,
      userRating: feedback.rating,
      userFeedback: feedback.feedbackType,
      timestamp: feedback.timestamp
    });

    // Identify quality thresholds
    const successfulObs = pattern.observations.filter(o => 
      o.userFeedback === FEEDBACK_TYPES.POSITIVE
    );

    if (successfulObs.length > 10) {
      pattern.rules = [{
        type: 'quality_threshold',
        minQualityScore: this._calculatePercentile(successfulObs, 'qualityScore', 0.25),
        maxHallucination: this._calculatePercentile(successfulObs, 'hallucination', 0.75),
        minAccuracy: this._calculatePercentile(successfulObs, 'accuracy', 0.25),
        confidence: this._calculateConfidence(successfulObs.length)
      }];
    }

    pattern.confidence = this._calculateOverallConfidence(pattern.observations);
  }

  /**
   * Generate recommendations based on learned patterns
   */
  generateRecommendations(context = {}) {
    const recommendations = [];

    // Model performance recommendations
    if (context.taskType) {
      const modelRec = this._getModelRecommendation(context.taskType);
      if (modelRec) {
        recommendations.push(modelRec);
      }
    }

    // Agent selection recommendations
    if (context.taskType || context.complexity) {
      const agentRec = this._getAgentRecommendation(context);
      if (agentRec) {
        recommendations.push(agentRec);
      }
    }

    // Workflow efficiency recommendations
    const workflowRec = this._getWorkflowRecommendation(context);
    if (workflowRec) {
      recommendations.push(workflowRec);
    }

    // Cost optimization recommendations
    if (context.budget || context.costTarget) {
      const costRec = this._getCostRecommendation(context);
      if (costRec) {
        recommendations.push(costRec);
      }
    }

    // Store recommendations
    const recId = `rec_${Date.now()}`;
    this.recommendations.set(recId, {
      id: recId,
      context,
      recommendations,
      createdAt: new Date(),
      applied: false
    });

    this.metrics.recommendationsGenerated++;

    return recommendations;
  }

  /**
   * Get model recommendation
   */
  _getModelRecommendation(taskType) {
    const pattern = this.patterns.get(PATTERN_TYPES.MODEL_PERFORMANCE);
    
    const rule = pattern.rules.find(r => r.taskType === taskType);
    
    if (rule && rule.confidence > 0.6) {
      return {
        type: 'model_selection',
        priority: 'high',
        confidence: rule.confidence,
        suggestion: `Use ${rule.recommendedModel} for ${taskType} tasks`,
        model: rule.recommendedModel,
        expectedRating: rule.avgRating,
        reasoning: `Based on ${pattern.observations.filter(o => o.taskType === taskType).length} observations with ${(rule.avgRating * 10).toFixed(0)}% success rate`
      };
    }

    return null;
  }

  /**
   * Get agent recommendation
   */
  _getAgentRecommendation(context) {
    const pattern = this.patterns.get(PATTERN_TYPES.AGENT_SELECTION);
    
    if (pattern.rules.length === 0 || pattern.confidence < 0.5) {
      return null;
    }

    const bestCombo = pattern.rules[0]; // Already sorted by success rate
    
    return {
      type: 'agent_selection',
      priority: 'medium',
      confidence: bestCombo.confidence,
      suggestion: `Recommended agent combination: ${bestCombo.agents.join(', ')}`,
      agents: bestCombo.agents,
      expectedRating: bestCombo.avgRating,
      reasoning: `Proven effective in ${bestCombo.observations} similar cases`
    };
  }

  /**
   * Get workflow recommendation
   */
  _getWorkflowRecommendation(context) {
    const pattern = this.patterns.get(PATTERN_TYPES.WORKFLOW_EFFICIENCY);
    
    if (pattern.rules.length === 0) {
      return null;
    }

    const topMode = pattern.rules[0]; // Already sorted by rating
    
    if (topMode.confidence > 0.5) {
      return {
        type: 'workflow_mode',
        priority: 'medium',
        confidence: topMode.confidence,
        suggestion: `Use ${topMode.workflowMode} workflow mode`,
        workflowMode: topMode.workflowMode,
        expectedRating: topMode.avgRating,
        reasoning: `Highest average rating: ${topMode.avgRating.toFixed(2)}/10`
      };
    }

    return null;
  }

  /**
   * Get cost optimization recommendation
   */
  _getCostRecommendation(context) {
    const pattern = this.patterns.get(PATTERN_TYPES.COST_OPTIMIZATION);
    
    if (pattern.rules.length === 0) {
      return null;
    }

    const bestStrategy = pattern.rules[0];
    
    return {
      type: 'cost_optimization',
      priority: 'high',
      confidence: bestStrategy.confidence,
      suggestion: bestStrategy.suggestion,
      expectedCost: bestStrategy.avgCost,
      expectedQuality: bestStrategy.avgQuality,
      expectedROI: bestStrategy.avgROI,
      reasoning: bestStrategy.reasoning
    };
  }

  /**
   * Mark recommendation as applied
   */
  applyRecommendation(recommendationId, result) {
    const rec = this.recommendations.get(recommendationId);
    
    if (rec) {
      rec.applied = true;
      rec.appliedAt = new Date();
      rec.result = result;
      
      this.metrics.recommendationsApplied++;
      
      // Learn from the outcome
      if (result.success) {
        this.metrics.learningAccuracy = 
          (this.metrics.learningAccuracy * (this.metrics.recommendationsApplied - 1) + 1) / 
          this.metrics.recommendationsApplied;
      } else {
        this.metrics.learningAccuracy = 
          (this.metrics.learningAccuracy * (this.metrics.recommendationsApplied - 1)) / 
          this.metrics.recommendationsApplied;
      }
    }
  }

  // Helper methods

  _groupBy(array, field) {
    return array.reduce((groups, item) => {
      const key = item[field];
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  _aggregateByField(observations, groupField, valueField) {
    const groups = this._groupBy(observations, groupField);
    
    return Object.entries(groups).reduce((scores, [key, obs]) => {
      scores[key] = obs.reduce((sum, o) => sum + (o[valueField] || 0), 0) / obs.length;
      return scores;
    }, {});
  }

  _calculateConfidence(observationCount) {
    // More observations = higher confidence (capped at 1.0)
    return Math.min(observationCount / 50, 1.0);
  }

  _calculateOverallConfidence(observations) {
    if (observations.length === 0) return 0;
    
    // Confidence based on observation count and recency
    const countFactor = Math.min(observations.length / 100, 1.0);
    
    const recent = observations.filter(o => 
      Date.now() - o.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    const recencyFactor = recent.length / Math.max(observations.length, 1);
    
    return (countFactor + recencyFactor) / 2;
  }

  _calculatePercentile(observations, field, percentile) {
    const values = observations.map(o => o[field]).filter(v => v !== undefined).sort((a, b) => a - b);
    const index = Math.floor(values.length * percentile);
    return values[index] || 0;
  }

  _identifyEffectiveAgentCombos(observations) {
    const combos = {};
    
    observations.forEach(obs => {
      const key = obs.agents.sort().join(',');
      combos[key] = combos[key] || { agents: obs.agents, observations: 0, avgRating: 0, totalRating: 0 };
      combos[key].observations++;
      combos[key].totalRating += obs.rating || 0;
    });
    
    return Object.values(combos)
      .map(combo => ({
        ...combo,
        avgRating: combo.totalRating / combo.observations,
        confidence: this._calculateConfidence(combo.observations)
      }))
      .filter(combo => combo.observations >= 3) // Min 3 observations
      .sort((a, b) => b.avgRating - a.avgRating);
  }

  _identifyCostEffectiveStrategies(observations) {
    // Find sweet spot: good quality at low cost
    const strategies = observations
      .filter(o => o.cost && o.quality)
      .map(o => ({
        ...o,
        efficiency: o.quality / Math.max(o.cost, 0.01) // Quality per dollar
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    if (strategies.length < 5) return [];

    const top = strategies.slice(0, Math.ceil(strategies.length * 0.2)); // Top 20%
    
    return [{
      type: 'cost_effective_strategy',
      suggestion: `Target cost range: $${this._avg(top, 'cost').toFixed(4)} for quality score ${this._avg(top, 'quality').toFixed(2)}`,
      avgCost: this._avg(top, 'cost'),
      avgQuality: this._avg(top, 'quality'),
      avgROI: this._avg(top, 'roi'),
      confidence: this._calculateConfidence(top.length),
      reasoning: `Based on ${top.length} high-efficiency workflows`
    }];
  }

  _avg(array, field) {
    return array.reduce((sum, item) => sum + (item[field] || 0), 0) / Math.max(array.length, 1);
  }

  /**
   * Get feedback history
   */
  getFeedbackHistory(filters = {}) {
    let feedback = [...this.feedbackHistory];

    if (filters.userId) {
      feedback = feedback.filter(f => f.userId === filters.userId);
    }

    if (filters.feedbackType) {
      feedback = feedback.filter(f => f.feedbackType === filters.feedbackType);
    }

    if (filters.minRating !== undefined) {
      feedback = feedback.filter(f => f.rating >= filters.minRating);
    }

    return feedback.slice(0, filters.limit || 100);
  }

  /**
   * Get learned patterns
   */
  getPatterns() {
    return Array.from(this.patterns.values()).map(pattern => ({
      type: pattern.type,
      confidence: pattern.confidence,
      observations: pattern.observations.length,
      rules: pattern.rules.length
    }));
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Export learning data
   */
  exportLearningData() {
    return {
      metrics: this.metrics,
      patterns: Array.from(this.patterns.entries()).map(([type, pattern]) => ({
        type,
        confidence: pattern.confidence,
        observations: pattern.observations,
        rules: pattern.rules
      })),
      feedback: this.feedbackHistory.slice(-1000) // Last 1000
    };
  }
}

// Singleton instance
module.exports = new LearningEngine();
