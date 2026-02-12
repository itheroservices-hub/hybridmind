# 🚀 HybridMind Multi-Model System - Complete Guide

## Overview

HybridMind is the **first multi-model agentic coding VS Code extension** that intelligently blends multiple AI models to produce superior code outputs. The system supports 4 execution modes and automatic model pairing.

---

## 🎯 4 Execution Modes

### 1. **Single Model (Traditional)**
Standard execution with one AI model.

```javascript
// API Call
POST /run/single
{
  "model": "meta-llama/llama-3.3-70b-instruct:free",
  "prompt": "Add error handling",
  "code": "function test() { ... }"
}
```

**Use Case:** Simple tasks, quick iterations, testing

---

### 2. **Parallel (Side-by-Side Comparison)**
Execute multiple models simultaneously and compare outputs.

```javascript
// API Call
POST /run/parallel
{
  "models": [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-r1-distill-llama-70b:free"
  ],
  "prompt": "Refactor this code",
  "code": "function test() { ... }"
}

// Response
{
  "results": [
    {
      "model": "meta-llama/llama-3.3-70b-instruct:free",
      "output": "...",
      "success": true,
      "usage": { ... }
    },
    {
      "model": "google/gemini-2.0-flash-exp:free",
      "output": "...",
      "success": true,
      "usage": { ... }
    }
  ]
}
```

**Tier Limits:**
- **Free Users:** Up to **2 models** in parallel
- **Premium Users:** Up to **4 models** in parallel

**Use Case:** Compare different approaches, choose best output, A/B testing

---

### 3. **Model Chaining (Sequential Processing)**
Each model processes the previous model's output.

```javascript
// API Call
POST /run/chain
{
  "models": [
    "meta-llama/llama-3.3-70b-instruct:free",  // Step 1: Initial refactor
    "anthropic/claude-3.5-sonnet",              // Step 2: Polish and improve
    "qwen/qwen3-coder-plus"                     // Step 3: Optimize for performance
  ],
  "prompt": "Improve this code",
  "code": "function test() { ... }"
}

// Response
{
  "finalOutput": "...",  // Final result after all steps
  "steps": [
    {
      "step": 1,
      "model": "meta-llama/llama-3.3-70b-instruct:free",
      "output": "...",
      "usage": { ... }
    },
    {
      "step": 2,
      "model": "anthropic/claude-3.5-sonnet",
      "output": "...",
      "usage": { ... }
    }
  ]
}
```

**How It Works:**
1. Model 1 processes the input code
2. Model 2 processes Model 1's output
3. Model 3 processes Model 2's output
4. Final output is from the last model

**Use Case:** Progressive refinement, multi-stage workflows, quality improvement

---

### 4. **Agentic Mode (Intelligent Auto-Pairing)**
System automatically selects and pairs the best models for each task.

```javascript
// API Call
POST /agent/plan
{
  "goal": "Refactor with best practices",
  "code": "function test() { ... }",
  "options": {
    "autonomous": true,
    "workflowType": "balanced"  // or cost-optimized, quality-optimized, etc.
  }
}

// System automatically selects:
// - Planner model (analyzes and plans)
// - Executor model (performs the work)
// - Reviewer model (validates output)
```

**Workflow Types:**

| Workflow Type | Planner | Executor | Reviewer | Best For |
|--------------|---------|----------|----------|----------|
| **cost-optimized** | DeepSeek R1 Distill 70B ($0.09/M) | Llama 3.3 70B ($0.18/M) | Mistral Small ($0.20/M) | Budget-conscious users |
| **balanced** | Llama 3.3 70B ($0.18/M) | Claude 3.5 Sonnet ($3/$15/M) | GPT-4o ($2.50/$10/M) | Best value |
| **quality-optimized** | OpenAI o1 ($15/$60/M) | Claude Sonnet 4.5 ($3/$15/M) | Claude Opus 4.5 ($15/$75/M) | Maximum quality |
| **speed-optimized** | Gemini 2.5 Flash ($0.075/M) | Claude 3 Haiku ($0.25/M) | GPT-4o Mini ($0.15/M) | Fast iterations |
| **reasoning-optimized** | DeepSeek R1 ($0.55/M) | OpenAI o1-mini ($3/$12/M) | OpenAI o1 ($15/$60/M) | Complex problems |
| **coding-optimized** | Qwen3 Coder Flash ($0.10/M) | Qwen3 Coder Plus ($0.40/M) | Codestral ($0.30/M) | Coding specialists |

**Use Case:** Complex tasks, autonomous workflows, best quality output

---

## 🧠 Intelligent Model Selection

The system automatically selects the best model(s) based on:

