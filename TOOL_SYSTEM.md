# HybridMind Tool System

Complete technical documentation for HybridMind's Multi-Modal Tool System.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tool Registry](#tool-registry)
4. [Available Tools](#available-tools)
5. [Permission System](#permission-system)
6. [Tool Execution](#tool-execution)
7. [API Reference](#api-reference)
8. [Workflow Integration](#workflow-integration)
9. [Logging & Monitoring](#logging--monitoring)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The HybridMind Tool System enables AI agents to perform real-world actions beyond text generation. Tools include database queries, web searches, CRM operations, code generation, and more.

### Key Features

- **Multi-Modal Actions**: Database, web, CRM, code generation, file ops, HTTP
- **JSON Schema Validation**: Type-safe parameter validation
- **Permission Management**: Role-based access control with risk levels
- **Declarative Prompts**: Natural language → tool calls
- **Comprehensive Logging**: All executions logged with audit trail
- **Cost Tracking**: Per-tool cost estimation and tracking
- **Tool Discovery**: Search and filter tools by category/capability

### System Requirements

- Node.js ≥ 16
- HybridMind backend running
- Optional: Database drivers (pg, mysql2, mongodb)
- Optional: Search API keys (Brave Search)
- Optional: CRM API credentials (Salesforce, HubSpot)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  (REST API, Workflow Engine, Direct Code Access)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Tool Executor                              │
│  • Parse Request                                                 │
│  • Validate Parameters (JSON Schema)                            │
│  • Check Permissions (RBAC)                                     │
│  • Execute Handler                                               │
│  • Log Result                                                    │
│  • Return Response                                               │
└──────┬────────────────┬─────────────────┬────────────────────┬──┘
       │                │                 │                    │
       ▼                ▼                 ▼                    ▼
┌────────────┐   ┌─────────────┐   ┌──────────┐      ┌──────────────┐
│    Tool    │   │ Permission  │   │   Tool   │      │  Tool Logger │
│  Registry  │   │   Manager   │   │  Schemas │      │              │
│            │   │             │   │          │      │ • File Logs  │
│ • Handlers │   │ • Roles     │   │ • JSON   │      │ • Stats      │
│ • Metadata │   │ • Agents    │   │   Schema │      │ • Analytics  │
│ • Stats    │   │ • Risk      │   │ • Validation│   │              │
└────────────┘   └─────────────┘   └──────────┘      └──────────────┘
       │
       └─────┬──────────┬─────────┬─────────┬─────────┬──────────┐
             ▼          ▼         ▼         ▼         ▼          ▼
      ┌──────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐  ┌──────┐
      │ Database │ │  Web   │ │ CRM  │ │ Code │ │ File │  │ HTTP │
      │   Tool   │ │ Search │ │ Tool │ │ Gen  │ │ Ops  │  │ Tool │
      └──────────┘ └────────┘ └──────┘ └──────┘ └──────┘  └──────┘
```

### Component Responsibilities

**Tool Schemas** (`toolSchemas.js`)
- Define tool interface contracts
- Provide JSON Schema validation
- Store tool metadata (permissions, cost, risk)
- Export schema retrieval functions

**Tool Registry** (`toolRegistry.js`)
- Register tool handlers
- Validate tool parameters
- Track usage statistics
- Provide search/discovery

**Tool Executor** (`toolExecutor.js`)
- Orchestrate execution flow
- Validate permissions
- Call tool handlers
- Log all executions
- Handle errors

**Permission Manager** (`permissionManager.js`)
- Manage agents and roles
- Check permissions
- Track permission requests
- Enforce risk levels

**Tool Logger** (`toolLogger.js`)
- Write execution logs
- Sanitize sensitive data
- Provide analytics
- Track costs

---

## Tool Registry

The tool registry is the central hub for tool discovery and management.

### Registration

Tools are auto-registered at startup:

```javascript
const toolRegistry = require('./services/tools/toolRegistry');
const databaseTool = require('./services/tools/databaseTool');

// Registration happens automatically on require
// Handlers are registered in toolRegistry.js initialization
```

### Tool Metadata

Each tool has:

```javascript
{
  name: 'toolName',              // Unique identifier
  version: '1.0.0',              // Semantic version
  description: 'What it does',   // Human-readable description
  category: 'category',          // data, search, crm, code, filesystem, network
  schema: { /* JSON Schema */ }, // Parameter validation
  permissions: ['perm1'],        // Required permissions
  riskLevel: 'medium',           // low, medium, high
  costPerCall: 0.001,            // Estimated cost ($)
  examples: [ /* ... */ ],       // Usage examples
  enabled: true                  // Can be disabled
}
```

### Registry API

```javascript
const toolRegistry = require('./services/tools/toolRegistry');

// Get all tools
const tools = toolRegistry.getAllTools();

// Get specific tool
const tool = toolRegistry.getTool('webSearch');

// Search tools
const results = toolRegistry.searchTools('database');

// Get by category
const dataTools = toolRegistry.getToolsByCategory('data');

// Get statistics
const stats = toolRegistry.getToolStats('webSearch');
// Returns: { totalCalls, successfulCalls, averageExecutionTime, totalCost, lastCalled }
```

---

## Available Tools

### 1. Database Query Tool

**Name:** `databaseQuery`  
**Category:** `data`  
**Risk Level:** `medium`  
**Cost:** $0.001/call

**Description:** Execute SQL queries against configured databases (PostgreSQL, MySQL, MongoDB).

**Parameters:**

```javascript
{
  database: string,           // Required: Database name
  query: string,              // Required: SQL query
  parameters: array,          // Optional: Query parameters (for prepared statements)
  limit: number,              // Optional: Max rows (default: 100, max: 1000)
  timeout: number             // Optional: Query timeout in ms (default: 30000)
}
```

**Permissions Required:**
- `read_database` (for SELECT)
- `query_database` (for INSERT/UPDATE/DELETE)

**Example:**

```javascript
{
  toolName: 'databaseQuery',
  parameters: {
    database: 'users',
    query: 'SELECT * FROM users WHERE email = ?',
    parameters: ['user@example.com'],
    limit: 10
  }
}
```

**Safety Features:**
- Blocks dangerous operations (DROP, TRUNCATE)
- Enforces query timeouts
- Auto-applies LIMIT to unbounded queries
- Parameterized query support (prevents SQL injection)

**Response:**

```javascript
{
  success: true,
  data: [ /* rows */ ],
  rowCount: 10,
  executionTime: 45,
  database: 'users'
}
```

---

### 2. Web Search Tool

**Name:** `webSearch`  
**Category:** `search`  
**Risk Level:** `low`  
**Cost:** $0.002/call

**Description:** Search the web using DuckDuckGo or Brave Search APIs.

**Parameters:**

```javascript
{
  query: string,              // Required: Search query
  provider: string,           // Optional: 'duckduckgo', 'brave', 'auto' (default: 'auto')
  maxResults: number,         // Optional: Max results (default: 10, max: 20)
  safesearch: string,         // Optional: 'strict', 'moderate', 'off' (default: 'moderate')
  freshness: string           // Optional: 'day', 'week', 'month', 'year'
}
```

**Permissions Required:**
- `web_search`
- `external_api`

**Example:**

```javascript
{
  toolName: 'webSearch',
  parameters: {
    query: 'Node.js best practices 2026',
    maxResults: 5,
    freshness: 'week'
  }
}
```

**Response:**

```javascript
{
  success: true,
  results: [
    {
      title: 'Node.js Best Practices Guide',
      url: 'https://example.com/article',
      snippet: 'Complete guide to...',
      publishedDate: '2026-01-15'
    }
  ],
  resultCount: 5,
  provider: 'duckduckgo',
  cached: false
}
```

**Caching:**
- Results cached for 1 hour
- Cache key: `query + provider + maxResults`
- Get cache stats: `webSearchTool.getCacheStats()`

---

### 3. CRM Writer Tool

**Name:** `crmWrite`  
**Category:** `crm`  
**Risk Level:** `medium`  
**Cost:** $0.005/call

**Description:** Write data to CRM systems (Salesforce, HubSpot, generic webhooks).

**Parameters:**

```javascript
{
  system: string,             // Required: 'salesforce', 'hubspot', 'webhook'
  action: string,             // Required: 'create_contact', 'update_contact', 'create_lead',
                              //           'update_lead', 'create_deal', 'update_deal', 'create_note'
  data: object,               // Required: Data to write (varies by action)
  recordId: string,           // Optional: For updates (required for update_* actions)
  webhookUrl: string          // Required if system='webhook'
}
```

**Permissions Required:**
- `write_crm`
- `modify_contacts` (for contact operations)

**Example - Create Contact:**

```javascript
{
  toolName: 'crmWrite',
  parameters: {
    system: 'salesforce',
    action: 'create_contact',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      company: 'Acme Corp'
    }
  }
}
```

**Example - Update Deal:**

```javascript
{
  toolName: 'crmWrite',
  parameters: {
    system: 'hubspot',
    action: 'update_deal',
    recordId: 'deal_12345',
    data: {
      stage: 'closed_won',
      amount: 50000
    }
  }
}
```

**Example - Webhook:**

```javascript
{
  toolName: 'crmWrite',
  parameters: {
    system: 'webhook',
    action: 'custom',
    webhookUrl: 'https://hooks.zapier.com/...',
    data: {
      event: 'new_signup',
      user: { email: 'user@example.com' }
    }
  }
}
```

**Response:**

```javascript
{
  success: true,
  recordId: 'contact_12345',
  system: 'salesforce',
  action: 'create_contact'
}
```

---

### 4. Code Generator Tool

**Name:** `codeGenerate`  
**Category:** `code`  
**Risk Level:** `low`  
**Cost:** $0.015/call

**Description:** Generate code in various languages using AI (gpt-4o-mini).

**Parameters:**

```javascript
{
  language: string,           // Required: 'javascript', 'typescript', 'python', 'java',
                              //           'go', 'rust', 'sql', 'html', 'css'
  description: string,        // Required: What the code should do
  template: string,           // Optional: 'function', 'class', 'api_endpoint',
                              //           'react_component', 'test', 'cli'
  style: string,              // Optional: 'standard', 'airbnb', 'google', 'pep8'
  includeComments: boolean,   // Optional: Add inline comments (default: true)
  includeTests: boolean,      // Optional: Generate tests (default: false)
  complexity: string          // Optional: 'simple', 'intermediate', 'advanced'
}
```

**Permissions Required:**
- `generate_code`

**Example - Function:**

```javascript
{
  toolName: 'codeGenerate',
  parameters: {
    language: 'javascript',
    description: 'Function to validate email addresses using regex',
    template: 'function',
    includeComments: true,
    includeTests: true
  }
}
```

**Example - React Component:**

```javascript
{
  toolName: 'codeGenerate',
  parameters: {
    language: 'typescript',
    description: 'Login form component with email and password fields',
    template: 'react_component',
    style: 'airbnb',
    complexity: 'intermediate'
  }
}
```

**Response:**

```javascript
{
  success: true,
  code: '// Generated code...',
  tests: '// Generated tests...',  // If includeTests: true
  language: 'javascript',
  linesOfCode: 45,
  estimatedComplexity: 'intermediate',
  modelUsed: 'gpt-4o-mini'
}
```

**Supported Templates:**

1. **function** - Standalone function
2. **class** - Class definition with methods
3. **api_endpoint** - REST API endpoint (Express/FastAPI)
4. **react_component** - React functional component
5. **test** - Unit tests
6. **cli** - Command-line interface

---

### 5. File Operation Tool

**Name:** `fileOperation`  
**Category:** `filesystem`  
**Risk Level:** `high`  
**Cost:** $0.0001/call

**Description:** Perform file system operations (read, write, list, delete).

**Parameters:**

```javascript
{
  operation: string,          // Required: 'read', 'write', 'list', 'delete'
  path: string,               // Required: File/directory path
  content: string,            // Required for 'write': File content
  encoding: string            // Optional: 'utf8', 'base64' (default: 'utf8')
}
```

**Permissions Required:**
- `read_files` (for read/list)
- `write_files` (for write)
- `delete_files` (for delete)

**Example:**

```javascript
{
  toolName: 'fileOperation',
  parameters: {
    operation: 'read',
    path: '/path/to/file.txt'
  }
}
```

---

### 6. HTTP Request Tool

**Name:** `httpRequest`  
**Category:** `network`  
**Risk Level:** `medium`  
**Cost:** $0.001/call

**Description:** Make HTTP/HTTPS requests to external APIs.

**Parameters:**

```javascript
{
  url: string,                // Required: Request URL
  method: string,             // Required: 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
  headers: object,            // Optional: Request headers
  body: object,               // Optional: Request body (for POST/PUT/PATCH)
  timeout: number             // Optional: Request timeout in ms (default: 30000)
}
```

**Permissions Required:**
- `http_request`
- `external_api`

**Example:**

```javascript
{
  toolName: 'httpRequest',
  parameters: {
    url: 'https://api.example.com/data',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer token123'
    }
  }
}
```

---

## Permission System

### Roles

Pre-defined roles with associated permissions:

#### 1. Admin Role

**Permissions:** `*` (all)  
**Risk Clearance:** `all`  
**Use Case:** System administrators

```javascript
{
  role: 'admin',
  permissions: ['*'],
  maxRiskLevel: 'all'
}
```

#### 2. Developer Role

**Permissions:**
- `read_database`
- `query_database`
- `web_search`
- `generate_code`
- `read_files`
- `write_files`
- `http_request`
- `external_api`

**Risk Clearance:** `high`  
**Use Case:** Development tasks, code generation

#### 3. Analyst Role

**Permissions:**
- `read_database`
- `query_database`
- `web_search`
- `external_api`

**Risk Clearance:** `medium`  
**Use Case:** Data analysis, research

#### 4. Marketing Role

**Permissions:**
- `write_crm`
- `modify_contacts`
- `web_search`
- `external_api`

**Risk Clearance:** `medium`  
**Use Case:** CRM operations, marketing automation

#### 5. Readonly Role

**Permissions:**
- `read_database`
- `web_search`
- `read_files`

**Risk Clearance:** `low`  
**Use Case:** Read-only access

### Permission Checking

```javascript
const permissionManager = require('./services/tools/permissionManager');

// Create agent
const agent = permissionManager.createAgent('analyst-1', 'analyst');

// Check permission
const hasPermission = permissionManager.hasPermission('analyst-1', 'read_database');
// Returns: true

// Check tool access
const canUse = permissionManager.canUseTool('analyst-1', 'databaseQuery');
// Returns: { allowed: true, reason: 'Permission granted' }

// Grant additional permission
permissionManager.grantPermission('analyst-1', 'write_crm');

// Revoke permission
permissionManager.revokePermission('analyst-1', 'write_crm');
```

### Risk Levels

Tools are assigned risk levels that must match agent clearance:

| Risk Level | Description | Example Tools |
|------------|-------------|---------------|
| **low** | Safe operations, no data modification | webSearch, read operations |
| **medium** | Data modification, external API calls | databaseQuery (SELECT), crmWrite, httpRequest |
| **high** | Dangerous operations, file system access | databaseQuery (DELETE), fileOperation (delete) |

**Enforcement:**

```javascript
// Agent with 'medium' clearance
const agent = permissionManager.createAgent('agent-1', 'analyst');

// Can use 'low' and 'medium' risk tools
permissionManager.canUseTool('agent-1', 'webSearch');      // ✅ allowed (low)
permissionManager.canUseTool('agent-1', 'databaseQuery');  // ✅ allowed (medium)
permissionManager.canUseTool('agent-1', 'fileOperation');  // ❌ denied (high)
```

### Permission Logging

All permission checks are logged:

```javascript
const log = permissionManager.getPermissionLog();
// Returns array of:
{
  timestamp: '2026-01-28T10:30:00Z',
  agentId: 'analyst-1',
  permission: 'read_database',
  granted: true
}
```

---

## Tool Execution

### Execution Flow

```
1. Receive Request
        ↓
2. Validate Tool Exists
        ↓
3. Check Agent Permissions
        ↓
4. Validate Parameters (JSON Schema)
        ↓
5. Execute Tool Handler
        ↓
6. Log Result
        ↓
7. Update Statistics
        ↓
8. Return Response
```

### Direct Execution

```javascript
const toolExecutor = require('./services/tools/toolExecutor');

const result = await toolExecutor.executeTool({
  toolName: 'webSearch',
  parameters: {
    query: 'AI news 2026',
    maxResults: 5
  },
  agentId: 'analyst-1'
});

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### Tool Chains

Execute multiple tools sequentially:

```javascript
const result = await toolExecutor.executeToolChain({
  toolCalls: [
    {
      toolName: 'databaseQuery',
      parameters: {
        database: 'users',
        query: 'SELECT email FROM users WHERE active = true'
      }
    },
    {
      toolName: 'crmWrite',
      parameters: {
        system: 'webhook',
        action: 'custom',
        webhookUrl: 'https://hooks.example.com/process',
        data: { /* data from previous step */ }
      }
    }
  ],
  agentId: 'marketing-bot-1'
});

console.log(`Executed ${result.results.length} tools`);
console.log(`Success: ${result.successCount}, Failed: ${result.failedCount}`);
```

### Parallel Execution

Execute multiple tools in parallel:

```javascript
const result = await toolExecutor.executeToolsParallel({
  toolCalls: [
    {
      toolName: 'webSearch',
      parameters: { query: 'competitors analysis' }
    },
    {
      toolName: 'databaseQuery',
      parameters: {
        database: 'analytics',
        query: 'SELECT * FROM metrics WHERE date > NOW() - INTERVAL 30 DAY'
      }
    }
  ],
  agentId: 'analyst-1'
});

console.log(`Total time: ${result.totalExecutionTime}ms`);
```

### Declarative Prompts

Parse natural language into tool calls:

```javascript
const result = await toolExecutor.parseDeclarativePrompt({
  prompt: 'Search the web for latest AI news and save results to CRM',
  agentId: 'analyst-1'
});

console.log('Detected tools:', result.toolCalls);
// [
//   { toolName: 'webSearch', parameters: { query: 'latest AI news' } },
//   { toolName: 'crmWrite', parameters: { ... } }
// ]

// Execute parsed tools
if (result.toolCalls.length > 0) {
  const execResult = await toolExecutor.executeToolChain({
    toolCalls: result.toolCalls,
    agentId: 'analyst-1'
  });
}
```

**Note:** Current implementation uses simple pattern matching. For production, integrate with LLM for accurate parsing.

---

## API Reference

Base URL: `http://localhost:5000/api/tools`

### Tool Discovery

#### GET /api/tools

List all available tools.

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "name": "webSearch",
      "version": "1.0.0",
      "description": "Search the web...",
      "category": "search",
      "riskLevel": "low",
      "costPerCall": 0.002
    }
  ],
  "count": 6
}
```

#### GET /api/tools/:toolName

Get detailed information about a specific tool.

**Response:**
```json
{
  "success": true,
  "tool": {
    "name": "webSearch",
    "schema": { /* JSON Schema */ },
    "permissions": ["web_search"],
    "examples": [ /* ... */ ]
  }
}
```

#### GET /api/tools/search/:query

Search tools by name or description.

**Response:**
```json
{
  "success": true,
  "results": [ /* matching tools */ ],
  "query": "database",
  "count": 1
}
```

#### GET /api/tools/categories/list

Get list of tool categories.

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "category": "data",
      "tools": ["databaseQuery"],
      "count": 1
    }
  ]
}
```

### Tool Execution

#### POST /api/tools/execute

Execute a single tool.

**Request:**
```json
{
  "toolName": "webSearch",
  "parameters": {
    "query": "AI news",
    "maxResults": 5
  },
  "agentId": "analyst-1"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* tool-specific response */ },
  "executionTime": 1250,
  "cost": 0.002
}
```

#### POST /api/tools/execute-chain

Execute multiple tools sequentially.

**Request:**
```json
{
  "toolCalls": [
    {
      "toolName": "databaseQuery",
      "parameters": { /* ... */ }
    },
    {
      "toolName": "crmWrite",
      "parameters": { /* ... */ }
    }
  ],
  "agentId": "marketing-bot-1"
}
```

**Response:**
```json
{
  "success": true,
  "results": [ /* individual results */ ],
  "successCount": 2,
  "failedCount": 0,
  "totalExecutionTime": 3450
}
```

#### POST /api/tools/execute-parallel

Execute multiple tools in parallel.

**Request:** Same as execute-chain

**Response:** Same as execute-chain (with parallel execution)

#### POST /api/tools/parse-prompt

Parse natural language into tool calls.

**Request:**
```json
{
  "prompt": "Search web for AI news and create CRM leads",
  "agentId": "analyst-1"
}
```

**Response:**
```json
{
  "success": true,
  "toolCalls": [
    {
      "toolName": "webSearch",
      "parameters": { "query": "AI news" },
      "confidence": 0.8
    },
    {
      "toolName": "crmWrite",
      "parameters": { "action": "create_lead" },
      "confidence": 0.7
    }
  ]
}
```

### Agent Management

#### POST /api/tools/agents/create

Create a new agent with permissions.

**Request:**
```json
{
  "agentId": "analyst-1",
  "role": "analyst"
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "analyst-1",
    "role": "analyst",
    "permissions": ["read_database", "query_database", "web_search"],
    "maxRiskLevel": "medium",
    "enabled": true,
    "createdAt": "2026-01-28T10:00:00Z"
  }
}
```

#### GET /api/tools/agents/:agentId

Get agent information.

**Response:**
```json
{
  "success": true,
  "agent": { /* agent details */ }
}
```

#### GET /api/tools/agents

List all agents.

**Response:**
```json
{
  "success": true,
  "agents": [ /* all agents */ ],
  "count": 5
}
```

#### GET /api/tools/roles/list

Get available roles.

**Response:**
```json
{
  "success": true,
  "roles": {
    "admin": {
      "permissions": ["*"],
      "maxRiskLevel": "all"
    },
    "developer": { /* ... */ }
  }
}
```

### Analytics

#### GET /api/tools/stats/usage

Get usage statistics.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalExecutions": 1250,
    "successRate": 0.95,
    "averageExecutionTime": 850,
    "totalCost": 12.5,
    "mostUsedTools": [
      { "tool": "webSearch", "calls": 450 }
    ],
    "mostActiveAgents": [
      { "agent": "analyst-1", "calls": 320 }
    ]
  }
}
```

#### GET /api/tools/logs

Get execution logs.

**Query Parameters:**
- `limit` (default: 100, max: 1000)
- `toolName` (filter by tool)
- `agentId` (filter by agent)
- `success` (filter by success/failure)
- `startDate`, `endDate` (date range)

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "timestamp": "2026-01-28T10:30:00Z",
      "agentId": "analyst-1",
      "toolName": "webSearch",
      "success": true,
      "executionTime": 1250,
      "cost": 0.002
    }
  ],
  "count": 100
}
```

