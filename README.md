# HybridMind

**v2.0.0 is live!** 🚀 **Autonomous Agent System** - AI agents now break down complex tasks automatically, collaborate on solutions, test their own code, and track progress in real-time. The future of coding is autonomous.

A fast, multi‑provider AI coding assistant with a clean workflow and a rock‑solid foundation. HybridMind brings flexible model switching, smart orchestration, and a streamlined developer experience.

## 🏗️ Architecture

HybridMind consists of two parts:
1. **Backend Server** (Node.js API) - Handles AI model orchestration
2. **VS Code Extension** - User interface in your editor

Both must be running for the extension to work.

## 🚀 Quick Start

### 1. Install VS Code Extension
Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)

### 2. Set Up Backend
```bash
# Clone this repository
git clone https://github.com/itheroservices-hub/hybridmind.git
cd hybridmind

# Install dependencies
npm install

# Configure API keys
cp .env.example .env
# Edit .env with your API keys

# Start backend server
npm start
```

**Or use the quick-start scripts:**
- Windows: `start-backend.bat`
- Mac/Linux: `./start-backend.sh`

### 3. Use the Extension
1. Select code in VS Code
2. Press `Ctrl+Shift+P`
3. Type "HybridMind" and choose a command

## � Microsoft 365 Agents Integration

HybridMind now integrates with **Microsoft 365 Agents Toolkit** via Model Context Protocol (MCP)!

### What You Can Do:
- 📚 **Query M365 Documentation** - Ask about Teams bots, Office add-ins, declarative agents
- 📋 **Get Manifest Schemas** - Retrieve and validate app manifest schemas
- 💻 **Generate M365 Code** - Auto-generate SDK code patterns
- 🔧 **Troubleshoot Issues** - Debug M365 development problems

### Quick Start:
```bash
# Test M365 integration
node test-m365-mcp.js

# Try the demo
node demo-m365-agent-creation.js
```

### Example Questions:
- "How do I create a declarative agent for Microsoft 365 Copilot?"
- "Show me the app manifest schema"
- "Generate code for a Teams bot using @microsoft/teams-ai"
- "Why is my Teams manifest validation failing?"

**📖 Full Documentation:** [M365 Integration Guide](./M365_AGENTS_MCP_INTEGRATION.md) | [Quick Reference](./M365_QUICK_REFERENCE.md)
## 🎯🐍 Hybrid Architecture - Node.js + Python

**NEW!** HybridMind now features a true hybrid architecture - combining JavaScript speed with Python AI power!

### Why Hybrid?
- ⚡ **Fast** - Simple tasks handled by Node.js agents (4000+ lines)
- 🧠 **Powerful** - Complex AI tasks routed to Python AutoGen
- 🎯 **Intelligent** - Automatic routing based on task complexity
- 🔄 **Resilient** - Falls back to Node.js if Python unavailable

### Quick Start:
```bash
# Install Python service
cd hybridmind-python-service
pip install -r requirements.txt

# Configure (use same OpenRouter key as Node.js)
cp .env.example .env
# Edit .env: OPENROUTER_API_KEY=your-key-here

# Enable in backend
# Edit hybridmind-backend/.env: ENABLE_PYTHON_SERVICE=true

# Start both services
start-hybrid.bat  # Windows
# or
./start-hybrid.sh  # Linux/Mac

# Test integration
node test-hybrid-architecture.js
```

### What Gets Routed to Python?
- Complex code generation (>500 lines)
- Architecture design
- Multi-step reasoning
- Code review with deep analysis
- Tasks marked with `context.preferPython = true`

### Python Service Features:
- 🤖 **4 Specialized Agents**: Code Generator, Code Reviewer, Architect, Reasoner
- 👥 **Team Collaboration**: Multi-agent workflows
- 🌐 **Multi-Provider**: OpenRouter, OpenAI, or Ollama (free!)
- � **MCP Tools**: Agents can use filesystem, terminal, web search, memory, M365 docs
- 📡 **REST API**: http://localhost:8000/docs

