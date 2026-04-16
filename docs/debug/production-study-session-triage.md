# Production Study/Simulation Incident Triage

Date: 2026-04-16
Repo: `/Users/aaronullger/GitHub/StudyPANaCEa`
Scope: study session bootstrap, simulation launch, signed-in user bootstrap APIs, and adjacent content/reference widgets.

## Summary

This incident is not a single bug. The current production failure pattern is best explained by a combination of:

1. Internal user ID vs Clerk ID mismatches in some edge endpoints.
2. Missing-user bootstrap paths that do not self-heal consistently.
3. Several timeout-prone endpoints doing too much work during initial app bootstrap.
4. A cascading frontend fallback chain that converts backend failures into a misleading "No questions available" state.
5. A few noncritical background requests firing without auth, which adds 401 noise during already-degraded startup.

The highest-priority repair path is:

1. Fix shared identity resolution for user-scoped endpoints.
2. Reduce timeout risk in bootstrap/session endpoints.
3. Make `/api/questions/session` return structured empty/degraded responses instead of opaque failures.
4. Prevent the client from hammering fallback APIs after the primary session path already failed.

## Endpoint Inventory

| Route | Handler | Auth | Main DB / service deps | Primary risk observed |
| --- | --- | --- | --- | --- |
| `/api/questions/session` | `functions/api/questions/session.ts` | `authenticatedEndpoint` | `User`, `SessionService`, `UserQuestionSeen`, `PreGeneratedQuestion`, `Question`, `QuestionSeed`, `MedicalContent` | Launch-critical; user lookup retry path plus multi-source session assembly |
| `/api/questions/pool` | `functions/api/questions/pool.ts` | `authenticatedEndpoint` | `User`, `UserQuestionSeen`, `PreGeneratedQuestion`, `Question`, `MedicalContent`, Gemini generation | Heavy seen-history + oversized pool fetch + generation fallback |
| `/api/user/stats` | `functions/api/user/stats.ts` | `authenticatedEndpoint` | `User`, `QuestionAttempt`, `ReviewLog`, `UserQuestionSeen` | Large multi-query aggregation on bootstrap |
| `/api/user/profile` | `functions/api/user/profile.ts` | `authenticatedEndpoint` | `User` | Simple route, but fails if user row missing or DB unhealthy |
| `/api/srs/due` | `functions/api/srs/due.ts` | `authenticatedEndpoint` | `User`, `SRSItem` | Should be cheap; currently safe-fails, but still depends on synced user row |
| `/api/sync` | `functions/api/sync.ts` | `authenticatedEndpoint` | `User`, `PerformanceRecord`, `SRSItem`, `SavedQuestion` | Large reads/writes; missing-user self-heal path is suspect |
| `/api/streaks/auto-freeze` | `functions/api/streaks/auto-freeze.ts` | `authenticatedEndpoint` | `UserPreferences`, `DailyStreak`, `StreakFreezeUse` | Uses `auth.userId` directly where internal `User.id` is required |
| `/api/user/rolling-360-stats` | `functions/api/user/rolling-360-stats.ts` | `authenticatedEndpoint` | `Rolling360Service`, `UserRolling360Stats` | Passes Clerk ID into service that expects internal user ID |
| `/api/content/systems` | `functions/api/content/systems.ts` | `authenticatedEndpoint` | `MedicalContent`, KV cache | Noncritical widget route should fail soft and be cheap |
| `/api/reference/scoring-systems` | `functions/api/reference/scoring-systems/index.ts` | `authenticatedEndpoint` | `ScoringSystem`, `ScoringSystemConditionLink`, `Condition` | Potentially expensive full-table fetch; not session-critical |
| `/api/analytics/session` | `functions/api/analytics/session.ts` | `authenticatedEndpoint` | `StudySession`, `SessionAnalytics`, `UserLearningProfile` | GET is used during bootstrap; should not block study workspace |
| `/api/labs/cases` | `functions/api/labs/cases.ts` | `authenticatedEndpoint` | `LabCase` | Noncritical preload is firing without token and creating 401 noise |

## Frontend Request Chain

### Session launch

1. `pages/SimulationPage.tsx`
   - User presses CTA.
   - `simulationStrict = true` is set for "All Topics" simulation.
2. `App.tsx`
   - `handleConfirmSession()` calls `services/core/mainSessionService.fetchSessionQuestions()`.
3. `services/core/mainSessionService.ts`
   - Primary path: GET `/api/questions/session?...`.
   - If that fails, it falls back to `fallbackQuestionFetch()`.
4. `fallbackQuestionFetch()`
   - Calls legacy `services/questionService.getQuestionBatch()`.
5. `services/questionService.ts`
   - Calls `/api/questions/pool`.
   - If pool is empty or fails, tries verified Gemini generation with per-question timeouts.
   - If that also fails, throws.
6. `App.tsx`
   - Any zero-question result becomes the generic message:
     `"No questions available for your selection. Try adjusting focus or try again later."`

### Bootstrap/background pressure around the study workspace

