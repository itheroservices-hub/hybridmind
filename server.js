/**
 * HybridMind Backend Server
 * Multi-model AI orchestration API
 */

const express = require('express');
const cors = require('cors');
const environment = require('./hybridmind-backend/config/environment');
const logger = require('./hybridmind-backend/utils/logger');
const errorHandler = require('./hybridmind-backend/middleware/errorHandler');
const requestLogger = require('./hybridmind-backend/middleware/requestLogger');
const { burstLimiter, freeTokenLimiter, proTokenLimiter } = require('./hybridmind-backend/middleware/rateLimiter');
const { validateLicense } = require('./hybridmind-backend/middleware/licenseValidator');

// Routes
const modelsRoutes = require('./hybridmind-backend/routes/modelsRoutes');
const runRoutes = require('./hybridmind-backend/routes/runRoutes');
const agentRoutes = require('./hybridmind-backend/routes/agentRoutes');
const contextRoutes = require('./hybridmind-backend/routes/contextRoutes');
const planningRoutes = require('./hybridmind-backend/routes/planningRoutes');
const toolRoutes = require('./hybridmind-backend/routes/toolRoutes');
const guardrailRoutes = require('./hybridmind-backend/routes/guardrailRoutes');
const multiAgentRoutes = require('./hybridmind-backend/routes/multiAgentRoutes');
const workflowRoutes = require('./hybridmind-backend/routes/workflowRoutes');
const decompositionRoutes = require('./hybridmind-backend/routes/decompositionRoutes');
const evaluationRoutes = require('./hybridmind-backend/routes/evaluationRoutes');
const metricsRoutes = require('./hybridmind-backend/routes/metricsRoutes');
const learningRoutes = require('./hybridmind-backend/routes/learningRoutes');
const cacheRoutes = require('./hybridmind-backend/routes/cacheRoutes');
const observabilityRoutes = require('./hybridmind-backend/routes/observabilityRoutes');

// WebSocket collaboration server
const collaborationServer = require('./hybridmind-backend/services/collaboration/collaborationServer');
const realtimeMonitor = require('./hybridmind-backend/services/observability/realtimeMonitor');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' })); // Reduced from 10mb to save costs
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Request logging
if (environment.enableRequestLogging) {
  app.use(requestLogger);
}

// Health check (before rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: environment.nodeEnv
  });
});

// 💰 COST MONITORING ENDPOINT (Check your daily spend!)
app.get('/cost-stats', (req, res) => {
  const { rateLimiter } = require('./hybridmind-backend/middleware/rateLimiter');
  const stats = rateLimiter.getStats(req.ip || 'default');
  
  res.json({
    success: true,
    data: {
      dailyBudget: 2.0,
      dailySpent: stats.costLastDay.toFixed(4),
      dailyRemaining: (2.0 - stats.costLastDay).toFixed(4),
      percentUsed: ((stats.costLastDay / 2.0) * 100).toFixed(1),
      requestsToday: stats.requestsLastDay,
      requestsLastHour: stats.requestsLastHour,
      warning: stats.costLastDay > 1.6 ? '⚠️ Approaching daily budget limit!' : null,
      resetsIn: Math.ceil((86400000 - (Date.now() % 86400000)) / 3600000) + ' hours'
    }
  });
});

// CRITICAL: Validate licenses BEFORE rate limiting (so Pro users get higher limits)
app.use('/run', validateLicense);
app.use('/agent', validateLicense);

// Apply token-based rate limiting based on tier
app.use('/run', (req, res, next) => {
  const limiter = req.user?.tier === 'pro' ? proTokenLimiter : freeTokenLimiter;
  limiter(req, res, next);
});
app.use('/agent', (req, res, next) => {
  const limiter = req.user?.tier === 'pro' ? proTokenLimiter : freeTokenLimiter;
  limiter(req, res, next);
});

// CRITICAL: Apply rate limiting to API routes only
app.use('/run', burstLimiter);
app.use('/agent', burstLimiter);

// API Routes
app.use('/models', modelsRoutes);
app.use('/run', runRoutes);
app.use('/agent', agentRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/guardrails', guardrailRoutes);
app.use('/api/multi-agent', multiAgentRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/decomposition', decompositionRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/observability', observabilityRoutes);// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'HybridMind API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      models: '/models',
      run: '/run',
      agent: '/agent'
    }
  });
});

// Error handling
app.use(errorHandler);

// Start server
const port = environment.port;
const server = app.listen(port, () => {
  logger.info(`🚀 HybridMind backend running on port ${port}`);
  logger.info(`📊 Environment: ${environment.nodeEnv}`);
  logger.info(`🔗 API URL: http://localhost:${port}`);
  
  // Initialize WebSocket collaboration server
  collaborationServer.initialize(server);
  logger.info(`🔌 WebSocket collaboration server initialized`);
  
  // Initialize real-time monitoring
  realtimeMonitor.initialize(collaborationServer);
  logger.info(`📊 Real-time observability monitor initialized`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${port} is already in use`);
  } else {
    logger.error(`❌ Server error: ${error.message}`);
  }
  process.exit(1);
});

// Cleanup on shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  
  // Cleanup inactive workspaces
  collaborationServer.cleanupInactiveWorkspaces();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Keep process alive
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;
