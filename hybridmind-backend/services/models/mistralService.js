/**
 * Mistral AI Service
 * Provides integration with Mistral's models
 */

const axios = require('axios');
const environment = require('../../config/environment');

class MistralService {
  constructor() {
    this.apiKey = environment.mistralApiKey;
    this.baseURL = 'https://api.mistral.ai/v1';
  }

  /**
   * Call Mistral model
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
      throw new Error(`Mistral API error: ${error.message}`);
    }
  }
}

module.exports = new MistralService();
