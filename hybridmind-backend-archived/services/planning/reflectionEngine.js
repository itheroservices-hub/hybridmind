/**
 * Reflection Engine - Critiques outputs, identifies gaps, and suggests improvements
 * Implements the reflection loop for iterative refinement
 */

const logger = require('../../utils/logger');
const modelProxy = require('../modelProxy');

class ReflectionEngine {
  constructor() {
    this.defaultModel = 'gpt-4o-mini'; // Cost-efficient for reflection
    
    // Reflection criteria by category
    this.reflectionCriteria = {
      completeness: {
        weight: 0.3,
        checks: [
          'All requirements addressed',
          'No missing steps or components',
          'Edge cases considered',
          'Dependencies identified'
        ]
      },
      correctness: {
        weight: 0.3,
        checks: [
          'Logic is sound',
          'No obvious errors',
          'Follows best practices',
          'Syntax and structure valid'
        ]
      },
      quality: {
        weight: 0.2,
        checks: [
          'Code is maintainable',
          'Clear and readable',
          'Well-documented',
          'Follows conventions'
        ]
      },
      efficiency: {
        weight: 0.1,
        checks: [
          'Optimal approach used',
          'No unnecessary complexity',
          'Resource-efficient',
          'Scalable solution'
        ]
      },
      risks: {
        weight: 0.1,
        checks: [
          'Potential issues identified',
          'Error handling present',
          'Security considerations',
          'Performance implications'
        ]
      }
    };
  }

