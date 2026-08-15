# HybridMind Cloud Pro — Monetization Plan

Written autonomously overnight per Tyler's request: "make hybridmind monetizable somehow, without using our own API key, research ideas and create the plan and execute it." This document is the plan; the rest of this branch (`hybridmind-cloud-pro`) is the execution.

## Constraint recap

- No IThero-paid LLM API usage. HybridMind stays strictly BYOK: every AI request goes to the user's own provider key, billed to their own account. Whatever gets sold cannot involve IThero fronting inference cost.
- Needs to be something people would actually pay a few dollars a month for.
- Stripe is already connected and available.

## What the research actually says (not guessed, checked)

Searched the current state of BYOK VS Code AI extensions (Cline, Roo Code, Continue.dev) before designing anything:

- **Continue.dev** — VC-funded, had cloud features, got acquired by Cursor and shut down in 2026 (recurring billing disabled, repo archived). A cautionary tale, not a template.
- **Cline** — 5M+ installs, purely BYOK, zero subscription. Proves a BYOK tool can have a huge user base without ever charging anyone — but also shows that "just add a paywall to a free BYOK tool" isn't a proven path on its own.
- **Roo Code** — the one clear precedent that actually worked commercially: **Cloud Pro at $20/month**, plus **cloud agent execution credits at $5/hour**. Critically, what they charged for was infrastructure *they hosted* — running agents in their own cloud, not gating local features behind a license flag.

**The lesson:** in this specific market, people don't pay extra to unlock a bigger number on a feature they can already use for free locally. They pay for something the vendor actually operates and that has ongoing real value — hosted compute, hosted storage, hosted collaboration. That's the only proven monetization shape in the BYOK AI-coding-extension space as of today.

This directly ruled out the *existing* gated features already scaffolded in `licenseManager.ts` (bigger context limits, more agent slots, more model-chain length) as the primary sales pitch — those are exactly the "local feature flag" pattern the market has shown people won't pay for on their own. They stay as-is (already built, harmless to keep as secondary Pro perks), but they are not the reason to buy.

## What HybridMind Cloud Pro actually sells

**A hosted account layer HybridMind doesn't have today, with real ongoing infrastructure behind it:**

1. **Cross-device sync** — chat history, custom chain/workflow templates, and agent configuration follow you across machines. Today all of this is 100% local; reinstalling or switching machines loses everything. This is a real gap, and syncing it requires IThero to actually host something (Supabase), which is exactly the kind of genuine value the market has shown it will pay for.
2. **Team workspaces (v2, schema included, not fully built this pass)** — a small team shares a chain-template library and standardized configuration from one place, rather than each developer hand-configuring their own copy. This is the natural per-seat upsell once the individual tier is proven.

**What is explicitly NOT synced:** BYOK provider API keys. Those stay local, in VS Code's SecretStorage, on the user's own machine, exactly as the security-hardening work earlier in this session established. Relaying a user's live provider key through IThero's own servers would reintroduce the exact kind of centralized-secret risk that BYOK was built to avoid, and it isn't necessary for any of the value being sold here. This is a hard line, not a v2 nice-to-have.

## Pricing

Individual: **$7.99 CAD/month**. Chosen inside Tyler's own "a few bucks" guidance, priced below Roo Code's $20/mo since HybridMind Cloud Pro is a narrower, sync-focused offering rather than hosted compute. Team tier: not priced yet, deliberately — schema supports it (see below), but per-seat pricing is a real decision that should wait until the individual tier has actual signal.

**This price is a starting proposal, not a locked decision.** The Stripe Product/Price object itself was not created — see "What's blocked" below.

## Architecture

- **Supabase project** (new, not yet provisioned — see below): `profiles` table extending `auth.users` per IThero's existing auth pattern, plus `subscription_status`, `synced_chain_templates`, `synced_agent_configs`, and a lightweight `synced_chat_sessions` table. Row-Level Security on every table, scoped to `auth.uid()`.
- **Two Supabase Edge Functions**:
  - `stripe-webhook` — verifies Stripe's signature, listens for `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`, writes `subscription_status` on the matching profile. This is the only place subscription state is ever written from, per IThero's standing Stripe pattern (never trust the client-side checkout redirect).
  - `check-subscription` — the extension calls this with the user's Supabase JWT; returns whether Pro is active. Replaces the currently broken `licenseManager.ts` call to `http://localhost:3000/license/verify`, which points at nothing (the old backend is archived) and has silently made Pro/Enterprise activation impossible since the BYOK relaunch.
- **Extension-side** (`src/cloud/`): a Supabase JS client, magic-link sign-in (matching IThero's stated preference for the blue-collar/tech-skeptical audience — no OAuth app to trust, just an email link), and sync logic for chain templates + agent configs. Chat history sync included in the schema, wired minimally.

## What's blocked, and why (both are real gates, not oversights)

1. **Stripe product/price creation** — the platform's own auto-mode classifier blocked the live-mode write, and the test-mode connector failed on every call type tried (account info, implementation planner, and a plain read) — a genuine connector issue with this Stripe account, not something worth retrying blindly. **Action needed from Tyler:** either create the Product ($7.99 CAD/month recurring, or whatever price you actually want) directly in the Stripe Dashboard and hand me the Price ID, or ask me to retry via the connector once you're back — both work equally well.
2. **Supabase project provisioning** — a new project on IThero's org costs **$10/month recurring**, confirmed via the Supabase MCP's own cost tool. That's a real ongoing charge, and the same "money decisions stay with Tyler" rule that governs Stripe pricing applies here too, so I didn't create it unilaterally while you were asleep. **Action needed from Tyler:** say go and I'll provision it (takes about 2 minutes), or provision it yourself and hand me the project ref.

Everything else — schema, Edge Function code, extension-side integration — is written and ready to deploy the moment those two green-lights land. See `hybridmind-extension/supabase/` for the schema and functions, and `hybridmind-extension/src/cloud/` for the client integration.

## What's genuinely new vs. what already existed

- New: the entire Cloud Pro concept, the Supabase schema, both Edge Functions, the `src/cloud/` client module, the sign-in/sync commands, the corrected `licenseManager.ts` subscription-check call.
- Already existed, untouched: the local feature-tier gates (`getModelLimit()`, `getContextLimit()`, chain-length limits) — kept as secondary Pro perks, not the sales pitch.
