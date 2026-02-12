/**
 * Reflection Orchestrator - Manages the V1 → Reflection → V2 → Review cycle
 * Ensures quality through structured planning and iterative refinement
 */

const logger = require('../../utils/logger');
const planningModule = require('./planningModule');
const reflectionEngine = require('./reflectionEngine');
const revisionRouter = require('./revisionRouter');
const executor = require('../agents/executor');
const modelProxy = require('../modelProxy');

class ReflectionOrchestrator {
  constructor() {
    this.maxRevisionCycles = 3; // Prevent infinite loops
    this.qualityThreshold = 0.7; // Minimum acceptable quality score
    this.enableAutoRevision = true;
  }

  /**
   * Execute full reflection cycle: Plan → V1 → Reflect → V2 → Review
   * @param {Object} options
   * @param {string} options.goal - High-level goal
   * @param {string} options.context - Code/context
   * @param {string} options.taskType - Task type
   * @param {Object} options.constraints - Constraints
   * @param {boolean} options.enablePlanning - Generate plan first
   * @param {boolean} options.enableReflection - Enable reflection loop
   * @param {number} options.maxCycles - Max revision cycles
   * @returns {Promise<Object>} Complete execution with reflections
   */
  async executeWithReflection({ 
    goal, 
    context = '', 
    taskType = 'general',
    constraints = {},
    enablePlanning = true,
    enableReflection = true,
    maxCycles = this.maxRevisionCycles
  }) {
    const startTime = Date.now();
    const executionLog = [];

    try {
      logger.info(`🎯 Starting reflection cycle for: ${goal.substring(0, 50)}...`);

      // ========================================
      // PHASE 0: Planning
      // ========================================
      let plan = null;
      if (enablePlanning) {
        executionLog.push({ phase: 'planning', status: 'started', timestamp: new Date() });
        
        const planResult = await planningModule.generatePlan({
          goal,
          context,
          taskType,
          constraints
        });

        if (planResult.success) {
          plan = planResult.plan;
          logger.info(`📋 Plan generated with ${plan.steps.length} steps`);
          executionLog.push({ 
            phase: 'planning', 
            status: 'completed', 
            result: plan,
            timestamp: new Date() 
          });
        } else {
          logger.warn('Planning failed, continuing without plan');
          executionLog.push({ 
            phase: 'planning', 
            status: 'failed', 
            error: planResult.error,
            timestamp: new Date() 
          });
        }
      }

      // ========================================
      // PHASE 1: V1 - Initial Execution
      // ========================================
      executionLog.push({ phase: 'v1', status: 'started', timestamp: new Date() });
      logger.info('🚀 Executing V1...');

      const v1Result = await this._executeVersion({
        goal,
        context,
        plan,
        version: 1
      });

      executionLog.push({ 
        phase: 'v1', 
        status: 'completed',
        result: v1Result,
        timestamp: new Date() 
      });

      logger.info(`✅ V1 completed: ${v1Result.output.length} chars`);

      // If reflection disabled, return V1
      if (!enableReflection) {
        return {
          success: true,
          version: 1,
          finalOutput: v1Result.output,
          plan,
          executionLog,
          metadata: {
            totalCycles: 1,
            duration: Date.now() - startTime,
            reflectionEnabled: false
          }
        };
      }

      // ========================================
      // PHASE 2: Reflection on V1
      // ========================================
      executionLog.push({ phase: 'reflection-v1', status: 'started', timestamp: new Date() });
      logger.info('🤔 Reflecting on V1...');

      const reflection1 = await reflectionEngine.reflect({
        goal,
        output: v1Result.output,
        plan,
        context
      });

      executionLog.push({ 
        phase: 'reflection-v1', 
        status: 'completed',
        result: reflection1,
        timestamp: new Date() 
      });

      logger.info(`📊 V1 Score: ${(reflection1.reflection.overallScore * 100).toFixed(1)}%`);
      logger.info(`   Gaps: ${reflection1.reflection.gaps.length}, Issues: ${reflection1.reflection.issues.length}`);

      // Check if V1 is good enough
      if (!reflection1.reflection.needsRevision) {
        logger.info('✅ V1 meets quality standards, no revision needed');
        
        return {
          success: true,
          version: 1,
          finalOutput: v1Result.output,
          plan,
          reflections: [reflection1],
          executionLog,
          metadata: {
            totalCycles: 1,
            finalScore: reflection1.reflection.overallScore,
            duration: Date.now() - startTime,
            noRevisionNeeded: true
          }
        };
      }

      // ========================================
      // PHASE 3: Route Revisions
      // ========================================
      executionLog.push({ phase: 'routing', status: 'started', timestamp: new Date() });
      logger.info('🧭 Routing revisions...');

      const revisionPlan = await revisionRouter.routeRevisions({
        reflection: reflection1.reflection,
        originalOutput: v1Result.output,
        plan
      });

      executionLog.push({ 
        phase: 'routing', 
        status: 'completed',
        result: revisionPlan,
        timestamp: new Date() 
      });

      logger.info(`📍 ${revisionPlan.revisionTasks.length} revision tasks identified`);

      // ========================================
      // PHASE 4: V2 - Revised Execution
      // ========================================
      executionLog.push({ phase: 'v2', status: 'started', timestamp: new Date() });
      logger.info('🔧 Executing V2 with revisions...');

      const v2Result = await this._executeRevision({
        goal,
        context,
        plan,
        originalOutput: v1Result.output,
        revisionPlan,
        reflection: reflection1.reflection,
        version: 2
      });

      executionLog.push({ 
        phase: 'v2', 
        status: 'completed',
        result: v2Result,
        timestamp: new Date() 
      });

      logger.info(`✅ V2 completed: ${v2Result.output.length} chars`);

      // ========================================
      // PHASE 5: Reflection on V2
      // ========================================
      executionLog.push({ phase: 'reflection-v2', status: 'started', timestamp: new Date() });
      logger.info('🤔 Reflecting on V2...');

      const reflection2 = await reflectionEngine.reflect({
        goal,
        output: v2Result.output,
        plan,
        context: `Previous version score: ${reflection1.reflection.overallScore}\nPrevious issues: ${JSON.stringify(reflection1.reflection.gaps)}`
      });

      executionLog.push({ 
        phase: 'reflection-v2', 
        status: 'completed',
        result: reflection2,
        timestamp: new Date() 
      });

      logger.info(`📊 V2 Score: ${(reflection2.reflection.overallScore * 100).toFixed(1)}%`);
      logger.info(`   Improvement: ${((reflection2.reflection.overallScore - reflection1.reflection.overallScore) * 100).toFixed(1)}%`);

      // ========================================
      // PHASE 6: Final Review & Summary
      // ========================================
      executionLog.push({ phase: 'review', status: 'started', timestamp: new Date() });
      logger.info('📝 Generating final review...');

      const finalReview = await this._generateFinalReview({
        goal,
        v1: v1Result.output,
        v2: v2Result.output,
        reflection1: reflection1.reflection,
        reflection2: reflection2.reflection,
        revisionPlan
      });

      executionLog.push({ 
        phase: 'review', 
        status: 'completed',
        result: finalReview,
        timestamp: new Date() 
      });

      const duration = Date.now() - startTime;

      // Determine final version
      const useFinalVersion = reflection2.reflection.overallScore > reflection1.reflection.overallScore ? 2 : 1;
      const finalOutput = useFinalVersion === 2 ? v2Result.output : v1Result.output;
      const finalScore = Math.max(reflection1.reflection.overallScore, reflection2.reflection.overallScore);

      logger.info(`✅ Reflection cycle complete (${duration}ms)`);
      logger.info(`   Final version: V${useFinalVersion} (Score: ${(finalScore * 100).toFixed(1)}%)`);

      return {
        success: true,
        version: useFinalVersion,
        finalOutput,
        plan,
        v1: v1Result.output,
        v2: v2Result.output,
        reflections: [reflection1, reflection2],
        revisionPlan,
        finalReview,
        executionLog,
        metadata: {
          totalCycles: 2,
          finalScore,
          improvement: reflection2.reflection.overallScore - reflection1.reflection.overallScore,
          duration,
          tokensUsed: this._calculateTotalTokens(executionLog)
        }
      };

    } catch (error) {
      logger.error(`Reflection orchestration failed: ${error.message}`);
      executionLog.push({ 
        phase: 'error', 
        status: 'failed',
        error: error.message,
        timestamp: new Date() 
      });

      throw error;
    }
  }

