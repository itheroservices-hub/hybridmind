const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const mcpClient = require('../services/orchestration/mcpClient');
const webSearchTool = require('../services/tools/webSearchTool');
const graphitiMemoryClient = require('../services/memory/graphitiMemoryClient');
const mcpApprovalStore = require('../services/mcp/mcpApprovalStore');
const {
  validateMcpRequest,
  enforceTerminalApproval,
  resolveWorkspaceRoot
} = require('../middleware/mcpSecurityMiddleware');
const { requireMcpAuth, requireMcpAdmin } = require('../middleware/mcpAuthMiddleware');
const { validateCommand } = require('../config/terminalAllowlist');

const router = express.Router();

registerMcpHandlers();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'HybridMind MCP',
    version: '1.8.0',
    capabilities: ['filesystem', 'terminal', 'web-search', 'graphiti-memory', 'm365agentstoolkit']
  });
});

router.get('/approvals', (req, res) => {
  const status = req.query?.status ? String(req.query.status) : undefined;
  const limit = req.query?.limit ? Number(req.query.limit) : 50;
  const tickets = mcpApprovalStore.listTickets({ status, limit });
  res.json({ success: true, tickets, total: tickets.length });
});

router.get('/approvals/:ticketId', (req, res) => {
  const ticket = mcpApprovalStore.getTicket(req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Approval ticket not found' });
  }
  res.json({ success: true, ticket });
});

router.post('/approvals/:ticketId/approve', requireMcpAdmin, (req, res) => {
  const actor = req.body?.actor || req.headers['x-approval-actor'] || 'user';
  const ticket = mcpApprovalStore.approveTicket(req.params.ticketId, String(actor));
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Approval ticket not found' });
  }
  res.json({ success: true, ticket });
});

router.post('/approvals/:ticketId/deny', requireMcpAdmin, (req, res) => {
  const actor = req.body?.actor || req.headers['x-approval-actor'] || 'user';
  const reason = req.body?.reason || 'Denied by user';
  const ticket = mcpApprovalStore.denyTicket(req.params.ticketId, String(actor), String(reason));
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Approval ticket not found' });
  }
  res.json({ success: true, ticket });
});