  /**
   * Reflect on output and identify gaps/improvements
   * @param {Object} options
   * @param {string} options.goal - Original goal
   * @param {string} options.output - Output to reflect on
   * @param {Object} options.plan - Original plan (optional)
   * @param {string} options.context - Additional context
   * @returns {Promise<Object>} Reflection results with gaps and suggestions
   */
  async reflect({ goal, output, plan = null, context = '' }) {
    const startTime = Date.now();

    try {
      logger.info(`Reflecting on output for goal: ${goal.substring(0, 50)}...`);

      // Build reflection prompt
      const prompt = this._buildReflectionPrompt(goal, output, plan, context);

      // Call AI for reflection
      const response = await modelProxy.callModel({
        model: this.defaultModel,
        prompt,
        systemPrompt: 'You are an expert code reviewer and critic. Your job is to identify gaps, issues, and improvement opportunities.',
        temperature: 0.4 // Slightly higher for creative critique
      });

      // Parse reflection
      const reflection = this._parseReflection(response.output);

      // Calculate overall score
      const score = this._calculateReflectionScore(reflection);

      const duration = Date.now() - startTime;

      return {
        success: true,
        reflection: {
          overallScore: score,
          strengths: reflection.strengths || [],
          gaps: reflection.gaps || [],
          issues: reflection.issues || [],
          suggestions: reflection.suggestions || [],
          riskAssessment: reflection.riskAssessment || {},
          needsRevision: score < 0.7 || reflection.gaps.length > 0
        },
        metadata: {
          model: this.defaultModel,
          duration,
          tokensUsed: response.tokensUsed || this._estimateTokens(prompt + response.output)
        }
      };

    } catch (error) {
      logger.error(`Reflection failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        reflection: {
          overallScore: 0.5,
          strengths: [],
          gaps: ['Unable to perform reflection'],
          issues: [error.message],
          suggestions: [],
          needsRevision: true
        }
      };
    }
  }

  /**
   * Build reflection prompt
   */
  _buildReflectionPrompt(goal, output, plan, context) {
    const planSection = plan ? `
## Original Plan
${JSON.stringify(plan, null, 2)}
` : '';

    const contextSection = context ? `
## Context
\`\`\`
${context.substring(0, 2000)}
${context.length > 2000 ? '... (truncated)' : ''}
\`\`\`
` : '';

    return `# Task: Critical Reflection on Output

## Goal
${goal}
${planSection}
## Output to Review
\`\`\`
${output.substring(0, 5000)}
${output.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`
${contextSection}

## Reflection Criteria

Critically evaluate the output against these criteria:

1. **Completeness** (30%)
   - All requirements addressed?
   - Missing steps or components?
   - Edge cases considered?
   - Dependencies identified?

2. **Correctness** (30%)
   - Logic sound?
   - No obvious errors?
   - Follows best practices?
   - Syntax valid?

3. **Quality** (20%)
   - Code maintainable?
   - Clear and readable?
   - Well-documented?
   - Follows conventions?

4. **Efficiency** (10%)
   - Optimal approach?
   - No unnecessary complexity?
   - Resource-efficient?

5. **Risk Assessment** (10%)
   - Potential issues?
   - Error handling?
   - Security considerations?

## Required Output Format

Provide a detailed reflection in JSON format:

\`\`\`json
{
  "strengths": [
    "What was done well (be specific)"
  ],
  "gaps": [
    {
      "category": "completeness|correctness|quality|efficiency|risks",
      "severity": "low|medium|high",
      "description": "What is missing or incomplete",
      "location": "Where in the output (if applicable)"
    }
  ],
  "issues": [
    {
      "category": "completeness|correctness|quality|efficiency|risks",
      "severity": "low|medium|high",
      "description": "What is wrong or problematic",
      "location": "Where in the output"
    }
  ],
  "suggestions": [
    {
      "category": "completeness|correctness|quality|efficiency|risks",
      "priority": "low|medium|high",
      "description": "Specific improvement to make",
      "expectedImpact": "How this improves the output"
    }
  ],
  "riskAssessment": {
    "criticalRisks": ["High-priority risks identified"],
    "mitigations": ["Suggested risk mitigations"]
  },
  "categoryScores": {
    "completeness": 0.0-1.0,
    "correctness": 0.0-1.0,
    "quality": 0.0-1.0,
    "efficiency": 0.0-1.0,
    "risks": 0.0-1.0
  }
}
\`\`\`

Be thorough and specific. Identify ALL gaps and issues, no matter how small.
Output ONLY the JSON, no additional text.`;
  }

  /**
   * Parse reflection from AI response
   */
  _parseReflection(output) {
    try {
      // Extract JSON
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure required fields
      return {
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        riskAssessment: parsed.riskAssessment || { criticalRisks: [], mitigations: [] },
        categoryScores: parsed.categoryScores || {}
      };

    } catch (error) {
      logger.error(`Failed to parse reflection: ${error.message}`);
      return this._extractReflectionFromText(output);
    }
  }

  /**
   * Extract reflection from unstructured text (fallback)
   */
  _extractReflectionFromText(text) {
    const reflection = {
      strengths: [],
      gaps: [],
      issues: [],
      suggestions: [],
      riskAssessment: { criticalRisks: [], mitigations: [] },
      categoryScores: {}
    };

    // Look for common reflection patterns
    const lines = text.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const lower = line.toLowerCase();
      
      if (lower.includes('strength') || lower.includes('good') || lower.includes('well done')) {
        currentSection = 'strengths';
      } else if (lower.includes('gap') || lower.includes('missing')) {
        currentSection = 'gaps';
      } else if (lower.includes('issue') || lower.includes('problem') || lower.includes('error')) {
        currentSection = 'issues';
      } else if (lower.includes('suggest') || lower.includes('improve') || lower.includes('recommend')) {
        currentSection = 'suggestions';
      }

      if (currentSection && line.trim().match(/^[-*•]\s+/)) {
        const content = line.trim().replace(/^[-*•]\s+/, '');
        if (currentSection === 'gaps' || currentSection === 'issues') {
          reflection[currentSection].push({
            category: 'general',
            severity: 'medium',
            description: content,
            location: 'unknown'
          });
        } else if (currentSection === 'suggestions') {
          reflection[currentSection].push({
            category: 'general',
            priority: 'medium',
            description: content,
            expectedImpact: 'Improvement'
          });
        } else {
          reflection[currentSection].push(content);
        }
      }
    }

    return reflection;
  }

  /**
   * Calculate overall reflection score
   */
  _calculateReflectionScore(reflection) {
    const scores = reflection.categoryScores || {};
    const criteria = this.reflectionCriteria;

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [category, config] of Object.entries(criteria)) {
      if (scores[category] !== undefined) {
        weightedScore += scores[category] * config.weight;
        totalWeight += config.weight;
      }
    }

    if (totalWeight === 0) {
      // Fallback: score based on gaps and issues
      const gapsCount = reflection.gaps?.length || 0;
      const issuesCount = reflection.issues?.length || 0;
      const highSeverity = [...(reflection.gaps || []), ...(reflection.issues || [])]
        .filter(item => item.severity === 'high').length;

      return Math.max(0, 1.0 - (gapsCount * 0.05) - (issuesCount * 0.1) - (highSeverity * 0.15));
    }

    return weightedScore / totalWeight;
  }