#### GET /api/tools/permissions/log

Get permission check logs.

**Response:**
```json
{
  "success": true,
  "log": [
    {
      "timestamp": "2026-01-28T10:30:00Z",
      "agentId": "analyst-1",
      "permission": "read_database",
      "granted": true
    }
  ]
}
```

---

## Workflow Integration

The tool system integrates with HybridMind's workflow engine for declarative execution.

### Workflow Engine Methods

```javascript
const workflowEngine = require('./services/workflows/workflowEngine');

// Execute tools via declarative prompt
const result = await workflowEngine.executeWithTools({
  prompt: 'Search web for competitors and save to CRM',
  agentId: 'marketing-bot-1',
  context: { /* optional context */ }
});

// Direct tool execution
const searchResult = await workflowEngine.executeTool({
  toolName: 'webSearch',
  parameters: { query: 'competitors 2026' },
  agentId: 'analyst-1'
});
```

### Workflow Examples

**Example 1: Research Workflow**

```javascript
const result = await workflowEngine.executeWithTools({
  prompt: `
    1. Search web for "best CRM tools 2026"
    2. Query our database for current CRM metrics
    3. Generate a comparison report
  `,
  agentId: 'analyst-1'
});

console.log(result.summary);
// "Executed 3 tools: webSearch, databaseQuery, codeGenerate. 3 successful, 0 failed."
```

