/**
 * Workflow Router
 * 
 * Routes tasks to appropriate agents/services based on decomposition analysis.
 * Integrates with multi-agent system for intelligent task distribution.
 */

const logger = require('../../utils/logger');
const decompositionEngine = require('./decompositionEngine');

/**
 * Service registry for spatial routing
 */
const SERVICE_REGISTRY = {
  'ui-service': {
    endpoint: '/services/ui',
    agents: ['analyst', 'coder'],
    capabilities: ['ui-development', 'frontend', 'components'],
    priority: 'high'
  },
  'api-gateway': {
    endpoint: '/services/api',
    agents: ['architect', 'coder', 'reviewer'],
    capabilities: ['api-design', 'endpoints', 'routing'],
    priority: 'high'
  },
  'business-service': {
    endpoint: '/services/business',
    agents: ['planner', 'coder', 'optimizer'],
    capabilities: ['business-logic', 'workflows', 'orchestration'],
    priority: 'high'
  },
  'data-service': {
    endpoint: '/services/data',
    agents: ['architect', 'coder', 'optimizer'],
    capabilities: ['database', 'queries', 'schema', 'migrations'],
    priority: 'high'
  },
  'integration-service': {
    endpoint: '/services/integration',
    agents: ['coder', 'tester'],
    capabilities: ['external-apis', 'webhooks', 'third-party'],
    priority: 'medium'
  },
  'file-service': {
    endpoint: '/services/file',
    agents: ['coder', 'optimizer'],
    capabilities: ['file-operations', 'storage', 'uploads'],
    priority: 'medium'
  },
  'cache-service': {
    endpoint: '/services/cache',
    agents: ['optimizer', 'coder'],
    capabilities: ['caching', 'performance', 'memory'],
    priority: 'medium'
  }
};

class WorkflowRouter {
  constructor() {
    this.routingTable = new Map();
    this.metrics = {
      totalRoutes: 0,
      functionalRoutes: 0,
      spatialRoutes: 0,
      temporalRoutes: 0,
      dataDrivenRoutes: 0,
      avgRoutingTime: 0
    };
  }

  /**
   * Route task based on decomposition analysis
   */
  async routeTask(task, options = {}) {
    const startTime = Date.now();
    logger.info(`Routing task: ${task.description || task.name}`);

    // Analyze task with decomposition engine
    const analysis = decompositionEngine.analyzeTask(task);

    // Generate routing plan
    const routingPlan = {
      taskId: analysis.taskId,
      strategy: options.preferredStrategy || this._selectBestStrategy(analysis),
      routes: [],
      executionOrder: [],
      parallelBatches: [],
      metadata: {
        decompositionAnalysis: analysis,
        routingTime: 0
      }
    };

    // Route based on selected strategy
    switch (routingPlan.strategy) {
      case 'functional':
        this._routeFunctional(routingPlan, analysis, options);
        this.metrics.functionalRoutes++;
        break;
      
      case 'spatial':
        this._routeSpatial(routingPlan, analysis, options);
        this.metrics.spatialRoutes++;
        break;
      
      case 'temporal':
        this._routeTemporal(routingPlan, analysis, options);
        this.metrics.temporalRoutes++;
        break;
      
      case 'data-driven':
        this._routeDataDriven(routingPlan, analysis, options);
        this.metrics.dataDrivenRoutes++;
        break;
      
      default:
        this._routeHybrid(routingPlan, analysis, options);
    }

    routingPlan.metadata.routingTime = Date.now() - startTime;
    this.metrics.totalRoutes++;
    this.metrics.avgRoutingTime = 
      (this.metrics.avgRoutingTime * (this.metrics.totalRoutes - 1) + routingPlan.metadata.routingTime) / 
      this.metrics.totalRoutes;

    logger.info(`Task routed: ${routingPlan.routes.length} routes, ${routingPlan.parallelBatches.length} parallel batches`);

    return routingPlan;
  }

  /**
   * Route by functional decomposition (UI, backend, DB, API)
   */
  _routeFunctional(routingPlan, analysis, options) {
    const { functional } = analysis.decompositions;
    
    // Create route for each functional component
    functional.components.forEach((component, index) => {
      const route = {
        routeId: `func-${index}`,
        type: 'functional',
        layer: component.layer,
        agents: this._selectAgentsForLayer(component.layer, options.tier),
        priority: component.priority,
        dependencies: component.dependencies,
        canParallelize: component.dependencies.length === 0,
        estimatedDuration: this._estimateDuration(component.estimatedEffort)
      };

      routingPlan.routes.push(route);
    });

    // Build execution order
    this._buildExecutionOrder(routingPlan);
    
    // Identify parallel batches
    this._identifyParallelBatches(routingPlan);
  }

