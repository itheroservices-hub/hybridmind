/**
 * Context Router - Routes context chunks to appropriate agent steps
 * Optimizes context distribution across multi-step workflows
 */

const logger = require('../../utils/logger');

class ContextRouter {
  constructor() {
    // Routing strategies
    this.strategies = {
      sequential: this._routeSequential.bind(this),
      parallel: this._routeParallel.bind(this),
      hierarchical: this._routeHierarchical.bind(this),
      adaptive: this._routeAdaptive.bind(this)
    };

    this.defaultStrategy = 'adaptive';
  }

  /**
   * Create routing plan for agent chain
   * @param {Object} options
   * @param {Array} options.chunks - Context chunks to route
   * @param {Array} options.chainSteps - Steps in the chain
   * @param {Object} options.globalContext - Shared context
   * @param {number} options.maxTokensPerStep - Max tokens per step
   * @param {string} options.strategy - Routing strategy
   * @returns {Promise<Array>} Routing plan for each step
   */
  async createRoutingPlan({ 
    chunks, 
    chainSteps, 
    globalContext = {}, 
    maxTokensPerStep = 8000,
    strategy = null
  }) {
    try {
      logger.info(`Creating routing plan for ${chainSteps.length} steps with ${chunks.length} chunks`);

      // Choose strategy
      const strategyName = strategy || this._inferStrategy(chainSteps);
      const routingFn = this.strategies[strategyName] || this.strategies[this.defaultStrategy];

      logger.info(`Using ${strategyName} routing strategy`);

      // Execute routing strategy
      const routingPlan = await routingFn({
        chunks,
        chainSteps,
        globalContext,
        maxTokensPerStep
      });

      // Optimize for reuse
      const optimizedPlan = this._optimizeReuse(routingPlan, chunks);

      logger.info(`Routing plan created with ${optimizedPlan.length} routes`);

      return optimizedPlan;

    } catch (error) {
      logger.error(`Routing plan creation failed: ${error.message}`);
      // Fallback to simple sequential routing
      return this._routeSequential({ chunks, chainSteps, globalContext, maxTokensPerStep });
    }
  }

  /**
   * Infer best routing strategy from chain characteristics
   */
  _inferStrategy(chainSteps) {
    // If steps are independent, use parallel
    const allIndependent = chainSteps.every(step => 
      !step.dependencies || step.dependencies.length === 0
    );
    if (allIndependent && chainSteps.length > 2) {
      return 'parallel';
    }

    // If clear hierarchy, use hierarchical
    const hasHierarchy = chainSteps.some(step => 
      step.dependencies && step.dependencies.length > 1
    );
    if (hasHierarchy) {
      return 'hierarchical';
    }

    // If sequential dependencies, use sequential
    const isSequential = chainSteps.every((step, i) => 
      i === 0 || (step.dependencies && step.dependencies.includes(chainSteps[i-1].id))
    );
    if (isSequential) {
      return 'sequential';
    }

    // Default to adaptive
    return 'adaptive';
  }

  /**
   * Sequential routing - Each step gets chunks relevant to it and previous output
   */
  async _routeSequential({ chunks, chainSteps, globalContext, maxTokensPerStep }) {
    const routingPlan = [];

    for (let i = 0; i < chainSteps.length; i++) {
      const step = chainSteps[i];
      
      // Get task description for this step
      const task = step.description || step.task || step.name;
      
      // Score chunks for this step
      const scoredChunks = this._scoreChunksForStep(chunks, task, step.type);
      
      // Select top chunks within token budget
      const selectedChunks = this._selectChunksWithinBudget(scoredChunks, maxTokensPerStep);

      // If not first step, include output from previous step
      const previousStepIds = i > 0 ? [chainSteps[i-1].id] : [];

      routingPlan.push({
        stepId: step.id,
        stepName: step.name,
        chunks: selectedChunks,
        sharedWithSteps: [],
        dependsOn: previousStepIds,
        reuseRatio: 0
      });
    }

    return routingPlan;
  }

