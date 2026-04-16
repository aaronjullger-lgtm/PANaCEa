# TASK-007 — Zod-harden `POST /api/users/me/daily-plan/complete`

- **Status:** completed
- **Date:** 2026-04-16
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Category:** API validation hardening
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §5 "API validation hardening — 145 endpoints fail audit:zod"; §10 Quick win #2

## Verify-first block (Audit Interpreter)

Classification of the umbrella claim "~145 endpoints fail audit:zod": **stale** — driven by detection gaps in `scripts/audit-zod-validation.ts` (see `AUDIT_RECONCILIATION.md`). Classification of the specific file-level claim "`users/me/daily-plan.ts` POST lacks Zod": **accurate**.

Pre-edit read of `functions/api/users/me/daily-plan.ts` (HEAD) confirmed:

- `onRequestPost` used a raw `withMiddleware(withCors(), withErrorHandling(), withEnvCheck(...), withAuth(), withRateLimit({...}), withLogging(), handler)` chain with no `withValidation(schema)` stage.
- The handler destructured `accuracy` and `durationMinutes` from `await context.request.json()` with no runtime type checks — a malformed client payload could have written `null`, strings, or out-of-range numbers straight into `prisma.dailyStudyPlan.update`.
- `onRequestGet` has no body, so it is intentionally left using the existing middleware chain.

## Planned-code-changes block (Repo Mapper)

Before editing:

- Confirmed `authenticatedEndpoint` is exported from `functions/api/_shared/middleware.ts` and internally composes withCors → withErrorHandling → withEnvCheck → withAuth → withRateLimit → withValidation(schema) → withLogging around the handler.
- Confirmed the shared `ValidatedContext` exposes `context.validated.body`, matching the `z.object({ body: z.object({...}) })` body-wrapped convention used across the codebase.
- Confirmed `actualAccuracy` is stored as a 0..1 decimal and `actualDurationMinutes` as whole minutes, so the schema needs `z.number().min(0).max(1)` and `z.number().int().min(0).max(24*60)` respectively.

Planned changes:

1. Add `import { z } from 'zod'` and `authenticatedEndpoint` to the shared-middleware import set.
2. Declare `DailyPlanCompleteSchema = z.object({ body: z.object({ accuracy: z.number().min(0).max(1).optional(), durationMinutes: z.number().int().min(0).max(24*60).optional() }) })` and a `DailyPlanCompleteRequest` type alias.
3. Rewrite `onRequestPost` to `authenticatedEndpoint(DailyPlanCompleteSchema, handler, { requestsPerMinute: 30 })`, reading fields from `context.validated.body`.
4. Leave `onRequestGet` unchanged — no body, existing auth/rate-limit stack is already adequate.

## What was changed

- `functions/api/users/me/daily-plan.ts`:
  - Added `z` import and `authenticatedEndpoint` import.
  - Added `DailyPlanCompleteSchema` + `DailyPlanCompleteRequest` type alias.
  - Replaced `onRequestPost`'s raw `withMiddleware(...)` stack with `authenticatedEndpoint(DailyPlanCompleteSchema, handler, { requestsPerMinute: 30 })`.
  - Handler now reads `accuracy` / `durationMinutes` from `context.validated.body` instead of `await request.json()`.
  - Clamp ranges (accuracy 0..1, durationMinutes 0..1440) prevent malformed payloads from poisoning analytics.

## Verification

- Re-ran the fixed `scripts/audit-zod-validation.ts` — `users/me/daily-plan.ts` is no longer in the FAIL list.
- `grep -n 'authenticatedEndpoint' functions/api/users/me/daily-plan.ts` — wrapper is wired to the POST handler.
- `grep -n 'withMiddleware' functions/api/users/me/daily-plan.ts` — only the GET handler still uses it (no body).
- No other call sites reference `DailyPlanCompleteRequest`; the exported type is additive.

## Audit delta

- `UNFINISHED_WORK_MASTER_AUDIT.md` §5 specific claim on `users/me/daily-plan.ts` → **addressed-this-run**.
- Umbrella claim "145 endpoints fail audit:zod" → **stale**; see reconciliation entry.

## Follow-ups

- None in this sprint.
- If client usage expands (e.g., fractional minute counts), revisit the `z.number().int()` on `durationMinutes`.
