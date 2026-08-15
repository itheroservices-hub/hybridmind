const workflowEngine = require('../services/workflows/workflowEngine');
const agenticService = require('../services/agenticService');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Agent Controller - Handles agentic workflows with strict JSON tool calls
 */
class AgentController {
  /**
   * Execute custom agentic workflow with strict JSON mode
   * POST /agent/execute
   */
  async execute(req, res, next) {
    try {
      const { 
        goal, 
        prompt, // Alternative to goal
        code, 
        context, // Alternative to code
        options = {},
        model = 'gpt-4-turbo-preview',
        provider = 'openai'
      } = req.body;

      const userRequest = goal || prompt;
      const fileContext = code || context || '';

      if (!userRequest) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: goal or prompt'
        });
      }

      logger.info(`Executing agentic workflow: ${userRequest.substring(0, 50)}...`);

      // Use strict JSON service for tool calls
      const result = await agenticService.getValidJsonToolCall(userRequest, {
        model,
        provider,
        context: fileContext,
        maxRetries: 3
      });

      // Return in standardized format
      res.json({
        success: true,
        data: {
          steps: [
            {
              model: result.model,
              provider: result.provider,
              attempt: result.attempt,
              aiResponse: JSON.stringify(result.toolCall),
              usage: { total_tokens: 0 },
              cost: 0
            }
          ],
          toolCall: result.toolCall,
          output: result.toolCall // For legacy compatibility
        }
      });
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

      // Use strict JSON service
      const result = await agenticService.getValidJsonToolCall(goal, {
        context: code,
        model: options.model || 'gpt-4-turbo-preview',
        provider: options.provider || 'openai',
        maxRetries: 3
      });

      // Legacy format: just return output
      res.json({ output: result.toolCall });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Initialize autonomous plan
   * POST /agent/plan
   */
  async initializePlan(req, res, next) {
    try {
      const { goal, code, options = {} } = req.body;

      logger.info(`Initializing plan for: ${goal}`);

      const result = await workflowEngine.initializePlan({
        goal,
        code,
        options
      });

      res.json(responseFormatter.success({
        plan: result.plan,
        validation: result.validation,
        status: result.status
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute next step in plan
   * POST /agent/next
   */
  async executeNext(req, res, next) {
    try {
      const { code, context = {} } = req.body;

      logger.info('Executing next step');

      const result = await workflowEngine.executeNext({
        code,
        context
      });

      res.json(responseFormatter.success({
        result: result.result,
        progress: result.progress,
        completed: !result.success
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Undo last step
   * POST /agent/undo
   */
  async undo(req, res, next) {
    try {
      logger.info('Undoing last step');

      const result = await workflowEngine.undo();

      res.json(responseFormatter.success({
        success: result.success,
        message: result.message,
        restoredCode: result.restoredCode
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get execution status
   * GET /agent/status
   */
  async getStatus(req, res, next) {
    try {
      const status = await workflowEngine.getExecutionStatus();

      res.json(responseFormatter.success({
        status,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute specific step by index
   * POST /agent/step/:stepIndex
   */
  async executeStepByIndex(req, res, next) {
    try {
      const { stepIndex } = req.params;
      const { code, context = {} } = req.body;

      logger.info(`Executing step ${stepIndex}`);

      const result = await workflowEngine.executeStepByIndex({
        stepIndex: parseInt(stepIndex),
        code,
        context
      });

      res.json(responseFormatter.success({
        result,
        confirmation: result.confirmation
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AgentController();
