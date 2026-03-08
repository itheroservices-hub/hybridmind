# HybridMind v2.0.0 Release Notes

**Release Date:** February 21, 2026  
**Codename:** Autonomous Agent System

---

## 🚀 Major Release: From Assistant to Autonomous System

HybridMind v2.0.0 represents a **paradigm shift** in AI-powered development. This isn't just an update—it's a complete evolution from a coding assistant to a fully autonomous multi-agent system.

### What Changed

**Before v2.0 (v1.x):**
- AI coding assistant
- Single-agent responses
- Manual task management
- Basic tool usage

**After v2.0:**
- Autonomous multi-agent system
- AI breaks down complex tasks automatically
- Agents collaborate and verify work
- Advanced tool ecosystem with analytics

---

## 🎯 New in v2.0.0: Five Major Systems

### 1. 🤖 Task Decomposition System

AI automatically breaks down complex tasks into trackable subtasks.

**What it does:**
- Analyzes complex tasks and creates logical breakdown
- Tracks progress in real-time (e.g., "60% complete, 3/5 subtasks done")
- Manages dependencies between subtasks
- Executes subtasks with appropriate agents
- Provides complete workflow automation

**API:**
- `POST /task/decompose` - Break down any complex task
- `POST /task/{id}/execute-all` - Execute entire task autonomously
- `GET /task/{id}/progress` - Track progress in real-time
- 11 new endpoints total

**Example:**
```bash
# Give AI a complex task
curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Build user authentication system"}'

# AI creates:
# 1. Design database schema
# 2. Implement registration
# 3. Add login/logout
# 4. Create JWT tokens
# 5. Review security

# Execute automatically
curl -X POST http://localhost:8000/task/{id}/execute-all
```

**Files:**
- `task_decomposition.py` (500+ lines)
- `test-task-decomposition.py`
- `TASK_DECOMPOSITION.md` (4000+ words)

---

### 2. 🔒 Code Execution Sandbox

Agents test their generated code automatically and iterate until it works.

**What it does:**
- Agents generate code
- Code is executed in safe sandbox (optional Docker)
- Results are validated
- If tests fail, agent refines and retries
- Iterates until code works correctly

**Modes:**
- **Single agent:** Coder generates → Executor tests → Iterate
- **Team review:** Coder → Executor → Tester → Iterate

**API:**
- `POST /agent/execute-with-sandbox`

**Example:**
```bash
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -d '{
    "task": "Create fibonacci function",
    "max_iterations": 3,
    "use_team_review": true
  }'

# Result: Tested, working code!
```

**Files:**
- `code_execution.py` (300+ lines)

---

### 3. 🤝 Multi-Agent Coordination

Multiple agents collaborate using shared tools to solve complex problems.

**Three Coordination Patterns:**

**a) Sequential Pipeline**
```
Research → Architecture → Code → Review
```
Each agent builds on the previous agent's work.

**b) Parallel Exploration**
```
Agent 1: Approach A
Agent 2: Approach B  →  Judge picks best
Agent 3: Approach C
```
Try multiple solutions, pick the winner.

**c) Collaborative Debugging**
```
Analyzer → Fixer → Validator
```
Team debugs code together.

**API:**
- `POST /agent/coordinated-pipeline`
- `POST /agent/parallel-explore`
- `POST /agent/collaborative-debug`

**Files:**
- `multi_agent_coordination.py` (400+ lines)

---

### 4. 📊 Tool Usage Analytics

Track which tools agents use, success rates, and performance metrics.

**What it tracks:**
- Most used tools
- Success rates per tool
- Performance metrics (speed)
- Usage by agent type
- Usage by task type
- Time-based patterns

**API:**
- `GET /analytics/comprehensive-report`
- `GET /analytics/tool-usage`
- `POST /analytics/clear`

**Example insights:**
```json
{
  "total_tool_calls": 523,
  "success_rate": "94.3%",
  "most_used_tools": [
    "filesystem_read_file: 145 calls (32.5%)",
    "web_search: 89 calls (19.8%)"
  ],
  "slowest_tools": ["web_search: 2.3s avg"],
  "most_reliable": ["filesystem: 99.1% success"]
}
```

