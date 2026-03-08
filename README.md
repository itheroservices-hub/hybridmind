# HybridMind â€” Autonomous AI Agent for VS Code

> **v2.0 is live.** HybridMind now works autonomously â€” it breaks down your task, writes the code, tests it, and iterates until it's done. No prompting required.

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/itheroservices-hub/hybridmind/releases/tag/v2.0.0)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.108%2B-007ACC)](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/itheroservices-hub/hybridmind/actions/workflows/ci.yml/badge.svg)](https://github.com/itheroservices-hub/hybridmind/actions/workflows/ci.yml)

---

## What's New in v2.0

| Feature | Description |
|---|---|
| **Autonomous Multi-Agent System** | Agents plan, execute, test, and iterate without you stepping in |
| **Task Decomposition Engine** | Complex goals broken into executable steps automatically |
| **AgentSync â€” 65 Specialist Agents** | One click to route your task to the right expert agent |
| **Code Execution Sandbox** | Generated code tested in isolation; errors fix themselves |
| **200+ AI Models** | Claude 4.5, GPT-4o, Gemini 2.5, DeepSeek R1, Llama 3.3, and more |
| **BYOK Support** | Bring Your Own Key â€” connect your OpenRouter or direct API keys |
| **MCP Security Hardening** | Command allowlist, approval tickets, per-key rate limiting, JWT auth |
| **CI/CD Pipelines** | Auto-build VSIX and GitHub Release on every `v*.*.*` tag push |

---

## Quick Start

### 1. Install the Extension
[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)

Or search **HybridMind** in the Extensions panel (`Ctrl+Shift+X`).

### 2. Start the Backend
```bash
git clone https://github.com/itheroservices-hub/hybridmind.git
cd hybridmind
npm install
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env
npm start
```

**Windows shortcut:** `start-hybrid.bat`  
**Mac/Linux:** `./start-hybrid.sh`

### 3. Activate Your Plan
Open Command Palette (`Ctrl+Shift+P`) â†’ **HybridMind: Set API Key (BYOK)**

Free tier works out of the box â€” no license key required.

---

## Architecture

```
VS Code Extension  â”€â”€â”€â”€â”€â–º  hybridmind-backend (Node.js, port 3000)
                                    â”‚
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚                               â”‚
            AgentSync (65 agents)      Python Service (port 8000)
            specialist routing         AutoGen Â· code sandbox
                                       task decomposition
```

| Component | Required | Purpose |
|---|---|---|
| `hybridmind-backend/` | âœ… Yes | Core AI orchestration, license validation, MCP |
| `hybridmind-extension/` | âœ… Yes | VS Code sidebar, inline chat, agent sidebar |
| `hybridmind-python-service/` | Optional | Code sandbox, AutoGen multi-agent, analytics |

---

## Features

### Autonomous Agent Mode
HybridMind's planner breaks your goal into steps, picks the best model for each, executes them in sequence, and delivers the result â€” from a single prompt.

```
You: "Add input validation and unit tests to this API endpoint"

HybridMind:
  Step 1 [analyze]   â†’ reads your code, identifies missing cases
  Step 2 [implement] â†’ adds Zod validation to the route
  Step 3 [test]      â†’ writes Jest tests, runs them in the sandbox
  Step 4 [review]    â†’ checks edge cases, self-corrects
  Done âœ“ (42s)
```

### AgentSync â€” 65 Specialist Agents
The Agents sidebar routes any task to the right expert automatically:

- `debugging-agent` â€” trace errors to root cause
- `code-review-agent` â€” full PR-style review
- `test-generation-agent` â€” write tests for any function
- `security-qa-agent` â€” OWASP Top 10 scan
- `documentation-agent` â€” generate docs from code
- â€¦ and 60 more specialist agents

### 200+ Models via OpenRouter

| Tier | Example Models | Cost |
|---|---|---|
| Free | Llama 3.3 70B, Gemini Flash | $0 |
| Budget | DeepSeek R1, Mistral | ~$0.09â€“$0.50/M tokens |
| Standard | Claude 3.5 Sonnet, GPT-4o Mini | ~$1â€“$3/M tokens |
| Premium | Claude 4.5, GPT-4o, Gemini 2.5 Pro | ~$5â€“$75/M tokens |

### Code Execution Sandbox
Code is run in an isolated Python sandbox. If tests fail, the agent reads the output and fixes its own code â€” up to 3 automatic iterations.

### MCP Tool Integration
Agents can use Model Context Protocol tools natively:
- Read/write files in your workspace
- Run allowlisted terminal commands
- Web search and memory store
- Microsoft 365 documentation queries

---

## Pricing

| Plan | Price | Models | Agents |
|---|---|---|---|
| **Free** | $0 | Llama 3.3, Gemini Flash | Basic |
| **Pro** | $19/mo | All 200+ models | Full AgentSync |
| **Pro Plus** | $49/mo | All models + priority | All features + analytics |
| **Enterprise** | Custom | Dedicated infra | White-label + SSO |

[Get a license key â†’](https://hybridmind.dev/pricing)

---

## Commands

| Command | Shortcut | Description |
|---|---|---|
| Open Chat | `Ctrl+Shift+H` | Main AI chat panel |
| Inline Chat | `Ctrl+K` | Chat at your cursor |
| Open Agent Mode | Palette | Autonomous task runner |
| Run Agent Team | Palette | Multi-agent collaboration |
| Set API Key (BYOK) | Palette | Connect your OpenRouter key |
| Explain Code | Right-click | Explain selected code |
| Review Code | Right-click | Code review |
| Optimize Code | Right-click | Performance suggestions |

---

## Python Service Setup (Optional)

Required for code sandbox, task decomposition, and tool analytics.

```bash
cd hybridmind-python-service
pip install -r requirements.txt
cp .env.example .env
# Set OPENROUTER_API_KEY in .env
python main.py
```

API docs at `http://localhost:8000/docs`

---

## Microsoft 365 Integration

Agents can query M365 documentation via MCP:

```bash
node demo-m365-agent-creation.js
```

Ask things like:
- *"How do I create a declarative agent for Microsoft 365 Copilot?"*
- *"Generate a Teams bot using @microsoft/teams-ai"*

Full guide: [M365 Integration Guide](./M365_AGENTS_MCP_INTEGRATION.md)

---

## Development

```bash
# Run tests
npm test

# Build extension VSIX
cd hybridmind-extension && npm run package

# Watch mode
npm run dev
```

CI triggers on push to `main`, `fix/*`, `feature/*` branches.  
Release workflow triggers on `v*.*.*` tags â†’ builds VSIX + creates GitHub Release automatically.

---

## Repository Structure

```
hybridmind/
â”œâ”€â”€ hybridmind-backend/        # Node.js API server
â”‚   â”œâ”€â”€ middleware/            # licenseValidator, rateLimiter, MCP auth
â”‚   â”œâ”€â”€ routes/                # agent, mcp, agentSync routes
â”‚   â””â”€â”€ services/agents/       # planner, executor, AgentSync client
â”œâ”€â”€ hybridmind-extension/      # VS Code extension (TypeScript)
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ views/             # agentSidebarProvider, chat webview
â”‚       â”œâ”€â”€ auth/              # licenseManager, BYOK
â”‚       â””â”€â”€ mcp/               # MCP server registry
â”œâ”€â”€ hybridmind-python-service/ # Python AutoGen service
â”‚   â”œâ”€â”€ task_decomposition.py
â”‚   â”œâ”€â”€ code_execution.py
â”‚   â”œâ”€â”€ multi_agent_coordination.py
â”‚   â””â”€â”€ tool_analytics.py
â”œâ”€â”€ Hybrid-Mind-landingpage/   # React + Stripe landing page
â”œâ”€â”€ .github/workflows/         # ci.yml + release.yml
â””â”€â”€ AgentSync/                 # 65-agent orchestration system
```

---

## Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)
- [Changelog v2.0.0](./CHANGELOG_v2.0.0.md)
- [Advanced Features Guide](./ADVANCED_FEATURES.md)
- [MCP Tools Integration](./MCP_TOOLS_INTEGRATION.md)
- [M365 Integration Guide](./M365_AGENTS_MCP_INTEGRATION.md)
- [OpenRouter Setup](./OPENROUTER_SETUP.md)
- [AutoGen Guide](./AUTOGEN_GUIDE.md)

---

## License

MIT © [IThero Services](https://github.com/itheroservices-hub)