  /**
   * Route by spatial decomposition (service routing)
   */
  _routeSpatial(routingPlan, analysis, options) {
    const { spatial } = analysis.decompositions;
    
    // Create route for each spatial zone
    spatial.zones.forEach((zone, index) => {
      const service = SERVICE_REGISTRY[zone.service];
      
      if (!service) {
        logger.warn(`Unknown service: ${zone.service}, using default routing`);
      }

      const route = {
        routeId: `spatial-${index}`,
        type: 'spatial',
        zone: zone.zone,
        service: zone.service,
        endpoint: service?.endpoint || '/services/default',
        agents: service?.agents || ['coder'],
        location: zone.location,
        latency: zone.latency,
        canParallelize: zone.location === 'local',
        estimatedDuration: this._latencyToDuration(zone.latency)
      };

      routingPlan.routes.push(route);
    });

    // Group by location for parallel execution
    this._groupByLocation(routingPlan);
  }

  /**
   * Route by temporal decomposition (phases)
   */
  _routeTemporal(routingPlan, analysis, options) {
    const { temporal } = analysis.decompositions;
    
    // Create route for each temporal phase
    temporal.phases.forEach((phase, index) => {
      const route = {
        routeId: `temporal-${index}`,
        type: 'temporal',
        phase: phase.phase,
        timing: phase.timing,
        executionOrder: phase.executionOrder,
        canDefer: phase.canDefer,
        agents: this._selectAgentsForPhase(phase.phase, options.tier),
        estimatedDuration: this._timingToDuration(phase.timing)
      };

      routingPlan.routes.push(route);
    });

    // Sort by execution order
    routingPlan.routes.sort((a, b) => a.executionOrder - b.executionOrder);
    
    // Group phases with same order for parallel execution
    this._groupByExecutionOrder(routingPlan);
  }

  /**
   * Route by data-driven decomposition (log segmentation)
   */
  _routeDataDriven(routingPlan, analysis, options) {
    const { dataDriven } = analysis.decompositions;
    
    // Create route for each data segment
    dataDriven.segments.forEach((segment, index) => {
      const route = {
        routeId: `data-${index}`,
        type: 'data-driven',
        dataType: segment.dataType,
        volume: segment.volume,
        velocity: segment.velocity,
        processingStrategy: segment.processingStrategy,
        agents: this._selectAgentsForDataType(segment.dataType, options.tier),
        canParallelize: segment.processingStrategy !== 'synchronous',
        estimatedDuration: this._volumeToDuration(segment.volume)
      };

      routingPlan.routes.push(route);
    });

    // Group by processing strategy
    this._groupByProcessingStrategy(routingPlan);
  }

  /**
   * Hybrid routing using multiple strategies
   */
  _routeHybrid(routingPlan, analysis, options) {
    // Combine insights from all decomposition types
    logger.info('Using hybrid routing strategy');
    
    // Start with functional routing as base
    this._routeFunctional(routingPlan, analysis, options);
    
    // Enhance with spatial insights
    const { spatial } = analysis.decompositions;
    routingPlan.routes.forEach(route => {
      const matchingZone = spatial.zones.find(z => 
        this._functionalLayerMatchesZone(route.layer, z.zone)
      );
      
      if (matchingZone) {
        route.location = matchingZone.location;
        route.latency = matchingZone.latency;
      }
    });
    
    // Add temporal constraints
    const { temporal } = analysis.decompositions;
    if (temporal.deferrable) {
      routingPlan.routes.forEach(route => {
        if (route.priority === 'low') {
          route.canDefer = true;
        }
      });
    }
  }

  /**
   * Select best routing strategy based on analysis
   */
  _selectBestStrategy(analysis) {
    const { functional, spatial, temporal, dataDriven } = analysis.decompositions;
    
    // Prioritize by complexity and impact
    const scores = {
      functional: functional.components.length * 10,
      spatial: spatial.zones.length * 8,
      temporal: temporal.phases.length * 6,
      dataDriven: dataDriven.segments.length * 7
    };
    
    // Return strategy with highest score
    return Object.entries(scores).reduce((best, [strategy, score]) => 
      score > best.score ? { strategy, score } : best,
      { strategy: 'functional', score: 0 }
    ).strategy;
  }

  /**
   * Select appropriate agents for functional layer
   */
  _selectAgentsForLayer(layer, tier = 'free') {
    const agentMap = {
      ui: ['analyst', 'coder'],
      backend: ['coder', 'reviewer'],
      database: ['architect', 'coder'],
      api: ['architect', 'coder', 'reviewer'],
      infrastructure: ['architect', 'optimizer'],
      testing: ['tester', 'reviewer'],
      documentation: ['documenter']
    };
    
    const agents = agentMap[layer] || ['coder'];
    
    // Limit by tier
    const limits = { free: 2, pro: 4, 'pro-plus': 6, enterprise: 10 };
    return agents.slice(0, limits[tier] || 2);
  }

  /**
   * Select agents for temporal phase
   */
  _selectAgentsForPhase(phase, tier = 'free') {
    const phaseAgents = {
      setup: ['planner', 'architect'],
      execution: ['coder', 'optimizer'],
      validation: ['tester', 'reviewer'],
      cleanup: ['coder'],
      deferred: ['optimizer'],
      scheduled: ['planner']
    };
    
    return phaseAgents[phase] || ['coder'];
  }

