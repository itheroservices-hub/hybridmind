# HybridMind AI Assistant

**Multi-model AI orchestration platform with 21 models from 8 providers.** Run workflows, compare models, and leverage the best AI for each task - all from within VS Code.

## ✨ Features

- **21 AI Models** from 8 leading providers (Groq, Google, DeepSeek, Qwen, OpenAI, Anthropic, xAI, Mistral)
- **Embedded Server** - No manual setup required, just install and add your API keys
- **Zero Configuration** - Server starts automatically when VS Code opens
- **Cost-Efficient** - Uses your own API keys, no subscription fees
- **Privacy-First** - All requests go directly from your machine to AI providers
- **Multi-Provider** - Switch between models seamlessly
- **Code Assistant** - Explain, review, optimize, fix bugs, generate tests

## 🚀 Quick Start

### 1. Install Extension

Install from VS Code Marketplace or:
```bash
code --install-extension hybridmind-1.0.0.vsix
```

### 2. Configure API Keys

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

## 📊 Available Models

| Provider | Models | Strengths |
|----------|--------|-----------|
| **Groq** | Llama 3.3 70B, Mixtral 8x7B | Fast inference, general purpose |
| **Google** | Gemini 2.0 Flash, Gemini 1.5 Pro | Multimodal, latest tech |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder | Code generation, reasoning |
| **Qwen** | Qwen Max, Qwen Plus | Multilingual, Chinese language |
| **OpenAI** | GPT-4 Turbo, GPT-3.5 Turbo | General purpose, wide knowledge |
| **Anthropic** | Claude 3 Opus, Claude 3 Sonnet | Long context, safety |

## 🛠️ How It Works

HybridMind v1.0.0 uses an **embedded lightweight server** that:
1. **Starts automatically** when VS Code opens (no manual setup!)
2. **Runs only when VS Code is open** (no 24/7 background processes)
3. **Routes AI requests** directly to provider APIs using your keys
4. **Stops automatically** when you close VS Code

**No separate terminal, no manual npm start, no localhost:3000 to manage.** Everything just works.

## 🔒 Privacy & Security

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

