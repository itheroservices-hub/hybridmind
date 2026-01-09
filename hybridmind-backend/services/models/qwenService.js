const axios = require('axios');
const environment = require('../../config/environment');

class QwenService {
  constructor() {
    this.baseURL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    this.apiKey = environment.qwenApiKey;
  }

  /**
   * Call Qwen model with standardized interface
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier (qwen-max, qwen-plus)
   * @param {string} params.prompt - User prompt
   * @param {string} params.code - Code context
   * @param {number} params.temperature - Temperature setting (0-1)
   * @param {number} params.maxTokens - Max tokens to generate
   * @returns {Promise<Object>} Response with content and metadata
   */
  async call({ model = 'qwen-max', prompt, code, temperature = 0.7, maxTokens = 2000 }) {
    const fullPrompt = code 
      ? `${prompt}\n\nCode:\n${code}`
      : prompt;

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model,
          input: {
            messages: [
              {
                role: 'user',
                content: fullPrompt
              }
            ]
          },
          parameters: {
            temperature,
            max_tokens: maxTokens,
            result_format: 'message'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: environment.requestTimeout
        }
      );

      const output = response.data.output;
      const usage = response.data.usage;

      return {
        content: output.choices[0].message.content,
        model: model,
        usage: {
          promptTokens: usage.input_tokens || 0,
          completionTokens: usage.output_tokens || 0,
          totalTokens: usage.total_tokens || 0
        },
        finishReason: output.choices[0].finish_reason
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`Qwen API Error: ${errorMessage}`);
    }
  }
}

module.exports = new QwenService();