**Files:**
- `tool_analytics.py` (350+ lines)

---

### 5. 🛠️ Custom Tools System

Easily add domain-specific tools to extend agent capabilities.

**What it does:**
- Register custom tools via API
- Organize by category
- Track usage per tool
- Use with any agent

**Built-in custom tools:**
- Data: `parse_json_string`, `csv_to_json`
- Text: `word_count`, `extract_emails`
- Math: `calculate_percentage`
- DateTime: `days_between_dates`
- Validation: `validate_email`, `validate_url`

**API:**
- `POST /tools/register-custom` - Register new tool
- `GET /tools/custom` - List custom tools
- `POST /agent/execute-with-custom-tools` - Use custom tools

**Example:**
```bash
# Register custom tool
curl -X POST http://localhost:8000/tools/register-custom \
  -d '{
    "name": "calculate_discount",
    "description": "Calculate discounted price",
    "code": "def calculate_discount(price, percent): ...",
    "category": "business"
  }'

# Use with agent
curl -X POST http://localhost:8000/agent/execute-with-custom-tools \
  -d '{"task": "Calculate 20% discount on $100"}'
```

**Files:**
- `custom_tools.py` (400+ lines)

---

## 📊 Statistics

### Code Added
- **New Python modules:** 5 files
- **Lines of code:** 2,000+ lines
- **API endpoints:** 15+ new endpoints
- **Documentation:** 15,000+ words

### Test Coverage
- `test-task-decomposition.py` - Task decomposition tests
- `test-advanced-features.py` - Advanced features tests
- `test-mcp-tools-integration.py` - MCP tools tests
- `test-hybrid-architecture.js` - Hybrid architecture tests

### Documentation
- `TASK_DECOMPOSITION.md` (4000+ words)
- `ADVANCED_FEATURES.md` (6500+ words)
- `TASK_DECOMPOSITION_QUICK_REFERENCE.md`
- `ADVANCED_FEATURES_QUICK_REFERENCE.md`
- `TASK_DECOMPOSITION_COMPLETE.md`
- `ADVANCED_FEATURES_COMPLETE.md`

---

## 🎯 Use Cases

### 1. Complex Feature Development
**Before v2.0:**
```
You: "Build authentication system"
AI: [Gives you code for authentication]
You: [Manually implement, test, debug]
```

**After v2.0:**
```
You: "Build authentication system"
AI: [Breaks into 6 subtasks]
    [Executes each with appropriate agent]
    [Tests code automatically]
    [Tracks progress: 80% complete]
Result: Working, tested authentication system
```

### 2. Learning Projects
**Task:** "Learn Docker by containerizing my app"

**v2.0 automatically:**
1. Researches Docker basics → **Reasoner**
2. Creates Dockerfile → **Code Generator**
3. Sets up docker-compose → **Architect**
4. Tests deployment → **Code Execution Sandbox**
5. Reviews best practices → **Code Reviewer**

Progress tracked at every step!

### 3. Debugging Complex Issues
**Task:** "Fix performance issues in search"

**v2.0 Multi-Agent Coordination:**
1. **Analyzer**: Profiles performance, finds bottlenecks
2. **Fixer**: Implements optimizations
3. **Validator**: Tests performance improvements
4. **Code Sandbox**: Verifies fixes work

Result: Verified, working solution.

### 4. Systematic Refactoring
**Task:** "Refactor authentication module"

**v2.0 Task Decomposition:**
- Analyzes current code
- Plans new structure
- Implements incrementally
- Updates tests
- Validates functionality
- Tracks progress: 5/6 steps complete

---

## 🔧 Technical Details

### Architecture Changes

**New Python Modules:**
```
hybridmind-python-service/
  ├── task_decomposition.py     # Task breakdown & tracking
  ├── code_execution.py          # Code testing sandbox
  ├── multi_agent_coordination.py # Agent collaboration
  ├── tool_analytics.py          # Usage tracking
  └── custom_tools.py            # Tool extensibility
```