  /**
   * Select agents for data type
   */
  _selectAgentsForDataType(dataType, tier = 'free') {
    const dataAgents = {
      logs: ['debugger', 'analyst'],
      database: ['architect', 'coder'],
      files: ['coder', 'optimizer'],
      api: ['coder', 'tester'],
      memory: ['optimizer'],
      events: ['architect', 'coder'],
      metrics: ['analyst', 'optimizer']
    };
    
    return dataAgents[dataType] || ['coder'];
  }

  /**
   * Build execution order based on dependencies
   */
  _buildExecutionOrder(routingPlan) {
    const order = [];
    const processed = new Set();
    
    const addToOrder = (route) => {
      if (processed.has(route.routeId)) return;
      
      // Add dependencies first
      if (route.dependencies) {
        route.dependencies.forEach(dep => {
          const depRoute = routingPlan.routes.find(r => r.layer === dep);
          if (depRoute) addToOrder(depRoute);
        });
      }
      
      order.push(route.routeId);
      processed.add(route.routeId);
    };
    
    routingPlan.routes.forEach(addToOrder);
    routingPlan.executionOrder = order;
  }

  /**
   * Identify batches that can run in parallel
   */
  _identifyParallelBatches(routingPlan) {
    const batches = [];
    const processed = new Set();
    
    routingPlan.routes.forEach(route => {
      if (processed.has(route.routeId)) return;
      
      if (route.canParallelize) {
        // Find all routes that can run with this one
        const batch = [route.routeId];
        
        routingPlan.routes.forEach(otherRoute => {
          if (otherRoute.routeId !== route.routeId && 
              !processed.has(otherRoute.routeId) &&
              otherRoute.canParallelize &&
              !this._hasDependency(route, otherRoute, routingPlan)) {
            batch.push(otherRoute.routeId);
            processed.add(otherRoute.routeId);
          }
        });
        
        batches.push({
          batchId: `batch-${batches.length}`,
          routes: batch,
          executionMode: 'parallel',
          estimatedSpeedup: `${batch.length}x`
        });
        
        processed.add(route.routeId);
      }
    });
    
    routingPlan.parallelBatches = batches;
  }

  /**
   * Group routes by location
   */
  _groupByLocation(routingPlan) {
    const groups = {};
    
    routingPlan.routes.forEach(route => {
      const loc = route.location || 'local';
      groups[loc] = groups[loc] || [];
      groups[loc].push(route.routeId);
    });
    
    routingPlan.parallelBatches = Object.entries(groups)
      .filter(([loc, routes]) => routes.length > 1)
      .map(([loc, routes], index) => ({
        batchId: `location-${index}`,
        location: loc,
        routes,
        executionMode: 'parallel'
      }));
  }

  /**
   * Group routes by execution order
   */
  _groupByExecutionOrder(routingPlan) {
    const groups = {};
    
    routingPlan.routes.forEach(route => {
      const order = route.executionOrder || 0;
      groups[order] = groups[order] || [];
      groups[order].push(route.routeId);
    });
    
    routingPlan.parallelBatches = Object.entries(groups)
      .filter(([order, routes]) => routes.length > 1)
      .map(([order, routes], index) => ({
        batchId: `order-${order}`,
        executionOrder: parseInt(order),
        routes,
        executionMode: 'parallel'
      }));
  }

  /**
   * Group routes by processing strategy
   */
  _groupByProcessingStrategy(routingPlan) {
    const groups = {};
    
    routingPlan.routes.forEach(route => {
      const strategy = route.processingStrategy || 'synchronous';
      groups[strategy] = groups[strategy] || [];
      groups[strategy].push(route.routeId);
    });
    
    routingPlan.parallelBatches = Object.entries(groups)
      .filter(([strategy, routes]) => strategy !== 'synchronous' && routes.length > 1)
      .map(([strategy, routes], index) => ({
        batchId: `strategy-${index}`,
        processingStrategy: strategy,
        routes,
        executionMode: 'parallel'
      }));
  }

  /**
   * Check if route has dependency on another route
   */
  _hasDependency(route1, route2, routingPlan) {
    if (!route1.dependencies) return false;
    return route1.dependencies.includes(route2.layer);
  }

  /**
   * Check if functional layer matches spatial zone
   */
  _functionalLayerMatchesZone(layer, zone) {
    const mapping = {
      ui: 'frontend',
      backend: 'backend-services',
      api: 'backend-api',
      database: 'database-layer'
    };
    return mapping[layer] === zone;
  }

  // Duration estimation helpers
  _estimateDuration(effort) {
    const durations = { low: '1min', medium: '3min', high: '10min' };
    return durations[effort] || '3min';
  }

  _latencyToDuration(latency) {
    const durations = { low: '100ms', medium: '500ms', high: '2s' };
    return durations[latency] || '500ms';
  }

  _timingToDuration(timing) {
    const durations = { short: '1min', medium: '3min', long: '10min' };
    return durations[timing.duration] || '3min';
  }

  _volumeToDuration(volume) {
    const durations = { low: '1min', medium: '5min', high: '15min' };
    return durations[volume] || '5min';
  }

  /**
   * Get routing metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Get service registry
   */
  getServiceRegistry() {
    return SERVICE_REGISTRY;
  }
}

// Singleton instance
module.exports = new WorkflowRouter();
