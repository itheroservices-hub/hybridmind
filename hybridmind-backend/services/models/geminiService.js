/**
 * Google Gemini Service
 * Provides integration with Google's Gemini models
 */

const axios = require('axios');
const environment = require('../../config/environment');

class GeminiService {
  constructor() {
    this.apiKey = environment.geminiApiKey;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Convert messages to Gemini format
   */
  convertMessages(messages) {
    const contents = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini doesn't have a system role, prepend to first user message
        continue;
      }
      
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    
    // Add system message to first user message if exists
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
    }
    
    return contents;
  }

  /**
   * Call Gemini model
   */
  async call(params) {
    const {
      model,
      prompt,
      code,
      temperature = 0.7,
      maxTokens = 4096
    } = params;

    try {
      // Build the full prompt
      const fullPrompt = code ? `${prompt}\n\nCode:\n${code}` : prompt;
      
      const response = await axios.post(
        `${this.baseURL}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: environment.requestTimeout
        }
      );

      const candidate = response.data.candidates[0];
      const content = candidate.content.parts[0].text;
      
      return {
        content,
        model,
        usage: {
          promptTokens: response.data.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.data.usageMetadata?.totalTokenCount || 0
        },
        finishReason: candidate.finishReason
      };
    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();
