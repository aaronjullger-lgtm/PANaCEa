---
name: long-running-handoff
description: Write a handoff note so the next agent (or a resumed run) can continue without losing context. Use at end of run, before compaction, or when pausing a partial task.
---

# Long-running handoff

Leave a durable, high-signal handoff. See `repo-memory-and-context.mdc` (where to write) and `saving-workspace-context`.

## When to use

- Ending a session/run, before context compaction, or handing off partial work.

## Instructions

1. Choose the destination by content type (see `repo-memory-and-context.mdc`): `APP_FUNCTIONALITY_PLAN.md` for status/blockers/next-step; `AGENTS.md` for durable cross-agent guidance; a dated `docs/` note only if nothing fits.
2. Write these sections concisely:
   - **Done:** what changed (files/areas).
   - **Verified:** commands run + results (and pre-existing vs. introduced failures).
   - **Current state:** what works / what's incomplete.
   - **Next best step:** the single most useful next action.
   - **Blockers/risks:** anything needing approval or human input (e.g., prod migration, secrets, dashboard MCP setup).
3. Keep it short enough to read cold; reference docs instead of duplicating commands.

## Stop conditions

- Stop when a fresh agent could resume from the note alone.

## Verification

- Re-read cold: is the next step unambiguous?
- `git diff | rg -i "sk_live|pk_live|postgres://|prisma://|api[_-]?key"` → nothing sensitive.

## Do not claim success unless

- The note is committed/saved to the correct durable file (not only in chat).

## Recovery

- Secret-scan blocked the commit → replace the value with the env-var name and re-commit.
- Note too long → trim to current state + next step; move history to an archive doc.