  /**
   * Parallel routing - All steps get same relevant chunks
   */
  async _routeParallel({ chunks, chainSteps, globalContext, maxTokensPerStep }) {
    const routingPlan = [];

    // Find chunks relevant to any step
    const allTasks = chainSteps.map(s => s.description || s.task || s.name).join(' ');
    const globalScoredChunks = this._scoreChunksForStep(chunks, allTasks, 'general');
    const sharedChunks = this._selectChunksWithinBudget(globalScoredChunks, maxTokensPerStep * 0.6);

    // Each step gets shared chunks plus step-specific chunks
    for (const step of chainSteps) {
      const task = step.description || step.task || step.name;
      const stepSpecificChunks = this._scoreChunksForStep(chunks, task, step.type);
      
      // Combine shared and specific chunks
      const combinedChunks = this._mergeChunks(
        sharedChunks, 
        stepSpecificChunks,
        maxTokensPerStep
      );

      routingPlan.push({
        stepId: step.id,
        stepName: step.name,
        chunks: combinedChunks,
        sharedWithSteps: chainSteps.filter(s => s.id !== step.id).map(s => s.id),
        dependsOn: [],
        reuseRatio: sharedChunks.length / combinedChunks.length
      });
    }

    return routingPlan;
  }

  /**
   * Hierarchical routing - Root steps get more context, leaf steps get specific context
   */
  async _routeHierarchical({ chunks, chainSteps, globalContext, maxTokensPerStep }) {
    const routingPlan = [];

    // Build dependency tree
    const tree = this._buildDependencyTree(chainSteps);
    
    // Route by tree level
    for (const step of chainSteps) {
      const level = tree.levels[step.id] || 0;
      const isRoot = level === 0;
      
      const task = step.description || step.task || step.name;
      const scoredChunks = this._scoreChunksForStep(chunks, task, step.type);
      
      // Root steps get more context
      const budget = isRoot ? maxTokensPerStep : maxTokensPerStep * 0.7;
      const selectedChunks = this._selectChunksWithinBudget(scoredChunks, budget);

      // Find steps that share dependencies
      const sharedWith = tree.siblings[step.id] || [];

      routingPlan.push({
        stepId: step.id,
        stepName: step.name,
        chunks: selectedChunks,
        sharedWithSteps: sharedWith,
        dependsOn: step.dependencies || [],
        reuseRatio: 0,
        treeLevel: level
      });
    }

    return routingPlan;
  }

  /**
   * Adaptive routing - Adapts based on step characteristics
   */
  async _routeAdaptive({ chunks, chainSteps, globalContext, maxTokensPerStep }) {
    const routingPlan = [];

    // Categorize steps
    const stepCategories = this._categorizeSteps(chainSteps);
    
    // Create chunk pools for different categories
    const chunkPools = {
      analysis: chunks.filter(c => c.type === 'function' || c.type === 'class'),
      refactor: chunks.filter(c => c.relevanceScore > 0.7),
      generate: chunks.filter(c => c.metadata?.hasComments),
      general: chunks
    };

    for (const step of chainSteps) {
      const category = stepCategories[step.id] || 'general';
      const task = step.description || step.task || step.name;
      
      // Use appropriate chunk pool
      const pool = chunkPools[category] || chunkPools.general;
      const scoredChunks = this._scoreChunksForStep(pool, task, step.type);
      
      // Adaptive budget based on step complexity
      const complexity = step.complexity || 'moderate';
      const budget = this._calculateAdaptiveBudget(complexity, maxTokensPerStep);
      
      const selectedChunks = this._selectChunksWithinBudget(scoredChunks, budget);

      routingPlan.push({
        stepId: step.id,
        stepName: step.name,
        chunks: selectedChunks,
        sharedWithSteps: [],
        dependsOn: step.dependencies || [],
        reuseRatio: 0,
        category
      });
    }

    return routingPlan;
  }

  /**
   * Score chunks for a specific step
   */
  _scoreChunksForStep(chunks, task, stepType) {
    // Simple keyword-based scoring
    const taskKeywords = task.toLowerCase().split(/\s+/);
    
    return chunks.map(chunk => {
      const chunkText = chunk.text.toLowerCase();
      let score = chunk.relevanceScore || 0.5;
      
      // Boost based on keyword matches
      for (const keyword of taskKeywords) {
        if (chunkText.includes(keyword)) {
          score += 0.1;
        }
      }

      return {
        ...chunk,
        stepRelevanceScore: Math.min(1.0, score)
      };
    }).sort((a, b) => b.stepRelevanceScore - a.stepRelevanceScore);
  }

  /**
   * Select chunks within token budget
   */
  _selectChunksWithinBudget(scoredChunks, maxTokens) {
    const selected = [];
    let currentTokens = 0;

    for (const chunk of scoredChunks) {
      if (currentTokens + chunk.tokens <= maxTokens) {
        selected.push(chunk);
        currentTokens += chunk.tokens;
      }

      if (currentTokens >= maxTokens * 0.95) break;
    }

    return selected;
  }

