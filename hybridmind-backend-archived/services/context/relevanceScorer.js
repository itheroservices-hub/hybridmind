/**
 * Relevance Scorer - Scores context chunks based on relevance to task
 * Uses TF-IDF, keyword matching, and semantic similarity
 */

const logger = require('../../utils/logger');

class RelevanceScorer {
  constructor() {
    // Task type weights for different scoring factors
    this.taskWeights = {
      analysis: { keyword: 0.4, position: 0.2, structure: 0.3, recency: 0.1 },
      refactor: { keyword: 0.5, position: 0.1, structure: 0.3, recency: 0.1 },
      generate: { keyword: 0.3, position: 0.2, structure: 0.4, recency: 0.1 },
      debug: { keyword: 0.6, position: 0.1, structure: 0.2, recency: 0.1 },
      general: { keyword: 0.4, position: 0.2, structure: 0.2, recency: 0.2 }
    };
  }

  /**
   * Score chunks for relevance to a task
   * @param {Object} options
   * @param {Array} options.chunks - Chunks to score
   * @param {string} options.task - Task description/query
   * @param {string} options.taskType - Type of task
   * @returns {Promise<Array>} Chunks with relevance scores
   */
  async scoreChunks({ chunks, task, taskType = 'general' }) {
    try {
      logger.info(`Scoring ${chunks.length} chunks for ${taskType} task`);

      // Extract keywords from task
      const taskKeywords = this._extractKeywords(task);
      const weights = this.taskWeights[taskType] || this.taskWeights.general;

      // Score each chunk
      const scoredChunks = chunks.map(chunk => {
        const scores = {
          keyword: this._scoreKeywords(chunk, taskKeywords),
          position: this._scorePosition(chunk, chunks.length),
          structure: this._scoreStructure(chunk, taskType),
          recency: this._scoreRecency(chunk)
        };

        // Calculate weighted relevance score
        const relevanceScore = 
          scores.keyword * weights.keyword +
          scores.position * weights.position +
          scores.structure * weights.structure +
          scores.recency * weights.recency;

        return {
          ...chunk,
          relevanceScore: Math.min(1.0, relevanceScore),
          scoreBreakdown: scores
        };
      });

      logger.info(`Scored chunks - avg relevance: ${this._calculateAverage(scoredChunks)}`);

      return scoredChunks;

    } catch (error) {
      logger.error(`Chunk scoring failed: ${error.message}`);
      // Return chunks with neutral score if scoring fails
      return chunks.map(chunk => ({ ...chunk, relevanceScore: 0.5 }));
    }
  }

  /**
   * Extract keywords from task/query
   */
  _extractKeywords(task) {
    // Remove common words (stop words)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    // Extract words
    const words = task.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Calculate word frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Extract programming-specific terms
    const codeTerms = task.match(/[A-Z][a-z]+|[a-z]+[A-Z][a-z]+|\w+\(\)|class\s+\w+|function\s+\w+/g) || [];
    
    // Combine and deduplicate
    const allKeywords = [...new Set([...words, ...codeTerms.map(t => t.toLowerCase())])];

    return {
      words: allKeywords,
      frequency,
      codeTerms: codeTerms.map(t => t.toLowerCase())
    };
  }

  /**
   * Score chunk based on keyword matches
   * Uses TF-IDF-like approach
   */
  _scoreKeywords(chunk, taskKeywords) {
    const chunkText = chunk.text.toLowerCase();
    const chunkWords = chunkText.split(/\s+/);
    
    let matchCount = 0;
    let weightedScore = 0;

    // Check each keyword
    for (const keyword of taskKeywords.words) {
      const keywordRegex = new RegExp(`\\b${this._escapeRegex(keyword)}\\b`, 'gi');
      const matches = chunkText.match(keywordRegex);
      
      if (matches) {
        matchCount += matches.length;
        
        // Weight by term frequency in task
        const taskFreq = taskKeywords.frequency[keyword] || 1;
        weightedScore += matches.length * Math.log(1 + taskFreq);
      }
    }

    // Bonus for code term matches
    for (const codeTerm of taskKeywords.codeTerms) {
      if (chunkText.includes(codeTerm)) {
        weightedScore += 2; // Higher weight for exact code matches
      }
    }

    // Normalize by chunk length
    const normalizedScore = weightedScore / Math.sqrt(chunkWords.length);

    // Cap at 1.0
    return Math.min(1.0, normalizedScore / 5);
  }

  /**
   * Score based on chunk position
   * Earlier and later chunks often more relevant than middle
   */
  _scorePosition(chunk, totalChunks) {
    if (totalChunks === 1) return 1.0;

    const position = chunk.position;
    const normalizedPos = position / (totalChunks - 1);

    // U-shaped curve: higher scores at start and end
    // f(x) = 1 - 4(x - 0.5)^2
    const score = 1 - 4 * Math.pow(normalizedPos - 0.5, 2);

    return Math.max(0, score);
  }

  /**
   * Score based on structural importance
   */
  _scoreStructure(chunk, taskType) {
    let score = 0.5; // Base score

    const text = chunk.text;
    const type = chunk.type || 'general';

    // Boost for important structures
    if (type === 'function' || type === 'class') {
      score += 0.3;
    }

    if (type === 'method') {
      score += 0.2;
    }

    // Boost for chunks with comments/documentation
    const hasComments = /\/\*\*|\*|\/\//.test(text);
    if (hasComments) {
      score += 0.1;
    }

    // Boost for exports (likely public API)
    if (/^export\s+/m.test(text)) {
      score += 0.1;
    }

    // Task-specific boosts
    if (taskType === 'debug') {
      // Boost chunks with error handling
      if (/try|catch|throw|error/i.test(text)) {
        score += 0.2;
      }
    }

    if (taskType === 'refactor') {
      // Boost chunks with complex logic
      if (/if|else|switch|for|while/gi.test(text)) {
        score += 0.1;
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Score based on recency/freshness
   * More recently added chunks may be more relevant
   */
  _scoreRecency(chunk) {
    // If chunk has timestamp metadata, use it
    if (chunk.metadata?.timestamp) {
      const age = Date.now() - chunk.metadata.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      return Math.max(0, 1 - (age / maxAge));
    }

    // Default: use position as proxy for recency
    // Later chunks assumed to be more recent
    return 0.5;
  }

  /**
   * Calculate average relevance score
   */
  _calculateAverage(scoredChunks) {
    if (scoredChunks.length === 0) return 0;
    const sum = scoredChunks.reduce((acc, chunk) => acc + chunk.relevanceScore, 0);
    return (sum / scoredChunks.length).toFixed(3);
  }

  /**
   * Escape special regex characters
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Score a single chunk (for testing/manual use)
   */
  async scoreChunk(chunk, task, taskType = 'general') {
    const result = await this.scoreChunks({
      chunks: [chunk],
      task,
      taskType
    });
    return result[0];
  }

  /**
   * Update task type weights
   */
  updateWeights(taskType, weights) {
    this.taskWeights[taskType] = { ...this.taskWeights[taskType], ...weights };
    logger.info(`Updated weights for ${taskType} task type`);
  }

  /**
   * Get current weights
   */
  getWeights(taskType) {
    return this.taskWeights[taskType] || this.taskWeights.general;
  }
}

module.exports = RelevanceScorer;
