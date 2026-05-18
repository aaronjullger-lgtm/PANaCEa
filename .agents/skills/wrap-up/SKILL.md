---
name: wrap-up
description: End-of-session checklist that commits work, captures issues, writes a handoff note, and updates dashboard state. Use at the end of any substantive session, when Aaron says "wrap up", "done for now", "that's it", "let's stop", "save progress", or when a long session is naturally winding down. Also auto-suggest after completing a multi-step task.
model: sonnet
effort: medium
user_invocable: true
---

# /wrap-up — Session Close-Out

Run this at the end of every substantive session. All three phases
execute without confirmation unless a Decision Card is needed.

## Phase 1: Issue Capture (skip if clean session)

Quick health check — did anything go wrong this session?
- Errors encountered and how they were resolved
- Workarounds applied (flag as tech debt)
- Knowledge gaps discovered

If issues exist, log them to `~/Documents/Codex/session-issues.md`
with date, severity, context, and resolution. Append, don't overwrite.

If the session was clean, skip this phase entirely.

## Phase 2: Ship Outstanding Work

Check for uncommitted work:
1. Run `git status` in any repo that was modified during the session
2. If changes exist: stage specific files (NEVER `git add .`), commit with
   a descriptive message, push
3. If PANaCEa was modified: run `npm run typecheck` before committing.
   If typecheck fails, note it in the handoff as unfinished work.

Check for unsaved state:
1. If dashboard state was discussed or modified, verify dual-write
   (both JSON and inline HTML STATE are in sync)
2. If study plan progress was made, verify nightly-review will pick it up

## Phase 3: Write Handoff

Write to `~/Documents/Codex/handoff.md` (overwrite previous):

```
## Handoff — [YYYY-MM-DD]
**Status:** Complete | Continues
**Accomplished:** [bullet list of what got done]
**Unfinished:** [specific next steps with file paths, or "None"]
**Decisions made:** [any choices that affect future work]
**Decisions deferred:** [anything punted, with reason]
**Resume prompt:** [exact sentence to start next session — specific enough
  that a fresh Codex instance with no context can pick up immediately]
```

### Handoff Rules
- **Status is binary.** "Complete" means the stated goal is resolved.
  "Continues" means there's unfinished work that needs a follow-up session.
- **Resume prompt is mandatory.** It must reference specific files, skills,
  or commands — not vague instructions like "continue working on PANaCEa."
  Good: "Run panacea-verify on the FSRS gating fix in lib/services/drillReviewService.ts"
  Bad: "Continue with the FSRS work"

- If status is "Continues", the resume prompt must be actionable enough
  that Aaron can paste it verbatim into a new session and get rolling.

## Phase 4: Final Message

The last message Aaron sees in the conversation must state:
1. Handoff status (Complete or Continues)
2. If Continues: the resume prompt, quoted verbatim

Example:
> **Session complete.** Handoff written to `~/Documents/Codex/handoff.md`.

or:

> **Session continues.** Resume next time with:
> "Run panacea-verify on the FSRS gating fix in lib/services/drillReviewService.ts, then commit if clean."

## Anti-Patterns
- Do NOT ask "should I wrap up?" — just do it when triggered
- Do NOT write a long summary in the conversation — that's what handoff.md is for
- Do NOT skip the handoff even if the session feels trivial — the next session needs it
- Do NOT use `git add .` or `git add -A` during the ship phase
- Do NOT leave typecheck failures uncommitted without noting them in the handoff
