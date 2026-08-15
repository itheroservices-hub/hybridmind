/**
 * Audit Logger
 * 
 * Immutable audit trail system for compliance and security.
 * Tracks all system operations with:
 * - Chain of custody
 * - Tamper-proof logging
 * - Compliance reporting (GDPR, SOC2, etc.)
 * - Detailed change tracking
 * - User action auditing
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Audit event categories
 */
const AUDIT_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  DATA_ACCESS: 'data_access',
  DATA_MODIFICATION: 'data_modification',
  CONFIGURATION: 'configuration',
  AGENT_EXECUTION: 'agent_execution',
  WORKFLOW: 'workflow',
  PAYMENT: 'payment',
  TIER_CHANGE: 'tier_change',
  SECURITY: 'security',
  COMPLIANCE: 'compliance',
  SYSTEM: 'system'
};

/**
 * Audit severity levels
 */
const AUDIT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Compliance frameworks
 */
const COMPLIANCE_FRAMEWORKS = {
  GDPR: 'gdpr',
  SOC2: 'soc2',
  HIPAA: 'hipaa',
  PCI_DSS: 'pci_dss'
};

class AuditLogger {
  constructor() {
    this.auditLogs = []; // Immutable audit trail
    this.auditChain = []; // Hash chain for tamper detection
    
    this.metrics = {
      totalAudits: 0,
      auditsByCategory: {},
      auditsBySeverity: {},
      complianceReports: 0,
      chainVerifications: 0,
      tamperDetections: 0
    };

    // Initialize counters
    for (const category of Object.values(AUDIT_CATEGORIES)) {
      this.metrics.auditsByCategory[category] = 0;
    }

    for (const severity of Object.values(AUDIT_SEVERITY)) {
      this.metrics.auditsBySeverity[severity] = 0;
    }

    // Initialize chain with genesis block
    this._initializeChain();
  }

  /**
   * Initialize audit chain with genesis block
   */
  _initializeChain() {
    const genesis = {
      index: 0,
      timestamp: new Date(),
      data: {
        category: AUDIT_CATEGORIES.SYSTEM,
        action: 'chain_initialized',
        message: 'Audit chain initialized'
      },
      previousHash: '0',
      hash: ''
    };

    genesis.hash = this._calculateHash(genesis);
    this.auditChain.push(genesis);

    logger.info('Audit chain initialized');
  }

