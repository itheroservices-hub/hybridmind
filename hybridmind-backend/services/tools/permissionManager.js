/**
 * Permission Manager - Agent-based permission system for tool access control
 */

const logger = require('../../utils/logger');

class PermissionManager {
  constructor() {
    // Agent roles and their default permissions
    this.roles = {
      admin: {
        name: 'Administrator',
        permissions: ['*'], // All permissions
        riskLevel: 'all'
      },
      developer: {
        name: 'Developer',
        permissions: [
          'read_database', 'query_database',
          'web_search', 'external_api',
          'generate_code', 'ai_generation',
          'read_files', 'write_files',
          'http_request'
        ],
        riskLevel: 'high'
      },
      analyst: {
        name: 'Analyst',
        permissions: [
          'read_database', 'query_database',
          'web_search', 'external_api'
        ],
        riskLevel: 'medium'
      },
      marketing: {
        name: 'Marketing',
        permissions: [
          'write_crm', 'modify_contacts',
          'web_search', 'external_api'
        ],
        riskLevel: 'medium'
      },
      readonly: {
        name: 'Read Only',
        permissions: [
          'read_database',
          'web_search',
          'read_files'
        ],
        riskLevel: 'low'
      }
    };

    // Individual agent permissions (overrides)
    this.agentPermissions = new Map();

    // Permission requests log
    this.permissionLog = [];
    this.maxLogSize = 1000;
  }

  /**
   * Create agent with role
   * @param {string} agentId - Agent identifier
   * @param {string} role - Agent role
   * @param {Object} customPermissions - Custom permissions (optional)
   */
  createAgent(agentId, role, customPermissions = {}) {
    if (!this.roles[role]) {
      throw new Error(`Unknown role: ${role}`);
    }

    const rolePermissions = this.roles[role].permissions;
    const permissions = customPermissions.permissions || rolePermissions;
    const riskLevel = customPermissions.riskLevel || this.roles[role].riskLevel;

    this.agentPermissions.set(agentId, {
      role,
      permissions: new Set(permissions),
      riskLevel,
      createdAt: new Date(),
      enabled: true
    });

    logger.info(`Agent ${agentId} created with role ${role}`);

    return {
      agentId,
      role,
      permissions: Array.from(permissions),
      riskLevel
    };
  }

  /**
   * Check if agent has permission
   * @param {string} agentId - Agent identifier
   * @param {string} permission - Permission to check
   * @returns {boolean} Permission granted
   */
  hasPermission(agentId, permission) {
    const agent = this.agentPermissions.get(agentId);
    
    if (!agent) {
      logger.warn(`Permission check for unknown agent: ${agentId}`);
      return false;
    }

    if (!agent.enabled) {
      logger.warn(`Permission check for disabled agent: ${agentId}`);
      return false;
    }

    // Admin has all permissions
    if (agent.permissions.has('*')) {
      return true;
    }

    return agent.permissions.has(permission);
  }

  /**
   * Check if agent can use tool
   * @param {string} agentId - Agent identifier
   * @param {string} toolName - Tool name
   * @param {Object} toolSchema - Tool schema from registry
   * @returns {Object} Permission check result
   */
  canUseTool(agentId, toolName, toolSchema) {
    const agent = this.agentPermissions.get(agentId);

    if (!agent) {
      return {
        allowed: false,
        reason: 'Agent not found'
      };
    }

    if (!agent.enabled) {
      return {
        allowed: false,
        reason: 'Agent disabled'
      };
    }

    // Check required permissions
    const requiredPermissions = toolSchema.permissions || [];
    const missingPermissions = [];

    for (const permission of requiredPermissions) {
      if (!this.hasPermission(agentId, permission)) {
        missingPermissions.push(permission);
      }
    }

    if (missingPermissions.length > 0) {
      return {
        allowed: false,
        reason: 'Missing permissions',
        missingPermissions
      };
    }

    // Check risk level
    const toolRisk = toolSchema.riskLevel || 'low';
    const agentRisk = agent.riskLevel;

    const riskLevels = { low: 1, medium: 2, high: 3, all: 4 };
    const toolRiskValue = riskLevels[toolRisk] || 1;
    const agentRiskValue = riskLevels[agentRisk] || 1;

    if (toolRiskValue > agentRiskValue) {
      return {
        allowed: false,
        reason: 'Tool risk level exceeds agent clearance',
        toolRisk,
        agentRisk
      };
    }

    return {
      allowed: true
    };
  }