**Example 2: Automation Workflow**

```javascript
const result = await workflowEngine.executeWithTools({
  prompt: 'Find new users from last week and create CRM leads',
  agentId: 'marketing-bot-1'
});

// Internally:
// 1. Parse prompt → [databaseQuery, crmWrite]
// 2. Execute databaseQuery → get users
// 3. Execute crmWrite → create leads
// 4. Return summary
```

### Tool Output in Context

Tool outputs are automatically added to workflow context:

```javascript
const context = {
  previousSteps: [
    {
      tool: 'webSearch',
      result: { results: [ /* search results */ ] }
    }
  ]
};

// Next step can reference previous tool outputs
const nextResult = await workflowEngine.executeTool({
  toolName: 'codeGenerate',
  parameters: {
    description: `Generate summary report based on: ${JSON.stringify(context.previousSteps[0].result)}`
  },
  agentId: 'analyst-1'
});
```

---

## Logging & Monitoring

### Log Files

**Location:** `hybridmind-backend/logs/tool-usage.log`

**Format:** JSONL (JSON Lines)

```json
{"timestamp":"2026-01-28T10:30:00Z","agentId":"analyst-1","toolName":"webSearch","parameters":{"query":"AI news"},"success":true,"executionTime":1250,"error":null,"cost":0.002}
```

