# lean-context

A tiny, drop-in context optimizer for **OpenAI Codex**, **Claude Code**, and **Google Antigravity**.

It does **not** change model pricing. It reduces avoidable context consumption by giving coding agents a small project map and a shared set of context-discipline rules, so they can search narrowly instead of repeatedly scanning large repositories.

Version **0.2** adds optional **chat-native skills**. After one setup command, Claude Code, Codex, and Antigravity can run lean-context from their own chat panels without you opening a terminal.

## Why this design

Large always-loaded instruction files consume context themselves. `lean-context` therefore uses two layers:

1. A very small always-on protocol in `AGENTS.md` / `CLAUDE.md`.
2. On-demand Agent Skills and a generated project map that are only loaded when needed.

- **Codex** reads `AGENTS.md` and repo skills from `.agents/skills/`.
- **Claude Code** reads `CLAUDE.md` and project skills from `.claude/skills/`.
- **Antigravity** recognizes workspace `AGENTS.md` and Agent Skills under `.agents/skills/`.

The managed protocol tells agents to search before reading, avoid generated/lock/vendor files, use targeted commands, and keep tool output narrow.

## Recommended setup: terminal + chat

Once this repository is on GitHub, run this once from the project you want to optimize:

```bash
npx github:YOUR_GITHUB_USERNAME/lean-context init . --chat
```

That installs the normal low-token context layer **and** chat commands for the coding agents.

If lean-context was already initialized without chat support, add chat support later with:

```bash
npx github:YOUR_GITHUB_USERNAME/lean-context chat .
```

## Run it directly from agent chats

### Claude Code extension — VS Code or compatible host

Type in the Claude chat:

```text
/lean-context
```

That uses smart mode. You can also run:

```text
/lean-context refresh
/lean-context check
/lean-context stats
/lean-context init
```

Claude's project skill is stored at:

```text
.claude/skills/lean-context/SKILL.md
```

It is configured for **explicit invocation only**, so Claude does not automatically load the full skill on unrelated tasks.

### Codex extension — VS Code or compatible host

Type in the Codex chat:

```text
$lean-context
```

Or use `/skills` and select **Lean Context**. Actions can be appended:

```text
$lean-context refresh
$lean-context check
$lean-context stats
$lean-context init
```

Codex loads the shared skill from:

```text
.agents/skills/lean-context/SKILL.md
```

Its `agents/openai.yaml` disables implicit invocation, so the skill only runs when you deliberately call it.

### Antigravity Agent chat

Type:

```text
/lean-context
```

or:

```text
/lean-context refresh
/lean-context check
/lean-context stats
/lean-context init
```

Antigravity uses the same shared Agent Skill under `.agents/skills/lean-context/`.

## What smart mode does

`smart` is the default chat action:

1. Check whether `.ai-context/project-map.md` is current.
2. If stale, refresh it.
3. If state is missing/corrupt, repair initialization.
4. Print the approximate context footprint.

From a terminal the equivalent command is:

```bash
lean-context smart .
```

## What gets created

With chat mode enabled:

```text
YOUR_PROJECT/
├─ AGENTS.md
├─ CLAUDE.md
├─ .agents/
│  └─ skills/
│     └─ lean-context/
│        ├─ SKILL.md
│        └─ agents/
│           └─ openai.yaml
├─ .claude/
│  └─ skills/
│     └─ lean-context/
│        └─ SKILL.md
└─ .ai-context/
   ├─ project-map.md
   ├─ state.json
   ├─ .gitignore
   └─ tool/
      ├─ package.json
      ├─ bin/lean-context.js
      └─ lib/index.js
```

The `.ai-context/tool/` copy is intentional. Chat skills call this local deterministic runner, so they do not need another network fetch or spend model tokens reimplementing the scan. `lean-context` excludes `.ai-context/`, `.agents/`, and `.claude/` from its project fingerprint and navigation map.

Existing `AGENTS.md` and `CLAUDE.md` files are preserved. `lean-context` only owns the text between `<!-- lean-context:start -->` and `<!-- lean-context:end -->` markers.

## CLI commands

| Command | Purpose |
| --- | --- |
| `lean-context init [project] [--chat]` | Add/update managed instructions, generate the map, optionally install chat skills |
| `lean-context chat [project]` | Enable/refresh chat-native skills and the local runner |
| `lean-context smart [project]` | Check, refresh only if needed, then show stats |
| `lean-context refresh [project]` | Regenerate only the project map |
| `lean-context stats [project]` | Show a rough chars/4 token estimate |
| `lean-context check [project]` | Exit non-zero when the map fingerprint is stale |

## How it reduces waste

1. **One canonical rule set** instead of separately maintaining large Codex/Claude/Antigravity instruction files.
2. **Small always-loaded instructions** that act as a navigation protocol rather than a project encyclopedia.
3. **Progressively loaded skills** so maintenance instructions are not fully loaded on unrelated coding tasks.
4. **Generated project map** that records the stack, common commands, important files, and directory counts without embedding the whole source tree.
5. **Noise filtering** for dependencies, build output, caches, lockfiles, binaries, images, source maps, minified assets, and agent configuration folders.
6. **Targeted exploration rules** that ask the agent to search for symbols and open the smallest useful file slice.
7. **Local deterministic chat runner** so refresh/check/stats do not require the model to reconstruct the workflow.

## Important caveat

Token savings are workload-dependent. Claude Code, Codex, and Antigravity have their own context management, caching, compaction, system instructions, tools, and billing rules. Measure real usage before and after where your provider exposes it.

## Platform notes

- Claude Code skills can be invoked directly from chat and their bodies load only when used. The VS Code extension supports commands and skills, although the graphical extension exposes a subset of CLI commands.
- Codex standalone skills are available in the IDE extension. Repo-scoped skills are discovered from `.agents/skills`; explicit invocation is through `$skill-name` or the `/skills` selector.
- Antigravity skills under `.agents/skills/<name>/SKILL.md` support progressive context loading and slash-command invocation.

## License

MIT
