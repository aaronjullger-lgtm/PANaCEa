# Audit Reconciliation

Per-claim reconciliation between `UNFINISHED_WORK_MASTER_AUDIT.md` (repo root) and actual code as of 2026-04-16. This file is **additive** — it does not rewrite the master audit. It records which audit claims were verified, which were stale, and what was done.

Classification values:
- `accurate` — audit matches code; fix is real work.
- `stale` — audit is out of date; the issue is already fixed in code.
- `already fixed` — synonym for stale but called out when the fix happened in a prior sprint.
- `addressed-this-run` — accurate when queued, fixed during this run.
- `parked` — accurate, but deferred (see `IMPLEMENTATION_QUEUE.md` deferred list).
- `partial` — partly accurate; scope narrower or broader than audit states.

---

## 2026-04-16 reconciliation pass

### §5 "API validation hardening — 145 endpoints fail audit:zod"

- **Original claim:** 145 endpoints fail `npm run audit:zod`. Named examples: `functions/api/exam/start.ts`, `functions/api/exam/complete.ts`, `functions/api/feedback/submit.ts`, `functions/api/srs/sync.ts`, `functions/api/drills/submit-review.ts`, plus "all admin mutations."
- **Verification:** Re-read each named file on 2026-04-16. All five use the middleware wrapper pattern `authenticatedEndpoint(Schema, handler)` which internally calls `withValidation(schema)`. These are properly Zod-validated.
- **Root cause of false positives:** `scripts/audit-zod-validation.ts` only detects `validateRequest(`, `.safeParse(`, `.parse(` literally in file content. It does not recognize `authenticatedEndpoint` / `adminAuthenticatedEndpoint` / `aiEndpoint` / `publicEndpoint` as wrappers that guarantee validation. Endpoints using the wrapper are classified FAIL even when they are correctly validated.
- **Improved audit (wrapper-aware)** run on 2026-04-16 against `functions/api/**`:
  - 193 mutation endpoints total.
  - 154 PASS.
  - 5 WARN (manual validation only).
  - 34 FAIL — of which 4 are `.test.ts` harness fixtures. **30 real endpoints need Zod validation.**
- **Classification of specific named endpoints:** `stale`.
- **Classification of the overall "~30 endpoints need Zod" finding:** `accurate` (but the list is different from what the audit implied).
- **Real FAIL list (30 endpoints) → queued as TASK-002…TASK-006 in `IMPLEMENTATION_QUEUE.md`.**
- **Deferred from this run:**
  - 7 cron endpoints (CRON_SECRET-gated, not user input; add after cron-auth model is reviewed as a unit).
  - 4 test fixtures (not production code).
  - `branches/[branchName]/merge`, `podcast/generate` (lower-risk long tail).

### §5 "Prisma disconnect cleanup — 18 endpoints still flagged"

- **Original claim:** 18 endpoints still fail `npm run audit:prisma` — Prisma clients created without `safePrismaDisconnect` in finally.
- **Verification:** Ran improved Prisma audit (wrapper-aware) on 2026-04-16. Result: 354 PASS, 3 FAIL.
- **The 3 "fails" are all false positives:**
  - `functions/api/_shared/env-validation.ts` — the match is inside a JSDoc example comment, not real code.
  - `functions/api/_shared/prisma-user-scope.ts` — this is a factory (caller owns disconnect lifecycle).
  - `functions/api/health.ts` — does disconnect, via an indirect alias: `const disconnect = prismaEdge.safePrismaDisconnect; await disconnect(prisma)`. Regex-based audit misses the rebinding.
- **Classification:** `stale` / `already fixed`. Prisma disconnect cleanup is effectively complete.
- **Action this run:** none. No task queued.

### §5 "OSCE mode still has an incorrect answer-queue write"

- **Original claim:** `components/modes/PatientEncounterMode.tsx` writes `syncManager.queueAnswer({ questionId: sessionId, ... })` at the end of an OSCE session — pushing a fake review into the FSRS/analytics pipeline. OSCE is not a MAIN or DRILL session type and must not feed FSRS artifacts.
- **Verification:** Re-read `components/modes/PatientEncounterMode.tsx:1009–1024` on 2026-04-16. Block is present exactly as described, with `questionId: sessionId` (not a real question id), a fabricated rating (`isPass ? 3 : 1`), and `isMainSession: false` which nominally gates the FSRS path but still writes into the sync queue and downstream analytics.
- **Classification:** `accurate` — queued as TASK-001.
- **Scope of fix:** Remove the `syncManager.queueAnswer({...})` call and its argument block. Keep the adjacent `updateConditionSchedule(currentCase.id, ...)` call intact (condition-level spaced repetition is the appropriate OSCE artifact). Keep the enclosing `if (currentCase)` wrapper — `updateConditionSchedule` still needs it.
- **Parked follow-up (product decision, not code):** whether OSCE should emit a dedicated analytics event, a real review artifact for condition-level retention tracking, or no SRS artifact at all. Out of scope for this run.

### §5 "NotificationLog schema + migration"

- **Classification:** `accurate`. Requires Prisma migrate → Ask First per CLAUDE.md.
- **Action this run:** deferred. Listed under "Not doing now" in `IMPLEMENTATION_QUEUE.md`.

### §5 "Runtime-owned replacement for GitHub-cron push reminders"

- **Classification:** `accurate`. Requires `web-push` production dependency + architecture decision. Ask First.
- **Action this run:** deferred.

### §5 "Express-to-Edge retirement"

- **Classification:** `accurate`. Architecture change → Ask First; needs route-parity audit.
- **Action this run:** deferred.

### §5 "Study-groups / social build-or-freeze"

- **Classification:** `accurate`. Product decision required.
- **Action this run:** deferred.

### §5 "Retire deprecated SRS endpoints"

- **Classification:** `accurate`. Needs active-caller inventory + product sign-off on lifecycle; medium risk if clients still hit these endpoints.
- **Action this run:** deferred.

### §6 "Library-enrichment admin endpoints (.disabled)"

- **Classification:** `accurate`. Two `.disabled` endpoints need a data-source decision (files vs DB vs admin API) before re-enable. Ask First.
- **Action this run:** deferred.

### §7 "Dead-man-switch alerting"

- **Classification:** `accurate`. Deferred per audit §10; wait for automation ownership to settle.
- **Action this run:** deferred.

### §7 "Automated backup restore verification"

- **Classification:** `accurate`. Medium-risk ops work; needs runbook before wiring into weekly maintenance.
- **Action this run:** deferred.

### §7 "Loading-state normalization rollout"

- **Classification:** `accurate`. Wide UI touch; better handled as its own dedicated sprint after current backend tranche.
- **Action this run:** deferred.

### §7 "Auxiliary AI placeholders (Spark instant-calc, Smart Scribe infographic)"

- **Classification:** `accurate` but low-priority per audit §10.
- **Action this run:** deferred.

### §10 Quick-win recommendations

- **Quick win #1 (OSCE queueAnswer):** addressed this run via TASK-001.
- **Quick win #2 (admin staging Zod):** addressed this run via TASK-002.
- Remaining quick wins fold into TASK-003…TASK-006.

---

## Per-task reconciliation entries

<!-- One short block added per task as it completes, recording which audit claim the change closes. -->
