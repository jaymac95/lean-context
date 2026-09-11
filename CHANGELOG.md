# Changelog

## 0.4.3

- README: removed a link to the private benchmark harness repo.

## 0.4.2

- Claude Code's managed `CLAUDE.md` block now auto-imports `.ai-context/project-map.md` via Claude Code's native `@path` import (always-on context), alongside the existing `@AGENTS.md` import. Diagnostic runs showed agents reaching straight for a repo-wide grep instead of opening the on-demand map first, despite the protocol instructing them to check it — auto-loading it removes the need for the agent to remember, at the cost of a bounded amount of always-on context. Codex/Antigravity are unaffected (they read `AGENTS.md` directly; `@path` imports are a Claude Code–specific convention).
- Corrected the 0.4.1 changelog entry and README: the "~8% to ~25%" figure was measured at n=4 per side and turned out to be sampling noise, not a stable effect — a run of n=10 per side on the same task landed at **9.6%** total-token savings, 100% pass rate both sides. Both the shared-logic-file fix and this release's auto-imported map are real, mechanism-verified improvements (confirmed via tool-call tracing that agents stop grepping for a symbol already listed in the map), but their aggregate effect on this specific narrow task is modest — the task only has one or two avoidable tool round-trips to begin with. Treat any single-digit sample benchmark number, including in this changelog's own prior entries, with that caveat.

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
