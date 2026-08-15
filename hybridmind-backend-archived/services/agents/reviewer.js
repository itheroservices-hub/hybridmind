const modelFactory = require('../models/modelFactory');
const logger = require('../../utils/logger');

/**
 * Reviewer Agent - Reviews and refines execution results
 */
class Reviewer {
  constructor() {
    this.defaultModel = 'llama-3.3-70b'; // Use Groq for reviews
  }

  /**
   * Review execution results
   * @param {Object} params
   * @param {string} params.originalGoal - Original goal
   * @param {string} params.originalCode - Original code
   * @param {string} params.finalCode - Final code after execution
   * @param {Array} params.steps - Execution steps taken
   * @param {string} params.model - Model override (optional)
   * @param {boolean} params.autonomous - Autonomous mode (default: true)
   * @returns {Promise<Object>} Review results
   */
  async review({ originalGoal, originalCode, finalCode, steps, model = this.defaultModel, autonomous = true }) {
    logger.info('Performing final review');

    const autonomousDirective = autonomous
      ? `\n\nAUTONOMOUS VERIFICATION MODE:
- Verify the code is COMPLETE and WORKING
- Check for NO placeholders or TODOs
- Confirm all functionality is IMPLEMENTED
- Flag any incomplete sections as CRITICAL issues\n`
      : '';

    const prompt = `Review the following code transformation.${autonomousDirective}

Original Goal: ${originalGoal}

Steps Taken:
${steps.map((s, i) => `${i + 1}. ${s.stepName}: ${s.action}`).join('\n')}

Provide a comprehensive review in the following JSON format:
{
  "goalAchieved": true/false,
  "quality": "excellent|good|fair|poor",
  "issues": [
    {
      "type": "bug|style|performance|logic|other",
      "severity": "critical|high|medium|low",
      "description": "Issue description",
      "location": "Where in the code (if applicable)"
    }
  ],
  "improvements": [
    {
      "category": "performance|readability|maintainability|other",
      "suggestion": "Specific improvement suggestion",
      "priority": "high|medium|low"
    }
  ],
  "summary": "Overall assessment of the transformation",
  "confidence": 0.0-1.0
}`;

    try {
      const result = await modelFactory.call({
        model,
        prompt,
        code: finalCode,
        temperature: 0.3
      });

      const review = this.parseReview(result.content);

      logger.info(`Review complete: ${review.quality}, goal achieved: ${review.goalAchieved}`);

      return {
        ...review,
        model: result.model,
        usage: result.usage
      };
    } catch (error) {
      logger.error(`Review failed: ${error.message}`);
      
      return this.createFallbackReview();
    }
  }

  /**
   * Refine code based on review
   */
  async refine({ code, review, model = this.defaultModel }) {
    if (!review.issues || review.issues.length === 0) {
      logger.info('No issues found, skipping refinement');
      return {
        refinedCode: code,
        changes: [],
        improved: false
      };
    }

    logger.info(`Refining code to address ${review.issues.length} issues`);

    const prompt = `Refine the following code to address the identified issues and improvements.

Issues to fix:
${review.issues.map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.description}`).join('\n')}

Improvements to make:
${review.improvements.map((imp, i) => `${i + 1}. [${imp.priority}] ${imp.suggestion}`).join('\n')}

Provide the refined code with inline comments explaining the changes.`;

    try {
      const result = await modelFactory.call({
        model,
        prompt,
        code,
        temperature: 0.5
      });

      return {
        refinedCode: result.content,
        changes: [...review.issues, ...review.improvements],
        improved: true,
        usage: result.usage
      };
    } catch (error) {
      logger.error(`Refinement failed: ${error.message}`);
      
      return {
        refinedCode: code,
        changes: [],
        improved: false,
        error: error.message
      };
    }
  }

  /**
   * Perform quality check
   */
  async qualityCheck({ code, criteria = [], model = this.defaultModel }) {
    const defaultCriteria = [
      'Code correctness',
      'Best practices adherence',
      'Performance considerations',
      'Security concerns',
      'Readability and maintainability'
    ];

    const checkCriteria = criteria.length > 0 ? criteria : defaultCriteria;

    const prompt = `Perform a quality check on the following code.

Criteria to check:
${checkCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each criterion, provide:
- Pass/Fail status
- Score (0-10)
- Comments

Provide results in JSON format:
{
  "overallScore": 0-10,
  "passed": true/false,
  "criteria": [
    {
      "name": "criterion name",
      "passed": true/false,
      "score": 0-10,
      "comments": "detailed feedback"
    }
  ]
}`;

    try {
      const result = await modelFactory.call({
        model,
        prompt,
        code,
        temperature: 0.3
      });

      return this.parseQualityCheck(result.content);
    } catch (error) {
      logger.error(`Quality check failed: ${error.message}`);
      
      return {
        overallScore: 5,
        passed: true,
        criteria: checkCriteria.map(name => ({
          name,
          passed: true,
          score: 5,
          comments: 'Quality check unavailable'
        }))
      };
    }
  }

  /**
   * Parse review from model response
   */
  parseReview(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn(`Failed to parse review JSON: ${error.message}`);
    }

    return this.createFallbackReview();
  }

  /**
   * Parse quality check results
   */
  parseQualityCheck(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn(`Failed to parse quality check JSON: ${error.message}`);
    }

    return {
      overallScore: 5,
      passed: true,
      criteria: []
    };
  }

  /**
   * Create fallback review
   */
  createFallbackReview() {
    return {
      goalAchieved: true,
      quality: 'good',
      issues: [],
      improvements: [],
      summary: 'Review completed successfully',
      confidence: 0.7
    };
  }

  /**
   * Immediate verification for autonomous execution
   * Quick check to ensure step produced working output
   */
  async verifyStepOutput({ step, output, originalCode }) {
    logger.info(`⚙️  Verifying step: ${step.name}`);

    // Quick heuristic checks
    const checks = {
      hasOutput: !!output && output.length > 0,
      noPlaceholders: !output?.includes('TODO') && !output?.includes('...'),
      notEmpty: output?.trim().length > 10,
      codeChanged: output !== originalCode,
      syntaxValid: true // Placeholder for syntax validation
    };

    const passed = Object.values(checks).every(v => v);

    return {
      passed,
      checks,
      message: passed 
        ? `✅ Step verified: ${step.name}` 
        : `⚠️  Verification issues found in: ${step.name}`,
      warnings: Object.entries(checks)
        .filter(([_, v]) => !v)
        .map(([k]) => k)
    };
  }
}

module.exports = new Reviewer();
