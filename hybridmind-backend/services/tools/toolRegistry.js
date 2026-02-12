/**
 * Tool Registry - Central registry for all available tools
 * Manages tool registration, discovery, and metadata
 */

const logger = require('../../utils/logger');
const { 
  toolSchemas, 
  getAllToolNames, 
  getToolSchema,
  getToolsByCategory,
  getAllCategories,
  validateToolParameters 
} = require('./toolSchemas');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.toolHandlers = new Map();
    this.toolStats = new Map();
    this._initializeTools();
  }

  /**
   * Initialize tools from schemas
   */
  _initializeTools() {
    const toolNames = getAllToolNames();
    
    for (const toolName of toolNames) {
      const schema = getToolSchema(toolName);
      this.tools.set(toolName, {
        ...schema,
        enabled: true,
        registeredAt: new Date()
      });

      // Initialize stats
      this.toolStats.set(toolName, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalCost: 0,
        averageExecutionTime: 0,
        lastCalled: null
      });
    }

    logger.info(`Tool registry initialized with ${toolNames.length} tools`);
  }

  /**
   * Register a tool handler
   * @param {string} toolName - Tool name
   * @param {Function} handler - Tool handler function
   */
  registerHandler(toolName, handler) {
    if (!this.tools.has(toolName)) {
      throw new Error(`Tool '${toolName}' not found in registry`);
    }

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.toolHandlers.set(toolName, handler);
    logger.info(`Handler registered for tool: ${toolName}`);
  }

  /**
   * Get tool by name
   * @param {string} toolName - Tool name
   * @returns {Object|null} Tool metadata
   */
  getTool(toolName) {
    return this.tools.get(toolName) || null;
  }

  /**
   * Get all tools
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of tools
   */
  getAllTools(filters = {}) {
    let tools = Array.from(this.tools.values());

    // Apply filters
    if (filters.category) {
      tools = tools.filter(t => t.category === filters.category);
    }

    if (filters.enabled !== undefined) {
      tools = tools.filter(t => t.enabled === filters.enabled);
    }

    if (filters.riskLevel) {
      tools = tools.filter(t => t.riskLevel === filters.riskLevel);
    }

    return tools;
  }

  /**
   * Get tools by category
   * @param {string} category - Category name
   * @returns {Array} Array of tools
   */
  getToolsByCategory(category) {
    return getToolsByCategory(category);
  }

  /**
   * Get all categories
   * @returns {Array} Array of category names
   */
  getCategories() {
    return getAllCategories();
  }

  /**
   * Check if tool exists
   * @param {string} toolName - Tool name
   * @returns {boolean}
   */
  hasTool(toolName) {
    return this.tools.has(toolName);
  }

  /**
   * Check if tool has handler
   * @param {string} toolName - Tool name
   * @returns {boolean}
   */
  hasHandler(toolName) {
    return this.toolHandlers.has(toolName);
  }

  /**
   * Get tool handler
   * @param {string} toolName - Tool name
   * @returns {Function|null} Tool handler
   */
  getHandler(toolName) {
    return this.toolHandlers.get(toolName) || null;
  }

  /**
   * Validate tool parameters
   * @param {string} toolName - Tool name
   * @param {Object} parameters - Tool parameters
   * @returns {Object} Validation result
   */
  validateParameters(toolName, parameters) {
    return validateToolParameters(toolName, parameters);
  }

  /**
   * Enable/disable tool
   * @param {string} toolName - Tool name
   * @param {boolean} enabled - Enable flag
   */
  setToolEnabled(toolName, enabled) {
    const tool = this.tools.get(toolName);
    if (tool) {
      tool.enabled = enabled;
      logger.info(`Tool ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Update tool statistics
   * @param {string} toolName - Tool name
   * @param {Object} stats - Stats update
   */
  updateStats(toolName, { success, executionTime, cost }) {
    const stats = this.toolStats.get(toolName);
    if (!stats) return;

    stats.totalCalls++;
    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    if (cost !== undefined) {
      stats.totalCost += cost;
    }

    if (executionTime !== undefined) {
      // Calculate rolling average
      const prevAvg = stats.averageExecutionTime || 0;
      const prevCount = stats.totalCalls - 1;
      stats.averageExecutionTime = (prevAvg * prevCount + executionTime) / stats.totalCalls;
    }

    stats.lastCalled = new Date();
  }

  /**
   * Get tool statistics
   * @param {string} toolName - Tool name (optional)
   * @returns {Object} Tool statistics
   */
  getStats(toolName = null) {
    if (toolName) {
      return this.toolStats.get(toolName) || null;
    }

    // Return all stats
    const allStats = {};
    for (const [name, stats] of this.toolStats.entries()) {
      allStats[name] = stats;
    }
    return allStats;
  }

  /**
   * Get tool usage summary
   * @returns {Object} Usage summary
   */
  getUsageSummary() {
    let totalCalls = 0;
    let totalCost = 0;
    let successRate = 0;

    for (const stats of this.toolStats.values()) {
      totalCalls += stats.totalCalls;
      totalCost += stats.totalCost;
    }

    const allStats = Array.from(this.toolStats.values());
    const totalSuccessful = allStats.reduce((sum, s) => sum + s.successfulCalls, 0);
    successRate = totalCalls > 0 ? (totalSuccessful / totalCalls) * 100 : 0;

    // Most used tools
    const mostUsed = Array.from(this.toolStats.entries())
      .sort((a, b) => b[1].totalCalls - a[1].totalCalls)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, calls: stats.totalCalls }));

    return {
      totalCalls,
      totalCost,
      successRate: successRate.toFixed(2),
      totalTools: this.tools.size,
      enabledTools: Array.from(this.tools.values()).filter(t => t.enabled).length,
      mostUsed
    };
  }

  /**
   * Search tools by description or name
   * @param {string} query - Search query
   * @returns {Array} Matching tools
   */
  searchTools(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const [name, tool] of this.tools.entries()) {
      const nameMatch = name.toLowerCase().includes(lowerQuery);
      const descMatch = tool.description.toLowerCase().includes(lowerQuery);
      const categoryMatch = tool.category.toLowerCase().includes(lowerQuery);

      if (nameMatch || descMatch || categoryMatch) {
        results.push({
          name,
          ...tool,
          matchScore: nameMatch ? 3 : (categoryMatch ? 2 : 1)
        });
      }
    }

    // Sort by match score
    results.sort((a, b) => b.matchScore - a.matchScore);
    
    return results;
  }

  /**
   * Get tool examples
   * @param {string} toolName - Tool name
   * @returns {Array} Tool examples
   */
  getExamples(toolName) {
    const tool = this.tools.get(toolName);
    return tool ? tool.examples || [] : [];
  }

  /**
   * Reset statistics
   * @param {string} toolName - Tool name (optional)
   */
  resetStats(toolName = null) {
    if (toolName) {
      this.toolStats.set(toolName, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalCost: 0,
        averageExecutionTime: 0,
        lastCalled: null
      });
      logger.info(`Stats reset for tool: ${toolName}`);
    } else {
      // Reset all
      for (const name of this.toolStats.keys()) {
        this.resetStats(name);
      }
      logger.info('All tool stats reset');
    }
  }
}

module.exports = new ToolRegistry();
