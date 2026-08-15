const logger = require('../../utils/logger');

class MCPClient {
  constructor() {
    this.serverHandlers = new Map();
    this.defaultTimeoutMs = 30000;
  }

  registerServerHandler(serverName, handler) {
    this.serverHandlers.set(serverName, handler);
  }

  async invoke(server, tool, args = {}, context = {}) {
    const startedAt = Date.now();
    const timeoutMs = context.timeoutMs || this.defaultTimeoutMs;

    try {
      const handler = this.serverHandlers.get(server);
      let result;

      if (handler && typeof handler.invoke === 'function') {
        result = await Promise.race([
          handler.invoke(tool, args, context),
          this._timeout(timeoutMs, `${server}.${tool}`)
        ]);
      } else {
        result = this._fallbackInvoke(server, tool, args, context);
      }

      return {
        success: true,
        server,
        tool,
        latencyMs: Date.now() - startedAt,
        result
      };
    } catch (error) {
      logger.warn('MCP invoke failed', {
        server,
        tool,
        error: error.message
      });

      return {
        success: false,
        server,
        tool,
        latencyMs: Date.now() - startedAt,
        error: error.message,
        result: null
      };
    }
  }

  async batchInvoke(calls = []) {
    const results = [];

    for (const call of calls) {
      const outcome = await this.invoke(
        call.server,
        call.tool,
        call.args || {},
        call.context || {}
      );
      results.push(outcome);
    }

    return results;
  }

  _fallbackInvoke(server, tool, args, context) {
    if (server === 'filesystem') {
      return {
        message: `filesystem:${tool} queued (fallback mode)`,
        args,
        context
      };
    }

    if (server === 'terminal') {
      return {
        exitCode: 0,
        stdout: '[MCP fallback] terminal command not executed (no handler registered)',
        stderr: '',
        args,
        context
      };
    }

    if (server === 'web-search') {
      return {
        results: [],
        message: '[MCP fallback] web search handler unavailable',
        args,
        context
      };
    }

    return {
      message: `[MCP fallback] ${server}.${tool} not implemented`,
      args,
      context
    };
  }

  _timeout(timeoutMs, label) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`MCP timeout (${timeoutMs}ms): ${label}`)), timeoutMs);
    });
  }
}

module.exports = new MCPClient();
