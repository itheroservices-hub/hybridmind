/**
 * Code Validator with Reflection Loop
 * 
 * Multi-phase validation before code execution:
 * 1. Static analysis of code structure
 * 2. Dry-run execution with mock environment
 * 3. Reflection on execution behavior
 * 4. Final safety check before real execution
 */

const logger = require('../../utils/logger');
const inputOutputSanitizer = require('./inputOutputSanitizer');
const libraryWhitelist = require('./libraryWhitelist');

class CodeValidator {
  constructor() {
    this.stats = {
      totalValidations: 0,
      passed: 0,
      failed: 0,
      phaseFailed: {
        static: 0,
        dryRun: 0,
        reflection: 0,
        final: 0
      },
      byLanguage: {}
    };
  }

  /**
   * Validate code with multi-phase reflection loop
   */
  async validate({
    code,
    language,
    tier = 'free',
    expectedBehavior = {}
  }) {
    this.stats.totalValidations++;
    
    language = language.toLowerCase();
    
    // Track by language
    if (!this.stats.byLanguage[language]) {
      this.stats.byLanguage[language] = { passed: 0, failed: 0 };
    }

    logger.info(`Validating ${language} code (tier: ${tier})`);

    const validationResult = {
      safe: true,
      phases: [],
      warnings: [],
      errors: []
    };

    // PHASE 1: Static Analysis
    const staticPhase = await this._phaseStaticAnalysis({
      code,
      language,
      tier
    });

    validationResult.phases.push(staticPhase);

    if (!staticPhase.passed) {
      validationResult.safe = false;
      validationResult.errors.push(...staticPhase.errors);
      this.stats.phaseFailed.static++;
      this._recordFailure(language);
      return validationResult;
    }

    validationResult.warnings.push(...staticPhase.warnings);

    // PHASE 2: Dry-Run Execution
    const dryRunPhase = await this._phaseDryRun({
      code,
      language,
      tier
    });

    validationResult.phases.push(dryRunPhase);

    if (!dryRunPhase.passed) {
      validationResult.safe = false;
      validationResult.errors.push(...dryRunPhase.errors);
      this.stats.phaseFailed.dryRun++;
      this._recordFailure(language);
      return validationResult;
    }

    validationResult.warnings.push(...dryRunPhase.warnings);

    // PHASE 3: Reflection Analysis
    const reflectionPhase = await this._phaseReflection({
      code,
      language,
      dryRunResult: dryRunPhase.result,
      expectedBehavior
    });

    validationResult.phases.push(reflectionPhase);

    if (!reflectionPhase.passed) {
      validationResult.safe = false;
      validationResult.errors.push(...reflectionPhase.errors);
      this.stats.phaseFailed.reflection++;
      this._recordFailure(language);
      return validationResult;
    }

    validationResult.warnings.push(...reflectionPhase.warnings);

    // PHASE 4: Final Safety Check
    const finalPhase = this._phaseFinalCheck({
      code,
      language,
      tier,
      staticAnalysis: staticPhase,
      dryRunResult: dryRunPhase,
      reflection: reflectionPhase
    });

    validationResult.phases.push(finalPhase);

    if (!finalPhase.passed) {
      validationResult.safe = false;
      validationResult.errors.push(...finalPhase.errors);
      this.stats.phaseFailed.final++;
      this._recordFailure(language);
      return validationResult;
    }

    // All phases passed!
    this.stats.passed++;
    this.stats.byLanguage[language].passed++;

    validationResult.recommendations = this._generateRecommendations(validationResult);

    logger.info(`Validation passed for ${language} code`);

    return validationResult;
  }

  /**
   * PHASE 1: Static Analysis
   */
  async _phaseStaticAnalysis({
    code,
    language,
    tier
  }) {
    const phase = {
      name: 'Static Analysis',
      passed: true,
      errors: [],
      warnings: [],
      metadata: {}
    };

    // Input validation
    const inputValidation = inputOutputSanitizer.validateInput({
      code,
      language,
      maxLength: tier === 'free' ? 10000 : tier === 'pro' ? 50000 : 100000
    });

    if (!inputValidation.valid) {
      phase.passed = false;
      phase.errors.push(...inputValidation.errors);
    }

    phase.metadata.inputValidation = inputValidation.metadata;

    // Sanitization check
    const sanitizationResult = inputOutputSanitizer.sanitizeInput({
      code,
      language,
      allowDangerous: false
    });

    if (!sanitizationResult.safe) {
      phase.passed = false;
      phase.errors.push(`Dangerous patterns detected: ${sanitizationResult.violations.length} violation(s)`);
      phase.metadata.violations = sanitizationResult.violations;
    }

    // Extract imports/requires
    const imports = this._extractImports(code, language);
    phase.metadata.imports = imports;

    // Check library whitelist
    for (const module of imports) {
      const whitelistCheck = libraryWhitelist.isAllowed({
        module,
        language,
        tier
      });

      if (!whitelistCheck.allowed) {
        phase.passed = false;
        phase.errors.push(whitelistCheck.message);
      }
    }

    // Complexity analysis
    const complexity = this._analyzeComplexity(code);
    phase.metadata.complexity = complexity;

    if (complexity.cyclomaticComplexity > 50) {
      phase.warnings.push(`High cyclomatic complexity (${complexity.cyclomaticComplexity})`);
    }

    return phase;
  }

