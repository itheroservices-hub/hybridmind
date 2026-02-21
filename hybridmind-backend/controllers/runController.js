const modelFactory = require('../services/models/modelFactory');
const modelProxy = require('../services/modelProxy');
const chainOrchestrator = require('../services/orchestration/chainOrchestrator');
const mcpApprovalStore = require('../services/mcp/mcpApprovalStore');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

const ACTIVE_RALPH_STREAMS = new Map();

/**
 * Run Controller - Handles single and multi-model execution
 */
class RunController {
  _buildRalphChainConfig(modelArray = [], req = {}, options = {}) {
    const fallbackModel = modelArray[0] || 'llama-3.3-70b';
    const roleModels = {
      coder: modelArray[0] || fallbackModel,
      tester: modelArray[1] || fallbackModel,
      reviewer: modelArray[2] || fallbackModel
    };

    return {
      mode: 'manual',
      chainType: 'self-healing',
      models: roleModels,
      tier: req.user?.tier || 'free',
      workspacePath: options?.workspacePath,
      targetFile: options?.targetFile,
      searchQuery: options?.searchQuery,
      testCommand: options?.testCommand || 'npm test',
      metadata: {
        memoryTags: options?.memoryTags || [],
        selfHealing: true
      }
    };
  }

  /**
   * Execute single model
   * POST /run/single
   */
  async executeSingle(req, res, next) {
    try {
      const { model, prompt, code, temperature, maxTokens, userId } = req.body;

      logger.info(`Executing single model: ${model}`);

      // Route through model proxy (uses YOUR API keys)
      const result = await modelProxy.call(model || 'llama-3.3-70b', prompt, {
        code,
        temperature,
        maxTokens,
        userId
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

      const enableRalphLoop = Boolean(options?.ralphLoop);

      if (enableRalphLoop) {
        const orchestrated = await chainOrchestrator.executeChain({
          task: prompt || 'Run Ralph self-healing loop',
          ...this._buildRalphChainConfig(modelArray, req, options)
        });

        const resultMap = orchestrated.results || {};
        const orderedSteps = ['coder', 'tester', 'reviewer']
          .map(role => resultMap[role])
          .filter(Boolean);

        const finalOutput = resultMap.selfHealing?.finalCode
          || resultMap.healedOutput
          || resultMap.reviewer?.output
          || resultMap.coder?.output
          || '';

        return res.json(
          responseFormatter.success(
            {
              output: finalOutput,
              steps: orderedSteps,
              ralphTelemetry: resultMap.selfHealing?.telemetryStream || orchestrated.selfHealingTelemetry || [],
              selfHealing: resultMap.selfHealing || null
            },
            {
              usage: null,
              chainId: orchestrated.chainId,
              duration: orchestrated.duration
            }
          )
        );
      }

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
   * Execute chain via SSE with live Ralph telemetry streaming
   * POST /run/chain/stream
   */
  async executeChainStream(req, res, next) {
    let streamId = null;

    try {
      const { models, prompt, code, options } = req.body;
      const modelArray = Array.isArray(models) ? models : [models].filter(Boolean);

      streamId = `ralph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const chainId = `chain_${streamId}`;
      const projectId = options?.projectId || `project-${chainId}`;

      const abortController = new AbortController();
      ACTIVE_RALPH_STREAMS.set(streamId, {
        streamId,
        chainId,
        projectId,
        abortController,
        createdAt: Date.now()
      });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      const sendEvent = (eventName, payload) => {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      sendEvent('connected', {
        streamId,
        chainId,
        killEndpoint: `/run/chain/kill/${streamId}`
      });

      req.on('close', () => {
        if (ACTIVE_RALPH_STREAMS.has(streamId)) {
          const stream = ACTIVE_RALPH_STREAMS.get(streamId);
          stream?.abortController?.abort();
        }
      });

      const orchestrated = await chainOrchestrator.executeChain({
        chainId,
        task: prompt || code || 'Run Ralph self-healing loop',
        ...this._buildRalphChainConfig(modelArray, req, options),
        abortSignal: abortController.signal,
        stream: true, // Enable streaming for real-time telemetry
        onSelfHealingTelemetry: (event) => {
          sendEvent('telemetry', {
            streamId,
            chainId,
            ...event
          });
        },
        onModelTelemetry: (telemetry) => {
          // Emit model streaming telemetry (tokens, thinking) as it happens
          sendEvent('model-telemetry', {
            streamId,
            chainId,
            ...telemetry
          });
        }
      });

      sendEvent('done', {
        streamId,
        chainId,
        success: orchestrated.success,
        duration: orchestrated.duration,
        result: {
          selfHealing: orchestrated.results?.selfHealing || null,
          output: orchestrated.results?.selfHealing?.finalCode || orchestrated.results?.reviewer?.output || ''
        }
      });

      ACTIVE_RALPH_STREAMS.delete(streamId);
      res.end();
    } catch (error) {
      if (streamId && ACTIVE_RALPH_STREAMS.has(streamId)) {
        ACTIVE_RALPH_STREAMS.delete(streamId);
      }

      if (res.writableEnded) {
        return;
      }

      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * Kill an active Ralph streaming chain execution
   * POST /run/chain/kill/:streamId
   */
  async killChainStream(req, res, next) {
    try {
      const { streamId } = req.params;
      const active = ACTIVE_RALPH_STREAMS.get(streamId);

      if (!active) {
        return res.status(404).json({
          success: false,
          error: `Stream '${streamId}' not found or already completed`
        });
      }

      active.abortController.abort();
      chainOrchestrator.stopChain(active.chainId);

      const cleanup = mcpApprovalStore.cleanupPendingByProject(
        active.projectId,
        'Cancelled via kill switch',
        'kill-switch'
      );

      ACTIVE_RALPH_STREAMS.delete(streamId);

      res.json({
        success: true,
        streamId,
        chainId: active.chainId,
        cleanedApprovalTickets: cleanup
      });
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
   * Execute all-to-all mesh workflow (Pro+ only)
   * POST /run/all-to-all
   */
  async executeAllToAll(req, res, next) {
    try {
      const { models, prompt, code, options = {} } = req.body;

      logger.info(`Executing all-to-all mesh with ${models.length} models`);

      const workflowEngine = require('../services/workflows/workflowEngine');
      
      const result = await workflowEngine.executeAllToAll({
        prompt,
        code,
        models,
        options
      });

      res.json(
        responseFormatter.success(
          {
            mode: 'all-to-all',
            output: result.finalOutput,
            iterations: result.iterations,
            modelStates: result.modelStates,
            synthesis: result.synthesis,
            results: result.results
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