**API Expansion:**
- Total endpoints: 40+ (was ~25 in v1.8.0)
- New endpoints: 15+
- Backwards compatible: Yes

**Storage:**
- Tasks stored in `tasks.json`
- Analytics in `tool_analytics.json`
- Persistent across restarts

### Performance

**Task Decomposition:**
- Decomposition time: 5-15 seconds
- Execution per subtask: 10-60 seconds
- Storage: ~2KB per task

**Code Execution Sandbox:**
- Overhead: 2-5 seconds (Docker)
- Can disable Docker for speed
- Iterations: Typically 1-3

**Multi-Agent Coordination:**
- Sequential pipeline: ~4x single agent time
- Parallel exploration: ~1.5x single agent time
- Quality increase: Significant

**Analytics:**
- Tracking overhead: <1ms per call
- Auto-save: Every 10 calls
- Data size: ~1KB per tracked call

---

## 🚀 Migration Guide

### From v1.8.0 to v2.0.0

**No breaking changes!** v2.0.0 is fully backwards compatible.

**Existing functionality:**
- All v1.x APIs still work
- No changes required to existing code
- Python service is optional

**To use new features:**

1. **Update Python service dependencies:**
```bash
cd hybridmind-python-service
pip install -r requirements.txt
```

2. **Start Python service:**
```bash
python main.py
```

3. **Use new features:**
```bash
# Task decomposition
curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Your complex task"}'

# Advanced features
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -d '{"task": "Create function", "max_iterations": 3}'
```

**Optional: Integrate with Node.js**

Update `pythonBridge.js` with new methods:
```javascript
async decomposeTask(task) {
  return this._makeRequest('/task/decompose', { task });
}

async executeWithSandbox(task, options) {
  return this._makeRequest('/agent/execute-with-sandbox', {
    task,
    ...options
  });
}
```

---

## 📅 Post-Release Updates (February 22 – March 8, 2026)

These changes were implemented after the v2.0.0 release and will be included in the upcoming v2.1.0 tag.

---

### 🔗 AgentSync Integration

HybridMind's Node.js backend is now directly connected to the AgentSync specialist network, enabling seamless cross-project agent orchestration from within the extension.

**New files:**
- `hybridmind-backend/services/agents/agentSyncClient.js`
- `hybridmind-backend/routes/agentSyncRoutes.js`

**What it does:**
- Bridges HybridMind to the AgentSync Python HTTP server (default `http://localhost:8001`)
- Auto-detects project workspace from task text — recognises 12 IThero projects (SpectrumSync, BettingOdds/Playgorithm, Sarnia Digital Twin, SovereignEmber AI, and more)
- Routes tasks through the Chief-of-Staff agent for fully autonomous multi-project execution
- Supports invoking specific specialist agents by slug

**New REST endpoints (`/api/agentsync`):**
```
GET  /api/agentsync/health          — AgentSync connectivity status
GET  /api/agentsync/agents          — List all 65 AgentSync specialists
POST /api/agentsync/invoke          — Invoke specific agent(s) by slug
POST /api/agentsync/invoke/cos      — Route through Chief-of-Staff (full auto)
POST /api/agentsync/invoke/role     — Map HybridMind role → AgentSync slug
```

**Example:**
```bash
# Let Chief-of-Staff handle a task autonomously
curl -X POST http://localhost:3000/api/agentsync/invoke/cos \
  -H "x-license-key: YOUR_KEY" \
  -d '{"request": "Refactor the auth module in SpectrumSync"}'
```

---

### 🔒 MCP Security Hardening

The MCP layer received a comprehensive security overhaul across authentication, authorization, and terminal safety.

#### New: MCP Authentication Middleware (`mcpAuthMiddleware.js`)
- All MCP endpoints now require a Bearer token or `x-license-key` header
- Admin secret (`ADMIN_SECRET` env var) grants admin-tier access for approval management
- License-to-tier resolution via the existing `licenseValidator` pipeline

