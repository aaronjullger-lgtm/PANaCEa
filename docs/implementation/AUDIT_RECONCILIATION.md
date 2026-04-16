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
- **Root cause of false positives:** `scripts/audit-zod-validation.ts` had four independent detection gaps, each compounding the false-positive count:
  1. It did not recognize the seven shared middleware wrappers (`authenticatedEndpoint`, `adminEndpoint`, `adminAuthenticatedEndpoint`, `aiEndpoint`, `refineryEndpoint`, `cmsEndpoint`, `publicEndpoint`) as validated call sites. The wrappers internally compose `withValidation(schema)`; the audit only looked for `validateRequest(`, `.safeParse(`, or `.parse(` literally.
  2. Its `.parse(` detection matched `JSON.parse(` as evidence of Zod. Any file that parsed a request body via `JSON.parse(...)` was erroneously classified PASS for the wrong reason, and any file using Zod only via a wrapper was classified FAIL.
  3. It did not handle the TypeScript generic call form `authenticatedEndpoint<Input>(...)`. Strongly-typed wrapper usages (e.g. `functions/api/performance/record.ts`) were flagged FAIL.
  4. It did not treat CRON_SECRET bearer-auth or Svix webhook signature verification as legitimate out-of-band security models — cron endpoints and `webhooks/clerk.ts` were flagged FAIL even though Zod is structurally not the right tool for them.
- **Fix applied this run:** `scripts/audit-zod-validation.ts` was rewritten. Detection now:
  - Enumerates all seven wrappers in `VALIDATED_WRAPPERS`.
  - Allows an optional TS generic argument between the wrapper name and its `(`: `\b${name}\s*(?:<[^>]*>)?\s*\(`.
  - Recognizes `withValidation(...)` composition anywhere in a file.
  - Rejects `JSON.parse(` via a line-scan that inspects the preceding token.
  - Classifies CRON_SECRET (`/\.CRON_SECRET\b/` + `Authorization|Bearer`) and Svix webhook patterns as `WARN_OUT_OF_BAND` — Zod not applicable.
  - Excludes `.test.ts` and `.disabled` paths from consideration.
- **Post-fix audit run on 2026-04-16:**
  - 176 PASS.
  - 8 WARN_OUT_OF_BAND (7 cron endpoints + `webhooks/clerk`).
  - 3 WARN_MANUAL_ONLY (`knowledge/upload` — multipart; `technique-check/analyze` — multipart; `sentry-tunnel` — Sentry envelope proxy).
  - **2 FAIL**: `drill/log-attempt.ts` (deprecated 410 Gone tombstone that never reads the body) and `podcast/generate.ts` (proxy forwarding to external Node service).
- **Classification of specific named endpoints (exam/start, exam/complete, feedback/submit, srs/sync, drills/submit-review, and "all admin mutations"):** `stale`.
- **Classification of the umbrella "145 endpoints" claim:** `stale` — the number was an artifact of the detection gap, not real risk.
- **Classification of the residual file-level work:** `accurate` for `users/me/daily-plan.ts`, `users/me/exam-outcome.ts`, and `podcast/generate.ts` — all three addressed this run (TASK-007, TASK-008, TASK-009 respectively).
- **Deferred from this run:**
  - 7 cron endpoints (CRON_SECRET-gated; Zod not applicable).
  - `webhooks/clerk` (Svix signature; Zod not applicable).
  - 3 multipart endpoints in WARN_MANUAL_ONLY (`knowledge/upload`, `technique-check/analyze` for video, `sentry-tunnel` for Sentry envelope proxy; Zod does not fit the body shape).
- **Remaining FAIL after this run:** 2 — `functions/api/drill/log-attempt.ts` and `functions/api/questions/review.ts`, both deliberate 410 Gone tombstones that never read their request bodies. Real risk = 0; both parked with tombstone annotations. (`review.ts` became a tombstone in TASK-010 this run; `log-attempt.ts` was already a tombstone before this run.)

### §5 "Audit script detection gaps (meta)"

