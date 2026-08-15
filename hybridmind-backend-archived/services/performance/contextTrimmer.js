/**
 * Context Trimmer
 * 
 * Intelligently trims context to reduce token counts while preserving quality:
 * - Removes redundant information
 * - Summarizes large blocks
 * - Keeps most relevant content
 * - Tracks trimming effectiveness
 */

const logger = require('../../utils/logger');

/**
 * Trimming strategies
 */
const TRIM_STRATEGIES = {
  AGGRESSIVE: {
    name: 'aggressive',
    maxTokens: 1000,
    keepRecent: 0.3,
    summarizeLarge: true,
    removeBoilerplate: true
  },
  BALANCED: {
    name: 'balanced',
    maxTokens: 2000,
    keepRecent: 0.5,
    summarizeLarge: true,
    removeBoilerplate: true
  },
  CONSERVATIVE: {
    name: 'conservative',
    maxTokens: 4000,
    keepRecent: 0.7,
    summarizeLarge: false,
    removeBoilerplate: false
  }
};

class ContextTrimmer {
  constructor() {
    this.stats = {
      totalTrims: 0,
      tokensRemoved: 0,
      avgReduction: 0,
      qualityMaintained: 0
    };

    // Boilerplate patterns to remove
    this.boilerplatePatterns = [
      /<!--.*?-->/gs,  // HTML comments
      /\/\*[\s\S]*?\*\//g,  // Block comments
      /\n\s*\n\s*\n/g,  // Multiple blank lines
      /^\s*$/gm,  // Empty lines
    ];
  }

  /**
   * Trim context to fit within token budget
   */
  trim({
    context,
    maxTokens = 2000,
    strategy = 'balanced',
    preserveKeys = []
  }) {
    const strategyConfig = TRIM_STRATEGIES[strategy.toUpperCase()] || TRIM_STRATEGIES.BALANCED;
    
    const beforeTokens = this.estimateTokens(JSON.stringify(context));
    
    if (beforeTokens <= maxTokens) {
      // No trimming needed
      return {
        trimmedContext: context,
        beforeTokens,
        afterTokens: beforeTokens,
        reduction: 0,
        trimmed: false
      };
    }

    let trimmedContext = { ...context };

    // Step 1: Remove boilerplate if enabled
    if (strategyConfig.removeBoilerplate) {
      trimmedContext = this._removeBoilerplate(trimmedContext, preserveKeys);
    }

    // Step 2: Summarize large text blocks if enabled
    if (strategyConfig.summarizeLarge) {
      trimmedContext = this._summarizeLargeBlocks(trimmedContext, preserveKeys);
    }

    // Step 3: Keep most recent/relevant data
    trimmedContext = this._keepMostRelevant(trimmedContext, strategyConfig.keepRecent, preserveKeys);

    // Step 4: Truncate if still too large
    const afterTokens = this.estimateTokens(JSON.stringify(trimmedContext));
    
    if (afterTokens > maxTokens) {
      trimmedContext = this._truncateToLimit(trimmedContext, maxTokens, preserveKeys);
    }

    const finalTokens = this.estimateTokens(JSON.stringify(trimmedContext));
    const reduction = ((beforeTokens - finalTokens) / beforeTokens) * 100;

    // Update stats
    this.stats.totalTrims++;
    this.stats.tokensRemoved += (beforeTokens - finalTokens);
    this.stats.avgReduction = 
      ((this.stats.avgReduction * (this.stats.totalTrims - 1)) + reduction) / 
      this.stats.totalTrims;

    logger.debug(`Context trimmed: ${beforeTokens} → ${finalTokens} tokens (${reduction.toFixed(1)}% reduction)`);

    return {
      trimmedContext,
      beforeTokens,
      afterTokens: finalTokens,
      reduction,
      trimmed: true,
      strategy: strategyConfig.name
    };
  }

