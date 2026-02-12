/**
 * HybridMind Multi-Tiered Guardrail System
 * Action Risk Level Definitions
 * 
 * Defines risk categories for all agent actions and maps them to autonomy levels.
 * Used by guardrailEngine to determine if approval is required.
 */

/**
 * Risk Levels:
 * - SAFE: No approval needed at any tier
 * - LOW: Approval needed for Free tier only
 * - MODERATE: Approval needed for Free and Pro tiers
 * - HIGH: Approval needed for Free, Pro, and Pro-Plus tiers
 * - CRITICAL: Always requires approval (even Enterprise tier)
 */
const RISK_LEVELS = {
  SAFE: 'safe',
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Action Risk Classifications
 * Each action type is assigned a risk level
 */
const ACTION_RISK_LEVELS = {
  // ===== SAFE ACTIONS (No approval needed) =====
  'read_file': RISK_LEVELS.SAFE,
  'list_directory': RISK_LEVELS.SAFE,
  'search_code': RISK_LEVELS.SAFE,
  'get_file_info': RISK_LEVELS.SAFE,
  'analyze_code': RISK_LEVELS.SAFE,
  'explain_code': RISK_LEVELS.SAFE,
  'search_web': RISK_LEVELS.SAFE,
  'read_database': RISK_LEVELS.SAFE,
  'get_tool_info': RISK_LEVELS.SAFE,

  // ===== LOW RISK (Approval for Free tier) =====
  'create_file': RISK_LEVELS.LOW,
  'edit_file': RISK_LEVELS.LOW,
  'write_file': RISK_LEVELS.LOW,
  'query_database': RISK_LEVELS.LOW,
  'generate_code': RISK_LEVELS.LOW,
  'http_request_get': RISK_LEVELS.LOW,
  'crm_read': RISK_LEVELS.LOW,

  // ===== MODERATE RISK (Approval for Free + Pro) =====
  'rename_file': RISK_LEVELS.MODERATE,
  'move_file': RISK_LEVELS.MODERATE,
  'terminal_read': RISK_LEVELS.MODERATE,
  'http_request_post': RISK_LEVELS.MODERATE,
  'crm_write': RISK_LEVELS.MODERATE,
  'database_write': RISK_LEVELS.MODERATE,
  'package_add': RISK_LEVELS.MODERATE,
  'config_modify': RISK_LEVELS.MODERATE,

  // ===== HIGH RISK (Approval for Free + Pro + Pro-Plus) =====
  'delete_file': RISK_LEVELS.HIGH,
  'delete_directory': RISK_LEVELS.HIGH,
  'terminal_execute': RISK_LEVELS.HIGH,
  'package_remove': RISK_LEVELS.HIGH,
  'database_delete': RISK_LEVELS.HIGH,
  'crm_delete': RISK_LEVELS.HIGH,
  'network_request': RISK_LEVELS.HIGH,
  'restructure_code': RISK_LEVELS.HIGH,
  'modify_dependencies': RISK_LEVELS.HIGH,

  // ===== CRITICAL RISK (Always requires approval) =====
  'database_drop': RISK_LEVELS.CRITICAL,
  'database_truncate': RISK_LEVELS.CRITICAL,
  'system_command': RISK_LEVELS.CRITICAL,
  'environment_modify': RISK_LEVELS.CRITICAL,
  'security_config_change': RISK_LEVELS.CRITICAL,
  'git_force_push': RISK_LEVELS.CRITICAL,
  'production_deployment': RISK_LEVELS.CRITICAL,
  'delete_production_data': RISK_LEVELS.CRITICAL,
  'modify_auth': RISK_LEVELS.CRITICAL,
  'api_key_change': RISK_LEVELS.CRITICAL
};

/**
 * Tier-based Autonomy Levels
 * Defines what risk levels require approval for each tier
 */
const TIER_AUTONOMY_CONFIG = {
  // FREE TIER: Semi-Autonomous
  // - SAFE actions: Auto-execute
  // - LOW/MODERATE/HIGH/CRITICAL: Require approval
  free: {
    name: 'Semi-Autonomous (Free)',
    description: 'Limited autonomy - approval required for most actions',
    autoApproveRiskLevels: [RISK_LEVELS.SAFE],
    requireApprovalRiskLevels: [
      RISK_LEVELS.LOW,
      RISK_LEVELS.MODERATE,
      RISK_LEVELS.HIGH,
      RISK_LEVELS.CRITICAL
    ],
    maxActionsPerHour: 50,
    maxActionsPerDay: 200,
    features: [
      'read-only-auto',
      'edit-with-approval',
      'basic-terminal-with-approval',
      'stop-and-ask-checkpoints'
    ]
  },

  // PRO TIER: Autonomous with Approval (Mid-Tier)
  // - SAFE/LOW actions: Auto-execute
  // - MODERATE/HIGH/CRITICAL: Require approval
  pro: {
    name: 'Autonomous with Approval (Pro)',
    description: 'Enhanced autonomy - approval only for risky actions',
    autoApproveRiskLevels: [RISK_LEVELS.SAFE, RISK_LEVELS.LOW],
    requireApprovalRiskLevels: [
      RISK_LEVELS.MODERATE,
      RISK_LEVELS.HIGH,
      RISK_LEVELS.CRITICAL
    ],
    maxActionsPerHour: 200,
    maxActionsPerDay: 1000,
    features: [
      'read-write-auto',
      'basic-edits-auto',
      'code-generation-auto',
      'moderate-approval-required',
      'smart-checkpoints'
    ]
  },

  // PRO-PLUS TIER: Full Autonomy with Smart Safeguards
  // - SAFE/LOW/MODERATE actions: Auto-execute
  // - HIGH/CRITICAL: Require approval
  'pro-plus': {
    name: 'Full Autonomy (Pro-Plus)',
    description: 'Maximum autonomy - approval only for critical/destructive actions',
    autoApproveRiskLevels: [
      RISK_LEVELS.SAFE,
      RISK_LEVELS.LOW,
      RISK_LEVELS.MODERATE
    ],
    requireApprovalRiskLevels: [RISK_LEVELS.HIGH, RISK_LEVELS.CRITICAL],
    maxActionsPerHour: 500,
    maxActionsPerDay: 3000,
    features: [
      'full-read-write-auto',
      'terminal-auto',
      'package-management-auto',
      'database-write-auto',
      'high-risk-approval-only',
      'minimal-interruptions'
    ]
  },

  // ENTERPRISE TIER: Near-Full Autonomy
  // - SAFE/LOW/MODERATE/HIGH actions: Auto-execute
  // - CRITICAL only: Require approval
  enterprise: {
    name: 'Enterprise Autonomy',
    description: 'Maximum autonomy - approval only for critical system changes',
    autoApproveRiskLevels: [
      RISK_LEVELS.SAFE,
      RISK_LEVELS.LOW,
      RISK_LEVELS.MODERATE,
      RISK_LEVELS.HIGH
    ],
    requireApprovalRiskLevels: [RISK_LEVELS.CRITICAL],
    maxActionsPerHour: 2000,
    maxActionsPerDay: 10000,
    features: [
      'full-autonomy',
      'unrestricted-actions',
      'critical-only-approval',
      'production-safeguards',
      'audit-logging',
      'compliance-mode'
    ]
  }
};

/**
 * Sensitive Action Patterns
 * Additional pattern-based checks for sensitive operations
 */
const SENSITIVE_PATTERNS = {
  // File patterns that require extra approval
  sensitiveFiles: [
    /\.env$/,
    /\.env\..+$/,
    /config\/production/,
    /\.git\/config$/,
    /package\.json$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /Dockerfile$/,
    /docker-compose/,
    /\.github\/workflows/,
    /\.vscode\/settings\.json$/,
    /tsconfig\.json$/,
    /webpack\.config/,
    /\.secret/,
    /\.key$/,
    /\.pem$/,
    /\.ssh\//
  ],

  // Command patterns that require extra approval
  sensitiveCommands: [
    /rm\s+-rf/,
    /sudo/,
    /chmod\s+777/,
    /git\s+push\s+--force/,
    /npm\s+publish/,
    /docker\s+rm/,
    /kubectl\s+delete/,
    /DROP\s+TABLE/i,
    /TRUNCATE/i,
    /DELETE\s+FROM/i,
    /shutdown/,
    /reboot/,
    /kill\s+-9/
  ],

  // Database operations that require extra approval
  sensitiveDatabaseOps: [
    /DROP/i,
    /TRUNCATE/i,
    /ALTER\s+TABLE/i,
    /DELETE\s+FROM\s+\w+\s*$/i, // DELETE without WHERE
    /UPDATE\s+\w+\s+SET/i // UPDATE without WHERE
  ]
};

/**
 * Action Approval Timeouts
 * How long to wait for user approval before auto-denying
 */
const APPROVAL_TIMEOUTS = {
  [RISK_LEVELS.SAFE]: 0, // No timeout (auto-approved)
  [RISK_LEVELS.LOW]: 120, // 2 minutes
  [RISK_LEVELS.MODERATE]: 300, // 5 minutes
  [RISK_LEVELS.HIGH]: 600, // 10 minutes
  [RISK_LEVELS.CRITICAL]: 1800 // 30 minutes
};

/**
 * Guardrail Override Permissions
 * Who can override guardrails for emergency situations
 */
const OVERRIDE_PERMISSIONS = {
  free: false, // No override allowed
  pro: true, // Can override LOW/MODERATE
  'pro-plus': true, // Can override LOW/MODERATE/HIGH
  enterprise: true // Can override any (with logging)
};

/**
 * Get risk level for an action
 */
function getActionRiskLevel(actionType) {
  return ACTION_RISK_LEVELS[actionType] || RISK_LEVELS.CRITICAL;
}

/**
 * Check if action requires approval for given tier
 */
function requiresApproval(actionType, tier) {
  const riskLevel = getActionRiskLevel(actionType);
  const tierConfig = TIER_AUTONOMY_CONFIG[tier] || TIER_AUTONOMY_CONFIG.free;

  return tierConfig.requireApprovalRiskLevels.includes(riskLevel);
}

/**
 * Check if action is sensitive (file/command pattern matching)
 */
function isSensitiveAction(actionType, details) {
  // Check file patterns
  if (details.filePath) {
    const isSensitiveFile = SENSITIVE_PATTERNS.sensitiveFiles.some(pattern =>
      pattern.test(details.filePath)
    );
    if (isSensitiveFile) return true;
  }

  // Check command patterns
  if (details.command) {
    const isSensitiveCommand = SENSITIVE_PATTERNS.sensitiveCommands.some(
      pattern => pattern.test(details.command)
    );
    if (isSensitiveCommand) return true;
  }

  // Check database query patterns
  if (details.query) {
    const isSensitiveQuery = SENSITIVE_PATTERNS.sensitiveDatabaseOps.some(
      pattern => pattern.test(details.query)
    );
    if (isSensitiveQuery) return true;
  }

  return false;
}

/**
 * Get approval timeout for action
 */
function getApprovalTimeout(actionType) {
  const riskLevel = getActionRiskLevel(actionType);
  return APPROVAL_TIMEOUTS[riskLevel] || APPROVAL_TIMEOUTS[RISK_LEVELS.CRITICAL];
}

/**
 * Check if tier can override guardrails
 */
function canOverride(tier, riskLevel) {
  if (!OVERRIDE_PERMISSIONS[tier]) return false;

  if (tier === 'pro') {
    return [RISK_LEVELS.LOW, RISK_LEVELS.MODERATE].includes(riskLevel);
  }

  if (tier === 'pro-plus') {
    return [
      RISK_LEVELS.LOW,
      RISK_LEVELS.MODERATE,
      RISK_LEVELS.HIGH
    ].includes(riskLevel);
  }

  if (tier === 'enterprise') {
    return true; // Can override any
  }

  return false;
}

/**
 * Get tier autonomy configuration
 */
function getTierAutonomyConfig(tier) {
  return TIER_AUTONOMY_CONFIG[tier] || TIER_AUTONOMY_CONFIG.free;
}

module.exports = {
  RISK_LEVELS,
  ACTION_RISK_LEVELS,
  TIER_AUTONOMY_CONFIG,
  SENSITIVE_PATTERNS,
  APPROVAL_TIMEOUTS,
  OVERRIDE_PERMISSIONS,
  getActionRiskLevel,
  requiresApproval,
  isSensitiveAction,
  getApprovalTimeout,
  canOverride,
  getTierAutonomyConfig
};
