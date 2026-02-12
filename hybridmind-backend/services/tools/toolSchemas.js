/**
 * Tool Schemas - JSON schema definitions for all available tools
 * Used for validation, documentation, and declarative prompt parsing
 */

const toolSchemas = {
  // ========================================
  // Database Query Tool
  // ========================================
  databaseQuery: {
    name: 'databaseQuery',
    version: '1.0.0',
    description: 'Execute SQL queries against configured databases',
    category: 'data',
    schema: {
      type: 'object',
      required: ['database', 'query'],
      properties: {
        database: {
          type: 'string',
          description: 'Database identifier (configured in system)',
          enum: ['default', 'analytics', 'users', 'products']
        },
        query: {
          type: 'string',
          description: 'SQL query to execute',
          maxLength: 5000
        },
        parameters: {
          type: 'array',
          description: 'Query parameters for parameterized queries',
          items: { type: 'string' }
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return',
          minimum: 1,
          maximum: 1000,
          default: 100
        },
        timeout: {
          type: 'number',
          description: 'Query timeout in milliseconds',
          minimum: 100,
          maximum: 30000,
          default: 5000
        }
      }
    },
    permissions: ['read_database', 'query_database'],
    riskLevel: 'medium',
    costPerCall: 0.001,
    examples: [
      {
        description: 'Query user by email',
        input: {
          database: 'users',
          query: 'SELECT * FROM users WHERE email = ?',
          parameters: ['user@example.com'],
          limit: 1
        }
      },
      {
        description: 'Get sales analytics',
        input: {
          database: 'analytics',
          query: 'SELECT date, SUM(revenue) FROM sales GROUP BY date ORDER BY date DESC',
          limit: 30
        }
      }
    ]
  },

  // ========================================
  // Web Search Tool
  // ========================================
  webSearch: {
    name: 'webSearch',
    version: '1.0.0',
    description: 'Search the web using search APIs',
    category: 'search',
    schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
          minLength: 1,
          maxLength: 500
        },
        provider: {
          type: 'string',
          description: 'Search provider to use',
          enum: ['duckduckgo', 'brave', 'auto'],
          default: 'auto'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          minimum: 1,
          maximum: 20,
          default: 10
        },
        safesearch: {
          type: 'string',
          description: 'Safe search setting',
          enum: ['strict', 'moderate', 'off'],
          default: 'moderate'
        },
        freshness: {
          type: 'string',
          description: 'Result freshness filter',
          enum: ['day', 'week', 'month', 'year', 'all'],
          default: 'all'
        }
      }
    },
    permissions: ['web_search', 'external_api'],
    riskLevel: 'low',
    costPerCall: 0.002,
    examples: [
      {
        description: 'Search for latest AI news',
        input: {
          query: 'artificial intelligence news 2026',
          maxResults: 5,
          freshness: 'week'
        }
      },
      {
        description: 'Technical documentation search',
        input: {
          query: 'Node.js async await best practices',
          provider: 'duckduckgo',
          maxResults: 10
        }
      }
    ]
  },

  // ========================================
  // CRM Writer Tool
  // ========================================
  crmWrite: {
    name: 'crmWrite',
    version: '1.0.0',
    description: 'Write data to CRM systems',
    category: 'crm',
    schema: {
      type: 'object',
      required: ['system', 'action', 'data'],
      properties: {
        system: {
          type: 'string',
          description: 'CRM system identifier',
          enum: ['salesforce', 'hubspot', 'webhook']
        },
        action: {
          type: 'string',
          description: 'Action to perform',
          enum: ['create_contact', 'update_contact', 'create_lead', 'update_lead', 'create_deal', 'update_deal', 'create_note', 'custom']
        },
        data: {
          type: 'object',
          description: 'Data to write to CRM',
          properties: {
            // Common fields
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            company: { type: 'string' },
            phone: { type: 'string' },
            notes: { type: 'string' },
            customFields: { type: 'object' }
          }
        },
        recordId: {
          type: 'string',
          description: 'Record ID for update operations'
        },
        upsert: {
          type: 'boolean',
          description: 'Create if not exists, update if exists',
          default: false
        }
      }
    },
    permissions: ['write_crm', 'modify_contacts'],
    riskLevel: 'high',
    costPerCall: 0.005,
    examples: [
      {
        description: 'Create new lead in Salesforce',
        input: {
          system: 'salesforce',
          action: 'create_lead',
          data: {
            email: 'prospect@company.com',
            firstName: 'John',
            lastName: 'Doe',
            company: 'Acme Corp'
          }
        }
      },
      {
        description: 'Update contact in HubSpot',
        input: {
          system: 'hubspot',
          action: 'update_contact',
          recordId: 'contact-123',
          data: {
            phone: '+1-555-0123',
            customFields: { lastContacted: '2026-01-28' }
          }
        }
      }
    ]
  },

  // ========================================
  // Code Generator Tool
  // ========================================
  codeGenerate: {
    name: 'codeGenerate',
    version: '1.0.0',
    description: 'Generate code in various programming languages',
    category: 'code',
    schema: {
      type: 'object',
      required: ['language', 'description'],
      properties: {
        language: {
          type: 'string',
          description: 'Programming language',
          enum: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'sql', 'html', 'css']
        },
        description: {
          type: 'string',
          description: 'What the code should do',
          minLength: 10,
          maxLength: 2000
        },
        template: {
          type: 'string',
          description: 'Code template to use',
          enum: ['function', 'class', 'api_endpoint', 'react_component', 'test', 'cli', 'custom']
        },
        style: {
          type: 'string',
          description: 'Code style/convention',
          enum: ['standard', 'airbnb', 'google', 'microsoft', 'pep8'],
          default: 'standard'
        },
        includeComments: {
          type: 'boolean',
          description: 'Include inline comments',
          default: true
        },
        includeTests: {
          type: 'boolean',
          description: 'Generate unit tests',
          default: false
        },
        complexity: {
          type: 'string',
          description: 'Code complexity level',
          enum: ['simple', 'moderate', 'complex'],
          default: 'moderate'
        },
        context: {
          type: 'string',
          description: 'Additional context or existing code',
          maxLength: 10000
        }
      }
    },
    permissions: ['generate_code', 'ai_generation'],
    riskLevel: 'low',
    costPerCall: 0.015,
    examples: [
      {
        description: 'Generate Express.js API endpoint',
        input: {
          language: 'javascript',
          description: 'Create a POST endpoint for user registration with email validation',
          template: 'api_endpoint',
          includeComments: true
        }
      },
      {
        description: 'Generate Python data processing function',
        input: {
          language: 'python',
          description: 'Process CSV file and calculate statistics',
          template: 'function',
          style: 'pep8',
          includeTests: true
        }
      }
    ]
  },

  // ========================================
  // File Operations Tool
  // ========================================
  fileOperation: {
    name: 'fileOperation',
    version: '1.0.0',
    description: 'Perform file system operations',
    category: 'filesystem',
    schema: {
      type: 'object',
      required: ['operation', 'path'],
      properties: {
        operation: {
          type: 'string',
          description: 'File operation to perform',
          enum: ['read', 'write', 'append', 'delete', 'list', 'exists', 'stat']
        },
        path: {
          type: 'string',
          description: 'File or directory path'
        },
        content: {
          type: 'string',
          description: 'Content to write (for write/append operations)'
        },
        encoding: {
          type: 'string',
          description: 'File encoding',
          enum: ['utf8', 'ascii', 'base64'],
          default: 'utf8'
        },
        createDirs: {
          type: 'boolean',
          description: 'Create parent directories if they don\'t exist',
          default: true
        }
      }
    },
    permissions: ['read_files', 'write_files'],
    riskLevel: 'medium',
    costPerCall: 0.0001,
    examples: [
      {
        description: 'Read configuration file',
        input: {
          operation: 'read',
          path: './config/app.json'
        }
      },
      {
        description: 'Write log file',
        input: {
          operation: 'append',
          path: './logs/app.log',
          content: '[2026-01-28] Application started'
        }
      }
    ]
  },

  // ========================================
  // HTTP Request Tool
  // ========================================
  httpRequest: {
    name: 'httpRequest',
    version: '1.0.0',
    description: 'Make HTTP/HTTPS requests to external APIs',
    category: 'network',
    schema: {
      type: 'object',
      required: ['url', 'method'],
      properties: {
        url: {
          type: 'string',
          description: 'Request URL',
          format: 'uri'
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
        },
        headers: {
          type: 'object',
          description: 'Request headers'
        },
        body: {
          type: ['object', 'string'],
          description: 'Request body'
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds',
          minimum: 100,
          maximum: 30000,
          default: 10000
        },
        auth: {
          type: 'object',
          description: 'Authentication credentials',
          properties: {
            type: {
              type: 'string',
              enum: ['bearer', 'basic', 'apikey']
            },
            token: { type: 'string' }
          }
        }
      }
    },
    permissions: ['http_request', 'external_api'],
    riskLevel: 'medium',
    costPerCall: 0.001,
    examples: [
      {
        description: 'GET request to REST API',
        input: {
          url: 'https://api.example.com/users',
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      },
      {
        description: 'POST with authentication',
        input: {
          url: 'https://api.example.com/data',
          method: 'POST',
          body: { name: 'test' },
          auth: { type: 'bearer', token: 'xyz123' }
        }
      }
    ]
  }
};