  /**
   * Remove boilerplate patterns
   */
  _removeBoilerplate(context, preserveKeys) {
    const cleaned = {};

    for (const [key, value] of Object.entries(context)) {
      if (preserveKeys.includes(key)) {
        cleaned[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        let cleanedValue = value;
        
        // Apply boilerplate patterns
        for (const pattern of this.boilerplatePatterns) {
          cleanedValue = cleanedValue.replace(pattern, '');
        }

        // Remove excessive whitespace
        cleanedValue = cleanedValue.replace(/\s+/g, ' ').trim();

        cleaned[key] = cleanedValue;
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map(item => {
          if (typeof item === 'string') {
            let cleanedItem = item;
            for (const pattern of this.boilerplatePatterns) {
              cleanedItem = cleanedItem.replace(pattern, '');
            }
            return cleanedItem.replace(/\s+/g, ' ').trim();
          }
          return item;
        });
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Summarize large text blocks
   */
  _summarizeLargeBlocks(context, preserveKeys) {
    const summarized = {};
    const LARGE_THRESHOLD = 1000; // characters

    for (const [key, value] of Object.entries(context)) {
      if (preserveKeys.includes(key)) {
        summarized[key] = value;
        continue;
      }

      if (typeof value === 'string' && value.length > LARGE_THRESHOLD) {
        // Keep first and last portions
        const keepLength = Math.floor(LARGE_THRESHOLD / 2);
        const summary = value.slice(0, keepLength) + 
                       '\n...[truncated]...\n' + 
                       value.slice(-keepLength);
        summarized[key] = summary;
      } else if (Array.isArray(value) && value.length > 20) {
        // Keep first 10 and last 10 items
        summarized[key] = [
          ...value.slice(0, 10),
          { truncated: true, originalLength: value.length },
          ...value.slice(-10)
        ];
      } else {
        summarized[key] = value;
      }
    }

    return summarized;
  }

  /**
   * Keep most relevant data
   */
  _keepMostRelevant(context, keepRatio, preserveKeys) {
    const relevant = {};

    // Sort keys by relevance (preserved keys first, then by size)
    const sortedKeys = Object.keys(context).sort((a, b) => {
      if (preserveKeys.includes(a) && !preserveKeys.includes(b)) return -1;
      if (!preserveKeys.includes(a) && preserveKeys.includes(b)) return 1;

      const aSize = JSON.stringify(context[a]).length;
      const bSize = JSON.stringify(context[b]).length;
      return bSize - aSize; // Larger items first (more likely to be important)
    });

    // Keep top percentage
    const keepCount = Math.ceil(sortedKeys.length * keepRatio);
    const keysToKeep = sortedKeys.slice(0, keepCount);

    for (const key of keysToKeep) {
      relevant[key] = context[key];
    }

    // Always include preserved keys
    for (const key of preserveKeys) {
      if (context[key] !== undefined) {
        relevant[key] = context[key];
      }
    }

    return relevant;
  }

  /**
   * Truncate to token limit
   */
  _truncateToLimit(context, maxTokens, preserveKeys) {
    const truncated = {};
    let currentTokens = 0;

    // Sort keys: preserved first, then by priority
    const sortedKeys = Object.keys(context).sort((a, b) => {
      if (preserveKeys.includes(a) && !preserveKeys.includes(b)) return -1;
      if (!preserveKeys.includes(a) && preserveKeys.includes(b)) return 1;
      return 0;
    });

    for (const key of sortedKeys) {
      const value = context[key];
      const valueTokens = this.estimateTokens(JSON.stringify(value));

      if (currentTokens + valueTokens <= maxTokens) {
        truncated[key] = value;
        currentTokens += valueTokens;
      } else if (preserveKeys.includes(key)) {
        // Truncate preserved key to fit
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 50) {
          truncated[key] = this._truncateValue(value, remainingTokens);
          currentTokens = maxTokens;
        }
        break;
      }
    }

    return truncated;
  }

  /**
   * Truncate a single value
   */
  _truncateValue(value, maxTokens) {
    if (typeof value === 'string') {
      const maxChars = maxTokens * 4; // Rough estimate
      return value.slice(0, maxChars) + '...[truncated]';
    } else if (Array.isArray(value)) {
      const keepCount = Math.max(1, Math.floor(value.length * 0.3));
      return value.slice(0, keepCount);
    }
    return value;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Trim prompt intelligently
   */
  trimPrompt({
    prompt,
    maxTokens = 4000,
    keepSystemPrompt = true,
    keepExamples = true
  }) {
    const beforeTokens = this.estimateTokens(prompt);

    if (beforeTokens <= maxTokens) {
      return {
        trimmedPrompt: prompt,
        beforeTokens,
        afterTokens: beforeTokens,
        reduction: 0,
        trimmed: false
      };
    }

    let trimmedPrompt = prompt;

    // Remove comments
    trimmedPrompt = trimmedPrompt.replace(/\/\*[\s\S]*?\*\//g, '');
    trimmedPrompt = trimmedPrompt.replace(/\/\/.*/g, '');

    // Remove excessive whitespace
    trimmedPrompt = trimmedPrompt.replace(/\n\s*\n\s*\n/g, '\n\n');
    trimmedPrompt = trimmedPrompt.replace(/  +/g, ' ');

    // If still too long, truncate from middle
    const currentTokens = this.estimateTokens(trimmedPrompt);
    if (currentTokens > maxTokens) {
      const maxChars = maxTokens * 4;
      const keepStart = Math.floor(maxChars * 0.4);
      const keepEnd = Math.floor(maxChars * 0.4);

      trimmedPrompt = 
        trimmedPrompt.slice(0, keepStart) +
        '\n\n...[content truncated]...\n\n' +
        trimmedPrompt.slice(-keepEnd);
    }

    const afterTokens = this.estimateTokens(trimmedPrompt);
    const reduction = ((beforeTokens - afterTokens) / beforeTokens) * 100;

    this.stats.totalTrims++;
    this.stats.tokensRemoved += (beforeTokens - afterTokens);

    return {
      trimmedPrompt,
      beforeTokens,
      afterTokens,
      reduction,
      trimmed: true
    };
  }

  /**
   * Smart conversation history trimming
   */
  trimConversationHistory({
    messages,
    maxTokens = 3000,
    keepSystemMessage = true,
    keepRecent = 5
  }) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return { trimmedMessages: messages, trimmed: false };
    }

    const beforeTokens = this.estimateTokens(JSON.stringify(messages));

    if (beforeTokens <= maxTokens) {
      return {
        trimmedMessages: messages,
        beforeTokens,
        afterTokens: beforeTokens,
        reduction: 0,
        trimmed: false
      };
    }

    let trimmedMessages = [];

    // Always keep system message if present
    if (keepSystemMessage && messages[0]?.role === 'system') {
      trimmedMessages.push(messages[0]);
    }

    // Keep most recent messages
    const recentMessages = messages.slice(-keepRecent);
    
    // Add older messages until token limit
    let currentTokens = this.estimateTokens(JSON.stringify([...trimmedMessages, ...recentMessages]));
    
    if (currentTokens <= maxTokens) {
      // Can fit more
      for (let i = messages.length - keepRecent - 1; i >= (keepSystemMessage ? 1 : 0); i--) {
        const msgTokens = this.estimateTokens(JSON.stringify(messages[i]));
        
        if (currentTokens + msgTokens <= maxTokens) {
          trimmedMessages.push(messages[i]);
          currentTokens += msgTokens;
        } else {
          break;
        }
      }
    }

    // Add recent messages
    trimmedMessages.push(...recentMessages);

    // Sort by original order
    if (keepSystemMessage) {
      const systemMsg = trimmedMessages[0];
      const otherMsgs = trimmedMessages.slice(1);
      
      otherMsgs.sort((a, b) => {
        return messages.indexOf(a) - messages.indexOf(b);
      });

      trimmedMessages = [systemMsg, ...otherMsgs];
    }

    const afterTokens = this.estimateTokens(JSON.stringify(trimmedMessages));
    const reduction = ((beforeTokens - afterTokens) / beforeTokens) * 100;

    return {
      trimmedMessages,
      beforeTokens,
      afterTokens,
      reduction,
      trimmed: true,
      removedCount: messages.length - trimmedMessages.length
    };
  }

  /**
   * Get trimming stats
   */
  getStats() {
    return {
      ...this.stats,
      avgTokensRemoved: this.stats.totalTrims > 0 
        ? (this.stats.tokensRemoved / this.stats.totalTrims).toFixed(0)
        : 0
    };
  }

  /**
   * Report quality maintained
   */
  reportQualityMaintained() {
    this.stats.qualityMaintained++;
  }
}

// Singleton instance
module.exports = new ContextTrimmer();
