/**
 * Secure Environment Configuration
 * Reads from .env file (git-ignored) for maximum security
 * NEVER hardcode API keys in source code!
 */

require('dotenv').config();

const environment = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // API Key - OpenRouter ONLY (routes to all providers)
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  
  // Model Configuration
  defaultModel: process.env.DEFAULT_MODEL || 'llama-3.3-70b-versatile',
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '120000'), // 2 minutes
  
  // Agent Configuration
  agentMaxSteps: parseInt(process.env.AGENT_MAX_STEPS || '10'),
  agentTimeout: parseInt(process.env.AGENT_TIMEOUT || '300000'), // 5 minutes
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
};

// Validation
function validateEnvironment() {
  // Check if OpenRouter API key is configured
  if (!environment.openrouterApiKey) {
    console.warn('⚠️  OPENROUTER_API_KEY not configured. All model requests will fail.');
    console.warn('   Add OPENROUTER_API_KEY=sk-or-v1-... to your .env file');
  } else {
    console.log('✓ OpenRouter API configured - all 200+ models available');
  }
}

validateEnvironment();

module.exports = environment;
