---
name: repo-memory-update
description: Update the repo's durable memory files (AGENTS.md, CLAUDE.md, APP_FUNCTIONALITY_PLAN.md) correctly and safely. Use when a discovered fact, decision, or blocker should persist for future agents.
---

# Repo memory update

Keep durable memory accurate without bloat. See `repo-memory-and-context.mdc`.

## When to use

- You learned something durable (a gotcha, decision, blocker, verified fact) that future agents need.

## Instructions

1. Pick the right file:
   - `AGENTS.md` — durable, cross-tool guidance; cloud specifics under `## Cursor Cloud specific instructions`. Keep short.
   - `CLAUDE.md` — tool-specific deep context.
   - `APP_FUNCTIONALITY_PLAN.md` — status, blockers, verification history, next step.
2. Edit the most relevant existing section instead of adding a near-duplicate.
3. State facts, not narration: what/why + verification evidence. Mark pre-existing vs. introduced.
4. Reference standard commands/docs rather than pasting them again.

## Stop conditions

- Stop once the fact is captured in one authoritative place.

## Verification

- `git diff --stat` shows only the intended memory file(s).
- Secret scan clean (`rg -i "sk_live|pk_live|postgres://|prisma://|api[_-]?key"`).
- The edit reads correctly to a first-time reader.

## Do not claim success unless

- The change is committed and contains no secrets.

## Recovery

- Duplicated/conflicting guidance appeared → consolidate into one section and reference it elsewhere.
- Commit blocked by secret scan → use the env-var name, not the value.
