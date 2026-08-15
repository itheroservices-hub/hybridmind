/**
 * Input/Output Sanitizer
 * 
 * Sanitizes inputs before code execution and validates outputs for data leakage.
 * Removes dangerous patterns and sensitive information.
 */

const logger = require('../../utils/logger');

/**
 * Dangerous code patterns
 */
const DANGEROUS_PATTERNS = {
  javascript: [
    // Code injection
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(\s*["'`]/gi,
    /setInterval\s*\(\s*["'`]/gi,
    
    // Process manipulation
    /process\.exit/gi,
    /process\.kill/gi,
    /child_process/gi,
    
    // File system access
    /require\s*\(\s*["'`]fs["'`]/gi,
    /fs\.(read|write|unlink|rmdir)/gi,
    
    // Network access (if not allowed)
    /require\s*\(\s*["'`](http|https|net|dgram)["'`]/gi,
    
    // Prototype pollution
    /__proto__/gi,
    /constructor\s*\[/gi
  ],

  python: [
    // Code execution
    /\beval\s*\(/gi,
    /\bexec\s*\(/gi,
    /\bcompile\s*\(/gi,
    /__import__/gi,
    
    // File/system access
    /\bopen\s*\(/gi,
    /import\s+(os|sys|subprocess|shutil)/gi,
    
    // Dangerous built-ins
    /\bglobals\s*\(/gi,
    /\blocals\s*\(/gi,
    /\bvars\s*\(/gi,
    /\bdir\s*\(/gi,
    
    // Pickle (arbitrary code execution)
    /import\s+pickle/gi,
    /import\s+shelve/gi
  ]
};

/**
 * Sensitive data patterns (for output validation)
 */
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /api[_-]?key[s]?\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/gi,
  /token[s]?\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/gi,
  /secret[s]?\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/gi,
  
  // AWS credentials
  /AKIA[0-9A-Z]{16}/gi,
  /aws[_-]?(access|secret)[_-]?key/gi,
  
  // Database connection strings
  /mongodb:\/\/[^\s]+/gi,
  /postgres:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  
  // Email addresses (potentially PII)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  
  // Credit card numbers
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/gi,
  
  // Social security numbers
  /\b\d{3}-\d{2}-\d{4}\b/gi,
  
  // Private IP addresses (internal network)
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi,
  /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/gi,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/gi,
  
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi
];

class InputOutputSanitizer {
  constructor() {
    this.stats = {
      totalInputs: 0,
      sanitizedInputs: 0,
      dangerousPatternsBlocked: 0,
      totalOutputs: 0,
      redactedOutputs: 0,
      sensitiveDataFound: 0,
      byPattern: {}
    };
  }

  /**
   * Sanitize input code before execution
   */
  sanitizeInput({
    code,
    language,
    allowDangerous = false
  }) {
    this.stats.totalInputs++;
    
    language = language.toLowerCase();
    
    const patterns = DANGEROUS_PATTERNS[language] || [];
    const violations = [];
    let sanitized = code;

    // Check for dangerous patterns
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      
      if (matches) {
        violations.push({
          pattern: pattern.toString(),
          matches: matches.map(m => m.substring(0, 50)), // First 50 chars
          count: matches.length
        });

        this.stats.dangerousPatternsBlocked += matches.length;
        
        // Track by pattern
        const patternKey = pattern.toString();
        this.stats.byPattern[patternKey] = (this.stats.byPattern[patternKey] || 0) + matches.length;
      }
    }

    if (violations.length > 0) {
      this.stats.sanitizedInputs++;
      
      logger.warn(`Dangerous patterns found in ${language} code:`, violations);

      if (!allowDangerous) {
        return {
          safe: false,
          violations,
          sanitized: null,
          message: `Code contains ${violations.length} dangerous pattern(s). Execution blocked.`
        };
      }
    }

    // Additional sanitization: remove comments that might contain injection attempts
    sanitized = this._removeComments(sanitized, language);

    // Normalize whitespace
    sanitized = this._normalizeWhitespace(sanitized);

    return {
      safe: violations.length === 0,
      violations,
      sanitized,
      message: violations.length > 0 
        ? `Code contains dangerous patterns but execution allowed`
        : 'Code is safe'
    };
  }

  /**
   * Validate and sanitize output
   */
  sanitizeOutput({
    output,
    redactSensitive = true
  }) {
    this.stats.totalOutputs++;
    
    if (!output || typeof output !== 'string') {
      return {
        safe: true,
        sanitized: output,
        findings: []
      };
    }

    const findings = [];
    let sanitized = output;

    // Check for sensitive data
    for (const pattern of SENSITIVE_PATTERNS) {
      const matches = output.match(pattern);
      
      if (matches) {
        findings.push({
          type: this._getPatternType(pattern),
          count: matches.length,
          samples: matches.slice(0, 2).map(m => m.substring(0, 20) + '...')
        });

        this.stats.sensitiveDataFound += matches.length;

        if (redactSensitive) {
          // Redact sensitive data
          sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
      }
    }

    if (findings.length > 0) {
      this.stats.redactedOutputs++;
      logger.warn(`Sensitive data found in output:`, findings);
    }

    return {
      safe: findings.length === 0,
      sanitized,
      findings,
      message: findings.length > 0
        ? `Output contains ${findings.length} type(s) of sensitive data`
        : 'Output is safe'
    };
  }

  /**
   * Remove comments from code
   */
  _removeComments(code, language) {
    if (language === 'javascript' || language === 'js') {
      // Remove single-line comments
      code = code.replace(/\/\/.*$/gm, '');
      // Remove multi-line comments
      code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    } else if (language === 'python' || language === 'py') {
      // Remove single-line comments
      code = code.replace(/#.*$/gm, '');
      // Remove docstrings
      code = code.replace(/"""[\s\S]*?"""/g, '');
      code = code.replace(/'''[\s\S]*?'''/g, '');
    }

    return code;
  }

  /**
   * Normalize whitespace
   */
  _normalizeWhitespace(code) {
    // Remove excessive blank lines
    code = code.replace(/\n\s*\n\s*\n/g, '\n\n');
    // Trim trailing whitespace
    code = code.split('\n').map(line => line.trimEnd()).join('\n');
    return code.trim();
  }

  /**
   * Get pattern type description
   */
  _getPatternType(pattern) {
    const str = pattern.toString();
    
    if (str.includes('api') || str.includes('key') || str.includes('token')) {
      return 'API credentials';
    }
    if (str.includes('AKIA') || str.includes('aws')) {
      return 'AWS credentials';
    }
    if (str.includes('mongodb') || str.includes('postgres') || str.includes('mysql')) {
      return 'Database connection string';
    }
    if (str.includes('@')) {
      return 'Email address';
    }
    if (str.includes('\\d{4}[- ]?\\d{4}')) {
      return 'Credit card number';
    }
    if (str.includes('\\d{3}-\\d{2}-\\d{4}')) {
      return 'SSN';
    }
    if (str.includes('10\\.|172\\.|192\\.168')) {
      return 'Private IP address';
    }
    if (str.includes('eyJ')) {
      return 'JWT token';
    }
    
    return 'Sensitive data';
  }

  /**
   * Validate input is safe for execution
   */
  validateInput({
    code,
    language,
    maxLength = 50000
  }) {
    const errors = [];

    // Check length
    if (code.length > maxLength) {
      errors.push(`Code exceeds maximum length (${maxLength} characters)`);
    }

    // Check for null bytes
    if (code.includes('\0')) {
      errors.push('Code contains null bytes');
    }

    // Check for excessive nesting
    const nestingLevel = this._checkNesting(code);
    if (nestingLevel > 20) {
      errors.push(`Excessive nesting (level ${nestingLevel})`);
    }

    // Check for extremely long lines
    const lines = code.split('\n');
    const longLines = lines.filter(line => line.length > 1000);
    if (longLines.length > 0) {
      errors.push(`${longLines.length} line(s) exceed 1000 characters`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      metadata: {
        length: code.length,
        lines: lines.length,
        nestingLevel
      }
    };
  }

  /**
   * Check nesting level
   */
  _checkNesting(code) {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of code) {
      if (char === '{' || char === '(' || char === '[') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}' || char === ')' || char === ']') {
        currentNesting--;
      }
    }

    return maxNesting;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      inputSanitizationRate: this.stats.totalInputs > 0
        ? (this.stats.sanitizedInputs / this.stats.totalInputs * 100).toFixed(2) + '%'
        : '0%',
      outputRedactionRate: this.stats.totalOutputs > 0
        ? (this.stats.redactedOutputs / this.stats.totalOutputs * 100).toFixed(2) + '%'
        : '0%',
      topDangerousPatterns: Object.entries(this.stats.byPattern)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count }))
    };
  }
}

// Singleton instance
module.exports = new InputOutputSanitizer();