- `components/layout/AppLayout.tsx` -> `useStreakAutoFreeze()` -> `/api/streaks/auto-freeze`
- `hooks/useRolling360Stats.ts` -> `/api/user/rolling-360-stats`
- `hooks/useSRSItems.ts` -> `/api/srs/due`
- `hooks/useRecentSessions.ts` -> `/api/analytics/session?limit=100`
- `hooks/useDatabaseStats.ts` -> `/api/user/stats`
- `hooks/useUserProfile.ts` / direct `App.tsx` effects -> `/api/user/profile`
- `lib/utils/dataLoader.ts` preload -> `/api/labs/cases` without guaranteed auth token

This means the simulation page often loads while multiple independent user-scoped endpoints are already competing for the same auth + Prisma + DB resources.

## Root Causes vs Downstream Symptoms

### Root cause 1: Clerk ID / internal User.id mismatch

High confidence.

- `functions/api/streaks/auto-freeze.ts` queries `userPreferences`, `dailyStreak`, and `streakFreezeUse` with `auth.userId`.
- Those tables are keyed by internal `User.id`, not Clerk ID.
- Result: avoidable 500s / no-op failures during app bootstrap.

- `functions/api/user/rolling-360-stats.ts` calls:
  - `rolling360Service.getRolling360Stats(auth.userId, ...)`
- `lib/services/rolling360Service.ts` expects internal `userId` for `UserRolling360Stats`.
- Result: wrong-row lookup, empty/misleading response, or wasted DB work.

### Root cause 2: Missing-user bootstrap is brittle

High confidence.

- Many routes assume the `User` row already exists.
- `functions/api/sync.ts` is the only route trying to self-heal missing users.
- That self-heal path is a key suspect because it creates a placeholder user row on demand, while other bootstrap routes still return not-found or fail.
- When webhook sync is delayed or broken, signed-in bootstrap becomes inconsistent across endpoints.

### Root cause 3: Timeout-prone query shapes on startup routes

High confidence.

Important hotspots:

- `functions/api/user/stats.ts`
  - seven-way parallel aggregate + groupBy + 5,000-record recent attempt load.
- `functions/api/sync.ts`
  - large multi-table sync reads/writes with batch merging.
- `functions/api/questions/pool.ts`
  - loads up to 10,000 seen IDs, then fetches up to `count * 20` questions when no system filter.
- `functions/api/questions/pool-status.ts`
  - N+1-style per-system counts plus repeated user-seen lookups.
- `lib/services/session/sessionService.ts`
  - session launch loads seen history, pool count, then fans out across pool + seeds + main table per system.

These routes can individually be slow, and together they increase the chance of 524s during initial page load.

### Root cause 4: Session failure cascades into misleading empty-state UI

High confidence.

- The newer session route fails.
- The client falls back to the older pool/generation path.
- The older path also fails or times out.
- `App.tsx` collapses those distinct failure modes into a single empty-state string.

Result:

- "No questions available" is shown even when the true cause is auth failure, DB failure, or generation timeout.

### Root cause 5: Noncritical authless preload adds noise

Medium confidence.

- `lib/utils/dataLoader.ts` preloads `/api/labs/cases` without a guaranteed token.
- That endpoint requires auth.
- This creates background 401 noise during startup and makes incident diagnosis harder.

## Likely Failure Ownership by Symptom

### 401s

- Most likely authless or token-null client fetches.
- Clear example: `/api/labs/cases` preload.
- Also possible when hooks send `Authorization: Bearer null` or fetch before Clerk token is ready.

### 500s

- Most likely server exceptions from:
  - user ID mismatch,
  - missing user/preferences assumptions,
  - invalid placeholder-user fallback,
  - oversized query / Prisma Accelerate failures.

### 524s

- Most likely Cloudflare timing out while waiting on:
  - heavy DB aggregation,
  - repeated retries/fallbacks,
  - multi-source session assembly,
  - old pool + generation fallback after the primary session route already failed.

## Planned Fixes

1. Add shared internal-user resolution utilities and use them in the failing bootstrap/session routes.
2. Fix `auto-freeze` to use internal user IDs and fail soft when prefs are missing.
3. Fix `rolling-360-stats` to resolve internal user IDs before querying stats.
4. Tighten timeout-prone endpoints:
   - cap seen-history reads,
   - reduce oversized fetch multipliers,
   - short-circuit nonessential work,
   - avoid session launch blocking on noncritical analytics.
5. Make `/api/questions/session` return structured empty/degraded responses for:
   - empty strict simulation eligibility,
   - service unavailable,
   - internal error.
6. Make `mainSessionService` stop cascading into the legacy fallback on every upstream failure.
7. Improve client bootstrap behavior:
   - skip requests when token is unavailable,
   - add failure cooldowns / no-retry behavior for noncritical widgets,
   - keep partial dashboard/study workspace usable when one widget fails.
8. Add targeted logging for:
   - auth resolution,
   - internal user ID resolution,
   - session source counts,
   - empty strict simulation outcomes,
   - timeout-prone query branches.

## Success Criteria for the Fix Pass

- Study/simulation launch succeeds through `/api/questions/session`, or returns a typed, accurate empty/degraded state.
- `/api/streaks/auto-freeze`, `/api/user/rolling-360-stats`, `/api/user/profile`, `/api/user/stats`, `/api/srs/due`, and `/api/sync` no longer fail from obvious identity/bootstrap mismatches.
- Noncritical widget failures stop breaking the workspace.
- Background authless preload noise is reduced.
- Logs clearly distinguish auth failure, missing user bootstrap, empty pool, generation timeout, and DB timeout.
