/**
 * AgentSync Client
 * ================
 * Bridges HybridMind's Node.js backend to the AgentSync Python HTTP server.
 *
 * AgentSync runs on http://localhost:8001 by default.
 * Set AGENTSYNC_URL in .env to override.
 *
 * Usage
 * -----
 *   // Give a task to Chief-of-Staff â€” it handles everything autonomously
 *   const result = await agentSyncClient.run('Build a REST API for SpectrumSync');
 *
 *   // Run via CoS with explicit workspace
 *   const result = await agentSyncClient.run('refactor auth.ts', { workspace: 'E:/IThero/SpectrumSync' });
 *
 *   // Run specific agent(s) in sequence
 *   const result = await agentSyncClient.invoke({
 *     request: 'write unit tests for payment.js',
 *     agents: ['test-generation-agent', 'qa-agent'],
 *     workspace: 'E:/IThero/SpectrumSync',
 *   });
 *
 *   // List all available agents
 *   const agents = await agentSyncClient.listAgents();
 */

const axios = require('axios');
const path = require('path');
const logger = require('../../utils/logger');

// Known projects under E:\IThero â€” CoS auto-detects these from task text
const PROJECT_MAP = {
  spectrumsync:     'E:\\IThero\\SpectrumSync',
  bettingodds:      'E:\\IThero\\BettingOddsApp (Playgorithm)',
  playgorithm:      'E:\\IThero\\BettingOddsApp (Playgorithm)',
  hybridmind:       'E:\\IThero\\HybridMind',
  agentsync:        'E:\\IThero\\AgentSync',
  sarnia:           'E:\\IThero\\SarniaDigital_Twin',
  'sarniadigital':  'E:\\IThero\\SarniaDigital_Twin',
  sovereignembers:  'E:\\IThero\\SovereignEmberAI',
  sovereignember:   'E:\\IThero\\SovereignEmberAI',
  itherowebsite:    'E:\\IThero\\ITheroWebsite',
  ghostwriter:      'E:\\IThero\\Ghostwriter+',
  fixit:            'E:\\IThero\\FixIT',
  msfs:             'E:\\IThero\\MSFS Tool Product',
};

/**
 * Attempt to infer a workspace path from the task text.
 * Checks for known project names and absolute paths.
 * Returns null if no project is detectable.
 */
