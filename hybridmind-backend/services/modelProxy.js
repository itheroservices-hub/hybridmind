/**
 * Model Proxy Service - OpenRouter ONLY
 * 
 * All models are routed through OpenRouter API for:
 * - Single API key management
 * - Unified billing for premium users
 * - Access to 200+ models including free tiers
 * - Better rate limit handling (pooled across providers)
 */

const axios = require('axios');
const environment = require('../config/environment');
const logger = require('../utils/logger');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

class ModelProxy {
  constructor() {
    this.apiKey = environment.openrouterApiKey;
    
    if (!this.apiKey) {
      logger.warn('⚠️ OPENROUTER_API_KEY not set - API calls will fail');
    } else {
      logger.info('✓ OpenRouter API configured');
    }
  }

  /**
   * Model configuration - maps friendly names to OpenRouter model IDs
   */
  getModelConfig(modelId) {
    const models = {
      // ============================================
      // FREE TIER - $0 cost models
      // ============================================
      'llama-3.3-70b': {
        tier: 'free',
        openRouterId: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B',
        contextWindow: 131072,
        costPerMillion: { input: 0, output: 0 },
        description: 'Meta\'s flagship open model - excellent for coding'
      },
      'llama-3.3-70b-versatile': {
        tier: 'free',
        openRouterId: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B',
        contextWindow: 131072,
        costPerMillion: { input: 0, output: 0 },
        description: 'Meta\'s flagship open model - excellent for coding'
      },
      'llama-3.1-8b': {
        tier: 'free',
        openRouterId: 'meta-llama/llama-3.1-8b-instruct:free',
        name: 'Llama 3.1 8B',
        contextWindow: 131072,
        costPerMillion: { input: 0, output: 0 },
        description: 'Fast and efficient for simple tasks'
      },
      'deepseek-r1': {
        tier: 'free',
        openRouterId: 'deepseek/deepseek-r1-0528:free',
        name: 'DeepSeek R1',
        contextWindow: 164000,
        costPerMillion: { input: 0, output: 0 },
        description: 'DeepSeek reasoning model - on par with o1'
      },
      'deepseek-v3': {
        tier: 'free',
        openRouterId: 'deepseek/deepseek-chat:free',
        name: 'DeepSeek V3',
        contextWindow: 64000,
        costPerMillion: { input: 0, output: 0 },
        description: 'DeepSeek chat model - great for coding'
      },
      'deepseek-chat': {
        tier: 'free',
        openRouterId: 'deepseek/deepseek-chat:free',
        name: 'DeepSeek Chat',
        contextWindow: 64000,
        costPerMillion: { input: 0, output: 0 },
        description: 'DeepSeek chat - cost-effective coding specialist'
      },
      'qwen3-coder': {
        tier: 'free',
        openRouterId: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder 480B',
        contextWindow: 262000,
        costPerMillion: { input: 0, output: 0 },
        description: 'Alibaba\'s agentic coding specialist - 480B MoE'
      },
      'gemini-flash': {
        tier: 'free',
        openRouterId: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1048576,
        costPerMillion: { input: 0, output: 0 },
        description: 'Google\'s fast multimodal model'
      },
      'devstral': {
        tier: 'free',
        openRouterId: 'mistralai/devstral-2512:free',
        name: 'Mistral Devstral 2',
        contextWindow: 262000,
        costPerMillion: { input: 0, output: 0 },
        description: 'Mistral\'s agentic coding specialist'
      },
      'mimo-flash': {
        tier: 'free',
        openRouterId: 'xiaomi/mimo-v2-flash:free',
        name: 'MiMo V2 Flash',
        contextWindow: 262000,
        costPerMillion: { input: 0, output: 0 },
        description: 'Xiaomi\'s MoE model - #1 on SWE-bench'
      },
      'glm-4.5-air': {
        tier: 'free',
        openRouterId: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air',
        contextWindow: 131000,
        costPerMillion: { input: 0, output: 0 },
        description: 'Zhipu\'s lightweight agent model'
      },

      // ============================================
      // LOW COST TIER - Very affordable
      // ============================================
      'llama-4-maverick': {
        tier: 'low',
        openRouterId: 'meta-llama/llama-4-maverick',
        name: 'Llama 4 Maverick',
        contextWindow: 1048576,
        costPerMillion: { input: 0.15, output: 0.60 },
        description: 'Meta\'s multimodal flagship - 1M context'
      },
      'llama-4-scout': {
        tier: 'low',
        openRouterId: 'meta-llama/llama-4-scout',
        name: 'Llama 4 Scout',
        contextWindow: 328000,
        costPerMillion: { input: 0.08, output: 0.30 },
        description: 'Efficient multimodal model - 10M training context'
      },
      'gemini-2.0-flash': {
        tier: 'low',
        openRouterId: 'google/gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1048576,
        costPerMillion: { input: 0.10, output: 0.40 },
        description: 'Google\'s fastest model with 1M context'
      },

      // ============================================
      // PREMIUM TIER - Top models
      // ============================================
      'gpt-4o': {
        tier: 'premium',
        openRouterId: 'openai/gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        costPerMillion: { input: 2.50, output: 10.00 },
        description: 'OpenAI\'s flagship multimodal model'
      },
      'gpt-4-turbo': {
        tier: 'premium',
        openRouterId: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        costPerMillion: { input: 10.00, output: 30.00 },
        description: 'OpenAI\'s powerful reasoning model'
      },
      'gpt-4.1': {
        tier: 'premium',
        openRouterId: 'openai/gpt-4.1',
        name: 'GPT-4.1',
        contextWindow: 1047576,
        costPerMillion: { input: 2.00, output: 8.00 },
        description: 'OpenAI\'s latest with 1M context'
      },
      'claude-sonnet-4': {
        tier: 'premium',
        openRouterId: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        costPerMillion: { input: 3.00, output: 15.00 },
        description: 'Anthropic\'s balanced model'
      },
      'claude-sonnet-4.5': {
        tier: 'premium',
        openRouterId: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4.5',
        contextWindow: 200000,
        costPerMillion: { input: 3.00, output: 15.00 },
        description: 'Anthropic\'s most intelligent model'
      },
      'claude-opus-4': {
        tier: 'premium',
        openRouterId: 'anthropic/claude-opus-4',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        costPerMillion: { input: 15.00, output: 75.00 },
        description: 'Anthropic\'s most powerful model'
      },
      'gemini-2.5-pro': {
        tier: 'premium',
        openRouterId: 'google/gemini-2.5-pro-preview-06-05',
        name: 'Gemini 2.5 Pro',
        contextWindow: 1048576,
        costPerMillion: { input: 1.25, output: 10.00 },
        description: 'Google\'s flagship reasoning model'
      },
      'gemini-pro': {
        tier: 'premium',
        openRouterId: 'google/gemini-2.5-pro-preview-06-05',
        name: 'Gemini Pro',
        contextWindow: 1048576,
        costPerMillion: { input: 1.25, output: 10.00 },
        description: 'Google\'s advanced reasoning model'
      },
      'grok-3': {
        tier: 'premium',
        openRouterId: 'x-ai/grok-3-beta',
        name: 'Grok 3 Beta',
        contextWindow: 131072,
        costPerMillion: { input: 3.00, output: 15.00 },
        description: 'xAI\'s latest reasoning model'
      },
      'o3-mini': {
        tier: 'premium',
        openRouterId: 'openai/o3-mini',
        name: 'OpenAI o3-mini',
        contextWindow: 200000,
        costPerMillion: { input: 1.10, output: 4.40 },
        description: 'OpenAI\'s efficient reasoning model'
      },

      // ============================================
      // ULTRA PREMIUM - Cutting edge
      // ============================================
      'o1': {
        tier: 'ultra',
        openRouterId: 'openai/o1',
        name: 'OpenAI o1',
        contextWindow: 200000,
        costPerMillion: { input: 15.00, output: 60.00 },
        description: 'OpenAI\'s advanced reasoning model'
      },
      'o1-pro': {
        tier: 'ultra',
        openRouterId: 'openai/o1-pro',
        name: 'OpenAI o1 Pro',
        contextWindow: 200000,
        costPerMillion: { input: 150.00, output: 600.00 },
        description: 'OpenAI\'s most advanced reasoning'
      }
    };

    // Return config or default to free Llama
    return models[modelId] || models['llama-3.3-70b'];
  }

