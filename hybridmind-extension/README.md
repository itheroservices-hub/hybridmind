# HybridMind: MCP Trust and AI Agent

See every MCP server your AI tools use, and know when one changes.

HybridMind lists every MCP server configured on your machine for VS Code, Cursor, Claude and others, and flags API keys left in their config files. Approve a server once, and HybridMind tells you if its tools change afterward. It also includes a coding agent that runs on your own API key. Nothing leaves your machine except your own requests to your own provider.

Powered by [MCP Steward](https://www.npmjs.com/package/mcpsteward).

## Install

Search "HybridMind" in the VS Code Marketplace and install.

## MCP Servers

Open the HybridMind icon in the activity bar. The **MCP Servers** view lists every server it finds in your MCP config files.

- **Finding servers starts nothing.** HybridMind only reads the config files. No server is started and nothing is sent anywhere.
- **Keys in config files.** A server whose API key is written directly into a config file is marked with a key icon, and you are told once. Anyone who can read that file can use the key, so it belongs in an environment variable or your client's secret store instead.
- **Approve.** Approving a server starts it once, reads the tools it advertises, and remembers them. Only approve a server you trust as it is today.
- **Check for changes.** Starts the server again and compares what it advertises now with what you approved. A tool whose description was rewritten after approval is the classic sign of a poisoned server, so changes are listed under the server with a risk level and the reasons for it. Risk levels are a heuristic, not a verdict.
- **Check all.** The checklist button in the view title checks every approved server in turn.
- **Same approvals as the command line.** Approvals are kept in `~/.mcpsteward/pins`, where the `mcpsteward` command line tool keeps them, so approving in one shows in the other.

A server whose configuration reads a value from your environment, such as `${env:TOKEN}`, cannot be approved or checked from the editor, because HybridMind does not pass your environment to servers it starts. Run `npx mcpsteward trust <name>` in a terminal for those.

## The coding agent

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

- `HybridMind: Scan MCP Servers` reads your MCP config files again
- `HybridMind: Check All Approved MCP Servers` checks every approved server for changes
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
