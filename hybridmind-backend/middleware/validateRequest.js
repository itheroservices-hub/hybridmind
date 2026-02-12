const responseFormatter = require('../utils/responseFormatter');

/**
 * Request validation middleware
 * Simplified version - just passes through requests for now
 * Full validation can be added later using Joi or similar
 */

/**
 * Validation middleware factory
 * @param {string} schemaName - Name of the validation schema to apply
 * @returns {Function} Express middleware function
 */
function validateRequest(schemaName) {
  return (req, res, next) => {
    const body = req.body;

    // Basic validation based on schema type
    if (schemaName === 'agent') {
      if (!body.goal && !body.prompt) {
        return res.status(400).json(
          responseFormatter.error('Either goal or prompt is required', 400)
        );
      }
    }

    if (schemaName === 'run') {
      if (!body.prompt) {
        return res.status(400).json(
          responseFormatter.error('Prompt is required', 400)
        );
      }
    }

    if (schemaName === 'workflow') {
      if (!body.workflowId) {
        return res.status(400).json(
          responseFormatter.error('Workflow ID is required', 400)
        );
      }
      if (!body.code) {
        return res.status(400).json(
          responseFormatter.error('Code is required', 400)
        );
      }
    }

    if (schemaName === 'comparison') {
      if (!body.models || !Array.isArray(body.models) || body.models.length === 0) {
        return res.status(400).json(
          responseFormatter.error('Models array is required', 400)
        );
      }
      if (!body.prompt) {
        return res.status(400).json(
          responseFormatter.error('Prompt is required', 400)
        );
      }
    }

    // If validation passes, continue to next middleware
    next();
  };
}

module.exports = validateRequest;