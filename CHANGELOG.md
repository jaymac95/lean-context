# Changelog

## 0.3.0

- Added `lean-context report` to generate saved Markdown token usage reports.
- Reports separate rough local context estimates from optional provider-reported input, cached-input, and output token counts.
- Chat skills can now invoke the report command directly.

## 0.2.0

- Added optional chat-native setup with `lean-context init . --chat`.
- Added `lean-context chat .` to enable chat integrations after initial setup.
- Added project Agent Skills for Claude Code, Codex, and Google Antigravity.
- Added explicit-only Codex and Claude invocation policies to avoid unrelated skill loading.
- Added a vendored offline runner under `.ai-context/tool/` for deterministic chat execution.
- Added `smart` mode: check, refresh only when stale, then report stats.
- Excluded `.agents/` and `.claude/` from project-map discovery/fingerprints.
- Added chat integration tests and documentation.