### 🔧 NEW: MCP Tools Integration
Python agents can now use all MCP tools:
```python
# Agents can automatically:
- Read/write files in workspace
- Execute terminal commands
- Search the web
- Store/retrieve knowledge
- Query M365 documentation
```

Test tools integration:
```bash
python test-mcp-tools-integration.py
```

**📖 Full Documentation:** [Hybrid Architecture Guide](./HYBRID_ARCHITECTURE.md) | [Quick Start](./HYBRID_QUICK_START.md) | [MCP Tools Integration](./MCP_TOOLS_INTEGRATION.md)
### 🚀 NEW: Advanced Python Agent Features

HybridMind's Python agents now have 4 powerful advanced features:

#### 1. 🔒 Code Execution Sandbox
Agents test their generated code automatically and iterate until it works!
```bash
# Agent generates code, tests it, fixes bugs automatically
POST /agent/execute-with-sandbox
{
  "task": "Create fibonacci function",
  "max_iterations": 3,
  "use_team_review": true  // Multiple agents review code
}
```

#### 2. 🤝 Multi-Agent Coordination
Multiple agents collaborate on complex tasks:
- **Sequential Pipeline**: Research → Architecture → Code → Review
- **Parallel Exploration**: Try multiple approaches, pick the best
- **Collaborative Debugging**: Team debugs code together
```bash
# Agents collaborate to solve complex problems
POST /agent/coordinated-pipeline
POST /agent/parallel-explore
POST /agent/collaborative-debug
```

#### 3. 📊 Tool Usage Analytics
Track which tools agents use most, success rates, and performance:
```bash
# Get insights on agent tool usage
GET /analytics/comprehensive-report
GET /analytics/tool-usage
```

#### 4. 🛠️ Custom Tools
Easily add domain-specific tools for your use case:
```bash
# Register custom tools
POST /tools/register-custom
{
  "name": "validate_credit_card",
  "description": "Validate credit cards",
  "code": "def validate_credit_card(num): ...",
  "category": "validation"
}

# Use with agents
POST /agent/execute-with-custom-tools
```

**Test Advanced Features:**
```bash
python test-advanced-features.py
```

**📖 Full Documentation:** [Advanced Features Guide](./ADVANCED_FEATURES.md) | [Quick Reference](./ADVANCED_FEATURES_QUICK_REFERENCE.md)
### 🎯 NEW: Task Decomposition System

AI agents automatically break down complex tasks into trackable subtasks!

**What it does:**
- 🔍 **Analyzes** your complex task
- 📋 **Breaks down** into manageable subtasks
- 📊 **Tracks** progress automatically
- 🤖 **Executes** subtasks with appropriate agents
- 🔗 **Manages** dependencies between subtasks

**Quick Start:**
```bash
# 1. Decompose complex task
curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Build a REST API for a blog platform"}'

# 2. Execute subtasks automatically
curl -X POST http://localhost:8000/task/TASK_ID/execute-all

# Done! AI completes your entire task ✨
```

**Example Workflow:**
```
Your Task: "Build user authentication system"
           ↓
AI Creates: 1. Design database schema
            2. Implement user registration
            3. Add login/logout  
            4. Create JWT tokens
            5. Add password reset
           ↓
  AI Executes Each Subtask Automatically!
```

**Perfect For:**
- 📦 Complex feature implementations
- 🏗️ Multi-step projects
- 📚 Learning workflows
- 🔧 Refactoring tasks
- 🐛 Systematic debugging

**Test Task Decomposition:**
```bash
python test-task-decomposition.py
```

**📖 Full Documentation:** [Task Decomposition Guide](./TASK_DECOMPOSITION.md) | [Quick Reference](./TASK_DECOMPOSITION_QUICK_REFERENCE.md)
## �📚 Documentation
See [Extension README](hybridmind-extension/README.md) for full documentation.
