# Agent Environment — PANaCEa Coding Agent Setup

> Built 2026-07-20. Version-controlled, reproducible from committed files alone.

## What This Is

A complete coding agent environment for solo full-stack development of PANaCEa. Designed for **fragmented time** (45–120 min blocks, days apart) with **no code reviewer**. Every piece solves a named pain point.

## Quick Reference

### Slash Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/resume` | Reconstruct working context from last session | Session start, "continue", "where was I" |
| `/sprint <task>` | Full implementation pipeline: audit→plan→implement→verify→commit | Feature work, "do it for me" |
| `/review` | Adversarial self-review of current changes | Before commit, "check my work" |
| `/ship` | Pre-deploy verification gate | Before deploy to Cloudflare |
| `/handoff` | Force a clean stopping point | Time running out mid-task |
| `/audit` | Read files before modifying | Start of any task |
| `/verify` | Typecheck + unit tests | After changes |
| `/status` | Git status + test status | Quick check |

### Subagents

| Agent | Purpose |
|-------|---------|
| `security-reviewer` | Find auth bypasses, secret exposure, RLS gaps |
| `migration-reviewer` | Verify schema changes are safe, reversible, RLS-compliant |
| `aidesigner-frontend` | AI-powered frontend generation (pre-existing) |

### MCP Servers

| Server | What it does | Credentials |
|--------|-------------|-------------|
| AIDesigner | Frontend design generation | None |
| Context7 | Version-specific library docs lookup | None |
| Sentry | Production error introspection | `SENTRY_AUTH_TOKEN` (from .env) |
| Supabase | DB schema introspection, RLS audit, SQL queries | OAuth (connect to **staging only**) |

### Hooks (7)

| Hook | Purpose | Blocks? |
|------|---------|---------|
| safety-guard | Destructive commands + secret scanning | ✅ |
| migration-tripwire | prisma db push / migrate reset | ✅ |
| dependency-check | Hallucinated npm packages | ✅ |
| edge-runtime-guard | Node-only APIs in functions/ | Warn only |
| format-on-save | Prettier + eslint on touched file | No |
| session-start | Git state + pending migrations + handoff | No |
| session-handoff | Write handoff note on stop/exit | No |

### Skills (31 tracked)

See `00-inventory.md` for the full skill audit. Key additions:
- `session-resume` — context reconstruction
- `migration-safety` — schema change guardrails
- `edge-runtime-guard` — Cloudflare Edge compatibility
- `secret-detector` — PANaCEa credential patterns
- `scoped-typecheck` — OOM-safe typecheck workflow
- `adversarial-review` — solo-dev self-review checklist
- `sprint-workflow` — merged from sprint-pipeline + panacea-component-sprint

## Before/After Table

| Metric | Before | After |
|--------|--------|-------|
| Working MCPs | 1 (aidesigner) | 4 (+ context7, sentry, supabase) |
| Ghost MCP permissions | 8 entries | 0 |
| Hooks (active) | 1 (safety-guard only) | 7 (full lifecycle) |
| SessionStart wired | ❌ (script existed, not wired) | ✅ |
| Slash commands | 5 | 9 (+ resume, review, ship, handoff) |
| Subagents | 1 (aidesigner) | 3 (+ security, migration) |
| Tracked skills | 27 | 31 (+7 new, -3 retired/merged) |
| Junk skill dirs | 1,216 | 0 |
| Migration safety hook | ❌ | ✅ |
| Dependency check hook | ❌ | ✅ |
| Edge runtime guard | ❌ | ✅ |
| Session handoff writer | ❌ | ✅ |
| Always-on token overhead | ~33Kt | ~31Kt (-2Kt) |

## How to Disable Each Piece

### Disable a single hook
Edit `.claude/settings.json`, remove the hook entry from the relevant event array.

### Disable all hooks
Delete `.claude/settings.json` (or remove the `"hooks"` key).

### Disable a single MCP
Edit `.mcp.json`, remove the server entry. Also remove from `enabledMcpjsonServers` in `.claude/settings.local.json`.

### Disable all MCPs
Delete `.mcp.json`.

### Bypass a blocking hook (per-command)
Prefix the command with `PANACEA_UNSAFE=1`:
```
PANACEA_UNSAFE=1 npx prisma db push
```

### Remove a skill
```bash
git rm --cached .claude/skills/<name>/SKILL.md
```

## How to Rebuild From Scratch

All configuration is in committed files. To rebuild on a new machine:

```bash
git clone <repo>
cd StudyPANaCEa
npm ci

# MCPs auto-configure from .mcp.json
# Hooks auto-configure from .claude/settings.json
# Skills are git-tracked in .claude/skills/
# Commands are git-tracked in .claude/commands/
# Subagents are git-tracked in .claude/agents/

# First MCP connection:
# - Context7: works immediately (no auth)
# - Sentry: needs SENTRY_AUTH_TOKEN in .env
# - Supabase: OAuth flow on first use (connect to STAGING project)
```

## Pain Point Coverage

| Pain Point | Solution |
|-----------|----------|
| #1 Lost context between sessions | `/resume` command + SessionStart hook + session-handoff.sh |
| #2 Shipping broken code | `/review` + `/ship` + Sentry MCP + scoped-typecheck skill |
| #3 RLS/security debt | migration-tripwire hook + Supabase MCP + security-reviewer subagent |
| #4 tsc OOM crashes | scoped-typecheck skill (per-file, not full-project) |
| #5 Git lock errors | safety-guard hook blocks destructive git ops |
| #6 Stale tracking docs | SessionStart surfaces pending migrations + handoff notes |
| #7 Abandoned sprints | `/handoff` + sprint-workflow skill continuation protocol |

## Least Confident In

1. **Supabase MCP OAuth flow** — I haven't tested the actual OAuth connection since it requires interactive browser auth. The config is correct but the first connection needs Aaron to select the staging project.
2. **format-on-save performance** — Running prettier + eslint on every edit could slow down rapid edit cycles. If it's too slow, remove the PostToolUse entry from settings.json.
3. **Dependency check network dependency** — If npm registry is slow/down, the hook degrades to a warning. This is by design but means hallucinated packages could slip through during network issues.
