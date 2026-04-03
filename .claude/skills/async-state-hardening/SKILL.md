---
name: async-state-hardening
description: "Audit and fix loading, error, empty, and offline state handling across PANaCEa React components. Use this skill whenever a component crashes on undefined data, shows a blank screen instead of a skeleton, swallows errors silently, flickers during transitions, or has no empty state — even if the user just says 'the page is blank' or 'it crashes when there's no data'. Also use when adding new data-fetching components or reviewing existing ones for resilience."
composed_from:
  - dashboard-trust
  - react-refactor
  - panacea-style-system
---

## Purpose
Every async boundary in PANaCEa must have explicit loading, error, empty, and offline states. This skill systematizes the audit and hardening of 562 components against undefined data crashes, silent failures, blank screens, and stale cache issues.

## Four Essential States (+ Offline)
Every data-dependent component must handle:
1. **Loading** — skeleton from `components/loading/` (SkeletonCard, SkeletonText, etc.) or react-query suspense boundary
2. **Error** — error boundary + user-facing message from `components/error/`, not silent console logs
3. **Empty** — contextual empty state (EmptyChartState pattern) or "no results" UI, never blank
4. **Success** — data rendered with framer-motion transitions (no unmount flicker)
5. **Offline** — syncManager check + cached fallback or graceful degradation

## Current Patterns in PANaCEa

**What Works:**
- `@tanstack/react-query`: isLoading, isError, data states baked in; staleTime/gcTime tunable
- `components/loading/` directory: reusable SkeletonCard, SkeletonText, SkeletonTable
- `EmptyChartState` pattern: conditional render when `data?.length === 0`
- Clerk auth: `useUser()` stable hook; race conditions rare if token provider injected
- syncManager: offline queue detection via `isOnline` check

**What's Inconsistent:**
- Ad-hoc empty states scattered across 55 directories (no DRY)
- Missing error boundaries on 20+ hook-heavy components (QueryClientProvider needs ErrorBoundary wrapper)
- Silent fetch failures: `.catch(() => {})` swallows stack traces
- Stale query cache after session end: no invalidation on `Clerk.signOut()`
- Framer-motion layout shift when loading → success (missing `layoutId`)
- No offline-first fallback in drill submission, progress sync

## Inspection Checklist
For any component using async data, verify:
```
[ ] const { data, isLoading, isError, error } = useQuery(...)
    OR const { status } = useQuery(...) // 'loading'|'error'|'success'
[ ] isLoading ? <SkeletonCard /> : ...
[ ] isError ? <ErrorAlert error={error} retry={refetch} /> : ...
[ ] status === 'success' && !data?.length ? <EmptyState /> : ...
[ ] <motion.div layoutId="..." /> wraps both skeleton and content
[ ] Query key includes session/userId to invalidate on auth change
[ ] syncManager.isOnline checked before high-stakes mutations
[ ] No `.catch(() => {})` without re-throw or fallback
[ ] Clerk token provider injected into QueryClientProvider
```

## Common Failure Modes
1. **undefined.map()** — Missing isLoading guard; use `data?.length > 0 ? map : empty`
2. **Recharts crash** — Null/undefined series; wrap in `{data?.length > 0 && <LineChart ... />}`
3. **Framer-motion flicker** — layoutId mismatch; ensure skeleton & success have same `key` and `layoutId`
4. **Stale cache after logout** — No `queryClient.clear()` in Clerk signOut callback
5. **Race condition on mount** — Token provider missing; add `useSyncManager(getToken)` pattern
6. **Silent fetch fail** — `.catch()` with no fallback; always log and bubble or retry
7. **Empty state not shown** — `status === 'success'` but forgot `!data?.length` check

## React-Query Enforcement
- **Suspense vs manual:** Suspense cleaner but needs `Suspense` + `ErrorBoundary` per route; manual isLoading safer for component tree
- **Preferred:** Manual `const { status, data, error, refetch }` with granular guards
- **staleTime:** 5min (300000ms) for non-critical; 1h for user profile; 0 for real-time drills
- **gcTime:** 10min default; increase to 30min for session data to avoid refetch on tab switch
- **Error boundaries:** One per major route; additional boundary on drill session + quiz view
- **Query invalidation:** On `sessionEnd`, `logoutSuccess`, or `userProfileUpdate`

## Files to Inspect First
1. `components/session/QuizView.tsx` (2274 lines) — main session; check for isLoading + error guards
2. `components/drill/DrillShell.tsx` (13 active drills) — verify each drill has error boundary + empty state
3. `lib/hooks/useDrillFSRS.ts` — query hook; ensure staleTime set and offline check present
4. `components/dashboard/*.tsx` — chart components crash on null data; wrap in conditional
5. `lib/hooks/*.ts` (91 custom hooks) — audit all useQuery/useMutation for missing error handlers
6. `components/progress/UserProgressChart.tsx` — EmptyChartState must render when no sessions
7. `functions/api/_shared/auth.ts` — verify token provider in QueryClientProvider context
8. `syncManager.ts` — check offline fallback path in drill + quiz submission

## Usage
Invoke this skill when:
- User reports blank screen, "no data" UI, or undefined crash
- Adding new data-fetching component (drill, dashboard, chart)
- Reviewing PR with async state changes
- Migrating component to react-query from useState
- Fixing stale cache or race condition bug