router.post('/:capability', requireMcpAuth, validateMcpRequest, async (req, res) => {
  try {
    const tool = req.body?.tool || defaultToolForCapability(req.params.capability);
    const args = req.body?.args || {};

    if (req.params.capability === 'terminal') {
      return enforceTerminalApproval(req, res, async () => {
        const outcome = await invokeCapability(req, tool, args);
        res.json(outcome);
      });
    }

    const outcome = await invokeCapability(req, tool, args);
    res.json(outcome);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function defaultToolForCapability(capability) {
  const defaults = {
    filesystem: 'searchSymbols',
    terminal: 'runCommand',
    'web-search': 'search',
    'graphiti-memory': 'getConventions',
    m365agentstoolkit: 'get_knowledge'
  };

  return defaults[capability] || 'noop';
}

async function invokeCapability(req, tool, args) {
  const capability = req.params.capability;
  const serverName = capability;

  const outcome = await mcpClient.invoke(serverName, tool, args, {
    requestId: req.mcp.requestId,
    tier: req.mcp.tier,
    projectId: req.mcp.projectId,
    workspaceRoot: req.mcp.workspaceRoot
  });

  if (req.mcp.approvalTicketId) {
    mcpApprovalStore.linkExecution(req.mcp.approvalTicketId, {
      requestId: req.mcp.requestId,
      tool,
      success: outcome.success,
      latencyMs: outcome.latencyMs
    });
  }

  return {
    success: outcome.success,
    capability,
    tool,
    requestId: req.mcp.requestId,
    tier: req.mcp.tier,
    latencyMs: outcome.latencyMs,
    approvalTicketId: req.mcp.approvalTicketId || null,
    result: outcome.result,
    error: outcome.error || null
  };
}

function registerMcpHandlers() {
  mcpClient.registerServerHandler('filesystem', {
    invoke: async (tool, args, context) => handleFilesystemTool(tool, args, context)
  });

  mcpClient.registerServerHandler('terminal', {
    invoke: async (tool, args, context) => handleTerminalTool(tool, args, context)
  });

  mcpClient.registerServerHandler('web-search', {
    invoke: async (tool, args) => handleWebSearchTool(tool, args)
  });

  mcpClient.registerServerHandler('graphiti-memory', {
    invoke: async (tool, args, context) => handleGraphitiMemoryTool(tool, args, context)
  });

  mcpClient.registerServerHandler('m365agentstoolkit', {
    invoke: async (tool, args) => handleM365AgentsToolkitTool(tool, args)
  });
}

async function handleFilesystemTool(tool, args, context) {
  const workspaceRoot = resolveWorkspaceRoot(args.workspacePath || context.workspaceRoot);

  if (tool === 'readFile') {
    const targetFile = safeResolvePath(workspaceRoot, args.targetFile || '');
    const content = fs.readFileSync(targetFile, 'utf8');
    return {
      file: targetFile,
      content,
      bytes: Buffer.byteLength(content, 'utf8')
    };
  }

  if (tool === 'searchSymbols') {
    const query = String(args.query || '').toLowerCase();
    const matches = searchWorkspace(workspaceRoot, query, 120);
    return {
      query,
      totalMatches: matches.length,
      matches
    };
  }

  if (tool === 'previewPatch') {
    return {
      summary: String(args.task || '').slice(0, 200),
      previousOutputPreview: String(args.previousOutput || '').slice(0, 400)
    };
  }

  return {
    message: `Unknown filesystem tool '${tool}'`,
    args
  };
}

async function handleTerminalTool(tool, args, context) {
  if (tool !== 'runCommand') {
    return {
      message: `Unknown terminal tool '${tool}'`,
      args
    };
  }

  const command = String(args.command || '');
  const cwd = resolveWorkspaceRoot(args.workspacePath || context.workspaceRoot);
  const timeout = Number(args.timeoutMs || 120000);
  const dryRun = Boolean(args.dryRun);

  if (dryRun) {
    return {
      exitCode: 0,
      stdout: `[dryRun] ${command}`,
      stderr: ''
    };
  }

  return await executeCommand(command, cwd, timeout);
}

async function handleWebSearchTool(tool, args) {
  if (tool !== 'search') {
    return {
      message: `Unknown web-search tool '${tool}'`,
      args
    };
  }

  return await webSearchTool.execute({
    query: args.query || '',
    provider: args.provider || 'auto',
    maxResults: args.maxResults || 5,
    safesearch: args.safesearch || 'moderate'
  });
}

async function handleGraphitiMemoryTool(tool, args, context) {
  const projectId = args.projectId || context.projectId || 'default-project';

  if (tool === 'upsertConvention') {
    return graphitiMemoryClient.upsertConvention(
      projectId,
      args.key,
      args.value,
      args.source || 'mcp-graphiti',
      args.tags || []
    );
  }

  if (tool === 'getConventions') {
    return {
      projectId,
      conventions: graphitiMemoryClient.getConventions(projectId, args.tags || [])
    };
  }

  if (tool === 'recordDecision') {
    return graphitiMemoryClient.recordDecision(projectId, args.decisionNode || {});
  }

  if (tool === 'getDecisions') {
    return {
      projectId,
      decisions: graphitiMemoryClient.getDecisions(projectId, args.limit || 20)
    };
  }

  return {
    message: `Unknown graphiti-memory tool '${tool}'`,
    args
  };
}

async function handleM365AgentsToolkitTool(tool, args) {
  // get_knowledge - Query M365 development documentation
  if (tool === 'get_knowledge') {
    const question = String(args.question || '');
    if (!question) {
      return {
        success: false,
        error: 'Question parameter is required for get_knowledge',
        usage: 'Provide a "question" parameter to query M365 development knowledge'
      };
    }
    
    return {
      success: true,
      tool: 'get_knowledge',
      question,
      answer: 'Bridged to M365 Agents Toolkit MCP server',
      note: 'This response is from HybridMind bridge. The actual MCP server at @microsoft/m365agentstoolkit-mcp provides comprehensive M365 documentation.',
      exampleTopics: [
        'How to create a declarative agent for Microsoft 365 Copilot',
        'Teams bot development with @microsoft/teams-ai',
        'Office add-in manifest creation',
        'API plugin configuration',
        'M365 authentication flows'
      ]
    };
  }

  // get_schema - Retrieve manifest and configuration schemas
  if (tool === 'get_schema') {
    const schemaName = args.schema_name;
    const schemaVersion = args.schema_version || 'latest';
    
    const validSchemas = [
      'app_manifest',
      'declarative_agent_manifest', 
      'api_plugin_manifest',
      'm365_agents_yaml'
    ];
    
    if (!schemaName || !validSchemas.includes(schemaName)) {
      return {
        success: false,
        error: `Invalid schema_name. Must be one of: ${validSchemas.join(', ')}`,
        usage: 'Provide schema_name (e.g., "app_manifest") and optional schema_version (default: "latest")',
        availableSchemas: validSchemas
      };
    }
    
    return {
      success: true,
      tool: 'get_schema',
      schemaName,
      schemaVersion,
      note: 'Schema retrieval bridged to M365 Agents Toolkit MCP server',
      description: getSchemaDescription(schemaName)
    };
  }

  // get_code_snippets - Generate code patterns for M365 SDKs
  if (tool === 'get_code_snippets') {
    const question = String(args.question || '');
    if (!question) {
      return {
        success: false,
        error: 'Question parameter is required for get_code_snippets',
        usage: 'Provide a "question" parameter describing the code you need'
      };
    }
    
    return {
      success: true,
      tool: 'get_code_snippets',
      question,
      note: 'Code snippet generation bridged to M365 Agents Toolkit MCP server',
      exampleQuestions: [
        'Generate code for a Teams bot that responds to mentions',
        'Create an Office add-in task pane with React',
        'Implement SSO authentication in Teams app',
        'Create a message extension for Teams',
        'Build a declarative agent with actions'
      ]
    };
  }

  // troubleshoot - Debug M365 development issues
  if (tool === 'troubleshoot') {
    const question = String(args.question || '');
    if (!question) {
      return {
        success: false,
        error: 'Question parameter is required for troubleshoot',
        usage: 'Provide a "question" parameter describing the issue or error'
      };
    }
    
    return {
      success: true,
      tool: 'troubleshoot',
      question,
      note: 'Troubleshooting bridged to M365 Agents Toolkit MCP server',
      exampleIssues: [
        'Manifest validation failing with icon URL error',
        'Teams bot not responding to messages',
        'Authentication not working in Office add-in',
        'App package deployment errors',
        'API plugin connection issues'
      ]
    };
  }

  return {
    success: false,
    error: `Unknown M365 Agents Toolkit tool: ${tool}`,
    availableTools: [
      {
        name: 'get_knowledge',
        description: 'Query M365 development documentation and best practices',
        parameters: { question: 'string (required)' }
      },
      {
        name: 'get_schema',
        description: 'Retrieve manifest and configuration schemas',
        parameters: { 
          schema_name: 'enum (required): app_manifest | declarative_agent_manifest | api_plugin_manifest | m365_agents_yaml',
          schema_version: 'string (optional, default: latest)'
        }
      },
      {
        name: 'get_code_snippets',
        description: 'Generate code patterns for M365 SDKs',
        parameters: { question: 'string (required)' }
      },
      {
        name: 'troubleshoot',
        description: 'Debug M365 development issues and errors',
        parameters: { question: 'string (required)' }
      }
    ]
  };
}

function getSchemaDescription(schemaName) {
  const descriptions = {
    app_manifest: 'Microsoft 365 App Manifest schema - defines app capabilities, permissions, and configuration for Teams apps, Office add-ins, and M365 apps',
    declarative_agent_manifest: 'Declarative Agent Manifest for Microsoft 365 Copilot - defines agent capabilities, actions, and conversation flows',
    api_plugin_manifest: 'API Plugin Manifest - defines API endpoints, authentication, and operations for M365 Copilot plugins',
    m365_agents_yaml: 'M365 Agents project configuration (m365agents.yml) - defines project structure, deployment settings, and build configuration'
  };
  
  return descriptions[schemaName] || 'Schema description not available';
}

function safeResolvePath(workspaceRoot, targetFile) {
  const resolved = path.resolve(workspaceRoot, targetFile || '.');
  const normalizedRoot = path.resolve(workspaceRoot);

  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error('Access denied: target path is outside workspace root');
  }

  return resolved;
}

function searchWorkspace(rootDir, query, maxResults = 100) {
  if (!query) return [];

  const stack = [rootDir];
  const results = [];
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'out']);

  while (stack.length && results.length < maxResults) {
    const dir = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const lowerName = entry.name.toLowerCase();
      if (lowerName.includes(query)) {
        results.push({
          path: fullPath,
          type: 'filename-match'
        });
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lowerContent = content.toLowerCase();
        const index = lowerContent.indexOf(query);

        if (index >= 0) {
          const preview = content.slice(Math.max(0, index - 80), index + 140).replace(/\n/g, ' ');
          results.push({
            path: fullPath,
            type: 'content-match',
            preview
          });
        }
      } catch {
      }
    }
  }

  return results;
}

function executeCommand(command, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const validation = validateCommand(command);
    if (!validation.valid) {
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: validation.reason || 'Command not allowed'
      });
      return;
    }
    const { cmd, args } = validation;
    execFile(cmd, args, { cwd, timeout: timeoutMs, shell: false, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          exitCode: typeof error.code === 'number' ? error.code : 1,
          stdout: String(stdout || ''),
          stderr: String(stderr || error.message || '')
        });
        return;
      }
      resolve({
        exitCode: 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || '')
      });
    });
  });
}

module.exports = router;
