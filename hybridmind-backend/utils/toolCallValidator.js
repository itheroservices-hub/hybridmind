/**
 * JSON Tool Call Validation Utility
 * Validates AI-generated JSON tool calls against schema
 */

const logger = require('../utils/logger');

/**
 * Validate a tool call object against the schema
 * @param {Object|Array} obj - The tool call(s) to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateToolCall(obj) {
  // Handle single tool or array
  const tools = Array.isArray(obj) ? obj : [obj];
  const errors = [];

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') {
      errors.push('Tool must be an object');
      continue;
    }

    if (!tool.tool || typeof tool.tool !== 'string') {
      errors.push('Missing or invalid "tool" field');
      continue;
    }

    // Validate based on tool type
    switch (tool.tool) {
      case 'apply_edit':
        if (!tool.file) errors.push('apply_edit requires "file"');
        if (!tool.start || typeof tool.start.line !== 'number') {
          errors.push('apply_edit requires "start" with {line, character}');
        }
        if (!tool.end || typeof tool.end.line !== 'number') {
          errors.push('apply_edit requires "end" with {line, character}');
        }
        if (typeof tool.text !== 'string') {
          errors.push('apply_edit requires "text" string');
        }
        break;

      case 'insert_text':
        if (!tool.file) errors.push('insert_text requires "file"');
        if (!tool.position || typeof tool.position.line !== 'number') {
          errors.push('insert_text requires "position" with {line, character}');
        }
        if (typeof tool.text !== 'string') {
          errors.push('insert_text requires "text" string');
        }
        break;

      case 'create_file':
        if (!tool.path) errors.push('create_file requires "path"');
        break;

      case 'delete_file':
        if (!tool.path) errors.push('delete_file requires "path"');
        break;

      case 'batch':
        if (!Array.isArray(tool.actions)) {
          errors.push('batch requires "actions" array');
        } else {
          // Recursively validate batch actions
          for (const action of tool.actions) {
            const actionValidation = validateToolCall(action);
            if (!actionValidation.valid) {
              errors.push(...actionValidation.errors.map(e => `batch action: ${e}`));
            }
          }
        }
        break;

      case 'thought':
        if (!tool.content) errors.push('thought requires "content"');
        break;

      case 'request_clarification':
        if (!tool.question) errors.push('request_clarification requires "question"');
        break;

      default:
        errors.push(`Unknown tool type: ${tool.tool}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Clean raw AI output by removing markdown code blocks
 * @param {string} rawOutput - The raw AI response
 * @returns {string} - Cleaned JSON string
 */
function cleanJsonOutput(rawOutput) {
  let cleaned = rawOutput.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
    logger.warn('AI used code blocks despite instructions - cleaned output');
  }

  return cleaned;
}

/**
 * Parse and validate JSON tool call with retry logic
 * @param {string} rawOutput - The raw AI response
 * @param {number} attempt - Current attempt number (for logging)
 * @returns {Object} - { success: boolean, data?: Object, error?: string }
 */
function parseAndValidate(rawOutput, attempt = 1) {
  try {
    // Step 1: Clean markdown code blocks
    const cleanedOutput = cleanJsonOutput(rawOutput);

    // Step 2: Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(cleanedOutput);
    } catch (parseError) {
      logger.error(`[Attempt ${attempt}] Invalid JSON:`, parseError.message);
      logger.debug('Raw output:', rawOutput);
      return {
        success: false,
        error: `Invalid JSON syntax: ${parseError.message}`
      };
    }

    // Step 3: Validate schema
    const validation = validateToolCall(parsed);
    if (!validation.valid) {
      logger.error(`[Attempt ${attempt}] Schema validation failed:`, validation.errors);
      return {
        success: false,
        error: `Schema validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Success!
    logger.info(`[Attempt ${attempt}] Valid tool call received`);
    return {
      success: true,
      data: parsed
    };

  } catch (error) {
    logger.error(`[Attempt ${attempt}] Unexpected error:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  validateToolCall,
  cleanJsonOutput,
  parseAndValidate
};
