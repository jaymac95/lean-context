# Design notes

## Goal

Reduce avoidable context/token usage across multiple coding agents without sacrificing the project knowledge needed to make correct changes.

## Principle: map, then retrieve

The root instruction layer should contain only stable rules that are useful on almost every task. Project-specific detail should live in an on-demand navigation map or deeper docs.

## Why AGENTS.md is canonical

Codex uses it directly. Antigravity recognizes it as workspace context. Claude Code supports imports from CLAUDE.md, so CLAUDE.md can import the same AGENTS.md instead of duplicating a second full rule set.

## Why skills are optional

A chat command is useful, but making its full instructions persistent would defeat the token-saving goal. `--chat` installs on-demand skills instead:

- `.agents/skills/lean-context/` for Codex and Antigravity.
- `.claude/skills/lean-context/` for Claude Code.

The skill descriptions are intentionally short and the full bodies are loaded only when invoked. Claude and Codex are configured for explicit invocation rather than automatic activation.

## Why a local runner is vendored

The skills execute `.ai-context/tool/bin/lean-context.js`. Vendoring the runner during setup avoids a network fetch on every chat call and prevents the agent from spending tokens reconstructing scan logic. The tool directory is excluded from project discovery.

## Non-goals

- No provider API proxying.
- No prompt interception.
- No source-code embeddings/vector database in v0.2.
- No automatic rewriting of user-authored instruction files outside the managed markers.
- No claim of a fixed percentage of token savings.

## Future candidates

- optional language-aware symbol index
- Git diff-aware task context bundle
- `lean-context measure` snapshots before/after sessions
- path-scoped Claude/Antigravity rule generation
- monorepo nested `AGENTS.md` generator
- hooks to refresh the map after structural Git changes
- optional global skill installer for users who want lean-context available in every repo