#### New: Terminal Allowlist & Safe Tokenizer (`terminalAllowlist.js`)
- Explicit allowlist of safe commands: `ls`, `dir`, `cat`, `type`, `pwd`, `echo`, `node`, `npm`, `npx`, `git`, `python`, `python3`, `pip`
- Custom tokenizer handles quoted strings without shell expansion
- Blocks shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`) and path traversal (`..`) in all arguments
- Any command not on the list is rejected at middleware level

#### Updated: MCP Security Middleware (`mcpSecurityMiddleware.js`)
- Capability allowlist: `filesystem`, `terminal`, `web-search`, `graphiti-memory`, `m365agentstoolkit`
- Free-tier terminal access restricted to `dryRun` mode only
- Dangerous terminal commands generate an **approval ticket** (persisted in `mcpApprovalStore`) instead of blocking hard — caller can approve and re-submit
- Approval endpoints: `GET/POST /mcp/approvals/:ticketId/approve|deny`

#### Updated: MCP Routes (`mcpRoutes.js`)
- `requireMcpAuth` + `validateMcpRequest` applied to all capability routes
- Terminal path runs through `enforceTerminalApproval` before execution
- `execFile` (not `exec`) used for all shell invocations — shell injection prevented

---

### 🛡️ Backend Security & Validation Improvements

#### License Validator (`licenseValidator.js`)
- **Negative cache** (10-minute TTL) — invalid/expired keys no longer hammer the license API
- **Per-key rate limiting** — max 10 verification calls per 60-second window
- **Admin alerting** — consecutive outage counter triggers alert at configurable threshold
- **Multi-endpoint failover** — `LICENSE_VERIFY_ENDPOINTS` env var accepts comma-separated list

#### Rate Limiter Overhaul (`rateLimiter.js`)
- **Redis-backed** rate limiting via `ioredis` with graceful in-memory fallback when Redis is unavailable
- Three independent limiter types: request count, token budget, and API cost
- License keys hashed with SHA-256 for identity keying (no raw keys in memory)
- Monthly token quotas reset automatically by UTC calendar month

#### Request Validation (`validateRequest.js`)
- **Zod-based** schema validation on all key endpoints (`/run`, `/agent`, `/workflow`, `/comparison`)
- Model allowlist — only 14 vetted models accepted; unknown models are rejected with 400
- Input size limits: prompts capped at 50,000 chars, code at 50,000 chars, system prompts at 10,000 chars
- `models` array capped at 5 per request; `comparison` endpoint accepts up to 10 models

#### Guardrail Middleware (`guardrailMiddleware.js`)
- **Server-side action type derivation** — `actionType` is now inferred from HTTP method + path, never accepted from client request body
- Tier-based guardrail enforcement applied before every `/run`, `/agent`, and `/mcp/*` call

---

### 🖥️ Extension: Agent Sidebar & BYOK

#### Agent Sidebar (`AgentSidebarProvider`)
- New VS Code sidebar panel (`hybridmind.agentSidebar` view)
- Visual agent slot configuration — assign specialist agents to slots
- Team creation: select multiple agents and save as a named team
- Slot limits and team creation gated by license tier (Pro / Pro Plus)
- Communicates with backend via the new AgentSync routes

#### BYOK — Bring Your Own Key (`LicenseManager`)
- Users can now configure `hybridmind.userApiKey` and `hybridmind.userApiProvider` in VS Code settings
- BYOK keys bypass the license API and route directly to the specified provider
- Enables usage without an active HybridMind subscription for self-hosted setups

---

### 🏭 CI/CD Pipeline

Two GitHub Actions workflows added under `.github/workflows/`:

#### CI (`ci.yml`) — runs on every push to `main`, `fix/*`, `feature/*`, and all PRs
- Node 20.x install with `npm ci`
- ESLint check (non-blocking until config is added)
- `npm audit --audit-level=high` — fails build on high/critical vulnerabilities
- Scan for `require('child_process')` in routes (warning)
- Scan for `exec()` usage in routes — **fails build** (must use `execFile`)
- Full test suite (`npm test`)

#### Release (`release.yml`) — runs on `v*.*.*` tags
- Security audit before packaging
- Builds VSIX via `vsce package`
- Creates GitHub Release with VSIX attached and auto-generated release notes

---

### 💳 Landing Page: Payment System & UI

The `Hybrid-Mind-landingpage` received a full payment system implementation and security hardening.

#### Stripe Subscription Flow
- **Embedded payment form** — Stripe Elements rendered inside the subscription dialog
- **`/api/create-payment-intent`** — creates Stripe subscription with `payment_behavior: default_incomplete`; client secret returned to frontend
- **`/api/create-checkout`** — alternative hosted Stripe Checkout session flow
- Customer de-duplication: existing Stripe customers are reused by email lookup

#### Stripe Webhooks (`/webhooks/stripe`)
- `checkout.session.completed` → generates JWT license key, saves to DB, emails to customer via Resend
- `customer.subscription.updated` / `deleted` → updates license status in DB
- `invoice.payment_succeeded` / `invoice.payment_failed` → renewal handling and failure alerts
- Signature verification via `stripe.webhooks.constructEvent` on every incoming event

#### License API (`/api/license`)
- `POST /api/license/verify` — validates JWT signature + DB lookup; returns tier, status, features
- JWT licenses issued with 10-year expiry; signed with `JWT_SECRET` env var
- Expiry and `isActive` checks enforced on every request

#### Security Headers & Rate Limiting
- `helmet` with strict CSP (`defaultSrc: self`, Stripe domains allowlisted)
- CORS restricted to `hybridmind.ca` and `www.hybridmind.ca` (localhost in dev only)
- Payment endpoints rate-limited: max 10 requests per 15 minutes per IP
- General API rate limit: 100 requests per minute per IP
- Payment data never logged in production (response body logging dev-only)

---

### 📚 Documentation

**Added:**
- `AUTOGEN_GUIDE.md` — AutoGen integration guide
- `AUTOGEN_MCP_INTEGRATION_GUIDE.md` — AutoGen + MCP combined workflow
- `AUTOGEN_QUICKSTART.md` — getting started with AutoGen
- `M365_AGENTS_MCP_INTEGRATION.md` — Microsoft 365 Agents Toolkit via MCP
- `M365_QUICK_REFERENCE.md` — M365 quick reference card
- `M365_VISUAL_FLOW.md` — visual flow diagram for M365 agents
- `MCP_TOOLS_INTEGRATION.md` — full MCP tools reference
- `MCP_TOOLS_QUICK_REFERENCE.md` — MCP quick reference card
- `ADVANCED_FEATURES.md` + `ADVANCED_FEATURES_QUICK_REFERENCE.md`
- `MEGA_TEST.md` — comprehensive integration test checklist
- `V2_TESTING_CHECKLIST.md` — v2.0 pre-release testing checklist
- `OPENROUTER_SETUP.md` — OpenRouter configuration guide

**Removed (legacy / superseded):**
- `AGENT_MANAGER_BRIEF.md`
- `AUTONOMOUS_AGENT_QUICKREF.md`
- `AUTONOMOUS_EXECUTION_API.md`
- `CHANGELOG_v1.4.0.md`, `CHANGELOG_v1.5.0.md`, `RELEASE_NOTES_v1.5.1.md`
- `CHAT_UI_DESIGN.md`
- `CONTEXT_MANAGEMENT_SYSTEM.md`, `CONTEXT_MANAGEMENT_QUICKSTART.md`
- `DECOMPOSITION_SYSTEM.md`
- `PLANNING_REFLECTION_SYSTEM.md`, `PLANNING_REFLECTION_QUICKSTART.md`
- `MULTI_MODEL_STATUS.md`
- `EXPANDED_MODEL_LIBRARY.md`
- `TITAN_PHASE_I_MULTI_PROJECT_CORE_BLUEPRINT.md`

---

### 📊 Updated Statistics (as of March 8, 2026)

| Metric | v2.0.0 (Feb 21) | Current |
|---|---|---|
| API endpoints | 40+ | 50+ |
| New middleware | 0 | 5 |
| New backend routes | 0 | 2 |
| GitHub Actions workflows | 0 | 2 |
| Supported AI models (allowlist) | — | 14 |
| AgentSync specialists accessible | 0 | 65 |
| Landing page payment flow | None | Full Stripe embedded |

---

## 📖 Documentation

### New Documentation
- [TASK_DECOMPOSITION.md](./TASK_DECOMPOSITION.md) - Complete guide
- [ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md) - Advanced features guide
- [TASK_DECOMPOSITION_QUICK_REFERENCE.md](./TASK_DECOMPOSITION_QUICK_REFERENCE.md)
- [ADVANCED_FEATURES_QUICK_REFERENCE.md](./ADVANCED_FEATURES_QUICK_REFERENCE.md)

### Updated Documentation
- [README.md](./README.md) - Updated with v2.0.0 features
- [HYBRID_ARCHITECTURE.md](./HYBRID_ARCHITECTURE.md) - Enhanced with new features

### API Documentation
- Live API docs: http://localhost:8000/docs (when service running)

---

## 🧪 Testing

### Run Tests

```bash
# Test task decomposition
python test-task-decomposition.py

# Test advanced features
python test-advanced-features.py

# Test MCP tools
python test-mcp-tools-integration.py

# Test hybrid architecture
node test-hybrid-architecture.js
```

### Coverage
- ✅ Task decomposition (3 test cases)
- ✅ Code execution sandbox (2 modes)
- ✅ Multi-agent coordination (3 patterns)
- ✅ Tool analytics (comprehensive report)
- ✅ Custom tools (register, use, remove)
- ✅ Full workflows (end-to-end)

---

## 🎉 What This Means

### For Developers

**Before v2.0:**
- Chat with AI
- Get code suggestions
- Manually implement and test

**After v2.0:**
- Give AI complex task
- AI breaks it down automatically
- AI executes with verification
- AI tracks progress
- You get working, tested result

### For Teams

**Before v2.0:**
- One AI agent per request
- Manual coordination
- Basic assistance

**After v2.0:**
- Multiple agents collaborate
- Automatic task delegation
- Progress visibility
- Verified results

### For Projects

**Before v2.0:**
- AI helps with pieces
- You assemble the whole
- Manual testing

**After v2.0:**
- AI handles entire workflows
- Systematic execution
- Built-in testing
- Progress tracking

---

## 🔮 Future Roadmap

### v2.1.0 (Planned)
- Parallel subtask execution
- Subtask prioritization
- Time estimation
- Custom task templates

### v2.2.0 (Planned)
- VS Code UI for task visualization
- Real-time progress indicators
- Interactive task editing
- Team collaboration features

### v2.x (Ideas)
- Rollback capabilities
- Multi-agent debugging UI
- Advanced analytics dashboards
- Plugin system for tools

---

## 🙏 Acknowledgments

This release represents a fundamental evolution in how AI assists with development. The goal: make complex tasks manageable through intelligent decomposition and autonomous execution.

Thank you to everyone testing and providing feedback!

---

## 📦 Upgrade Now

### Install Latest

**VS Code Extension:**
```bash
# Update from VS Code Marketplace
# Or install from VSIX
```

**Backend:**
```bash
git pull origin main
npm install
cd hybridmind-python-service
pip install -r requirements.txt
```

**Start Services:**
```bash
# Start Node.js backend
npm start

# Start Python service
cd hybridmind-python-service
python main.py
```

---

## 🐛 Known Issues

None currently reported for v2.0.0.

Report issues: [GitHub Issues](https://github.com/itheroservices-hub/hybridmind/issues)

---

## 📝 Summary

**HybridMind v2.0.0** transforms AI-assisted development from:
- ❌ Single responses → ✅ Complete workflows
- ❌ Manual testing → ✅ Automatic verification
- ❌ One agent → ✅ Multi-agent collaboration
- ❌ Basic tools → ✅ Advanced analytics
- ❌ Simple tasks → ✅ Complex projects

**This is the future of autonomous development. Welcome to HybridMind 2.0! 🚀**

---

**Download:** [GitHub Releases](https://github.com/itheroservices-hub/hybridmind/releases/tag/v2.0.0)  
**Documentation:** [Full Docs](./README.md)  
**Support:** [Discord](https://discord.gg/hybridmind) | [GitHub Issues](https://github.com/itheroservices-hub/hybridmind/issues)
