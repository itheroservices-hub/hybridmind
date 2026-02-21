# Agent Manager Brief — HybridMind “Not Working” Diagnosis

**Date:** 2025-02-21  
**Request:** Full team on HybridMind (Cursor-like: multi-model, chaining, sequential, agentic) to find and fix what’s keeping it from working.  
**Team:** Explore → Architect → Code Reviewer, Test Engineer, Security (parallel).

---

## 1. Executive Summary

The team identified **why HybridMind feels broken** and **what to fix first**.

- **Chain and parallel** often return **403** because the backend never sees `workflow`/`mode` (extension doesn’t send it).
- **Ralph/stream chain** never calls real models — `chainOrchestrator` uses **simulated** model responses only.
- **Non-Ralph chain** (and legacy multi-model) is broken because **modelFactory** calls **modelProxy** with the wrong signature (one object instead of `modelId`, `prompt`, `options`), so the wrong model and no prompt are sent.
- **Free tier** can block all models due to **model ID mismatch** (OpenRouter IDs in tier config vs friendly IDs in the app).
- **Guardrails/autonomy** use port **5000** while run/chain use **3000** — if only 3000 is running, guardrails never connect.
- **Security:** Tool API unprotected; missing `userId` can grant proplus tier (tier bypass).

Fixing **workflow 403**, **modelFactory ↔ modelProxy** contract, and **real model calls in chainOrchestrator** will restore the core “multi-model and chaining” experience. Then tier/validation/ports and security can be addressed.

---

## 2. Where the Details Live

| Document | Owner | Contents |
|----------|--------|----------|
| **ARCHITECTURE_RISK_MEMO.md** | Architect | Design summary, R1–R10 risks, recommended fix order |
| **CODE_REVIEW_CHECKLIST.md** | Code Reviewer | Confirmed bugs, file/line refs, minimal code fixes |
| **hybridmind-backend/docs/TEST_PLAN_CRITICAL_PATHS.md** | Test Engineer | Critical paths, test cases, “add first” tests |
| **SECURITY_MEMO.md** | Security | High/medium risks, OWASP mapping, recommendations |

---

## 3. Prioritized Action List (Single Checklist)

### P0 — Unblock chain/parallel and real model execution

1. **Fix 403 for chain/parallel (workflow mode)**  
   - **Where:** `runRoutes.js` + `tierValidator.js`  
   - **What:** Set `req.workflowMode` from route path before tier validation; in tierValidator use `req.workflowMode || req.body.workflow || req.body.mode || 'single'`.  
   - **Ref:** Code Reviewer #1, Explore “Quick win 1”.

2. **Fix modelFactory ↔ modelProxy call contract**  
   - **Where:** `hybridmind-backend/services/models/modelFactory.js`  
   - **What:** Call provider as `provider.call(request.model, request.prompt, { temperature, maxTokens, code })` (or equivalent) instead of `provider.call(request)`.  
   - **Ref:** Architect R2, Code Reviewer #2.

3. **Replace simulated model call in chain orchestrator**  
   - **Where:** `hybridmind-backend/services/orchestration/chainOrchestrator.js`  
   - **What:** In `_executeRole`, call real `modelProxy.call(modelId, fullPrompt, options)` instead of `_simulateModelCall`; use result content.  
   - **Ref:** Architect R1, Code Reviewer #3.

### P1 — Validation and tier

4. **Require `models` for /run/chain and /run/chain/stream**  
   - **Where:** `validateRequest.js` or runRoutes + runController  
   - **What:** Validate `body.models` non-empty array; return 400 with clear message when missing.  
   - **Ref:** Architect R3, Code Reviewer #6.

5. **Align tier validator with app model IDs**  
   - **Where:** `tierValidator.js` (allowedModels) vs app friendly IDs  
   - **What:** Normalize or map friendly IDs so free-tier allowlist matches what the app sends.  
   - **Ref:** Architect R4.

