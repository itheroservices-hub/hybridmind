/**
 * Advanced Decomposition Engine
 * 
 * Implements 4 decomposition strategies to modularize workflows and reduce latency:
 * 1. Functional - Separate by concern (UI, backend, DB, API)
 * 2. Spatial - Route by service/location
 * 3. Temporal - Phase-based execution
 * 4. Data-Driven - Segment by log/data patterns
 */

const logger = require('../../utils/logger');

/**
 * Decomposition types
 */
const DECOMPOSITION_TYPES = {
  FUNCTIONAL: 'functional',
  SPATIAL: 'spatial',
  TEMPORAL: 'temporal',
  DATA_DRIVEN: 'data-driven'
};

/**
 * Functional layers (separation of concerns)
 */
const FUNCTIONAL_LAYERS = {
  UI: 'ui',
  BACKEND: 'backend',
  DATABASE: 'database',
  API: 'api',
  INFRASTRUCTURE: 'infrastructure',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation'
};

/**
 * Spatial zones (service routing)
 */
const SPATIAL_ZONES = {
  FRONTEND: 'frontend',
  BACKEND_API: 'backend-api',
  BACKEND_SERVICES: 'backend-services',
  DATABASE_LAYER: 'database-layer',
  EXTERNAL_APIS: 'external-apis',
  FILE_SYSTEM: 'file-system',
  CACHE_LAYER: 'cache-layer'
};

/**
 * Temporal phases (execution timeline)
 */
const TEMPORAL_PHASES = {
  IMMEDIATE: 'immediate',           // Execute now
  SETUP: 'setup',                   // Initialization phase
  EXECUTION: 'execution',           // Main work phase
  VALIDATION: 'validation',         // Verification phase
  CLEANUP: 'cleanup',               // Post-execution cleanup
  DEFERRED: 'deferred',             // Background/async work
  SCHEDULED: 'scheduled'            // Future execution
};

class DecompositionEngine {
  constructor() {
    this.analysisCache = new Map();
    this.metrics = {
      totalAnalyses: 0,
      functionalDecompositions: 0,
      spatialDecompositions: 0,
      temporalDecompositions: 0,
      dataDrivenDecompositions: 0,
      avgLatencyReduction: 0
    };
  }

  /**
   * Analyze task and apply all decomposition strategies
   */
  analyzeTask(task) {
    logger.info(`Analyzing task for decomposition: ${task.description || task.name}`);
    
    const analysis = {
      taskId: task.id || this._generateTaskId(task),
      originalTask: task,
      decompositions: {
        functional: this._functionalDecomposition(task),
        spatial: this._spatialDecomposition(task),
        temporal: this._temporalDecomposition(task),
        dataDriven: this._dataDrivenDecomposition(task)
      },
      recommendations: [],
      parallelizationOpportunities: [],
      estimatedLatencyReduction: 0
    };

    // Generate recommendations
    analysis.recommendations = this._generateRecommendations(analysis);
    
    // Identify parallelization opportunities
    analysis.parallelizationOpportunities = this._identifyParallelization(analysis);
    
    // Estimate latency reduction
    analysis.estimatedLatencyReduction = this._estimateLatencyReduction(analysis);

    // Cache analysis
    this.analysisCache.set(analysis.taskId, analysis);
    this.metrics.totalAnalyses++;

    logger.info(`Decomposition complete: ${analysis.recommendations.length} recommendations, ${analysis.parallelizationOpportunities.length} parallel opportunities`);

    return analysis;
  }

