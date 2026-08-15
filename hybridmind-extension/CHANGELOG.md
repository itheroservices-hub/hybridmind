# Changelog

## [2.0.0] - 2026-08-15 (BYOK relaunch)

### Changed
- Relaunched under a strict bring-your-own-key model: every request routes directly to your own OpenAI, Anthropic, OpenRouter, Google, Groq, DeepSeek, or Qwen key via `HybridMind: Set API Key (BYOK)`. No HybridMind-run backend, no shared usage pool.
- Keys now stored in VS Code's encrypted SecretStorage, not plaintext settings. Existing plaintext keys migrate automatically on first activation.
- Closed a real security gap in the autonomous agent's command/file execution path: every terminal command and file edit now passes through allowlist and workspace-containment validation before running, regardless of autonomy level.

### Removed
- The standalone backend service (`hybridmind-backend/`) is retired and archived, not deployed. Nothing in the shipped extension depends on it.
- Pro/Enterprise license activation is currently non-functional — there is no live verification server behind it yet. BYOK works fully without a license key; do not purchase a license expecting it to unlock anything until this is announced as working.

### Note on prior root-level release notes
`CHANGELOG_v2.0.0.md` (repo root) describes an earlier, more ambitious v2.0 vision — sandboxed execution, 14 specialist agents, a task-decomposition service — that described the now-archived backend, not the shipped extension. Treat this file (`hybridmind-extension/CHANGELOG.md`) as the accurate record of what's actually in the VS Code extension.

## [1.8.0] - 2026-02-18

### Added
- Live Ralph telemetry streaming UI in sidebar with animated thought rows for long self-healing loops
- SSE-powered chain execution stream support for real-time backend-to-UI telemetry delivery
- Kill-switch UX for active Ralph loops from the sidebar telemetry panel
- MCP approval status command and chat insight rendering for approval ticket visibility
- Backend kill-flow integration to deny pending approval tickets and prevent ghost commands

### Changed
- Upgraded chain orchestration path to support abort-aware self-healing execution
- Improved trust and observability UX during autonomous loop execution
- Added Phase I multi-project core blueprint documentation for reusable platform architecture

## [1.7.0] - 2026-02-08

### Added
- Smart Multi-Model Orchestration with 11 specialized AI models (o1, Qwen, Claude, GPT, Gemini, DeepSeek, Llama)
- Chain Templates for multi-model workflows (Coding Standard/Premium/Budget, Research Deep, Review Comprehensive, Quick Fix)
- Intelligent model selection based on task requirements, budget, and user tier
- Model Capabilities Viewer to compare model strengths across 9 dimensions
- Custom Chain Builder for creating sequential multi-model workflows
- Server-side cost governance with automatic budget optimization
- Modern UI/UX with #0b6a76 brand color and WCAG AA accessibility
- 6 modular UI component systems (model selector, chain templates, loading states)

### Changed
- Updated model selection to use capability-based scoring algorithm
- Enhanced design system with 150+ utility classes
- Improved chat sidebar with new component library

### Removed
- Budget priority controls (not applicable to centralized API architecture)

## [1.6.2] - 2026-01-21

### Changed
- Removed BYOK (bring your own key) instructions (not yet implemented)
- Added hybridmind.ca website link

## [1.6.1] - 2026-01-21

### Changed
- Simplified README to 30 lines (93% reduction) for better developer experience
- Removed all emojis and marketing fluff
- Clean, minimal overview like successful extensions

## [1.6.0] - 2026-01-21

### Added
- AI-powered intent detection for natural language confirmations
- Constraint parsing from user messages ("ok but read-only", "don't change anything")
- Security risk assessment for operations
- Task complexity evaluation with automatic confirmation
- Ambiguity detection with clarification requests
- AI error analysis with actionable suggestions

### Fixed
- Infinite planning loop when confirming tasks
- File creation using wrong tool (apply_edit vs create_file)
- Incorrect directory path resolution for new files
- Backend response parsing for AI detectors
- Embedded server port conflicts with standalone backend

### Improved
- Natural language understanding ("sure thing", "do your thing", "sounds good")
- Autonomous execution flow with proper plan storage
- Debug logging for troubleshooting
- Code generation prompts with workspace context
- README clarity and conciseness (removed emojis)

## [1.5.1] - 2026-01-20

### Fixed
- Backend server stability improvements
- Model selection bug fixes

## [1.5.0] - 2026-01-15

### Added
- Autonomous agent system with multi-step planning
- Undo functionality for autonomous changes (10-step history)
- Real-time progress tracking for workflows
- OpenRouter integration for 40+ models
- Transparent pricing display

### Improved
- Chat interface performance
- Model selection UX

## [1.0.0] - 2025-12-01

### Added
- Initial release
- Multi-model support
- Chat interface
- Code assistance commands
