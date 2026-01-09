const modelFactory = require('../models/modelFactory');
const logger = require('../../utils/logger');

/**
 * Planner Agent - Creates execution plans from high-level goals
 */
class Planner {
  constructor() {
    this.defaultModel = 'gpt-4'; // Use best reasoning model for planning
  }

  /**
   * Create a plan from a goal
   * @param {Object} params
   * @param {string} params.goal - High-level goal
   * @param {string} params.code - Code context
   * @param {string} params.model - Model to use for planning
   * @returns {Promise<Object>} Plan with steps
   */
  async createPlan({ goal, code, model = this.defaultModel }) {
    const prompt = `You are a software engineering planning assistant. Break down the following task into clear, actionable steps.

Task: ${goal}

Provide a step-by-step plan in the following JSON format:
{
  "steps": [
    {
      "name": "step-identifier",
      "description": "What this step accomplishes",
      "action": "analyze|refactor|optimize|document|test|review|fix",
      "priority": "high|medium|low",
      "estimatedComplexity": "simple|moderate|complex"
    }
  ],
  "strategy": "Brief description of overall approach",
  "estimatedSteps": <number>
}

Requirements:
- Each step should be specific and actionable
- Steps should be in logical order
- Include all necessary analysis, implementation, and verification steps
- Be concise but complete`;

    try {
      const result = await modelFactory.call({
        model,
        prompt,
        code,
        temperature: 0.3 // Lower temperature for more consistent planning
      });

      const plan = this.parsePlan(result.content);
      
      logger.info(`Plan created: ${plan.steps.length} steps, strategy: ${plan.strategy}`);
      
      return {
        ...plan,
        model: result.model,
        usage: result.usage
      };
    } catch (error) {
      logger.error(`Planning failed: ${error.message}`);
      
      // Fallback: create simple plan
      return this.createFallbackPlan(goal);
    }
  }

  /**
   * Parse plan from model response
   */
  parsePlan(content) {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        if (plan.steps && Array.isArray(plan.steps)) {
          return plan;
        }
      }

      // Fallback: parse as text
      return this.parseTextPlan(content);
    } catch (error) {
      logger.warn(`Failed to parse JSON plan: ${error.message}`);
      return this.parseTextPlan(content);
    }
  }

  /**
   * Parse plan from plain text
   */
  parseTextPlan(content) {
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const steps = [];
    let stepCounter = 1;

    for (const line of lines) {
      // Look for numbered steps or bullet points
      if (/^(\d+[\.\)]|\-|\*)\s+(.+)/.test(line)) {
        const description = line.replace(/^(\d+[\.\)]|\-|\*)\s+/, '');
        steps.push({
          name: `step-${stepCounter}`,
          description,
          action: this.inferAction(description),
          priority: 'medium',
          estimatedComplexity: 'moderate'
        });
        stepCounter++;
      }
    }

    if (steps.length === 0) {
      // Last resort: use entire content as single step
      steps.push({
        name: 'step-1',
        description: content.substring(0, 200),
        action: 'analyze',
        priority: 'high',
        estimatedComplexity: 'moderate'
      });
    }

    return {
      steps,
      strategy: 'Auto-generated from text plan',
      estimatedSteps: steps.length
    };
  }

  /**
   * Infer action type from description
   */
  inferAction(description) {
    const lower = description.toLowerCase();
    
    if (lower.includes('refactor') || lower.includes('restructure')) return 'refactor';
    if (lower.includes('optimize') || lower.includes('performance')) return 'optimize';
    if (lower.includes('document') || lower.includes('comment')) return 'document';
    if (lower.includes('test')) return 'test';
    if (lower.includes('review') || lower.includes('check')) return 'review';
    if (lower.includes('fix') || lower.includes('bug')) return 'fix';
    
    return 'analyze';
  }

  /**
   * Create fallback plan when parsing fails
   */
  createFallbackPlan(goal) {
    return {
      steps: [
        {
          name: 'analyze',
          description: `Analyze the code in context of: ${goal}`,
          action: 'analyze',
          priority: 'high',
          estimatedComplexity: 'moderate'
        },
        {
          name: 'implement',
          description: `Implement changes for: ${goal}`,
          action: 'refactor',
          priority: 'high',
          estimatedComplexity: 'moderate'
        },
        {
          name: 'verify',
          description: 'Verify changes and provide final result',
          action: 'review',
          priority: 'medium',
          estimatedComplexity: 'simple'
        }
      ],
      strategy: 'Fallback 3-step plan: analyze, implement, verify',
      estimatedSteps: 3
    };
  }

  /**
   * Refine an existing plan
   */
  async refinePlan({ plan, feedback, model = this.defaultModel }) {
    const prompt = `Refine the following execution plan based on feedback.

Current Plan:
${JSON.stringify(plan, null, 2)}

Feedback: ${feedback}

Provide an improved plan in the same JSON format.`;

    const result = await modelFactory.call({
      model,
      prompt,
      temperature: 0.3
    });

    return this.parsePlan(result.content);
  }
}

module.exports = new Planner();