  /**
   * Calculate hash for audit block
   */
  _calculateHash(block) {
    const data = `${block.index}${block.timestamp}${JSON.stringify(block.data)}${block.previousHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create immutable audit entry
   */
  audit({
    userId,
    sessionId = null,
    category,
    action,
    resource = null,
    details = {},
    severity = AUDIT_SEVERITY.INFO,
    complianceFrameworks = [],
    ipAddress = null,
    userAgent = null
  }) {
    // Create audit entry
    const auditEntry = {
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      sessionId,
      category,
      action,
      resource,
      details,
      severity,
      complianceFrameworks,
      metadata: {
        ipAddress,
        userAgent
      }
    };

    // Add to audit log (immutable)
    this.auditLogs.push(Object.freeze(auditEntry));

    // Add to blockchain-style chain
    const block = {
      index: this.auditChain.length,
      timestamp: auditEntry.timestamp,
      data: auditEntry,
      previousHash: this.auditChain[this.auditChain.length - 1].hash,
      hash: ''
    };

    block.hash = this._calculateHash(block);
    this.auditChain.push(block);

    // Update metrics
    this.metrics.totalAudits++;
    this.metrics.auditsByCategory[category] = (this.metrics.auditsByCategory[category] || 0) + 1;
    this.metrics.auditsBySeverity[severity] = (this.metrics.auditsBySeverity[severity] || 0) + 1;

    // Keep only last 100,000 entries
    if (this.auditLogs.length > 100000) {
      this.auditLogs = this.auditLogs.slice(-100000);
    }

    if (this.auditChain.length > 100001) { // +1 for genesis block
      this.auditChain = [this.auditChain[0], ...this.auditChain.slice(-100000)];
    }

    logger.debug(`Audit: ${category}/${action} by user ${userId}`);

    return auditEntry.auditId;
  }

  /**
   * Audit authentication events
   */
  auditAuthentication({
    userId,
    action, // login, logout, failed_login, session_expired
    success,
    ipAddress,
    userAgent,
    details = {}
  }) {
    return this.audit({
      userId,
      category: AUDIT_CATEGORIES.AUTHENTICATION,
      action,
      details: {
        ...details,
        success
      },
      severity: success ? AUDIT_SEVERITY.INFO : AUDIT_SEVERITY.WARNING,
      ipAddress,
      userAgent,
      complianceFrameworks: [COMPLIANCE_FRAMEWORKS.SOC2, COMPLIANCE_FRAMEWORKS.GDPR]
    });
  }

  /**
   * Audit data access
   */
  auditDataAccess({
    userId,
    sessionId,
    resource,
    action, // read, query, export
    recordCount = 0,
    ipAddress,
    details = {}
  }) {
    return this.audit({
      userId,
      sessionId,
      category: AUDIT_CATEGORIES.DATA_ACCESS,
      action,
      resource,
      details: {
        ...details,
        recordCount
      },
      severity: AUDIT_SEVERITY.INFO,
      ipAddress,
      complianceFrameworks: [COMPLIANCE_FRAMEWORKS.GDPR, COMPLIANCE_FRAMEWORKS.HIPAA]
    });
  }

  /**
   * Audit data modifications
   */
  auditDataModification({
    userId,
    sessionId,
    resource,
    action, // create, update, delete
    before = null,
    after = null,
    ipAddress,
    details = {}
  }) {
    return this.audit({
      userId,
      sessionId,
      category: AUDIT_CATEGORIES.DATA_MODIFICATION,
      action,
      resource,
      details: {
        ...details,
        before,
        after,
        changeType: this._getChangeType(before, after)
      },
      severity: action === 'delete' ? AUDIT_SEVERITY.WARNING : AUDIT_SEVERITY.INFO,
      ipAddress,
      complianceFrameworks: [COMPLIANCE_FRAMEWORKS.SOC2, COMPLIANCE_FRAMEWORKS.GDPR]
    });
  }

  /**
   * Audit agent execution
   */
  auditAgentExecution({
    userId,
    sessionId,
    agentId,
    agentRole,
    action,
    task,
    model,
    tier,
    cost,
    success,
    details = {}
  }) {
    return this.audit({
      userId,
      sessionId,
      category: AUDIT_CATEGORIES.AGENT_EXECUTION,
      action,
      resource: agentId,
      details: {
        ...details,
        agentRole,
        task,
        model,
        tier,
        cost,
        success
      },
      severity: success ? AUDIT_SEVERITY.INFO : AUDIT_SEVERITY.WARNING
    });
  }

  /**
   * Audit workflow execution
   */
  auditWorkflow({
    userId,
    sessionId,
    workflowId,
    workflowMode,
    action,
    steps,
    duration,
    cost,
    success,
    details = {}
  }) {
    return this.audit({
      userId,
      sessionId,
      category: AUDIT_CATEGORIES.WORKFLOW,
      action,
      resource: workflowId,
      details: {
        ...details,
        workflowMode,
        steps,
        duration,
        cost,
        success
      },
      severity: success ? AUDIT_SEVERITY.INFO : AUDIT_SEVERITY.WARNING
    });
  }

  /**
   * Audit payment events
   */
  auditPayment({
    userId,
    action, // charge_created, payment_succeeded, payment_failed, refund_created
    amount,
    currency,
    paymentMethod,
    transactionId,
    success,
    ipAddress,
    details = {}
  }) {
    return this.audit({
      userId,
      category: AUDIT_CATEGORIES.PAYMENT,
      action,
      details: {
        ...details,
        amount,
        currency,
        paymentMethod,
        transactionId,
        success
      },
      severity: success ? AUDIT_SEVERITY.INFO : AUDIT_SEVERITY.CRITICAL,
      ipAddress,
      complianceFrameworks: [COMPLIANCE_FRAMEWORKS.PCI_DSS, COMPLIANCE_FRAMEWORKS.SOC2]
    });
  }

  /**
   * Audit tier changes
   */
  auditTierChange({
    userId,
    sessionId,
    fromTier,
    toTier,
    reason,
    ipAddress,
    details = {}
  }) {
    return this.audit({
      userId,
      sessionId,
      category: AUDIT_CATEGORIES.TIER_CHANGE,
      action: 'tier_change',
      details: {
        ...details,
        fromTier,
        toTier,
        reason
      },
      severity: AUDIT_SEVERITY.INFO,
      ipAddress,
      complianceFrameworks: [COMPLIANCE_FRAMEWORKS.SOC2]
    });
  }

  /**
   * Audit security events
   */
  auditSecurity({
    userId,
    action, // suspicious_activity, rate_limit_exceeded, unauthorized_access
    threat,
    blocked = false,
    ipAddress,
    userAgent,
    details = {}
  }) {
    return this.audit({
      userId,
      category: AUDIT_CATEGORIES.SECURITY,
      action,
      details: {
        ...details,
        threat,
        blocked
      },
      severity: AUDIT_SEVERITY.CRITICAL,
      ipAddress,
      userAgent,
      complianceFrameworks: [COMPLIANCE_FRAMEWORKS.SOC2]
    });
  }

  /**
   * Get change type from before/after
   */
  _getChangeType(before, after) {
    if (!before && after) return 'created';
    if (before && !after) return 'deleted';
    if (before && after) return 'updated';
    return 'unknown';
  }

  /**
   * Query audit logs
   */
  queryAudits(filters = {}) {
    let results = [...this.auditLogs];

    // Filter by user
    if (filters.userId) {
      results = results.filter(a => a.userId === filters.userId);
    }

    // Filter by session
    if (filters.sessionId) {
      results = results.filter(a => a.sessionId === filters.sessionId);
    }

    // Filter by category
    if (filters.category) {
      results = results.filter(a => a.category === filters.category);
    }

    // Filter by action
    if (filters.action) {
      results = results.filter(a => a.action === filters.action);
    }

    // Filter by severity
    if (filters.severity) {
      results = results.filter(a => a.severity === filters.severity);
    }

    // Filter by resource
    if (filters.resource) {
      results = results.filter(a => a.resource === filters.resource);
    }

    // Filter by compliance framework
    if (filters.complianceFramework) {
      results = results.filter(a => 
        a.complianceFrameworks && a.complianceFrameworks.includes(filters.complianceFramework)
      );
    }

    // Filter by time range
    if (filters.startTime) {
      results = results.filter(a => a.timestamp >= new Date(filters.startTime));
    }

    if (filters.endTime) {
      results = results.filter(a => a.timestamp <= new Date(filters.endTime));
    }

    // Sort by timestamp (newest first by default)
    results.sort((a, b) => {
      const order = filters.sortOrder === 'asc' ? 1 : -1;
      return order * (b.timestamp - a.timestamp);
    });

    // Limit results
    const limit = filters.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Verify audit chain integrity
   */
  verifyChain() {
    this.metrics.chainVerifications++;

    for (let i = 1; i < this.auditChain.length; i++) {
      const block = this.auditChain[i];
      const previousBlock = this.auditChain[i - 1];

      // Verify hash
      const calculatedHash = this._calculateHash(block);
      if (block.hash !== calculatedHash) {
        this.metrics.tamperDetections++;
        logger.error(`Audit chain tamper detected at block ${i}: hash mismatch`);
        return {
          valid: false,
          tamperedBlock: i,
          reason: 'hash_mismatch'
        };
      }

      // Verify chain link
      if (block.previousHash !== previousBlock.hash) {
        this.metrics.tamperDetections++;
        logger.error(`Audit chain tamper detected at block ${i}: chain broken`);
        return {
          valid: false,
          tamperedBlock: i,
          reason: 'chain_broken'
        };
      }
    }

    logger.info('Audit chain verified successfully');
    return {
      valid: true,
      chainLength: this.auditChain.length,
      lastVerified: new Date()
    };
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport({
    framework,
    startTime,
    endTime,
    userId = null
  }) {
    this.metrics.complianceReports++;

    const audits = this.queryAudits({
      complianceFramework: framework,
      startTime,
      endTime,
      userId,
      limit: 100000
    });

    const report = {
      reportId: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      framework,
      period: {
        start: new Date(startTime),
        end: new Date(endTime)
      },
      generatedAt: new Date(),
      userId,
      summary: {
        totalEvents: audits.length,
        byCategory: {},
        bySeverity: {},
        criticalEvents: 0
      },
      events: audits,
      chainVerification: this.verifyChain()
    };

    // Count by category
    for (const audit of audits) {
      report.summary.byCategory[audit.category] = 
        (report.summary.byCategory[audit.category] || 0) + 1;
      
      report.summary.bySeverity[audit.severity] = 
        (report.summary.bySeverity[audit.severity] || 0) + 1;

      if (audit.severity === AUDIT_SEVERITY.CRITICAL) {
        report.summary.criticalEvents++;
      }
    }

    // Framework-specific analysis
    if (framework === COMPLIANCE_FRAMEWORKS.GDPR) {
      report.gdprAnalysis = this._analyzeGDPR(audits);
    } else if (framework === COMPLIANCE_FRAMEWORKS.SOC2) {
      report.soc2Analysis = this._analyzeSOC2(audits);
    }

    logger.info(`Compliance report generated: ${framework} (${audits.length} events)`);

    return report;
  }

  /**
   * GDPR-specific analysis
   */
  _analyzeGDPR(audits) {
    return {
      dataAccess: audits.filter(a => a.category === AUDIT_CATEGORIES.DATA_ACCESS).length,
      dataModification: audits.filter(a => a.category === AUDIT_CATEGORIES.DATA_MODIFICATION).length,
      dataExports: audits.filter(a => a.action === 'export').length,
      dataDeletions: audits.filter(a => a.action === 'delete').length,
      consentChanges: audits.filter(a => a.action === 'consent_updated').length
    };
  }

  /**
   * SOC2-specific analysis
   */
  _analyzeSOC2(audits) {
    return {
      authenticationEvents: audits.filter(a => a.category === AUDIT_CATEGORIES.AUTHENTICATION).length,
      failedLogins: audits.filter(a => a.action === 'failed_login').length,
      configChanges: audits.filter(a => a.category === AUDIT_CATEGORIES.CONFIGURATION).length,
      securityEvents: audits.filter(a => a.category === AUDIT_CATEGORIES.SECURITY).length,
      criticalEvents: audits.filter(a => a.severity === AUDIT_SEVERITY.CRITICAL).length
    };
  }

  /**
   * Get audit metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalAuditLogs: this.auditLogs.length,
      chainLength: this.auditChain.length,
      chainValid: this.verifyChain().valid
    };
  }

  /**
   * Export audit logs
   */
  exportAudits(format = 'json', filters = {}) {
    const audits = this.queryAudits(filters);

    if (format === 'csv') {
      return this._exportCSV(audits);
    } else if (format === 'ndjson') {
      return audits.map(audit => JSON.stringify(audit)).join('\n');
    }

    return audits;
  }

  /**
   * Export to CSV
   */
  _exportCSV(audits) {
    const headers = ['auditId', 'timestamp', 'userId', 'category', 'action', 'resource', 'severity'];
    const rows = [headers.join(',')];

    for (const audit of audits) {
      const row = [
        audit.auditId,
        audit.timestamp.toISOString(),
        audit.userId || '',
        audit.category,
        audit.action,
        audit.resource || '',
        audit.severity
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

// Singleton instance
module.exports = new AuditLogger();