/**
 * Get all tool names
 */
function getAllToolNames() {
  return Object.keys(toolSchemas);
}

/**
 * Get tool schema by name
 */
function getToolSchema(toolName) {
  return toolSchemas[toolName] || null;
}

/**
 * Get tools by category
 */
function getToolsByCategory(category) {
  return Object.entries(toolSchemas)
    .filter(([_, schema]) => schema.category === category)
    .map(([name, schema]) => ({ name, ...schema }));
}

/**
 * Get all categories
 */
function getAllCategories() {
  const categories = new Set();
  Object.values(toolSchemas).forEach(schema => categories.add(schema.category));
  return Array.from(categories);
}

/**
 * Validate tool parameters against schema
 */
function validateToolParameters(toolName, parameters) {
  const schema = toolSchemas[toolName];
  if (!schema) {
    return {
      valid: false,
      errors: [`Tool '${toolName}' not found`]
    };
  }

  const errors = [];
  const required = schema.schema.required || [];

  // Check required fields
  for (const field of required) {
    if (!(field in parameters)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type checking
  for (const [key, value] of Object.entries(parameters)) {
    const propSchema = schema.schema.properties[key];
    if (!propSchema) {
      errors.push(`Unknown parameter: ${key}`);
      continue;
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    const expectedTypes = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
    
    if (!expectedTypes.includes(actualType)) {
      errors.push(`Parameter '${key}' should be ${expectedTypes.join(' or ')}, got ${actualType}`);
    }

    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      errors.push(`Parameter '${key}' must be one of: ${propSchema.enum.join(', ')}`);
    }

    // String length validation
    if (typeof value === 'string') {
      if (propSchema.minLength && value.length < propSchema.minLength) {
        errors.push(`Parameter '${key}' must be at least ${propSchema.minLength} characters`);
      }
      if (propSchema.maxLength && value.length > propSchema.maxLength) {
        errors.push(`Parameter '${key}' must be at most ${propSchema.maxLength} characters`);
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        errors.push(`Parameter '${key}' must be at least ${propSchema.minimum}`);
      }
      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        errors.push(`Parameter '${key}' must be at most ${propSchema.maximum}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  toolSchemas,
  getAllToolNames,
  getToolSchema,
  getToolsByCategory,
  getAllCategories,
  validateToolParameters
};