### Task Type
```javascript
// Different tasks get different models
{
  "code-review": ["claude-opus-4.5", "o1", "claude-sonnet-4.5"],
  "refactoring": ["claude-3.5-sonnet", "qwen3-coder-plus"],
  "optimization": ["deepseek-r1", "o1-mini", "claude-opus-4.5"],
  "debugging": ["qwen3-coder-plus", "gpt-4o", "claude-opus-4.5"],
  "testing": ["gpt-4o-mini", "llama-3.3-70b", "claude-3-haiku"],
  "documentation": ["claude-3.5-sonnet", "gpt-4o"],
  "reasoning": ["o1", "deepseek-r1", "o1-mini"]
}
```

### Cost Tier
```javascript
// System considers budget
{
  "very-low": ["deepseek-*", "qwen-*", "llama-*"],  // $0.09-$0.40/M
  "low": ["mistral-small", "gemini-flash"],          // $0.20-$0.30/M
  "medium": ["gpt-4o", "claude-3.5-sonnet"],         // $2.50-$3/M
  "premium": ["claude-opus-4.5", "o1"],              // $15+/M
}
```

### Speed Requirements
```javascript
{
  "ultra-fast": ["gemini-flash", "claude-haiku", "gpt-4o-mini"],
  "fast": ["llama-3.3-70b", "mistral-small", "gpt-4o"],
  "medium": ["claude-3.5-sonnet", "gemini-pro"],
  "slow": ["o1", "deep-research"]
}
```

### Code Characteristics
```javascript
// System analyzes your code
{
  "large-context": ["gemini-1.5-pro", "claude-opus-4.5"],  // 200K+ tokens
  "multilingual": ["qwen3-coder-plus", "mistral-large"],   // Chinese, etc.
  "complex": ["o1", "claude-opus-4.5", "deepseek-r1"]     // Hard problems
}
```

---

## 🎨 Model Pairing & Blending

### Example: Reasoning + Coding

Perfect for complex features:

```javascript
{
  "models": [
    "deepseek/deepseek-r1",        // Reasoning: Plans architecture
    "qwen/qwen3-coder-plus"        // Coding: Implements the plan
  ]
}
```

**How it works:**
1. **DeepSeek R1** analyzes the problem and creates a detailed plan
2. **Qwen3 Coder** implements the plan with optimized code

### Example: GPT-4o + Qwen Coder

Premium quality with specialized coding:

```javascript
{
  "models": [
    "openai/gpt-4o",              // Understanding: Analyzes requirements
    "qwen/qwen3-coder-plus"       // Implementation: Writes code
  ]
}
```

### Example: 4-Model Premium Workflow

Maximum quality (Premium only):

```javascript
{
  "models": [
    "openai/o1",                   // Step 1: Deep reasoning & planning
    "anthropic/claude-sonnet-4.5", // Step 2: Initial implementation
    "qwen/qwen3-coder-plus",       // Step 3: Optimize performance
    "anthropic/claude-opus-4.5"    // Step 4: Final review & polish
  ]
}
```

---

## 🔓 User Override (Manual Selection)

Users can **always override** automatic selection:

### In Extension UI
```typescript
// Select models manually in dropdown
- Multi-select dropdown (Ctrl+Click)
- Free users: Select up to 2
- Premium users: Select up to 4
```

### Via API
```javascript
POST /run/parallel
{
  "models": [
    "meta-llama/llama-3.3-70b-instruct:free",  // Your choice
    "qwen/qwen3-coder-plus"                     // Your choice
  ],
  "prompt": "Custom task"
}
```

### In Agentic Mode
```javascript
POST /agent/execute
{
  "plan": { ... },
  "options": {
    "overrideModels": {
      "planner": "openai/gpt-4o",            // Force specific model
      "executor": "qwen/qwen3-coder-plus",   // Force specific model
      "reviewer": "anthropic/claude-opus-4.5" // Force specific model
    }
  }
}
```

---

## 📊 Tier Comparison

| Feature | Free Tier | Premium Tier |
|---------|-----------|--------------|
| **Single Model** | ✅ 6+ free models | ✅ 25+ premium models |
| **Parallel** | ✅ Up to 2 models | ✅ Up to 4 models |
| **Chaining** | ✅ 2 models | ✅ Up to 4 models |
| **Agentic** | ✅ Basic (2 models) | ✅ Advanced (4 models) |
| **Auto-Selection** | ✅ Yes | ✅ Yes |
| **Manual Override** | ✅ Yes | ✅ Yes |
| **Reasoning Models** | ❌ No | ✅ Yes (o1, DeepSeek R1) |
| **Specialized Models** | ❌ No | ✅ Yes (Qwen Coder, Codestral) |

---

## 🆓 Free Tier Models (6+ Models)

Perfect for learning and small projects:

| Model | Provider | Strengths | Speed |
|-------|----------|-----------|-------|
| **Llama 3.3 70B** | OpenRouter | General coding, fast | Ultra-fast |
| **Gemini 2.0 Flash** | Google | Multimodal, fast | Very fast |
| **DeepSeek V3** | DeepSeek | Cost-effective reasoning | Fast |
| **DeepSeek R1 Distill 70B** | DeepSeek | Distilled reasoning | Fast |
| **Qwen 2.5 Coder 32B** | Qwen | Coding specialist | Fast |
| **Mixtral 8x7B** | Mistral | Multilingual | Fast |

