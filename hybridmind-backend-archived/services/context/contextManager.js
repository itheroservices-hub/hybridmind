/**
 * Context Manager - Dynamic task composition and context optimization
 * Orchestrates context chunking, relevance scoring, and routing for agent chains
 * Reduces token bloat and optimizes agent memory
 */

const ContextChunker = require('./contextChunker');
const RelevanceScorer = require('./relevanceScorer');
const ContextRouter = require('./contextRouter');
const ContextCache = require('./contextCache');
const logger = require('../../utils/logger');

class ContextManager {
  constructor() {
    this.chunker = new ContextChunker();
    this.scorer = new RelevanceScorer();
    this.router = new ContextRouter();
    this.cache = new ContextCache();
    
    // Configuration
    this.config = {
      maxContextTokens: 8000,          // Maximum tokens per context
      chunkOverlap: 100,                // Token overlap between chunks
      relevanceThreshold: 0.6,          // Minimum relevance score
      cacheTimeout: 300000,             // 5 minutes
      enableCaching: true,
      enableCompression: true
    };
  }

  /**
   * Process and optimize context for a single agent request
   * @param {Object} options
   * @param {string} options.rawContext - Raw unprocessed context
   * @param {string} options.task - The task/query being performed
   * @param {string} options.taskType - Type: 'analysis', 'refactor', 'generate', etc.
   * @param {number} options.maxTokens - Max tokens to return
   * @returns {Promise<Object>} Optimized context
   */
  async processContext({ rawContext, task, taskType = 'general', maxTokens = null }) {
    const startTime = Date.now();
    maxTokens = maxTokens || this.config.maxContextTokens;

    try {
      logger.info(`Processing context for task type: ${taskType}`);

      // 1. Check cache first
      const cacheKey = this._generateCacheKey(rawContext, task, taskType);
      if (this.config.enableCaching) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          logger.info('Context retrieved from cache');
          return cached;
        }
      }

      // 2. Chunk the context
      const chunks = await this.chunker.chunk({
        content: rawContext,
        maxChunkSize: 1000, // tokens per chunk
        overlap: this.config.chunkOverlap,
        preserveStructure: true
      });

      logger.info(`Created ${chunks.length} context chunks`);

      // 3. Score each chunk for relevance to the task
      const scoredChunks = await this.scorer.scoreChunks({
        chunks,
        task,
        taskType
      });

      // 4. Filter by relevance threshold
      const relevantChunks = scoredChunks.filter(
        chunk => chunk.relevanceScore >= this.config.relevanceThreshold
      );

      logger.info(`${relevantChunks.length}/${chunks.length} chunks passed relevance threshold`);

      // 5. Optimize selection to fit within token budget
      const selectedChunks = this._selectOptimalChunks(relevantChunks, maxTokens);

      // 6. Assemble optimized context
      const optimizedContext = this._assembleContext(selectedChunks);

      const result = {
        context: optimizedContext.text,
        chunks: selectedChunks,
        metadata: {
          originalTokens: this._estimateTokens(rawContext),
          optimizedTokens: optimizedContext.tokens,
          compressionRatio: this._estimateTokens(rawContext) / optimizedContext.tokens,
          chunksUsed: selectedChunks.length,
          chunksTotal: chunks.length,
          averageRelevance: this._calculateAverageRelevance(selectedChunks),
          processingTime: Date.now() - startTime
        }
      };

      // 7. Cache the result
      if (this.config.enableCaching) {
        await this.cache.set(cacheKey, result, this.config.cacheTimeout);
      }

      logger.info(`Context optimized: ${result.metadata.compressionRatio.toFixed(2)}x compression`);

