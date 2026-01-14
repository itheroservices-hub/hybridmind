const express = require("express");
const router = express.Router();
const agenticService = require("../services/agenticService");
const logger = require("../utils/logger");

/**
 * Execute agentic workflow with strict JSON tool calls
 * POST /agent/execute
 * 
 * Body:
 *   - prompt: User's request (required)
 *   - context: File context/code (optional)
 *   - model: Model to use (optional, default: gpt-4-turbo-preview)
 *   - provider: Provider to use (optional, default: openai)
 */
router.post("/execute", async (req, res) => {
  try {
    const { 
      prompt, 
      context = '', 
      model = 'gpt-4-turbo-preview',
      provider = 'openai'
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    logger.info(`Executing agentic workflow: ${prompt.substring(0, 50)}...`);

    // Get validated JSON tool call with retry logic
    const result = await agenticService.getValidJsonToolCall(prompt, {
      model,
      provider,
      context,
      maxRetries: 3
    });

    // Return in format expected by VS Code extension
    res.json({
      success: true,
      data: {
        steps: [
          {
            model: result.model,
            provider: result.provider,
            attempt: result.attempt,
            aiResponse: JSON.stringify(result.toolCall), // Extension will parse this
            usage: { total_tokens: 0 }, // TODO: Add actual token usage tracking
            cost: 0 // TODO: Calculate based on model pricing
          }
        ],
        toolCall: result.toolCall // Direct access to parsed tool call
      }
    });

  } catch (error) {
    logger.error('Agentic execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Legacy endpoint for backwards compatibility
 * POST /agent/
 */
router.post("/", async (req, res) => {
  const { goal, code } = req.body;

  try {
    // Map legacy format to new format
    const result = await agenticService.getValidJsonToolCall(goal, {
      context: code,
      model: 'gpt-4-turbo-preview',
      provider: 'openai',
      maxRetries: 3
    });

    // Return in legacy format
    res.json({ 
      output: result.toolCall 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;