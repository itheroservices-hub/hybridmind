/**
 * OpenRouter Service - Unified API for ALL Premium Models
 * Provides access to GPT-4, Claude, Gemini Pro, and 150+ other models
 * through a single pay-as-you-go API
 */

const logger = require('../../utils/logger');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4-turbo': { input: 10.00, output: 30.00 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'anthropic/claude-opus-4': { input: 15.00, output: 75.00 },
  'google/gemini-pro-1.5': { input: 1.25, output: 5.00 },
  'x-ai/grok-2': { input: 2.00, output: 10.00 }
};

/**
 * Call OpenRouter API
 */
async function callOpenRouter(model, prompt, options = {}) {
  if (!OPENROUTER_API_KEY) {
    logger.warn('OPENROUTER_API_KEY not set - premium models unavailable');
    return {
      success: false,
      error: 'OpenRouter not configured. Premium models require API key.'
    };
  }

  try {
    logger.info(`OpenRouter request: ${model}`);

    const messages = [{ role: 'user', content: prompt }];
    
    const requestBody = {
      model: model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4000,
      top_p: options.topP || 1,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0
    };

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hybridmind.app',
        'X-Title': 'HybridMind - Multi-Model AI Platform'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('OpenRouter API error:', errorData);
      
      return {
        success: false,
        error: errorData.error?.message || `OpenRouter error: ${response.status}`
      };
    }

    const data = await response.json();
    
    // Extract response
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};
    
    // Calculate cost
    const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
    const cost = (
      (usage.prompt_tokens / 1000000 * pricing.input) +
      (usage.completion_tokens / 1000000 * pricing.output)
    );

    logger.info(`OpenRouter success: ${model}, tokens: ${usage.total_tokens}, cost: $${cost.toFixed(4)}`);

    return {
      success: true,
      data: {
        content: content,
        model: model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        cost: cost,
        provider: 'openrouter'
      }
    };

  } catch (error) {
    logger.error('OpenRouter error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run a model via OpenRouter
 */
async function runModel(modelId, prompt, options = {}) {
  return await callOpenRouter(modelId, prompt, options);
}

/**
 * Get available OpenRouter models
 */
function getAvailableModels() {
  return [
    // Premium OpenAI Models
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      provider: 'OpenAI',
      tier: 'premium',
      contextWindow: 128000,
      pricing: MODEL_PRICING['openai/gpt-4o']
    },
    {
      id: 'openai/gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'OpenAI',
      tier: 'premium',
      contextWindow: 128000,
      pricing: MODEL_PRICING['openai/gpt-4-turbo']
    },
    
    // Premium Anthropic Models
    {
      id: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4',
      provider: 'Anthropic',
      tier: 'premium',
      contextWindow: 200000,
      pricing: MODEL_PRICING['anthropic/claude-sonnet-4']
    },
    {
      id: 'anthropic/claude-opus-4',
      name: 'Claude Opus 4',
      provider: 'Anthropic',
      tier: 'premium',
      contextWindow: 200000,
      pricing: MODEL_PRICING['anthropic/claude-opus-4']
    },
    
    // Premium Google Models
    {
      id: 'google/gemini-pro-1.5',
      name: 'Gemini Pro 1.5',
      provider: 'Google',
      tier: 'premium',
      contextWindow: 1000000,
      pricing: MODEL_PRICING['google/gemini-pro-1.5']
    },
    
    // Premium X.AI Models
    {
      id: 'x-ai/grok-2',
      name: 'Grok 2',
      provider: 'X.AI',
      tier: 'premium',
      contextWindow: 131072,
      pricing: MODEL_PRICING['x-ai/grok-2']
    }
  ];
}

module.exports = {
  runModel,
  getAvailableModels,
  MODEL_PRICING
};
