/**
 * Database Query Tool - Execute SQL queries against configured databases
 * Enhanced with security monitoring and validation
 */

const logger = require('../../utils/logger');
const { securityMonitor, inputOutputSanitizer } = require('../security');

class DatabaseTool {
  constructor() {
    // Database connections (configured via environment)
    this.connections = new Map();
    this.supportedDatabases = ['default', 'analytics', 'users', 'products'];
  }

  /**
   * Configure database connection
   * @param {string} name - Database identifier
   * @param {Object} config - Database configuration
   */
  configure(name, config) {
    if (!this.supportedDatabases.includes(name)) {
      throw new Error(`Unsupported database: ${name}`);
    }

    this.connections.set(name, {
      type: config.type || 'postgresql',
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl || false,
      poolSize: config.poolSize || 10,
      configured: true
    });

    logger.info(`Database '${name}' configured: ${config.type} at ${config.host}`);
  }

  /**
   * Execute query
   * @param {Object} params
   * @param {string} params.database - Database identifier
   * @param {string} params.query - SQL query
   * @param {Array} params.parameters - Query parameters
   * @param {number} params.limit - Result limit
   * @param {number} params.timeout - Query timeout
   * @param {string} params.userId - User ID for security monitoring
   * @param {string} params.tier - User tier
   * @returns {Promise<Object>} Query result
   */
  async execute({ database, query, parameters = [], limit = 100, timeout = 5000, userId = 'system', tier = 'free' }) {
    const startTime = Date.now();

    try {
      // Security monitoring
      const monitorResult = await securityMonitor.monitor({
        userId,
        tier,
        type: 'code',
        content: query,
        metadata: { database, type: 'sql' }
      });

      if (monitorResult.blocked) {
        logger.warn(`Query blocked for user ${userId}: ${monitorResult.message}`);
        return {
          success: false,
          error: `Security threat detected: ${monitorResult.message}`,
          executionTime: Date.now() - startTime
        };
      }

      // Input sanitization
      const sanitizationResult = inputOutputSanitizer.sanitizeInput({
        code: query,
        language: 'sql',
        allowDangerous: false
      });

      if (!sanitizationResult.safe) {
        logger.warn(`Dangerous query patterns detected: ${sanitizationResult.message}`);
        return {
          success: false,
          error: sanitizationResult.message,
          violations: sanitizationResult.violations,
          executionTime: Date.now() - startTime
        };
      }

      // Validate database exists
      if (!this.connections.has(database)) {
        return {
          success: false,
          error: `Database '${database}' not configured`,
          executionTime: Date.now() - startTime
        };
      }

      const config = this.connections.get(database);

      // Security: Check for dangerous operations (enhanced)
      const dangerousPatterns = [
        /drop\s+table/i,
        /drop\s+database/i,
        /drop\s+schema/i,
        /truncate/i,
        /delete\s+from.*where\s+1\s*=\s*1/i,
        /alter\s+table/i,
        /create\s+table/i,
        /grant\s+/i,
        /revoke\s+/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(query)) {
          logger.warn(`Dangerous query blocked: ${query}`);
          return {
            success: false,
            error: 'Query contains potentially dangerous operations',
            executionTime: Date.now() - startTime
          };
        }
      }

      // Apply limit
      let finalQuery = query.trim();
      if (limit && !finalQuery.toLowerCase().includes('limit')) {
        finalQuery += ` LIMIT ${limit}`;
      }

      logger.info(`Executing query on ${database}: ${finalQuery.substring(0, 100)}...`);

      // MOCK IMPLEMENTATION - Replace with actual database driver
      // In production, use pg, mysql2, or mongodb driver
      const mockResult = await this._mockQuery(config, finalQuery, parameters, timeout);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: mockResult.rows,
        rowCount: mockResult.rowCount,
        fields: mockResult.fields,
        executionTime,
        database,
        metadata: {
          cached: false,
          fromReplica: false
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Database query failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        executionTime,
        database
      };
    }
  }

  /**
   * Mock query execution (replace with real driver in production)
   * @private
   */
  async _mockQuery(config, query, parameters, timeout) {
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    const lowerQuery = query.toLowerCase();

    // Mock different query types
    if (lowerQuery.includes('select')) {
      // Generate mock data based on query
      if (lowerQuery.includes('users')) {
        return {
          rows: [
            { id: 1, email: 'user1@example.com', name: 'User One', created_at: '2026-01-15' },
            { id: 2, email: 'user2@example.com', name: 'User Two', created_at: '2026-01-20' }
          ],
          rowCount: 2,
          fields: ['id', 'email', 'name', 'created_at']
        };
      } else if (lowerQuery.includes('sales') || lowerQuery.includes('revenue')) {
        return {
          rows: [
            { date: '2026-01-27', revenue: 15234.50 },
            { date: '2026-01-26', revenue: 12890.25 },
            { date: '2026-01-25', revenue: 18456.00 }
          ],
          rowCount: 3,
          fields: ['date', 'revenue']
        };
      } else {
        return {
          rows: [
            { id: 1, value: 'Sample data 1' },
            { id: 2, value: 'Sample data 2' }
          ],
          rowCount: 2,
          fields: ['id', 'value']
        };
      }
    } else if (lowerQuery.includes('insert')) {
      return {
        rows: [],
        rowCount: 1,
        fields: [],
        insertId: Math.floor(Math.random() * 10000)
      };
    } else if (lowerQuery.includes('update')) {
      return {
        rows: [],
        rowCount: 1,
        fields: []
      };
    } else if (lowerQuery.includes('delete')) {
      return {
        rows: [],
        rowCount: 1,
        fields: []
      };
    }

    return { rows: [], rowCount: 0, fields: [] };
  }

  /**
   * Test database connection
   * @param {string} database - Database identifier
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(database) {
    if (!this.connections.has(database)) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const result = await this.execute({
        database,
        query: 'SELECT 1 as test',
        limit: 1
      });

      return {
        success: result.success,
        message: result.success ? 'Connection successful' : result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get database info
   * @param {string} database - Database identifier
   * @returns {Object} Database info
   */
  getInfo(database) {
    const config = this.connections.get(database);
    if (!config) {
      return null;
    }

    return {
      name: database,
      type: config.type,
      host: config.host,
      port: config.port,
      database: config.database,
      configured: config.configured
      // Don't return credentials
    };
  }

  /**
   * List configured databases
   * @returns {Array} Database list
   */
  listDatabases() {
    return Array.from(this.connections.keys());
  }
}

module.exports = new DatabaseTool();
