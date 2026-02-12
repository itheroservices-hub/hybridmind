/**
 * Tool Executor - Executes tools with validation, permissions, and logging
 */

const logger = require('../../utils/logger');
const toolRegistry = require('./toolRegistry');
const permissionManager = require('./permissionManager');
const toolLogger = require('./toolLogger');

// Import tool implementations
const databaseTool = require('./databaseTool');
const webSearchTool = require('./webSearchTool');
const crmTool = require('./crmTool');
const codeGeneratorTool = require('./codeGeneratorTool');

class ToolExecutor {
  constructor() {
    // Register tool handlers
    this._registerHandlers();
    
    // Execution queue for rate limiting
    this.executionQueue = [];
    this.executing = false;
  }

  /**
   * Register all tool handlers
   * @private
   */
  _registerHandlers() {
    toolRegistry.registerHandler('databaseQuery', databaseTool.execute.bind(databaseTool));
    toolRegistry.registerHandler('webSearch', webSearchTool.execute.bind(webSearchTool));
    toolRegistry.registerHandler('crmWrite', crmTool.execute.bind(crmTool));
    toolRegistry.registerHandler('codeGenerate', codeGeneratorTool.execute.bind(codeGeneratorTool));

    // TODO: Register additional tools (fileOperation, httpRequest)
    
    logger.info('Tool handlers registered');
  }

  /**
   * Execute a tool
   * @param {Object} options
   * @param {string} options.toolName - Tool to execute
   * @param {Object} options.parameters - Tool parameters
   * @param {string} options.agentId - Agent identifier (optional)
   * @returns {Promise<Object>} Execution result
   */
  async executeTool({ toolName, parameters, agentId = 'system' }) {
    const startTime = Date.now();
    let result = null;

    try {
      // 1. Validate tool exists
      if (!toolRegistry.hasTool(toolName)) {
        result = {
          success: false,
          error: `Tool '${toolName}' not found`,
          executionTime: Date.now() - startTime
        };
        await this._logExecution({ toolName, parameters, agentId, ...result });
        return result;
      }

      const toolSchema = toolRegistry.getTool(toolName);

      // 2. Check permissions
      const permissionCheck = permissionManager.canUseTool(agentId, toolName, toolSchema);
      
      if (!permissionCheck.allowed) {
        permissionManager.logPermissionRequest({
          agentId,
          toolName,
          permission: toolSchema.permissions?.[0] || 'unknown',
          granted: false,
          reason: permissionCheck.reason
        });

        result = {
          success: false,
          error: `Permission denied: ${permissionCheck.reason}`,
          permissionCheck,
          executionTime: Date.now() - startTime
        };
        await this._logExecution({ toolName, parameters, agentId, ...result });
        return result;
      }

      // Log permission grant
      permissionManager.logPermissionRequest({
        agentId,
        toolName,
        permission: toolSchema.permissions?.[0] || 'unknown',
        granted: true
      });

      // 3. Validate parameters
      const validation = toolRegistry.validateParameters(toolName, parameters);
      
      if (!validation.valid) {
        result = {
          success: false,
          error: 'Parameter validation failed',
          validationErrors: validation.errors,
          executionTime: Date.now() - startTime
        };
        await this._logExecution({ toolName, parameters, agentId, ...result });
        return result;
      }

      // 4. Get handler
      const handler = toolRegistry.getHandler(toolName);
      
      if (!handler) {
        result = {
          success: false,
          error: `No handler registered for tool '${toolName}'`,
          executionTime: Date.now() - startTime
        };
        await this._logExecution({ toolName, parameters, agentId, ...result });
        return result;
      }

      logger.info(`Executing tool: ${toolName} for agent: ${agentId}`);

      // 5. Execute tool
      result = await handler(parameters);

      // 6. Update statistics
      const executionTime = Date.now() - startTime;
      toolRegistry.updateStats(toolName, {
        success: result.success,
        executionTime,
        cost: toolSchema.costPerCall || 0
      });

      // 7. Log execution
      await this._logExecution({
        toolName,
        parameters,
        agentId,
        success: result.success,
        executionTime,
        error: result.error,
        cost: toolSchema.costPerCall || 0
      });

      return {
        ...result,
        toolName,
        agentId,
        cost: toolSchema.costPerCall || 0
      };

    } catch (error) {
      logger.error(`Tool execution error: ${error.message}`);
      
      const executionTime = Date.now() - startTime;
      result = {
        success: false,
        error: error.message,
        stack: error.stack,
        executionTime
      };

      // Update stats
      const toolSchema = toolRegistry.getTool(toolName);
      if (toolSchema) {
        toolRegistry.updateStats(toolName, {
          success: false,
          executionTime,
          cost: 0
        });
      }

      // Log execution
      await this._logExecution({
        toolName,
        parameters,
        agentId,
        ...result
      });

      return result;
    }
  }

