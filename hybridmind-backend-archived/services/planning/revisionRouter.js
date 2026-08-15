/**
 * Revision Router - Intelligently routes revisions based on reflection feedback
 * Determines which parts need revision and how to approach them
 */

const logger = require('../../utils/logger');

class RevisionRouter {
  constructor() {
    // Revision strategies based on issue patterns
    this.strategies = {
      completeness: {
        priority: 'high',
        approach: 'additive', // Add missing parts
        model: 'gpt-4o-mini'
      },
      correctness: {
        priority: 'critical',
        approach: 'corrective', // Fix errors
        model: 'gpt-4o'  // Use more capable model for correctness
      },
      quality: {
        priority: 'medium',
        approach: 'refinement', // Polish and improve
        model: 'gpt-4o-mini'
      },
      efficiency: {
        priority: 'low',
        approach: 'optimization', // Optimize approach
        model: 'gpt-4o-mini'
      },
      risks: {
        priority: 'high',
        approach: 'mitigation', // Add safeguards
        model: 'gpt-4o-mini'
      }
    };

    // Revision templates
    this.revisionTemplates = {
      additive: 'Add the missing components while preserving existing work',
      corrective: 'Fix the identified errors and issues',
      refinement: 'Improve the quality and clarity',
      optimization: 'Optimize the approach for better efficiency',
      mitigation: 'Add error handling and risk mitigations'
    };
  }

