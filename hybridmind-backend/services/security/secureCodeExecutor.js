/**
 * Secure Code Execution Manager
 * 
 * Integrates all security systems for safe code execution:
 * 1. Security monitoring (prompt injection, unsafe code)
 * 2. Input/output sanitization
 * 3. Code validation with reflection loop
 * 4. Library whitelisting
 * 5. Sandboxed execution with resource limits
 */

const codeSandbox = require('./codeSandbox');
const libraryWhitelist = require('./libraryWhitelist');
const inputOutputSanitizer = require('./inputOutputSanitizer');
const codeValidator = require('./codeValidator');
const securityMonitor = require('./securityMonitor');
const logger = require('../../utils/logger');

class SecureCodeExecutor {
  constructor() {
    this.initialized = false;
    
    this.stats = {
      totalExecutions: 0,
      secureExecutions: 0,
      blockedExecutions: 0,
      failedValidations: 0,
      successfulExecutions: 0
    };
  }

  /**
   * Initialize all security systems
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing secure code execution systems...');

    try {
      // Initialize sandbox
      await codeSandbox.initialize();
      
      this.initialized = true;
      logger.info('Secure code execution systems initialized');
    } catch (error) {
      logger.error('Failed to initialize secure code execution:', error);
      throw error;
    }
  }

  /**
   * Execute code securely with full security pipeline
   */
  async execute({
    code,
    language,
    userId,
    tier = 'free',
    input = '',
    allowedModules = null,
    skipValidation = false,
    expectedBehavior = {}
  }) {
    this.stats.totalExecutions++;

    if (!this.initialized) {
      await this.initialize();
    }

    logger.info(`Secure execution request: ${language} (user: ${userId}, tier: ${tier})`);

    const executionResult = {
      success: false,
      phases: [],
      output: null,
      errors: [],
      warnings: [],
      securityReport: {}
    };

    // PHASE 1: Security Monitoring
    logger.info('Phase 1: Security monitoring');
    
    const monitorResult = await securityMonitor.monitor({
      userId,
      tier,
      type: 'code',
      content: code,
      metadata: { language }
    });

    executionResult.phases.push({
      name: 'Security Monitoring',
      passed: monitorResult.safe,
      result: monitorResult
    });

    if (monitorResult.blocked) {
      executionResult.errors.push(`Security threats detected: ${monitorResult.message}`);
      executionResult.securityReport = monitorResult;
      this.stats.blockedExecutions++;
      
      logger.warn(`Execution blocked for user ${userId}: ${monitorResult.message}`);
      return executionResult;
    }

    if (monitorResult.threats.length > 0) {
      executionResult.warnings.push(...monitorResult.threats.map(t => t.type));
    }

    // PHASE 2: Input Sanitization
    logger.info('Phase 2: Input sanitization');
    
    const sanitizationResult = inputOutputSanitizer.sanitizeInput({
      code,
      language,
      allowDangerous: false
    });

    executionResult.phases.push({
      name: 'Input Sanitization',
      passed: sanitizationResult.safe,
      result: sanitizationResult
    });

    if (!sanitizationResult.safe) {
      executionResult.errors.push(`Dangerous code patterns: ${sanitizationResult.message}`);
      this.stats.blockedExecutions++;
      return executionResult;
    }

    // Use sanitized code
    const sanitizedCode = sanitizationResult.sanitized;

    // PHASE 3: Code Validation (if not skipped)
    if (!skipValidation) {
      logger.info('Phase 3: Code validation with reflection loop');
      
      const validationResult = await codeValidator.validate({
        code: sanitizedCode,
        language,
        tier,
        expectedBehavior
      });

      executionResult.phases.push({
        name: 'Code Validation',
        passed: validationResult.safe,
        result: validationResult
      });

      if (!validationResult.safe) {
        executionResult.errors.push(...validationResult.errors);
        executionResult.warnings.push(...validationResult.warnings);
        this.stats.failedValidations++;
        
        logger.warn(`Validation failed for user ${userId}`);
        return executionResult;
      }

      executionResult.warnings.push(...validationResult.warnings);
    }

    // PHASE 4: Library Whitelist Check
    logger.info('Phase 4: Library whitelist verification');
    
    // Extract imports from sanitized code
    const importRegex = language === 'python' 
      ? /import\s+([a-zA-Z0-9_]+)/g
      : /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    
    const imports = [];
    let match;
    while ((match = importRegex.exec(sanitizedCode)) !== null) {
      imports.push(match[1]);
    }

    const whitelistResults = imports.map(module => 
      libraryWhitelist.isAllowed({
        module,
        language,
        tier,
        customWhitelist: allowedModules
      })
    );

    const blockedModules = whitelistResults.filter(r => !r.allowed);
    
    executionResult.phases.push({
      name: 'Library Whitelist',
      passed: blockedModules.length === 0,
      result: {
        imports,
        allowed: whitelistResults.filter(r => r.allowed).length,
        blocked: blockedModules
      }
    });

    if (blockedModules.length > 0) {
      executionResult.errors.push(
        `Blocked modules: ${blockedModules.map(m => m.message).join(', ')}`
      );
      this.stats.blockedExecutions++;
      return executionResult;
    }

    // PHASE 5: Sandboxed Execution
    logger.info('Phase 5: Sandboxed execution');
    
    const sandboxResult = await codeSandbox.execute({
      code: sanitizedCode,
      language,
      tier,
      input,
      allowedModules
    });

    executionResult.phases.push({
      name: 'Sandboxed Execution',
      passed: sandboxResult.success,
      result: sandboxResult
    });

    if (!sandboxResult.success) {
      executionResult.errors.push(`Execution failed: ${sandboxResult.error}`);
      return executionResult;
    }

    // PHASE 6: Output Sanitization
    logger.info('Phase 6: Output sanitization');
    
    const outputSanitization = inputOutputSanitizer.sanitizeOutput({
      output: sandboxResult.output,
      redactSensitive: true
    });

    executionResult.phases.push({
      name: 'Output Sanitization',
      passed: true,
      result: outputSanitization
    });

    if (outputSanitization.findings.length > 0) {
      executionResult.warnings.push(
        `Sensitive data redacted: ${outputSanitization.findings.map(f => f.type).join(', ')}`
      );
    }

    // SUCCESS!
    executionResult.success = true;
    executionResult.output = outputSanitization.sanitized;
    executionResult.executionTime = sandboxResult.executionTime;
    executionResult.memoryUsed = sandboxResult.memoryUsed;
    executionResult.limits = sandboxResult.limits;
    
    this.stats.secureExecutions++;
    this.stats.successfulExecutions++;

    logger.info(`Secure execution successful for user ${userId} (${sandboxResult.executionTime}ms)`);

    return executionResult;
  }

