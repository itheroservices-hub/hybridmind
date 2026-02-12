# HybridMind v1.4.0 - Release Notes

## 🚀 Major Update: 25+ AI Models Now Available!

**Release Date**: January 9, 2026

---

## 🎯 What's New

### ✨ Massive Model Expansion
- **Upgraded from 10 to 25+ working AI models**
- Added latest **Claude 4.5** series (Opus, Sonnet, Haiku)
- Added newest **Gemini 2.5** series (Pro, Flash)
- Added **Grok 4** and Grok 4 Fast
- Added advanced reasoning models (DeepSeek R1, Phi-4 Reasoning Plus)
- Added specialized coding models (Codestral 2508, Devstral, Qwen 3 Coder Plus)
- Added **Perplexity Sonar Pro** with real-time internet search

### 🔌 OpenRouter Integration
- Integrated **OpenRouter API** for access to 300+ premium models
- Pay-as-you-go pricing for premium models
- No need to manage multiple API keys
- Cost-effective access to the latest AI models

### 🎨 UI Improvements
- **Organized model categories**:
  - 🧠 Reasoning Models
  - 👑 Flagship Models
  - ⚡ Fast & Affordable
  - 🎯 Specialized Models
- New **badge system**:
  - 🟢 FREE - Free tier models
  - 🔵 PRO - Premium models
  - 🌈 ULTRA - Ultra-premium reasoning models
- Categorized dropdown for easier model selection

### 🔧 Model ID Updates
- Fixed all broken model IDs
- Updated to latest model versions
- Removed unavailable models (o1, o1-mini, o3-mini)
- 100% working model guarantee

---

## 📊 Model Breakdown

### Free Tier (6 Models)
- Llama 3.3 70B (Groq) - Ultra-fast, free
- Mixtral 8x7B - Multilingual, fast
- Gemini Flash 2.0 - Multimodal, fast
- DeepSeek V3 - Cost-effective reasoning
- DeepSeek R1 Distill 70B - Reasoning model
- Llama 3.3 70B (OpenRouter) - Alternative source

### Premium Tier (19 Models)

**🧠 Reasoning (3 models)**
- DeepSeek R1 Latest (0528)
- Phi-4 Reasoning Plus
- DeepSeek R1

**👑 Flagship (8 models)**
- GPT-4o
- GPT-4 Turbo
- Claude Opus 4.5 ⭐ NEW
- Claude Sonnet 4.5 ⭐ NEW
- Claude 3.5 Sonnet
- Claude Opus 4
- Claude Sonnet 4
- Gemini 2.5 Pro ⭐ NEW

**⚡ Fast & Affordable (4 models)**
- GPT-4o Mini
- GPT-3.5 Turbo
- Claude Haiku 4.5 ⭐ NEW
- Gemini 2.5 Flash ⭐ NEW

**🎯 Specialized (4 models)**
- Codestral 2508 ⭐ NEW
- Qwen 2.5 Coder 32B
- Qwen 3 Coder Plus ⭐ NEW
- Perplexity Sonar Pro ⭐ NEW
- Grok 4 ⭐ NEW
- Llama 3.1 405B
- Mistral Large

⭐ = New in v1.4.0

---

## 🔥 Key Features

### Multi-Model Workflows
- **Single Mode**: Use one model at a time
- **Parallel Mode**: Get responses from multiple models simultaneously
- **Chain Mode**: Sequential refinement across models
- **Agentic Mode**: 3-agent system (Planner → Executor → Reviewer)

### Tier System
- **Free Tier**: 6 models, 2 parallel models
- **Pro Tier**: 25+ models, 4 parallel models, all workflows

### Autonomy Control (Agentic Mode)
- **Level 1**: Advisory (ask before actions)
- **Level 2**: Assisted (execute with confirmation)
- **Level 3**: Full Auto (autonomous execution)

### Granular Permissions
- Read files
- Edit files
- Terminal access
- Create files
- Delete files
- Multi-step operations
- Restructure code
- Network access

