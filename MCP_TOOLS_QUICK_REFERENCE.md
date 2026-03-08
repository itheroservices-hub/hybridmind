# MCP Tools Quick Reference

**Python AutoGen agents with MCP tools - Quick command reference**

---

## Start Services

```bash
# Start Node.js backend
npm start

# Start Python service
cd hybridmind-python-service
python main.py

# Or start both together
start-hybrid.bat  # Windows
./start-hybrid.sh  # Linux/Mac
```

---

## Test Tools Integration

```bash
# Run complete test suite
python test-mcp-tools-integration.py

# Or test individual tools in Python
python hybridmind-python-service/tools.py
```

---

## Available MCP Tools

### Filesystem Tools
```python
filesystem_read_file("e:/IThero/HybridMind/README.md")
filesystem_write_file("output.txt", "content")
filesystem_list_directory("e:/IThero/HybridMind/")
```

### Terminal Tools
```python
terminal_execute_command("npm --version")
terminal_execute_command("git status")
```

### Web Search Tools
```python
web_search("Python AutoGen tutorial", max_results=5)
web_fetch_page("https://docs.python.org/3/")
```

### Memory Tools (Graphiti)
```python
memory_store_knowledge("React hooks are great", "React", ["react", "hooks"])
memory_search("React patterns", limit=5)
```

### Microsoft 365 Tools
```python
m365_get_knowledge("How to create Teams bot?")
m365_get_code_snippets("@microsoft/teams-ai TeamsAdapter")
```

---

## API Endpoints

### Get Available Tools
```bash
curl http://localhost:8000/tools/available
```

### Execute Agent with Tools
```bash
curl -X POST http://localhost:8000/agent/execute-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Search web for Python tips",
    "agent_type": "reasoner",
    "tool_set": "web_search"
  }'
```

### Research Task (Auto-selects tools)
```bash
curl -X POST http://localhost:8000/agent/research-task \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Research React state management best practices"
  }'
```

### Code with Tools (Auto-selects tools)
```bash
curl -X POST http://localhost:8000/agent/code-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Read package.json and suggest updates"
  }'
```

---

## Tool Sets

| Tool Set | Includes | Best For |
|----------|----------|----------|
| `essential` | filesystem_read, filesystem_write, terminal_execute, web_search | General tasks |
| `research` | web_search, web_fetch, memory_search, m365_knowledge | Research |
| `development` | filesystem tools, terminal, m365_code_snippets | Coding |
| `filesystem` | All filesystem tools | File operations |
| `terminal` | terminal_execute_command | Command execution |
| `web_search` | web_search, web_fetch | Web research |
| `memory` | memory_store, memory_search | Knowledge base |
| `m365` | m365_knowledge, m365_code_snippets | M365 development |
| `all` | All 10 tools | Maximum power |

---

## Usage Examples

### Example 1: Web Research
```bash
curl -X POST http://localhost:8000/agent/execute-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Search for latest Python 3.12 features and summarize",
    "agent_type": "reasoner",
    "tool_set": "research",
    "temperature": 0.7
  }'
```

### Example 2: Read Project Files
```bash
curl -X POST http://localhost:8000/agent/execute-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Read README.md from e:/IThero/HybridMind/ and create a summary",
    "agent_type": "reasoner",
    "tool_set": "filesystem"
  }'
```

### Example 3: Execute Commands
```bash
curl -X POST http://localhost:8000/agent/execute-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Run npm --version and tell me the result",
    "agent_type": "code_generator",
    "tool_set": "terminal"
  }'
```

### Example 4: M365 Development
```bash
curl -X POST http://localhost:8000/agent/execute-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Show me how to create a Teams bot with authentication",
    "agent_type": "code_generator",
    "tool_set": "m365"
  }'
```

### Example 5: Full Development Workflow
```bash
curl -X POST http://localhost:8000/agent/code-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Read server.js, analyze the code structure, and suggest improvements"
  }'
```

---

## Python Usage (Direct)

```python
from tools import (
    filesystem_read_file,
    web_search,
    terminal_execute_command,
    memory_store_knowledge
)

# Read file
content = filesystem_read_file("e:/IThero/HybridMind/README.md")

# Search web
results = web_search("Python AutoGen")

# Execute command
output = terminal_execute_command("git status")

# Store knowledge
memory_store_knowledge("AutoGen is great!", "AutoGen", ["ai", "framework"])
```

---

## Node.js Integration

```javascript
// In Node.js backend/agent coordinator
const pythonBridge = require('./services/agents/pythonBridge');

// Execute with tools
const result = await pythonBridge.executeAgent({
  task: "Research React hooks and generate example",
  agentRole: 'coder',
  context: {
    useTools: true,
    toolSet: 'development'
  }
});
```

---

## Troubleshooting

### Python service not starting?
```bash
# Check Python version
python --version  # Need 3.8+

# Install dependencies
pip install -r hybridmind-python-service/requirements.txt

# Check environment
cat hybridmind-python-service/.env
```

### Tools not working?
```bash
# Check Node.js backend
curl http://localhost:3000/api/health

# Check Python service
curl http://localhost:8000/health

# Check tools endpoint
curl http://localhost:8000/tools/available
```

### Tool calls failing?
```bash
# Test tools directly
python hybridmind-python-service/tools.py

# Check NODEJS_BACKEND_URL in .env
echo $NODEJS_BACKEND_URL  # Should be http://localhost:3000
```

---

## Environment Variables

### hybridmind-python-service/.env
```bash
OPENROUTER_API_KEY=your-key-here
NODEJS_BACKEND_URL=http://localhost:3000  # For MCP tools bridge
```

### hybridmind-backend/.env
```bash
ENABLE_PYTHON_SERVICE=true
PYTHON_SERVICE_URL=http://localhost:8000
```

---

## Health Checks

```bash
# Python service
curl http://localhost:8000/health

# Node.js backend
curl http://localhost:3000/api/health  # or /health

# Check Python can reach Node.js
curl -X POST http://localhost:3000/api/mcp/web-search/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

---

## Next Steps

1. ✅ Test integration: `python test-mcp-tools-integration.py`
2. 📖 Read full guide: [MCP_TOOLS_INTEGRATION.md](./MCP_TOOLS_INTEGRATION.md)
3. 🔧 Customize tools: Edit `hybridmind-python-service/tools.py`
4. 🚀 Add more tools: Extend with new MCP servers
5. 📊 Monitor usage: Check logs for tool calls

---

**Your Python agents now have superpowers! 🎉**
