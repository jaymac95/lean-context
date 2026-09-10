# Chat integrations

`lean-context init . --chat` installs two project-level Agent Skills and a local deterministic runner.

## Invocation matrix

| Surface | Invocation | Project skill path |
| --- | --- | --- |
| Claude Code extension / CLI | `/lean-context [action]` | `.claude/skills/lean-context/SKILL.md` |
| Codex IDE extension / CLI | `$lean-context [action]` or `/skills` | `.agents/skills/lean-context/SKILL.md` |
| Google Antigravity Agent | `/lean-context [action]` | `.agents/skills/lean-context/SKILL.md` |

Supported actions are `smart`, `refresh`, `check`, `stats`, and `init`. No action means `smart`.

## Why the runner is vendored

The skill does not ask the model to recreate project discovery itself. It executes:

```bash
node .ai-context/tool/bin/lean-context.js <action> .
```

This has three benefits:

1. No network fetch on each chat invocation.
2. Deterministic behavior across agents.
3. Less model/tool chatter for routine maintenance.

The runner is excluded from the generated project map and fingerprint.

## Invocation policy

Claude's copy uses `disable-model-invocation: true`. Codex's `agents/openai.yaml` uses `allow_implicit_invocation: false`. This keeps lean-context opt-in rather than allowing it to activate on ordinary coding prompts.

Antigravity shares the `.agents/skills` copy. Its progressive disclosure behavior means the skill body is not part of ordinary task context until the skill is selected or invoked.
