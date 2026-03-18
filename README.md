# HybridMind

> **v2.0 — The autonomous AI coding agent for VS Code. Plans, executes, and iterates without hand-holding.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/itheroservices-hub/hybridmind/releases/tag/v2.0.0)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.108%2B-007ACC)](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What's New Since v1.7

### v1.8 — Live Telemetry & Agent Control
| Feature | Description |
|---|---|
| **Live Ralph Streaming** | Real-time attempt-by-attempt telemetry via SSE — see what the agent is thinking as it works |
| **Kill Switch** | Stop any autonomous loop instantly from the sidebar |
| **Ghost-Command Prevention** | Pending approval tickets are cleaned up on kill — no stale high-risk actions |

### v2.0 — Autonomous Agent System
| Feature | Description |
|---|---|
| **Full Autonomy Mode** | Full Auto executes the plan immediately — no "reply ok" confirmation needed |
| **Task Decomposition** | Complex goals broken into executable subtasks with real-time progress tracking |
| **Code Execution Sandbox** | Generated code tested in isolation; agent reads the error, fixes itself, and retries |
| **Multi-Agent Coordination** | Sequential pipeline, parallel exploration, and collaborative debugging patterns |
| **Tool Usage Analytics** | Track which tools agents use, success rates, and performance across sessions |
| **Custom Tools System** | Register domain-specific tools and use them with any agent |
| **Inline Agent Picker** | Search and add specialist agents directly in the sidebar — no VS Code popups |
| **Visual Flowchart Builder** | Design flows with Start → Step → Decision → End nodes and live SVG preview; guides every message |
| **Collapsible Answer Boxes** | AI responses display as cards — collapsed by default, expand on demand |
| **Compact Step Messages** | Agent planner/summary messages minimal and collapsed by default |
| **Q&A Shortcut** | Conversational questions bypass planning and answer directly |
| **Smart Chain Orchestration** | 6 pre-built chain templates (coding, research, review) with cost/speed estimation |
| **200+ Models via OpenRouter** | Claude 4.5, GPT-4o, Gemini 2.5 Pro, DeepSeek R1, Llama 3.3, o1, and more |
| **BYOK Support** | Bring Your Own Key — connect OpenRouter or direct provider API keys |
| **Agents Tab Redesign** | Workflow tab merged into Agents — flowchart + agentic settings all in one place |
| **HybridMind Logo** | Branded header in the sidebar |

---

## Quick Start

### 1. Install
Search **HybridMind** in VS Code Extensions (`Ctrl+Shift+X`) or [install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind).

### 2. Start the Backend
```bash
git clone https://github.com/itheroservices-hub/hybridmind.git
cd hybridmind
npm install
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env
npm start
```

**Windows:** `start-hybrid.bat` | **Mac/Linux:** `./start-hybrid.sh`

### 3. Open the Sidebar
Click the HybridMind icon in the Activity Bar. Free tier works out of the box — no license key required.

---

## Features

### Autonomous Agent Mode
HybridMind plans your goal into executable steps and runs them — no confirmation needed in Full Auto mode.

```
You: "Add input validation and unit tests to this API endpoint"

HybridMind:
  Step 1 [analyze]   → reads your code, identifies missing cases
  Step 2 [implement] → adds validation to the route
  Step 3 [test]      → writes tests, runs them in the sandbox
  Done ✓
```

### Specialist Agents
Click **+ Add Agent** in the Agents tab to pick from 14 built-in specialists:

- **Bug Hunter** — traces errors to root cause  
- **Code Generator** — writes complete, production-ready code  
- **Security Auditor** — OWASP Top 10 scan  
- **Test Writer** — generates unit and integration tests  
- **Documenter** — generates docs from code  
- ...and 9 more

### Visual Flowchart Builder
Design a step-by-step flow with Start → Step → Decision → End nodes. Live SVG preview updates as you edit. Apply it and the flowchart context guides every message you send.

### 200+ Models via OpenRouter

| Tier | Example Models |
|---|---|
| Free | Llama 3.3 70B, Gemini Flash |
| Pro | Claude Sonnet 4, GPT-4o, Gemini 2.5 Pro |
| Pro Plus | Claude 4.5 Opus, o1, DeepSeek R1 |

---

## Pricing

| Plan | Price | Models | Agents |
|---|---|---|---|
| **Free** | $0 | Llama 3.3, Gemini Flash | — |
| **Pro** | $19/mo | All 200+ models | Up to 4 agents |
| **Pro Plus** | $49/mo | All models + priority | Up to 8 agents |
| **Enterprise** | Custom | Dedicated infra | Unlimited |

[Get a Pro license →](https://hybridmind.dev/pricing)

---

## Commands

| Command | Description |
|---|---|
| Open HybridMind Chat | Main AI sidebar |
| Inline Chat (`Ctrl+K`) | Chat at your cursor |
| Explain Code | Right-click selected code |
| Review Code | Right-click selected code |
| Set API Key (BYOK) | Connect your own OpenRouter key |

---

## Architecture

```
VS Code Extension  ─────►  hybridmind-backend (Node.js, port 3000)
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            Specialist Agents           Python Service (port 8000)
            14 built-in roles           code sandbox · task decomposition
```

| Component | Required | Purpose |
|---|---|---|
| `hybridmind-backend/` | ✅ Yes | AI orchestration, license, routing |
| `hybridmind-extension/` | ✅ Yes | VS Code sidebar, chat, agents |
| `hybridmind-python-service/` | Optional | Code sandbox, analytics |

---

## Links

- [Changelog v2.0.0](./CHANGELOG_v2.0.0.md)
- [Advanced Features Guide](./ADVANCED_FEATURES.md)
- [MCP Tools Integration](./MCP_TOOLS_INTEGRATION.md)
- [OpenRouter Setup](./OPENROUTER_SETUP.md)

---

## License

MIT © [IThero Services](https://github.com/itheroservices-hub)


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

