const modelFactory = require('../services/models/modelFactory');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Run Controller - Handles single and multi-model execution
 */
class RunController {
  /**
   * Execute single model
   * POST /run/single
   */
  async executeSingle(req, res, next) {
    try {
      const { model, prompt, code, temperature, maxTokens } = req.body;

      logger.info(`Executing single model: ${model}`);

      const result = await modelFactory.call({
        model: model || 'gpt-4',
        prompt,
        code,
        temperature,
        maxTokens
      });

      res.json(responseFormatter.modelResult(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute multi-model chain
   * POST /run/chain
   */
  async executeChain(req, res, next) {
    try {
      const { models, prompt, code, options } = req.body;

      // Normalize models to array
      const modelArray = Array.isArray(models) ? models : [models];

      logger.info(`Executing chain with ${modelArray.length} models`);

      const result = await modelFactory.chain({
        models: modelArray,
        prompt,
        code,
        options
      });

      res.json(
        responseFormatter.success(
          {
            output: result.finalOutput,
            steps: result.steps
          },
          {
            usage: result.totalUsage
          }
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute multi-model parallel (comparison)
   * POST /run/parallel
   */
  async executeParallel(req, res, next) {
    try {
      const { models, prompt, code, options } = req.body;

      logger.info(`Executing parallel with ${models.length} models`);

      const result = await modelFactory.parallel({
        models,
        prompt,
        code,
        options
      });

      res.json(responseFormatter.comparisonResult(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Legacy endpoint (backward compatibility)
   * POST /run
   */
  async execute(req, res, next) {
    try {
      const { models, model, prompt, code, temperature, maxTokens } = req.body;

      // Determine execution mode
      const modelParam = models || model;
      
      if (!modelParam) {
        return res.status(400).json(
          responseFormatter.error('Either "model" or "models" parameter is required', null, 'MISSING_PARAMETER')
        );
      }

      // Single model
      if (typeof modelParam === 'string' || (Array.isArray(modelParam) && modelParam.length === 1)) {
        const selectedModel = typeof modelParam === 'string' ? modelParam : modelParam[0];
        
        const result = await modelFactory.call({
          model: selectedModel,
          prompt,
          code,
          temperature,
          maxTokens
        });

        return res.json(responseFormatter.modelResult(result));
      }

      // Multi-model chain
      if (Array.isArray(modelParam)) {
        const result = await modelFactory.chain({
          models: modelParam,
          prompt,
          code,
          options: { temperature, maxTokens }
        });

        return res.json(
          responseFormatter.success(
            {
              output: result.finalOutput,
              steps: result.steps
            },
            {
              usage: result.totalUsage
            }
          )
        );
      }

      res.status(400).json(
        responseFormatter.error('Invalid models parameter', null, 'INVALID_PARAMETER')
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RunController();
