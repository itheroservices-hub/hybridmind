# Observability Dashboard Integration Guide

## Overview

The HybridMind observability dashboard provides comprehensive monitoring and auditing of all agent activities. This guide shows how to integrate observability into agent execution code.

## Components

1. **Observability Engine** - Logs all agent actions, rationale, tool calls
2. **Audit Logger** - Immutable audit trails for compliance
3. **Quality Index** - Agent self-reporting and quality metrics
4. **Real-Time Monitor** - WebSocket integration for live dashboard

## Quick Start

### 1. Start Observability Session

```javascript
const { observabilityEngine } = require('../services/observability/observabilityIntegration');

// Start session for user
const sessionId = observabilityEngine.startSession({
  userId: req.user.id,
  tier: req.user.tier,
  context: {
    requestId: req.id,
    endpoint: req.path
  }
});

// Store sessionId for subsequent calls
req.sessionId = sessionId;
```

### 2. Wrap Agent Execution

```javascript
const { executeWithObservability } = require('../services/observability/observabilityIntegration');

// Execute agent with full observability
const result = await executeWithObservability({
  sessionId: req.sessionId,
  userId: req.user.id,
  tier: req.user.tier,
  agentId: 'agent-1',
  agentRole: 'analyst',
  task: 'Analyze user requirements',
  model: 'groq/llama-3.1-8b-instant',
  context: { requirements: userInput },
  
  executionFn: async ({ logThinking, logAction, logToolCall, logDecision }) => {
    // Log agent reasoning
    logThinking(
      'Analyzing requirements for complexity and scope',
      'Need to determine if task is simple or complex',
      ['simple', 'moderate', 'complex']
    );
    
    // Log decision
    logDecision(
      'complex',
      'Task involves multiple components and dependencies',
      ['simple', 'moderate', 'complex'],
      85 // confidence %
    );
    
    // Log tool call
    const toolStartTime = Date.now();
    try {
      const codeAnalysis = await analyzeCode(userInput);
      logToolCall(
        'analyzeCode',
        { code: userInput },
        'Need to analyze code structure',
        codeAnalysis,
        Date.now() - toolStartTime,
        true,
        null
      );
    } catch (error) {
      logToolCall(
        'analyzeCode',
        { code: userInput },
        'Need to analyze code structure',
        null,
        Date.now() - toolStartTime,
        false,
        error.message
      );
    }
    
    // Log action
    const actionStartTime = Date.now();
    const analysis = await performAnalysis(userInput);
    logAction(
      'analyze_requirements',
      'Breaking down requirements into components',
      userInput,
      analysis,
      Date.now() - actionStartTime
    );
    
    return analysis;
  }
});

// result contains: { output, traceId, duration, success }
```

### 3. Report Quality

```javascript
const { reportQuality } = require('../services/observability/observabilityIntegration');

// Report quality metrics after execution
const reportId = reportQuality({
  sessionId: req.sessionId,
  traceId: result.traceId,
  agentId: 'agent-1',
  agentRole: 'analyst',
  action: 'analyze_requirements',
  task: 'Analyze user requirements',
  output: result.output,
  dimensions: {
    accuracy: 85,
    completeness: 90,
    relevance: 95,
    coherence: 88,
    efficiency: 75,
    timeliness: 92
  },
  confidence: 85,
  reasoning: 'High confidence based on clear requirements and successful tool execution',
  errors: [], // or [{ type: 'hallucination', message: '...' }]
  metadata: {
    tokensUsed: 1500,
    cost: 0.0015
  }
});
```

### 4. Audit Critical Operations

```javascript
const { auditLogger } = require('../services/observability/observabilityIntegration');

// Audit data access
auditLogger.auditDataAccess({
  userId: req.user.id,
  sessionId: req.sessionId,
  resource: 'user_code',
  action: 'read',
  recordCount: 1,
  ipAddress: req.ip,
  details: { fileType: 'javascript' }
});

// Audit data modification
auditLogger.auditDataModification({
  userId: req.user.id,
  sessionId: req.sessionId,
  resource: 'generated_code',
  action: 'create',
  before: null,
  after: generatedCode,
  ipAddress: req.ip
});

// Audit tier change
auditLogger.auditTierChange({
  userId: req.user.id,
  sessionId: req.sessionId,
  fromTier: 'free',
  toTier: 'pro',
  reason: 'upgrade_purchase',
  ipAddress: req.ip
});
```

### 5. End Session

```javascript
// At the end of request
observabilityEngine.endSession(req.sessionId);
```

