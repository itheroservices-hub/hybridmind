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
| **Visual Flowchart Builder** | Design flows with Start ? Step ? Decision ? End nodes and live SVG preview; guides every message |
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
  Step 1 [analyze]   ? reads your code, identifies missing cases
  Step 2 [implement] ? adds validation to the route
  Step 3 [test]      ? writes tests, runs them in the sandbox
  Done ?
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
Design agent workflows visually — no YAML, no config files. Add Start, Step, Decision, and End nodes, reorder them with ??, and watch the live SVG preview update in real time. Hit **Apply** and every message you send carries the flowchart as context, steering the agent through your exact workflow.

```
? Start          ? define the goal
— Analyze code   ? identify issues
— Write fix      ? implement solution
? Tests pass?    ? branch: yes / no
— Run sandbox    ? auto-iterate if no
¦ End            ? deliver result
```

Perfect for multi-step refactors, CI pipelines, code review workflows, or any repeatable process you want the agent to follow consistently.

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

[Get a Pro license ?](https://hybridmind.dev/pricing)

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
VS Code Extension  -----?  hybridmind-backend (Node.js, port 3000)
                                    ¦
                    +-------------------------------+
                    ¦                               ¦
            Specialist Agents           Python Service (port 8000)
            14 built-in roles           code sandbox · task decomposition
```

| Component | Required | Purpose |
|---|---|---|
| `hybridmind-backend/` | ? Yes | AI orchestration, license, routing |
| `hybridmind-extension/` | ? Yes | VS Code sidebar, chat, agents |
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
