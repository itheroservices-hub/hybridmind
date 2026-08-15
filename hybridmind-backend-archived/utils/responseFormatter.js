/**
 * Response formatter utility
 */

class ResponseFormatter {
  /**
   * Success response
   */
  success(data, meta = {}) {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Error response
   */
  error(message, details = null, code = 'INTERNAL_ERROR') {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Validation error response
   */
  validationError(errors) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Format workflow result
   */
  workflowResult(result) {
    return this.success(
      {
        output: result.finalOutput,
        workflow: {
          type: result.workflowId || result.goal || 'custom',
          steps: result.steps?.length || result.execution?.results?.length || 0,
          success: result.success
        }
      },
      {
        duration: result.duration,
        usage: result.totalUsage
      }
    );
  }

  /**
   * Format model result
   */
  modelResult(result) {
    return this.success(
      {
        output: result.content || result.finalOutput,
        model: result.model
      },
      {
        usage: result.usage
      }
    );
  }

  /**
   * Format comparison result
   */
  comparisonResult(result) {
    return this.success(
      {
        results: result.results.map(r => ({
          model: r.model,
          output: r.output,
          success: r.success,
          error: r.error
        }))
      },
      {
        duration: result.duration,
        usage: result.totalUsage
      }
    );
  }
}

module.exports = new ResponseFormatter();
