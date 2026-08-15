/**
 * Planning Module - Generates structured step-by-step execution plans
 * Ensures agents think before they act with detailed planning
 */

const logger = require('../../utils/logger');
const modelProxy = require('../modelProxy');

class PlanningModule {
  constructor() {
    this.defaultModel = 'gpt-4o-mini'; // Cost-efficient planning model
    
    // Planning templates for different task types
    this.planningTemplates = {
      refactor: {
        systemPrompt: 'You are a senior software architect creating a refactoring plan.',
        requiredSteps: ['analysis', 'design', 'implementation', 'validation']
      },
      feature: {
        systemPrompt: 'You are a technical lead planning a new feature implementation.',
        requiredSteps: ['requirements', 'design', 'implementation', 'testing', 'documentation']
      },
      debug: {
        systemPrompt: 'You are a debugging expert creating a systematic debugging plan.',
        requiredSteps: ['reproduce', 'analyze', 'fix', 'verify']
      },
      optimize: {
        systemPrompt: 'You are a performance expert planning optimization work.',
        requiredSteps: ['profiling', 'analysis', 'optimization', 'benchmarking']
      },
      general: {
        systemPrompt: 'You are an experienced software engineer creating an execution plan.',
        requiredSteps: ['analysis', 'planning', 'implementation', 'validation']
      }
    };
  }

