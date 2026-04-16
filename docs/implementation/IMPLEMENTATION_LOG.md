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
- **Commit:** 0e0fed16
- **Files touched:** `components/modes/PatientEncounterMode.tsx`
- **Change summary:** Removed the `syncManager.queueAnswer({ questionId: sessionId, ... })` call and its `syncManager` import. A session id is not a legitimate `QuestionAttempt.questionId`, and pushing OSCE results through the main sync queue polluted FSRS and analytics with semantically wrong rows. OSCE results are already persisted via `completeOSCESession()` + `gradeOSCESession()`, and the condition-level spaced repetition schedule is updated via `updateConditionSchedule()`, which is kept intact.
- **Verification:** Scoped `tsc -p tsconfig.scratch.json` (clean); eslint on touched file (clean); grep for residual `syncManager` / `isPass` / `scorePct` references in the file (none).
- **Audit delta:** Closes the "OSCE encounter queues answer with session id as question id" item in `UNFINISHED_WORK_MASTER_AUDIT.md` (High priority, Low risk).
- **Follow-ups:** None. Future OSCE→FSRS bridging, if ever needed, must route through a dedicated `OSCEAttempt` pipeline, not `QuestionAttempt`.

### META — Fix `scripts/audit-zod-validation.ts` detection gaps
- **Date:** 2026-04-16
- **Status:** completed
- **Commit:** (pending this-run commit)
- **Files touched:** `scripts/audit-zod-validation.ts`
- **Change summary:** Rewrote the Zod audit script so it recognizes (1) all seven shared middleware wrappers that internally compose `withValidation(schema)`, (2) the TypeScript-generic call form `authenticatedEndpoint<Input>(...)`, (3) `withValidation(...)` composition anywhere in a custom chain, (4) CRON_SECRET bearer auth and Svix webhook verification as `WARN_OUT_OF_BAND` (Zod not applicable), and (5) rejects `JSON.parse(` as false Zod evidence via a token-preceding line scan. Excludes `.test.ts` and `.disabled` paths.
- **Verification:** Ran the fixed script against `functions/api/**` — output: 176 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 2 FAIL. The two FAILs are expected exceptions (`drill/log-attempt.ts` 410 tombstone, `podcast/generate.ts` external proxy).
- **Audit delta:** Converts §5 "145 endpoints fail audit:zod" from an unactionable phantom to a two-line reality list. Future audits now produce signal instead of noise. See `AUDIT_RECONCILIATION.md` for root-cause breakdown.
- **Follow-ups:** None. If new wrappers are added, append them to `VALIDATED_WRAPPERS`.

### TASK-007 — Zod-harden `POST /api/users/me/daily-plan/complete`
- **Date:** 2026-04-16
- **Status:** completed
- **Commit:** (pending this-run commit)
- **Files touched:** `functions/api/users/me/daily-plan.ts`
- **Change summary:** Replaced the raw `withMiddleware(...)` chain on `onRequestPost` with `authenticatedEndpoint(DailyPlanCompleteSchema, handler, { requestsPerMinute: 30 })`. Added `DailyPlanCompleteSchema` clamping `accuracy` to 0..1 and `durationMinutes` to 0..1440 (whole minutes). Handler reads from `context.validated.body` instead of `request.json()`. GET handler untouched (no body to validate).
- **Verification:** Fixed audit script confirms `users/me/daily-plan.ts` no longer appears under FAIL or WARN. Handler compiles against the `ValidatedContext` type; no callers depend on the new `DailyPlanCompleteRequest` export.
- **Audit delta:** Closes the file-level item under §5 "API validation hardening" for `users/me/daily-plan`. Umbrella "145 endpoints" claim now reconciled as stale (see reconciliation).
- **Follow-ups:** None.
- **Progress note:** `docs/implementation/progress/TASK-007.md`

