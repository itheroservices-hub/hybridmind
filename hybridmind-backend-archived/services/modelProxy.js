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
const https = require('https');
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
    const aliases = {
      'gpt-4o': 'gpt-4.1',
      'gpt-4o-mini': 'gpt-4.1',
      'openai/gpt-4o': 'gpt-4.1',
      'openai/gpt-4o-mini': 'gpt-4.1',
      'openai/gpt-4o-realtime-preview': 'gpt-4.1'
    };

    const normalizedModelId = aliases[modelId] || modelId;
    if (aliases[modelId]) {
      logger.warn(`[ModelProxy] Model '${modelId}' is deprecated; auto-mapped to '${normalizedModelId}'`);
    }

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
      },

      // ============================================
      // NEW FLAGSHIP MODELS
      // ============================================
      'gpt-codex': {
        tier: 'premium',
        openRouterId: 'openai/codex-mini-latest',
        name: 'GPT Codex Mini',
        contextWindow: 200000,
        costPerMillion: { input: 1.50, output: 6.00 },
        description: 'OpenAI Codex — optimized for software engineering'
      },
      'claude-3.5-sonnet': {
        tier: 'premium',
        openRouterId: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        costPerMillion: { input: 3.00, output: 15.00 },
        description: 'Best Claude for everyday coding — fast & smart'
      },
      'claude-opus-4.5': {
        tier: 'premium',
        openRouterId: 'anthropic/claude-opus-4-5',
        name: 'Claude Opus 4.5',
        contextWindow: 200000,
        costPerMillion: { input: 15.00, output: 75.00 },
        description: 'Anthropic\'s most intelligent model — v4.5'
      },
      'claude-sonnet-4.5': {
        tier: 'premium',
        openRouterId: 'anthropic/claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        contextWindow: 200000,
        costPerMillion: { input: 3.00, output: 15.00 },
        description: 'Anthropic\'s latest Sonnet — best balance'
      }
    };

    // Return config or default to free Llama
    return models[normalizedModelId] || models['llama-3.3-70b'];
  }

  /**
   * Main call method - all routes go through OpenRouter
   * Supports both streaming and non-streaming modes
   */
  async call(modelId, prompt, options = {}) {
    const { temperature = 0.7, maxTokens = 4096, code = '', userId, stream = false, onToken, onThinking, messages = null } = options;
    const modelConfig = this.getModelConfig(modelId);
    const userTierRaw = await this.getUserTier(userId);
    const userTier = userTierRaw === 'pro-plus' ? 'proplus' : userTierRaw;

    // Check tier access
    if (modelConfig.tier === 'ultra' && userTier !== 'proplus') {
      throw new Error('Pro Plus subscription required for ultra-tier models (o1, o1-pro)');
    }
    if (modelConfig.tier === 'premium' && userTier === 'free') {
      throw new Error('Pro or Pro Plus subscription required for premium models');
    }

    // Build full prompt with code context
    const fullPrompt = code ? `${prompt}\n\nCode:\n${code}` : prompt;

    // Build messages array: use provided history or fall back to single-turn
    let messagesArray = null;
    if (messages && messages.length > 0) {
      // If code context exists, append it to the last user message
      if (code) {
        const last = messages[messages.length - 1];
        messagesArray = [
          ...messages.slice(0, -1),
          { role: last.role, content: `${last.content}\n\nCode:\n${code}` }
        ];
      } else {
        messagesArray = messages;
      }
    }

    logger.info(`[OpenRouter] Calling ${modelId} -> ${modelConfig.openRouterId}${stream ? ' (streaming)' : ''}${messagesArray ? ` (${messagesArray.length} messages)` : ''}`);

    if (stream) {
      return await this.callOpenRouterStream(
        modelConfig.openRouterId, 
        fullPrompt, 
        temperature, 
        maxTokens,
        { onToken, onThinking, modelId, messages: messagesArray }
      );
    }

    return await this.callOpenRouter(modelConfig.openRouterId, fullPrompt, temperature, maxTokens, messagesArray);
  }

  /**
   * Call OpenRouter API - single unified method for ALL models
   */
  async callOpenRouter(model, prompt, temperature, maxTokens, messages = null) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model,
          messages: messages || [{ role: 'user', content: prompt }],
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
      // Handle rate limiting - auto-retry free models with paid version using OpenRouter credits
      if (error.response?.status === 429) {
        if (model.endsWith(':free')) {
          const paidModel = model.replace(':free', '');
          logger.info(`[OpenRouter] Free model rate-limited, retrying with paid tier: ${paidModel}`);
          try {
            return await this.callOpenRouter(paidModel, prompt, temperature, maxTokens, messages);
          } catch (retryError) {
            if (retryError.response?.status === 429) {
              throw new Error(`Rate limited. Try again in a moment or switch to a premium model.`);
            }
            throw retryError;
          }
        }
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
   * Call OpenRouter API with streaming support
   * Emits tokens and thinking/reasoning as they arrive
   */
  async callOpenRouterStream(model, prompt, temperature, maxTokens, callbacks = {}) {
    const { onToken, onThinking, modelId, messages = null } = callbacks;
    
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model,
        messages: messages || [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        stream: true
      });

      const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://hybridmind.app',
          'X-Title': 'HybridMind - Multi-Model AI Platform',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      let fullContent = '';
      let thinkingContent = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let buffer = '';

      const req = https.request(options, (res) => {
        if (res.statusCode === 429) {
          let errorBody = '';
          res.on('data', chunk => errorBody += chunk);
          res.on('end', async () => {
            // Auto-retry with paid version for free models
            if (model.endsWith(':free')) {
              const paidModel = model.replace(':free', '');
              logger.info(`[OpenRouter] Free model rate-limited (stream), retrying with paid tier: ${paidModel}`);
              try {
                const result = await this.callOpenRouterStream(paidModel, prompt, temperature, maxTokens, callbacks);
                resolve(result);
              } catch (retryErr) {
                reject(new Error(`Rate limited. Try again in a moment or switch to a premium model.`));
              }
              return;
            }
            reject(new Error(`Rate limited. Try again in a moment or use a different model.`));
          });
          return;
        }
        if (res.statusCode !== 200) {
          let errorBody = '';
          res.on('data', chunk => errorBody += chunk);
          res.on('end', () => {
            try {
              const error = JSON.parse(errorBody);
              reject(new Error(error.error?.message || `HTTP ${res.statusCode}`));
            } catch {
              reject(new Error(`HTTP ${res.statusCode}: ${errorBody}`));
            }
          });
          return;
        }

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;
            
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                resolve({
                  content: fullContent,
                  thinking: thinkingContent,
                  model: model || modelId,
                  usage
                });
                return;
              }

              try {
                const data = JSON.parse(dataStr);
                const choice = data.choices?.[0];
                
                if (!choice) continue;

                // Extract thinking/reasoning for models that support it (o1, o3, deepseek-r1)
                if (choice.delta?.reasoning) {
                  thinkingContent += choice.delta.reasoning;
                  if (onThinking) {
                    onThinking(choice.delta.reasoning, thinkingContent);
                  }
                }

                // Extract content tokens
                if (choice.delta?.content) {
                  fullContent += choice.delta.content;
                  if (onToken) {
                    onToken(choice.delta.content, fullContent);
                  }
                }

                // Extract usage if available
                if (data.usage) {
                  usage = {
                    promptTokens: data.usage.prompt_tokens || usage.promptTokens,
                    completionTokens: data.usage.completion_tokens || usage.completionTokens,
                    totalTokens: data.usage.total_tokens || usage.totalTokens
                  };
                }

                // Check finish reason
                if (choice.finish_reason) {
                  if (choice.finish_reason === 'error') {
                    reject(new Error('Model returned error finish reason'));
                    return;
                  }
                }
              } catch (parseError) {
                logger.warn(`[OpenRouter] Failed to parse SSE chunk: ${dataStr}`);
              }
            }
          }
        });

        res.on('end', () => {
          if (buffer.trim()) {
            // Process remaining buffer
            if (buffer.startsWith('data: ')) {
              const dataStr = buffer.slice(6);
              if (dataStr !== '[DONE]') {
                try {
                  const data = JSON.parse(dataStr);
                  const choice = data.choices?.[0];
                  if (choice?.delta?.content) {
                    fullContent += choice.delta.content;
                  }
                  if (choice?.delta?.reasoning) {
                    thinkingContent += choice.delta.reasoning;
                  }
                } catch (e) {
                  // Ignore parse errors on final chunk
                }
              }
            }
          }

          resolve({
            content: fullContent,
            thinking: thinkingContent,
            model: model || modelId,
            usage
          });
        });

        res.on('error', (error) => {
          reject(error);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error('Stream timeout after 2 minutes'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Check if a model supports reasoning/thinking output
   */
  supportsReasoning(modelId) {
    const reasoningModels = [
      'o1', 'o1-pro', 'o3-mini', 'o3',
      'deepseek-r1', 'deepseek/deepseek-r1',
      'claude-sonnet-4', 'claude-opus-4'
    ];
    return reasoningModels.some(m => modelId.includes(m));
  }

  /**
   * Get user's tier level
   * @param {string} userId - User ID
   * @returns {Promise<string>} 'free', 'pro', or 'proplus'
   */
  async getUserTier(userId) {
    // Allow all access for testing/development
    if (!userId) return 'proplus';
    
    try {
      // Check against license database
      const licenseManager = require('./licenseManager');
      
      if (licenseManager.isProPlus?.()) {
        return 'proplus';
      }
      if (licenseManager.isPro?.()) {
        return 'pro';
      }
      return 'free';
    } catch (error) {
      logger.warn('License check failed, defaulting to free tier');
      return 'free';
    }
  }

  /**
   * Check if user has premium access (legacy method)
   */
  async hasPremiumAccess(userId) {
    const tier = await this.getUserTier(userId);
    return tier === 'pro' || tier === 'proplus';
  }

  /**
   * Get all available models organized by tier
   * @param {string} userTier - 'free', 'pro', or 'proplus'
   * @returns {Array} Available models for the tier
   */
  getAvailableModels(userTier = 'free') {
    const allModelIds = [
      // Free tier (12 models) - $0 cost
      'llama-3.3-70b', 'llama-3.1-8b', 'deepseek-r1', 'deepseek-v3', 
      'qwen3-coder', 'gemini-flash', 'devstral', 'mimo-flash', 'glm-4.5-air',
      // Low cost tier (15 models total)
      'llama-4-maverick', 'llama-4-scout', 'gemini-2.0-flash',
      // Premium tier (23 models total)
      'gpt-4o', 'gpt-4-turbo', 'gpt-4.1', 'claude-sonnet-4', 'claude-sonnet-4.5', 'claude-opus-4',
      'gemini-2.5-pro', 'gemini-pro', 'grok-3', 'o3-mini',
      // Ultra tier (25 models total - Pro Plus only)
      'o1', 'o1-pro'
    ];

    const models = allModelIds.map(id => ({
      id,
      ...this.getModelConfig(id)
    }));

    // Pro Plus: All models including ultra tier (200+ via OpenRouter)
    if (userTier === 'proplus') {
      return models; // All curated models + access to 200+ via OpenRouter API
    }

    // Pro: Free + Low + Premium tiers (~50 models)
    if (userTier === 'pro') {
      return models.filter(m => m.tier === 'free' || m.tier === 'low' || m.tier === 'premium');
    }

    // Free: Only free + low cost tiers (12 models)
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
