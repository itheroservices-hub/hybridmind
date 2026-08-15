const logger = require('../../utils/logger');

class SelfHealingLoop {
  constructor({ mcpClient, maxAttempts = 3 }) {
    this.mcpClient = mcpClient;
    this.maxAttempts = maxAttempts;
  }

  async executeWithRecovery({
    projectId,
    runCommand,
    codeContext,
    memoryContext = {},
    chainId,
    onTelemetry,
    abortSignal,
    testerAgent,
    coderAgent
  }) {
    const attempts = [];
    const telemetryStream = [];
    let currentCode = codeContext || '';
    let previousErrorType = null;

    const emitTelemetry = (entry) => {
      const payload = {
        agent: 'Ralph',
        timestamp: new Date().toISOString(),
        ...entry
      };
      telemetryStream.push(payload);

      if (typeof onTelemetry === 'function') {
        try {
          onTelemetry(payload);
        } catch (error) {
          logger.warn(`Self-healing telemetry callback failed: ${error.message}`);
        }
      }
    };

    const throwIfAborted = (attempt = 0) => {
      if (!abortSignal?.aborted) return;

      emitTelemetry({
        attempt,
        status: 'red',
        message: 'Kill switch engaged. Ralph loop stopped by user.'
      });

      const abortError = new Error('Ralph loop aborted by user');
      abortError.code = 'ABORT_ERR';
      throw abortError;
    };

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      throwIfAborted(attempt);
      const phaseText = attempt === 1 ? 'Wrote code' : 'Refactoring logic';
      const testResult = await this._runTests({ runCommand, chainId, attempt });
      throwIfAborted(attempt);
      const errorType = this._extractTerminalErrorType(testResult.errorSummary);

      if (testResult.passed) {
        emitTelemetry({
          attempt,
          status: 'green',
          message: previousErrorType === 'ReferenceError'
            ? `Fixed reference. Tests Passed.`
            : `Tests Passed.`
        });

        return {
          success: true,
          finalCode: currentCode,
          attempts,
          telemetryStream,
          resolvedOnAttempt: attempt,
          message: 'Self-healing completed successfully'
        };
      }

      emitTelemetry({
        attempt,
        status: attempt === 1 ? 'green' : 'yellow',
        message: `Attempt ${attempt}: ${phaseText}. Terminal error: ${errorType}.`
      });
      previousErrorType = errorType;

      const diagnosis = testerAgent && typeof testerAgent.diagnoseFailure === 'function'
        ? await testerAgent.diagnoseFailure({
            testOutput: testResult.output,
            errorSummary: testResult.errorSummary,
            projectId,
            memoryContext
          })
        : this._defaultDiagnosis(testResult);
      throwIfAborted(attempt);

      const refactorResult = coderAgent && typeof coderAgent.refactorFix === 'function'
        ? await coderAgent.refactorFix({
            code: currentCode,
            diagnosis,
            memoryContext,
            constraints: {
              preserveBehavior: true,
              minimalDiff: true,
              productionSafe: true
            }
          })
        : this._defaultRefactor(currentCode, diagnosis, attempt);
      throwIfAborted(attempt);

      currentCode = refactorResult.updatedCode;
      attempts.push({
        attempt,
        testFailed: true,
        errorSummary: testResult.errorSummary,
        diagnosis,
        patchSummary: refactorResult.summary
      });

      logger.warn('Self-healing attempt applied', {
        chainId,
        attempt,
        errorSummary: testResult.errorSummary
      });
    }

    return {
      success: false,
      requiresUserIntervention: true,
      finalCode: currentCode,
      attempts,
      telemetryStream,
      message: 'Auto-healing limit reached (3 attempts). User review required.'
    };
  }

  async _runTests({ runCommand, chainId, attempt }) {
    const result = await this.mcpClient.invoke(
      'terminal',
      'runCommand',
      {
        command: runCommand || 'npm test',
        timeoutMs: 120000,
        captureStdout: true,
        captureStderr: true
      },
      { chainId, attempt }
    );

    const terminalResult = result.result || {};
    const exitCode = typeof terminalResult.exitCode === 'number' ? terminalResult.exitCode : (result.success ? 0 : 1);

    return {
      passed: exitCode === 0,
      output: `${terminalResult.stdout || ''}\n${terminalResult.stderr || ''}`.trim(),
      errorSummary: this._extractErrorSummary(terminalResult, result.error)
    };
  }

  _extractErrorSummary(result = {}, fallbackError = '') {
    if (typeof result.exitCode === 'number' && result.exitCode === 0) {
      return null;
    }

    const stderr = (result.stderr || '').split('\n').slice(0, 15).join('\n');
    const stdoutTail = (result.stdout || '').split('\n').slice(-10).join('\n');
    return (stderr || stdoutTail || fallbackError || 'Unknown test failure').trim();
  }

  _extractTerminalErrorType(errorSummary = '') {
    const text = String(errorSummary || '');
    const knownErrors = [
      'SyntaxError',
      'ReferenceError',
      'TypeError',
      'RangeError',
      'ModuleNotFoundError',
      'AssertionError',
      'NameError'
    ];

    for (const errorType of knownErrors) {
      if (text.includes(errorType)) {
        return errorType;
      }
    }

    return 'RuntimeError';
  }

  _defaultDiagnosis(testResult) {
    return {
      issueType: 'test-failure',
      summary: testResult.errorSummary || 'Test suite failed',
      recommendation: 'Apply minimal fix and re-run tests'
    };
  }

  _defaultRefactor(code, diagnosis, attempt) {
    return {
      updatedCode: code,
      summary: `Attempt ${attempt}: no-op fallback refactor (${diagnosis.summary || 'unknown failure'})`
    };
  }
}

module.exports = { SelfHealingLoop };
