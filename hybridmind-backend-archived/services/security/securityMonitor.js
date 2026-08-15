/**
 * Security Monitor
 * 
 * Real-time monitoring for:
 * - Prompt injection attacks
 * - Unsafe code patterns
 * - Data leakage attempts
 * - Resource exhaustion
 * 
 * Provides alerts and automatic blocking.
 */

const logger = require('../../utils/logger');
const auditLogger = require('../observability/auditLogger');

/**
 * Prompt injection patterns
 */
const PROMPT_INJECTION_PATTERNS = [
  // Direct instructions
  /ignore\s+(previous|above|all)\s+instructions/gi,
  /disregard\s+(previous|all)\s+(instructions|rules)/gi,
  /forget\s+(everything|all)\s+(above|before)/gi,
  
  // Role manipulation
  /you\s+are\s+now\s+(a|an)\s+\w+/gi,
  /act\s+as\s+(if|a|an)\s+\w+/gi,
  /pretend\s+(to\s+be|you\s+are)/gi,
  
  // System prompts
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /\[SYSTEM\]/gi,
  
  // Jailbreak attempts
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
  /unrestricted\s+mode/gi,
  
  // Delimiter injection
  /```\s*system/gi,
  /---END---/gi,
  /<\|endoftext\|>/gi
];

/**
 * Unsafe code patterns (additional to sanitizer)
 */
const UNSAFE_CODE_PATTERNS = [
  // Reflective operations
  /\[\s*['"`]constructor['"`]\s*\]/gi,
  /getOwnPropertyNames/gi,
  /getPrototypeOf/gi,
  
  // Data exfiltration
  /fetch\s*\(/gi,
  /XMLHttpRequest/gi,
  /WebSocket/gi,
  /sendBeacon/gi,
  
  // Cryptocurrency mining
  /cryptonight/gi,
  /monero/gi,
  /coinhive/gi,
  
  // Browser exploitation
  /document\.write/gi,
  /innerHTML\s*=/gi,
  /outerHTML\s*=/gi
];

/**
 * Data leakage patterns
 */
const DATA_LEAKAGE_PATTERNS = [
  // Environment variables
  /process\.env/gi,
  /env\./gi,
  
  // File path disclosure
  /(__dirname|__filename)/gi,
  
  // System information
  /os\.platform/gi,
  /os\.hostname/gi,
  /os\.userInfo/gi,
  
  // Stack traces (can leak paths)
  /Error\(\)\.stack/gi
];

class SecurityMonitor {
  constructor() {
    this.alerts = [];
    this.blockedRequests = new Map();
    
    this.stats = {
      totalChecks: 0,
      promptInjectionDetected: 0,
      unsafeCodeDetected: 0,
      dataLeakageDetected: 0,
      resourceExhaustionDetected: 0,
      totalBlocked: 0,
      byUser: {},
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };

    // Rate limiting for resource exhaustion
    this.requestCounts = new Map();
    this.resourceUsage = new Map();
  }

  /**
   * Monitor a request for security threats
   */
  async monitor({
    userId,
    tier,
    type, // 'prompt', 'code', 'output'
    content,
    metadata = {}
  }) {
    this.stats.totalChecks++;
    
    const threats = [];
    let severity = 'low';
    let blocked = false;

    // Check for prompt injection
    if (type === 'prompt' || type === 'code') {
      const promptThreats = this._detectPromptInjection(content);
      if (promptThreats.length > 0) {
        threats.push(...promptThreats);
        severity = this._escalateSeverity(severity, 'high');
        this.stats.promptInjectionDetected++;
      }
    }

    // Check for unsafe code
    if (type === 'code') {
      const codeThreats = this._detectUnsafeCode(content);
      if (codeThreats.length > 0) {
        threats.push(...codeThreats);
        severity = this._escalateSeverity(severity, 'medium');
        this.stats.unsafeCodeDetected++;
      }
    }

    // Check for data leakage
    const leakageThreats = this._detectDataLeakage(content);
    if (leakageThreats.length > 0) {
      threats.push(...leakageThreats);
      severity = this._escalateSeverity(severity, 'medium');
      this.stats.dataLeakageDetected++;
    }

    // Check for resource exhaustion
    const exhaustionThreat = this._detectResourceExhaustion(userId, tier, metadata);
    if (exhaustionThreat) {
      threats.push(exhaustionThreat);
      severity = this._escalateSeverity(severity, 'high');
      this.stats.resourceExhaustionDetected++;
    }

    // Determine if should block
    if (severity === 'critical' || severity === 'high') {
      blocked = true;
      this.stats.totalBlocked++;
      this._recordBlock(userId, threats);
    }

    // Track stats
    this.stats.bySeverity[severity]++;
    
    if (!this.stats.byUser[userId]) {
      this.stats.byUser[userId] = { checks: 0, threats: 0, blocked: 0 };
    }
    this.stats.byUser[userId].checks++;
    if (threats.length > 0) {
      this.stats.byUser[userId].threats++;
    }
    if (blocked) {
      this.stats.byUser[userId].blocked++;
    }

    // Create alert
    if (threats.length > 0) {
      this._createAlert({
        userId,
        tier,
        type,
        threats,
        severity,
        blocked,
        metadata
      });
    }

    return {
      safe: !blocked,
      threats,
      severity,
      blocked,
      message: blocked 
        ? `Request blocked due to ${threats.length} security threat(s)`
        : threats.length > 0
          ? `${threats.length} security threat(s) detected but allowed`
          : 'No threats detected'
    };
  }

  /**
   * Detect prompt injection
   */
  _detectPromptInjection(content) {
    const threats = [];

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          type: 'prompt_injection',
          pattern: this._describePattern(pattern),
          matches: matches.slice(0, 3),
          severity: 'high'
        });
      }
    }

    return threats;
  }

  /**
   * Detect unsafe code patterns
   */
  _detectUnsafeCode(content) {
    const threats = [];

    for (const pattern of UNSAFE_CODE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          type: 'unsafe_code',
          pattern: this._describePattern(pattern),
          matches: matches.slice(0, 3),
          severity: 'medium'
        });
      }
    }

    return threats;
  }

  /**
   * Detect data leakage attempts
   */
  _detectDataLeakage(content) {
    const threats = [];

    for (const pattern of DATA_LEAKAGE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          type: 'data_leakage',
          pattern: this._describePattern(pattern),
          matches: matches.slice(0, 3),
          severity: 'medium'
        });
      }
    }

    return threats;
  }

  /**
   * Detect resource exhaustion attempts
   */
  _detectResourceExhaustion(userId, tier, metadata) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Rate limits by tier
    const rateLimits = {
      free: { requests: 10, memory: 50, cpu: 5000 },
      pro: { requests: 100, memory: 256, cpu: 30000 },
      proPlus: { requests: 1000, memory: 1024, cpu: 120000 }
    };

    const limit = rateLimits[tier] || rateLimits.free;

    // Track requests
    if (!this.requestCounts.has(userId)) {
      this.requestCounts.set(userId, []);
    }

    const userRequests = this.requestCounts.get(userId);
    
    // Remove old requests
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    this.requestCounts.set(userId, recentRequests);

    // Add current request
    recentRequests.push(now);

    // Check rate limit
    if (recentRequests.length > limit.requests) {
      return {
        type: 'resource_exhaustion',
        subtype: 'rate_limit',
        details: `${recentRequests.length} requests in 1 minute (limit: ${limit.requests})`,
        severity: 'high'
      };
    }

    // Check memory usage
    if (metadata.memoryMb && metadata.memoryMb > limit.memory) {
      return {
        type: 'resource_exhaustion',
        subtype: 'memory_limit',
        details: `${metadata.memoryMb}MB requested (limit: ${limit.memory}MB)`,
        severity: 'high'
      };
    }

    // Check CPU time
    if (metadata.cpuMs && metadata.cpuMs > limit.cpu) {
      return {
        type: 'resource_exhaustion',
        subtype: 'cpu_limit',
        details: `${metadata.cpuMs}ms CPU time (limit: ${limit.cpu}ms)`,
        severity: 'medium'
      };
    }

    return null;
  }

  /**
   * Escalate severity
   */
  _escalateSeverity(current, newSeverity) {
    const levels = ['low', 'medium', 'high', 'critical'];
    const currentLevel = levels.indexOf(current);
    const newLevel = levels.indexOf(newSeverity);
    
    return levels[Math.max(currentLevel, newLevel)];
  }

  /**
   * Describe pattern in human-readable form
   */
  _describePattern(pattern) {
    const str = pattern.toString();
    
    if (str.includes('ignore') || str.includes('disregard')) {
      return 'Instruction override attempt';
    }
    if (str.includes('you\\s+are\\s+now')) {
      return 'Role manipulation attempt';
    }
    if (str.includes('system')) {
      return 'System prompt injection';
    }
    if (str.includes('DAN') || str.includes('developer')) {
      return 'Jailbreak attempt';
    }
    if (str.includes('fetch') || str.includes('XMLHttpRequest')) {
      return 'Data exfiltration attempt';
    }
    if (str.includes('process\\.env')) {
      return 'Environment variable access';
    }
    if (str.includes('innerHTML')) {
      return 'DOM manipulation';
    }
    
    return 'Suspicious pattern';
  }

  /**
   * Create alert
   */
  _createAlert({
    userId,
    tier,
    type,
    threats,
    severity,
    blocked,
    metadata
  }) {
    const alert = {
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      tier,
      type,
      threats,
      severity,
      blocked,
      metadata
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Log to audit system
    auditLogger.auditSecurity({
      userId,
      action: 'security_threat_detected',
      severity,
      details: {
        type,
        threatCount: threats.length,
        blocked,
        threats: threats.map(t => t.type)
      },
      metadata
    });

    logger.warn(`Security alert: ${severity} - ${threats.length} threat(s) detected`, {
      userId,
      type,
      blocked
    });
  }

  /**
   * Record blocked request
   */
  _recordBlock(userId, threats) {
    if (!this.blockedRequests.has(userId)) {
      this.blockedRequests.set(userId, []);
    }

    const userBlocks = this.blockedRequests.get(userId);
    userBlocks.push({
      timestamp: Date.now(),
      threats: threats.map(t => t.type)
    });

    // Keep only last 100 blocks per user
    if (userBlocks.length > 100) {
      this.blockedRequests.set(userId, userBlocks.slice(-100));
    }
  }

  /**
   * Get alerts
   */
  getAlerts(filters = {}) {
    let results = [...this.alerts];

    if (filters.userId) {
      results = results.filter(a => a.userId === filters.userId);
    }

    if (filters.severity) {
      results = results.filter(a => a.severity === filters.severity);
    }

    if (filters.type) {
      results = results.filter(a => a.type === filters.type);
    }

    if (filters.blocked !== undefined) {
      results = results.filter(a => a.blocked === filters.blocked);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    const limit = filters.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Get user security profile
   */
  getUserProfile(userId) {
    const userStats = this.stats.byUser[userId] || { checks: 0, threats: 0, blocked: 0 };
    const userBlocks = this.blockedRequests.get(userId) || [];
    const recentAlerts = this.getAlerts({ userId, limit: 10 });

    return {
      userId,
      stats: userStats,
      threatRate: userStats.checks > 0
        ? (userStats.threats / userStats.checks * 100).toFixed(2) + '%'
        : '0%',
      blockRate: userStats.checks > 0
        ? (userStats.blocked / userStats.checks * 100).toFixed(2) + '%'
        : '0%',
      recentBlocks: userBlocks.slice(-10),
      recentAlerts,
      riskLevel: this._calculateRiskLevel(userStats)
    };
  }

  /**
   * Calculate user risk level
   */
  _calculateRiskLevel(userStats) {
    if (userStats.blocked > 5) return 'high';
    if (userStats.blocked > 2) return 'medium';
    if (userStats.threats > 10) return 'medium';
    if (userStats.threats > 0) return 'low';
    return 'none';
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      threatRate: this.stats.totalChecks > 0
        ? (this.stats.promptInjectionDetected + this.stats.unsafeCodeDetected + 
           this.stats.dataLeakageDetected + this.stats.resourceExhaustionDetected) / 
          this.stats.totalChecks * 100
        : 0,
      blockRate: this.stats.totalChecks > 0
        ? (this.stats.totalBlocked / this.stats.totalChecks * 100).toFixed(2) + '%'
        : '0%',
      activeUsers: Object.keys(this.stats.byUser).length
    };
  }

  /**
   * Clear old data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 86400000; // 24 hours

    // Clean request counts
    for (const [userId, requests] of this.requestCounts.entries()) {
      const recent = requests.filter(time => now - time < maxAge);
      if (recent.length === 0) {
        this.requestCounts.delete(userId);
      } else {
        this.requestCounts.set(userId, recent);
      }
    }

    // Clean blocked requests
    for (const [userId, blocks] of this.blockedRequests.entries()) {
      const recent = blocks.filter(block => now - block.timestamp < maxAge);
      if (recent.length === 0) {
        this.blockedRequests.delete(userId);
      } else {
        this.blockedRequests.set(userId, recent);
      }
    }

    logger.info('Security monitor cleanup complete');
  }
}

// Singleton instance
module.exports = new SecurityMonitor();
