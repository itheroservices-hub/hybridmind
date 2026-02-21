# Titan Phase I — Multi-Project Core Blueprint

## Objective
Transform HybridMind into a reusable platform core so future products can be launched with minimal rework.

## Target Outcome
- One shared core SDK for orchestration, telemetry, approvals, licensing, and model routing.
- Thin product adapters per project (VS Code extension, web app, API-only agent, etc.).
- Stable contracts that isolate product UX from backend internals.

## Core Boundaries
1. Core Runtime (`packages/core-runtime`)
- Chain orchestration
- Self-healing loop (Ralph)
- Role registry + planner interfaces
- Abort/kill lifecycle

2. Model Gateway (`packages/model-gateway`)
- Provider adapters
- Retry/error taxonomy
- Cost/margin routing policy

3. Security & Guardrails (`packages/guardrails`)
- Approval tickets
- Risk classification
- Policy enforcement

4. Telemetry Bus (`packages/telemetry`)
- Event schema + emitters
- SSE/WebSocket stream adapters
- Audit correlation IDs

5. Project Adapters (`packages/adapters/*`)
- `adapter-vscode`
- `adapter-web`
- `adapter-cli`
- Future per-product wrappers

## Shared Contracts
- `ChainStartRequest`
- `ChainProgressEvent`
- `SelfHealingTelemetryEvent`
- `ApprovalTicketState`
- `KillSwitchCommand`

All contracts versioned under `schemaVersion` and published from a single source package.

## Data Model
- `projectId`: logical product/workspace boundary
- `executionId`: one workflow run
- `streamId`: live telemetry channel
- `ticketId`: approval object
- `correlationId`: trace across services

## Packaging Strategy
- Monorepo package split with internal npm workspaces.
- Strictly no product-specific UI code in shared runtime packages.
- Semver for core packages; adapters pin major version.

## Migration Plan (Incremental)
1. Extract contracts + event schema from current backend/extension.
2. Wrap current `chainOrchestrator` and `selfHealingLoop` behind runtime interface.
3. Move approval store + security middleware into guardrails package.
4. Convert extension to consume adapter API, not backend internals.
5. Add second reference product to validate reusability.

## Non-Goals (Phase I)
- Full microservice split.
- New billing system rewrite.
- Replacing all existing endpoints at once.

## Acceptance Criteria
- A second project can integrate with shared runtime in < 1 day.
- Kill switch + telemetry contracts are identical across adapters.
- Approval ticket lifecycle is reusable without VS Code assumptions.
- Existing HybridMind UX remains backward compatible.
