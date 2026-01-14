/**
 * Agentic Service - Handles AI model calls for autonomous coding workflows
 * Supports OpenAI, Groq, DeepSeek, OpenRouter, and Anthropic
 * Enforces strict JSON output with validation and retry logic
 */

const axios = require('axios');
const environment = require('../config/environment');
const { STRICT_JSON_SYSTEM_PROMPT } = require('../config/agenticPrompts');
const { parseAndValidate } = require('../utils/toolCallValidator');
const logger = require('../utils/logger');

class AgenticService {
  constructor() {
    this.apiKeys = {
      openai: environment.openaiApiKey,
      groq: environment.groqApiKey,
      deepseek: environment.deepseekApiKey,
      openrouter: environment.openrouterApiKey,
      anthropic: environment.anthropicApiKey
    };

    this.baseURLs = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      deepseek: 'https://api.deepseek.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      anthropic: 'https://api.anthropic.com/v1'
    };
  }

  /**
   * Get validated JSON tool call with retry logic
   * @param {string} userRequest - The user's request
   * @param {Object} options - { model, provider, context, maxRetries }
   * @returns {Promise<Object>} - The validated tool call
   */
  async getValidJsonToolCall(userRequest, options = {}) {
    const {
      model = 'gpt-4-turbo-preview',
      provider = 'openai',
      context = '',
      maxRetries = 3
    } = options;

    let currentRequest = this._buildContextualRequest(userRequest, context);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[Attempt ${attempt}/${maxRetries}] Calling ${provider} with model ${model}`);

        // Make API call
        const rawOutput = await this._callProvider(provider, model, currentRequest, attempt);

        // Validate and parse
        const result = parseAndValidate(rawOutput, attempt);

        if (result.success) {
          return {
            toolCall: result.data,
            attempt: attempt,
            model: model,
            provider: provider
          };
        }

        // If validation failed and we have retries left, modify request
        if (attempt < maxRetries) {
          logger.warn(`[Attempt ${attempt}] Validation failed, retrying with stronger instructions`);
          currentRequest = this._buildRetryRequest(userRequest, result.error);
        } else {
          throw new Error(`Failed to get valid JSON after ${maxRetries} attempts: ${result.error}`);
        }

      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Agentic call failed after ${maxRetries} attempts: ${error.message}`);
        }
        logger.warn(`[Attempt ${attempt}] Error: ${error.message}, retrying...`);
      }
    }
  }

  /**
   * Build the full contextual request
   */
  _buildContextualRequest(userRequest, context) {
    if (!context) {
      return userRequest;
    }

    return `Context:
${context}

User Request:
${userRequest}

Remember: Output ONLY valid JSON using the available tools.`;
  }

  /**
   * Build a retry request with error feedback
   */
  _buildRetryRequest(originalRequest, error) {
    return `CRITICAL: Previous response was invalid. Error: ${error}
Output ONLY valid JSON matching the tool schema.

Original request: ${originalRequest}`;
  }

  /**
   * Call the appropriate provider
   */
  async _callProvider(provider, model, userRequest, attempt) {
    switch (provider) {
      case 'openai':
        return await this._callOpenAI(model, userRequest);
      case 'groq':
        return await this._callGroq(model, userRequest);
      case 'deepseek':
        return await this._callDeepSeek(model, userRequest);
      case 'openrouter':
        return await this._callOpenRouter(model, userRequest);
      case 'anthropic':
        return await this._callAnthropic(model, userRequest);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * OpenAI API call (GPT-4, GPT-3.5)
   */
  async _callOpenAI(model, userRequest) {
    const response = await axios.post(
      `${this.baseURLs.openai}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: STRICT_JSON_SYSTEM_PROMPT },
          { role: 'user', content: userRequest }
        ],
        response_format: { type: 'json_object' }, // Force JSON mode
        temperature: 0.2,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.openai}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Groq API call (Llama, Mixtral)
   */
  async _callGroq(model, userRequest) {
    const response = await axios.post(
      `${this.baseURLs.groq}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: STRICT_JSON_SYSTEM_PROMPT },
          { role: 'user', content: userRequest }
        ],
        response_format: { type: 'json_object' }, // Groq supports JSON mode
        temperature: 0.1,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.groq}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * DeepSeek API call
   */
  async _callDeepSeek(model, userRequest) {
    const response = await axios.post(
      `${this.baseURLs.deepseek}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: STRICT_JSON_SYSTEM_PROMPT },
          { role: 'user', content: userRequest }
        ],
        temperature: 0.3,
        max_tokens: 2000
        // Note: DeepSeek may not support response_format yet
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.deepseek}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * OpenRouter API call (Multi-Provider)
   */
  async _callOpenRouter(model, userRequest) {
    const response = await axios.post(
      `${this.baseURLs.openrouter}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: STRICT_JSON_SYSTEM_PROMPT },
          { role: 'user', content: userRequest }
        ],
        temperature: 0.2,
        max_tokens: 2000
        // response_format support varies by model
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.openrouter}`,
          'HTTP-Referer': environment.appUrl || 'https://hybridmind.app',
          'X-Title': 'HybridMind Agentic Extension',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Anthropic API call (Claude)
   */
  async _callAnthropic(model, userRequest) {
    const response = await axios.post(
      `${this.baseURLs.anthropic}/messages`,
      {
        model: model,
        max_tokens: 2000,
        temperature: 0.2,
        system: STRICT_JSON_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userRequest }
        ]
      },
      {
        headers: {
          'x-api-key': this.apiKeys.anthropic,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.content[0].text;
  }
}

module.exports = new AgenticService();
