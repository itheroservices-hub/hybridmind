const graphitiMemoryClient = require('../memory/graphitiMemoryClient');

class AgentContextComposer {
  composeRoleContext({ projectId, role, task, tags = [] }) {
    const conventions = graphitiMemoryClient.getConventions(projectId, tags);
    const decisions = graphitiMemoryClient.getDecisions(projectId, 10);

    const conventionLines = conventions.map(entry => `- ${entry.key}: ${entry.value}`);
    const decisionLines = decisions.map(entry => `- [${entry.role || 'system'}] ${entry.summary || entry.action || 'decision'}`);

    return {
      projectId,
      role,
      taskSummary: typeof task === 'string' ? task.slice(0, 240) : 'structured-task',
      conventions,
      decisions,
      promptBlock: [
        '# Shared Project Conventions',
        ...(conventionLines.length ? conventionLines : ['- none']),
        '',
        '# Recent Project Decisions',
        ...(decisionLines.length ? decisionLines : ['- none'])
      ].join('\n')
    };
  }

  persistRoleOutput({ projectId, role, output }) {
    graphitiMemoryClient.recordDecision(projectId, {
      role,
      summary: `Role ${role} produced output`,
      outputPreview: String(output || '').slice(0, 300)
    });
  }
}

module.exports = new AgentContextComposer();
