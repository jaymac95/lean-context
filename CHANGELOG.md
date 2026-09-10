# Changelog

## 0.2.0

- Added optional chat-native setup with `lean-context init . --chat`.
- Added `lean-context chat .` to enable chat integrations after initial setup.
- Added project Agent Skills for Claude Code, Codex, and Google Antigravity.
- Added explicit-only Codex and Claude invocation policies to avoid unrelated skill loading.
- Added a vendored offline runner under `.ai-context/tool/` for deterministic chat execution.
- Added `smart` mode: check, refresh only when stale, then report stats.
- Excluded `.agents/` and `.claude/` from project-map discovery/fingerprints.
- Added chat integration tests and documentation.
