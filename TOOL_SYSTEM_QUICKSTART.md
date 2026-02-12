# Tool System Quick Start Guide

Get started with HybridMind's Multi-Modal Tool System in 5 minutes.

## Quick Links

- [Full Documentation](TOOL_SYSTEM.md)
- [Implementation Summary](TOOL_SYSTEM_COMPLETE.md)
- [API Reference](#api-quick-reference)

---

## 1. Create an Agent (30 seconds)

```bash
curl -X POST http://localhost:5000/api/tools/agents/create \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "role": "developer"
  }'
```

**Roles available:** `admin`, `developer`, `analyst`, `marketing`, `readonly`

---

## 2. Execute Your First Tool (1 minute)

### Web Search

```bash
curl -X POST http://localhost:5000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "webSearch",
    "parameters": {
      "query": "latest AI trends 2026",
      "maxResults": 5
    },
    "agentId": "my-agent"
  }'
```

### Database Query

```bash
curl -X POST http://localhost:5000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "databaseQuery",
    "parameters": {
      "database": "users",
      "query": "SELECT * FROM users LIMIT 5"
    },
    "agentId": "my-agent"
  }'
```

### Generate Code

```bash
curl -X POST http://localhost:5000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "codeGenerate",
    "parameters": {
      "language": "javascript",
      "description": "Function to validate email addresses",
      "template": "function"
    },
    "agentId": "my-agent"
  }'
```

---

## 3. Common Patterns

### Pattern 1: Search + Analysis

```javascript
const toolExecutor = require('./hybridmind-backend/services/tools/toolExecutor');

// Search web
const searchResult = await toolExecutor.executeTool({
  toolName: 'webSearch',
  parameters: { query: 'competitor analysis', maxResults: 10 },
  agentId: 'my-agent'
});

// Analyze with code generation
const analysis = await toolExecutor.executeTool({
  toolName: 'codeGenerate',
  parameters: {
    language: 'python',
    description: `Analyze this data: ${JSON.stringify(searchResult.data)}`,
    template: 'function'
  },
  agentId: 'my-agent'
});
```

### Pattern 2: Database + CRM

```javascript
// Get new users from database
const users = await toolExecutor.executeTool({
  toolName: 'databaseQuery',
  parameters: {
    database: 'app',
    query: 'SELECT * FROM users WHERE created_at > NOW() - INTERVAL 7 DAY'
  },
  agentId: 'my-agent'
});

// Create CRM leads
const crmResult = await toolExecutor.executeTool({
  toolName: 'crmWrite',
  parameters: {
    system: 'salesforce',
    action: 'create_lead',
    data: {
      firstName: users.data[0].first_name,
      email: users.data[0].email
    }
  },
  agentId: 'my-agent'
});
```

### Pattern 3: Tool Chain

```javascript
// Execute multiple tools in sequence
const result = await toolExecutor.executeToolChain({
  toolCalls: [
    {
      toolName: 'databaseQuery',
      parameters: {
        database: 'analytics',
        query: 'SELECT * FROM events WHERE date = CURRENT_DATE'
      }
    },
    {
      toolName: 'codeGenerate',
      parameters: {
        language: 'python',
        description: 'Generate daily report from events data',
        template: 'function'
      }
    },
    {
      toolName: 'crmWrite',
      parameters: {
        system: 'webhook',
        action: 'custom',
        webhookUrl: 'https://hooks.slack.com/...',
        data: { message: 'Daily report ready' }
      }
    }
  ],
  agentId: 'my-agent'
});

console.log(`✅ ${result.successCount} tools executed successfully`);
```

### Pattern 4: Declarative Prompts

```javascript
const workflowEngine = require('./hybridmind-backend/services/workflows/workflowEngine');

const result = await workflowEngine.executeWithTools({
  prompt: 'Search for Node.js tutorials and save top 5 to CRM',
  agentId: 'my-agent'
});

console.log(result.summary);
// "Executed 2 tools: webSearch, crmWrite. 2 successful, 0 failed."
```

---

## 4. API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tools` | GET | List all tools |
| `/api/tools/:name` | GET | Get tool details |
| `/api/tools/execute` | POST | Execute single tool |
| `/api/tools/execute-chain` | POST | Execute tool chain |
| `/api/tools/parse-prompt` | POST | Parse natural language |
| `/api/tools/agents/create` | POST | Create agent |
| `/api/tools/stats/usage` | GET | Usage statistics |
| `/api/tools/logs` | GET | Execution logs |

**Base URL:** `http://localhost:5000/api/tools`

---

## 5. Tool Parameters Cheat Sheet

### webSearch

```javascript
{
  query: string,              // Required
  maxResults: number,         // Optional (default: 10, max: 20)
  provider: 'duckduckgo'|'brave'|'auto',  // Optional
  safesearch: 'strict'|'moderate'|'off',  // Optional
  freshness: 'day'|'week'|'month'|'year'  // Optional
}
```

### databaseQuery

```javascript
{
  database: string,           // Required
  query: string,              // Required (SQL)
  parameters: array,          // Optional (for prepared statements)
  limit: number,              // Optional (default: 100, max: 1000)
  timeout: number             // Optional (default: 30000ms)
}
```

### crmWrite

```javascript
{
  system: 'salesforce'|'hubspot'|'webhook',  // Required
  action: string,             // Required: 'create_contact', 'update_contact', etc.
  data: object,               // Required
  recordId: string,           // Required for updates
  webhookUrl: string          // Required if system='webhook'
}
```

### codeGenerate

```javascript
{
  language: string,           // Required: 'javascript', 'python', etc.
  description: string,        // Required
  template: string,           // Optional: 'function', 'class', 'api_endpoint', etc.
  style: string,              // Optional: 'standard', 'airbnb', 'google', 'pep8'
  includeComments: boolean,   // Optional (default: true)
  includeTests: boolean,      // Optional (default: false)
  complexity: string          // Optional: 'simple', 'intermediate', 'advanced'
}
```

---

## 6. Common Errors & Fixes

### Error: "Permission denied"

**Fix:** Grant permission or use appropriate role

```javascript
const permissionManager = require('./hybridmind-backend/services/tools/permissionManager');
permissionManager.grantPermission('my-agent', 'write_crm');

// Or create agent with correct role
permissionManager.createAgent('my-agent', 'marketing');  // Has write_crm permission
```

### Error: "Tool not found"

**Fix:** Check tool name (case-sensitive)

```bash
# List all tools
curl http://localhost:5000/api/tools

# Correct names: webSearch, databaseQuery, crmWrite, codeGenerate, fileOperation, httpRequest
```

### Error: "Parameter validation failed"

**Fix:** Check required parameters

```bash
# Get tool schema
curl http://localhost:5000/api/tools/webSearch

# Ensure all 'required' fields are present
```

### Error: "Agent not found"

**Fix:** Create agent first

```bash
curl -X POST http://localhost:5000/api/tools/agents/create \
  -H "Content-Type: application/json" \
  -d '{"agentId": "my-agent", "role": "developer"}'
```

---

## 7. Testing Tools

### Test 1: Web Search

```bash
curl -X POST http://localhost:5000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "webSearch",
    "parameters": {"query": "test", "maxResults": 3},
    "agentId": "test-agent"
  }' | jq
```

Expected: `success: true`, `results` array with 3 items

### Test 2: Code Generation

```bash
curl -X POST http://localhost:5000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "codeGenerate",
    "parameters": {
      "language": "javascript",
      "description": "Hello world function",
      "template": "function"
    },
    "agentId": "test-agent"
  }' | jq
```

Expected: `success: true`, `code` field with generated code

### Test 3: Tool Chain

```bash
curl -X POST http://localhost:5000/api/tools/execute-chain \
  -H "Content-Type: application/json" \
  -d '{
    "toolCalls": [
      {
        "toolName": "webSearch",
        "parameters": {"query": "test", "maxResults": 1}
      },
      {
        "toolName": "codeGenerate",
        "parameters": {
          "language": "python",
          "description": "Print hello",
          "template": "function"
        }
      }
    ],
    "agentId": "test-agent"
  }' | jq
```

Expected: `successCount: 2`, `failedCount: 0`

---

## 8. Integration Examples

### Express.js Route

```javascript
const express = require('express');
const toolExecutor = require('./hybridmind-backend/services/tools/toolExecutor');

const router = express.Router();

router.post('/search', async (req, res) => {
  try {
    const result = await toolExecutor.executeTool({
      toolName: 'webSearch',
      parameters: {
        query: req.body.query,
        maxResults: 10
      },
      agentId: 'api-agent'
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Workflow Automation

```javascript
const workflowEngine = require('./hybridmind-backend/services/workflows/workflowEngine');
const cron = require('node-cron');

// Daily automation: Get new users → Create CRM leads
cron.schedule('0 9 * * *', async () => {  // Every day at 9 AM
  const result = await workflowEngine.executeWithTools({
    prompt: 'Get users who signed up yesterday and create CRM leads',
    agentId: 'automation-agent'
  });
  
  console.log('Daily automation complete:', result.summary);
});
```

### React Component

```javascript
import { useState } from 'react';

function SearchComponent() {
  const [results, setResults] = useState([]);
  
  const handleSearch = async (query) => {
    const response = await fetch('http://localhost:5000/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'webSearch',
        parameters: { query, maxResults: 5 },
        agentId: 'frontend-agent'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setResults(data.data.results);
    }
  };
  
  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      <ul>
        {results.map(r => (
          <li key={r.url}>
            <a href={r.url}>{r.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 9. Monitoring & Analytics

### Check Usage Statistics

```bash
curl http://localhost:5000/api/tools/stats/usage | jq
```

Shows:
- Total executions
- Success rate
- Average execution time
- Total cost
- Most used tools
- Most active agents

### View Recent Logs

```bash
curl 'http://localhost:5000/api/tools/logs?limit=10' | jq
```

### Filter Logs

```bash
# By tool
curl 'http://localhost:5000/api/tools/logs?toolName=webSearch&limit=20' | jq

# By agent
curl 'http://localhost:5000/api/tools/logs?agentId=my-agent&limit=20' | jq

# By success/failure
curl 'http://localhost:5000/api/tools/logs?success=false&limit=20' | jq
```

### Permission Audit

```bash
curl http://localhost:5000/api/tools/permissions/log | jq
```

---

## 10. Production Checklist

Before deploying to production:

- [ ] Create production agents with appropriate roles
- [ ] Configure database connections (replace mocks with `pg`, `mysql2`, `mongodb`)
- [ ] Add Brave Search API key for web search
- [ ] Configure CRM API credentials (Salesforce, HubSpot)
- [ ] Set up log rotation for `tool-usage.log`
- [ ] Enable rate limiting (implement cost limits)
- [ ] Configure error alerting
- [ ] Test all tools with production data
- [ ] Review and adjust tool costs
- [ ] Set up monitoring dashboard
- [ ] Document custom agents and workflows

---

## Next Steps

1. **Read Full Docs:** [TOOL_SYSTEM.md](TOOL_SYSTEM.md)
2. **Review Implementation:** [TOOL_SYSTEM_COMPLETE.md](TOOL_SYSTEM_COMPLETE.md)
3. **Explore API:** Try all 17 endpoints
4. **Build Workflows:** Create custom automation workflows
5. **Monitor Usage:** Track costs and performance

---

## Support

Questions? Check:
- [Full Documentation](TOOL_SYSTEM.md) - Complete technical reference
- [Troubleshooting Guide](TOOL_SYSTEM.md#troubleshooting) - Common issues
- Logs: `hybridmind-backend/logs/tool-usage.log`

**Happy building with HybridMind Tools! 🚀**
