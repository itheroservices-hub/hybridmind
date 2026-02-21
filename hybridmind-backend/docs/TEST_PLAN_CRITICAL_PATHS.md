# HybridMind Critical Paths – Test Plan (Test Engineer)

**Context:** Multi-model orchestration, model chaining (Ralph vs non-Ralph), parallel runs, and agentic flows. Known issues: 403 on chain/parallel, modelFactory/modelProxy signature mismatch, chainOrchestrator using simulated calls, missing models validation.

**Scope:** `hybridmind-backend` critical paths; actionable unit + integration tests.

---

## 1. Critical Paths Requiring Test Coverage

| Path | Description | Risk |
|------|-------------|------|
| **POST /run/chain** | Multi-model chain (Ralph loop vs modelFactory.chain) | 403, wrong backend path, signature mismatch |
| **POST /run/parallel** | Parallel model comparison | 403, validation, modelFactory.parallel |
| **POST /run/chain/stream** | SSE stream for Ralph chain with telemetry | 403, stream lifecycle, kill endpoint |
| **POST /run/chain/kill/:streamId** | Abort active chain stream | 404, no-op if missing |
| **Tier validation** | `tierValidator.validateTier` + `validateWorkflowAccess` | 403 for free on chain/parallel; wrong model list |
| **Models validation** | Allowed models per tier vs `req.body.models` (IDs) | Free tier 403 when using friendly names |
| **modelFactory.chain** | Sequential calls; provider contract | Signature mismatch with modelProxy |
| **modelFactory.parallel** | Parallel calls; same provider | Same as chain |
| **modelFactory.call** | Single call via registry → provider | provider.call(request) vs modelProxy.call(id, prompt, opts) |
| **chainOrchestrator.executeChain** | Ralph path; role execution | Uses _simulateModelCall instead of real model |

---

## 2. Suggested Test Cases (5–10 Concrete)

### Integration (API) – Run routes

1. **POST /run/chain – happy path (non-Ralph, Pro)**  
   - Body: `{ models: ['llama-3.3-70b', 'deepseek-chat'], prompt: 'Hello', options: {} }`, `req.user.tier = 'pro'`.  
   - Expect: 200, `output` and `steps` in response (or mock modelFactory so no real API).

2. **POST /run/chain – 403 when free tier**  
   - Same body, `req.user.tier = 'free'`.  
   - Expect: 403 from `validateWorkflowAccess` (chain requires Pro).

3. **POST /run/parallel – happy path (Pro)**  
   - Body: `{ models: ['llama-3.3-70b', 'deepseek-chat'], prompt: 'Compare' }`, Pro tier.  
   - Expect: 200, comparison result shape.

4. **POST /run/parallel – 403 when free tier**  
   - Same body, free tier.  
   - Expect: 403 (workflow not allowed).

5. **POST /run/chain – 400 bad body**  
   - Body: `{ models: [], prompt: 'x' }` or `{ prompt: 'x' }` (no models).  
   - Expect: 400 from validateRequest('run') or tier/model validation.

6. **POST /run/chain – missing models validation**  
   - Body: `{ models: ['unknown-model-id'], prompt: 'Hi' }`, Pro tier.  
   - Expect: Either 403 (tier validator) or 4xx/5xx when modelFactory/modelRegistry resolves model (validates “missing models”).

7. **POST /run/chain/stream – SSE shape**  
   - With mocks: expect `event: connected`, then `event: telemetry` (if Ralph), then `event: done`; body has `streamId`, `chainId`, `killEndpoint`.

### Unit

8. **modelFactory.chain – provider call signature**  
   - Mock provider: `call(request)` with `request = { model, prompt, code, temperature, maxTokens }`.  
   - Assert provider called with single object (exposes mismatch if modelProxy expects `(modelId, prompt, options)`).

9. **tierValidator – free tier + chain models**  
   - `req.body.models = ['llama-3.3-70b']`, `req.user.tier = 'free'`.  
   - If tierValidator uses `allowedModels` list with OpenRouter IDs only, assert 403 or that friendly IDs are normalized before check.

10. **chainOrchestrator._executeRole – no real model call**  
    - Spy on _simulateModelCall; assert it is called (or assert that modelFactory/modelProxy is not called).  
    - Documents “simulated calls” until replaced with real integration.

---

## 3. Where Tests Already Exist vs Missing

