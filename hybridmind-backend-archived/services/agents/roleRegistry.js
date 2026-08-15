const {
  ROLE_DEFINITIONS,
  AGENT_ROLES,
  getModelForAgent,
  isAgentAvailableForTier
} = require('../../config/agentRoles');

class RoleRegistry {
  constructor() {
    this.roles = new Map();
    this.aliases = new Map([
      ['builder', AGENT_ROLES.CODER],
      ['coder', AGENT_ROLES.CODER],
      ['planner', AGENT_ROLES.PLANNER],
      ['reviewer', AGENT_ROLES.REVIEWER],
      ['researcher', AGENT_ROLES.RESEARCHER],
      ['analyst', AGENT_ROLES.ANALYST],
      ['optimizer', AGENT_ROLES.OPTIMIZER],
      ['tester', AGENT_ROLES.TESTER],
      ['documenter', AGENT_ROLES.DOCUMENTER],
      ['debugger', AGENT_ROLES.DEBUGGER],
      ['architect', AGENT_ROLES.ARCHITECT]
    ]);

    this._seedDefaults();
  }

  registerRole(roleId, roleDefinition) {
    this.roles.set(roleId, {
      ...roleDefinition,
      id: roleId
    });
  }

  resolveRole(roleId, { tier = 'free', strategy = 'balanced' } = {}) {
    const resolvedRoleId = this.aliases.get(String(roleId || '').toLowerCase()) || roleId;
    const role = this.roles.get(resolvedRoleId);

    if (!role) {
      return null;
    }

    const tierAllowed = isAgentAvailableForTier(resolvedRoleId, this._normalizeTier(tier));
    const selectedModel = role.preferredModels?.[strategy]?.[0] || getModelForAgent(resolvedRoleId, strategy);

    return {
      ...role,
      id: resolvedRoleId,
      requestedRole: roleId,
      tierAllowed,
      selectedModel
    };
  }

  swapRoleModel(roleId, strategy = 'balanced') {
    const resolved = this.resolveRole(roleId, { strategy, tier: 'enterprise' });
    if (!resolved) return null;

    return {
      roleId: resolved.id,
      strategy,
      selectedModel: resolved.selectedModel
    };
  }

  listRoles() {
    return Array.from(this.roles.values());
  }

  _seedDefaults() {
    for (const [roleId, definition] of Object.entries(ROLE_DEFINITIONS)) {
      this.registerRole(roleId, definition);
    }
  }

  _normalizeTier(tier = 'free') {
    const normalized = String(tier).toLowerCase();
    if (normalized === 'pro+' || normalized === 'proplus') return 'pro-plus';
    return normalized;
  }
}

module.exports = new RoleRegistry();