  /**
   * Main call method - all routes go through OpenRouter
   */
  async call(modelId, prompt, options = {}) {
    const { temperature = 0.7, maxTokens = 4096, code = '', userId } = options;
    const modelConfig = this.getModelConfig(modelId);

    // Check tier access for premium models
    if ((modelConfig.tier === 'premium' || modelConfig.tier === 'ultra') && 
        !await this.hasPremiumAccess(userId)) {
      throw new Error('Premium subscription required for this model');
    }

    // Build full prompt with code context
    const fullPrompt = code ? `${prompt}\n\nCode:\n${code}` : prompt;

    logger.info(`[OpenRouter] Calling ${modelId} -> ${modelConfig.openRouterId}`);

    return await this.callOpenRouter(modelConfig.openRouterId, fullPrompt, temperature, maxTokens);
  }

  /**
   * Call OpenRouter API - single unified method for ALL models
   */
  async callOpenRouter(model, prompt, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://hybridmind.app',
            'X-Title': 'HybridMind - Multi-Model AI Platform'
          },
          timeout: 120000 // 2 minute timeout for long responses
        }
      );

      const choice = response.data.choices?.[0];
      const usage = response.data.usage || {};

      if (!choice) {
        throw new Error('No response from model');
      }

      return {
        content: choice.message?.content || '',
        model: response.data.model || model,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        }
      };

    } catch (error) {
      // Handle rate limiting with helpful message
      if (error.response?.status === 429) {
        logger.warn(`[OpenRouter] Rate limited on ${model} - may need to wait or use different model`);
        throw new Error(`Rate limited. Try again in a moment or use a different model.`);
      }

      // Handle model not found
      if (error.response?.status === 404) {
        logger.error(`[OpenRouter] Model not found: ${model}`);
        throw new Error(`Model ${model} not available. Check model ID.`);
      }

      // Handle authentication
      if (error.response?.status === 401) {
        logger.error('[OpenRouter] Authentication failed - check API key');
        throw new Error('API authentication failed. Check your OpenRouter API key.');
      }

      // Generic error
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[OpenRouter] Error: ${errorMsg}`);
      throw new Error(`API Error: ${errorMsg}`);
    }
  }

  /**
   * Check if user has premium access
   */
  async hasPremiumAccess(userId) {
    // Allow anonymous for testing/development
    if (!userId) return true;
    
    try {
      // Check against license database
      const licenseManager = require('./licenseManager');
      return licenseManager.isPro?.() || false;
    } catch (error) {
      logger.warn('License check failed, defaulting to free tier');
      return false;
    }
  }

  /**
   * Get all available models organized by tier
   */
  getAvailableModels(isPremium = false) {
    const allModelIds = [
      // Free
      'llama-3.3-70b', 'llama-3.1-8b', 'deepseek-r1', 'deepseek-v3', 
      'qwen3-coder', 'gemini-flash', 'devstral', 'mimo-flash', 'glm-4.5-air',
      // Low cost
      'llama-4-maverick', 'llama-4-scout', 'gemini-2.0-flash',
      // Premium
      'gpt-4o', 'gpt-4-turbo', 'gpt-4.1', 'claude-sonnet-4', 'claude-opus-4',
      'gemini-2.5-pro', 'grok-3', 'o3-mini',
      // Ultra
      'o1', 'o1-pro'
    ];

    const models = allModelIds.map(id => ({
      id,
      ...this.getModelConfig(id)
    }));

    if (isPremium) {
      return models;
    }

    // Free users get free + low cost tiers
    return models.filter(m => m.tier === 'free' || m.tier === 'low');
  }

  /**
   * Get model info for display
   */
  getModelInfo(modelId) {
    return this.getModelConfig(modelId);
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(modelId, inputTokens, outputTokens) {
    const config = this.getModelConfig(modelId);
    const inputCost = (inputTokens / 1000000) * config.costPerMillion.input;
    const outputCost = (outputTokens / 1000000) * config.costPerMillion.output;
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      isFree: config.tier === 'free'
    };
  }
}

module.exports = new ModelProxy();
