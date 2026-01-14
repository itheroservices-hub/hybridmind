# HybridMind AI Assistant v1.5

**Multi-model AI orchestration platform with 40+ premium models via OpenRouter.** Autonomous agents, multi-step workflows, transparent pricing, and the best AI models for each task - all from within VS Code.

## ✨ What's New in v1.5

🤖 **Autonomous Agent System** - Fully operational multi-step code modifications with AI planning  
🔄 **Undo Functionality** - 10-step history to revert any autonomous changes  
📊 **Real-Time Progress Tracking** - Monitor execution status for each workflow step  
🎯 **OpenRouter Integration** - Access to 40+ premium models with a single API key  
⚡ **Latest AI Models** - o1, Claude 4.5, Gemini 2.5, DeepSeek R1, Grok 2, and more  
💰 **Transparent Pricing** - See exact costs for each model ($0.09 to $75 per 1M tokens)  
🆓 **Free Tier** - 5 ultra-efficient models + 7-day Pro trial (100K tokens/day)  
💎 **Pro Tier** - Unlimited access to all premium models including o1 and Claude Opus 4.5  
🛠️ **Smart Execution** - AI-powered plan generation with context-aware validation  
🔍 **Task-Specific Models** - Automatic model selection based on task type

## ✨ Core Features

- **40+ Premium AI Models** via OpenRouter (o1, Claude 4.5, Gemini 2.5, DeepSeek R1, Grok 2, GPT-4o, and more)
- **Transparent Pricing** - See exact costs per model, from $0.09 to $75 per 1M tokens
- **Autonomous Agent System** - AI creates and executes multi-step modification plans
- **Persistent Chat Window** - Multi-turn conversations with any model
- **Undo System** - Revert autonomous changes with 10-step history
- **Embedded Server** - No manual setup required, just install and add your OpenRouter key
- **Zero Configuration** - Server starts automatically when VS Code opens
- **Cost-Efficient** - Single API key for all models, ultra-cheap options available
- **Privacy-First** - All requests go directly from your machine to OpenRouter
- **Smart Model Selection** - Automatic model routing based on task complexity and cost
- **Code Assistant** - Explain, review, optimize, fix bugs, generate tests autonomously

## 🚀 Quick Start

### 1. Install Extension

Install from VS Code Marketplace or:
```bash
code --install-extension hybridmind-1.5.0.vsix
```

### 2. Choose Your Tier

**Start Free, Upgrade Anytime**

- 🆓 **Free** - 5 models, 100K tokens/day + 7-day Pro trial, perfect for learning
- 💎 **Pro ($19/mo)** - All 57+ models, 5M tokens/day, autonomous workflows
- 🚀 **Pro Plus ($49/mo)** - 50M tokens/day, priority routing, team features
- 🏢 **Enterprise** - Unlimited usage, SLA, dedicated support

