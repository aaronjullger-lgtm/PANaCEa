# TASK-008 — Zod-harden `POST /api/users/me/exam-outcome`

- **Status:** completed
- **Date:** 2026-04-16
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Category:** API validation hardening
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §5 "API validation hardening"; §10 Quick win #2

## Verify-first block (Audit Interpreter)

Classification: **accurate** for the file-level claim "`users/me/exam-outcome.ts` POST lacks Zod." Umbrella "145 endpoints" claim remains **stale** (see `AUDIT_RECONCILIATION.md`).

Pre-edit read of `functions/api/users/me/exam-outcome.ts` (HEAD) confirmed the handler:

- Used manual field-presence checks (`if (!examType || !examDate …) return 400`) with no schema-level range or enum validation.
- Accepted `score` as `any` — a malformed client could have pushed arbitrary strings, objects, or out-of-range numbers into `recordExamOutcome()`, polluting downstream exam-outcome analytics and system-predictiveness calibration.
- Had no bounds on `timeLimit`/`timeUsed`, allowing a client to inject absurd second counts (e.g., 10^9) into the analytics pipeline.

## Planned-code-changes block (Repo Mapper)

Before editing:

- Confirmed `recordExamOutcome` signature expects `{ examType, examDate, score, passed, percentile?, timeLimit?, timeUsed? }` — schema can mirror this 1:1.
- Confirmed `authenticatedEndpoint` wrapper is available from `_shared/middleware.ts` and already used in the neighbouring `users/me/daily-plan.ts` for the same validation model.
- Confirmed the Prisma `ExamOutcome` model stores `examType` as a string union — safe to pin via `z.enum(['PANCE','PANRE','EOR','block-exam'])`.

Planned changes:

1. Replace the entire handler with `authenticatedEndpoint(ExamOutcomeSchema, handler, { requestsPerMinute: 30 })`.
2. Declare `ExamOutcomeSchema = z.object({ body: z.object({ examType: z.enum([...]), examDate: z.string().refine(isValidDate), score: z.number().min(0).max(100), passed: z.boolean(), percentile: z.number().min(0).max(100).optional(), timeLimit: z.number().int().min(0).max(24*60*60).optional(), timeUsed: z.number().int().min(0).max(24*60*60).optional() }) })`.
3. Derive `ExamOutcomeRequest` type alias from the schema for any downstream consumers.
4. Read fields from `context.validated.body` and pass straight to `recordExamOutcome`.

## What was changed

- `functions/api/users/me/exam-outcome.ts`:
  - Full rewrite using `authenticatedEndpoint(ExamOutcomeSchema, handler, { requestsPerMinute: 30 })`.
  - Added `ExamOutcomeSchema` covering enum, date-refine, percent bounds, and 24-hour max on time fields.
  - Added `ExamOutcomeRequest` type export derived from the schema.
  - Handler logic — Clerk-ID → internal-ID lookup, `new Date(examDate)`, `recordExamOutcome(user.id, …)` — is unchanged semantically; only its input path is now validated.

## Verification

- Re-ran the fixed `scripts/audit-zod-validation.ts` — `users/me/exam-outcome.ts` no longer appears under FAIL (or any other bucket).
- `grep -n 'authenticatedEndpoint' functions/api/users/me/exam-outcome.ts` — wrapper correctly wired.
- `grep -n 'if (!examType' functions/api/users/me/exam-outcome.ts` — old manual checks are gone.
- No callers import `ExamOutcomeRequest` today; the new type alias is additive and non-breaking.

## Audit delta

- `UNFINISHED_WORK_MASTER_AUDIT.md` §5 specific claim on `users/me/exam-outcome.ts` → **addressed-this-run**.
- Umbrella claim "145 endpoints fail audit:zod" → **stale**; see reconciliation entry.

## Follow-ups

- None in this sprint.
- If PA programs introduce additional exam categories (e.g., `NCSBN-mock`), extend the `examType` enum in lock-step with the underlying Prisma column.