### Log Reading

```javascript
const toolLogger = require('./services/tools/toolLogger');

// Read recent logs
const logs = await toolLogger.readLogs({
  limit: 100,
  toolName: 'webSearch',
  success: true
});

// Get statistics
const stats = await toolLogger.getStatistics();
console.log(`Total executions: ${stats.totalExecutions}`);
console.log(`Success rate: ${(stats.successRate * 100).toFixed(2)}%`);
console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
```

### Sensitive Data Sanitization

Tool logger automatically redacts:
- `password`
- `token`
- `apiKey`
- `secret`
- `authorization`

```javascript
// Before logging:
{ username: 'john', password: 'secret123' }

// After sanitization:
{ username: 'john', password: '[REDACTED]' }
```

### Statistics Tracking

Per-tool statistics:

```javascript
const stats = toolRegistry.getToolStats('webSearch');
// {
//   totalCalls: 450,
//   successfulCalls: 428,
//   averageExecutionTime: 1250,
//   totalCost: 0.9,
//   lastCalled: '2026-01-28T10:30:00Z'
// }
```

Global statistics:

```javascript
const summary = toolRegistry.getUsageSummary();
// {
//   totalCalls: 1250,
//   totalCost: 12.5,
//   averageExecutionTime: 850,
//   toolBreakdown: { webSearch: 450, databaseQuery: 320, ... }
// }
```