  /**
   * PHASE 2: Dry-Run Execution (simulated)
   */
  async _phaseDryRun({
    code,
    language,
    tier
  }) {
    const phase = {
      name: 'Dry-Run Execution',
      passed: true,
      errors: [],
      warnings: [],
      result: null
    };

    try {
      // For now, we'll simulate a dry run by analyzing the code structure
      // In production, this would execute in an ultra-restricted sandbox
      
      const analysis = this._analyzeBehavior(code, language);
      
      phase.result = {
        willPrint: analysis.willPrint,
        willLoop: analysis.willLoop,
        willCallFunctions: analysis.willCallFunctions,
        estimatedComplexity: analysis.estimatedComplexity
      };

      // Check for infinite loops
      if (analysis.hasInfiniteLoopRisk) {
        phase.warnings.push('Potential infinite loop detected');
      }

      // Check for excessive recursion
      if (analysis.hasRecursionRisk) {
        phase.warnings.push('Deep recursion detected');
      }

    } catch (error) {
      phase.passed = false;
      phase.errors.push(`Dry-run failed: ${error.message}`);
    }

    return phase;
  }

  /**
   * PHASE 3: Reflection Analysis
   */
  async _phaseReflection({
    code,
    language,
    dryRunResult,
    expectedBehavior
  }) {
    const phase = {
      name: 'Reflection Analysis',
      passed: true,
      errors: [],
      warnings: [],
      analysis: {}
    };

    if (!dryRunResult) {
      phase.passed = false;
      phase.errors.push('No dry-run result to reflect on');
      return phase;
    }

    // Reflect on behavior vs expectations
    if (expectedBehavior.shouldPrint !== undefined) {
      if (dryRunResult.willPrint !== expectedBehavior.shouldPrint) {
        phase.warnings.push(
          `Expected ${expectedBehavior.shouldPrint ? 'output' : 'no output'}, ` +
          `but code ${dryRunResult.willPrint ? 'will' : 'will not'} print`
        );
      }
    }

    // Analyze intent
    const intent = this._analyzeIntent(code, language);
    phase.analysis.intent = intent;

    // Check for suspicious behavior
    const suspicious = this._detectSuspiciousBehavior(code, language);
    if (suspicious.length > 0) {
      phase.warnings.push(...suspicious);
    }

    // Confidence score
    phase.analysis.confidenceScore = this._calculateConfidenceScore({
      dryRunResult,
      intent,
      suspiciousCount: suspicious.length
    });

    if (phase.analysis.confidenceScore < 0.5) {
      phase.errors.push('Low confidence score - code behavior unclear');
      phase.passed = false;
    } else if (phase.analysis.confidenceScore < 0.7) {
      phase.warnings.push('Medium confidence - recommend manual review');
    }

    return phase;
  }

  /**
   * PHASE 4: Final Safety Check
   */
  _phaseFinalCheck({
    code,
    language,
    tier,
    staticAnalysis,
    dryRunResult,
    reflection
  }) {
    const phase = {
      name: 'Final Safety Check',
      passed: true,
      errors: [],
      warnings: []
    };

    // Aggregate all warnings
    const totalWarnings = 
      staticAnalysis.warnings.length +
      dryRunResult.warnings.length +
      reflection.warnings.length;

    if (totalWarnings > 10) {
      phase.errors.push(`Too many warnings (${totalWarnings})`);
      phase.passed = false;
    }

    // Check confidence
    if (reflection.analysis.confidenceScore < 0.6) {
      phase.errors.push('Overall confidence too low for safe execution');
      phase.passed = false;
    }

    // Final tier check
    const tierLimits = libraryWhitelist.getTierLimits(tier);
    if (tier === 'free' && code.length > 10000) {
      phase.errors.push('Code too long for free tier');
      phase.passed = false;
    }

    return phase;
  }

