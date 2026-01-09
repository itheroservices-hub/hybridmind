/**
 * Groq AI Service
 * Provides integration with Groq's ultra-fast inference API
 */

const axios = require('axios');
const environment = require('../../config/environment');

class GroqService {
  constructor() {
    this.apiKey = environment.groqApiKey;
    this.baseURL = 'https://api.groq.com/openai/v1';
  }

  /**
   * Call Groq model
   */
  async call(params) {
    const {
      model,
      prompt,
      code,
      temperature = 0.7,
      maxTokens = 4096,
      stream = false
    } = params;

    try {
      // Build messages array
      const fullPrompt = code ? `${prompt}\n\nCode:\n${code}` : prompt;
      const messages = [{ role: 'user', content: fullPrompt }];
      
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
      throw new Error(`Groq API error: ${error.message}`);
    }
  }
}

module.exports = new GroqService();
