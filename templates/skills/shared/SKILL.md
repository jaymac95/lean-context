---
name: lean-context
description: Explicitly maintain lean-context for this repository: refresh or check the generated project map, show context stats, or repair the managed context files. Use when the user invokes lean-context or asks to run its repository context optimizer.
---

Run lean-context through the vendored local runner. Do not reimplement its scan in the model and do not read the runner source unless execution fails.

Runner:

```bash
node .ai-context/tool/bin/lean-context.js <action> .
```

Choose exactly one action from the user's request:

- `refresh` — regenerate the project map after structural changes.
- `check` — check whether the map is stale.
- `stats` — report the approximate context footprint.
- `init` — repair/update the managed `AGENTS.md`, `CLAUDE.md`, and map while preserving user-authored text.
- no action / `smart` — run `check`; if it reports stale, run `refresh`; then run `stats`.

Keep the response short. Report what ran and the result. Do not broaden into a repository audit unless the user asks.