      return result;

    } catch (error) {
      logger.error(`Context processing failed: ${error.message}`);
      // Fallback to raw context if processing fails
      return {
        context: rawContext,
        chunks: [],
        metadata: {
          originalTokens: this._estimateTokens(rawContext),
          optimizedTokens: this._estimateTokens(rawContext),
          compressionRatio: 1.0,
          error: error.message
        }
      };
    }
  }

  /**
   * Process and route context for agent chains
   * Distributes context intelligently across multiple steps
   * @param {Object} options
   * @param {string} options.rawContext - Raw context
   * @param {Array} options.chainSteps - Array of chain steps with tasks
   * @param {Object} options.globalContext - Context shared across all steps
   * @returns {Promise<Object>} Routing map for each step
   */
  async processChainContext({ rawContext, chainSteps, globalContext = {} }) {
    const startTime = Date.now();

    try {
      logger.info(`Processing context for chain with ${chainSteps.length} steps`);

      // 1. Chunk the raw context
      const chunks = await this.chunker.chunk({
        content: rawContext,
        maxChunkSize: 1000,
        overlap: this.config.chunkOverlap,
        preserveStructure: true
      });

      // 2. Create routing plan
      const routingPlan = await this.router.createRoutingPlan({
        chunks,
        chainSteps,
        globalContext,
        maxTokensPerStep: this.config.maxContextTokens
      });

      // 3. Build context packages for each step
      const contextMap = {};
      for (const step of chainSteps) {
        const stepRouting = routingPlan.find(r => r.stepId === step.id);
        if (!stepRouting) continue;

        // Get relevant chunks for this step
        const stepChunks = stepRouting.chunks;

        // Assemble context for this step
        const assembled = this._assembleContext(stepChunks);

        contextMap[step.id] = {
          context: assembled.text,
          chunks: stepChunks,
          sharedWithSteps: stepRouting.sharedWithSteps || [],
          metadata: {
            tokens: assembled.tokens,
            chunksUsed: stepChunks.length,
            averageRelevance: this._calculateAverageRelevance(stepChunks),
            reuseRatio: stepRouting.reuseRatio || 0
          }
        };
      }

      logger.info(`Created context routing for ${Object.keys(contextMap).length} steps`);

      return {
        contextMap,
        globalContext,
        metadata: {
          totalChunks: chunks.length,
          processingTime: Date.now() - startTime,
          reuseEfficiency: this._calculateReuseEfficiency(routingPlan)
        }
      };

    } catch (error) {
      logger.error(`Chain context processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  configure(options) {
    this.config = { ...this.config, ...options };
    logger.info('Context manager configuration updated');
  }

  /**
   * Clear cache
   */
  async clearCache() {
    await this.cache.clear();
    logger.info('Context cache cleared');
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    return {
      config: this.config,
      cache: await this.cache.getStats(),
      uptime: process.uptime()
    };
  }

  // ============ Private Helper Methods ============

  /**
   * Select optimal chunks within token budget
   * Uses greedy algorithm prioritizing highest relevance scores
   */
  _selectOptimalChunks(scoredChunks, maxTokens) {
    // Sort by relevance score (descending)
    const sorted = [...scoredChunks].sort((a, b) => b.relevanceScore - a.relevanceScore);

    const selected = [];
    let currentTokens = 0;

    for (const chunk of sorted) {
      if (currentTokens + chunk.tokens <= maxTokens) {
        selected.push(chunk);
        currentTokens += chunk.tokens;
      }

      if (currentTokens >= maxTokens * 0.95) {
        break; // Stop at 95% of budget
      }
    }

    // Re-sort selected chunks by original position for coherence
    return selected.sort((a, b) => a.position - b.position);
  }

  /**
   * Assemble context from chunks
   */
  _assembleContext(chunks) {
    const parts = chunks.map(chunk => chunk.text);
    const text = parts.join('\n\n---\n\n');
    const tokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);

    return { text, tokens };
  }

  /**
   * Generate cache key
   */
  _generateCacheKey(context, task, taskType) {
    const hash = this._simpleHash(context + task + taskType);
    return `ctx_${taskType}_${hash}`;
  }

  /**
   * Simple hash function
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Estimate tokens (rough approximation)
   */
  _estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate average relevance score
   */
  _calculateAverageRelevance(chunks) {
    if (chunks.length === 0) return 0;
    const sum = chunks.reduce((acc, chunk) => acc + chunk.relevanceScore, 0);
    return sum / chunks.length;
  }

  /**
   * Calculate reuse efficiency across chain steps
   */
  _calculateReuseEfficiency(routingPlan) {
    if (routingPlan.length === 0) return 0;

    const chunkUsage = new Map();
    let totalChunks = 0;

    // Count how many times each chunk is reused
    for (const route of routingPlan) {
      for (const chunk of route.chunks) {
        const id = chunk.id;
        chunkUsage.set(id, (chunkUsage.get(id) || 0) + 1);
        totalChunks++;
      }
    }

    // Calculate average reuse
    const uniqueChunks = chunkUsage.size;
    if (uniqueChunks === 0) return 0;

    return totalChunks / uniqueChunks;
  }
}

module.exports = ContextManager;