## Simple Logging (Without Wrapper)

If you don't need the full wrapper, use simple logging functions:

```javascript
const { 
  logAgentThinking,
  logAgentAction,
  logToolCall,
  logDecision
} = require('../services/observability/observabilityIntegration');

// Start trace manually
const traceId = observabilityEngine.logAgentStart({
  sessionId,
  agentId: 'agent-1',
  agentRole: 'coder',
  task: 'Generate Python code',
  model: 'groq/llama-3.1-70b-versatile',
  context: {}
});

// Log thinking
logAgentThinking(
  sessionId,
  traceId,
  'agent-1',
  'Determining code structure',
  'Need to decide between class-based or functional approach',
  ['class-based', 'functional']
);

// Log decision
logDecision(
  sessionId,
  traceId,
  'agent-1',
  'class-based',
  'Task complexity requires OOP structure',
  ['class-based', 'functional'],
  75,
  { complexity: 'high' }
);

// Log tool call
logToolCall(
  sessionId,
  traceId,
  'agent-1',
  'syntax_checker',
  { code: generatedCode },
  'Validate generated code syntax',
  { valid: true, errors: [] },
  150,
  true,
  null
);

// Complete
observabilityEngine.logAgentComplete({
  sessionId,
  traceId,
  agentId: 'agent-1',
  output: generatedCode,
  qualityMetrics: {},
  success: true
});
```

## Workflow Integration

```javascript
const { logWorkflowStep, auditWorkflow } = require('../services/observability/observabilityIntegration');

const workflowId = `workflow_${Date.now()}`;

// Log each workflow step
logWorkflowStep({
  sessionId,
  workflowId,
  stepNumber: 1,
  stepName: 'analyze',
  agentId: 'analyst-1',
  input: userRequirements,
  output: analysis,
  duration: 2000,
  success: true
});

logWorkflowStep({
  sessionId,
  workflowId,
  stepNumber: 2,
  stepName: 'code',
  agentId: 'coder-1',
  input: analysis,
  output: code,
  duration: 5000,
  success: true
});

// Audit complete workflow
auditWorkflow({
  userId: req.user.id,
  sessionId,
  workflowId,
  workflowMode: 'pipeline',
  action: 'workflow_complete',
  steps: 3,
  duration: 8000,
  cost: 0.008,
  success: true,
  details: {
    agentsUsed: ['analyst-1', 'coder-1', 'reviewer-1']
  }
});
```

## Real-Time Monitoring

The system automatically broadcasts events to WebSocket clients. Subscribe from frontend:

```javascript
// Frontend WebSocket subscription
const socket = io('http://localhost:3000');

// Join workspace for session
socket.emit('join_workspace', { 
  workspaceId: sessionId,
  userId: currentUser.id 
});

// Listen for observability events
socket.on('observability:agent_thinking', (data) => {
  console.log('Agent thinking:', data.reasoning);
  updateDashboard('thinking', data);
});

socket.on('observability:agent_action', (data) => {
  console.log('Agent action:', data.action);
  updateDashboard('action', data);
});

socket.on('observability:tool_call', (data) => {
  console.log('Tool call:', data.toolName, data.success ? '✓' : '✗');
  updateDashboard('tool', data);
});

socket.on('observability:decision', (data) => {
  console.log('Decision:', data.decision, `(${data.confidence}% confidence)`);
  updateDashboard('decision', data);
});

socket.on('observability:alert', (alert) => {
  console.warn('Alert:', alert.type, alert.message);
  showAlert(alert);
});

socket.on('observability:quality_report', (data) => {
  console.log('Quality:', data.report.quality.overallScore);
  updateQualityMetrics(data.report);
});
```

## API Endpoints

### Sessions
- `POST /api/observability/sessions` - Start session
- `POST /api/observability/sessions/:sessionId/end` - End session
- `GET /api/observability/sessions/:sessionId` - Get session details

### Logs
- `GET /api/observability/logs` - Query logs (filters: sessionId, type, level, startTime, endTime)
- `GET /api/observability/traces/:traceId` - Get trace details
- `GET /api/observability/logs/export` - Export logs (format: json, csv, ndjson)
- `GET /api/observability/metrics` - Get metrics

### Audits
- `GET /api/observability/audits` - Query audits (filters: userId, category, severity)
- `GET /api/observability/audits/verify` - Verify audit chain integrity
- `POST /api/observability/audits/compliance-report` - Generate compliance report (GDPR, SOC2)
- `GET /api/observability/audits/export` - Export audits

