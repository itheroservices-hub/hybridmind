/**
 * LLM-as-Judge Evaluation Engine
 * 
 * Evaluates agent outputs using LLM judges for:
 * - Component-level evaluation (individual agent outputs)
 * - End-to-end evaluation (full workflow results)
 * - Hallucination detection
 * - Accuracy scoring
 * - Quality metrics
 */

const logger = require('../../utils/logger');
const modelSelector = require('../agents/modelSelector');

/**
 * Evaluation Criteria
 */
const EVALUATION_CRITERIA = {
  ACCURACY: {
    name: 'accuracy',
    description: 'Factual correctness and precision',
    weight: 0.3,
    scale: { min: 0, max: 10 }
  },
  COMPLETENESS: {
    name: 'completeness',
    description: 'Coverage of all required aspects',
    weight: 0.25,
    scale: { min: 0, max: 10 }
  },
  RELEVANCE: {
    name: 'relevance',
    description: 'Alignment with task requirements',
    weight: 0.2,
    scale: { min: 0, max: 10 }
  },
  COHERENCE: {
    name: 'coherence',
    description: 'Logical flow and consistency',
    weight: 0.15,
    scale: { min: 0, max: 10 }
  },
  HALLUCINATION: {
    name: 'hallucination',
    description: 'Presence of fabricated information',
    weight: 0.1,
    scale: { min: 0, max: 10 }, // Higher = more hallucination
    inverse: true // Lower is better
  }
};

/**
 * Judge Models (using cost-effective models for evaluation)
 */
const JUDGE_MODELS = {
  component: 'groq/llama-3.1-8b-instant', // Fast, cheap for component eval
  endToEnd: 'openrouter/meta-llama/llama-3.1-70b-instruct', // More powerful for E2E
  hallucination: 'groq/llama-3.1-8b-instant' // Specialized hallucination detection
};

class EvaluationEngine {
  constructor() {
    this.evaluations = new Map(); // evaluationId -> evaluation
    this.metrics = {
      totalEvaluations: 0,
      componentEvaluations: 0,
      endToEndEvaluations: 0,
      avgAccuracy: 0,
      avgHallucinationRate: 0,
      avgQualityScore: 0,
      evaluationsByAgent: {},
      evaluationsByModel: {}
    };
  }