- **Classification:** `addressed-this-run`.
- **What changed:** `scripts/audit-zod-validation.ts` rewritten as described above. Also gained `WARN_OUT_OF_BAND` status and richer `AuditResult` fields (`usesWrapper`, `usesWithValidation`, `usesCronSecret`, `usesSvixWebhook`, `note`).
- **Impact:** Future `npm run audit:zod` runs produce a signal that's actually actionable. Without this fix, every sprint would have kept re-surfacing the same phantom 145-endpoint list.

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

- **Classification (original):** `accurate`. Needs active-caller inventory + product sign-off on lifecycle; medium risk if clients still hit these endpoints.
- **Action this run:** `functions/api/questions/review.ts` addressed via TASK-010 after a clean caller inventory (the endpoint was orphaned at the application level; only the companion client service `reviewSubmissionService.ts` called it, and it had no UI importers). `functions/api/srs/submit.ts` remains parked — it still has an active caller (`SrsFlashcardView`) sending `srsItemId`, which means narrowing it involves a product decision about whether flashcard practice switches to the FSRS pipeline.

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

### TASK-001 (commit `0e0fed16`) → §5 OSCE queueAnswer write
- Classification updated to **addressed-this-run**.
- Bogus `syncManager.queueAnswer({ questionId: sessionId, ... })` removed from `components/modes/PatientEncounterMode.tsx`; `updateConditionSchedule(...)` retained.
- Parked follow-up: strategic question of whether OSCE should ever emit a review artifact (none / analytics event / OSCEAttempt pipeline) — product decision.

### TASK-007 → §5 `users/me/daily-plan.ts` POST Zod gap
- Classification updated to **addressed-this-run**.
- Switched `onRequestPost` from raw `withMiddleware(...)` to `authenticatedEndpoint(DailyPlanCompleteSchema, handler, { requestsPerMinute: 30 })`. Schema clamps `accuracy` to 0..1 and `durationMinutes` to 0..1440. GET handler untouched (no body).

### TASK-008 → §5 `users/me/exam-outcome.ts` POST Zod gap
- Classification updated to **addressed-this-run**.
- Rewrote `onRequestPost` to `authenticatedEndpoint(ExamOutcomeSchema, handler, { requestsPerMinute: 30 })`. Schema enforces `examType` enum, ISO `examDate` refine, 0..100 score/percentile, and 0..86400 bounds on `timeLimit` / `timeUsed`.

### TASK-009 → §5 `podcast/generate.ts` POST Zod gap (proxy)
- Classification updated to **addressed-this-run** (authorized past the original Ask-First deferral).
- Kept the custom `withMiddleware` chain (required because `withValidation` can't handle multipart). Added branch-specific validation: 415 content-type gate, `PodcastGenerateJsonSchema.safeParse()` with `.passthrough()` on the JSON branch, and a 25 MB `Content-Length` ceiling on the multipart branch before `formData()` parses.
- Audit state after this task: **177 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 1 FAIL** (`drill/log-attempt.ts` 410 tombstone — no action needed).

### Audit-script fix → meta
- Classification **addressed-this-run**.
- `scripts/audit-zod-validation.ts` rewritten to cover the seven shared middleware wrappers, the TS-generic call form, CRON_SECRET / Svix out-of-band security, and to reject `JSON.parse(` as false Zod evidence. Post-fix FAIL count is 2 (log-attempt tombstone + podcast/generate proxy), matching reality.

### TASK-010 → "Retire deprecated SRS endpoints" (partial — `/api/questions/review` only)
- Classification updated to **addressed-this-run** (for `functions/api/questions/review.ts`).
- Tombstoned both `onRequestGet` and `onRequestPost` with 410 Gone + migration pointers (`POST /api/drills/submit-review` for writes; proactive reservoir for reads). Deleted three orphaned files: `lib/services/review/reviewSubmissionService.ts`, `lib/services/review/reviewService.ts`, `lib/services/review/reviewService.test.ts`. Removed the now-empty `lib/services/review/` directory.
- Caller inventory (2026-04-16): zero UI/hook/store importers of the deleted client service; only reference outside the retired files was the endpoint's own JSDoc and 3 historical audit docs.
- Audit state after this task: **176 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 2 FAIL** (`drill/log-attempt.ts` + `questions/review.ts` — both deliberate 410 tombstones, both expected).
- Still parked: `functions/api/srs/submit.ts` (active caller in `SrsFlashcardView`) and the `SRSItem` model itself (requires schema migration → Ask First).
