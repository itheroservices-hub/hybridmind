const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class MCPApprovalStore {
  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'hybridmind-backend', 'data', 'mcp');
    this.ticketsFile = path.join(this.baseDir, 'approval-tickets.json');
    this.auditFile = path.join(this.baseDir, 'approval-audit.log');
    this.tickets = new Map();
    this._ensureStorage();
    this._loadTickets();
  }

  createTicket(payload) {
    const id = `mcp_appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const ticket = {
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      command: payload.command,
      capability: payload.capability || 'terminal',
      requestId: payload.requestId,
      tier: payload.tier || 'free',
      projectId: payload.projectId || 'default-project',
      workspaceRoot: payload.workspaceRoot,
      reason: payload.reason || 'High-risk MCP terminal operation',
      createdBy: payload.createdBy || 'system',
      approvedBy: null,
      deniedBy: null,
      auditTrail: []
    };

    ticket.auditTrail.push(this._event('ticket_created', {
      requestId: ticket.requestId,
      reason: ticket.reason
    }));

    this.tickets.set(id, ticket);
    this._persist();
    this._appendAudit('ticket_created', ticket, { createdBy: ticket.createdBy });
    return ticket;
  }

  getTicket(ticketId) {
    return this.tickets.get(ticketId) || null;
  }

  listTickets({ status, limit = 50 } = {}) {
    let list = Array.from(this.tickets.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (status) {
      list = list.filter(ticket => ticket.status === status);
    }

    return list.slice(0, limit);
  }

  approveTicket(ticketId, actor = 'user') {
    const ticket = this.getTicket(ticketId);
    if (!ticket) return null;

    ticket.status = 'approved';
    ticket.approvedBy = actor;
    ticket.updatedAt = new Date().toISOString();
    ticket.auditTrail.push(this._event('ticket_approved', { actor }));
    this._persist();
    this._appendAudit('ticket_approved', ticket, { actor });
    return ticket;
  }

  denyTicket(ticketId, actor = 'user', reason = 'Denied by user') {
    const ticket = this.getTicket(ticketId);
    if (!ticket) return null;

    ticket.status = 'denied';
    ticket.deniedBy = actor;
    ticket.deniedReason = reason;
    ticket.updatedAt = new Date().toISOString();
    ticket.auditTrail.push(this._event('ticket_denied', { actor, reason }));
    this._persist();
    this._appendAudit('ticket_denied', ticket, { actor, reason });
    return ticket;
  }

  linkExecution(ticketId, executionInfo = {}) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) return null;

    ticket.execution = {
      ...(ticket.execution || {}),
      ...executionInfo,
      linkedAt: new Date().toISOString()
    };
    ticket.updatedAt = new Date().toISOString();
    ticket.auditTrail.push(this._event('execution_linked', executionInfo));
    this._persist();
    this._appendAudit('execution_linked', ticket, executionInfo);
    return ticket;
  }

  cleanupPendingByProject(projectId, reason = 'Cancelled by kill switch', actor = 'kill-switch') {
    if (!projectId) return { updated: 0, ticketIds: [] };

    let updated = 0;
    const ticketIds = [];

    for (const ticket of this.tickets.values()) {
      if (ticket.projectId !== projectId) continue;
      if (ticket.status !== 'pending') continue;

      ticket.status = 'denied';
      ticket.deniedBy = actor;
      ticket.deniedReason = reason;
      ticket.updatedAt = new Date().toISOString();
      ticket.auditTrail.push(this._event('ticket_cleanup', { actor, reason }));
      updated += 1;
      ticketIds.push(ticket.id);
      this._appendAudit('ticket_cleanup', ticket, { actor, reason });
    }

    if (updated > 0) {
      this._persist();
    }

    return { updated, ticketIds };
  }

  _event(type, payload = {}) {
    return {
      type,
      timestamp: new Date().toISOString(),
      payload
    };
  }

  _ensureStorage() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    if (!fs.existsSync(this.ticketsFile)) {
      fs.writeFileSync(this.ticketsFile, JSON.stringify([], null, 2), 'utf8');
    }

    if (!fs.existsSync(this.auditFile)) {
      fs.writeFileSync(this.auditFile, '', 'utf8');
    }
  }

  _loadTickets() {
    try {
      const raw = fs.readFileSync(this.ticketsFile, 'utf8');
      const list = JSON.parse(raw);
      for (const ticket of list) {
        this.tickets.set(ticket.id, ticket);
      }
    } catch (error) {
      logger.warn(`Failed to load MCP approval tickets: ${error.message}`);
    }
  }

  _persist() {
    const list = Array.from(this.tickets.values());
    fs.writeFileSync(this.ticketsFile, JSON.stringify(list, null, 2), 'utf8');
  }

  _appendAudit(eventType, ticket, details = {}) {
    const row = {
      eventType,
      ticketId: ticket.id,
      requestId: ticket.requestId,
      timestamp: new Date().toISOString(),
      details
    };
    fs.appendFileSync(this.auditFile, `${JSON.stringify(row)}\n`, 'utf8');
  }
}

module.exports = new MCPApprovalStore();
