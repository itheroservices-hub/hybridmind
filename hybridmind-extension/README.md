# HybridMind

AI coding assistant with autonomous agents and 200+ models via OpenRouter.

## Install

1. Search "HybridMind" in VS Code marketplace
2. Get API key from [openrouter.ai/keys](https://openrouter.ai/keys)
3. Set key in Settings: `hybridmind.apiKey`

## Features

- Autonomous multi-step task execution
- Natural language planning and confirmation
- 200+ models (GPT-4, Claude, Gemini, DeepSeek, etc.)
- Intelligent model routing
- Undo system for agent changes

## Usage

Open sidebar, select workflow mode (Chat/Agentic/Custom), and start coding.

**Commands:**
- `HybridMind: Open Chat Window`
- `HybridMind: Run Autonomous Workflow`
- `HybridMind: Undo Last Change`

## Config

```json
{
  "hybridmind.apiKey": "your-openrouter-key",
  "hybridmind.defaultModel": "anthropic/claude-3.5-sonnet"
}
```

## Related

- [Documentation](https://github.com/itheroservices-hub/hybridmind)
- [OpenRouter Models](https://openrouter.ai/models)

## License

MIT