  /**
   * Merge shared and specific chunks
   */
  _mergeChunks(sharedChunks, specificChunks, maxTokens) {
    const merged = new Map();
    
    // Add shared chunks
    for (const chunk of sharedChunks) {
      merged.set(chunk.id, chunk);
    }
    
    // Add specific chunks if they fit
    let currentTokens = sharedChunks.reduce((sum, c) => sum + c.tokens, 0);
    for (const chunk of specificChunks) {
      if (!merged.has(chunk.id) && currentTokens + chunk.tokens <= maxTokens) {
        merged.set(chunk.id, chunk);
        currentTokens += chunk.tokens;
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Build dependency tree from chain steps
   */
  _buildDependencyTree(chainSteps) {
    const tree = {
      levels: {},
      siblings: {}
    };

    // Calculate levels (distance from root)
    for (const step of chainSteps) {
      if (!step.dependencies || step.dependencies.length === 0) {
        tree.levels[step.id] = 0;
      }
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const step of chainSteps) {
        if (tree.levels[step.id] !== undefined) continue;
        
        if (step.dependencies) {
          const depLevels = step.dependencies
            .map(dep => tree.levels[dep])
            .filter(l => l !== undefined);
          
          if (depLevels.length === step.dependencies.length) {
            tree.levels[step.id] = Math.max(...depLevels) + 1;
            changed = true;
          }
        }
      }
    }

    // Find siblings (steps at same level)
    for (const step of chainSteps) {
      const level = tree.levels[step.id];
      tree.siblings[step.id] = chainSteps
        .filter(s => s.id !== step.id && tree.levels[s.id] === level)
        .map(s => s.id);
    }

    return tree;
  }

  /**
   * Categorize steps by type
   */
  _categorizeSteps(chainSteps) {
    const categories = {};
    
    for (const step of chainSteps) {
      const name = (step.name || '').toLowerCase();
      const desc = (step.description || step.task || '').toLowerCase();
      const combined = name + ' ' + desc;

      if (/analyz|review|inspect|check/.test(combined)) {
        categories[step.id] = 'analysis';
      } else if (/refactor|improve|optimize|clean/.test(combined)) {
        categories[step.id] = 'refactor';
      } else if (/generate|create|build|implement/.test(combined)) {
        categories[step.id] = 'generate';
      } else {
        categories[step.id] = 'general';
      }
    }

    return categories;
  }

  /**
   * Calculate adaptive budget based on complexity
   */
  _calculateAdaptiveBudget(complexity, maxTokens) {
    const multipliers = {
      simple: 0.6,
      moderate: 1.0,
      complex: 1.3,
      very_complex: 1.5
    };

    const multiplier = multipliers[complexity] || 1.0;
    return Math.floor(maxTokens * multiplier);
  }

  /**
   * Optimize routing plan for chunk reuse
   */
  _optimizeReuse(routingPlan, allChunks) {
    // Track which chunks are used by which steps
    const chunkUsage = new Map();

    for (const route of routingPlan) {
      for (const chunk of route.chunks) {
        if (!chunkUsage.has(chunk.id)) {
          chunkUsage.set(chunk.id, []);
        }
        chunkUsage.get(chunk.id).push(route.stepId);
      }
    }

    // Update routing plan with reuse information
    for (const route of routingPlan) {
      const reusedChunks = route.chunks.filter(chunk => 
        chunkUsage.get(chunk.id).length > 1
      );

      route.reuseRatio = route.chunks.length > 0 
        ? reusedChunks.length / route.chunks.length 
        : 0;

      // Add list of steps that share chunks
      const sharedSteps = new Set();
      for (const chunk of reusedChunks) {
        for (const stepId of chunkUsage.get(chunk.id)) {
          if (stepId !== route.stepId) {
            sharedSteps.add(stepId);
          }
        }
      }
      route.sharedWithSteps = Array.from(sharedSteps);
    }

    return routingPlan;
  }

  /**
   * Get routing statistics
   */
  getStatistics(routingPlan) {
    const stats = {
      totalSteps: routingPlan.length,
      totalChunks: new Set(routingPlan.flatMap(r => r.chunks.map(c => c.id))).size,
      averageChunksPerStep: 0,
      averageReuseRatio: 0,
      totalTokens: 0
    };

    if (routingPlan.length > 0) {
      stats.averageChunksPerStep = routingPlan.reduce((sum, r) => sum + r.chunks.length, 0) / routingPlan.length;
      stats.averageReuseRatio = routingPlan.reduce((sum, r) => sum + r.reuseRatio, 0) / routingPlan.length;
      stats.totalTokens = routingPlan.reduce((sum, r) => 
        sum + r.chunks.reduce((s, c) => s + c.tokens, 0), 0
      );
    }

    return stats;
  }
}

module.exports = ContextRouter;