  /**
   * Functional Decomposition: Separate by architectural concern
   */
  _functionalDecomposition(task) {
    const components = [];
    const taskDesc = (task.description || task.prompt || '').toLowerCase();
    const taskType = task.type || task.action || '';

    // Analyze what functional layers this task touches
    const layers = {
      ui: this._matchesPattern(taskDesc, [
        'component', 'ui', 'interface', 'view', 'page', 'button', 'form',
        'react', 'vue', 'angular', 'html', 'css', 'frontend', 'display', 'render'
      ]),
      backend: this._matchesPattern(taskDesc, [
        'controller', 'service', 'route', 'endpoint', 'middleware', 'handler',
        'logic', 'business', 'process', 'workflow', 'orchestrat'
      ]),
      database: this._matchesPattern(taskDesc, [
        'database', 'db', 'sql', 'query', 'schema', 'migration', 'model',
        'collection', 'table', 'index', 'postgres', 'mysql', 'mongodb'
      ]),
      api: this._matchesPattern(taskDesc, [
        'api', 'rest', 'graphql', 'endpoint', 'request', 'response',
        'http', 'webhook', 'integration', 'external'
      ]),
      infrastructure: this._matchesPattern(taskDesc, [
        'deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline', 'build',
        'config', 'environment', 'server', 'hosting'
      ]),
      testing: this._matchesPattern(taskDesc, [
        'test', 'spec', 'unit', 'integration', 'e2e', 'mock', 'assertion',
        'coverage', 'jest', 'mocha', 'chai'
      ]),
      documentation: this._matchesPattern(taskDesc, [
        'document', 'readme', 'comment', 'jsdoc', 'markdown', 'guide',
        'tutorial', 'api doc', 'specification'
      ])
    };

    // Create components for each matched layer
    Object.entries(layers).forEach(([layer, matches]) => {
      if (matches.length > 0) {
        components.push({
          layer: FUNCTIONAL_LAYERS[layer.toUpperCase()],
          concern: layer,
          keywords: matches,
          priority: this._calculateLayerPriority(layer, matches.length),
          dependencies: this._getLayerDependencies(layer),
          estimatedEffort: this._estimateEffort(matches.length)
        });
      }
    });

    // If no specific layers identified, infer from task type
    if (components.length === 0) {
      components.push({
        layer: FUNCTIONAL_LAYERS.BACKEND,
        concern: 'general',
        keywords: [],
        priority: 'medium',
        dependencies: [],
        estimatedEffort: 'medium'
      });
    }

    this.metrics.functionalDecompositions++;

    return {
      strategy: DECOMPOSITION_TYPES.FUNCTIONAL,
      components,
      separationOfConcerns: components.map(c => c.layer),
      complexity: components.length > 3 ? 'high' : components.length > 1 ? 'medium' : 'low'
    };
  }

  /**
   * Spatial Decomposition: Route by service/location
   */
  _spatialDecomposition(task) {
    const taskDesc = (task.description || task.prompt || '').toLowerCase();
    const zones = [];

    // Identify which spatial zones this task operates in
    const zoneMatches = {
      frontend: this._matchesPattern(taskDesc, [
        'client', 'browser', 'ui', 'component', 'page', 'view', 'react', 'vue'
      ]),
      backendApi: this._matchesPattern(taskDesc, [
        'endpoint', 'route', 'controller', 'api', 'rest', 'graphql'
      ]),
      backendServices: this._matchesPattern(taskDesc, [
        'service', 'business logic', 'workflow', 'orchestrat', 'processor'
      ]),
      databaseLayer: this._matchesPattern(taskDesc, [
        'database', 'query', 'migration', 'schema', 'model', 'repository'
      ]),
      externalApis: this._matchesPattern(taskDesc, [
        'external', 'third-party', 'integration', 'webhook', 'stripe', 'openai'
      ]),
      fileSystem: this._matchesPattern(taskDesc, [
        'file', 'directory', 'upload', 'storage', 'read', 'write', 'path'
      ]),
      cacheLayer: this._matchesPattern(taskDesc, [
        'cache', 'redis', 'memory', 'session', 'temporary', 'buffer'
      ])
    };

    // Create zone entries
    Object.entries(zoneMatches).forEach(([zone, matches]) => {
      if (matches.length > 0) {
        zones.push({
          zone: SPATIAL_ZONES[zone.toUpperCase().replace(/-/g, '_')],
          service: this._inferServiceName(zone, task),
          location: this._inferServiceLocation(zone),
          latency: this._estimateZoneLatency(zone),
          keywords: matches
        });
      }
    });

    // Default to backend services if unclear
    if (zones.length === 0) {
      zones.push({
        zone: SPATIAL_ZONES.BACKEND_SERVICES,
        service: 'general-service',
        location: 'local',
        latency: 'low',
        keywords: []
      });
    }

    this.metrics.spatialDecompositions++;

    return {
      strategy: DECOMPOSITION_TYPES.SPATIAL,
      zones,
      routingStrategy: this._determineRoutingStrategy(zones),
      networkHops: zones.length,
      estimatedNetworkLatency: this._calculateNetworkLatency(zones)
    };
  }