  /**
   * Evaluate component-level output (single agent)
   */
  async evaluateComponent({
    task,
    output,
    agentId,
    agentRole,
    model,
    context = {}
  }) {
    const evaluationId = `eval_comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info(`Evaluating component: ${agentId} (${agentRole})`);

    const evaluation = {
      id: evaluationId,
      type: 'component',
      agentId,
      agentRole,
      model,
      task,
      output,
      context,
      timestamp: new Date(),
      scores: {},
      overallScore: 0,
      hallucinationDetected: false,
      issues: [],
      recommendations: []
    };

    try {
      // Evaluate each criterion
      for (const [key, criterion] of Object.entries(EVALUATION_CRITERIA)) {
        const score = await this._evaluateCriterion(
          task,
          output,
          criterion,
          context,
          'component'
        );
        
        evaluation.scores[criterion.name] = score;
      }

      // Check for hallucinations specifically
      evaluation.hallucinationDetected = evaluation.scores.hallucination > 5;
      
      // Calculate overall score (weighted average)
      evaluation.overallScore = this._calculateWeightedScore(evaluation.scores);

      // Generate recommendations
      evaluation.recommendations = this._generateRecommendations(evaluation.scores);

      // Identify issues
      evaluation.issues = this._identifyIssues(evaluation.scores);

      // Update metrics
      this._updateComponentMetrics(evaluation);

      this.evaluations.set(evaluationId, evaluation);

      logger.info(`Component evaluation complete: ${evaluation.overallScore.toFixed(2)}/10`);

      return evaluation;

    } catch (error) {
      logger.error(`Component evaluation failed: ${error.message}`);
      evaluation.error = error.message;
      return evaluation;
    }
  }

  /**
   * Evaluate end-to-end workflow
   */
  async evaluateEndToEnd({
    task,
    workflow,
    finalOutput,
    agents,
    duration,
    context = {}
  }) {
    const evaluationId = `eval_e2e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info(`Evaluating end-to-end workflow: ${workflow.id}`);

    const evaluation = {
      id: evaluationId,
      type: 'end-to-end',
      workflowId: workflow.id,
      task,
      finalOutput,
      agents,
      duration,
      context,
      timestamp: new Date(),
      scores: {},
      overallScore: 0,
      hallucinationDetected: false,
      componentEvaluations: [],
      issues: [],
      recommendations: [],
      roi: null
    };

    try {
      // Evaluate each criterion for the final output
      for (const [key, criterion] of Object.entries(EVALUATION_CRITERIA)) {
        const score = await this._evaluateCriterion(
          task,
          finalOutput,
          criterion,
          {
            ...context,
            workflow,
            agents,
            duration
          },
          'end-to-end'
        );
        
        evaluation.scores[criterion.name] = score;
      }

      // Check for hallucinations
      evaluation.hallucinationDetected = evaluation.scores.hallucination > 5;

      // Calculate overall score
      evaluation.overallScore = this._calculateWeightedScore(evaluation.scores);

      // Evaluate individual agent contributions
      if (workflow.steps && workflow.steps.length > 0) {
        for (const step of workflow.steps) {
          if (step.result) {
            const componentEval = await this.evaluateComponent({
              task: step.task || task,
              output: step.result,
              agentId: step.agentId,
              agentRole: step.agentRole,
              model: step.model,
              context: { workflowId: workflow.id }
            });
            
            evaluation.componentEvaluations.push(componentEval);
          }
        }
      }

      // Calculate ROI
      evaluation.roi = this._calculateROI(evaluation, workflow, context);

      // Generate recommendations
      evaluation.recommendations = this._generateE2ERecommendations(
        evaluation.scores,
        evaluation.componentEvaluations,
        evaluation.roi
      );

      // Identify issues
      evaluation.issues = this._identifyE2EIssues(
        evaluation.scores,
        evaluation.componentEvaluations
      );

      // Update metrics
      this._updateE2EMetrics(evaluation);

      this.evaluations.set(evaluationId, evaluation);

      logger.info(`E2E evaluation complete: ${evaluation.overallScore.toFixed(2)}/10, ROI: ${evaluation.roi.value}`);

      return evaluation;

    } catch (error) {
      logger.error(`E2E evaluation failed: ${error.message}`);
      evaluation.error = error.message;
      return evaluation;
    }
  }

  /**
   * Evaluate specific criterion using LLM judge
   */
  async _evaluateCriterion(task, output, criterion, context, evaluationType) {
    const judgeModel = evaluationType === 'component' 
      ? JUDGE_MODELS.component 
      : JUDGE_MODELS.endToEnd;

    const judgePrompt = this._buildJudgePrompt(
      task,
      output,
      criterion,
      context,
      evaluationType
    );

    try {
      // Call LLM judge
      const response = await modelSelector.callModel(judgeModel, judgePrompt, {
        temperature: 0.1, // Low temp for consistent evaluation
        maxTokens: 500
      });

      // Parse score from response
      const score = this._parseScore(response, criterion);

      return score;

    } catch (error) {
      logger.error(`Judge evaluation failed for ${criterion.name}: ${error.message}`);
      return 5; // Default to middle score on error
    }
  }