  /**
   * Log permission request
   * @param {Object} request
   */
  logPermissionRequest({ agentId, toolName, permission, granted, reason = null }) {
    const logEntry = {
      timestamp: new Date(),
      agentId,
      toolName,
      permission,
      granted,
      reason
    };

    this.permissionLog.push(logEntry);

    // Limit log size
    if (this.permissionLog.length > this.maxLogSize) {
      this.permissionLog.shift();
    }

    if (!granted) {
      logger.warn(`Permission denied: ${agentId} → ${toolName} (${reason})`);
    }
  }

  /**
   * Grant permission to agent
   * @param {string} agentId - Agent identifier
   * @param {string} permission - Permission to grant
   */
  grantPermission(agentId, permission) {
    const agent = this.agentPermissions.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.permissions.add(permission);
    logger.info(`Permission granted: ${agentId} → ${permission}`);
  }

  /**
   * Revoke permission from agent
   * @param {string} agentId - Agent identifier
   * @param {string} permission - Permission to revoke
   */
  revokePermission(agentId, permission) {
    const agent = this.agentPermissions.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.permissions.delete(permission);
    logger.info(`Permission revoked: ${agentId} → ${permission}`);
  }

  /**
   * Enable/disable agent
   * @param {string} agentId - Agent identifier
   * @param {boolean} enabled - Enable flag
   */
  setAgentEnabled(agentId, enabled) {
    const agent = this.agentPermissions.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.enabled = enabled;
    logger.info(`Agent ${agentId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get agent info
   * @param {string} agentId - Agent identifier
   * @returns {Object} Agent info
   */
  getAgent(agentId) {
    const agent = this.agentPermissions.get(agentId);
    
    if (!agent) {
      return null;
    }

    return {
      agentId,
      role: agent.role,
      permissions: Array.from(agent.permissions),
      riskLevel: agent.riskLevel,
      enabled: agent.enabled,
      createdAt: agent.createdAt
    };
  }

  /**
   * List all agents
   * @returns {Array} Agent list
   */
  listAgents() {
    const agents = [];
    
    for (const [agentId, agent] of this.agentPermissions.entries()) {
      agents.push({
        agentId,
        role: agent.role,
        permissions: Array.from(agent.permissions),
        riskLevel: agent.riskLevel,
        enabled: agent.enabled
      });
    }

    return agents;
  }

  /**
   * Get permission log
   * @param {Object} filters - Optional filters
   * @returns {Array} Permission log entries
   */
  getPermissionLog(filters = {}) {
    let log = [...this.permissionLog];

    if (filters.agentId) {
      log = log.filter(e => e.agentId === filters.agentId);
    }

    if (filters.toolName) {
      log = log.filter(e => e.toolName === filters.toolName);
    }

    if (filters.granted !== undefined) {
      log = log.filter(e => e.granted === filters.granted);
    }

    return log;
  }

  /**
   * Get permission statistics
   * @returns {Object} Permission stats
   */
  getStats() {
    const totalRequests = this.permissionLog.length;
    const granted = this.permissionLog.filter(e => e.granted).length;
    const denied = totalRequests - granted;
    const successRate = totalRequests > 0 ? ((granted / totalRequests) * 100).toFixed(2) : 0;

    // Most denied tools
    const deniedByTool = {};
    this.permissionLog.filter(e => !e.granted).forEach(e => {
      deniedByTool[e.toolName] = (deniedByTool[e.toolName] || 0) + 1;
    });

    const mostDenied = Object.entries(deniedByTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));

    return {
      totalAgents: this.agentPermissions.size,
      totalRequests,
      granted,
      denied,
      successRate,
      mostDenied
    };
  }

  /**
   * Get available roles
   * @returns {Array} Role list
   */
  getRoles() {
    return Object.entries(this.roles).map(([id, role]) => ({
      id,
      name: role.name,
      permissions: role.permissions,
      riskLevel: role.riskLevel
    }));
  }
}

module.exports = new PermissionManager();
