const workflowEngine = require('../services/workflows/workflowEngine');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Agent Controller - Handles agentic workflows
 */
class AgentController {
  /**
   * Execute custom agentic workflow
   * POST /agent/execute
   */
  async execute(req, res, next) {
    try {
      const { goal, code, options = {} } = req.body;

      logger.info(`Executing agentic workflow: ${goal}`);

      const result = await workflowEngine.executeCustom({
        goal,
        code,
        options
      });

      res.json(responseFormatter.workflowResult(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute preset workflow
   * POST /agent/workflow/:workflowId
   */
  async executePreset(req, res, next) {
    try {
      const { workflowId } = req.params;
      const { code, options = {} } = req.body;

      logger.info(`Executing preset workflow: ${workflowId}`);

      const result = await workflowEngine.executePreset({
        workflowId,
        code,
        options
      });

      res.json(responseFormatter.workflowResult(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available workflow presets
   * GET /agent/workflows
   */
  async getWorkflows(req, res, next) {
    try {
      const presets = workflowEngine.getPresets();

      res.json(
        responseFormatter.success({
          workflows: presets,
          count: presets.length
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute model comparison
   * POST /agent/compare
   */
  async compare(req, res, next) {
    try {
      const { models, prompt, code, options = {} } = req.body;

      logger.info(`Comparing ${models.length} models`);

      const result = await workflowEngine.executeComparison({
        prompt,
        code,
        models,
        options
      });

      res.json(responseFormatter.comparisonResult(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute model chain
   * POST /agent/chain
   */
  async chain(req, res, next) {
    try {
      const { models, prompt, code, options = {} } = req.body;

      logger.info(`Chaining ${models.length} models`);

      const result = await workflowEngine.executeChain({
        prompt,
        code,
        models,
        options
      });

      res.json(
        responseFormatter.success(
          {
            output: result.finalOutput,
            steps: result.results
          },
          {
            duration: result.duration,
            usage: result.totalUsage
          }
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Legacy endpoint (backward compatibility)
   * POST /agent
   */
  async legacyExecute(req, res, next) {
    try {
      const { goal, code, options = {} } = req.body;

      logger.info(`Legacy agentic workflow: ${goal}`);

      const result = await workflowEngine.executeCustom({
        goal,
        code,
        options
      });

      // Legacy format: just return output
      res.json({ output: result.finalOutput });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AgentController();