---

## Troubleshooting

### Common Issues

#### 1. Permission Denied

**Error:** `Permission denied: Agent 'agent-1' does not have permission 'write_crm'`

**Solution:**
```javascript
// Grant permission
const permissionManager = require('./services/tools/permissionManager');
permissionManager.grantPermission('agent-1', 'write_crm');

// Or create agent with appropriate role
permissionManager.createAgent('agent-1', 'marketing');
```

#### 2. Tool Not Found

**Error:** `Tool 'unknownTool' not found in registry`

**Solution:**
```javascript
// Check available tools
const tools = toolRegistry.getAllTools();
console.log('Available tools:', tools.map(t => t.name));

// Search for similar tools
const results = toolRegistry.searchTools('unknown');
```

#### 3. Parameter Validation Failed

**Error:** `Parameter validation failed: 'query' is required`

**Solution:**
```javascript
// Check tool schema
const tool = toolRegistry.getTool('webSearch');
console.log('Required parameters:', tool.schema.required);
console.log('Parameter definitions:', tool.schema.properties);

// Provide all required parameters
const result = await toolExecutor.executeTool({
  toolName: 'webSearch',
  parameters: {
    query: 'search term',  // ✅ Required parameter provided
    maxResults: 10
  },
  agentId: 'agent-1'
});
```