[Compare Plans →](https://hybridmind.dev/pricing)

### 3. Get Your OpenRouter API Key

HybridMind v1.5 uses **OpenRouter** for unified access to 40+ premium models with a single API key.

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Copy your key

**Why OpenRouter?**
- ✅ Single API key for 40+ models (o1, Claude 4.5, Gemini 2.5, etc.)
- ✅ Ultra-low cost models (starting at $0.09 per 1M tokens)
- ✅ Transparent pricing - see exact costs before you use
- ✅ Competitive pricing across all providers
- ✅ Automatic failover and load balancing
- ✅ Detailed usage tracking and analytics

### 4. Configure Extension

Press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings, then search for "HybridMind" and add your OpenRouter API key:

- **OpenRouter API Key**: Get from [openrouter.ai/keys](https://openrouter.ai/keys)

> **Note:** You only need one API key to access all models!

### 5. Start Using

- **Open Chat Window**: `Ctrl+Shift+P` → "HybridMind: Open Chat Window"
- **Quick Chat**: `Ctrl+Shift+P` → "HybridMind: Quick Chat"
- **Autonomous Agent**: `Ctrl+Shift+P` → "HybridMind: Run Autonomous Workflow"
- **Explain Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Explain Code"
- **Review Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Review Code"
- **Optimize Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Optimize Code"
- **Generate Tests**: Select function → `Ctrl+Shift+P` → "HybridMind: Generate Tests"
- **Fix Bugs**: Select code → `Ctrl+Shift+P` → "HybridMind: Fix Bugs"
- **Undo Last Change**: `Ctrl+Shift+P` → "HybridMind: Undo Last Autonomous Change"

## 📊 Available Models (via OpenRouter)

All pricing shown is per 1 million tokens (input/output).

### ✨ FREE TIER Models (100K tokens/day)

Perfect for learning, experimentation, and personal projects. **Includes 7-day Pro trial!**

| **Model** | **Provider** | **Input** | **Output** | **Best For** |
|----------|----------|---------|---------|-----------|
| **DeepSeek R1 Distill** | DeepSeek | $0.09 | $0.09 | Cheapest reasoning model |
| **Qwen 3 Coder Flash** | Qwen | $0.10 | $0.10 | Quick coding tasks |
| **Gemini 2.5 Flash** | Google | $0.075 | $0.30 | Fastest, cheapest multimodal |
| **Llama 3.3 70B** | Meta | $0.18 | $0.18 | Excellent general coding |
| **Qwen 2.5 Coder 32B** | Qwen | $0.18 | $0.18 | Coding specialist |

**Free Tier Limits:**
- ✅ 5 ultra-efficient models (all under $0.20/M tokens)
- ✅ 20 requests/hour
- ✅ 50 requests/day
- ✅ 100K tokens/day (~50 conversations, ~$0.10 max cost)
- ✅ Up to 8K context window
- ✅ **7-day Pro trial included** (access all 57 models!)

### 💎 PRO TIER Models (5M tokens/day)

Professional-grade AI for production work. **$19/month + OpenRouter costs**

#### 🧠 Advanced Reasoning (PRO ONLY)

| **Model** | **Provider** | **Input** | **Output** | **Best For** |
|----------|----------|---------|---------|-----------|
| **OpenAI o1** | OpenAI | $15.00 | $60.00 | Deep reasoning, complex problem-solving |
| **Claude Opus 4.5** | Anthropic | $15.00 | $75.00 | Most intelligent, best code review |
| **OpenAI o1-mini** | OpenAI | $3.00 | $12.00 | Faster reasoning, cost-effective |
| **DeepSeek R1** | DeepSeek | $0.55 | $2.19 | Advanced reasoning, ultra-cheap |
| **GPT-4 Turbo** | OpenAI | $10.00 | $30.00 | General purpose, wide knowledge |

#### ⚡ Premium Fast Models (PRO ONLY)

#### ⚡ Premium Fast Models (PRO ONLY)

| **Model** | **Provider** | **Input** | **Output** | **Best For** |
|----------|----------|---------|---------|-----------|
| **Claude Sonnet 4.5** | Anthropic | $3.00 | $15.00 | Best for coding, balanced |
| **Claude 3.5 Sonnet** | Anthropic | $3.00 | $15.00 | Refactoring, analysis |
| **GPT-4o** | OpenAI | $2.50 | $10.00 | Latest GPT-4, multimodal |
| **Gemini 2.5 Pro** | Google | $1.25 | $5.00 | 1M context, multimodal |
| **Llama 3.1 405B** | Meta | $2.70 | $2.70 | Massive open-source model |
| **Mistral Large** | Mistral | $2.00 | $6.00 | Multilingual, European AI |
| **Grok 2** | xAI | $2.00 | $10.00 | Real-time data, vision |

#### 🔧 Specialized Coding Models (PRO ONLY)

| **Model** | **Provider** | **Input** | **Output** | **Best For** |
|----------|----------|---------|---------|-----------|
| **Codestral 2508** | Mistral | $0.30 | $0.90 | Code completion specialist |
| **Claude Haiku 4.5** | Anthropic | $0.80 | $4.00 | Latest fast Claude |
| **GPT-4o Mini** | OpenAI | $0.15 | $0.60 | Simple tasks, cost-effective |
| **GPT-3.5 Turbo** | OpenAI | $0.50 | $1.50 | Legacy support, reliable |
| **Perplexity Sonar Pro** | Perplexity | $3.00 | $15.00 | Real-time internet search |

**Pro Tier Benefits ($19/month):**
- ✅ Access to ALL 40+ models (including o1, Claude Opus 4.5)
- ✅ 500 requests/hour, 2,000/day (10x free tier)
- ✅ 10M tokens/day (20x free tier)
- ✅ Up to 200K context window
- ✅ 4-model chains
- ✅ Autonomous agent workflows
- ✅ Multi-model orchestration

**Pro Plus Tier Benefits ($49/month):**
- 🚀 All Pro features PLUS:
- 🚀 2,000 requests/hour, 10,000/day (20x Pro)
- 🚀 50M tokens/day (5x Pro tier)
- 🚀 Up to 1M context window
- 🚀 6-model chains
- 🚀 Priority routing
- 🚀 Dedicated support
- 🚀 Team collaboration & API access

**Enterprise Tier (Custom):**
- 💼 Unlimited tokens/day
- 💼 10,000 requests/hour
- 💼 Up to 2M context, 10-model chains
- 💼 SLA guarantees, white-label options
- 💼 Dedicated account manager

[Compare All Plans →](https://hybridmind.dev/pricing)

### Autonomous Agent Model Selection

The autonomous agent system automatically selects the best model for each task, balancing cost and quality:

- **Planning**: Llama 3.3 70B ($0.18/M) - Fast, free tier, excellent for breaking down tasks
- **Code Review**: Claude Opus 4.5 ($15/$75/M) - Most thorough analysis when quality matters
- **Refactoring**: Claude 3.5 Sonnet ($3/$15/M) - Best code understanding
- **Optimization**: DeepSeek R1 ($0.55/$2.19/M) - Advanced reasoning, ultra-cheap
- **Documentation**: Claude 3.5 Sonnet ($3/$15/M) - Clear technical writing
- **Testing**: Llama 3.3 70B ($0.18/M) - Efficient, cost-effective
- **Complex Reasoning**: OpenAI o1 ($15/$60/M) - When you need the absolute best

**Cost-Saving Tip**: Most workflows use free/cheap models for planning and simple tasks, reserving premium models only for critical analysis steps.

## 🤖 Autonomous Agent System

HybridMind v1.5 introduces a fully operational autonomous agent that can:

1. **Create Execution Plans** - AI analyzes your goal and creates multi-step modification plans
2. **Execute Autonomously** - Steps are executed sequentially with real-time progress tracking
3. **Validate Changes** - Each step is validated before proceeding
4. **Undo Support** - Revert any changes with 10-step history
5. **Direct Step Selection** - Jump to specific steps or re-execute as needed

### Example Workflow

```
User: "Add input validation to user registration function"

Agent Plan:
  Step 1: Add email validation regex
  Step 2: Add username length checks
  Step 3: Add error handling for invalid inputs
  
Execution:
  ✅ Step 1 completed (3.2s)
  ✅ Step 2 completed (2.8s)
  ✅ Step 3 completed (4.1s)
  
Result: All validations added successfully!
```

## 🛠️ How It Works

HybridMind v1.5 uses an **embedded lightweight server** that:
1. **Starts automatically** when VS Code opens (no manual setup!)
2. **Runs only when VS Code is open** (no 24/7 background processes)
3. **Routes AI requests** to OpenRouter using your API key
4. **Manages autonomous workflows** with step-by-step execution
5. **Tracks undo history** for safe code modifications

## 🔒 Privacy & Security

- **No Data Collection**: HybridMind doesn't collect any of your code or prompts
- **Direct API Calls**: All requests go straight from your machine to OpenRouter
- **Local Processing**: The embedded server runs locally on your machine
- **Your Keys**: You control and own your OpenRouter API key
- **Secure Storage**: API keys stored in VS Code settings, never transmitted except to OpenRouter

## 💰 Pricing

### 🆓 Free Tier - $0/month
**Perfect for learning and personal projects**

- ✅ **5 ultra-efficient models** (all under $0.20/M tokens)
- ✅ **100K tokens/day** (~$0.10 max daily cost to you)
- ✅ **20 requests/hour**, 50/day
- ✅ **8K context window**
- ✅ All basic features (chat, code assistance, etc.)
- ✅ Pay only OpenRouter costs (as low as $0.075/M tokens)
- ✅ **7-day Pro trial included** (access all 57 models!)

**Your Cost Example:**
- Typical day: 50K tokens = ~$0.05
- Heavy usage: 100K tokens = ~$0.10 max
- **No subscription fees**

---

### 💎 Pro Tier - $19/month
**Professional development with premium models**

- ⭐ **ALL 57+ models** including o1, Claude Opus 4.5, GPT-4
- ⭐ **5M tokens/day** (50x more than free)
- ⭐ **200 requests/hour**, 800/day
- ⭐ **128K context window**
- ⭐ **4-model chains** for complex workflows
- ⭐ **Autonomous agent workflows**
- ⭐ **Multi-model orchestration**
- ⭐ **Priority support**

**Your Cost Example:**
- Subscription: $19/month
- + OpenRouter: $10-50/month typical
- **Total: $29-69/month**

---

### 🚀 Pro Plus Tier - $49/month
**For power users and teams**

- 🔥 **ALL 57+ models** with higher limits
- 🔥 **20M tokens/day** (4x Pro tier)
- 🔥 **1,000 requests/hour**, 3,000/day
- 🔥 **1M context window** (full Gemini Pro capacity)
- 🔥 **6-model chains** for advanced workflows
- 🔥 **Priority routing** for faster responses
- 🔥 **Dedicated support** with faster response times
- 🔥 **Team collaboration** features
- 🔥 **API access** for custom integrations
- 🔥 **Extended history** (90 days vs 30 days)
- 🔥 **Batch processing** for large-scale tasks

**Your Cost Example:**
- Subscription: $49/month
- + OpenRouter: $50-200/month typical
- **Total: $99-249/month for serious development**

**Perfect For:**
- Development teams
- Production applications
- High-volume workflows
- Complex multi-model orchestration
- Companies needing reliability

---

### 🏢 Enterprise Tier - Custom Pricing
**For organizations with custom needs**

- 💼 **Unlimited tokens/day** (no hard limits)
- 💼 **10,000 requests/hour**, 50,000/day
- 💼 **2M context window**
- 💼 **10-model chains** for complex pipelines
- 💼 **SLA guarantees** with 99.9% uptime
- 💼 **White-label** options
- 💼 **Custom integrations** and workflows
- 💼 **Dedicated account manager**
- 💼 **On-premise deployment** options
- 💼 **Custom billing** and invoicing
- 💼 **Priority feature requests**

**Contact sales for custom pricing**

---

### 📊 Tier Comparison

| Feature | Free | Pro | Pro Plus | Enterprise |
|---------|------|-----|----------|------------|
| **Monthly Price** | $0 | $19 | $49 | Custom |
| **Models** | 5 ultra-efficient | All 40+ | All 40+ | All 40+ |
| **Tokens/Day** | 100K | 10M | 50M | Unlimited |
| **Requests/Hour** | 20 | 500 | 2,000 | 10,000 |
| **Context Window** | 8K | 200K | 1M | 2M |
| **Model Chains** | 2 | 4 | 6 | 10 |
| **Support** | Community | Priority | Dedicated | Account Manager |
| **API Access** | ❌ | ❌ | ✅ | ✅ |
| **Team Features** | ❌ | ❌ | ✅ | ✅ |
| **SLA** | ❌ | ❌ | ❌ | 99.9% |

**What You Pay:**
1. **HybridMind Subscription** - Choose your tier
2. **OpenRouter Usage** - Pay only for what you use
   - Free tier models: $0.075 - $0.18 per 1M tokens
   - Premium models: $2.50 - $75 per 1M tokens
   - You control costs by choosing models wisely

**Why This Model?**
- 💰 **No markup** - You pay OpenRouter's actual prices
- 🎯 **Full control** - Choose expensive models only when needed
- 📊 **Transparent** - See exact costs before each request
- 🔒 **Your API key** - Direct access, no middleman
- 📈 **Scale as you grow** - Start free, upgrade when ready

Track your usage at [openrouter.ai/activity](https://openrouter.ai/activity)

[Choose Your Plan →](https://hybridmind.dev/pricing)

## 🔧 Troubleshooting
- **Qwen**: Free tier available

[Get Premium →](https://hybridmind.dev/pricing)

- **No Data Collection**: HybridMind doesn't collect any of your code or prompts
- **Direct API Calls**: All requests go straight from your machine to AI providers
- **Local Processing**: The embedded server runs locally on your machine
- **Your Keys**: You control and own all API keys

## 💰 Pricing

**Extension:** FREE  
**Usage:** Pay-as-you-go with your own API keys

Most providers offer generous free tiers:
- **Groq**: Free tier available
- **Gemini**: 1 million tokens/month free
- **DeepSeek**: Very low cost ($0.14/1M tokens)
- **Qwen**: Free tier available

## 🔧 Troubleshooting

### "No models available"
- Check that your OpenRouter API key is configured in Settings
- Verify the API key is valid at [openrouter.ai/keys](https://openrouter.ai/keys)
- Ensure you have credits available on your OpenRouter account

### Extension not activating
- Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
- Check VS Code version is 1.108.0 or higher
- View Output panel: `Ctrl+Shift+P` → "View: Toggle Output" → Select "HybridMind"

### Autonomous agent not working
- Ensure OpenRouter API key is configured
- Check that you have credits on your OpenRouter account
- Verify internet connection
- Check Output panel for detailed error messages

### "Undo not available"
- Undo only works for changes made by the autonomous agent
- Undo history is limited to the last 10 autonomous modifications
- Manual code changes cannot be undone through HybridMind

### API errors
- Verify you have credits available on OpenRouter
- Check internet connection
- Ensure API key is entered correctly (no extra spaces)
- Some models may have rate limits - try again after a short wait

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

Contributions welcome! Visit [github.com/itheroservices-hub/hybridmind](https://github.com/itheroservices-hub/hybridmind)

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/itheroservices-hub/hybridmind/issues)
- **Discussions**: [GitHub Discussions](https://github.com/itheroservices-hub/hybridmind/discussions)

---

**Built with ❤️ for developers who want the freedom to choose the best AI for every task.**

