/**
 * AgentSync Routes
 * ================
 * REST API endpoints that bridge HybridMind to the AgentSync specialist network.
 *
 * Mounted at: /api/agentsync
 *
 * Endpoints
 * ---------
 * GET  /api/agentsync/health          — Is AgentSync server reachable?
 * GET  /api/agentsync/agents          — List all 65 AgentSync specialists
 * POST /api/agentsync/invoke          — Invoke specific agent(s) by slug
 * POST /api/agentsync/invoke/cos      — Route through Chief-of-Staff (full auto)
 * POST /api/agentsync/invoke/role     — Map a HybridMind role → AgentSync slug + invoke
 */

const express = require('express');
const router = express.Router();
const agentSyncClient = require('../services/agents/agentSyncClient');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

// ── Health ────────────────────────────────────────────────────────────────────

/**
 * GET /api/agentsync/health
 * Returns connectivity status to the AgentSync Python server.
 */
router.get('/health', async (req, res, next) => {
  try {
    const healthy = await agentSyncClient.checkHealth();
    res.json(responseFormatter.success({
      connected: healthy,
      url: agentSyncClient.baseUrl,
    }, { message: healthy ? 'AgentSync is reachable' : 'AgentSync is not reachable' }));
  } catch (error) {
    next(error);
  }
});

// ── List agents ───────────────────────────────────────────────────────────────

/**
 * GET /api/agentsync/agents
 * Returns all 65 AgentSync specialist agents with slugs, names, descriptions, tools.
 */
router.get('/agents', async (req, res, next) => {
  try {
    const agents = await agentSyncClient.listAgents();
    res.json(responseFormatter.success(agents, {
      message: `${agents.length} AgentSync specialists available`,
    }));
  } catch (error) {
    next(error);
  }
});

// ── Invoke agent(s) by slug ───────────────────────────────────────────────────

/**
 * POST /api/agentsync/invoke
 * Body: { request, agents?, workspace?, contextNotes? }
 * agents[] is optional — empty defaults to Chief-of-Staff auto-routing.
 */
router.post('/invoke', async (req, res, next) => {
  try {
    const { request, agents = [], workspace, contextNotes } = req.body;

    if (!request) {
      return res.status(400).json(responseFormatter.error('request is required'));
    }

    logger.info(`[AgentSync route] /invoke — agents: ${agents.length ? agents.join(', ') : 'auto'}`);

    const result = await agentSyncClient.invoke({ request, agents, workspace, contextNotes });

    if (!result.success && result.error) {
      return res.status(502).json(responseFormatter.error(`AgentSync error: ${result.error}`));
    }

    res.json(responseFormatter.success(result, {
      message: `AgentSync completed — ${result.results?.length || 0} agent(s) ran`,
    }));
  } catch (error) {
    next(error);
  }
});

// ── Chief-of-Staff shortcut ───────────────────────────────────────────────────

/**
 * POST /api/agentsync/invoke/cos
 * Body: { request, workspace?, contextNotes? }
 * Always routes through Chief-of-Staff — the CoS then picks the best specialists.
 */
router.post('/invoke/cos', async (req, res, next) => {
  try {
    const { request, workspace, contextNotes } = req.body;

    if (!request) {
      return res.status(400).json(responseFormatter.error('request is required'));
    }

    logger.info(`[AgentSync route] /invoke/cos — "${request.slice(0, 80)}"`);

    const result = await agentSyncClient.invokeCoS(request, { workspace, contextNotes });

    if (!result.success && result.error) {
      return res.status(502).json(responseFormatter.error(`AgentSync CoS error: ${result.error}`));
    }

    res.json(responseFormatter.success(result, {
      message: 'Chief-of-Staff pipeline completed',
    }));
  } catch (error) {
    next(error);
  }
});

// ── HybridMind role → AgentSync specialist ────────────────────────────────────

/**
 * POST /api/agentsync/invoke/role
 * Body: { role, request, workspace?, contextNotes? }
 * Maps a HybridMind role (CODER, REVIEWER, PLANNER, etc.) to the best AgentSync slug.
 * Allows the chainOrchestrator to delegate individual chain steps to AgentSync specialists.
 */
router.post('/invoke/role', async (req, res, next) => {
  try {
    const { role, request, workspace, contextNotes } = req.body;

    if (!role || !request) {
      return res.status(400).json(responseFormatter.error('role and request are required'));
    }

    const slug = agentSyncClient.slugForRole(role);
    logger.info(`[AgentSync route] /invoke/role — ${role} → ${slug}`);

    const result = await agentSyncClient.invoke({
      request,
      agents: [slug],
      workspace,
      contextNotes,
    });

    if (!result.success && result.error) {
      return res.status(502).json(responseFormatter.error(`AgentSync role error: ${result.error}`));
    }

    res.json(responseFormatter.success(
      { ...result, mappedSlug: slug },
      { message: `HybridMind role '${role}' → AgentSync '${slug}' completed` }
    ));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
