# M365 Agents Toolkit Quick Reference

## 🎯 Quick Start

### 1. Backend Setup
```bash
# M365 MCP is already configured!
# Just start the backend
npm start

# Or use the quick-start script
./start-backend.sh   # Mac/Linux
start-backend.bat    # Windows
```

### 2. Test M365 Integration
```bash
# Run the test suite
node test-m365-mcp.js

# Or test a single tool
curl -X POST http://localhost:3000/mcp/m365agentstoolkit \
  -H "Content-Type: application/json" \
  -H "x-license-key: your-license" \
  -d '{"tool": "get_knowledge", "args": {"question": "What is a declarative agent?"}}'
```

### 3. Try the Demo
```bash
# Create a sample declarative agent project
node demo-m365-agent-creation.js
```

---

## 🔧 Available Tools

### Tool: `get_knowledge`
**Purpose:** Query Microsoft 365 development documentation

**Request:**
```javascript
{
  "tool": "get_knowledge",
  "args": {
    "question": "How do I create a Teams bot?"
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "tool": "get_knowledge",
  "question": "How do I create a Teams bot?",
  "answer": "...",
  "note": "..."
}
```

**Example Questions:**
- "How do I create a declarative agent for Microsoft 365 Copilot?"
- "What is the structure of a Teams bot using @microsoft/teams-ai?"
- "How to implement SSO in a Teams app?"
- "What are conversation starters in declarative agents?"

---

### Tool: `get_schema`
**Purpose:** Retrieve manifest and configuration schemas

**Request:**
```javascript
{
  "tool": "get_schema",
  "args": {
    "schema_name": "app_manifest",
    "schema_version": "latest"  // optional
  }
}
```

**Available Schema Names:**
- `app_manifest` - Microsoft 365 App Manifest
- `declarative_agent_manifest` - Declarative Agent for M365 Copilot
- `api_plugin_manifest` - API Plugin Manifest
- `m365_agents_yaml` - M365 Agents project configuration

**Response:**
```javascript
{
  "success": true,
  "tool": "get_schema",
  "schemaName": "app_manifest",
  "schemaVersion": "latest",
  "description": "..."
}
```

---

### Tool: `get_code_snippets`
**Purpose:** Generate SDK code patterns and examples

**Request:**
```javascript
{
  "tool": "get_code_snippets",
  "args": {
    "question": "Generate code for a Teams bot that responds to mentions"
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "tool": "get_code_snippets",
  "question": "...",
  "note": "..."
}
```

**Example Questions:**
- "Generate code for a Teams bot that responds to mentions"
- "Create an Office add-in task pane with React"
- "Implement SSO authentication in Teams app"
- "Create a message extension for Teams"
- "Build a declarative agent with actions"

---

### Tool: `troubleshoot`
**Purpose:** Debug M365 development issues

**Request:**
```javascript
{
  "tool": "troubleshoot",
  "args": {
    "question": "My Teams app manifest validation is failing with icon URL error"
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "tool": "troubleshoot",
  "question": "...",
  "note": "..."
}
```

**Example Issues:**
- "Manifest validation failing with icon URL error"
- "Teams bot not responding to messages"
- "Authentication not working in Office add-in"
- "App package deployment errors"
- "API plugin connection issues"

---

## 📡 API Endpoints

### Check Backend Health
```bash
GET http://localhost:3000/mcp/health
```

Response:
```json
{
  "success": true,
  "service": "HybridMind MCP",
  "version": "1.8.0",
  "capabilities": ["filesystem", "terminal", "web-search", "graphiti-memory", "m365agentstoolkit"]
}
```

### Call M365 Tool
```bash
POST http://localhost:3000/mcp/m365agentstoolkit
```

Headers:
```
Content-Type: application/json
x-license-key: your-license-key
```

Body:
```json
{
  "tool": "get_knowledge",
  "args": {
    "question": "Your question here"
  }
}
```

---

## 🔑 Authentication

### License Key
All requests require a valid HybridMind license key:

```bash
# Via header
curl -H "x-license-key: your-license-key" ...

# Via environment variable (for scripts)
export HYBRIDMIND_LICENSE_KEY="your-license-key"
```

