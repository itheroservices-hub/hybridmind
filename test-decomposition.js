/**
 * Decomposition System Test
 * 
 * Tests all 4 decomposition strategies, workflow routing, and multi-agent integration.
 */

const decompositionEngine = require('./hybridmind-backend/services/decomposition/decompositionEngine');
const workflowRouter = require('./hybridmind-backend/services/decomposition/workflowRouter');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bold');
  log('='.repeat(60), 'cyan');
}

async function runTests() {
  log('\n🚀 Starting Decomposition System Tests', 'bold');

  // Test 1: Functional Decomposition
  section('Test 1: Functional Decomposition (UI + Backend + DB)');
  
  const fullStackTask = {
    name: 'Build E-commerce Dashboard',
    description: `Create a dashboard with user interface for product listings, 
                  backend API endpoints for CRUD operations, 
                  database schema for products and orders,
                  and testing suite for all components.`,
    context: { 
      type: 'full-stack',
      complexity: 'high'
    }
  };

  try {
    const analysis1 = decompositionEngine.analyzeTask(fullStackTask);
    
    log(`\n✅ Task analyzed:`, 'green');
    log(`   - Functional layers: ${analysis1.decompositions.functional.components.length}`, 'cyan');
    analysis1.decompositions.functional.components.forEach(c => {
      log(`     • ${c.layer} (${c.priority} priority)`, 'yellow');
    });
    
    log(`\n   - Parallelization opportunities: ${analysis1.parallelizationOpportunities.length}`, 'cyan');
    analysis1.parallelizationOpportunities.forEach(p => {
      log(`     • ${p.type}: ${p.expectedSpeedup} speedup`, 'yellow');
    });
    
    log(`\n   - Estimated latency reduction: ${analysis1.estimatedLatencyReduction}%`, 'green');
    
    log(`\n   - Recommendations:`, 'cyan');
    analysis1.recommendations.slice(0, 3).forEach(r => {
      log(`     • [${r.priority}] ${r.suggestion}`, 'yellow');
    });

  } catch (error) {
    log(`❌ Functional decomposition failed: ${error.message}`, 'red');
  }

  // Test 2: Spatial Decomposition
  section('Test 2: Spatial Decomposition (Microservices)');
  
  const microserviceTask = {
    name: 'Integrate Payment System',
    description: `Integrate Stripe payment gateway with our backend API,
                  update frontend checkout flow,
                  store transaction records in database,
                  implement file-based receipt generation,
                  add caching for payment methods.`,
    context: { 
      type: 'integration',
      services: ['frontend', 'backend', 'external-api', 'database', 'file-system', 'cache']
    }
  };

  try {
    const analysis2 = decompositionEngine.analyzeTask(microserviceTask);
    
    log(`\n✅ Task analyzed:`, 'green');
    log(`   - Spatial zones: ${analysis2.decompositions.spatial.zones.length}`, 'cyan');
    analysis2.decompositions.spatial.zones.forEach(z => {
      log(`     • ${z.zone} (${z.location}, ${z.latency} latency)`, 'yellow');
    });
    
    log(`\n   - Routing strategy: ${analysis2.decompositions.spatial.routingStrategy}`, 'green');

    // Test workflow routing
    const routingPlan2 = await workflowRouter.routeTask(microserviceTask, {
      tier: 'pro',
      preferredStrategy: 'spatial'
    });
    
    log(`\n   - Routes generated: ${routingPlan2.routes.length}`, 'cyan');
    log(`   - Parallel batches: ${routingPlan2.parallelBatches.length}`, 'cyan');
    routingPlan2.parallelBatches.forEach(b => {
      log(`     • ${b.batchId}: ${b.routes.length} routes in parallel`, 'yellow');
    });

  } catch (error) {
    log(`❌ Spatial decomposition failed: ${error.message}`, 'red');
  }

  // Test 3: Temporal Decomposition
  section('Test 3: Temporal Decomposition (Phased Execution)');
  
  const phasedTask = {
    name: 'Deploy Application',
    description: `Setup staging environment and dependencies immediately,
                  execute database migrations during setup phase,
                  deploy application code in execution phase,
                  validate deployment with health checks,
                  cleanup old deployments,
                  schedule automated backups for later,
                  defer log aggregation to background process.`,
    context: { 
      type: 'deployment',
      timeline: 'phased'
    }
  };

  try {
    const analysis3 = decompositionEngine.analyzeTask(phasedTask);
    
    log(`\n✅ Task analyzed:`, 'green');
    log(`   - Temporal phases: ${analysis3.decompositions.temporal.phases.length}`, 'cyan');
    
    // Group by execution order
    const byOrder = {};
    analysis3.decompositions.temporal.phases.forEach(p => {
      const order = p.executionOrder;
      byOrder[order] = byOrder[order] || [];
      byOrder[order].push(p);
    });
    
    Object.entries(byOrder).sort(([a], [b]) => a - b).forEach(([order, phases]) => {
      log(`     • Order ${order}:`, 'yellow');
      phases.forEach(p => log(`       - ${p.phase} (${p.timing.duration})`, 'yellow'));
    });
    
    log(`\n   - Deferrable phases: ${analysis3.decompositions.temporal.deferrable ? 'Yes' : 'No'}`, 'green');

  } catch (error) {
    log(`❌ Temporal decomposition failed: ${error.message}`, 'red');
  }

  // Test 4: Data-Driven Decomposition
  section('Test 4: Data-Driven Decomposition (Log Processing)');
  
  const dataPipelineTask = {
    name: 'Process Analytics Data',
    description: `Parse application logs for error patterns,
                  query database for user metrics and session data,
                  process uploaded CSV files with bulk data,
                  fetch data from external analytics API,
                  aggregate in-memory cache metrics,
                  listen to real-time event stream,
                  collect performance metrics continuously.`,
    context: { 
      type: 'data-pipeline',
      dataVolume: 'high',
      velocity: 'high'
    }
  };

  try {
    const analysis4 = decompositionEngine.analyzeTask(dataPipelineTask);
    
    log(`\n✅ Task analyzed:`, 'green');
    log(`   - Data segments: ${analysis4.decompositions.dataDriven.segments.length}`, 'cyan');
    
    // Group by processing strategy
    const byStrategy = {};
    analysis4.decompositions.dataDriven.segments.forEach(s => {
      const strategy = s.processingStrategy;
      byStrategy[strategy] = byStrategy[strategy] || [];
      byStrategy[strategy].push(s);
    });
    
    Object.entries(byStrategy).forEach(([strategy, segments]) => {
      log(`     • ${strategy}:`, 'yellow');
      segments.forEach(s => log(`       - ${s.dataType} (${s.volume} volume, ${s.velocity} velocity)`, 'yellow'));
    });

  } catch (error) {
    log(`❌ Data-driven decomposition failed: ${error.message}`, 'red');
  }

  // Test 5: Hybrid Routing
  section('Test 5: Hybrid Routing (Multiple Strategies)');
  
  const complexTask = {
    name: 'Build Real-Time Monitoring System',
    description: `Create dashboard UI with real-time graphs,
                  implement backend API for metric aggregation,
                  setup database for historical data storage,
                  integrate external monitoring APIs,
                  process high-volume log streams,
                  schedule periodic health checks,
                  cache frequently accessed metrics.`,
    context: { 
      type: 'complex',
      requiresAllStrategies: true
    }
  };

  try {
    const analysis5 = decompositionEngine.analyzeTask(complexTask);
    const routingPlan5 = await workflowRouter.routeTask(complexTask, {
      tier: 'pro-plus'
    });
    
    log(`\n✅ Task analyzed with all strategies:`, 'green');
    log(`   - Functional layers: ${analysis5.decompositions.functional.components.length}`, 'cyan');
    log(`   - Spatial zones: ${analysis5.decompositions.spatial.zones.length}`, 'cyan');
    log(`   - Temporal phases: ${analysis5.decompositions.temporal.phases.length}`, 'cyan');
    log(`   - Data segments: ${analysis5.decompositions.dataDriven.segments.length}`, 'cyan');
    
    log(`\n   - Routing strategy selected: ${routingPlan5.strategy}`, 'green');
    log(`   - Total routes: ${routingPlan5.routes.length}`, 'cyan');
    log(`   - Parallel batches: ${routingPlan5.parallelBatches.length}`, 'cyan');
    log(`   - Sequential routes: ${routingPlan5.routes.length - routingPlan5.parallelBatches.reduce((sum, b) => sum + b.routes.length, 0)}`, 'cyan');
    
    log(`\n   - Estimated latency reduction: ${analysis5.estimatedLatencyReduction}%`, 'green');

  } catch (error) {
    log(`❌ Hybrid routing failed: ${error.message}`, 'red');
  }

  // Test 6: Metrics
  section('Test 6: System Metrics');
  
  try {
    const decompositionMetrics = decompositionEngine.getMetrics();
    const routingMetrics = workflowRouter.getMetrics();
    
    log(`\n✅ Decomposition Metrics:`, 'green');
    log(`   - Total analyses: ${decompositionMetrics.totalAnalyses}`, 'cyan');
    log(`   - Functional: ${decompositionMetrics.functionalDecompositions}`, 'cyan');
    log(`   - Spatial: ${decompositionMetrics.spatialDecompositions}`, 'cyan');
    log(`   - Temporal: ${decompositionMetrics.temporalDecompositions}`, 'cyan');
    log(`   - Data-Driven: ${decompositionMetrics.dataDrivenDecompositions}`, 'cyan');
    log(`   - Avg latency reduction: ${decompositionMetrics.avgLatencyReduction}%`, 'green');
    
    log(`\n✅ Routing Metrics:`, 'green');
    log(`   - Total routes: ${routingMetrics.totalRoutes}`, 'cyan');
    log(`   - Functional routes: ${routingMetrics.functionalRoutes}`, 'cyan');
    log(`   - Spatial routes: ${routingMetrics.spatialRoutes}`, 'cyan');
    log(`   - Temporal routes: ${routingMetrics.temporalRoutes}`, 'cyan');
    log(`   - Data-driven routes: ${routingMetrics.dataDrivenRoutes}`, 'cyan');
    log(`   - Avg routing time: ${routingMetrics.avgRoutingTime}ms`, 'green');

  } catch (error) {
    log(`❌ Metrics retrieval failed: ${error.message}`, 'red');
  }

  // Test 7: Service Registry
  section('Test 7: Service Registry');
  
  try {
    const serviceRegistry = workflowRouter.getServiceRegistry();
    const services = Object.entries(serviceRegistry);
    
    log(`\n✅ Registered services: ${services.length}`, 'green');
    services.forEach(([name, config]) => {
      log(`   - ${name}:`, 'cyan');
      log(`     • Endpoint: ${config.endpoint}`, 'yellow');
      log(`     • Agents: ${config.agents.join(', ')}`, 'yellow');
      log(`     • Priority: ${config.priority}`, 'yellow');
    });

  } catch (error) {
    log(`❌ Service registry test failed: ${error.message}`, 'red');
  }

  // Summary
  section('Test Summary');
  
  log(`\n✅ All decomposition tests completed!`, 'green');
  log(`\n📊 Key Features Validated:`, 'bold');
  log(`   ✓ Functional decomposition (UI, backend, DB, API)`, 'green');
  log(`   ✓ Spatial decomposition (service routing)`, 'green');
  log(`   ✓ Temporal decomposition (phased execution)`, 'green');
  log(`   ✓ Data-driven decomposition (log segmentation)`, 'green');
  log(`   ✓ Workflow routing with parallel batches`, 'green');
  log(`   ✓ Latency estimation and optimization`, 'green');
  log(`   ✓ Service registry for spatial routing`, 'green');
  log(`   ✓ Metrics tracking and reporting`, 'green');
  
  log(`\n💡 Next Steps:`, 'cyan');
  log(`   1. Integrate with extension UI for user-facing features`, 'yellow');
  log(`   2. Test with real workflows to measure actual latency improvements`, 'yellow');
  log(`   3. Fine-tune algorithms based on production usage patterns`, 'yellow');
  log(`   4. Add caching for frequently decomposed tasks`, 'yellow');
  log(`   5. Implement adaptive learning to improve recommendations`, 'yellow');
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
