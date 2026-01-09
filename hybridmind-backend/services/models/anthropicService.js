const Anthropic = require('@anthropic-ai/sdk');
const environment = require('../../config/environment');

class AnthropicService {
  constructor() {
    this.client = new Anthropic({
      apiKey: environment.anthropicApiKey
    });
  }

  /**
   * Call Claude model with standardized interface
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier (claude-3-opus, claude-3-sonnet, claude-3-haiku)
   * @param {string} params.prompt - User prompt
   * @param {string} params.code - Code context
   * @param {number} params.temperature - Temperature setting (0-1)
   * @param {number} params.maxTokens - Max tokens to generate
   * @returns {Promise<Object>} Response with content and metadata
   */
  async call({ model = 'claude-3-sonnet-20240229', prompt, code, temperature = 0.7, maxTokens = 4096 }) {
    const fullPrompt = code 
      ? `${prompt}\n\n<code>\n${code}\n</code>`
      : prompt;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{
          role: 'user',
          content: fullPrompt
        }]
      });

      return {
        content: response.content[0].text,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        finishReason: response.stop_reason
      };
    } catch (error) {
      throw new Error(`Anthropic API Error: ${error.message}`);
    }
  }

  /**
   * Stream response from Claude (for future use)
   */
  async stream({ model = 'claude-3-sonnet-20240229', prompt, code, temperature = 0.7, maxTokens = 4096 }) {
    const fullPrompt = code 
      ? `${prompt}\n\n<code>\n${code}\n</code>`
      : prompt;

    return this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{
        role: 'user',
        content: fullPrompt
      }]
    });
  }
}

module.exports = new AnthropicService();
