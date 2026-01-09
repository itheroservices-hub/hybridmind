const OpenAI = require('openai');
const environment = require('../../config/environment');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: environment.openaiApiKey
    });
  }

  /**
   * Call OpenAI model with standardized interface
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier (gpt-4, gpt-4-turbo, gpt-3.5-turbo)
   * @param {string} params.prompt - User prompt
   * @param {string} params.code - Code context
   * @param {number} params.temperature - Temperature setting (0-1)
   * @param {number} params.maxTokens - Max tokens to generate
   * @returns {Promise<Object>} Response with content and metadata
   */
  async call({ model = 'gpt-4', prompt, code, temperature = 0.7, maxTokens = 4096 }) {
    const fullPrompt = code 
      ? `${prompt}\n\nCode:\n\`\`\`\n${code}\n\`\`\``
      : prompt;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: fullPrompt }],
        temperature,
        max_tokens: maxTokens
      });

      return {
        content: response.choices[0].message.content,
        model: response.model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        finishReason: response.choices[0].finish_reason
      };
    } catch (error) {
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  }

  /**
   * Stream response from OpenAI (for future use)
   */
  async stream({ model = 'gpt-4', prompt, code, temperature = 0.7, maxTokens = 4096 }) {
    const fullPrompt = code 
      ? `${prompt}\n\nCode:\n\`\`\`\n${code}\n\`\`\``
      : prompt;

    return this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature,
      max_tokens: maxTokens,
      stream: true
    });
  }
}

module.exports = new OpenAIService();
