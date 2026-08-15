# HybridMind

AI coding assistant with autonomous agents and smart multi-model orchestration.

## Install

Search "HybridMind" in VS Code marketplace and install.

## Features

- **Smart Multi-Model Orchestration** - 11 specialized AI models with intelligent selection
- **Chain Templates** - Pre-built workflows (Coding, Research, Review) for complex tasks
- **Autonomous Agents** - Multi-step task execution with planning and confirmation
- **Custom Chains** - Build sequential multi-model workflows for your needs
- **Model Capabilities** - Compare model strengths across 9 dimensions
- **Undo System** - Rollback agent changes with 10-step history

## Usage

Open HybridMind sidebar, select workflow mode (Chat/Agentic/Custom), and start coding.

**Commands:**
- `HybridMind: Open Chat Window`
- `HybridMind: Set API Key (BYOK)` - Add your own AI provider key
- `HybridMind: Select Chain Template` - Choose pre-built multi-model workflows
- `HybridMind: Configure Custom Chain` - Build your own model sequences
- `HybridMind: View Model Capabilities` - Compare AI model strengths
- `HybridMind: Run Autonomous Workflow`
- `HybridMind: Undo Last Change`

## Bring Your Own Key (BYOK)

HybridMind runs entirely on your machine — a small local server starts when VS Code opens and talks directly to your chosen AI provider's API. There is no HybridMind-run backend and no shared usage pool: every request is billed to your own provider account.

**Setup**

1. Run `HybridMind: Set API Key (BYOK)` from the Command Palette.
2. Pick a provider and paste in your API key.
3. Start chatting — requests route straight to that provider.

**Supported providers**

**OpenAI**, **Anthropic**, **Google (Gemini)**, **Groq**, **DeepSeek**, **Qwen**, and **OpenRouter** (which itself proxies 200+ additional models through a single key). The `HybridMind: Set API Key (BYOK)` picker only lists these seven — every entry is wired to a real per-provider dispatch path, so a saved key always works. (An earlier build's picker offered ~20 additional provider names that weren't actually implemented; that list was trimmed back to what's real.)

**Where your key is stored**

Your key is written to VS Code's built-in [SecretStorage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage) — the same OS-level encrypted store VS Code uses for its own credentials (Credential Manager on Windows, Keychain on macOS, Secret Service/libsecret on Linux). It is **not** written to your `settings.json` and never leaves your machine except in the direct HTTPS request to your provider's API.

If you're upgrading from an older version that stored the key as a plain VS Code setting, HybridMind migrates it to SecretStorage automatically the first time you open it and clears the old plaintext setting — you'll see a one-time notification when that happens.

## Related

- [Website](https://hybridmind.ca)
- [Documentation](https://github.com/itheroservices-hub/hybridmind)

## License

MIT
