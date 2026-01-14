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
  
  // API Keys (read from .env, NEVER committed to git)
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  qwenApiKey: process.env.QWEN_API_KEY || '',
  qwenApiKey2: process.env.QWEN_API_KEY_2 || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  xaiApiKey: process.env.XAI_API_KEY || '',
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
  const warnings = [];
  
  // Check if at least one API key is configured
  const hasAnyKey = environment.openaiApiKey || environment.anthropicApiKey || 
                    environment.qwenApiKey || environment.groqApiKey ||
                    environment.deepseekApiKey || environment.geminiApiKey ||
                    environment.mistralApiKey || environment.xaiApiKey;
  
  if (!hasAnyKey) {
    console.warn('⚠️  No API keys configured. Please add at least one provider API key to .env file');
  }
  
  // Log configured providers
  const configured = [];
  if (environment.openaiApiKey) configured.push('OpenAI');
  if (environment.anthropicApiKey) configured.push('Anthropic');
  if (environment.qwenApiKey) configured.push('Qwen');
  if (environment.groqApiKey) configured.push('Groq');
  if (environment.deepseekApiKey) configured.push('DeepSeek');
  if (environment.geminiApiKey) configured.push('Gemini');
  if (environment.mistralApiKey) configured.push('Mistral');
  if (environment.xaiApiKey) configured.push('xAI');
  
  if (configured.length > 0) {
    console.log(`✓ Configured providers: ${configured.join(', ')}`);
  }
}

validateEnvironment();

module.exports = environment;