### TASK-008 — Zod-harden `POST /api/users/me/exam-outcome`
- **Date:** 2026-04-16
- **Status:** completed
- **Commit:** (pending this-run commit)
- **Files touched:** `functions/api/users/me/exam-outcome.ts`
- **Change summary:** Full rewrite to `authenticatedEndpoint(ExamOutcomeSchema, handler, { requestsPerMinute: 30 })`. Schema enforces `examType` enum (`PANCE`, `PANRE`, `EOR`, `block-exam`), ISO `examDate` via `.refine()`, 0..100 bounds on `score` and `percentile`, 0..86400 bounds on `timeLimit` / `timeUsed`. Clerk-ID → internal-ID lookup and `recordExamOutcome()` call unchanged semantically.
- **Verification:** Fixed audit script confirms `users/me/exam-outcome.ts` no longer appears under FAIL or WARN. Manual-validation regex in the handler is gone; `grep 'if (!examType'` returns nothing.
- **Audit delta:** Closes the file-level item under §5 for `users/me/exam-outcome`. Feeds clean data into the outcome-optimization / system-predictiveness pipeline — no more arbitrary strings or out-of-range numerics reaching `recordExamOutcome()`.
- **Follow-ups:** If PA programs introduce additional exam categories, extend the `examType` enum in lock-step with the Prisma column.
- **Progress note:** `docs/implementation/progress/TASK-008.md`

### TASK-009 — Zod-harden `POST /api/podcast/generate` (proxy)
- **Date:** 2026-04-16
- **Status:** completed
- **Commit:** (pending this-run commit)
- **Files touched:** `functions/api/podcast/generate.ts`
- **Change summary:** Branch-specific validation. Added `import { z } from 'zod'`; declared `PodcastGenerateJsonSchema = z.object({ pdfUrl, topic, voice, title, language, style }).passthrough()` with bounded scalars; exported `PodcastGenerateSchema` + `PodcastGenerateRequest` type. Added 415 content-type gate. JSON branch now runs `.safeParse()` and forwards the validated object (not the raw body). Multipart branch rejects payloads past 25 MB via `Content-Length` before `formData()` materializes. Existing `withMiddleware(withCors, withErrorHandling, withAuth, withRateLimit(5/min), handler)` chain retained — proxy semantics preserved because the downstream Node service at `PODCAST_SERVICE_URL` still owns the multipart field contract.
- **Verification:** Faithful node-native port of `scripts/audit-zod-validation.ts` on full `functions/api/**`: 189 mutation endpoints, 177 PASS (+1), 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, **1 FAIL** (`drill/log-attempt.ts` — 410 Gone tombstone, expected). `podcast/generate.ts` → PASS via `.safeParse(` detection.
- **Audit delta:** Closes the file-level item under §5 "API validation hardening" for `podcast/generate`. Only remaining audit:zod FAIL is the deprecated 410 tombstone.
- **Follow-ups:** Tighten schema from `.passthrough()` to `.strict()` if/when the downstream Node service publishes a stable JSON contract. Raise `MAX_MULTIPART_BYTES` in lock-step with any Cloud Run request-size bump.
- **Progress note:** `docs/implementation/progress/TASK-009.md`

