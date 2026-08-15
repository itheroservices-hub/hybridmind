/**
 * Security Module Exports
 * 
 * Complete security suite for HybridMind:
 * - Sandboxed code execution with resource limits
 * - Library whitelisting
 * - Input/output sanitization
 * - Code validation with reflection loop
 * - Security monitoring (prompt injection, unsafe code, data leakage, resource exhaustion)
 */

const secureCodeExecutor = require('./secureCodeExecutor');
const codeSandbox = require('./codeSandbox');
const libraryWhitelist = require('./libraryWhitelist');
const inputOutputSanitizer = require('./inputOutputSanitizer');
const codeValidator = require('./codeValidator');
const securityMonitor = require('./securityMonitor');

module.exports = {
  // Main executor (recommended)
  secureCodeExecutor,
  
  // Individual components (for advanced usage)
  codeSandbox,
  libraryWhitelist,
  inputOutputSanitizer,
  codeValidator,
  securityMonitor,

  // Convenience methods
  async executeCode(options) {
    return secureCodeExecutor.execute(options);
  },

  async initialize() {
    return secureCodeExecutor.initialize();
  },

  getSecurityReport() {
    return secureCodeExecutor.getSecurityReport();
  },

  getUserProfile(userId) {
    return secureCodeExecutor.getUserSecurityProfile(userId);
  },

  getAlerts(filters) {
    return secureCodeExecutor.getSecurityAlerts(filters);
  }
};