### Rate Limits by Tier
- **Free:** 10 requests/minute
- **Pro:** 100 requests/minute
- **Pro+:** 500 requests/minute
- **Enterprise:** Unlimited

---

## 🎨 VS Code Extension Usage

### Chat Sidebar
1. Open HybridMind chat sidebar
2. Ask M365 questions naturally:
   - "How do I create a Teams bot?"
   - "Show me the declarative agent manifest schema"
   - "Generate code for an Office add-in"
3. HybridMind automatically routes to M365 tools

### Commands
Press `Ctrl+Shift+P` and search for:
- "HybridMind: Check MCP Approval Ticket"
- "HybridMind: Refresh MCP Status"

---

## 🧪 Testing

### Test Suite
```bash
# Run all tests
node test-m365-mcp.js

# Expected output:
# ✓ Health Check
# ✓ get_knowledge tests
# ✓ get_schema tests
# ✓ get_code_snippets tests
# ✓ troubleshoot tests
# 📊 All tests passed!
```

### Demo Project
```bash
# Create a sample declarative agent
node demo-m365-agent-creation.js

# Output: m365-demo-agent/ folder with:
# - declarativeAgent.json
# - m365agents.yml
# - README.md
```

---

## 🐛 Common Issues

### Issue: Backend not responding
**Solution:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# Start backend if needed
npm start
```

### Issue: "Tool not found"
**Error:** `Unknown M365 Agents Toolkit tool: xyz`

**Solution:** Use one of the valid tools:
- `get_knowledge`
- `get_schema`
- `get_code_snippets`
- `troubleshoot`

### Issue: "Invalid schema_name"
**Error:** `Invalid schema_name. Must be one of: ...`

**Solution:** Use a valid schema name:
- `app_manifest`
- `declarative_agent_manifest`
- `api_plugin_manifest`
- `m365_agents_yaml`

### Issue: Missing question parameter
**Error:** `Question parameter is required for get_knowledge`

**Solution:** Always include the `question` parameter:
```json
{
  "args": {
    "question": "Your question here"
  }
}
```

---

## 📚 Resources

### Official Documentation
- [M365 Agents Toolkit](https://aka.ms/m365agentstoolkit)
- [Declarative Agents](https://learn.microsoft.com/microsoft-365-copilot/extensibility/declarative-agents)
- [Teams AI SDK](https://github.com/microsoft/teams-ai)
- [Model Context Protocol](https://modelcontextprotocol.io)

### HybridMind Documentation
- [M365 Integration Guide](./M365_AGENTS_MCP_INTEGRATION.md)
- [MCP Routes](./hybridmind-backend/routes/mcpRoutes.js)
- [Tool System](./TOOL_SYSTEM.md)

### Code Examples
- Test Script: `test-m365-mcp.js`
- Demo: `demo-m365-agent-creation.js`
- Backend: `hybridmind-backend/routes/mcpRoutes.js`

---

## 💡 Tips & Best Practices

### 1. Cache Schemas
Retrieve schemas once and cache them locally:
```javascript
const schema = await getSchema('app_manifest');
// Cache for 1 hour to avoid repeated requests
```

### 2. Batch Knowledge Queries
When building a project, gather all knowledge upfront:
```javascript
const knowledge = await Promise.all([
  getKnowledge('declarative agents'),
  getKnowledge('conversation starters'),
  getKnowledge('actions in agents')
]);
```

### 3. Use Troubleshoot for Errors
When you hit an error, ask troubleshoot immediately:
```javascript
const solution = await troubleshoot(errorMessage);
```

### 4. Combine with HybridMind Features
Use M365 tools with HybridMind's multi-agent system:
```javascript
const architect = {
  role: 'architect',
  tools: ['get_knowledge', 'get_schema'],
  task: 'Design M365 Copilot agent'
};
```

---

## 🚀 What's Next?

### Phase 2 Features (Coming Soon)
- [ ] Local schema caching
- [ ] M365 project templates
- [ ] Auto-validation on save
- [ ] One-click deployment

### Advanced Use Cases
- Multi-agent M365 development workflows
- Automated manifest generation
- CI/CD integration for M365 apps
- Custom action scaffolding

---

**Need Help?** Check the [full integration guide](./M365_AGENTS_MCP_INTEGRATION.md)
