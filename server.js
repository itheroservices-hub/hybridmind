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

// Routes
const modelsRoutes = require('./hybridmind-backend/routes/modelsRoutes');
const runRoutes = require('./hybridmind-backend/routes/runRoutes');
const agentRoutes = require('./hybridmind-backend/routes/agentRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (environment.enableRequestLogging) {
  app.use(requestLogger);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: environment.nodeEnv
  });
});

// API Routes
app.use('/models', modelsRoutes);
app.use('/run', runRoutes);
app.use('/agent', agentRoutes);

// Root route
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

// Keep process alive
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;