### TASK-010 — Retire orphaned `/api/questions/review` endpoint
- **Date:** 2026-04-16
- **Status:** completed
- **Commit:** `fbad2689` (code) / `6771368a` (docs)
- **Files touched:** `functions/api/questions/review.ts` (rewritten as 410 Gone tombstone for both GET and POST); **deleted** `lib/services/review/reviewSubmissionService.ts`, `lib/services/review/reviewService.ts`, `lib/services/review/reviewService.test.ts`; **removed** now-empty `lib/services/review/` directory.
- **Change summary:** Caller inventory of `/api/questions/review` came back clean — the only caller of the POST path was the client-side wrapper `reviewSubmissionService.ts`, which had zero UI/hook/store importers; the GET path's server-side `ReviewService` class was only used by the retiring endpoint itself. Replaced the endpoint with a 410 Gone tombstone matching the `functions/api/drill/log-attempt.ts` pattern — both handlers return `{ error, migration }` with distinct migration pointers (POST → `/api/drills/submit-review`; GET → proactive question reservoir). Deleted the three orphaned service files (safely via `mv ~/.Trash/panacea-task010-retirement/` per CLAUDE.md) and `rmdir`'d the now-empty directory.
- **Verification:** Post-deletion `grep -rn 'reviewSubmissionService\|services/review/'` across `*.{ts,tsx,js,jsx}` returns zero importers. Audit script run: 189 mutation endpoints, 176 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, **2 FAIL** (`drill/log-attempt.ts` + `questions/review.ts` — both deliberate 410 tombstones, both expected). Tombstone uses the same `PagesFunction` ambient type as `log-attempt.ts`, matching established precedent (Cloudflare provides the type at deploy time).
- **Audit delta:** Unparks and closes the `/api/questions/review` half of the "Retire deprecated SRS endpoints" row. The `/api/srs/submit` half stays parked — it has an active caller (`SrsFlashcardView`) and narrowing requires a product decision on whether flashcard practice flips to the FSRS pipeline. Audit `audit:zod` FAIL count: 1 → 2, new steady state (tombstones intentionally don't validate request bodies).
- **Follow-ups:** Revisit the tombstone in ~2 release cycles — if zero production traffic lands on `/api/questions/review` in that window, the file can be deleted entirely and the resulting 404 is a safe steady state. Narrow `/api/srs/submit` + drop `SRSItem` model remain deferred.
- **Progress note:** `docs/implementation/progress/TASK-010.md`

### TASK-011 — Harden WARN_MANUAL_ONLY multipart endpoints + document Sentry-tunnel rationale
- **Date:** 2026-04-16
- **Status:** completed
- **Commits:** `acb0a0d5` (code) / `a15cfdd0` (docs)
- **Files touched:** `functions/api/knowledge/upload.ts`, `functions/api/technique-check/analyze.ts`. **Not modified:** `functions/api/sentry-tunnel.ts` (documented rationale in `AUDIT_RECONCILIATION.md`).
- **Change summary:** Tightened manual validation on the two multipart endpoints that appear in `WARN_MANUAL_ONLY` under the improved audit. `knowledge/upload.ts`: added a `415` content-type gate and `413` `Content-Length` short-circuit before `formData()` materializes up to 50 MB; retained the post-materialization `file.size` check as defense-in-depth; expanded JSDoc with a "Validation model" block. `technique-check/analyze.ts`: flipped wrong-content-type response from `400 → 415` and oversized-video response from `400 → 413` (proper HTTP semantics); inserted a `413` `Content-Length` short-circuit before `formData()` materializes up to 20 MB; added `MAX_QUERY_CHARS = 2000` to bound the `query` string and prevent pathologically long prompts reaching Gemini; expanded JSDoc. `sentry-tunnel.ts` left untouched — Sentry envelopes are a newline-delimited streaming format owned by Sentry's SDK, and the endpoint's existing DSN extraction + project-ID whitelist + per-IP in-memory rate limit IS the structurally correct validation surface. Documented this permanent `WARN_MANUAL_ONLY` steady state in `AUDIT_RECONCILIATION.md` so future audit passes don't re-queue it.
- **Verification:** Audit script run after both edits: 189 mutation endpoints, **176 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 2 FAIL** — unchanged, by design. The script classifies by code-shape (does a file use `withValidation` / a wrapper / `.safeParse()` / manual string checks?), not by validation depth; the hardening tightens manual validation inside the `WARN_MANUAL_ONLY` bucket without moving endpoints between buckets. Scoped typecheck against `--types @cloudflare/workers-types --strict --noUncheckedIndexedAccess` on both touched files: zero errors attributable to this task (pre-existing `process` errors surface from `_shared/auth.ts`, `_shared/env-validation.ts`, `_shared/prisma-edge.ts`, `_shared/secureLogger.ts` — unrelated transitive leaks). Caller contract check: `MyLibraryPage.tsx` (knowledge/upload) and `TechniqueCheckPage.tsx` (technique-check/analyze) both send compliant multipart bodies and reasonable query lengths; the new gates only fire on misrouted or adversarial traffic.
- **Audit delta:** Closes the `WARN_MANUAL_ONLY` multipart tail of §5 "API validation hardening" with proper HTTP semantics (415/413) and defense-in-depth ceilings. `sentry-tunnel.ts` reclassified from "latent hardening candidate" to "intentional steady state" — permanently valid `WARN_MANUAL_ONLY` by design. Audit top-line counts (176/8/3/2) unchanged.
- **Follow-ups:** None for this sprint. Optional future cleanups: (1) wire `MyLibraryPage.tsx`'s `uploadDisplayName` through to the server (currently hardcoded `display_name: 'library'` in the Gemini upload call); (2) revisit `MAX_QUERY_CHARS = 2000` if clinical-technique queries ever legitimately need longer prompts.
- **Progress note:** `docs/implementation/progress/TASK-011.md`