function detectWorkspace(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Check for explicit Windows-style absolute path
  const absMatch = text.match(/[A-Za-z]:\\[^\s"']+/);
  if (absMatch) return absMatch[0];

  // Check known project names
  for (const [key, projectPath] of Object.entries(PROJECT_MAP)) {
    if (lower.includes(key)) return projectPath;
  }

  return null;
}

class AgentSyncClient {
  constructor() {
    this.baseUrl = (process.env.AGENTSYNC_URL || 'http://localhost:8001').replace(/\/$/, '');
    this.timeout = parseInt(process.env.AGENTSYNC_TIMEOUT || '600000'); // 10 min default for large tasks
    this.enabled = process.env.AGENTSYNC_ENABLED !== 'false';
    this.isHealthy = false;

    if (this.enabled) {
      this._checkHealth();
    }
  }

  // â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async _checkHealth() {
    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      this.isHealthy = res.data?.status === 'healthy';
      if (this.isHealthy) {
        const ws = res.data.workspace ? ` | workspace: ${res.data.workspace}` : '';
        logger.info(`[AgentSync] connected â€” ${res.data.agent_count} agents available${ws}`);
      }
    } catch {
      this.isHealthy = false;
      logger.warn('[AgentSync] server not reachable at ' + this.baseUrl);
    }
    return this.isHealthy;
  }

  async checkHealth() {
    return this._checkHealth();
  }

  get available() {
    return this.enabled && this.isHealthy;
  }

  // â”€â”€ Primary entry point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Give a task to the Chief-of-Staff Agent. It autonomously assembles an agent
   * team, executes the full pipeline, verifies results, and returns one clean output.
   *
   * You can optionally specify which agents or teams to use. CoS will build the
   * pipeline around them and add supporting agents (QA, security) as needed.
   *
   * @param {string} request  â€” Natural language task description
   * @param {Object} [opts]
   * @param {string}   [opts.workspace]     â€” Explicit workspace path (auto-detected if omitted)
   * @param {string[]} [opts.allowedRoots]  â€” Additional directories agents may read/write
   * @param {string[]} [opts.agentHints]    â€” Agent slugs or team names to prioritize
   *                                          e.g. ['coding-agent', 'security-qa-agent']
   *                                          e.g. ['frontend team']
   * @param {string}   [opts.contextNotes]  â€” Any prior context to inject
   * @returns {Promise<{success: boolean, results: Array, combinedOutput: string}>}
   *
   * @example
   * // Auto-routing â€” CoS picks the best agents
   * await agentSyncClient.run('Build auth for SpectrumSync');
   *
   * // Human-directed â€” CoS builds around these agents
   * await agentSyncClient.run('Add rate limiting to the API', {
   *   agentHints: ['network-and-api-agent', 'security-qa-agent'],
   * });
   *
   * // Team shortcut
   * await agentSyncClient.run('Redesign the dashboard', {
   *   agentHints: ['frontend team'],
   * });
   */
  async run(request, { workspace = null, allowedRoots = [], agentHints = [], contextNotes = null } = {}) {
    const detectedWorkspace = workspace || detectWorkspace(request);
    if (detectedWorkspace) {
      logger.info(`[AgentSync] workspace â†’ ${detectedWorkspace}`);
    }
    if (agentHints.length) {
      logger.info(`[AgentSync] agent hints â†’ ${agentHints.join(', ')}`);
    }
    return this.invoke({
      request,
      agents: ['chief-of-staff-agent'],
      workspace: detectedWorkspace,
      allowedRoots,
      agentHints,
      contextNotes,
    });
  }

  // â”€â”€ Core invoke â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Invoke one or more AgentSync agents in sequence.
   *
   * @param {Object} options
   * @param {string}   options.request        â€” Task description
   * @param {string[]} [options.agents]        â€” Agent slugs (empty = CoS auto-route)
   * @param {string}   [options.workspace]     â€” Target project directory
   * @param {string[]} [options.allowedRoots]  â€” Extra directories agents may access
   * @param {string}   [options.contextNotes]  â€” Prior context to inject
   */
  async invoke({ request, agents = [], workspace = null, allowedRoots = [], agentHints = [], contextNotes = null } = {}) {
    if (!this.enabled) {
      return this._unavailable('AgentSync is disabled (AGENTSYNC_ENABLED=false)');
    }
    if (!this.isHealthy) {
      const healthy = await this._checkHealth();
      if (!healthy) {
        return this._unavailable('AgentSync server is not reachable');
      }
    }

    const targetAgents = agents.length ? agents : ['chief-of-staff-agent'];
    logger.info(`[AgentSync] invoke â†’ ${targetAgents.join(', ')}${workspace ? ` | ws: ${workspace}` : ''}`);

    try {
      const payload = {
        request,
        agents: targetAgents,
        ...(workspace && { workspace }),
        ...(allowedRoots.length && { allowed_roots: allowedRoots }),
        ...(agentHints?.length && { agent_hints: agentHints }),
        ...(contextNotes && { context_notes: contextNotes }),
      };

      const res = await axios.post(`${this.baseUrl}/invoke`, payload, {
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' },
      });

      return res.data;
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      logger.error(`[AgentSync] invoke failed: ${msg}`);
      return this._error(msg);
    }
  }

  /**
   * Legacy alias â€” routes via Chief-of-Staff (use run() for new code).
   */
  async invokeCoS(request, { workspace = null, agentHints = [], contextNotes = null } = {}) {
    return this.run(request, { workspace, agentHints, contextNotes });
  }

  // â”€â”€ Agent discovery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Return the list of all available AgentSync agents.
   * @returns {Promise<Array<{slug, name, description, tools}>>}
   */
  async listAgents() {
    if (!this.enabled) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/agents`, { timeout: 10000 });
      return res.data || [];
    } catch (error) {
      logger.warn(`[AgentSync] listAgents failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Map a HybridMind role name to the best AgentSync specialist slug.
   */
  slugForRole(role) {
    const roleMap = {
      ANALYST:    'reasoning-agent',
      RESEARCHER: 'research-agent',
      PLANNER:    'planning-agent',
      CODER:      'coding-agent',
      REVIEWER:   'code-review-agent',
      OPTIMIZER:  'performance-optimization-agent',
      TESTER:     'test-generation-agent',
      DOCUMENTER: 'documentation-agent',
      DEBUGGER:   'debugging-agent',
      ARCHITECT:  'reasoning-agent',
    };
    return roleMap[role?.toUpperCase()] || 'coding-agent';
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _unavailable(reason) {
    logger.warn(`[AgentSync] unavailable: ${reason}`);
    return { success: false, results: [], combinedOutput: '', error: reason };
  }

  _error(message) {
    return { success: false, results: [], combinedOutput: '', error: message };
  }
}

// Export singleton + workspace detection utility for use elsewhere
const client = new AgentSyncClient();
client.detectWorkspace = detectWorkspace;
module.exports = client;

