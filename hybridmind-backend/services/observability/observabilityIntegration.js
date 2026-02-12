/**
 * Observability Integration Helper
 * 
 * Utility functions to easily integrate observability into agent execution.
 * Provides wrapper methods for logging agent actions, tool calls, and decisions.
 */

const observabilityEngine = require('./observabilityEngine');
const auditLogger = require('./auditLogger');
const qualityIndex = require('./qualityIndex');
const realtimeMonitor = require('./realtimeMonitor');
const logger = require('../../utils/logger');

/**
 * Wrap agent execution with observability
 */
async function executeWithObservability({
  sessionId,
  userId,
  tier,
  agentId,
  agentRole,
  task,
  model,
  context = {},
  executionFn
}) {
  // Start agent trace
  const traceId = observabilityEngine.logAgentStart({
    sessionId,
    agentId,
    agentRole,
    task,
    model,
    context
  });

  // Audit agent execution start
  auditLogger.auditAgentExecution({
    userId,
    sessionId,
    agentId,
    agentRole,
    action: 'agent_start',
    task,
    model,
    tier,
    cost: 0,
    success: true
  });

  const startTime = Date.now();
  let success = false;
  let output = null;
  let error = null;

  try {
    // Execute the actual agent logic
    output = await executionFn({
      logThinking: (reasoning, rationale, options) => {
        observabilityEngine.logAgentThinking({
          sessionId,
          traceId,
          agentId,
          reasoning,
          rationale,
          options
        });
      },
      logAction: (action, rationale, input, actionOutput, duration) => {
        observabilityEngine.logAgentAction({
          sessionId,
          traceId,
          agentId,
          action,
          rationale,
          input,
          output: actionOutput,
          duration,
          success: true
        });
      },
      logToolCall: (toolName, parameters, rationale, result, duration, toolSuccess, toolError) => {
        observabilityEngine.logToolCall({
          sessionId,
          traceId,
          agentId,
          toolName,
          parameters,
          rationale,
          result,
          duration,
          success: toolSuccess,
          error: toolError
        });
      },
      logDecision: (decision, reasoning, alternatives, confidence) => {
        observabilityEngine.logDecision({
          sessionId,
          traceId,
          agentId,
          decision,
          reasoning,
          alternatives,
          confidence,
          context
        });
      }
    });

    success = true;

  } catch (err) {
    error = err;
    success = false;

    // Log error
    observabilityEngine.logEvent({
      sessionId,
      traceId,
      type: 'agent_error',
      level: 'error',
      message: `Agent ${agentRole} error: ${err.message}`,
      data: {
        agentId,
        error: err.message,
        stack: err.stack
      }
    });

    // Audit error
    auditLogger.auditAgentExecution({
      userId,
      sessionId,
      agentId,
      agentRole,
      action: 'agent_error',
      task,
      model,
      tier,
      cost: 0,
      success: false,
      details: { error: err.message }
    });
  }

  const duration = Date.now() - startTime;

  // Log agent completion
  observabilityEngine.logAgentComplete({
    sessionId,
    traceId,
    agentId,
    output,
    qualityMetrics: {},
    success
  });

  // Audit completion
  auditLogger.auditAgentExecution({
    userId,
    sessionId,
    agentId,
    agentRole,
    action: 'agent_complete',
    task,
    model,
    tier,
    cost: 0,
    success,
    details: { duration }
  });

  if (error) {
    throw error;
  }

  return {
    output,
    traceId,
    duration,
    success
  };
}

/**
 * Report quality for agent output
 */
function reportQuality({
  sessionId,
  traceId,
  agentId,
  agentRole,
  action,
  task,
  output,
  dimensions = {},
  confidence,
  reasoning = '',
  errors = [],
  metadata = {}
}) {
  const reportId = qualityIndex.reportQuality({
    sessionId,
    traceId,
    agentId,
    agentRole,
    action,
    task,
    output,
    dimensions,
    confidence,
    reasoning,
    errors,
    metadata
  });

  // Broadcast to real-time monitor
  const report = qualityIndex.queryReports({ 
    limit: 1,
    sortOrder: 'desc'
  })[0];

  if (report) {
    realtimeMonitor.broadcastQualityReport(report);
  }

  return reportId;
}

/**
 * Log workflow step
 */
function logWorkflowStep({
  sessionId,
  workflowId,
  stepNumber,
  stepName,
  agentId,
  input,
  output,
  duration,
  success = true
}) {
  observabilityEngine.logWorkflowStep({
    sessionId,
    workflowId,
    stepNumber,
    stepName,
    agentId,
    input,
    output,
    duration,
    success
  });
}

/**
 * Audit workflow execution
 */
function auditWorkflow({
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
  return auditLogger.auditWorkflow({
    userId,
    sessionId,
    workflowId,
    workflowMode,
    action,
    steps,
    duration,
    cost,
    success,
    details
  });
}

/**
 * Simple logging helpers for backward compatibility
 */
function logAgentThinking(sessionId, traceId, agentId, reasoning, rationale, options = []) {
  observabilityEngine.logAgentThinking({
    sessionId,
    traceId,
    agentId,
    reasoning,
    rationale,
    options
  });
}

function logAgentAction(sessionId, traceId, agentId, action, rationale, input, output, duration, success = true) {
  observabilityEngine.logAgentAction({
    sessionId,
    traceId,
    agentId,
    action,
    rationale,
    input,
    output,
    duration,
    success
  });
}

function logToolCall(sessionId, traceId, agentId, toolName, parameters, rationale, result, duration, success = true, error = null) {
  observabilityEngine.logToolCall({
    sessionId,
    traceId,
    agentId,
    toolName,
    parameters,
    rationale,
    result,
    duration,
    success,
    error
  });
}

function logDecision(sessionId, traceId, agentId, decision, reasoning, alternatives = [], confidence, context = {}) {
  observabilityEngine.logDecision({
    sessionId,
    traceId,
    agentId,
    decision,
    reasoning,
    alternatives,
    confidence,
    context
  });
}

module.exports = {
  executeWithObservability,
  reportQuality,
  logWorkflowStep,
  auditWorkflow,
  logAgentThinking,
  logAgentAction,
  logToolCall,
  logDecision,
  
  // Direct access to engines
  observabilityEngine,
  auditLogger,
  qualityIndex,
  realtimeMonitor
};