#### 4. Tool Execution Timeout

**Error:** `Tool execution timeout after 30000ms`

**Solution:**
```javascript
// Increase timeout
const result = await toolExecutor.executeTool({
  toolName: 'databaseQuery',
  parameters: {
    database: 'large_db',
    query: 'SELECT * FROM huge_table',
    timeout: 60000  // 60 seconds
  },
  agentId: 'agent-1'
});
```

#### 5. Database Connection Failed

**Error:** `Database connection failed: Connection refused`

**Solution:**
```javascript
// Check database configuration
const databaseTool = require('./services/tools/databaseTool');

// Configure database connection
databaseTool.configure('mydb', {
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password'
});

// Test connection
const testResult = await databaseTool.testConnection('mydb');
console.log('Connection OK:', testResult.success);
```

#### 6. High Tool Costs

**Issue:** Tool costs exceeding budget

**Solution:**
```javascript
// Monitor costs
const stats = await toolLogger.getStatistics();
console.log(`Total cost today: $${stats.totalCost}`);

// Set cost limits (future feature)
// toolExecutor.setCostLimit({ daily: 10.0, perTool: 0.05 });

// Use cheaper alternatives
// Instead of codeGenerate (gpt-4o-mini, $0.015)
// Use fileOperation to read templates ($0.0001)
```