  /**
   * Perform multi-pass reflection (progressive critique)
   * @param {Object} options
   * @param {string} options.goal - Original goal
   * @param {string} options.output - Output to reflect on
   * @param {number} options.passes - Number of reflection passes
   * @returns {Promise<Object>} Aggregated reflection
   */
  async multiPassReflection({ goal, output, plan = null, context = '', passes = 2 }) {
    try {
      logger.info(`Performing ${passes}-pass reflection`);

      const reflections = [];
      
      for (let i = 0; i < passes; i++) {
        const passContext = i > 0 ? `Previous reflection: ${JSON.stringify(reflections[i-1].reflection)}` : context;
        
        const reflection = await this.reflect({
          goal,
          output,
          plan,
          context: passContext
        });

        reflections.push(reflection);
      }

      // Aggregate reflections
      const aggregated = this._aggregateReflections(reflections);

      return {
        success: true,
        reflection: aggregated,
        passes: reflections.length
      };

    } catch (error) {
      logger.error(`Multi-pass reflection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Aggregate multiple reflections
   */
  _aggregateReflections(reflections) {
    const aggregated = {
      overallScore: 0,
      strengths: [],
      gaps: [],
      issues: [],
      suggestions: [],
      riskAssessment: { criticalRisks: [], mitigations: [] },
      needsRevision: false
    };

    // Deduplicate and merge
    const seenStrengths = new Set();
    const seenGaps = new Set();
    const seenIssues = new Set();
    const seenSuggestions = new Set();

    for (const ref of reflections) {
      if (!ref.success) continue;

      aggregated.overallScore += ref.reflection.overallScore;

      // Merge strengths
      for (const strength of ref.reflection.strengths || []) {
        if (!seenStrengths.has(strength)) {
          seenStrengths.add(strength);
          aggregated.strengths.push(strength);
        }
      }

      // Merge gaps
      for (const gap of ref.reflection.gaps || []) {
        const key = gap.description;
        if (!seenGaps.has(key)) {
          seenGaps.add(key);
          aggregated.gaps.push(gap);
        }
      }

      // Merge issues
      for (const issue of ref.reflection.issues || []) {
        const key = issue.description;
        if (!seenIssues.has(key)) {
          seenIssues.add(key);
          aggregated.issues.push(issue);
        }
      }

      // Merge suggestions
      for (const suggestion of ref.reflection.suggestions || []) {
        const key = suggestion.description;
        if (!seenSuggestions.has(key)) {
          seenSuggestions.add(key);
          aggregated.suggestions.push(suggestion);
        }
      }

      // Merge risks
      if (ref.reflection.riskAssessment) {
        aggregated.riskAssessment.criticalRisks.push(...(ref.reflection.riskAssessment.criticalRisks || []));
        aggregated.riskAssessment.mitigations.push(...(ref.reflection.riskAssessment.mitigations || []));
      }
    }

    // Average score
    aggregated.overallScore /= reflections.length;

    // Determine if revision needed
    aggregated.needsRevision = aggregated.overallScore < 0.7 || aggregated.gaps.length > 0 || aggregated.issues.length > 0;

    return aggregated;
  }

  /**
   * Estimate tokens
   */
  _estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Configure reflection engine
   */
  configure(options) {
    if (options.defaultModel) {
      this.defaultModel = options.defaultModel;
    }
    if (options.reflectionCriteria) {
      this.reflectionCriteria = { ...this.reflectionCriteria, ...options.reflectionCriteria };
    }
    logger.info('Reflection engine configured');
  }
}

module.exports = new ReflectionEngine();
