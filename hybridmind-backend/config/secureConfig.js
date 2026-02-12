/**
 * Secure Configuration Loader
 * Reads from .env file (NOT committed to git)
 * Provides typed access to environment variables
 */

require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // API Key - OpenRouter ONLY (routes to all providers)
  apiKeys: {
    openrouter: process.env.OPENROUTER_API_KEY || ''
  },

  // Model Configuration
  models: {
    defaultModel: process.env.DEFAULT_MODEL || 'llama-3.3-70b-versatile',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '120000')
  },

  // Agent Configuration
  agent: {
    maxSteps: parseInt(process.env.AGENT_MAX_STEPS || '10'),
    timeout: parseInt(process.env.AGENT_TIMEOUT || '300000')
  }
};

// Validation: Check if OpenRouter key is configured
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️  OPENROUTER_API_KEY not set - all model requests will fail');
  console.warn('   Add OPENROUTER_API_KEY=sk-or-v1-... to your .env file');
} else {
  console.log('✓ OpenRouter API configured');
}

module.exports = config;
