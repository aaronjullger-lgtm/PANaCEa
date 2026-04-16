# Production Study/Simulation Incident Fix Summary

Date: 2026-04-16
Repo: `/Users/aaronullger/GitHub/StudyPANaCEa`
Scope: study session launch, signed-in bootstrap endpoints, simulation strict mode, and adjacent noncritical study workspace widgets.

## Root Causes

1. Internal `User.id` and Clerk `auth.userId` were used interchangeably in several user-scoped edge routes.
2. Signed-in bootstrap depended on a preexisting `User` row, but only some routes attempted to self-heal a missing user record.
3. Several startup endpoints performed oversized reads or repeated per-system queries, increasing Cloudflare 524 risk during page bootstrap.
4. Session launch degraded through multiple failing fallback paths and the client collapsed those failures into a misleading "No questions available" state.
5. Some noncritical authenticated background fetches were fired without a ready token, adding 401 noise and extra startup pressure.

## Fixes Applied

### Shared auth and user bootstrap hardening

- Added shared user resolution helpers in `functions/api/_shared/user-resolver.ts`:
  - `resolveUserRecord`
  - `resolveOrCreateUserRecord`
  - `resolveOrCreateUserId`
- Standardized the following routes onto shared internal-user resolution and placeholder-user bootstrap:
  - `functions/api/sync.ts`
  - `functions/api/user/profile.ts`
  - `functions/api/user/stats.ts`
  - `functions/api/srs/due.ts`
  - `functions/api/analytics/session.ts`
  - `functions/api/questions/session.ts`
  - `functions/api/questions/pool.ts`
- Fixed direct Clerk-ID misuse in:
  - `functions/api/streaks/auto-freeze.ts`
  - `functions/api/user/rolling-360-stats.ts`

### Timeout and startup-load reduction

- Reduced oversized seen-history reads in:
  - `functions/api/questions/pool.ts`
  - `lib/services/session/sessionService.ts`
- Reworked `functions/api/questions/pool-status.ts` to avoid repeated per-system count queries and repeated seen-history fetches.
- Reduced fallback aggregation load in `functions/api/user/stats.ts`.
- Trimmed the reference index response in `functions/api/reference/scoring-systems/index.ts` to return summary fields only with an explicit cap.

### Session launch resilience

- `functions/api/questions/session.ts`
  - now returns structured empty-state responses when strict simulation has no eligible questions
  - logs zero-question outcomes instead of falling through as opaque failures
- `services/core/mainSessionService.ts`
  - preserves structured backend error messages
  - stops strict simulation from automatically cascading into the legacy pool/generation fallback when the primary session service is unavailable
  - returns a typed degraded response for strict simulation service outages
- `App.tsx`
  - now surfaces structured empty/degraded session messages instead of always rendering the generic no-questions string

### Noncritical widget and preload hardening

- Changed noncritical catalog endpoints to public access so study bootstrap is not blocked by auth timing:
  - `functions/api/content/systems.ts`
  - `functions/api/reference/scoring-systems/index.ts`
- Prevented authless preload noise:
  - `lib/utils/dataLoader.ts` now skips lab-case preload without a usable token
  - `services/questionService.ts` now skips pool fetch when no token is available
- Hardened client hooks to fail soft and stop hammering degraded endpoints:
  - `hooks/useRolling360Stats.ts`
  - `hooks/useRecentSessions.ts`
  - `hooks/useSRSItems.ts`

### Route correctness cleanup

- Fixed `functions/api/labs/cases.ts` route schema wiring so the authenticated handler signature is valid.

## Expected Outcome After These Changes

- Study bootstrap no longer depends on every signed-in widget succeeding at once.
- Strict simulation launch now either:
  - returns questions successfully, or
  - returns a structured empty/degraded state with an accurate message.
- Missing `User` rows no longer cause avoidable bootstrap breakage across profile, stats, sync, SRS, analytics, and session routes.
- Startup endpoints do less work and should be materially less likely to hit 524 during initial page load.
- Background 401 noise from tokenless preloads is reduced.

## Remaining Risks

1. `functions/api/sync.ts` and `functions/api/user/stats.ts` are still heavier than ideal and may need deeper query/index optimization if production latency remains high under load.
2. Placeholder-user creation keeps bootstrap alive, but downstream systems that expect fully populated user metadata may still need follow-up hardening.
3. If Prisma Accelerate, Neon, or another upstream DB dependency is intermittently unhealthy, some routes may still degrade even with the lighter query shapes.
4. Verified generation fallback remains a slower secondary path for non-strict flows and should still be monitored for timeout frequency.

## Recommended Follow-Up Instrumentation

1. Add route-level timing logs for:
   - auth resolution
   - user bootstrap resolution
   - DB query duration
   - total handler duration
2. Add structured session launch logs for:
   - requested mode and strict flag
   - eligible question counts by source
   - empty-state code
   - fallback activation
3. Add explicit error taxonomy tags to API responses and logs:
   - `unauthorized`
   - `missing_user_bootstrapped`
   - `empty_pool`
   - `generation_timeout`
   - `upstream_timeout`
   - `internal_error`
4. Add alerting on repeated 524s for:
   - `/api/questions/session`
   - `/api/questions/pool`
   - `/api/sync`
   - `/api/user/stats`
5. Capture a lightweight study-bootstrap diagnostic event from the client with per-endpoint success/failure and elapsed time so incident triage does not rely on raw browser console output.

## Verification

- Targeted TypeScript transpile checks passed for all edited runtime files.
- Targeted TypeScript transpile checks passed for updated tests.
- `npx vitest run functions/api/user/profile.test.ts functions/api/srs/due.test.ts functions/api/sync.test.ts`
  - Result: 52 tests passed, 0 failed.

## Files Added

- `docs/debug/production-study-session-triage.md`
- `docs/debug/production-study-session-fix-summary.md`