  /**
   * Get comprehensive security report
   */
  getSecurityReport() {
    return {
      executor: this.stats,
      sandbox: codeSandbox.getStats(),
      whitelist: libraryWhitelist.getStats(),
      sanitizer: inputOutputSanitizer.getStats(),
      validator: codeValidator.getStats(),
      monitor: securityMonitor.getStats()
    };
  }

  /**
   * Get user security profile
   */
  getUserSecurityProfile(userId) {
    return securityMonitor.getUserProfile(userId);
  }

  /**
   * Get security alerts
   */
  getSecurityAlerts(filters = {}) {
    return securityMonitor.getAlerts(filters);
  }

  /**
   * Add module to whitelist
   */
  whitelistModule({
    module,
    language,
    type = 'package'
  }) {
    return libraryWhitelist.addToWhitelist({
      module,
      language,
      type
    });
  }

  /**
   * Block module
   */
  blockModule({
    module,
    language
  }) {
    return libraryWhitelist.blockModule({
      module,
      language
    });
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await codeSandbox.cleanup();
    securityMonitor.cleanup();
    logger.info('Secure code executor cleaned up');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalExecutions > 0
        ? (this.stats.successfulExecutions / this.stats.totalExecutions * 100).toFixed(2) + '%'
        : '0%',
      blockRate: this.stats.totalExecutions > 0
        ? (this.stats.blockedExecutions / this.stats.totalExecutions * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Singleton instance
module.exports = new SecureCodeExecutor();
