/**
 * Model Proxy Service
 * Routes ALL requests through YOUR API keys
 * Free tier: Groq (free) + Gemini Flash (free) + DeepSeek (cheap)
 * Premium tier: Claude Sonnet 4.5, GPT-4o, GPT-4 Turbo, Gemini Pro
 */

const axios = require('axios');
const environment = require('../config/environment');
const logger = require('../utils/logger');

class ModelProxy {
  constructor() {
    this.apiKeys = {
      groq: environment.groqApiKey,
      gemini: environment.geminiApiKey,
      deepseek: environment.deepseekApiKey,
      openai: environment.openaiApiKey,
      anthropic: environment.anthropicApiKey
    };

    this.baseURLs = {
      groq: 'https://api.groq.com/openai/v1',
      deepseek: 'https://api.deepseek.com/v1',
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta'
    };
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId) {
    const models = {
      // FREE TIER - Your keys, no cost or super cheap
      'llama-3.3-70b': {
        tier: 'free',
        provider: 'groq',
        apiModel: 'llama-3.3-70b-versatile',
        contextWindow: 32768,
        cost: 0
      },
      'mixtral-8x7b': {
        tier: 'free',
        provider: 'groq',
        apiModel: 'mixtral-8x7b-32768',
        contextWindow: 32768,
        cost: 0
      },
      'gemini-flash': {
        tier: 'free',
        provider: 'gemini',
        apiModel: 'gemini-2.0-flash-exp',
        contextWindow: 32768,
        cost: 0
      },
      'deepseek-v3': {
        tier: 'free',
        provider: 'deepseek',
        apiModel: 'deepseek-chat',
        contextWindow: 32768,
        cost: 0.00014
      },

      // PREMIUM TIER - Expensive models
      'claude-sonnet-4.5': {
        tier: 'premium',
        provider: 'anthropic',
        apiModel: 'claude-sonnet-4-20250514',
        contextWindow: 131072,
        cost: 0.003
      },
      'gpt-4o': {
        tier: 'premium',
        provider: 'openai',
        apiModel: 'gpt-4o',
        contextWindow: 131072,
        cost: 0.0025
      },
      'gpt-4-turbo': {
        tier: 'premium',
        provider: 'openai',
        apiModel: 'gpt-4-turbo',
        contextWindow: 131072,
        cost: 0.001
      },
      'gemini-pro': {
        tier: 'premium',
        provider: 'gemini',
        apiModel: 'gemini-2.0-flash-thinking-exp',
        contextWindow: 131072,
        cost: 0
      }
    };

    return models[modelId] || models['llama-3.3-70b'];
  }

  /**
   * Main call method - routes to appropriate provider
   */
  async call(modelId, prompt, options = {}) {
    const { temperature = 0.7, maxTokens = 4096, code = '', userId } = options;
    const modelConfig = this.getModelConfig(modelId);

    // Check tier access
    if (modelConfig.tier === 'premium' && !await this.hasPremiumAccess(userId)) {
      throw new Error('Premium subscription required for this model');
    }

    // Build full prompt with code context
    const fullPrompt = code ? `${prompt}\n\nCode:\n${code}` : prompt;

    logger.info(`Calling ${modelId} (${modelConfig.provider}) for user ${userId || 'anonymous'}`);

    // Route to provider
    switch (modelConfig.provider) {
      case 'groq':
        return await this.callGroq(modelConfig.apiModel, fullPrompt, temperature, maxTokens);
      case 'gemini':
        return await this.callGemini(modelConfig.apiModel, fullPrompt, temperature, maxTokens);
      case 'deepseek':
        return await this.callDeepSeek(fullPrompt, temperature, maxTokens);
      case 'openai':
        return await this.callOpenAI(modelConfig.apiModel, fullPrompt, temperature, maxTokens);
      case 'anthropic':
        return await this.callClaude(modelConfig.apiModel, fullPrompt, temperature, maxTokens);
      default:
        throw new Error(`Unknown provider: ${modelConfig.provider}`);
    }
  }

  /**
   * Call Groq models (FREE)
   */
  async callGroq(model, prompt, temperature, maxTokens) {
    const response = await axios.post(
      `${this.baseURLs.groq}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.groq}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const choice = response.data.choices[0];
    return {
      content: choice.message.content,
      model: response.data.model,
      usage: {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens
      }
    };
  }

  /**
   * Call DeepSeek models (NEARLY FREE)
   */
  async callDeepSeek(prompt, temperature, maxTokens) {
    const response = await axios.post(
      `${this.baseURLs.deepseek}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.deepseek}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const choice = response.data.choices[0];
    return {
      content: choice.message.content,
      model: response.data.model,
      usage: {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens
      }
    };
  }

  /**
   * Call Gemini models (FREE tier available)
   */
  async callGemini(model, prompt, temperature, maxTokens) {
    const response = await axios.post(
      `${this.baseURLs.gemini}/models/${model}:generateContent?key=${this.apiKeys.gemini}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const candidate = response.data.candidates[0];
    const usage = response.data.usageMetadata || {};

    return {
      content: candidate.content.parts[0].text,
      model,
      usage: {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      }
    };
  }

  /**
   * Call OpenAI models (PREMIUM)
   */
  async callOpenAI(model, prompt, temperature, maxTokens) {
    const response = await axios.post(
      `${this.baseURLs.openai}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.openai}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const choice = response.data.choices[0];
    return {
      content: choice.message.content,
      model: response.data.model,
      usage: {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens
      }
    };
  }

  /**
   * Call Claude models (PREMIUM)
   */
  async callClaude(model, prompt, temperature, maxTokens) {
    const response = await axios.post(
      `${this.baseURLs.anthropic}/messages`,
      {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': this.apiKeys.anthropic,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.content[0].text,
      model: response.data.model,
      usage: {
        promptTokens: response.data.usage.input_tokens,
        completionTokens: response.data.usage.output_tokens,
        totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
      }
    };
  }

  /**
   * Check if user has premium access
   */
  async hasPremiumAccess(userId) {
    // TODO: Implement proper license checking
    // For now, check environment or assume all users have access for testing
    if (!userId) return true; // Allow anonymous for testing
    
    // Check against license database
    try {
      const licenseManager = require('./licenseManager');
      return licenseManager.isPro();
    } catch (error) {
      logger.warn('License check failed, defaulting to free tier');
      return false;
    }
  }

  /**
   * Get available models for tier
   */
  getAvailableModels(isPremium = false) {
    const allModels = Object.keys(this.getModelConfig('dummy')).map(id => ({
      id,
      ...this.getModelConfig(id)
    }));

    return isPremium 
      ? allModels 
      : allModels.filter(m => m.tier === 'free');
  }
}

module.exports = new ModelProxy();
