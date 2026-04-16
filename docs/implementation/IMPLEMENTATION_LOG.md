# Implementation Log

Chronological record of every task's outcome in this run. One entry per task. Tasks appear in execution order. Each entry records: what changed, what verification ran, audit deltas, and any follow-ups.

Source queue: `docs/implementation/IMPLEMENTATION_QUEUE.md`
Source audit: `UNFINISHED_WORK_MASTER_AUDIT.md` (repo root)
Reconciliation notes: `docs/implementation/AUDIT_RECONCILIATION.md`

---

## Entry template

```
### TASK-XXX — <title>
- **Date:** YYYY-MM-DD
- **Status:** completed | partial | blocked | obsolete
- **Commit:** <hash or "—">
- **Files touched:** <list>
- **Change summary:** <1–3 sentences>
- **Verification:** <typecheck / audit / tests that ran>
- **Audit delta:** <what the improved audit reports before vs. after>
- **Follow-ups:** <if any>
- **Progress note:** `docs/implementation/progress/TASK-XXX.md`
```

---

## Entries

<!-- New entries appended below in execution order. -->

### TASK-001 — OSCE: stop writing session-id as QuestionAttempt
- **Date:** 2026-04-16
- **Status:** completed
- **Commit:** (this commit)
- **Files touched:** `components/modes/PatientEncounterMode.tsx`
- **Change summary:** Removed the `syncManager.queueAnswer({ questionId: sessionId, ... })` call and its `syncManager` import. A session id is not a legitimate `QuestionAttempt.questionId`, and pushing OSCE results through the main sync queue polluted FSRS and analytics with semantically wrong rows. OSCE results are already persisted via `completeOSCESession()` + `gradeOSCESession()`, and the condition-level spaced repetition schedule is updated via `updateConditionSchedule()`, which is kept intact.
- **Verification:** Scoped `tsc -p tsconfig.scratch.json` (clean); eslint on touched file (clean); grep for residual `syncManager` / `isPass` / `scorePct` references in the file (none).
- **Audit delta:** Closes the "OSCE encounter queues answer with session id as question id" item in `UNFINISHED_WORK_MASTER_AUDIT.md` (High priority, Low risk).
- **Follow-ups:** None. Future OSCE→FSRS bridging, if ever needed, must route through a dedicated `OSCEAttempt` pipeline, not `QuestionAttempt`.
