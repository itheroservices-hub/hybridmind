# 🎯 HYBRIDMIND MULTI-MODEL QUICK REFERENCE

## 4 EXECUTION MODES

| Mode | Free Users | Premium Users | Use Case |
|------|------------|---------------|----------|
| **Single** | ✅ 1 model | ✅ 1 model | Quick tasks |
| **Parallel** | ✅ 2 models | ✅ 4 models | Compare outputs |
| **Chain** | ✅ 2 models | ✅ 4 models | Progressive refinement |
| **Agentic** | ✅ 2 models | ✅ 4 models | Autonomous workflows |

---

## 📡 API ENDPOINTS

```bash
# Single Model
POST /run/single
{"model": "llama-3.3-70b", "prompt": "Add validation", "code": "..."}

# Parallel (side-by-side)
POST /run/parallel
{"models": ["llama-3.3-70b", "gemini-flash"], "prompt": "Compare", "code": "..."}

# Chaining (sequential)
POST /run/chain
{"models": ["llama-3.3-70b", "gemini-flash"], "prompt": "Improve", "code": "..."}

# Agentic (auto-select models)
POST /agent/plan
{"goal": "Refactor code", "options": {"workflowType": "balanced"}}

# Get model recommendations
POST /models/recommend
{"task": "code-review", "costTier": "medium"}
```

---

## 🧠 INTELLIGENT PAIRING

### Workflow Strategies

| Strategy | Planner | Executor | Reviewer | Cost/M |
|----------|---------|----------|----------|--------|
| **cost-optimized** | DeepSeek R1 Distill | Llama 3.3 70B | Mistral Small | ~$0.47 |
| **balanced** | Llama 3.3 70B | Claude 3.5 Sonnet | GPT-4o | ~$15.18 |
| **quality-optimized** | OpenAI o1 | Claude Sonnet 4.5 | Claude Opus 4.5 | ~$90 |
| **speed-optimized** | Gemini Flash | Claude Haiku | GPT-4o Mini | ~$1.60 |
| **reasoning-optimized** | DeepSeek R1 | o1-mini | o1 | ~$75 |
| **coding-optimized** | Qwen Coder Flash | Qwen Coder Plus | Codestral | ~$1.60 |

### Task-Based Auto-Selection

```javascript
{
  "code-review": ["claude-opus-4.5", "o1", "claude-sonnet-4.5"],
  "refactoring": ["claude-3.5-sonnet", "qwen3-coder-plus"],
  "optimization": ["deepseek-r1", "o1-mini", "claude-opus-4.5"],
  "debugging": ["qwen3-coder-plus", "gpt-4o", "claude-opus-4.5"],
  "testing": ["gpt-4o-mini", "llama-3.3-70b", "claude-haiku"],
  "documentation": ["claude-3.5-sonnet", "gpt-4o", "mistral-large"],
  "reasoning": ["o1", "deepseek-r1", "o1-mini"]
}
```

---

## 🆓 FREE TIER MODELS (6+)

| Model | Strengths | Speed |
|-------|-----------|-------|
| **Llama 3.3 70B** | General coding, reasoning | ⚡⚡⚡ |
| **Gemini 2.0 Flash** | Multimodal, fast | ⚡⚡⚡ |
| **DeepSeek V3** | Cost-effective reasoning | ⚡⚡ |
| **DeepSeek R1 Distill 70B** | Distilled reasoning | ⚡⚡ |
| **Qwen3 Coder** | Coding specialist | ⚡⚡ |
| **Devstral** | Agentic coding | ⚡⚡ |

---

## ⭐ PREMIUM TIER MODELS (25+)

### Reasoning Specialists
- **OpenAI o1** ($15/$60/M) - Ultimate reasoning
- **DeepSeek R1** ($0.55/$2.19/M) - Open-source o1 rival
- **o1-mini** ($3/$12/M) - Fast reasoning

### Coding Specialists
- **Qwen3 Coder Plus** ($0.40/M) - 480B parameters
- **Codestral 2508** ($0.30/$0.90/M) - Mistral's code expert

### General Purpose
- **GPT-4o** ($2.50/$10/M) - Latest OpenAI
- **Claude Sonnet 4.5** ($3/$15/M) - Latest Anthropic
- **Claude Opus 4.5** ($15/$75/M) - Best quality
- **Gemini 2.5 Pro** ($3.50/$10.50/M) - Google flagship

---

## 💡 EXAMPLE PAIRINGS

### For Speed (Free)
```json
["llama-3.3-70b", "gemini-flash"]
```

### For Quality (Premium)
```json
["openai/o1", "anthropic/claude-opus-4.5"]
```

### For Coding (Premium)
```json
["qwen/qwen3-coder-plus", "mistralai/codestral-2508"]
```

### For Budget (Free)
```json
["deepseek-v3", "llama-3.3-70b"]
```

### For Balance (Mixed)
```json
["llama-3.3-70b", "anthropic/claude-3.5-sonnet"]
```

### Premium 4-Model Workflow
```json
[
  "openai/o1",                    // Reasoning
  "qwen/qwen3-coder-plus",        // Coding
  "anthropic/claude-opus-4.5",    // Review
  "google/gemini-2.5-pro"         // Alternative perspective
]
```

---

## 🔓 USER OVERRIDE

**Auto-Selection:**
```bash
POST /agent/plan
{"goal": "Refactor", "options": {"workflowType": "balanced"}}
# System chooses: Llama 3.3 70B → Claude 3.5 Sonnet → GPT-4o
```

**Manual Override:**
```bash
POST /run/parallel
{"models": ["llama-3.3-70b", "qwen3-coder"]}
# You choose exactly which models
```

---

## 📊 TIER COMPARISON

| Feature | Free | Premium |
|---------|------|---------|
| Models | 6+ | 25+ |
| Parallel | 2 | 4 |
| Chain | 2 | 4 |
| Agentic | ✅ | ✅ |
| Auto-select | ✅ | ✅ |
| Override | ✅ | ✅ |
| Reasoning models | ❌ | ✅ |
| Coding specialists | ❌ | ✅ |

---

## 🚀 QUICK TEST

```bash
# Start backend
cd hybridmind-backend
node server.js

# Test single model
curl -X POST http://localhost:3000/run/single \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b", "prompt":"Add error handling", "code":"function test() { return 1; }"}'

# Test parallel
curl -X POST http://localhost:3000/run/parallel \
  -H "Content-Type: application/json" \
  -d '{"models":["llama-3.3-70b","gemini-flash"], "prompt":"Compare approaches", "code":"function test() { return 1; }"}'

# Test chaining
curl -X POST http://localhost:3000/run/chain \
  -H "Content-Type: application/json" \
  -d '{"models":["llama-3.3-70b","gemini-flash"], "prompt":"Improve progressively", "code":"function test() { return 1; }"}'

# Get models list
curl http://localhost:3000/models

# Get recommendation
curl -X POST http://localhost:3000/models/recommend \
  -H "Content-Type: application/json" \
  -d '{"task":"code-review", "costTier":"medium"}'
```

---

## ✅ SYSTEM STATUS

**ALL 4 MODES: FULLY FUNCTIONAL**

- ✅ Single Model Execution
- ✅ Parallel Comparison (2-4 models)
- ✅ Model Chaining (progressive refinement)
- ✅ Agentic Mode (intelligent auto-pairing)
- ✅ 25+ Models via OpenRouter
- ✅ User Override System
- ✅ Tier-Based Limits
- ✅ Intelligent Selection

**YOU'RE READY TO LAUNCH!** 🚀
