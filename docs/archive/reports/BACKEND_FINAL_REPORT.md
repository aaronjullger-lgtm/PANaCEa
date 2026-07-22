# Backend Final Report

Audit date: 2026-05-01

## Current State

PANaCEa’s backend is **partially production-ready**. The core Cloudflare Pages Function architecture is viable, and key flows such as session generation and drill review submission show serious production engineering. The backend is not yet cohesive enough for launch across the full learning pipeline.

## Final Grade

Overall: **C / 72**

## Highest-Risk Items

- User identity normalization is inconsistent across user-owned tables.
- Frontend calls several routes that do not exist in production.
- FSRS/progress writes are not atomic and can diverge.
- Study planning has two backend implementations.
- AI generation does not consistently use structured, schema-validated gateway calls.
- Deprecated/mock backend paths can return successful-looking results.
- E2E tests do not yet prove `session → attempts → FSRS → plan → dashboard`.

## Work Completed This Pass

The first implementation slice addressed the confirmed P0 around user goals:

- Normalized `/api/user/goals` to internal `User.id`.
- Added `/api/user/goals/[goalId]` for frontend update/delete calls.
- Ran targeted verification.

## Remaining Launch Criteria

- No missing frontend-called API routes.
- Canonical response envelope for all non-exception endpoints.
- Single documented FSRS write/read policy.
- Durable idempotency for every learning-event write.
- Structured AI generation contracts and invalid-question rejection.
- RLS policy coverage or documented service-role-only access for every user-owned table.
- Passing typecheck/build/test-critical plus API smoke against Cloudflare Pages runtime.
