# HybridMind Python AI Service

FastAPI service providing advanced AI capabilities using AutoGen **with MCP tools integration**.

## Features

- **4 Specialized Agents**: Code Generator, Code Reviewer, Architect, Reasoner
- **Multi-Agent Collaboration**: Team-based problem solving
- **Multi-Provider Support**: OpenRouter, OpenAI, or Ollama
- **MCP Tools Integration**: Agents can use filesystem, terminal, web search, memory, and M365 tools
- **REST API**: Easy integration with Node.js backend

## 🔧 NEW: MCP Tools Integration

Your Python agents now have access to all MCP tools through the Node.js bridge:

### Available Tools:
- **Filesystem**: Read/write files, list directories
- **Terminal**: Execute shell commands
- **Web Search**: Search internet, fetch web pages
- **Memory (Graphiti)**: Store and retrieve knowledge
- **Microsoft 365**: Query M365 documentation and code examples

### Tool Categories:
- `essential` - filesystem_read, filesystem_write, terminal_execute, web_search
- `research` - web_search, web_fetch, memory_search, m365_knowledge
- `development` - filesystem ops, terminal, m365_code_snippets
- `all` - All 10 MCP tools

## Quick Start

### 1. Install Dependencies

```bash
cd hybridmind-python-service
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY (or use Ollama for free)
```

### 3. Run Service

```bash
python main.py
```

Service runs on: http://localhost:8000
API Docs: http://localhost:8000/docs

## API Endpoints

### Execute Single Agent

```bash
POST /agent/execute
{
  "task": "Generate a React component for user profile",
  "agent_type": "code_generator",
  "temperature": 0.7,
  "max_iterations": 10
}
```

### Execute Agent with MCP Tools (NEW!)

```bash
POST /agent/execute-with-tools
{
  "task": "Search the web for React best practices and create a summary",
  "agent_type": "reasoner",
  "tool_set": "research",  // essential, research, development, filesystem, web_search, all
  "temperature": 0.7,
  "max_iterations": 10
}
```

### Research Task (NEW!)

```bash
POST /agent/research-task
{
  "task": "Research Microsoft Teams bot development"
}
```

Automatically uses web search, memory, and M365 documentation tools.

### Code with Tools (NEW!)

```bash
POST /agent/code-with-tools
{
  "task": "Read the package.json file and suggest dependency updates"
}
```

Automatically uses filesystem, terminal, and M365 code snippet tools.

### Team Collaboration

```bash
POST /agent/team-collaboration
{
  "task": "Design and implement a caching system",
  "agents": ["architect", "code_generator", "code_reviewer"],
  "temperature": 0.7
}
```

### Get Available MCP Tools (NEW!)

```bash
GET /tools/available
```

Returns list of all 10 MCP tools organized by category.

### Get Available Agent Types

```bash
GET /agent/types
```

## Agent Types

1. **code_generator** - Generates production-ready code
2. **code_reviewer** - Reviews code for quality and issues
3. **architect** - Designs system architecture
4. **reasoner** - Complex problem solving and analysis

## Integration with Node.js Backend

The Node.js backend automatically routes complex AI tasks to this service. See `hybridmind-backend/services/agents/pythonBridge.js` for implementation.

## Development

### Testing MCP Tools Integration

```bash
# Run comprehensive test suite
python test-mcp-tools-integration.py
```

This tests all 10 MCP tools with your Python agents.

### Testing the Service

```bash
# Health check
curl http://localhost:8000/health

# Get available tools
curl http://localhost:8000/tools/available

# Execute agent
curl -X POST http://localhost:8000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "Write a hello world function", "agent_type": "code_generator"}'

# Execute with tools
curl -X POST http://localhost:8000/agent/execute-with-tools \
  -H "Content-Type: application/json" \
  -d '{"task": "Search web for Python tips", "agent_type": "reasoner", "tool_set": "web_search"}'
```

### Using with Ollama (Free)

1. Install Ollama: https://ollama.ai
2. Pull model: `ollama pull llama3.2`
3. Service automatically uses Ollama if no API keys configured

## Architecture

```
Node.js Backend
      ↓
  HTTP Request
      ↓
Python Service (FastAPI)
      ↓
   AutoGen Agents
      ↓
  AI Providers (OpenRouter/Ollama)
```