  /**
   * Build evaluation prompt for LLM judge
   */
  _buildJudgePrompt(task, output, criterion, context, evaluationType) {
    const basePrompt = `You are an expert evaluator assessing the quality of an AI agent's output.

**Task Given to Agent:**
${task}

**Agent's Output:**
${output}

**Evaluation Criterion:** ${criterion.description}

**Instructions:**
Evaluate the output on a scale of ${criterion.scale.min} to ${criterion.scale.max} for ${criterion.name}.
${criterion.inverse ? 'Note: Higher scores indicate MORE problems (this is inverse scoring).' : 'Note: Higher scores indicate BETTER quality.'}

Provide your evaluation in this format:
SCORE: [number between ${criterion.scale.min}-${criterion.scale.max}]
REASONING: [brief explanation of your score]

Focus specifically on ${criterion.name}: ${criterion.description}
`;

    // Add context-specific instructions
    if (evaluationType === 'end-to-end' && context.workflow) {
      return basePrompt + `\n**Additional Context:**
This is an end-to-end evaluation. The output is the final result of a ${context.workflow.mode} workflow involving ${context.agents?.length || 0} agents.
Duration: ${context.duration}ms
Consider the overall quality and integration of all components.`;
    }

    if (criterion.name === 'hallucination') {
      return basePrompt + `\n**Hallucination Detection:**
Look for:
- Fabricated facts or data not present in the task
- Invented code libraries or APIs that don't exist
- False claims about capabilities or limitations
- Made-up statistics or numbers
- Contradictions with established facts

SCORE: 0 = No hallucinations, 10 = Severe hallucinations`;
    }

    return basePrompt;
  }

  /**
   * Parse score from judge response
   */
  _parseScore(response, criterion) {
    // Look for "SCORE: X" pattern
    const scoreMatch = response.match(/SCORE:\s*(\d+(?:\.\d+)?)/i);
    
    if (scoreMatch) {
      let score = parseFloat(scoreMatch[1]);
      
      // Clamp to valid range
      score = Math.max(criterion.scale.min, Math.min(criterion.scale.max, score));
      
      return score;
    }

    // Fallback: look for any number in first line
    const firstLine = response.split('\n')[0];
    const numberMatch = firstLine.match(/(\d+(?:\.\d+)?)/);
    
    if (numberMatch) {
      let score = parseFloat(numberMatch[1]);
      score = Math.max(criterion.scale.min, Math.min(criterion.scale.max, score));
      return score;
    }

    // Default to middle score if parsing fails
    return (criterion.scale.min + criterion.scale.max) / 2;
  }

