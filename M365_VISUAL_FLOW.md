# Microsoft 365 Agents + MCP Visual Flow

## 🎯 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                          DEVELOPER                               │
│                                                                  │
│  "How do I create a declarative agent for M365 Copilot?"       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VS CODE EXTENSION                             │
│                      (HybridMind UI)                             │
│                                                                  │
│  ✓ Chat Sidebar                                                 │
│  ✓ Inline Chat                                                  │
│  ✓ Commands                                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP Request
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HYBRIDMIND BACKEND                             │
│                    (Node.js Server)                              │
│                                                                  │
│  POST /mcp/m365agentstoolkit                                    │
│  {                                                               │
│    "tool": "get_knowledge",                                     │
│    "args": {                                                     │
│      "question": "How do I create a declarative agent?"         │
│    }                                                             │
│  }                                                               │
│                                                                  │
│  ✓ License Validation                                           │
│  ✓ Rate Limiting                                                │
│  ✓ Security Checks                                              │
│  ✓ Request Routing                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │ Route to M365 Handler
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              M365 AGENTS TOOLKIT MCP HANDLER                     │
│           (hybridmind-backend/routes/mcpRoutes.js)               │
│                                                                  │
│  handleM365AgentsToolkitTool(tool, args) {                      │
│                                                                  │
│    if (tool === 'get_knowledge') {                              │
│      ✓ Validate question parameter                             │
│      ✓ Format request                                           │
│      ✓ Bridge to external MCP server                           │
│      ✓ Return structured response                              │
│    }                                                             │
│                                                                  │
│    // Also handles:                                             │
│    // - get_schema                                              │
│    // - get_code_snippets                                       │
│    // - troubleshoot                                            │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │ Bridge Connection
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           @microsoft/m365agentstoolkit-mcp                       │
│                  (External MCP Server)                           │
│                                                                  │
│  📚 Official Microsoft Documentation                            │
│  📋 Manifest Schemas                                            │
│  💻 SDK Code Snippets                                           │
│  🔧 Troubleshooting Knowledge                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Rich Response
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE TO DEVELOPER                        │
│                                                                  │
│  {                                                               │
│    "success": true,                                             │
│    "tool": "get_knowledge",                                     │
│    "question": "How do I create a declarative agent?",          │
│    "answer": "A declarative agent is...",                       │
│    "documentation": "...",                                      │
│    "examples": [...],                                           │
│    "links": [...]                                               │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Tool Flow Examples

### Tool 1: get_knowledge

```
User Question → Backend → M365 MCP → Official Docs
     ↓
"How to create      "get_knowledge"     Microsoft 365
 declarative         query              Agents Toolkit
 agent?"                                Knowledge Base
     ↓                                        ↓
Comprehensive answer with:
• Concept explanation
• Step-by-step guide
• Code examples
• Best practices
• Official links
```

### Tool 2: get_schema

```
Schema Request → Backend → M365 MCP → Schema Repository
     ↓
"Get app_manifest   "get_schema"      Official JSON
 schema"            request           Schema v1.x
     ↓                                       ↓
Full schema with:
• JSON Schema definition
• Property descriptions
• Validation rules
• Example manifests
```

### Tool 3: get_code_snippets

```
Code Request → Backend → M365 MCP → SDK Code Library
     ↓
"Generate Teams    "get_code_snippets"  @microsoft/
 bot code"          request             teams-ai SDK
     ↓                                        ↓
Working code with:
• TypeScript/JavaScript
• React components
• Configuration files
• Installation steps
```

### Tool 4: troubleshoot

```
Error Description → Backend → M365 MCP → Troubleshooting DB
     ↓
"Manifest          "troubleshoot"     Common Issues
 validation         request           & Solutions
 failing"
     ↓                                       ↓
Solution with:
• Error explanation
• Root cause
• Fix steps
• Prevention tips
```

---

## 🎨 Multi-Agent Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT M365 PROJECT                      │
└─────────────────────────────────────────────────────────────────┘

Agent 1: ARCHITECT
  ↓
  • Calls: get_knowledge("declarative agent architecture")
  • Calls: get_schema("declarative_agent_manifest")
  • Designs: Agent structure and capabilities
  ↓

Agent 2: DEVELOPER
  ↓
  • Calls: get_code_snippets("declarative agent manifest")
  • Calls: get_code_snippets("conversation starters")
  • Creates: Manifest files and configuration
  ↓

Agent 3: TESTER
  ↓
  • Validates: Manifest against schema
  • Calls: troubleshoot(validation_errors)
  • Ensures: All requirements met
  ↓

RESULT: Production-ready M365 Copilot Declarative Agent
```

---

## 🔐 Security Flow

```
┌────────────────────────────────────────────────────────────┐
│                     INCOMING REQUEST                        │
└───────────────────────────┬────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ License Check │
                    └───────┬───────┘
                            │ Valid?
                            ▼
                    ┌───────────────┐
                    │  Rate Limiter │
                    └───────┬───────┘
                            │ Within limits?
                            ▼
                    ┌───────────────┐
                    │  Validate     │
                    │  Parameters   │
                    └───────┬───────┘
                            │ Valid?
                            ▼
                    ┌───────────────┐
                    │  Execute Tool │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Log Request  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Return       │
                    │  Response     │
                    └───────────────┘
```

---

## 📊 Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                    USER INPUT                             │
│  "How do I create a Teams bot?"                          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  HybridMind  │
              │  Extension   │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Backend    │
              │   Routing    │
              └──────┬───────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    ┌──────────┐         ┌──────────┐
    │   Tool   │         │  Schema  │
    │Validation│         │  Route   │
    └────┬─────┘         └────┬─────┘
         │                    │
         └──────────┬─────────┘
                    │
                    ▼
            ┌───────────────┐
            │  M365 Handler │
            │  (mcpRoutes)  │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ External MCP  │
            │    Server     │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Microsoft    │
            │  Knowledge    │
            └───────┬───────┘
                    │
                    ▼
              ┌──────────┐
              │ Response │
              │Formatting│
              └────┬─────┘
                   │
                   ▼
            ┌──────────────┐
            │    Cache     │
            │   (1 hour)   │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   Return to  │
            │     UI       │
            └──────────────┘
```

---

## 🎯 Component Interaction

```
                    ╔══════════════════╗
                    ║   VS Code IDE    ║
                    ╚════════╦═════════╝
                             ║
            ┌────────────────╨────────────────┐
            │                                  │
    ╔═══════▼═════════╗           ╔═══════════▼══════════╗
    ║  HybridMind     ║           ║   VS Code MCP        ║
    ║  Extension      ║◄──────────║   Provider System    ║
    ╚═══════╤═════════╝           ╚══════════════════════╝
            │
            │ HTTP/REST API
            │
    ╔═══════▼════════════════════════════════════╗
    ║        HybridMind Backend Server           ║
    ║                                            ║
    ║  ┌────────────┐  ┌─────────────┐         ║
    ║  │   Auth &   │  │    Rate     │         ║
    ║  │  Security  │  │   Limiter   │         ║
    ║  └────────────┘  └─────────────┘         ║
    ║                                            ║
    ║  ┌──────────────────────────────────┐    ║
    ║  │     MCP Route Handler            │    ║
    ║  │  /mcp/filesystem                 │    ║
    ║  │  /mcp/terminal                   │    ║
    ║  │  /mcp/web-search                 │    ║
    ║  │  /mcp/graphiti-memory            │    ║
    ║  │  /mcp/m365agentstoolkit ⭐      │    ║
    ║  └──────────────────────────────────┘    ║
    ╚═══════════════════╤═══════════════════════╝
                        │
            ┌───────────┴───────────┐
            │                       │
    ╔═══════▼═════════╗   ╔══════════▼═══════════╗
    ║  Internal MCP   ║   ║  External MCP        ║
    ║  Tools          ║   ║  @microsoft/         ║
    ║  • Filesystem   ║   ║  m365agentstoolkit   ║
    ║  • Terminal     ║   ║  -mcp                ║
    ║  • Web Search   ║   ║                      ║
    ╚═════════════════╝   ╚══════════════════════╝
```

---

## 📖 File Structure

```
HybridMind/
│
├── Backend (Node.js)
│   └── hybridmind-backend/
│       └── routes/
│           └── mcpRoutes.js ⭐ M365 Handler (lines 264-415)
│
├── Extension (TypeScript)
│   └── hybridmind-extension/
│       ├── .vscode/
│       │   └── mcp.json ⭐ MCP Server Config
│       └── src/
│           └── mcp/
│               └── mcpServerRegistry.ts ⭐ MCP Registry
│
├── Documentation
│   ├── M365_AGENTS_MCP_INTEGRATION.md ⭐ Full Guide
│   ├── M365_QUICK_REFERENCE.md ⭐ Quick Ref
│   ├── M365_IMPLEMENTATION_SUMMARY.md ⭐ Summary
│   └── M365_VISUAL_FLOW.md ← This File
│
└── Testing & Demos
    ├── test-m365-mcp.js ⭐ Test Suite
    └── demo-m365-agent-creation.js ⭐ Demo
```

---

## 🎊 Integration Points

```
┌─────────────────────────────────────────────────────────┐
│              HYBRIDMIND ECOSYSTEM                        │
│                                                          │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐     │
│  │   Ralph    │   │   Multi-   │   │  Context   │     │
│  │   Chain    │   │   Agent    │   │  Manager   │     │
│  │            │   │   System   │   │            │     │
│  └──────┬─────┘   └──────┬─────┘   └──────┬─────┘     │
│         │                │                │            │
│         └────────────────┼────────────────┘            │
│                          │                             │
│                  ┌───────▼────────┐                    │
│                  │  M365 MCP      │                    │
│                  │  Integration   │                    │
│                  └───────┬────────┘                    │
│                          │                             │
│         ┌────────────────┼────────────────┐            │
│         │                │                │            │
│   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐     │
│   │  Tool     │   │  Guardrail │   │  Planning │     │
│   │  System   │   │  System    │   │  System   │     │
│   └───────────┘   └───────────┘   └───────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Visual Flow Documentation**  
**HybridMind v1.8.0 + Microsoft 365 Agents Toolkit**  
**Status:** ✅ Production Ready
