# Changelog

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