  /**
   * Temporal Decomposition: Phase-based execution
   */
  _temporalDecomposition(task) {
    const taskDesc = (task.description || task.prompt || '').toLowerCase();
    const phases = [];

    // Analyze temporal requirements
    const phaseMatches = {
      immediate: this._matchesPattern(taskDesc, [
        'urgent', 'now', 'immediately', 'asap', 'critical', 'emergency'
      ]),
      setup: this._matchesPattern(taskDesc, [
        'initialize', 'setup', 'configure', 'prepare', 'install', 'bootstrap'
      ]),
      execution: this._matchesPattern(taskDesc, [
        'execute', 'run', 'process', 'implement', 'build', 'create', 'generate'
      ]),
      validation: this._matchesPattern(taskDesc, [
        'validate', 'verify', 'test', 'check', 'review', 'audit', 'confirm'
      ]),
      cleanup: this._matchesPattern(taskDesc, [
        'cleanup', 'remove', 'delete', 'purge', 'clear', 'reset'
      ]),
      deferred: this._matchesPattern(taskDesc, [
        'background', 'async', 'queue', 'later', 'eventual', 'batch'
      ]),
      scheduled: this._matchesPattern(taskDesc, [
        'schedule', 'cron', 'periodic', 'recurring', 'daily', 'weekly'
      ])
    };

    // Create phase timeline
    Object.entries(phaseMatches).forEach(([phase, matches]) => {
      if (matches.length > 0) {
        phases.push({
          phase: TEMPORAL_PHASES[phase.toUpperCase()],
          timing: this._getPhaseTimingInfo(phase),
          canDefer: phase === 'deferred' || phase === 'scheduled',
          executionOrder: this._getPhaseOrder(phase),
          keywords: matches
        });
      }
    });

    // Default execution phase if none specified
    if (phases.length === 0) {
      phases.push({
        phase: TEMPORAL_PHASES.EXECUTION,
        timing: { when: 'immediate', duration: 'medium' },
        canDefer: false,
        executionOrder: 2,
        keywords: []
      });
    }

    // Sort by execution order
    phases.sort((a, b) => a.executionOrder - b.executionOrder);

    this.metrics.temporalDecompositions++;

    return {
      strategy: DECOMPOSITION_TYPES.TEMPORAL,
      phases,
      timeline: phases.map(p => p.phase),
      totalDuration: this._estimateTotalDuration(phases),
      deferrable: phases.some(p => p.canDefer)
    };
  }

  /**
   * Data-Driven Decomposition: Segment by log/data patterns
   */
  _dataDrivenDecomposition(task) {
    const taskDesc = (task.description || task.prompt || '').toLowerCase();
    const code = task.code || task.context || '';
    const segments = [];

    // Analyze data patterns
    const dataPatterns = {
      logs: this._matchesPattern(taskDesc + ' ' + code, [
        'log', 'logger', 'console', 'debug', 'error', 'warn', 'info'
      ]),
      database: this._matchesPattern(taskDesc + ' ' + code, [
        'select', 'insert', 'update', 'delete', 'query', 'transaction'
      ]),
      files: this._matchesPattern(taskDesc + ' ' + code, [
        'file', 'read', 'write', 'stream', 'fs', 'path', 'directory'
      ]),
      api: this._matchesPattern(taskDesc + ' ' + code, [
        'fetch', 'axios', 'request', 'response', 'http', 'api'
      ]),
      memory: this._matchesPattern(taskDesc + ' ' + code, [
        'cache', 'memory', 'buffer', 'store', 'session', 'map', 'set'
      ]),
      events: this._matchesPattern(taskDesc + ' ' + code, [
        'event', 'emit', 'listener', 'subscribe', 'publish', 'message'
      ]),
      metrics: this._matchesPattern(taskDesc + ' ' + code, [
        'metric', 'stats', 'analytics', 'monitor', 'track', 'measure'
      ])
    };

    // Create data segments
    Object.entries(dataPatterns).forEach(([pattern, matches]) => {
      if (matches.length > 0) {
        segments.push({
          dataType: pattern,
          volume: this._estimateDataVolume(pattern, code),
          velocity: this._estimateDataVelocity(pattern),
          processingStrategy: this._recommendProcessingStrategy(pattern),
          keywords: matches
        });
      }
    });

    // Default to general data processing
    if (segments.length === 0) {
      segments.push({
        dataType: 'general',
        volume: 'medium',
        velocity: 'low',
        processingStrategy: 'synchronous',
        keywords: []
      });
    }

    this.metrics.dataDrivenDecompositions++;

    return {
      strategy: DECOMPOSITION_TYPES.DATA_DRIVEN,
      segments,
      dataFlow: this._analyzeDataFlow(segments),
      processingComplexity: segments.length > 2 ? 'high' : 'medium',
      recommendedApproach: this._recommendDataApproach(segments)
    };
  }

