# Backend Security and Reliability Audit

Audit date: 2026-05-01

Security grade: **C / 72**. Reliability grade: **C+ / 78**.

## P1 Security Findings

- `functions/api/user/goals.ts` used Clerk ID where internal `User.id` is required.
- RLS policies use Supabase `auth.uid()` semantics while production API uses Clerk + Prisma; actual DB role behavior must be documented and probed.
- RLS is incomplete for `Card`, `UserPreferences`, `UserGoal`, `DailyStudyPlan`, `SubmissionIdempotency`, `PushSubscription`, and other user-owned tables.
- `functions/api/_shared/auth.ts` logs full user identifiers on successful verification.
- Endpoint-level rate limiting can fail open when `RATE_LIMIT_KV` is missing.
- Several live endpoints return placeholder/mock data as successful production responses.

## P1 Reliability Findings

- Gateway rate-limit failures bypass the canonical response envelope.
- Multi-write FSRS pipeline can return success after partial downstream write failures.
- Duplicate suppression is time-window based and not session-aware unless idempotency is provided.
- Health endpoint contract disagrees with `hooks/useSystemStatus.ts`.
- Dashboard and SRS client paths have response-envelope mismatches.
- Prisma spans lack request correlation.

## Required Fixes

1. Normalize user identity through `resolveOrCreateUserRecord()` for every user-owned table.
2. Fail closed for production AI/admin rate limiting when KV is missing.
3. Mask user IDs in auth logs.
4. Create a durable learning-event write boundary and explicit degraded state.
5. Convert known raw/bespoke error paths to `ok()`/`fail()`.
6. Add RLS policies and staging probes for remaining user-owned tables.

## Verification Plan

- Unit tests for auth masking and missing-KV behavior.
- Endpoint tests for user-goal ownership and forbidden cross-user update/delete.
- Forced-failure tests for `submitDrillReview`.
- Gateway 429/503 envelope test.
- RLS probe script in staging with anon and service roles.
