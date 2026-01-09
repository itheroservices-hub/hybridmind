# HybridMind AI Assistant v1.1

**Multi-model AI orchestration platform with 21 models from 8 providers.** Run workflows, compare models, and leverage the best AI for each task - all from within VS Code.

## ✨ What's New in v1.1

🎨 **Chat Window** - Persistent chat interface available to all users  
🤖 **Multi-Step Autonomous Workflows** - AI agents that break down complex tasks (Pro)  
⚡ **Ultra-Fast Inference** - Priority routing to fastest models (Pro)  
📊 **Tier System** - Free tier with 2 basic models, Pro tier with 4 models including premium  
🔒 **128k Context Window** - Massive context for Pro users (vs 8k for free)  
🎯 **Smart Model Limits** - Automatic enforcement with upgrade prompts

## ✨ Core Features

- **21 AI Models** from 8 leading providers (Groq, Google, DeepSeek, Qwen, OpenAI, Anthropic, xAI, Mistral)
- **Persistent Chat Window** - Multi-turn conversations with AI models
- **Embedded Server** - No manual setup required, just install and add your API keys
- **Zero Configuration** - Server starts automatically when VS Code opens
- **Cost-Efficient** - Uses your own API keys with flexible tier options
- **Privacy-First** - All requests go directly from your machine to AI providers
- **Multi-Model Chains** - Combine up to 4 models in workflows (Pro)
- **Code Assistant** - Explain, review, optimize, fix bugs, generate tests

## 🚀 Quick Start

### 1. Install Extension

Install from VS Code Marketplace or:
```bash
code --install-extension hybridmind-1.1.0.vsix
```

### 2. Choose Your Tier

**Free Tier (v1.0)**
- ✅ Chat window with 2 basic models
- ✅ Basic models: Groq Llama, DeepSeek, Gemini Flash, Qwen
- ✅ Single-step workflows
- ✅ 8k context window
- ✅ Standard inference speed
- ✅ Community support

**Premium Tier (v1.1) - $19/month**
- ⭐ Chat window with up to 4 models (including premium)
- ⭐ All models: GPT-4, Claude 3.5 Sonnet, Gemini Pro, and all basic models
- ⭐ 4. Start Using

- **Open Chat Window**: `Ctrl+Shift+P` → "HybridMind: Open Chat Window" (All tiers)
- **Quick Chat**: `Ctrl+Shift+P` → "HybridMind: Quick Chat"
- **Explain Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Explain Code"
- **Review Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Review Code"
- **Optimize Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Optimize Code"
- **Generate Tests**: Select function → `Ctrl+Shift+P` → "HybridMind: Generate Tests"
- **Fix Bugs**: Select code → `Ctrl+Shift+P` → "HybridMind: Fix Bugs"
- **Manage License**: `Ctrl+Shift+P` → "HybridMind: Manage License

Press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings, then search for "HybridMind" and add your API keys:

- **Groq** (Llama, Mixtral): Get from [console.groq.com/keys](https://console.groq.com/keys)
- **Gemini** (Gemini 2.0): Get from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **DeepSeek** (Chat, Coder): Get from [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
- **Qwen** (Max, Plus): Get from [dashscope.console.aliyun.com/apiKey](https://dashscope.console.aliyun.com/apiKey)
- **OpenAI** (GPT-4, GPT-3.5): Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic** (Claude 3): Get from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

> **Note:** You only need to configure the providers you want to use. At least one API key is required.

### 3. Start Using

- **Quick Chat**: `Ctrl+Shift+P` → "HybridMind: Quick Chat"
- **Explain Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Explain Code"
- **Review Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Review Code"
- **Optimize Code**: Select code → `Ctrl+Shift+P` → "HybridMind: Optimize Code"
- **Generate Tests**: Select function → `Ctrl+Shift+P` → "HybridMind: Generate Tests"
- **Fix Bugs**: Select code → `Ctrl+Shift+P` → "HybridMind: Fix Bugs"

## 📊 Available ModelsTier | Strengths |
|----------|--------|------|-----------|
| **Groq** | Llama 3.3 70B, Mixtral 8x7B | Free + Pro | Fast inference, general purpose |
| **Google** | Gemini 2.0 Flash | Free + Pro | Multimodal, fast |
| **Google** | Gemini 1.5 Pro | Pro Only | Advanced multimodal, 2M context |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder | Free + Pro | Code generation, reasoning |
| **Qwen** | Qwen Max, Qwen Plus | Free + Pro | Multilingual, Chinese language |
| **OpenAI** | GPT-4 Turbo, GPT-4 | Pro Only | General purpose, wide knowledge |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | Pro Only | Long context, safety |
| **xAI** | Grok | Pro Only | Real-time data, creative |

## 🆚 Free vs 1 uses an **embedded lightweight server** that:
1. **Starts automatically** when VS Code opens (no manual setup!)
2. **Runs only when VS Code is open** (no 24/7 background processes)
3. **Routes AI requests** directly to provider APIs using your keys
4. **Enforces tier limits** automatically with upgrade prompts
5 **Model Access** | Basic Models | All (Groq, DeepSeek, GPT-4, Claude, etc.) |
| **Inference Speed** | Standard | Ultra-Fast |
| **Agent Workflows** | Single-step | Multi-step Autonomous |
| **Context Window** | 8k Tokens | 128k Tokens |
| **Chat Window** | ✅ 2 basic models | ✅ 4 models (including premium) |
| **Support** | Community | Priority 24/7
| **OpenAI** | GPT-4 Turbo, GPT-3.5 Turbo | General purpose, wide knowledge |
| **Anthropic** | Claude 3 Opus, Claude 3 Sonnet | Long context, safety |

## 🛠️ How It Works

HybridMind v1.0.0 uses an **embedded lightweight server** that:
1.Free Tier (v1.0):**
- Extension: FREE
- Usage: Pay-as-you-go with your own API keys (2 basic models max)
- Perfect for: Individual developers, learning, experimentation

**Premium Tier (v1.1) - $19/month:**
- Extension: $19/month
- Usage: Pay-as-you-go with your own API keys (4 models including premium)
- Includes: GPT-4, Claude 3.5, Gemini Pro, multi-step workflows, 128k context
- Perfect for: Professional developers, teams, production use

Most providers offer generous free tiers:
- **Groq**: Free tier available
- **Gemini**: 1 million tokens/month free
- **DeepSeek**: Very low cost ($0.14/1M tokens)
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
- Check that at least one API key is configured in Settings
- Verify API keys are valid and not expired

### Extension not activating
- Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
- Check VS Code version is 1.85.0 or higher

### API errors
- Verify you have credits/quota available with your AI provider
- Check internet connection
- Ensure API keys are entered correctly (no extra spaces)

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

Contributions welcome! Visit [github.com/itheroservices-hub/hybridmind](https://github.com/itheroservices-hub/hybridmind)

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/itheroservices-hub/hybridmind/issues)
- **Discussions**: [GitHub Discussions](https://github.com/itheroservices-hub/hybridmind/discussions)

---

**Built with ❤️ for developers who want the freedom to choose the best AI for every task.**