  /**
   * Generate a detailed execution plan for a goal
   * @param {Object} options
   * @param {string} options.goal - High-level goal
   * @param {string} options.context - Code or context
   * @param {string} options.taskType - Type: 'refactor', 'feature', 'debug', 'optimize', 'general'
   * @param {Object} options.constraints - Optional constraints
   * @returns {Promise<Object>} Detailed execution plan
   */
  async generatePlan({ goal, context = '', taskType = 'general', constraints = {} }) {
    const startTime = Date.now();

    try {
      logger.info(`Generating ${taskType} plan for: ${goal.substring(0, 50)}...`);

      // Get appropriate template
      const template = this.planningTemplates[taskType] || this.planningTemplates.general;

      // Build planning prompt
      const prompt = this._buildPlanningPrompt(goal, context, taskType, template, constraints);

      // Call AI model for planning
      const response = await modelProxy.callModel({
        model: this.defaultModel,
        prompt,
        systemPrompt: template.systemPrompt,
        temperature: 0.3 // Low temperature for consistent planning
      });

      // Parse the plan
      const plan = this._parsePlan(response.output, template);

      // Validate plan completeness
      const validation = this._validatePlan(plan, template);

      if (!validation.valid) {
        logger.warn(`Plan validation issues: ${validation.issues.join(', ')}`);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        plan: {
          goal,
          taskType,
          steps: plan.steps,
          reasoning: plan.reasoning,
          risks: plan.risks || [],
          dependencies: plan.dependencies || [],
          estimatedComplexity: plan.estimatedComplexity || 'moderate',
          estimatedDuration: plan.estimatedDuration || 'unknown'
        },
        validation,
        metadata: {
          model: this.defaultModel,
          duration,
          tokensUsed: response.tokensUsed || this._estimateTokens(prompt + response.output)
        }
      };

    } catch (error) {
      logger.error(`Planning failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        fallbackPlan: this._generateFallbackPlan(goal, taskType)
      };
    }
  }

  /**
   * Build planning prompt
   */
  _buildPlanningPrompt(goal, context, taskType, template, constraints) {
    const contextSection = context ? `
## Context
\`\`\`
${context.substring(0, 3000)}
${context.length > 3000 ? '... (truncated)' : ''}
\`\`\`
` : '';

    const constraintsSection = Object.keys(constraints).length > 0 ? `
## Constraints
${Object.entries(constraints).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
` : '';

    return `# Task: Create Detailed Execution Plan

## Goal
${goal}
${contextSection}${constraintsSection}

## Required Output Format

Generate a detailed, step-by-step execution plan in the following JSON format:

\`\`\`json
{
  "reasoning": "Brief explanation of the approach",
  "steps": [
    {
      "id": 1,
      "name": "Step name",
      "description": "Detailed description of what to do",
      "action": "analyze|design|implement|test|document",
      "dependencies": [],
      "estimatedComplexity": "simple|moderate|complex",
      "expectedOutput": "What this step should produce",
      "validationCriteria": "How to verify this step succeeded"
    }
  ],
  "risks": [
    {
      "risk": "Potential issue",
      "severity": "low|medium|high",
      "mitigation": "How to address it"
    }
  ],
  "dependencies": ["External dependency 1", "External dependency 2"],
  "estimatedComplexity": "simple|moderate|complex|very-complex",
  "estimatedDuration": "Quick estimate (e.g., '15-30 minutes')"
}
\`\`\`

## Requirements
1. Break down into ${template.requiredSteps.length}-10 clear, actionable steps
2. Each step must have: name, description, action, validation criteria
3. Identify dependencies between steps
4. List potential risks and mitigations
5. Estimate overall complexity and duration
6. Steps should follow this flow: ${template.requiredSteps.join(' → ')}

Output ONLY the JSON, no additional text.`;
  }

  /**
   * Parse plan from AI response
   */
  _parsePlan(output, template) {
    try {
      // Extract JSON from response
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure steps have IDs
      if (parsed.steps) {
        parsed.steps = parsed.steps.map((step, index) => ({
          id: step.id || index + 1,
          name: step.name || `Step ${index + 1}`,
          description: step.description || '',
          action: step.action || 'implement',
          dependencies: step.dependencies || [],
          estimatedComplexity: step.estimatedComplexity || 'moderate',
          expectedOutput: step.expectedOutput || '',
          validationCriteria: step.validationCriteria || ''
        }));
      }

      return parsed;

    } catch (error) {
      logger.error(`Failed to parse plan: ${error.message}`);
      
      // Attempt to extract steps from text
      return this._extractPlanFromText(output);
    }
  }

  /**
   * Extract plan from unstructured text (fallback)
   */
  _extractPlanFromText(text) {
    const steps = [];
    const lines = text.split('\n');
    let currentStep = null;

    for (const line of lines) {
      // Look for step markers (1., Step 1, etc.)
      const stepMatch = line.match(/^(?:Step\s+)?(\d+)[.:\s]+(.+)/i);
      if (stepMatch) {
        if (currentStep) {
          steps.push(currentStep);
        }
        currentStep = {
          id: parseInt(stepMatch[1]),
          name: stepMatch[2].trim(),
          description: '',
          action: 'implement',
          dependencies: [],
          estimatedComplexity: 'moderate'
        };
      } else if (currentStep && line.trim()) {
        currentStep.description += line.trim() + ' ';
      }
    }

    if (currentStep) {
      steps.push(currentStep);
    }

    return {
      reasoning: 'Plan extracted from text',
      steps: steps.length > 0 ? steps : [{
        id: 1,
        name: 'Execute task',
        description: text.substring(0, 200),
        action: 'implement',
        dependencies: [],
        estimatedComplexity: 'moderate'
      }],
      risks: [],
      dependencies: []
    };
  }

  /**
   * Validate plan completeness
   */
  _validatePlan(plan, template) {
    const issues = [];

    // Check for steps
    if (!plan.steps || plan.steps.length === 0) {
      issues.push('No steps defined');
    }

    // Check minimum steps
    if (plan.steps && plan.steps.length < 2) {
      issues.push('Too few steps (minimum 2 required)');
    }

    // Check each step has required fields
    if (plan.steps) {
      plan.steps.forEach((step, index) => {
        if (!step.name) issues.push(`Step ${index + 1} missing name`);
        if (!step.description) issues.push(`Step ${index + 1} missing description`);
        if (!step.action) issues.push(`Step ${index + 1} missing action`);
      });
    }

    // Check reasoning
    if (!plan.reasoning) {
      issues.push('No reasoning provided');
    }

    return {
      valid: issues.length === 0,
      issues,
      score: Math.max(0, 1 - (issues.length * 0.1))
    };
  }

  /**
   * Generate fallback plan if AI planning fails
   */
  _generateFallbackPlan(goal, taskType) {
    const template = this.planningTemplates[taskType] || this.planningTemplates.general;
    
    return {
      goal,
      taskType,
      steps: template.requiredSteps.map((step, index) => ({
        id: index + 1,
        name: step.charAt(0).toUpperCase() + step.slice(1),
        description: `Perform ${step} for: ${goal}`,
        action: step,
        dependencies: index > 0 ? [index] : [],
        estimatedComplexity: 'moderate',
        expectedOutput: `Completed ${step}`,
        validationCriteria: `${step} successful`
      })),
      reasoning: 'Fallback plan generated due to planning failure',
      risks: [{
        risk: 'Planning AI failed',
        severity: 'medium',
        mitigation: 'Using template-based plan'
      }],
      dependencies: [],
      estimatedComplexity: 'moderate',
      estimatedDuration: 'unknown'
    };
  }

  /**
   * Refine an existing plan based on feedback
   */
  async refinePlan({ originalPlan, feedback, context = '' }) {
    try {
      logger.info('Refining plan based on feedback');

      const prompt = `# Task: Refine Execution Plan

## Original Plan
${JSON.stringify(originalPlan, null, 2)}

## Feedback
${feedback}

## Instructions
Based on the feedback, create an improved version of the plan.
Address all concerns raised in the feedback.
Output the refined plan in the same JSON format as the original.

Output ONLY the JSON, no additional text.`;

      const response = await modelProxy.callModel({
        model: this.defaultModel,
        prompt,
        systemPrompt: 'You are an expert at refining execution plans based on feedback.',
        temperature: 0.3
      });

      const refinedPlan = this._parsePlan(response.output, this.planningTemplates.general);

      return {
        success: true,
        refinedPlan,
        improvements: this._comparePlans(originalPlan, refinedPlan)
      };

    } catch (error) {
      logger.error(`Plan refinement failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        refinedPlan: originalPlan // Return original if refinement fails
      };
    }
  }

  /**
   * Compare two plans to identify improvements
   */
  _comparePlans(original, refined) {
    const improvements = [];

    if (refined.steps.length !== original.steps.length) {
      improvements.push(`Step count changed: ${original.steps.length} → ${refined.steps.length}`);
    }

    if (refined.risks && refined.risks.length > (original.risks?.length || 0)) {
      improvements.push(`Additional risks identified: ${refined.risks.length - (original.risks?.length || 0)}`);
    }

    return improvements;
  }

  /**
   * Estimate tokens (rough)
   */
  _estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Configure planning module
   */
  configure(options) {
    if (options.defaultModel) {
      this.defaultModel = options.defaultModel;
    }
    logger.info('Planning module configured');
  }
}

module.exports = new PlanningModule();