### Debug Mode

Enable verbose logging:

```javascript
const toolExecutor = require('./services/tools/toolExecutor');

// Enable debug mode (future feature)
// toolExecutor.setDebugMode(true);

// Check execution details
const result = await toolExecutor.executeTool({
  toolName: 'webSearch',
  parameters: { query: 'debug test' },
  agentId: 'agent-1'
});

console.log('Execution trace:', result.trace);
```

### Health Check

```bash
curl http://localhost:5000/api/tools
```

Expected response: List of all tools with 200 status code.

### Support

For additional support:
1. Check logs: `hybridmind-backend/logs/tool-usage.log`
2. Review tool schemas: `toolRegistry.getTool(name).schema`
3. Test individual tools: `toolExecutor.executeTool(...)`
4. Check agent permissions: `permissionManager.getAgent(agentId)`

---

## Best Practices

1. **Always validate parameters** before calling tools
2. **Use appropriate roles** for agents (don't give admin to everyone)
3. **Monitor costs** regularly with `getStatistics()`
4. **Cache results** when possible (webSearch does this automatically)
5. **Handle errors gracefully** - check `result.success` before using data
6. **Log important actions** for audit trail
7. **Test connections** before production (use `testConnection()` methods)
8. **Use declarative prompts** for complex workflows
9. **Sanitize sensitive data** before logging (automatic, but verify)
10. **Review permission logs** regularly for security

---

**Next:** See [TOOL_SYSTEM_QUICKSTART.md](TOOL_SYSTEM_QUICKSTART.md) for quick start guide and common patterns.
