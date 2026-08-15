const logger = require('../../utils/logger');
const localSentryClient = require('./localSentryClient');

const ROUTES = {
  LOCAL_SENTRY: 'local_sentry',
  HAIKU: 'haiku_4_5',
  SONNET_THINKING: 'sonnet_4_5_thinking'
};

const INTENTS = {
  DISCOVERY: 'discovery',
  WORKER: 'worker',
  ARCHITECTURE: 'architecture'
};

class IntelligenceTierRouter {
  constructor() {
    this.marginFloor = 0.75;
  }

  routeRequest({ userTier = 'free', taskType = '', role = '', prompt = '', metadata = {} }) {
    const startedAt = Date.now();
    const intent = this._classifyIntent({ taskType, role, prompt, metadata });
    const normalizedTier = this._normalizeTier(userTier);

    const decision = {
      intent,
      route: ROUTES.HAIKU,
      preferredModels: ['anthropic/claude-3-haiku', 'anthropic/claude-3.5-sonnet'],
      escalated: false,
      reasons: [],
      profitSignals: {},
      localSentry: null
    };

    if (intent === INTENTS.DISCOVERY) {
      const sentryProbe = localSentryClient.canHandleDiscovery({
        taskType,
        prompt,
        metadata
      });

      decision.localSentry = sentryProbe;

      if (sentryProbe.canHandle && sentryProbe.confidence >= 0.7) {
        decision.route = ROUTES.LOCAL_SENTRY;
        decision.preferredModels = [localSentryClient.modelId];
        decision.reasons.push('Discovery request handled by local sentry at near-zero cost');
        decision.profitSignals = this._estimateProfit({
          route: decision.route,
          tier: normalizedTier,
          prompt
        });
        return this._withTrace(decision, startedAt);
      }

      decision.reasons.push(`Local sentry fallback: ${sentryProbe.reason}`);
    }

    const architectureRequested =
      intent === INTENTS.ARCHITECTURE ||
      metadata.requiresThinking === true ||
      metadata.chainType === 'architecture';

    const sonnetAllowed = this._canUseSonnetThinking(normalizedTier);

    if (architectureRequested && sonnetAllowed) {
      decision.route = ROUTES.SONNET_THINKING;
      decision.preferredModels = ['anthropic/claude-sonnet-4.5', 'anthropic/claude-3.5-sonnet'];
      decision.reasons.push('Architecture-grade task routed to Sonnet thinking path');
    } else {
      decision.route = ROUTES.HAIKU;
      decision.preferredModels = ['anthropic/claude-3-haiku', 'anthropic/claude-3.5-sonnet'];
      if (architectureRequested && !sonnetAllowed) {
        decision.escalated = true;
        decision.reasons.push('Sonnet thinking restricted by tier; fallback to Haiku path');
      } else {
        decision.reasons.push('Worker/default path routed to Haiku-first strategy');
      }
    }

    decision.profitSignals = this._estimateProfit({
      route: decision.route,
      tier: normalizedTier,
      prompt
    });

    if (decision.profitSignals.projectedMargin < this.marginFloor) {
      decision.route = ROUTES.HAIKU;
      decision.preferredModels = ['anthropic/claude-3-haiku', 'anthropic/claude-3.5-sonnet'];
      decision.reasons.push('Projected margin below floor; enforced Haiku route');
      decision.profitSignals = this._estimateProfit({
        route: decision.route,
        tier: normalizedTier,
        prompt
      });
    }

    return this._withTrace(decision, startedAt);
  }

  _classifyIntent({ taskType = '', role = '', prompt = '', metadata = {} }) {
    if (metadata.forceDiscovery) return INTENTS.DISCOVERY;
    if (metadata.forceArchitecture) return INTENTS.ARCHITECTURE;

    const normalized = `${taskType} ${role} ${prompt}`.toLowerCase();
    const discoveryPatterns = [
      'where is',
      'find',
      'locate',
      'definition',
      'references',
      'which file',
      'symbol'
    ];
    const architecturePatterns = [
      'architecture',
      'system design',
      'migration plan',
      'service boundary',
      'event-driven',
      'rfc'
    ];

    if (discoveryPatterns.some(pattern => normalized.includes(pattern))) {
      return INTENTS.DISCOVERY;
    }

    if (architecturePatterns.some(pattern => normalized.includes(pattern))) {
      return INTENTS.ARCHITECTURE;
    }

    return INTENTS.WORKER;
  }

  _estimateProfit({ route, tier, prompt }) {
    const estimatedTokens = Math.max(600, Math.min(6000, Math.floor((prompt || '').length * 1.2)));

    const routeCostPer1K = {
      [ROUTES.LOCAL_SENTRY]: 0,
      [ROUTES.HAIKU]: 0.0015,
      [ROUTES.SONNET_THINKING]: 0.012
    };

    const tierRevenuePerRequest = {
      free: 0,
      pro: 0.04,
      proplus: 0.08,
      enterprise: 0.16
    };

    const estimatedCost = (estimatedTokens / 1000) * (routeCostPer1K[route] || routeCostPer1K[ROUTES.HAIKU]);
    const estimatedRevenue = tierRevenuePerRequest[tier] ?? tierRevenuePerRequest.free;
    const projectedMargin = estimatedRevenue <= 0 ? 1 : Math.max(0, (estimatedRevenue - estimatedCost) / estimatedRevenue);

    return {
      estimatedTokens,
      estimatedCost,
      estimatedRevenue,
      projectedMargin
    };
  }

  _normalizeTier(tier = 'free') {
    const normalized = String(tier).toLowerCase();
    if (normalized === 'pro+' || normalized === 'pro-plus') return 'proplus';
    return normalized;
  }

  _canUseSonnetThinking(tier) {
    return tier === 'proplus' || tier === 'enterprise';
  }

  _withTrace(decision, startedAt) {
    const trace = {
      ...decision,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    };

    logger.info('IntelligenceTierRouter decision', {
      route: trace.route,
      intent: trace.intent,
      escalated: trace.escalated,
      projectedMargin: trace.profitSignals?.projectedMargin
    });

    return trace;
  }
}

module.exports = new IntelligenceTierRouter();
module.exports.ROUTES = ROUTES;
module.exports.INTENTS = INTENTS;
