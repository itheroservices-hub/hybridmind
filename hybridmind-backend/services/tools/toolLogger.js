/**
 * Tool Logger - Logs all tool usage for audit and analytics
 */

const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class ToolLogger {
  constructor() {
    this.logFile = path.join(__dirname, '../../logs/tool-usage.log');
    this.logBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 5000; // Flush every 5 seconds
    this.enabled = true;

    // Start periodic flush
    this._startFlushTimer();
  }

  /**
   * Log tool execution
   * @param {Object} execution
   */
  async logExecution(execution) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      agentId: execution.agentId || 'system',
      toolName: execution.toolName,
      parameters: this._sanitizeParameters(execution.parameters),
      success: execution.success,
      executionTime: execution.executionTime,
      error: execution.error || null,
      cost: execution.cost || 0,
      result: execution.success ? 'success' : 'failed'
    };

    this.logBuffer.push(logEntry);

    // Also log to console
    if (execution.success) {
      logger.info(`Tool executed: ${execution.toolName} by ${logEntry.agentId} (${execution.executionTime}ms)`);
    } else {
      logger.error(`Tool failed: ${execution.toolName} by ${logEntry.agentId} - ${execution.error}`);
    }

    // Flush if buffer full
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Sanitize parameters (remove sensitive data)
   * @private
   */
  _sanitizeParameters(parameters) {
    if (!parameters) return {};

    const sanitized = { ...parameters };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'credentials'];

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Flush log buffer to file
   */
  async flush() {
    if (this.logBuffer.length === 0) return;

    try {
      const entries = this.logBuffer.splice(0, this.logBuffer.length);
      const logLines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

      // Ensure log directory exists
      const logDir = path.dirname(this.logFile);
      try {
        await fs.access(logDir);
      } catch {
        await fs.mkdir(logDir, { recursive: true });
      }

      // Append to log file
      await fs.appendFile(this.logFile, logLines);

    } catch (error) {
      logger.error(`Failed to flush tool logs: ${error.message}`);
      // Put entries back in buffer
      this.logBuffer.unshift(...entries);
    }
  }

  /**
   * Start periodic flush timer
   * @private
   */
  _startFlushTimer() {
    setInterval(() => {
      this.flush().catch(err => {
        logger.error(`Tool log flush error: ${err.message}`);
      });
    }, this.flushInterval);
  }

  /**
   * Read recent logs
   * @param {number} limit - Number of entries to read
   * @returns {Promise<Array>} Log entries
   */
  async readLogs(limit = 100) {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const lines = content.trim().split('\n');
      const entries = lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(e => e !== null);

      return entries;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // File doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Get logs by filters
   * @param {Object} filters
   * @returns {Promise<Array>} Filtered log entries
   */
  async getLogs(filters = {}) {
    const logs = await this.readLogs(1000); // Read last 1000

    let filtered = logs;

    if (filters.agentId) {
      filtered = filtered.filter(e => e.agentId === filters.agentId);
    }

    if (filters.toolName) {
      filtered = filtered.filter(e => e.toolName === filters.toolName);
    }

    if (filters.success !== undefined) {
      filtered = filtered.filter(e => e.success === filters.success);
    }

    if (filters.since) {
      const since = new Date(filters.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= since);
    }

    return filtered;
  }

  /**
   * Get usage statistics
   * @param {Object} filters
   * @returns {Promise<Object>} Usage statistics
   */
  async getStatistics(filters = {}) {
    const logs = await this.getLogs(filters);

    const totalExecutions = logs.length;
    const successful = logs.filter(e => e.success).length;
    const failed = totalExecutions - successful;
    const successRate = totalExecutions > 0 ? ((successful / totalExecutions) * 100).toFixed(2) : 0;

    const totalExecutionTime = logs.reduce((sum, e) => sum + (e.executionTime || 0), 0);
    const avgExecutionTime = totalExecutions > 0 ? (totalExecutionTime / totalExecutions).toFixed(2) : 0;

    const totalCost = logs.reduce((sum, e) => sum + (e.cost || 0), 0);

    // Most used tools
    const toolCounts = {};
    logs.forEach(e => {
      toolCounts[e.toolName] = (toolCounts[e.toolName] || 0) + 1;
    });

    const mostUsed = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));

    // Most active agents
    const agentCounts = {};
    logs.forEach(e => {
      agentCounts[e.agentId] = (agentCounts[e.agentId] || 0) + 1;
    });

    const mostActive = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent, count]) => ({ agent, count }));

    return {
      totalExecutions,
      successful,
      failed,
      successRate: parseFloat(successRate),
      avgExecutionTime: parseFloat(avgExecutionTime),
      totalCost: parseFloat(totalCost.toFixed(4)),
      mostUsed,
      mostActive
    };
  }

  /**
   * Clear old logs
   * @param {number} daysToKeep - Days to keep
   */
  async clearOldLogs(daysToKeep = 30) {
    try {
      const logs = await this.readLogs(10000); // Read many
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const recentLogs = logs.filter(e => new Date(e.timestamp) >= cutoffDate);

      // Rewrite log file with only recent logs
      const logLines = recentLogs.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.writeFile(this.logFile, logLines);

      logger.info(`Cleared logs older than ${daysToKeep} days`);

      return {
        removed: logs.length - recentLogs.length,
        kept: recentLogs.length
      };
    } catch (error) {
      logger.error(`Failed to clear old logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enable/disable logging
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`Tool logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = new ToolLogger();
