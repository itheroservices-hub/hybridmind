const responseFormatter = require('../utils/responseFormatter');

/**
 * Request validation schemas
 */
const schemas = {
  run: {
    models: {
      required: false,
      type: ['string', 'array'],
      validate: (value) => {
        if (typeof value === 'string') return true;
        if (Array.isArray(value)) {
          return value.length > 0 && value.every(m => typeof m === 'string');
        }
        return false;
      }
    },
    model: {
      required: false,
      type: 'string'
    },
    prompt: {
      required: true,
      type: 'string',
      minLength: 1
    },
    code: {
      required: false,
      type: 'string',
      default: ''
    },
    temperature: {
      required: false,
      type: 'number',
      min: 0,
      max: 1
    }
  },

  agent: {
    goal: {
      required: true,
      type: 'string',
      minLength: 1
    },
    code: {
      required: false,
      type: 'string',
      default: ''
    },
    options: {
      required: false,
      type: 'object'
    }
  },

  workflow: {
    workflowId: {
      required: true,
      type: 'string',
      minLength: 1
    },
    code: {
      required: true,
      type: 'string',
      minLength: 1
    },
    options: {
      required: false,
      type: 'object'
    }
  },

  comparison: {
    models: {
      required: true,
      type: 'array',
      validate: (value) => {
        return Array.isArray(value) && value.length >= 1 && value.every(m => typeof m === 'string');
      }
    },
    prompt: {
      required: true,
      type: 'string',
      minLength: 1
    },
    code: {
      required: false,
      type: 'string',
      default: ''
    }
  }
};

/**
 * Validate request body against schema
 */
function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const errors = [];
    const body = req.body;

    // Validate each field
    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      // Required check
      if (rules.required && (value === undefined || value === null)) {
        errors.push({
          field,
          message: `${field} is required`
        });
        continue;
      }

      // Skip further validation if optional and not provided
      if (!rules.required && (value === undefined || value === null)) {
        // Set default if provided
        if (rules.default !== undefined) {
          body[field] = rules.default;
        }
        continue;
      }

      // Type check
      if (rules.type) {
        const types = Array.isArray(rules.type) ? rules.type : [rules.type];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (!types.includes(actualType)) {
          errors.push({
            field,
            message: `${field} must be of type ${types.join(' or ')}`
          });
          continue;
        }
      }

      // String validation
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push({
            field,
            message: `${field} must be at least ${rules.minLength} characters`
          });
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({
            field,
            message: `${field} must be at most ${rules.maxLength} characters`
          });
        }
      }

      // Number validation
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push({
            field,
            message: `${field} must be at least ${rules.min}`
          });
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push({
            field,
            message: `${field} must be at most ${rules.max}`
          });
        }
      }

      // Custom validation
      if (rules.validate && !rules.validate(value)) {
        errors.push({
          field,
          message: `${field} validation failed`
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json(responseFormatter.validationError(errors));
    }

    next();
  };
}

module.exports = validateRequest;