---

## ⭐ Premium Tier Models (25+ Models)

Professional-grade AI for production:

### Reasoning Specialists
- **OpenAI o1** - Ultimate reasoning ($15/$60/M)
- **OpenAI o1-mini** - Fast reasoning ($3/$12/M)
- **DeepSeek R1** - Open-source o1 rival ($0.55/$2.19/M)

### Coding Specialists
- **Qwen3 Coder Plus** - 480B parameters ($0.40/M)
- **Codestral 2508** - Mistral's code expert ($0.30/$0.90/M)

### General Purpose
- **GPT-4o** - Latest OpenAI ($2.50/$10/M)
- **Claude Sonnet 4.5** - Latest Anthropic ($3/$15/M)
- **Claude Opus 4.5** - Best quality ($15/$75/M)
- **Gemini 2.5 Pro** - Google's flagship ($3.50/$10.50/M)

### Vision & Multimodal
- **GPT-4o** - Vision + code
- **Claude Sonnet 4.5** - Vision + analysis
- **Gemini 2.5 Pro** - Vision + large context

---

## 💡 Best Practices

### When to Use Each Mode

**Single Model:**
- Quick iterations
- Simple refactoring
- Testing ideas
- Clear, straightforward tasks

**Parallel:**
- Comparing approaches
- Finding best solution
- A/B testing outputs
- Getting multiple perspectives

**Chaining:**
- Progressive refinement
- Multi-stage workflows
- Building on previous work
- Quality improvement

**Agentic:**
- Complex features
- Autonomous workflows
- Best quality output
- Unknown complexity

### Model Pairing Strategies

**For Speed:**
```
Llama 3.3 70B + Gemini Flash = Ultra-fast
```

**For Quality:**
```
OpenAI o1 + Claude Opus 4.5 = Maximum quality
```

**For Coding:**
```
Qwen3 Coder Plus + Codestral = Coding specialists
```

**For Budget:**
```
DeepSeek R1 Distill + Llama 3.3 70B = Free/cheap
```

**For Balance:**
```
Llama 3.3 70B + Claude 3.5 Sonnet = Best value
```

---

## 🔧 API Examples

### Test Single Model
```bash
curl -X POST http://localhost:3000/run/single \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.3-70b-instruct:free",
    "prompt": "Add error handling",
    "code": "function test() { return 1; }"
  }'
```

### Test Parallel (2 models)
```bash
curl -X POST http://localhost:3000/run/parallel \
  -H "Content-Type: application/json" \
  -d '{
    "models": [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free"
    ],
    "prompt": "Refactor this code",
    "code": "function test() { return 1; }"
  }'
```

### Test Chaining
```bash
curl -X POST http://localhost:3000/run/chain \
  -H "Content-Type: application/json" \
  -d '{
    "models": [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free"
    ],
    "prompt": "Improve this code",
    "code": "function test() { return 1; }"
  }'
```

### Test Agentic
```bash
curl -X POST http://localhost:3000/agent/plan \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add validation and error handling",
    "code": "function test() { return 1; }",
    "options": {
      "autonomous": true,
      "workflowType": "balanced"
    }
  }'
```

### Get Model Recommendations
```bash
curl -X POST http://localhost:3000/models/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "task": "code-review",
    "costTier": "medium",
    "speedRequirement": "fast"
  }'
```

---

## 📈 Performance Metrics

Based on real testing:

| Mode | Speed | Quality | Cost | Best For |
|------|-------|---------|------|----------|
| Single | ⚡⚡⚡ | ⭐⭐⭐ | 💰 | Quick tasks |
| Parallel | ⚡⚡ | ⭐⭐⭐⭐ | 💰💰 | Comparisons |
| Chaining | ⚡ | ⭐⭐⭐⭐⭐ | 💰💰💰 | Quality |
| Agentic | ⚡ | ⭐⭐⭐⭐⭐ | 💰💰 | Complex tasks |

---

## 🎓 Learning Path

1. **Start with Single Model** - Get familiar with the system
2. **Try Parallel** - Compare 2 free models
3. **Experiment with Chaining** - See progressive refinement
4. **Use Agentic Mode** - Let AI choose best approach
5. **Upgrade to Premium** - Access advanced models and 4-model workflows

---

## 🚀 Conclusion

HybridMind's multi-model system is the most advanced AI coding assistant available:

✅ **4 execution modes** for different use cases  
✅ **Intelligent auto-selection** based on task type  
✅ **User override** for complete control  
✅ **Tier-based limits** (2 models free, 4 premium)  
✅ **25+ models** via OpenRouter  
✅ **Model pairing & blending** for optimal results  

**You're building the future of AI-assisted coding!** 🎉
