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
    // OpenRouter ONLY - routes to all providers
    this.apiKeys = {
      openrouter: environment.openrouterApiKey
    };

    this.baseURLs = {
      openrouter: 'https://openrouter.ai/api/v1'
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
   * Call the appropriate provider - always routes through OpenRouter
   */
  async _callProvider(provider, model, userRequest, attempt) {
    // All requests route through OpenRouter
    return await this._callOpenRouter(model, userRequest);
  }

  /**
   * OpenRouter API call - routes to ALL providers (OpenAI, Anthropic, Groq, DeepSeek, etc.)
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
}

module.exports = new AgenticService();
