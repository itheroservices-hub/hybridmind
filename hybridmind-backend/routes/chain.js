const express = require('express');
const router = express.Router();
const modelFactory = require('../services/models/modelFactory');

/**
 * POST /models/chain
 * Chain multiple models - output of one becomes input of next
 * Body: { models: ['model1', 'model2'], prompt, code }
 */
router.post('/', async (req, res) => {
  try {
    const { models, prompt, code } = req.body;

    if (!models || !Array.isArray(models) || models.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'models array is required' }
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'prompt is required' }
      });
    }

    // Use modelFactory's chain method
    const result = await modelFactory.chain({
      models,
      prompt,
      code: code || '',
      options: {}
    });

    // Format results for extension
    const formattedSteps = result.steps.map(step => ({
      model: step.model,
      step: step.step,
      prompt: step.step === 1 ? prompt : `Based on the previous model's output, ${prompt}`,
      output: step.output
    }));

    res.json({
      success: true,
      data: {
        chain: formattedSteps,
        finalOutput: result.finalOutput,
        modelsUsed: models,
        usage: result.totalUsage
      }
    });

  } catch (error) {
    console.error('Chain execution error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message,
        details: error.stack
      }
    });
  }
});

module.exports = router;
