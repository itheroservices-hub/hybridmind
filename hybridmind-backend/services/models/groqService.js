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
   * Sleep helper for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Call Groq model with retry logic for rate limits
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

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        lastError = error;
        
        // Check if it's a rate limit error (429)
        if (error.response && error.response.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
          
          console.log(`[WARN] Groq rate limited (attempt ${attempt}/${maxRetries}), waiting ${waitTime}ms...`);
          
          if (attempt < maxRetries) {
            await this._sleep(waitTime);
            continue;
          }
        }
        
        throw new Error(`Groq API error: ${error.message}`);
      }
    }

    throw lastError;
  }
}

module.exports = new GroqService();