  /**
   * Execute initial version (V1)
   */
  async _executeVersion({ goal, context, plan, version }) {
    try {
      // If we have a plan, execute it
      if (plan && plan.steps && plan.steps.length > 0) {
        // Execute first few critical steps for V1
        const criticalSteps = plan.steps.slice(0, Math.min(3, plan.steps.length));
        
        let output = '';
        for (const step of criticalSteps) {
          const stepResult = await executor.executeStep({
            step,
            code: context,
            context: { goal, version }
          });

          if (stepResult.success) {
            output += stepResult.output + '\n\n';
          }
        }

        return { output: output.trim() };
      }

      // Fallback: direct execution
      const response = await modelProxy.callModel({
        model: 'gpt-4o-mini',
        prompt: `Goal: ${goal}\n\nContext:\n${context.substring(0, 3000)}\n\nProvide a complete implementation.`,
        temperature: 0.7
      });

      return { output: response.output };

    } catch (error) {
      logger.error(`V${version} execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute revision (V2)
   */
  async _executeRevision({ goal, context, plan, originalOutput, revisionPlan, reflection, version }) {
    try {
      // Build revision prompt
      const revisionPrompt = this._buildRevisionPrompt({
        goal,
        originalOutput,
        revisionPlan,
        reflection
      });

      const response = await modelProxy.callModel({
        model: 'gpt-4o', // Use more capable model for revisions
        prompt: revisionPrompt,
        temperature: 0.3 // Lower temp for corrections
      });

      return { output: response.output };

    } catch (error) {
      logger.error(`V${version} revision failed: ${error.message}`);
      // Return original if revision fails
      return { output: originalOutput };
    }
  }

  /**
   * Build revision prompt
   */
  _buildRevisionPrompt({ goal, originalOutput, revisionPlan, reflection }) {
    const issuesList = [
      ...reflection.gaps.map(g => `- [GAP] ${g.description} (${g.severity})`),
      ...reflection.issues.map(i => `- [ISSUE] ${i.description} (${i.severity})`)
    ].join('\n');

    const suggestionsList = reflection.suggestions
      .filter(s => s.priority === 'high')
      .map(s => `- ${s.description}`)
      .join('\n');

    return `# Task: Revise Output Based on Reflection

## Original Goal
${goal}

## Original Output (V1)
\`\`\`
${originalOutput}
\`\`\`

## Reflection Analysis
**Quality Score:** ${(reflection.overallScore * 100).toFixed(1)}%

**Identified Issues:**
${issuesList}

${suggestionsList ? `\n**High-Priority Suggestions:**\n${suggestionsList}\n` : ''}

## Your Task
Create an improved version (V2) that addresses ALL identified issues and gaps.

**Instructions:**
1. Fix all issues marked as [ISSUE]
2. Fill all gaps marked as [GAP]
3. Implement high-priority suggestions
4. Maintain or improve quality
5. Preserve what was done well

Provide the complete revised output.`;
  }

  /**
   * Generate final review and summary
   */
  async _generateFinalReview({ goal, v1, v2, reflection1, reflection2, revisionPlan }) {
    try {
      const prompt = `# Task: Final Review Summary

## Goal
${goal}

## Execution Summary
- **V1 Score:** ${(reflection1.overallScore * 100).toFixed(1)}%
- **V2 Score:** ${(reflection2.overallScore * 100).toFixed(1)}%
- **Improvement:** ${((reflection2.overallScore - reflection1.overallScore) * 100).toFixed(1)}%
- **Revisions Applied:** ${revisionPlan.revisionTasks.length}

## V1 Issues
${reflection1.gaps.length + reflection1.issues.length} total issues

## V2 Status
${reflection2.gaps.length + reflection2.issues.length} remaining issues

Create a concise summary (3-5 sentences) of:
1. What was accomplished
2. Key improvements made
3. Final quality assessment
4. Any remaining considerations

Output ONLY the summary text, no JSON or formatting.`;

      const response = await modelProxy.callModel({
        model: 'gpt-4o-mini',
        prompt,
        temperature: 0.5
      });

      return response.output;

    } catch (error) {
      logger.error(`Final review generation failed: ${error.message}`);
      return `Goal accomplished with ${revisionPlan.revisionTasks.length} revisions applied. Quality improved from ${(reflection1.overallScore * 100).toFixed(0)}% to ${(reflection2.overallScore * 100).toFixed(0)}%.`;
    }
  }

  /**
   * Calculate total tokens used
   */
  _calculateTotalTokens(executionLog) {
    let total = 0;
    for (const entry of executionLog) {
      if (entry.result && entry.result.metadata && entry.result.metadata.tokensUsed) {
        total += entry.result.metadata.tokensUsed;
      }
    }
    return total;
  }

  /**
   * Configure orchestrator
   */
  configure(options) {
    if (options.maxRevisionCycles !== undefined) {
      this.maxRevisionCycles = options.maxRevisionCycles;
    }
    if (options.qualityThreshold !== undefined) {
      this.qualityThreshold = options.qualityThreshold;
    }
    if (options.enableAutoRevision !== undefined) {
      this.enableAutoRevision = options.enableAutoRevision;
    }
    logger.info('Reflection orchestrator configured');
  }
}

module.exports = new ReflectionOrchestrator();
