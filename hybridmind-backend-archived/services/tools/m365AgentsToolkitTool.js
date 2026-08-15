/**
 * M365 Agents Toolkit Tool Adapter
 * Provides a local baseline implementation for m365 tool calls.
 */

const logger = require('../../utils/logger');

class M365AgentsToolkitTool {
  async execute(toolName, parameters = {}) {
    try {
      switch (toolName) {
        case 'm365GetKnowledge':
          return {
            success: true,
            source: 'local-m365-adapter',
            tool: toolName,
            data: {
              question: parameters.question || '',
              guidance: 'Use Microsoft 365 Agents Toolkit docs and follow manifest schema validation before code generation.'
            }
          };

        case 'm365GetSchema':
          return {
            success: true,
            source: 'local-m365-adapter',
            tool: toolName,
            data: {
              schema_name: parameters.schema_name || 'app_manifest',
              schema_version: parameters.schema_version || 'latest',
              note: 'Schema retrieval delegated to MCP tooling in production environments.'
            }
          };

        case 'm365GetCodeSnippets':
          return {
            success: true,
            source: 'local-m365-adapter',
            tool: toolName,
            data: {
              question: parameters.question || '',
              snippets: [],
              note: 'No local snippet catalog configured; connect MCP snippet provider for full results.'
            }
          };

        case 'm365Troubleshoot':
          return {
            success: true,
            source: 'local-m365-adapter',
            tool: toolName,
            data: {
              issue: parameters.question || '',
              recommendations: [
                'Validate manifest schema version and required fields.',
                'Verify auth and environment configuration for toolkit commands.',
                'Check extension/backend logs for tool execution failures.'
              ]
            }
          };

        case 'm365NormalizeTerminology':
          return {
            success: true,
            source: 'local-m365-adapter',
            tool: toolName,
            data: {
              normalized: String(parameters.text || '')
                .replace(/teams toolkit/gi, 'Microsoft 365 Agents Toolkit')
                .replace(/teams app manifest/gi, 'App Manifest')
            }
          };

        default:
          return {
            success: false,
            error: `Unsupported M365 tool: ${toolName}`
          };
      }
    } catch (error) {
      logger.error(`M365 tool adapter error (${toolName}): ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new M365AgentsToolkitTool();
