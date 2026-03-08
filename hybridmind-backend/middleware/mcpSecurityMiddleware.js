const path = require('path');
const mcpApprovalStore = require('../services/mcp/mcpApprovalStore');
const { validateCommand, requiresApprovalByPolicy } = require('../config/terminalAllowlist');

function validateMcpRequest(req, res, next) {
  const allowedCapabilities = new Set(['filesystem', 'terminal', 'web-search', 'graphiti-memory', 'm365agentstoolkit']);
  const capability = req.params.capability;

  if (!allowedCapabilities.has(capability)) {
    return res.status(404).json({
      success: false,
      error: `Unknown MCP capability '${capability}'`
    });
  }

  req.mcp = {
    capability,
    tier: req.tier || req.user?.tier || 'free',
    agentId: req.headers['x-agent-id'] || 'mcp-client',
    projectId: req.headers['x-project-id'] || req.body?.projectId || 'default-project',
    workspaceRoot: resolveWorkspaceRoot(req.body?.workspacePath),
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  };

  next();
}

function enforceTerminalApproval(req, res, next) {
  const command = String(req.body?.args?.command || '');
  const dryRun = Boolean(req.body?.args?.dryRun);
  const approvalHeader = String(req.headers['x-mcp-approval'] || '').toLowerCase();
  const approvalTicketId = String(req.headers['x-mcp-approval-ticket'] || '').trim();
  const tier = req.mcp?.tier || 'free';

  const validation = validateCommand(command);
  const isDangerous = !validation.valid || requiresApprovalByPolicy(command);

  if (tier === 'free' && !dryRun) {
    return res.status(403).json({
      success: false,
      error: 'Free tier allows terminal execution only in dryRun mode',
      requiresApproval: true,
      hint: 'Set args.dryRun=true or upgrade tier'
    });
  }

  if (isDangerous && approvalHeader !== 'approved') {
    const ticket = mcpApprovalStore.createTicket({
      command,
      capability: 'terminal',
      requestId: req.mcp.requestId,
      tier,
      projectId: req.mcp.projectId,
      workspaceRoot: req.mcp.workspaceRoot,
      reason: 'Dangerous terminal pattern detected',
      createdBy: req.mcp.agentId
    });

    return res.status(403).json({
      success: false,
      error: 'Terminal command flagged as high risk',
      requiresApproval: true,
      approvalTicketId: ticket.id,
      statusEndpoint: `/mcp/approvals/${ticket.id}`,
      approveEndpoint: `/mcp/approvals/${ticket.id}/approve`,
      denyEndpoint: `/mcp/approvals/${ticket.id}/deny`,
      hint: 'Approve ticket then resubmit with x-mcp-approval: approved and x-mcp-approval-ticket header'
    });
  }

  if (isDangerous && approvalHeader === 'approved') {
    if (!approvalTicketId) {
      return res.status(400).json({
        success: false,
        error: 'Missing x-mcp-approval-ticket header for approved dangerous command'
      });
    }

    const ticket = mcpApprovalStore.getTicket(approvalTicketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: `Approval ticket '${approvalTicketId}' not found`
      });
    }

    if (ticket.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: `Approval ticket is '${ticket.status}', not approved`
      });
    }

    if (String(ticket.command || '').trim() !== command.trim()) {
      return res.status(403).json({
        success: false,
        error: 'Approval ticket command mismatch'
      });
    }

    req.mcp.approvalTicketId = approvalTicketId;
  }

  next();
}

function resolveWorkspaceRoot(workspacePath) {
  if (!workspacePath) {
    return process.cwd();
  }

  const resolved = path.resolve(String(workspacePath));
  return resolved;
}

module.exports = {
  validateMcpRequest,
  enforceTerminalApproval,
  resolveWorkspaceRoot
};
