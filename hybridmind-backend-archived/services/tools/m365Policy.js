/**
 * M365 Policy Helper
 * Lightweight intent detection + preflight routing helpers.
 */

const M365_TERMS = [
  'microsoft 365',
  'm365',
  'copilot',
  'teams toolkit',
  'agents toolkit',
  'declarative agent',
  'app manifest',
  'api plugin manifest',
  'm365agents.yml',
  'teamsapp.yml'
];

function normalizeTerminology(input = '') {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/teams toolkit/gi, 'Microsoft 365 Agents Toolkit')
    .replace(/teams app manifest/gi, 'App Manifest')
    .trim();
}

function inferContext(input = '') {
  const text = normalizeTerminology(input).toLowerCase();

  const m365Intent = M365_TERMS.some(term => text.includes(term));
  const troubleshooting = /error|issue|fail|failing|troubleshoot|debug/.test(text);
  const howTo = /how to|how do i|guide|build|create|setup|configure/.test(text);
  const manifest = /manifest|m365agents\.yml|teamsapp\.yml|declarative agent|api plugin/.test(text);
  const codeGeneration = /generate|write|implement|code|snippet|sample/.test(text);

  let schemaName = 'app_manifest';
  if (/declarative agent/.test(text)) schemaName = 'declarative_agent_manifest';
  if (/api plugin/.test(text)) schemaName = 'api_plugin_manifest';
  if (/m365agents\.yml|teamsapp\.yml/.test(text)) schemaName = 'm365_agents_yaml';

  return {
    m365Intent,
    troubleshooting,
    howTo,
    manifest,
    codeGeneration,
    schemaName
  };
}

function buildPreflightToolCalls(input = '') {
  const context = inferContext(input);
  if (!context.m365Intent) {
    return [];
  }

  const calls = [
    {
      toolName: 'm365GetKnowledge',
      parameters: {
        question: normalizeTerminology(input)
      },
      confidence: 1
    }
  ];

  if (context.manifest) {
    calls.push({
      toolName: 'm365GetSchema',
      parameters: {
        schema_name: context.schemaName,
        schema_version: 'latest'
      },
      confidence: 1
    });
  }

  if (context.codeGeneration) {
    calls.push({
      toolName: 'm365GetCodeSnippets',
      parameters: {
        question: normalizeTerminology(input)
      },
      confidence: 0.9
    });
  }

  if (context.troubleshooting) {
    calls.push({
      toolName: 'm365Troubleshoot',
      parameters: {
        question: normalizeTerminology(input)
      },
      confidence: 0.9
    });
  }

  return calls;
}

module.exports = {
  normalizeTerminology,
  inferContext,
  buildPreflightToolCalls
};
