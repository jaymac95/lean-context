# Changelog

## 0.4.1

- `importantFiles()` now recognizes shared-logic directories (`lib/`, `utils/`, `helpers/`, `services/`, `hooks/`) as high-signal, not just entry points and config files. Benchmarked against Stndrd HQ Dashboard, this alone was the difference between the agent grepping for a shared helper (`fmtDateFull`) and finding it already listed with its symbol in the project map — raised measured total-token savings on that task from ~8% to ~25%.
- Raised `MAX_IMPORTANT_FILES` (35 → 40) and `MAX_SYMBOL_FILES` (16 → 24) so the extra shared-logic candidates don't crowd out existing high-signal files.

## 0.4.0

- Added a **key symbols** section to the generated project map: top-level exports/definitions for high-signal source files, so agents can grep a known name instead of reading a whole file.
- Added detection and exclusion of **oversized data-like files** (`.json`, `.csv`, `.log`, `.sql`, `.xml`, `.yaml`, `.ipynb`, etc. over 64KB) from indexing, with the largest ones listed in the map as a "do not cat, read a narrow range" warning.
- Expanded default ignore list with more build/cache/vendor directories (`.parcel-cache`, `.expo`, `Pods`, `DerivedData`, `.terraform`, `.serverless`, `.yarn`, `.pnpm-store`, `__snapshots__`, `.vercel`, `.firebase`, `.tox`, `.nyc_output`, `tmp`) to keep the indexed file count and map size smaller on more project types.

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
