const DISCOVERY_PATTERNS = [
  'where is',
  'find',
  'locate',
  'which file',
  'definition',
  'reference',
  'symbol',
  'uses of',
  'called from'
];

class LocalSentryClient {
  constructor() {
    this.modelId = 'local/llama-3.2-1b-sentry';
  }

  isDiscoveryQuery(text = '') {
    const normalized = text.toLowerCase();
    return DISCOVERY_PATTERNS.some(pattern => normalized.includes(pattern));
  }

  canHandleDiscovery({ taskType = '', prompt = '', metadata = {} }) {
    if (metadata.disableLocalSentry === true) {
      return {
        canHandle: false,
        confidence: 0,
        reason: 'local-sentry-disabled'
      };
    }

    const discoveryTaskTypes = new Set([
      'discovery',
      'analysis',
      'research',
      'code-navigation',
      'symbol-lookup'
    ]);

    const text = `${taskType} ${prompt}`.trim();
    const patternMatch = this.isDiscoveryQuery(text);
    const taskMatch = discoveryTaskTypes.has((taskType || '').toLowerCase());

    if (!patternMatch && !taskMatch) {
      return {
        canHandle: false,
        confidence: 0.2,
        reason: 'not-a-discovery-query'
      };
    }

    return {
      canHandle: true,
      confidence: metadata.localSentryConfidence || 0.85,
      reason: 'discovery-query'
    };
  }
}

module.exports = new LocalSentryClient();