### P2 — Robustness and UX

6. **Use single backend port in extension**  
   - **Where:** `chatSidebarProvider.ts` (all hardcoded `3000`)  
   - **What:** Use `this._serverPort` or a single `getBackendBaseUrl()` everywhere.  
   - **Ref:** Code Reviewer #4.

7. **Single SIGINT handler in server.js**  
   - **Where:** `server.js`  
   - **What:** One `process.on('SIGINT')` that runs collaboration cleanup then `server.close()`.  
   - **Ref:** Architect R9, Code Reviewer #5.

8. **Guardrails/autonomy port**  
   - **Where:** `autonomyManager.ts` (port 5000)  
   - **What:** Use same base URL/port as rest of extension (e.g. 3000) or document and run guardrail server on 5000.  
   - **Ref:** Architect R6.

### P3 — Security (from Security agent)

9. **Protect tool API**  
   - **Where:** `server.js` (routes for `/api/tools/*`)  
   - **What:** Apply `validateLicense` (and tier if needed) to tool execute/chain/parallel so unauthenticated callers cannot run tools.  
   - **Ref:** SECURITY_MEMO.

10. **Tier when userId missing**  
    - **Where:** `modelProxy.js` (getUserTier)  
    - **What:** Do not default to `'proplus'` when `userId` is missing; use a safe default (e.g. `'free'`) or require userId for premium.  
    - **Ref:** SECURITY_MEMO.

### P4 — Tests and docs

11. **Add tests (Test Engineer plan)**  
    - **Where:** `hybridmind-backend/tests/runRoutes.test.js`, unit tests for modelFactory, tierValidator, chainOrchestrator  
    - **What:** Follow `hybridmind-backend/docs/TEST_PLAN_CRITICAL_PATHS.md` — run routes 200/403/400, provider call shape, workflow validation.  
    - **Ref:** TEST_PLAN_CRITICAL_PATHS.md.

12. **Chat Panel “Chain”**  
    - **Where:** `chatPanel.ts`  
    - **What:** Wire Chain button to sidebar chain flow or `/run/chain` with prompt, or replace with “Use sidebar and choose Chain workflow.”  
    - **Ref:** Explore “Chat Panel chain”.

---

## 4. Team Assignments (Suggested Next Steps)

- **You / Main agent:** Implement P0 (items 1–3) so chain and parallel work with real models.
- **Code Reviewer:** Re-review after P0 changes; verify no regressions.
- **Test Engineer:** Add run routes and modelFactory/tierValidator tests per TEST_PLAN_CRITICAL_PATHS.md.
- **Security:** Implement P3 (tool API protection, tier default when userId missing); re-scan after changes.
- **Architect:** After P0–P1, decide agentic UX (R7): how tools integrate with run/chain and document or implement.
- **DevOps:** (Optional) Add a simple “smoke” step to CI that starts server and hits `/run/single` and `/run/chain` with mocked provider.
- **Documentation:** (Optional) Update README or extension docs with “Config checklist” (OpenRouter key, PORT, tier, backend port in extension).

---

## 5. One-Paragraph “Why It Wasn’t Working”

The backend was treating every run request as **single** (no `workflow`/`mode` from the extension), so **chain and parallel** hit tier checks for “single with 2+ models” and returned **403**. Even when that’s fixed, **non-Ralph chain** was calling the model provider with one object instead of `(modelId, prompt, options)`, so the wrong model and no prompt were used; and the **Ralph/stream chain** path never called a real model at all — it used a simulator. On top of that, **free tier** compared OpenRouter model IDs to the app’s friendly IDs and often blocked everything. Fixing workflow detection, the provider call shape, and replacing the simulator with real model calls restores the intended behavior; the rest is validation, tier alignment, ports, security, and tests.

---

*Agent Manager — Full team synthesis. Use this brief plus the linked memos for implementation and follow-up.*