  /**
   * Execute multiple tools in sequence
   * @param {Array} toolCalls - Array of tool calls
   * @param {string} agentId - Agent identifier
   * @returns {Promise<Array>} Execution results
   */
  async executeToolChain(toolCalls, agentId = 'system') {
    const results = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeTool({
        toolName: toolCall.toolName,
        parameters: toolCall.parameters,
        agentId
      });

      results.push(result);

      // Stop on failure if configured
      if (!result.success && toolCall.stopOnFailure) {
        logger.warn(`Tool chain stopped at ${toolCall.toolName} due to failure`);
        break;
      }
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   * @param {Array} toolCalls - Array of tool calls
   * @param {string} agentId - Agent identifier
   * @returns {Promise<Array>} Execution results
   */
  async executeToolParallel(toolCalls, agentId = 'system') {
    const promises = toolCalls.map(toolCall =>
      this.executeTool({
        toolName: toolCall.toolName,
        parameters: toolCall.parameters,
        agentId
      })
    );

    return await Promise.all(promises);
  }

  /**
   * Parse declarative prompt for tool calls
   * @param {string} prompt - Natural language prompt
   * @param {string} agentId - Agent identifier
   * @returns {Promise<Object>} Parsed tool calls
   */
  async parseDeclarativePrompt(prompt, agentId = 'system') {
    // SIMPLIFIED IMPLEMENTATION
    // In production, use LLM to parse natural language into tool calls
    
    const toolCalls = [];

    // Simple pattern matching (replace with LLM in production)
    const patterns = {
      databaseQuery: /(?:query|search|find in|select from)\s+database/i,
      webSearch: /(?:search|google|find|look up)(?:\s+(?:the\s+)?web)?/i,
      crmWrite: /(?:create|update|add to|write to)\s+(?:crm|salesforce|hubspot)/i,
      codeGenerate: /(?:generate|create|write)\s+(?:code|function|class|component)/i
    };

    for (const [toolName, pattern] of Object.entries(patterns)) {
      if (pattern.test(prompt)) {
        // Extract parameters from prompt (simplified)
        toolCalls.push({
          toolName,
          parameters: this._extractParameters(toolName, prompt),
          confidence: 0.8
        });
      }
    }

    return {
      prompt,
      toolCalls,
      parsed: toolCalls.length > 0
    };
  }

  /**
   * Extract parameters from prompt (simplified)
   * @private
   */
  _extractParameters(toolName, prompt) {
    // MOCK IMPLEMENTATION
    // In production, use LLM to extract structured parameters
    
    if (toolName === 'databaseQuery') {
      return {
        database: 'default',
        query: 'SELECT * FROM users LIMIT 10',
        limit: 10
      };
    } else if (toolName === 'webSearch') {
      return {
        query: prompt.replace(/(?:search|find|look up)\s+/i, '').substring(0, 100),
        maxResults: 5
      };
    } else if (toolName === 'crmWrite') {
      return {
        system: 'webhook',
        action: 'custom',
        data: { note: prompt }
      };
    } else if (toolName === 'codeGenerate') {
      return {
        language: 'javascript',
        description: prompt.replace(/(?:generate|create|write)\s+/i, ''),
        template: 'custom'
      };
    }

    return {};
  }

  /**
   * Log tool execution
   * @private
   */
  async _logExecution(execution) {
    try {
      await toolLogger.logExecution(execution);
    } catch (error) {
      logger.error(`Failed to log tool execution: ${error.message}`);
    }
  }

  /**
   * Get execution statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return toolRegistry.getUsageSummary();
  }
}

module.exports = new ToolExecutor();
