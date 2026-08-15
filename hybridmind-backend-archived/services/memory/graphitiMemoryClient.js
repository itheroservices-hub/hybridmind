class GraphitiMemoryClient {
  constructor() {
    this.projectStore = new Map();
  }

  upsertConvention(projectId, key, value, source = 'system', tags = []) {
    const store = this._getProjectStore(projectId);
    const existingIndex = store.conventions.findIndex(entry => entry.key === key);

    const payload = {
      key,
      value,
      source,
      tags,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      store.conventions[existingIndex] = payload;
    } else {
      store.conventions.push(payload);
    }

    return payload;
  }

  getConventions(projectId, tags = []) {
    const store = this._getProjectStore(projectId);
    if (!tags.length) {
      return store.conventions;
    }

    return store.conventions.filter(convention =>
      (convention.tags || []).some(tag => tags.includes(tag))
    );
  }

  recordDecision(projectId, decisionNode) {
    const store = this._getProjectStore(projectId);
    const payload = {
      ...decisionNode,
      timestamp: decisionNode.timestamp || new Date().toISOString()
    };

    store.decisions.push(payload);
    return payload;
  }

  getDecisions(projectId, limit = 20) {
    const store = this._getProjectStore(projectId);
    return store.decisions.slice(-limit);
  }

  _getProjectStore(projectId = 'default-project') {
    const key = projectId || 'default-project';

    if (!this.projectStore.has(key)) {
      this.projectStore.set(key, {
        conventions: [],
        decisions: []
      });
    }

    return this.projectStore.get(key);
  }
}

module.exports = new GraphitiMemoryClient();