  /**
   * Extract imports/requires from code
   */
  _extractImports(code, language) {
    const imports = [];

    if (language === 'javascript' || language === 'js') {
      // require('module')
      const requireMatches = code.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
      for (const match of requireMatches) {
        imports.push(match[1]);
      }

      // import ... from 'module'
      const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
      for (const match of importMatches) {
        imports.push(match[1]);
      }
    } else if (language === 'python' || language === 'py') {
      // import module
      const importMatches = code.matchAll(/import\s+([a-zA-Z0-9_]+)/g);
      for (const match of importMatches) {
        imports.push(match[1]);
      }

      // from module import ...
      const fromMatches = code.matchAll(/from\s+([a-zA-Z0-9_]+)\s+import/g);
      for (const match of fromMatches) {
        imports.push(match[1]);
      }
    }

    return [...new Set(imports)]; // Remove duplicates
  }

  /**
   * Analyze code complexity
   */
  _analyzeComplexity(code) {
    const lines = code.split('\n').filter(line => line.trim());
    
    // Cyclomatic complexity (simplified)
    const decisionPoints = (code.match(/\b(if|else|for|while|case|catch|\?)\b/g) || []).length;
    const cyclomaticComplexity = decisionPoints + 1;

    return {
      lines: lines.length,
      cyclomaticComplexity,
      functions: (code.match(/\bfunction\b/g) || []).length,
      loops: (code.match(/\b(for|while)\b/g) || []).length
    };
  }

  /**
   * Analyze code behavior
   */
  _analyzeBehavior(code, language) {
    return {
      willPrint: /\b(console\.log|print)\b/i.test(code),
      willLoop: /\b(for|while)\b/i.test(code),
      willCallFunctions: /\w+\s*\(/g.test(code),
      hasInfiniteLoopRisk: /while\s*\(\s*(true|1)\s*\)/.test(code),
      hasRecursionRisk: code.includes('function') && code.match(/function\s+(\w+)/)?.[1] && code.includes(code.match(/function\s+(\w+)/)?.[1]),
      estimatedComplexity: (code.match(/\b(if|for|while)\b/g) || []).length
    };
  }

  /**
   * Analyze code intent
   */
  _analyzeIntent(code, language) {
    const intents = [];

    if (/\b(console\.log|print)\b/.test(code)) intents.push('output');
    if (/\b(for|while|forEach|map)\b/.test(code)) intents.push('iteration');
    if (/\b(if|else|switch)\b/.test(code)) intents.push('conditional');
    if (/\bfunction\b/.test(code)) intents.push('function_definition');
    if (/\b(let|const|var)\s+\w+\s*=/.test(code)) intents.push('variable_assignment');
    if (/\b(class|extends)\b/.test(code)) intents.push('oop');
    if (/\b(async|await|Promise)\b/.test(code)) intents.push('async');

    return intents;
  }

  /**
   * Detect suspicious behavior patterns
   */
  _detectSuspiciousBehavior(code, language) {
    const suspicious = [];

    // Obfuscation
    if (code.length > 1000 && code.split('\n').length < 5) {
      suspicious.push('Possible code obfuscation (very long single line)');
    }

    // Base64 encoding
    if (/atob|btoa|base64/.test(code)) {
      suspicious.push('Base64 encoding detected');
    }

    // String concatenation in unusual patterns
    if (/(["'`])\s*\+\s*\1.*\+/.test(code)) {
      suspicious.push('Unusual string concatenation pattern');
    }

    // Excessive escape sequences
    const escapeCount = (code.match(/\\/g) || []).length;
    if (escapeCount > code.length * 0.1) {
      suspicious.push('Excessive escape sequences');
    }

    return suspicious;
  }

  /**
   * Calculate confidence score
   */
  _calculateConfidenceScore({
    dryRunResult,
    intent,
    suspiciousCount
  }) {
    let score = 1.0;

    // Reduce for suspicious behavior
    score -= suspiciousCount * 0.2;

    // Reduce for unclear intent
    if (intent.length === 0) {
      score -= 0.3;
    }

    // Reduce for risky patterns
    if (dryRunResult.hasInfiniteLoopRisk) score -= 0.2;
    if (dryRunResult.hasRecursionRisk) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate recommendations
   */
  _generateRecommendations(validationResult) {
    const recommendations = [];

    const allWarnings = validationResult.phases.flatMap(p => p.warnings);

    if (allWarnings.some(w => w.includes('complexity'))) {
      recommendations.push('Consider breaking code into smaller functions');
    }

    if (allWarnings.some(w => w.includes('loop'))) {
      recommendations.push('Add loop termination conditions');
    }

    if (allWarnings.some(w => w.includes('recursion'))) {
      recommendations.push('Add recursion depth limits');
    }

    return recommendations;
  }

  /**
   * Record failure
   */
  _recordFailure(language) {
    this.stats.failed++;
    this.stats.byLanguage[language].failed++;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      passRate: this.stats.totalValidations > 0
        ? (this.stats.passed / this.stats.totalValidations * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Singleton instance
module.exports = new CodeValidator();