| Area | Current | Missing |
|------|---------|--------|
| **Location** | `hybridmind-backend/tests/` (e.g. `agent.test.js`, `context.test.js`) | No `__tests__` next to modules; no dedicated run/chain/parallel tests |
| **Agent** | `agent.test.js`: /agent/plan, /agent/next, model selection, invalid requests (live server) | Run routes (/run/chain, /run/parallel, /run/chain/stream), tier/workflow 403 |
| **Context** | `context.test.js`: ContextChunker, RelevanceScorer, ContextRouter, etc. (unit-style with `expect`) | modelFactory, modelProxy, chainOrchestrator, tierValidator |
| **Framework** | Node assert + axios (agent); Jest-style `expect` (context) | No single framework in package.json; backend has no test script pointing at run tests |

**Conclusion:** Run routes, tier validation, modelFactory/modelProxy contract, and chainOrchestrator are **not** covered. Add focused tests under `hybridmind-backend/tests/` (or per-module `__tests__`) and align on one runner (e.g. Jest).

---

## 4. Framework and Placement

- **Framework:** **Jest** (already used in spirit in `context.test.js`; add `jest` as devDependency, config in `hybridmind-backend/jest.config.js` if needed). Use **supertest** for integration tests so `/run` routes can be hit without a live server.
- **Where to add tests:**
  - **Integration (run routes):** `hybridmind-backend/tests/runRoutes.test.js` (POST /run/chain, /run/parallel, /run/chain/stream, tier/workflow 403, bad body).
  - **Unit:**  
    - `hybridmind-backend/services/models/__tests__/modelFactory.test.js` (call/chain/parallel, provider signature).  
    - `hybridmind-backend/middleware/__tests__/tierValidator.test.js` (validateTier, validateWorkflowAccess, allowed models).  
    - `hybridmind-backend/services/orchestration/__tests__/chainOrchestrator.test.js` (executeChain flow, _simulateModelCall used).

---

## 5. Add First (Priority)

1. **runRoutes.test.js (integration)**  
   - Use **supertest** + app mount of run routes with **mocked** license (e.g. set `req.user = { tier: 'pro' }` or `tier: 'free'`) and mocked `modelFactory`/`chainOrchestrator` so no real OpenRouter calls.  
   - Cases: run/chain 200 (Pro), run/chain 403 (free), run/parallel 200 (Pro), run/parallel 403 (free), run/chain 400 (missing/invalid body).  
   - This immediately validates 403 and bad-body behavior.

2. **tierValidator unit tests**  
   - validateTier: free tier, > maxModelsPerRequest → 403; allowedModels vs body.models (friendly vs OpenRouter IDs).  
   - validateWorkflowAccess: free + workflow `chain` / `parallel` → 403.

3. **modelFactory unit tests**  
   - Mock modelRegistry.getProvider to return a spy; call modelFactory.chain({ models: ['a','b'], prompt, code }).  
   - Assert spy called with single `request` object (or document that current modelProxy signature is incompatible and add a test that fails until adapter is added).

4. **chainOrchestrator unit test**  
   - executeChain with minimal config; assert _simulateModelCall is invoked (or assert no real model call).  
   - When replacing simulation with real calls, add a test that the real provider is called.

5. **Optional next:** POST /run/chain/stream (SSE events) and POST /run/chain/kill/:streamId with mocked chainOrchestrator and ACTIVE_RALPH_STREAMS.

---

## 6. Summary

| Item | Action |
|------|--------|
| **Critical paths** | POST /run/chain, POST /run/parallel, POST /run/chain/stream, tier + workflow validation, modelFactory.chain/call, chainOrchestrator.executeChain |
| **Test cases** | 10 concrete cases above: 7 integration (API + tier), 3 unit (modelFactory signature, tierValidator, chainOrchestrator simulation) |
| **Existing** | `tests/agent.test.js`, `tests/context.test.js`; no run routes or tier/modelFactory/chainOrchestrator tests |
| **Add first** | (1) runRoutes.test.js with supertest + mocks for 403 and validation, (2) tierValidator unit tests, (3) modelFactory unit tests (provider signature), (4) chainOrchestrator unit test for simulation |

This plan is scoped to the issues you described (403 on chain/parallel, modelFactory/modelProxy mismatch, chainOrchestrator simulated calls, missing models validation) and keeps the “add first” list actionable with minimal new infrastructure (Jest + supertest in `hybridmind-backend`).
