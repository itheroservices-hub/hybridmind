const modelRegistry = require('./modelRegistry');
const logger = require('../../utils/logger');

/**
 * Model Factory - Creates and executes model requests
 * Provides unified interface for calling any model with retry logic and error handling
 */
class ModelFactory {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Call a model with automatic retry logic
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {string} params.prompt - User prompt
   * @param {string} params.code - Code context (optional)
   * @param {number} params.temperature - Temperature (0-1)
   * @param {number} params.maxTokens - Max tokens
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Model response
   */
  async call(params) {
    const { model, prompt, code = '', temperature = 0.7, maxTokens, options = {} } = params;

    // Get provider and config
    const provider = modelRegistry.getProvider(model);
    const config = modelRegistry.getConfig(model);

    // Use model's default maxTokens if not specified
    const effectiveMaxTokens = maxTokens || Math.min(config.maxTokens / 2, 4096);

    // Prepare request
    const request = {
      model: this.mapModelIdToApiModel(model),
      prompt,
      code,
      temperature,
      maxTokens: effectiveMaxTokens
    };

    // Execute with retry
    return this.executeWithRetry(
      () => provider.call(request),
      model,
      options.retries || this.maxRetries
    );
  }

  /**
   * Call multiple models in sequence (chaining)
   */
  async chain(params) {
    const { models, prompt, code, options = {} } = params;
    
    let currentContent = code;
    const results = [];

    for (let i = 0; i < models.length; i++) {
      const modelId = models[i];
      
      logger.info(`Chain step ${i + 1}/${models.length}: ${modelId}`);
      
      const result = await this.call({
        model: modelId,
        prompt,
        code: currentContent,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });

      results.push({
        step: i + 1,
        model: modelId,
        output: result.content,
        usage: result.usage
      });

      // Use output as input for next model
      currentContent = result.content;
    }

    return {
      finalOutput: currentContent,
      steps: results,
      totalUsage: this.aggregateUsage(results)
    };
  }

  /**
   * Call multiple models in parallel and return all results
   */
  async parallel(params) {
    const { models, prompt, code, options = {} } = params;

    const promises = models.map(modelId =>
      this.call({
        model: modelId,
        prompt,
        code,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      }).then(result => ({ model: modelId, ...result }))
    );

    const results = await Promise.all(promises);

    return {
      results,
      totalUsage: this.aggregateUsage(results)
    };
  }

  /**
   * Execute request with exponential backoff retry
   */
  async executeWithRetry(fn, model, maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          logger.info(`Model ${model} succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          logger.warn(`Model ${model} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    logger.error(`Model ${model} failed after ${maxRetries + 1} attempts`);
    throw lastError;
  }

  /**
   * Map model ID to actual API model identifier
   */
  mapModelIdToApiModel(modelId) {
    const mapping = {
      // OpenAI
      'gpt-4': 'gpt-4',
      'gpt-4-turbo': 'gpt-4-turbo-preview',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
      // Anthropic
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
      // Qwen
      'qwen-max': 'qwen-max',
      'qwen-plus': 'qwen-plus',
      // Groq (updated models - 3.1 deprecated Jan 2026)
      'llama-3.3-70b': 'llama-3.3-70b-versatile',
      'llama-3.1-70b': 'llama-3.3-70b-versatile',
      'llama-3.1-8b': 'llama-3.1-8b-instant',
      // DeepSeek
      'deepseek-chat': 'deepseek-chat',
      'deepseek-coder': 'deepseek-coder',
      // Gemini
      'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      // Mistral
      'mistral-large': 'mistral-large-latest',
      'mistral-small': 'mistral-small-latest',
      // xAI
      'grok-beta': 'grok-beta'
    };

    return mapping[modelId] || modelId;
  }

  /**
   * Aggregate usage stats from multiple results
   */
  aggregateUsage(results) {
    return results.reduce(
      (acc, result) => ({
        promptTokens: acc.promptTokens + (result.usage?.promptTokens || 0),
        completionTokens: acc.completionTokens + (result.usage?.completionTokens || 0),
        totalTokens: acc.totalTokens + (result.usage?.totalTokens || 0)
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ModelFactory();