  /**
   * Calculate weighted overall score
   */
  _calculateWeightedScore(scores) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, criterion] of Object.entries(EVALUATION_CRITERIA)) {
      const score = scores[criterion.name] || 0;
      const normalizedScore = criterion.inverse ? (10 - score) : score;
      
      totalScore += normalizedScore * criterion.weight;
      totalWeight += criterion.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Generate recommendations based on scores
   */
  _generateRecommendations(scores) {
    const recommendations = [];

    if (scores.accuracy < 7) {
      recommendations.push({
        priority: 'high',
        area: 'accuracy',
        suggestion: 'Improve factual correctness by verifying information against reliable sources',
        score: scores.accuracy
      });
    }

    if (scores.completeness < 7) {
      recommendations.push({
        priority: 'medium',
        area: 'completeness',
        suggestion: 'Ensure all aspects of the task are addressed comprehensively',
        score: scores.completeness
      });
    }

    if (scores.hallucination > 3) {
      recommendations.push({
        priority: 'critical',
        area: 'hallucination',
        suggestion: 'Reduce fabricated information. Use more conservative model parameters or add fact-checking',
        score: scores.hallucination
      });
    }

    if (scores.relevance < 7) {
      recommendations.push({
        priority: 'medium',
        area: 'relevance',
        suggestion: 'Better align output with task requirements and context',
        score: scores.relevance
      });
    }

    if (scores.coherence < 7) {
      recommendations.push({
        priority: 'low',
        area: 'coherence',
        suggestion: 'Improve logical flow and consistency throughout the output',
        score: scores.coherence
      });
    }

    return recommendations.sort((a, b) => {
      const priority = { critical: 0, high: 1, medium: 2, low: 3 };
      return priority[a.priority] - priority[b.priority];
    });
  }

  /**
   * Generate E2E-specific recommendations
   */
  _generateE2ERecommendations(scores, componentEvals, roi) {
    const recommendations = this._generateRecommendations(scores);

    // Add ROI-based recommendations
    if (roi && roi.value < 1) {
      recommendations.push({
        priority: 'high',
        area: 'roi',
        suggestion: `ROI is ${roi.value.toFixed(2)}x. Consider optimizing workflow or using cheaper models`,
        value: roi.value
      });
    }

    // Add component-specific recommendations
    if (componentEvals && componentEvals.length > 0) {
      const weakestComponent = componentEvals.reduce((min, currentEval) => 
        currentEval.overallScore < min.overallScore ? currentEval : min
      );

      if (weakestComponent.overallScore < 7) {
        recommendations.push({
          priority: 'medium',
          area: 'component-quality',
          suggestion: `Agent ${weakestComponent.agentRole} scored ${weakestComponent.overallScore.toFixed(2)}/10. Consider different model or improved prompting`,
          agent: weakestComponent.agentRole,
          score: weakestComponent.overallScore
        });
      }
    }

    return recommendations;
  }

  /**
   * Identify issues from scores
   */
  _identifyIssues(scores) {
    const issues = [];

    if (scores.hallucination > 5) {
      issues.push({
        severity: 'critical',
        type: 'hallucination',
        message: `High hallucination detected (${scores.hallucination}/10)`,
        score: scores.hallucination
      });
    }

    if (scores.accuracy < 5) {
      issues.push({
        severity: 'high',
        type: 'accuracy',
        message: `Low accuracy score (${scores.accuracy}/10)`,
        score: scores.accuracy
      });
    }

    if (scores.completeness < 5) {
      issues.push({
        severity: 'medium',
        type: 'completeness',
        message: `Incomplete output (${scores.completeness}/10)`,
        score: scores.completeness
      });
    }

    return issues;
  }

  /**
   * Identify E2E-specific issues
   */
  _identifyE2EIssues(scores, componentEvals) {
    const issues = this._identifyIssues(scores);

    // Check for component consistency
    if (componentEvals && componentEvals.length > 1) {
      const scores = componentEvals.map(e => e.overallScore);
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;

      if (variance > 4) {
        issues.push({
          severity: 'medium',
          type: 'consistency',
          message: `High variance in component quality (σ²=${variance.toFixed(2)})`,
          variance
        });
      }
    }

    return issues;
  }

  /**
   * Calculate ROI for workflow
   */
  _calculateROI(evaluation, workflow, context) {
    // Estimate value generated (quality * completeness * relevance)
    const qualityScore = evaluation.overallScore / 10;
    const completenessScore = (evaluation.scores.completeness || 7) / 10;
    const relevanceScore = (evaluation.scores.relevance || 7) / 10;
    
    const valueGenerated = qualityScore * completenessScore * relevanceScore * 100;

    // Estimate cost (tokens + time)
    const estimatedTokens = context.totalTokens || workflow.agents?.length * 5000 || 10000;
    const costPerToken = 0.0001; // $0.0001 per token (average)
    const tokenCost = estimatedTokens * costPerToken;
    
    const timeValueCost = (workflow.duration || duration || 5000) / 1000 * 0.01; // $0.01 per second
    
    const totalCost = tokenCost + timeValueCost;

    // ROI = Value / Cost
    const roi = totalCost > 0 ? valueGenerated / totalCost : 0;

    return {
      value: roi,
      valueGenerated,
      totalCost,
      breakdown: {
        tokenCost,
        timeValueCost,
        estimatedTokens
      },
      interpretation: roi > 10 ? 'excellent' : roi > 5 ? 'good' : roi > 1 ? 'acceptable' : 'poor'
    };
  }

  /**
   * Update component metrics
   */
  _updateComponentMetrics(evaluation) {
    this.metrics.totalEvaluations++;
    this.metrics.componentEvaluations++;

    // Update averages
    const n = this.metrics.componentEvaluations;
    this.metrics.avgAccuracy = 
      (this.metrics.avgAccuracy * (n - 1) + evaluation.scores.accuracy) / n;
    this.metrics.avgHallucinationRate = 
      (this.metrics.avgHallucinationRate * (n - 1) + evaluation.scores.hallucination) / n;
    this.metrics.avgQualityScore = 
      (this.metrics.avgQualityScore * (n - 1) + evaluation.overallScore) / n;

    // Track by agent
    if (!this.metrics.evaluationsByAgent[evaluation.agentRole]) {
      this.metrics.evaluationsByAgent[evaluation.agentRole] = {
        count: 0,
        avgScore: 0,
        avgHallucination: 0
      };
    }
    
    const agentMetrics = this.metrics.evaluationsByAgent[evaluation.agentRole];
    agentMetrics.count++;
    agentMetrics.avgScore = 
      (agentMetrics.avgScore * (agentMetrics.count - 1) + evaluation.overallScore) / agentMetrics.count;
    agentMetrics.avgHallucination = 
      (agentMetrics.avgHallucination * (agentMetrics.count - 1) + evaluation.scores.hallucination) / agentMetrics.count;

    // Track by model
    if (!this.metrics.evaluationsByModel[evaluation.model]) {
      this.metrics.evaluationsByModel[evaluation.model] = {
        count: 0,
        avgScore: 0,
        avgHallucination: 0
      };
    }
    
    const modelMetrics = this.metrics.evaluationsByModel[evaluation.model];
    modelMetrics.count++;
    modelMetrics.avgScore = 
      (modelMetrics.avgScore * (modelMetrics.count - 1) + evaluation.overallScore) / modelMetrics.count;
    modelMetrics.avgHallucination = 
      (modelMetrics.avgHallucination * (modelMetrics.count - 1) + evaluation.scores.hallucination) / modelMetrics.count;
  }

  /**
   * Update E2E metrics
   */
  _updateE2EMetrics(evaluation) {
    this.metrics.totalEvaluations++;
    this.metrics.endToEndEvaluations++;

    const n = this.metrics.endToEndEvaluations;
    this.metrics.avgAccuracy = 
      (this.metrics.avgAccuracy * (n - 1) + evaluation.scores.accuracy) / n;
    this.metrics.avgHallucinationRate = 
      (this.metrics.avgHallucinationRate * (n - 1) + evaluation.scores.hallucination) / n;
    this.metrics.avgQualityScore = 
      (this.metrics.avgQualityScore * (n - 1) + evaluation.overallScore) / n;
  }

  /**
   * Get evaluation by ID
   */
  getEvaluation(evaluationId) {
    return this.evaluations.get(evaluationId);
  }

  /**
   * Get all evaluations
   */
  getAllEvaluations(filters = {}) {
    let evals = Array.from(this.evaluations.values());

    if (filters.type) {
      evals = evals.filter(e => e.type === filters.type);
    }

    if (filters.agentRole) {
      evals = evals.filter(e => e.agentRole === filters.agentRole);
    }

    if (filters.minScore !== undefined) {
      evals = evals.filter(e => e.overallScore >= filters.minScore);
    }

    if (filters.hallucinationDetected !== undefined) {
      evals = evals.filter(e => e.hallucinationDetected === filters.hallucinationDetected);
    }

    return evals;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Clear old evaluations (keep last 1000)
   */
  clearOldEvaluations() {
    if (this.evaluations.size > 1000) {
      const sorted = Array.from(this.evaluations.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      const toKeep = sorted.slice(0, 1000);
      this.evaluations = new Map(toKeep);
      
      logger.info(`Cleared old evaluations, kept ${toKeep.length}`);
    }
  }
}

// Singleton instance
module.exports = new EvaluationEngine();