  /**
   * Route revisions based on reflection feedback
   * @param {Object} options
   * @param {Object} options.reflection - Reflection results
   * @param {string} options.originalOutput - Original output
   * @param {Object} options.plan - Original plan
   * @returns {Promise<Object>} Revision routing plan
   */
  async routeRevisions({ reflection, originalOutput, plan = null }) {
    try {
      logger.info('Routing revisions based on reflection feedback');

      if (!reflection.needsRevision) {
        return {
          needsRevision: false,
          message: 'No revisions needed - output meets quality standards'
        };
      }

      // Analyze gaps and issues
      const analysis = this._analyzeIssues(reflection);

      // Create revision tasks
      const revisionTasks = this._createRevisionTasks(analysis, reflection);

      // Prioritize tasks
      const prioritized = this._prioritizeTasks(revisionTasks);

      // Group tasks by strategy
      const grouped = this._groupTasksByStrategy(prioritized);

      // Create execution plan
      const executionPlan = this._createExecutionPlan(grouped, originalOutput);

      return {
        needsRevision: true,
        analysis,
        revisionTasks: prioritized,
        groupedTasks: grouped,
        executionPlan,
        estimatedEffort: this._estimateEffort(prioritized)
      };

    } catch (error) {
      logger.error(`Revision routing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze issues to determine revision approach
   */
  _analyzeIssues(reflection) {
    const analysis = {
      totalIssues: 0,
      criticalIssues: 0,
      categoryCounts: {},
      dominantCategory: null,
      overallSeverity: 'low'
    };

    // Count gaps
    for (const gap of reflection.gaps || []) {
      analysis.totalIssues++;
      if (gap.severity === 'high') analysis.criticalIssues++;
      
      const cat = gap.category || 'general';
      analysis.categoryCounts[cat] = (analysis.categoryCounts[cat] || 0) + 1;
    }

    // Count issues
    for (const issue of reflection.issues || []) {
      analysis.totalIssues++;
      if (issue.severity === 'high') analysis.criticalIssues++;
      
      const cat = issue.category || 'general';
      analysis.categoryCounts[cat] = (analysis.categoryCounts[cat] || 0) + 1;
    }

    // Determine dominant category
    let maxCount = 0;
    for (const [category, count] of Object.entries(analysis.categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        analysis.dominantCategory = category;
      }
    }

    // Determine overall severity
    if (analysis.criticalIssues > 0) {
      analysis.overallSeverity = 'critical';
    } else if (analysis.totalIssues > 5) {
      analysis.overallSeverity = 'high';
    } else if (analysis.totalIssues > 2) {
      analysis.overallSeverity = 'medium';
    }

    return analysis;
  }

  /**
   * Create revision tasks from analysis
   */
  _createRevisionTasks(analysis, reflection) {
    const tasks = [];

    // Create tasks from gaps
    for (const gap of reflection.gaps || []) {
      const strategy = this.strategies[gap.category] || this.strategies.completeness;
      
      tasks.push({
        id: `gap_${tasks.length}`,
        type: 'gap',
        category: gap.category,
        severity: gap.severity,
        priority: this._determinePriority(gap.severity, strategy.priority),
        description: gap.description,
        location: gap.location,
        strategy: strategy.approach,
        suggestedModel: strategy.model,
        template: this.revisionTemplates[strategy.approach]
      });
    }

    // Create tasks from issues
    for (const issue of reflection.issues || []) {
      const strategy = this.strategies[issue.category] || this.strategies.correctness;
      
      tasks.push({
        id: `issue_${tasks.length}`,
        type: 'issue',
        category: issue.category,
        severity: issue.severity,
        priority: this._determinePriority(issue.severity, strategy.priority),
        description: issue.description,
        location: issue.location,
        strategy: strategy.approach,
        suggestedModel: strategy.model,
        template: this.revisionTemplates[strategy.approach]
      });
    }

    // Create tasks from high-priority suggestions
    for (const suggestion of reflection.suggestions || []) {
      if (suggestion.priority === 'high') {
        const strategy = this.strategies[suggestion.category] || this.strategies.quality;
        
        tasks.push({
          id: `suggestion_${tasks.length}`,
          type: 'enhancement',
          category: suggestion.category,
          severity: 'low',
          priority: suggestion.priority,
          description: suggestion.description,
          expectedImpact: suggestion.expectedImpact,
          strategy: strategy.approach,
          suggestedModel: strategy.model,
          template: this.revisionTemplates[strategy.approach]
        });
      }
    }

    return tasks;
  }

  /**
   * Determine task priority
   */
  _determinePriority(severity, strategyPriority) {
    const severityScore = { low: 1, medium: 2, high: 3, critical: 4 }[severity] || 2;
    const priorityScore = { low: 1, medium: 2, high: 3, critical: 4 }[strategyPriority] || 2;
    
    const combined = Math.max(severityScore, priorityScore);
    
    if (combined >= 4) return 'critical';
    if (combined >= 3) return 'high';
    if (combined >= 2) return 'medium';
    return 'low';
  }

  /**
   * Prioritize tasks
   */
  _prioritizeTasks(tasks) {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return tasks.sort((a, b) => {
      const aPrio = priorityOrder[a.priority] || 99;
      const bPrio = priorityOrder[b.priority] || 99;
      return aPrio - bPrio;
    });
  }

  /**
   * Group tasks by revision strategy
   */
  _groupTasksByStrategy(tasks) {
    const grouped = {};

    for (const task of tasks) {
      const strategy = task.strategy || 'general';
      if (!grouped[strategy]) {
        grouped[strategy] = [];
      }
      grouped[strategy].push(task);
    }

    return grouped;
  }

  /**
   * Create execution plan for revisions
   */
  _createExecutionPlan(groupedTasks, originalOutput) {
    const plan = {
      phases: [],
      parallelizable: [],
      sequential: []
    };

    // Phase 1: Critical corrections (must be sequential)
    const corrective = groupedTasks.corrective || [];
    if (corrective.length > 0) {
      plan.phases.push({
        phase: 1,
        name: 'Critical Corrections',
        strategy: 'corrective',
        tasks: corrective,
        approach: 'sequential',
        estimatedDuration: 'high'
      });
      plan.sequential.push(...corrective.map(t => t.id));
    }

    // Phase 2: Add missing components (can be partially parallel)
    const additive = groupedTasks.additive || [];
    if (additive.length > 0) {
      plan.phases.push({
        phase: 2,
        name: 'Add Missing Components',
        strategy: 'additive',
        tasks: additive,
        approach: 'partially-parallel',
        estimatedDuration: 'medium'
      });
      // First additive is sequential, rest can be parallel
      if (additive.length > 0) plan.sequential.push(additive[0].id);
      if (additive.length > 1) plan.parallelizable.push(...additive.slice(1).map(t => t.id));
    }

    // Phase 3: Optimizations and refinements (can be parallel)
    const optimization = groupedTasks.optimization || [];
    const refinement = groupedTasks.refinement || [];
    const combined = [...optimization, ...refinement];
    
    if (combined.length > 0) {
      plan.phases.push({
        phase: 3,
        name: 'Optimizations & Refinements',
        strategy: 'optimization-refinement',
        tasks: combined,
        approach: 'parallel',
        estimatedDuration: 'low'
      });
      plan.parallelizable.push(...combined.map(t => t.id));
    }

    // Phase 4: Add mitigations (can be parallel)
    const mitigation = groupedTasks.mitigation || [];
    if (mitigation.length > 0) {
      plan.phases.push({
        phase: 4,
        name: 'Add Risk Mitigations',
        strategy: 'mitigation',
        tasks: mitigation,
        approach: 'parallel',
        estimatedDuration: 'low'
      });
      plan.parallelizable.push(...mitigation.map(t => t.id));
    }

    return plan;
  }

  /**
   * Estimate revision effort
   */
  _estimateEffort(tasks) {
    const effortMap = {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1
    };

    let totalEffort = 0;
    for (const task of tasks) {
      totalEffort += effortMap[task.priority] || 1;
    }

    if (totalEffort > 20) return 'very-high';
    if (totalEffort > 10) return 'high';
    if (totalEffort > 5) return 'medium';
    return 'low';
  }

  /**
   * Determine if incremental revision is possible
   */
  canDoIncrementalRevision(revisionPlan) {
    // Can do incremental if:
    // 1. No critical correctness issues
    // 2. Most tasks are additive or refinement
    // 3. Overall effort is low-medium

    const hasCriticalCorrections = revisionPlan.revisionTasks.some(
      t => t.category === 'correctness' && t.severity === 'high'
    );

    if (hasCriticalCorrections) {
      return {
        possible: false,
        reason: 'Critical correctness issues require full revision'
      };
    }

    const additiveRefinement = revisionPlan.revisionTasks.filter(
      t => t.strategy === 'additive' || t.strategy === 'refinement'
    );

    const ratio = additiveRefinement.length / revisionPlan.revisionTasks.length;

    if (ratio > 0.7 && revisionPlan.estimatedEffort !== 'very-high') {
      return {
        possible: true,
        reason: 'Mostly additive/refinement changes',
        tasks: additiveRefinement
      };
    }

    return {
      possible: false,
      reason: 'Too many structural changes required'
    };
  }

  /**
   * Generate revision prompt for a specific task
   */
  generateRevisionPrompt(task, originalOutput, goal) {
    return `# Revision Task: ${task.description}

## Task Type
${task.type.toUpperCase()} (${task.category})

## Priority
${task.priority.toUpperCase()}

## Strategy
${task.template}

## Original Goal
${goal}

## Current Output
\`\`\`
${originalOutput.substring(0, 3000)}
${originalOutput.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

## What to Fix
${task.description}

${task.location ? `## Location\n${task.location}\n` : ''}

## Instructions
${task.template}.
Focus ONLY on this specific issue.
Provide the revised version of the affected part.
Explain what was changed and why.

Output format:
\`\`\`json
{
  "revisedSection": "The corrected/improved code or content",
  "changes": "Explanation of what was changed",
  "reasoning": "Why this change addresses the issue"
}
\`\`\``;
  }

  /**
   * Configure revision router
   */
  configure(options) {
    if (options.strategies) {
      this.strategies = { ...this.strategies, ...options.strategies };
    }
    if (options.revisionTemplates) {
      this.revisionTemplates = { ...this.revisionTemplates, ...options.revisionTemplates };
    }
    logger.info('Revision router configured');
  }
}

module.exports = new RevisionRouter();
