# HybridMind

A coding assistant for VS Code that runs on your own AI provider key.

## Install

Search "HybridMind" in the VS Code Marketplace and install.

## What it does

- **Chat in the sidebar.** Ask about your code and read the answer as it is written.
- **Your key, your models.** The model list is read from your provider, so it shows exactly what your key can use.
- **Several models at once.** Parallel mode sends one message to up to four models. Chain mode hands each answer on to the next model.
- **Agentic mode.** The assistant plans a task and shows you the plan to confirm before it starts. You choose how often it asks while it works: before every action, before destructive ones, or only for risky commands.
- **Guardrails.** Terminal commands are checked against an allowlist at every setting, and file changes stay inside your workspace.

## Getting started

1. Open the HybridMind icon in the activity bar.
2. On the Keys tab, pick your provider, paste your key and save.
3. Pick a model on the Models tab and start chatting.

**Commands**

- `HybridMind: Open Chat` opens the sidebar (Ctrl+Shift+H)
- `HybridMind: Set API Key (BYOK)` saves a provider key
- `HybridMind: Quick Chat` asks one question and shows the answer beside your editor
- `HybridMind: Show Agent Output` opens the agent log

## Bring your own key

HybridMind runs entirely on your machine. A small local server starts with the extension and talks directly to your provider's API. There is no HybridMind backend and no shared usage pool. Every request is billed to your own provider account.

That local server answers only the extension that started it. Web pages and other programs on your machine cannot use it.

**Supported providers**

OpenAI, Anthropic, Google (Gemini), Groq, DeepSeek, Qwen and OpenRouter.

Answers from OpenAI, Anthropic, Groq, DeepSeek and OpenRouter stream in as they are written. Answers from Google and Qwen arrive in one piece.

**Where your key is stored**

Your key is written to VS Code's built in [SecretStorage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage), the same encrypted store VS Code uses for its own credentials: Credential Manager on Windows, Keychain on macOS, and Secret Service on Linux. It is not written to your `settings.json`, and it leaves your machine only in the direct HTTPS request to your provider.

If you are upgrading from an older version that kept the key as a plain VS Code setting, HybridMind moves it to SecretStorage the first time it starts and clears the old setting. You will see a one time notice when that happens.

## Related

- [Website](https://hybridmind.ca)
- [Source](https://github.com/itheroservices-hub/hybridmind)

## License

MIT