### Quality
- `GET /api/observability/quality` - Query quality reports
- `GET /api/observability/quality/agents/:agentRole` - Get agent profile
- `GET /api/observability/quality/agents` - Get all agent profiles
- `GET /api/observability/quality/errors` - Get error patterns
- `GET /api/observability/quality/suggestions` - Get improvement suggestions
- `POST /api/observability/quality/suggestions/:suggestionId/apply` - Mark suggestion applied
- `GET /api/observability/quality/benchmark` - Get quality benchmark
- `GET /api/observability/quality/export` - Export quality reports

### Monitoring
- `POST /api/observability/monitor/start` - Start monitoring workspace
- `POST /api/observability/monitor/stop` - Stop monitoring workspace
- `GET /api/observability/monitor/active` - Get active monitors
- `GET /api/observability/monitor/alerts` - Get alert history
- `POST /api/observability/monitor/thresholds` - Update alert thresholds
- `GET /api/observability/monitor/stats` - Get monitoring stats

## Best Practices

1. **Always start/end sessions** - Ensures clean tracking boundaries
2. **Use executeWithObservability wrapper** - Simplifies integration
3. **Report quality metrics** - Enables improvement tracking
4. **Audit critical operations** - Compliance and security
5. **Set appropriate confidence scores** - Be honest about uncertainty
6. **Log all tool calls** - Include success/failure and duration
7. **Provide clear rationale** - Helps debugging and transparency
8. **Include context** - More context = better analysis

## Performance Considerations

- Logs are kept in memory (50,000 events max)
- Audits use blockchain-style chain (100,000 max)
- Quality reports stored (50,000 max)
- Auto-cleanup available via `/api/observability/cleanup`
- Export data regularly for long-term storage

## Compliance Features

- **GDPR**: Data access/modification tracking, export/deletion audits
- **SOC2**: Authentication, security events, configuration changes
- **HIPAA**: Data access tracking (enable in auditDataAccess)
- **PCI-DSS**: Payment event auditing

## Example: Full Request Flow

```javascript
// In your route handler
router.post('/agent/analyze', async (req, res) => {
  // 1. Start observability session
  const sessionId = observabilityEngine.startSession({
    userId: req.user.id,
    tier: req.user.tier,
    context: { endpoint: '/agent/analyze' }
  });

  try {
    // 2. Audit request
    auditLogger.auditDataAccess({
      userId: req.user.id,
      sessionId,
      resource: 'user_input',
      action: 'read',
      recordCount: 1,
      ipAddress: req.ip
    });

    // 3. Execute with observability
    const result = await executeWithObservability({
      sessionId,
      userId: req.user.id,
      tier: req.user.tier,
      agentId: 'analyst-1',
      agentRole: 'analyst',
      task: 'Analyze requirements',
      model: 'groq/llama-3.1-70b-versatile',
      context: { input: req.body.requirements },
      executionFn: async ({ logThinking, logDecision, logAction }) => {
        // Your agent logic here
        logThinking('Analyzing complexity', 'Determine scope', ['simple', 'complex']);
        logDecision('complex', 'Multiple dependencies detected', ['simple', 'complex'], 80);
        
        const analysis = await analyzeRequirements(req.body.requirements);
        logAction('analyze', 'Breaking down requirements', req.body.requirements, analysis, 2000);
        
        return analysis;
      }
    });

    // 4. Report quality
    reportQuality({
      sessionId,
      traceId: result.traceId,
      agentId: 'analyst-1',
      agentRole: 'analyst',
      action: 'analyze',
      task: 'Analyze requirements',
      output: result.output,
      dimensions: {
        accuracy: 90,
        completeness: 85,
        relevance: 95
      },
      confidence: 85,
      reasoning: 'Clear requirements with successful analysis'
    });

    // 5. End session
    observabilityEngine.endSession(sessionId);

    // 6. Return response
    res.json({
      success: true,
      analysis: result.output,
      traceId: result.traceId
    });

  } catch (error) {
    observabilityEngine.endSession(sessionId);
    throw error;
  }
});
```

## Summary

The observability dashboard provides:
- ✅ Complete agent action logging
- ✅ Tool call tracking with success/failure
- ✅ Decision logging with rationale
- ✅ Quality self-reporting
- ✅ Immutable audit trails
- ✅ Real-time WebSocket monitoring
- ✅ Compliance reporting (GDPR, SOC2)
- ✅ Error pattern analysis
- ✅ Improvement suggestions
- ✅ Post-run audits and exports

Start integrating today for complete transparency and debugging capabilities!
