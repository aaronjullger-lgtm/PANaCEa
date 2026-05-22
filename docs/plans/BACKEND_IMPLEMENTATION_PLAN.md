# Backend Implementation Plan

Current grade: **C / 72**. Target grade: **B+ / 87** before launch.

## Current Implementation Status

- Phase A goals identity fix: complete with direct route coverage.
- Phase B client envelope hardening: in progress. Core goals, session, calibration, study plan, analytics, drill, SRS variant, SOAP grading, condition-search, and smart condition clients now use the shared envelope helper.
- Phase B guardrail: `scripts/audit-api-envelope-callers.mjs` now inventories remaining direct internal API JSON callers.
- Verification blocker: dependency installation is currently incomplete; Vitest and full production typecheck are blocked until `node_modules` is restored.

## Phase A: Foundation Stabilization

- Fix `functions/api/user/goals.ts` to use internal `User.id`.
- Add `functions/api/user/goals/[goalId].ts`.
- Add route inventory check for frontend `/api/*` calls versus `functions/api`.
- Make gateway 429/503 use canonical `fail()` envelope.
- Mask auth user IDs in `functions/api/_shared/auth.ts`.

## Phase B: API Contract Hardening

- Continue `scripts/audit-api-envelope-callers.mjs` queue for admin, OSCE/specialty mode, reference/library, pearls/social/toolkit, and offline/sync callers.
- Normalize `dashboard/stats`, `user/stats`, `admin/stats`, and `study-path/accept` response shapes.
- Move endpoints toward `withEndpoint()` and shared schemas.
- Document raw exceptions for streaming, proxy, binary, and webhook ACKs only.

## Phase C: Database Integrity

- Add RLS policies for remaining user-owned tables.
- Add/verify indexes: `ReviewLog(userId, sessionId)`, `ReviewLog(userId, attemptId)`, `UserGoal(userId, status, targetDate)`, `Card(userId, progressContext, state, due)`, `AITokenUsage(userId, endpoint, createdAt)`.
- Decide whether `ReviewLog.questionId` remains a soft reference or migrates fully to `questionFkId`.

## Phase D: Core Learning Pipeline

- Define a canonical learning-event transaction: `QuestionAttempt`, `ReviewLog`, `UserProgress`, `UserTopicProgress`, `Card`, `UserStatistics`.
- Distinguish required scheduler writes from optional analytics; required failures must not return full success.
- Make duplicate suppression idempotency-key/session-aware.
- Add end-to-end persisted pipeline tests.

## Phase E: AI Backend Reliability

- Convert generation endpoints to `aiGateway.callStructured` with Zod schemas.
- Route direct Gemini paths through the gateway or mark as non-student-facing.
- Add verified-pool fallback for generation failures.
- Prevent placeholder/mock success responses in production.

## Phase F: Study Plan and Scheduling

- Choose one daily-plan service and deprecate the other.
- Align `READINESS`/`TARGETED` FSRS policy across allocator, due queue, session selector, and dashboard.
- Preserve targeted task `conditionIds`.
- Add missed-day recovery tests.

## Phase G: Analytics and Deployment

- Fix health contract or client expectation.
- Add env check to blocking CI/deploy.
- Replace preview KV placeholders in `wrangler.toml`.
- Move expensive dashboard aggregations into DB groupBy/materialized summaries where needed.

## Verification Checklist

- `npm run env:check:backend`
- Targeted Vitest for changed files.
- Targeted TypeScript transpile check for changed files.
- `npm run test:critical`
- `npm run build`
- Wrangler API smoke for health, user goals, session generation, submit review, study plan, dashboard.

## Rollback Plan

- Keep compatibility endpoints until callers are migrated.
- Gate risky behavior changes behind server-side feature flags where possible.
- For DB migrations, add indexes/policies additively before enforcing constraints.
- For learning-event atomicity, introduce degraded/failure states before removing old fallbacks.
