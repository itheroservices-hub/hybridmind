const modelRegistry = require('../services/models/modelRegistry');
const modelProxy = require('../services/modelProxy');
const responseFormatter = require('../utils/responseFormatter');

/**
 * Models Controller - Provides model information
 */
class ModelsController {
  /**
   * Get all available models
   * GET /models
   */
  async getAll(req, res, next) {
    try {
      const { userId, isPremium } = req.query;
      
      // Get models from registry
      const allModels = modelRegistry.getAllModels();
      
      // Filter by tier if not premium
      const models = isPremium === 'true' 
        ? allModels 
        : allModels.filter(m => m.tier === 'free' || !m.tier);

      res.json(
        responseFormatter.success({
          models,
          count: models.length,
          tier: isPremium === 'true' ? 'premium' : 'free'
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get model by ID
   * GET /models/:modelId
   */
  async getById(req, res, next) {
    try {
      const { modelId } = req.params;
      const model = modelRegistry.getConfig(modelId);

      res.json(
        responseFormatter.success({
          id: modelId,
          ...model
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Find models by capability
   * GET /models/capability/:capability
   */
  async byCapability(req, res, next) {
    try {
      const { capability } = req.params;
      const models = modelRegistry.findByCapability(capability);

      res.json(
        responseFormatter.success({
          capability,
          models,
          count: models.length
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get best model for task
   * POST /models/recommend
   */
  async recommend(req, res, next) {
    try {
      const { task, costTier, speedRequirement } = req.body;

      const modelId = modelRegistry.getBestModelForTask(task, {
        costTier,
        speedRequirement
      });

      if (!modelId) {
        return res.status(404).json(
          responseFormatter.error('No suitable model found for task', { task, costTier, speedRequirement }, 'NOT_FOUND')
        );
      }

      const model = modelRegistry.getConfig(modelId);

      res.json(
        responseFormatter.success({
          recommended: {
            id: modelId,
            ...model
          },
          task,
          criteria: { costTier, speedRequirement }
        })
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ModelsController();
