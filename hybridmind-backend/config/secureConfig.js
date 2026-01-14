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

  // API Keys (read from .env, NEVER hardcoded)
  apiKeys: {
    groq: process.env.GROQ_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    qwen: process.env.QWEN_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    mistral: process.env.MISTRAL_API_KEY || '',
    xai: process.env.XAI_API_KEY || ''
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

// Validation: Warn if critical keys are missing
const requiredKeys = ['GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY'];
const missingKeys = requiredKeys.filter(key => !process.env[key]);

if (missingKeys.length > 0) {
  console.warn(`⚠️  Missing required API keys: ${missingKeys.join(', ')}`);
}

module.exports = config;
