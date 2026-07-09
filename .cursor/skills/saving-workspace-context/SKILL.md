---
name: saving-workspace-context
description: Persist important findings, decisions, and state to durable files so long-running or resumed agent sessions don't lose context. Use at the end of a work session, before compaction, or when handing off a task.
---

# Saving workspace context

Keep durable, high-signal context in the repo so future sessions (or a resumed cloud agent) can continue without re-deriving everything.

## When to use

- Ending a substantive session or before context compaction.
- Handing off a partially complete task.
- After discovering a non-obvious blocker, decision, or gotcha.

## Instructions

1. Decide the right destination (do **not** invent a new scratch file if one exists):
   - Durable agent/operating guidance → `AGENTS.md` (`## Cursor Cloud specific instructions`) or `CLAUDE.md`.
   - Recovery status / blockers / next step → `APP_FUNCTIONALITY_PLAN.md`.
   - One-off session handoff → a note under `docs/` (only if nothing suitable exists).
2. Write concise, factual entries: what changed, what was verified (with commands + result), current task, next best step, and known risks/blockers.
3. Keep it short and high-signal. Reference existing docs instead of duplicating standard commands.
4. Never write secrets, tokens, or production connection strings into any file (a commit-time secret scanner will block them anyway).

## Verification

- Re-read the entry as if starting fresh: could you resume from it alone?
- `git diff --stat` shows only the intended doc files.
- Confirm no secret/PII leaked: `git diff | rg -i "sk_live|pk_live|postgres://|api[_-]?key" ` returns nothing sensitive.

## Failure recovery

- If a commit is blocked by the secret scanner, remove the offending value (reference the env var name instead) and re-commit.
- If the note grew too long, trim to the current state + next step; move history to an archive doc.