  /**
   * Generate recommendations based on decomposition analysis
   */
  _generateRecommendations(analysis) {
    const recommendations = [];

    // Functional recommendations
    const { functional } = analysis.decompositions;
    if (functional.components.length > 1) {
      recommendations.push({
        type: 'modularization',
        priority: 'high',
        suggestion: `Split into ${functional.components.length} modules: ${functional.separationOfConcerns.join(', ')}`,
        rationale: 'Clear separation of concerns improves maintainability and testability',
        decompositionType: DECOMPOSITION_TYPES.FUNCTIONAL
      });
    }

    // Spatial recommendations
    const { spatial } = analysis.decompositions;
    if (spatial.zones.length > 1) {
      const highLatencyZones = spatial.zones.filter(z => z.latency === 'high');
      if (highLatencyZones.length > 0) {
        recommendations.push({
          type: 'latency-optimization',
          priority: 'high',
          suggestion: `Optimize high-latency zones: ${highLatencyZones.map(z => z.zone).join(', ')}`,
          rationale: 'Network calls and external services add significant latency',
          decompositionType: DECOMPOSITION_TYPES.SPATIAL
        });
      }
    }

    // Temporal recommendations
    const { temporal } = analysis.decompositions;
    if (temporal.deferrable) {
      const deferrablePhases = temporal.phases.filter(p => p.canDefer);
      recommendations.push({
        type: 'async-execution',
        priority: 'medium',
        suggestion: `Move to background: ${deferrablePhases.map(p => p.phase).join(', ')}`,
        rationale: 'Non-critical work can run asynchronously to reduce response time',
        decompositionType: DECOMPOSITION_TYPES.TEMPORAL
      });
    }

    // Data-driven recommendations
    const { dataDriven } = analysis.decompositions;
    const highVolumeSegments = dataDriven.segments.filter(s => s.volume === 'high');
    if (highVolumeSegments.length > 0) {
      recommendations.push({
        type: 'data-optimization',
        priority: 'high',
        suggestion: `Use ${highVolumeSegments[0].processingStrategy} for high-volume ${highVolumeSegments.map(s => s.dataType).join(', ')}`,
        rationale: 'Large datasets require optimized processing strategies',
        decompositionType: DECOMPOSITION_TYPES.DATA_DRIVEN
      });
    }

    return recommendations;
  }

  /**
   * Identify parallelization opportunities
   */
  _identifyParallelization(analysis) {
    const opportunities = [];

    // Functional layer parallelization
    const independentLayers = analysis.decompositions.functional.components.filter(c => 
      c.dependencies.length === 0
    );
    
    if (independentLayers.length > 1) {
      opportunities.push({
        type: 'functional-parallel',
        tasks: independentLayers.map(l => l.layer),
        expectedSpeedup: `${independentLayers.length}x`,
        reason: 'Independent functional layers can execute simultaneously'
      });
    }

    // Spatial zone parallelization
    const localZones = analysis.decompositions.spatial.zones.filter(z => 
      z.location === 'local'
    );
    
    if (localZones.length > 1) {
      opportunities.push({
        type: 'spatial-parallel',
        tasks: localZones.map(z => z.zone),
        expectedSpeedup: `${localZones.length}x`,
        reason: 'Local services can be called in parallel'
      });
    }

    // Temporal phase parallelization
    const sameOrderPhases = analysis.decompositions.temporal.phases.reduce((acc, phase) => {
      acc[phase.executionOrder] = acc[phase.executionOrder] || [];
      acc[phase.executionOrder].push(phase);
      return acc;
    }, {});

    Object.entries(sameOrderPhases).forEach(([order, phases]) => {
      if (phases.length > 1) {
        opportunities.push({
          type: 'temporal-parallel',
          tasks: phases.map(p => p.phase),
          expectedSpeedup: `${phases.length}x`,
          reason: `Phases with same execution order (${order}) can run concurrently`
        });
      }
    });

    return opportunities;
  }

  /**
   * Estimate latency reduction from decomposition
   */
  _estimateLatencyReduction(analysis) {
    let reduction = 0;

    // Calculate from parallelization opportunities
    analysis.parallelizationOpportunities.forEach(opp => {
      const speedup = parseFloat(opp.expectedSpeedup);
      if (!isNaN(speedup)) {
        reduction += (speedup - 1) * 20; // ~20% reduction per parallel task
      }
    });

    // Add bonus for async/deferred work
    if (analysis.decompositions.temporal.deferrable) {
      reduction += 15; // 15% reduction from async work
    }

    // Add bonus for data optimization
    const highVolumeSegments = analysis.decompositions.dataDriven.segments.filter(
      s => s.volume === 'high'
    );
    if (highVolumeSegments.length > 0) {
      reduction += 10 * highVolumeSegments.length; // 10% per optimized data segment
    }

    // Cap at 80% max reduction
    return Math.min(reduction, 80);
  }

