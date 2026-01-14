const modelFactory = require('../models/modelFactory');
const logger = require('../../utils/logger');

/**
 * Planner Agent - Creates execution plans from high-level goals
 */
class Planner {
  constructor() {
    this.defaultModel = 'meta-llama/llama-3.3-70b-instruct'; // Use OpenRouter's Llama model for planning
  }

  /**
   * Create a plan from a goal
   * @param {Object} params
   * @param {string} params.goal - High-level goal
   * @param {string} params.code - Code context
   * @param {string} params.model - Model to use for planning
   * @param {boolean} params.autonomous - Enable autonomous execution mode (default: true)
   * @returns {Promise<Object>} Plan with steps
   */
  async createPlan({ goal, code, model = this.defaultModel, autonomous = true }) {
    const autonomousDirective = autonomous 
      ? `\n\nAUTONOMOUS EXECUTION MODE ENABLED:
- Each step MUST be immediately executable
- Each step MUST produce complete, working code
- NO placeholders, NO TODOs, NO partial implementations
- Steps must be atomic and self-contained
- Each step must validate its own output\n`
      : '';

    const prompt = `You are an autonomous software engineering agent. Create an executable plan for immediate action.

Task: ${goal}${autonomousDirective}

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

  /**
   * Validate plan for autonomous execution
   */
  validatePlan(plan) {
    const issues = [];

    if (!plan.steps || plan.steps.length === 0) {
      issues.push('Plan has no steps');
    }

    plan.steps?.forEach((step, index) => {
      if (!step.name) issues.push(`Step ${index + 1}: Missing name`);
      if (!step.description) issues.push(`Step ${index + 1}: Missing description`);
      if (!step.action) issues.push(`Step ${index + 1}: Missing action type`);
    });

    return {
      valid: issues.length === 0,
      issues,
      stepCount: plan.steps?.length || 0
    };
  }

  /**
   * Get next logical step based on completed work
   */
  suggestNextStep({ goal, completedSteps, currentCode }) {
    const lastStep = completedSteps[completedSteps.length - 1];
    const completedActions = new Set(completedSteps.map(s => s.action));

    // Suggest next action based on workflow
    const workflowSequence = ['analyze', 'refactor', 'optimize', 'document', 'test', 'review'];
    
    for (const action of workflowSequence) {
      if (!completedActions.has(action)) {
        return {
          name: `${action}-step`,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} the code based on: ${goal}`,
          action,
          priority: 'medium',
          estimatedComplexity: 'moderate'
        };
      }
    }

    return null; // All standard steps completed
  }
}

module.exports = new Planner();
