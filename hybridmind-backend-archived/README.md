# Archived: not used by the shipped extension

This directory is **not** part of the HybridMind product. The shipped VS Code
extension (`hybridmind-extension/`) is fully self-contained: it runs its own
local server (`hybridmind-extension/src/embeddedServer.ts`) and calls model
provider APIs directly from the user's machine using a key the user supplies.
It has no code path to anything in this directory, no hosted deployment of
this service exists, and it should not be revived as a live backend, doing so
would reintroduce a shared-cost dependency that the BYOK (bring-your-own-key)
model is specifically designed to avoid.

It is kept only as a reference source for two genuinely well-built pieces of
validation logic that were ported into the extension client-side instead:

- `config/terminalAllowlist.js` — the command tokenizer/allowlist logic,
  ported to `hybridmind-extension/src/security/commandValidator.ts`.
- `middleware/mcpSecurityMiddleware.js` — the approval-ticket pattern for
  dangerous actions, the underlying idea was reused for the extension's local
  approval prompt, not the Express middleware itself.

Do not deploy this service. Do not point any part of the extension at it.
