/**
 * Tool Executor - Executes tools with validation, permissions, and logging
 */

const logger = require('../../utils/logger');
const toolRegistry = require('./toolRegistry');
const permissionManager = require('./permissionManager');
const toolLogger = require('./toolLogger');
const m365Policy = require('./m365Policy');
const m365AgentsToolkitTool = require('./m365AgentsToolkitTool');
const draftCommandRouter = require('./draftCommandRouter');

// Import tool implementations
const databaseTool = require('./databaseTool');
const webSearchTool = require('./webSearchTool');
const crmTool = require('./crmTool');
const codeGeneratorTool = require('./codeGeneratorTool');

class ToolExecutor {
  constructor() {
    // Register tool handlers
    this._registerHandlers();

    this.m365PreflightByAgent = new Map();
    
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
    toolRegistry.registerHandler('m365GetKnowledge', (parameters) =>
      m365AgentsToolkitTool.execute('m365GetKnowledge', parameters)
    );
    toolRegistry.registerHandler('m365GetSchema', (parameters) =>
      m365AgentsToolkitTool.execute('m365GetSchema', parameters)
    );
    toolRegistry.registerHandler('m365GetCodeSnippets', (parameters) =>
      m365AgentsToolkitTool.execute('m365GetCodeSnippets', parameters)
    );
    toolRegistry.registerHandler('m365Troubleshoot', (parameters) =>
      m365AgentsToolkitTool.execute('m365Troubleshoot', parameters)
    );
    toolRegistry.registerHandler('m365NormalizeTerminology', (parameters) =>
      m365AgentsToolkitTool.execute('m365NormalizeTerminology', parameters)
    );
    toolRegistry.registerHandler('draftInit', (parameters) =>
      draftCommandRouter.execute('draftInit', parameters)
    );
    toolRegistry.registerHandler('draftNewTrack', (parameters) =>
      draftCommandRouter.execute('draftNewTrack', parameters)
    );
    toolRegistry.registerHandler('draftStatus', (parameters) =>
      draftCommandRouter.execute('draftStatus', parameters)
    );

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
    let policyContext = null;

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

      policyContext = this._evaluateM365Policy({ toolName, parameters, agentId });
      if (policyContext.applies && !policyContext.allowed) {
        result = {
          success: false,
          error: `M365 preflight required before '${toolName}'`,
          m365Policy: policyContext,
          executionTime: Date.now() - startTime
        };
        await this._logExecution({ toolName, parameters, agentId, ...result, policyTags: ['m365', 'policy-blocked'], policyContext });
        return result;
      }

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
        cost: toolSchema.costPerCall || 0,
        policyTags: this._buildPolicyTags(policyContext, toolName),
        policyContext
      });

      if (result.success) {
        this._registerM365Preflight(agentId, toolName);
      }

      return {
        ...result,
        toolName,
        agentId,
        cost: toolSchema.costPerCall || 0,
        policyTags: this._buildPolicyTags(policyContext, toolName),
        m365Policy: policyContext
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
        ...result,
        policyTags: this._buildPolicyTags(policyContext, toolName),
        policyContext
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
    
    const normalizedPrompt = m365Policy.normalizeTerminology(prompt || '');
    const toolCalls = [];

    const preflightCalls = m365Policy.buildPreflightToolCalls(normalizedPrompt);
    toolCalls.push(...preflightCalls);

    // Simple pattern matching (replace with LLM in production)
    const patterns = {
      databaseQuery: /(?:query|search|find in|select from)\s+database/i,
      webSearch: /(?:search|google|find|look up)(?:\s+(?:the\s+)?web)?/i,
      crmWrite: /(?:create|update|add to|write to)\s+(?:crm|salesforce|hubspot)/i,
      codeGenerate: /(?:generate|create|write)\s+(?:code|function|class|component)/i,
      draftInit: /\bdraft\s+init\b|\binitialize\s+draft\b/i,
      draftNewTrack: /\bdraft\s+new-track\b|\bdraft\s+new track\b|\bcreate\s+new\s+track\b/i,
      draftStatus: /\bdraft\s+status\b|\bshow\s+draft\s+status\b|\btrack\s+status\b/i
    };

    for (const [toolName, pattern] of Object.entries(patterns)) {
      if (pattern.test(normalizedPrompt)) {
        // Extract parameters from prompt (simplified)
        toolCalls.push({
          toolName,
          parameters: this._extractParameters(toolName, normalizedPrompt),
          confidence: 0.8
        });
      }
    }

    return {
      prompt,
      normalizedPrompt,
      toolCalls,
      parsed: toolCalls.length > 0,
      m365PolicyApplied: preflightCalls.length > 0
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
    } else if (toolName === 'draftInit') {
      return {
        workspacePath: process.cwd(),
        force: false
      };
    } else if (toolName === 'draftNewTrack') {
      const titleMatch = prompt.match(/(?:new[-\s]track|track)\s+(?:for\s+)?(.+)$/i);
      return {
        workspacePath: process.cwd(),
        title: (titleMatch?.[1] || 'New Track').trim(),
        description: prompt,
        type: 'feature'
      };
    } else if (toolName === 'draftStatus') {
      return {
        workspacePath: process.cwd()
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

  _evaluateM365Policy({ toolName, parameters, agentId }) {
    const inputText = this._collectPolicyInput(parameters);
    const context = m365Policy.inferContext(inputText);

    if (String(toolName || '').toLowerCase().startsWith('m365')) {
      return {
        applies: context.m365Intent,
        allowed: true,
        required: [],
        missing: [],
        context,
        normalizedInput: m365Policy.normalizeTerminology(inputText)
      };
    }

    if (!context.m365Intent) {
      return {
        applies: false,
        allowed: true,
        context
      };
    }

    const requiresCodePreflight = toolName === 'codeGenerate' || context.codeGeneration || context.manifest;
    const requiresManifestPreflight = context.manifest || this._looksLikeManifestOperation(parameters);
    const requiresTroubleshootPreflight = context.troubleshooting;

    const required = [];
    if (requiresCodePreflight) {
      required.push('knowledge', 'snippets');
    }
    if (requiresManifestPreflight) {
      required.push('schema');
    }
    if (requiresTroubleshootPreflight) {
      required.push('troubleshoot');
    }

    const currentState = this._getM365PreflightState(agentId);
    const missing = required.filter(check => !currentState[check]);

    return {
      applies: true,
      allowed: missing.length === 0,
      required,
      missing,
      context,
      normalizedInput: m365Policy.normalizeTerminology(inputText)
    };
  }

  _collectPolicyInput(parameters = {}) {
    if (!parameters || typeof parameters !== 'object') {
      return '';
    }

    const candidates = [
      parameters.question,
      parameters.description,
      parameters.query,
      parameters.path,
      parameters.content,
      parameters.context
    ]
      .filter(Boolean)
      .map(value => (typeof value === 'string' ? value : JSON.stringify(value)));

    return candidates.join(' ');
  }

  _looksLikeManifestOperation(parameters = {}) {
    const source = `${parameters.path || ''} ${parameters.description || ''} ${parameters.question || ''}`.toLowerCase();
    return /app manifest|declarative agent manifest|api plugin manifest|m365agents\.yml|teamsapp\.yml|manifest/.test(source);
  }

  _getM365PreflightState(agentId) {
    if (!this.m365PreflightByAgent.has(agentId)) {
      this.m365PreflightByAgent.set(agentId, {
        knowledge: null,
        schema: null,
        snippets: null,
        troubleshoot: null
      });
    }

    return this.m365PreflightByAgent.get(agentId);
  }

  _registerM365Preflight(agentId, toolName) {
    const state = this._getM365PreflightState(agentId);
    const now = new Date().toISOString();

    if (toolName === 'm365GetKnowledge') state.knowledge = now;
    if (toolName === 'm365GetSchema') state.schema = now;
    if (toolName === 'm365GetCodeSnippets') state.snippets = now;
    if (toolName === 'm365Troubleshoot') state.troubleshoot = now;
  }

  _buildPolicyTags(policyContext, toolName) {
    const tags = [];

    if (String(toolName).toLowerCase().startsWith('m365')) {
      tags.push('m365', 'policy-tool');
    }

    if (policyContext?.applies) {
      tags.push('m365-policy-applied');
      if (!policyContext.allowed) {
        tags.push('m365-policy-blocked');
      }
    }

    return tags;
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
