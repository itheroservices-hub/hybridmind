/**
 * xAI (Grok) Service
 * Provides integration with xAI's Grok models
 */

const axios = require('axios');
const environment = require('../../config/environment');

class XAIService {
  constructor() {
    this.apiKey = environment.xaiApiKey;
    this.baseURL = 'https://api.x.ai/v1';
  }

  /**
   * Call xAI model
   */
  async call(params) {
    const {
      model,
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      stream = false
    } = params;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: environment.requestTimeout
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
        },
        finishReason: choice.finish_reason
      };
    } catch (error) {
      throw new Error(`xAI API error: ${error.message}`);
    }
  }
}

module.exports = new XAIService();