  // Helper methods
  _matchesPattern(text, keywords) {
    return keywords.filter(keyword => text.includes(keyword));
  }

  _generateTaskId(task) {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _calculateLayerPriority(layer, matchCount) {
    if (layer === 'testing' || layer === 'documentation') return 'low';
    if (layer === 'backend' || layer === 'api') return 'high';
    return matchCount > 2 ? 'high' : 'medium';
  }

  _getLayerDependencies(layer) {
    const deps = {
      ui: ['backend', 'api'],
      backend: ['database'],
      api: ['backend'],
      testing: ['backend', 'ui'],
      documentation: []
    };
    return deps[layer] || [];
  }

  _estimateEffort(matchCount) {
    if (matchCount > 3) return 'high';
    if (matchCount > 1) return 'medium';
    return 'low';
  }

  _inferServiceName(zone, task) {
    const serviceMap = {
      frontend: 'ui-service',
      backendApi: 'api-gateway',
      backendServices: 'business-service',
      databaseLayer: 'data-service',
      externalApis: 'integration-service',
      fileSystem: 'file-service',
      cacheLayer: 'cache-service'
    };
    return serviceMap[zone] || 'general-service';
  }

  _inferServiceLocation(zone) {
    if (zone.includes('external')) return 'remote';
    if (zone.includes('database') || zone.includes('cache')) return 'adjacent';
    return 'local';
  }

  _estimateZoneLatency(zone) {
    if (zone.includes('external')) return 'high';
    if (zone.includes('database') || zone.includes('file')) return 'medium';
    return 'low';
  }

  _determineRoutingStrategy(zones) {
    if (zones.length === 1) return 'direct';
    if (zones.some(z => z.latency === 'high')) return 'async-cascade';
    return 'parallel-fanout';
  }

  _calculateNetworkLatency(zones) {
    const latencyValues = { low: 5, medium: 50, high: 200 };
    const total = zones.reduce((sum, z) => sum + latencyValues[z.latency], 0);
    return `${total}ms`;
  }

  _getPhaseTimingInfo(phase) {
    const timings = {
      immediate: { when: 'immediate', duration: 'short' },
      setup: { when: 'before-execution', duration: 'short' },
      execution: { when: 'immediate', duration: 'medium' },
      validation: { when: 'after-execution', duration: 'short' },
      cleanup: { when: 'after-validation', duration: 'short' },
      deferred: { when: 'async', duration: 'long' },
      scheduled: { when: 'future', duration: 'medium' }
    };
    return timings[phase] || { when: 'immediate', duration: 'medium' };
  }

  _getPhaseOrder(phase) {
    const order = {
      immediate: 0,
      setup: 1,
      execution: 2,
      validation: 3,
      cleanup: 4,
      deferred: 5,
      scheduled: 6
    };
    return order[phase] || 2;
  }

  _estimateTotalDuration(phases) {
    const durations = { short: 1, medium: 3, long: 10 };
    const total = phases.reduce((sum, p) => sum + durations[p.timing.duration], 0);
    return `${total}min`;
  }

  _estimateDataVolume(pattern, code) {
    if (pattern === 'database' && code.includes('select *')) return 'high';
    if (pattern === 'files' && code.includes('stream')) return 'high';
    if (pattern === 'logs') return 'medium';
    return 'low';
  }

  _estimateDataVelocity(pattern) {
    if (pattern === 'events' || pattern === 'api') return 'high';
    if (pattern === 'logs' || pattern === 'metrics') return 'medium';
    return 'low';
  }

  _recommendProcessingStrategy(pattern) {
    if (pattern === 'events' || pattern === 'api') return 'streaming';
    if (pattern === 'database' || pattern === 'files') return 'batch';
    return 'synchronous';
  }

  _analyzeDataFlow(segments) {
    return segments.map(s => `${s.dataType} (${s.volume})`).join(' → ');
  }

  _recommendDataApproach(segments) {
    const highVelocity = segments.some(s => s.velocity === 'high');
    const highVolume = segments.some(s => s.volume === 'high');
    
    if (highVelocity && highVolume) return 'stream-processing';
    if (highVolume) return 'batch-processing';
    if (highVelocity) return 'event-driven';
    return 'request-response';
  }

  /**
   * Get decomposition metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.analysisCache.size
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisCache.clear();
    logger.info('Decomposition analysis cache cleared');
  }
}

// Singleton instance
module.exports = new DecompositionEngine();
