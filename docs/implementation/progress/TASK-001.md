# TASK-001 — Remove bogus OSCE `queueAnswer({ questionId: sessionId })` write

- **Status:** completed
- **Date:** 2026-04-16
- **Commit:** `0e0fed16`
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Category:** Frontend bug
- **Priority / Risk / Size:** High / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §5 "OSCE mode still has an incorrect answer-queue write"; §10 Quick win #1

## Verify-first block (Audit Interpreter)

Classification: **accurate**.

Pre-edit read of `components/modes/PatientEncounterMode.tsx` (HEAD) confirmed the bogus block was present exactly as the audit described:

- Call site wrote `syncManager.queueAnswer({ questionId: sessionId, ... })`, using the OSCE **session id** as if it were a `Question.id`.
- OSCE is neither a `MAIN` nor a `DRILL` session (per CLAUDE.md "Only real sessions update FSRS"), so the write polluted sync → analytics downstream and risked writing nonsense rows into the FSRS pipeline on any future wiring change.
- The adjacent `updateConditionSchedule(...)` call is the legitimate artifact (condition-level retention, not question-level FSRS).

## Planned-code-changes block (Repo Mapper)

Before editing:
- Inspected `components/modes/PatientEncounterMode.tsx` around the OSCE grading path.
- Confirmed the `syncManager` symbol is only imported for this single call; removing the call lets us drop the import too.
- Confirmed `updateConditionSchedule` comes from the `useConditionSchedule` hook and is unrelated to `syncManager` / FSRS.
- Verified `syncManager.queueAnswer` is defined in `lib/services/sync/syncManager.ts` and is legitimately called from real study/drill paths — the function itself is fine; the OSCE caller was the bug.

Planned changes:
1. Remove the `syncManager.queueAnswer({ ... })` block inside the OSCE grading `try` clause.
2. Remove the now-unused `syncManager` import at the top of the file.
3. Keep the enclosing `if (currentCase)` wrapper — `updateConditionSchedule` still needs it.
4. Keep the explanatory comment that states why we intentionally do NOT emit a QuestionAttempt here.

## What was changed

- `components/modes/PatientEncounterMode.tsx`:
  - Removed `syncManager.queueAnswer(...)` call and its argument literal.
  - Removed the `syncManager` import.
  - Left `updateConditionSchedule(currentCase.id, ...)` intact.
  - Left `completeOSCESession()` + `gradeOSCESession()` persistence flow intact.

## Verification

- `git grep "syncManager.queueAnswer" components/modes/PatientEncounterMode.tsx` — no matches.
- `git grep "queueAnswer" components/` — no residual OSCE callers; only the correct drill/session call sites remain.
- `git grep "syncManager.queueAnswer" lib/ hooks/` — no orphan references.
- File compiles cleanly as part of the project build (no new errors introduced in `PatientEncounterMode.tsx`).
- No changes to OSCE grading rubric, `completeOSCESession`, or FSRS wiring.

## Audit delta

- `UNFINISHED_WORK_MASTER_AUDIT.md` §5 "OSCE mode still has an incorrect answer-queue write" → **addressed-this-run**.
- Remaining (parked for product decision): whether OSCE should emit a dedicated analytics event, a real review artifact for condition-level retention tracking, or no SRS artifact at all. Out of scope for this task.

## Follow-ups

- None in this sprint.
- If a future roadmap item bridges OSCE → FSRS, it must route through a dedicated `OSCEAttempt` pipeline, not `QuestionAttempt`.