---

## 💰 Pricing & Cost

### Free Tier
- 6 free models (Groq, DeepSeek, Gemini)
- 2 parallel models
- Basic workflows
- **Your cost**: $0/month

### Pro Tier ($9.99/month)
- All 25+ models
- 4 parallel models
- All workflows (Chain, Agentic)
- Advanced reasoning models
- **Your cost**: ~$2-5/user/month via OpenRouter
- **Your profit**: ~$5-7/user/month

### Model Costs (OpenRouter Pay-as-you-go)
- **Claude 4.5 Opus**: $15/1M input, $75/1M output
- **Claude 4.5 Sonnet**: $3/1M input, $15/1M output
- **GPT-4o**: $2.50/1M input, $10/1M output
- **Gemini 2.5 Pro**: $1.25/1M input, $5/1M output
- **DeepSeek R1**: Very low cost
- **Codestral**: $0.30/1M tokens

---

## 🐛 Bug Fixes

- Fixed broken model IDs (Gemini, Mistral, Perplexity, Grok)
- Updated deprecated model references
- Improved error handling for unavailable models
- Better rate limiting for API calls

---

## ⚡ Performance Improvements

- Optimized model selection logic
- Faster model loading
- Improved UI responsiveness
- Better error messages

---

## 🔮 What's Next (Roadmap)

### v1.5 (Planned)
- Usage analytics dashboard
- Cost tracking per session
- Model performance metrics
- Custom workflow templates
- Saved model combinations

### v1.6 (Planned)
- Team collaboration features
- Shared model credits
- Usage quotas
- Admin dashboard

---

## 📚 Documentation

- See [MODEL_UPDATE_COMPLETE.md](MODEL_UPDATE_COMPLETE.md) for full model test results
- See [EXPANDED_MODEL_LIBRARY.md](EXPANDED_MODEL_LIBRARY.md) for model selection guide
- See [OPENROUTER_INTEGRATION_COMPLETE.md](OPENROUTER_INTEGRATION_COMPLETE.md) for OpenRouter details

---

## 🙏 Breaking Changes

### Model IDs Changed
If you were using these models directly, update to new IDs:
- `google/gemini-pro-1.5` → `google/gemini-2.5-pro`
- `mistralai/codestral` → `mistralai/codestral-2508`
- `x-ai/grok-2` → `x-ai/grok-4`
- `perplexity/llama-3.1-sonar-large-128k-online` → `perplexity/sonar-pro-search`

### Models Removed
These models are no longer available:
- `openai/o1` (requires special access)
- `openai/o1-mini` (doesn't exist)
- `openai/o3-mini` (not publicly available)

---

## 🚀 Installation

```bash
# Install from VSIX
code --install-extension hybridmind-1.4.0.vsix

# Or update existing installation
code --uninstall-extension hybridmind.hybridmind
code --install-extension hybridmind-1.4.0.vsix
```

---

## 🔑 Setup

1. Add your OpenRouter API key to `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

2. Restart VS Code

3. Open HybridMind sidebar

4. Select models and start chatting!

---

## 📊 Comparison

### vs v1.3.4
- ✅ **+15 models** (10 → 25)
- ✅ **Latest versions** (Claude 4.5, Gemini 2.5, Grok 4)
- ✅ **100% working** models (was 47%)
- ✅ **Better organized** UI with categories
- ✅ **OpenRouter integration** for easy API access

### vs Competitors
- **GitHub Copilot**: 1 model vs our 25
- **Cursor**: Limited models vs our variety
- **Cline/Aider**: Fewer models, no UI organization

---

## ⭐ Contributors

- HybridMind Team

---

## 📄 License

MIT License - See LICENSE file for details

---

**Thank you for using HybridMind!** 🎉

If you find this extension useful, please:
- ⭐ Star us on GitHub
- 📝 Leave a review on VS Code Marketplace
- 🐦 Share with your developer friends
- 💬 Join our community for support and updates
