# Sprint 3 — Routing Correctness Report

## A. Route Architecture Summary

PANaCEa uses a **dual routing model**: React Router 6 handles page-level navigation for 15 routes, while an internal view-state system (`useAppNavigation` → `setView()`) manages 30+ training modes and tool views. The single source of truth is `config/routeRegistry.ts`, which contains all 60+ route definitions with metadata about whether each is a React Router route or a view-state route.

**Data flow:**
```
URL change → useAppNavigation watches location.pathname
  → isKnownPath() validates → getViewForPath() resolves view
  → React Router routes: handled by <Route> components
  → View-state routes: setView() triggers conditional rendering in AppRoutes.tsx
```

**Key files (in dependency order):**
1. `config/routeRegistry.ts` — Route definitions, `isKnownPath()`, `getViewForPath()`
2. `config/routes.ts` — Static `ROUTES` constant object for type-safe navigation
3. `config/training-modes.ts` — 26 training modes with routes (spread into registry)
4. `config/navigation.ts` — NavRail items, legacy `NAVIGATION_CONFIG`
5. `lib/constants/routes.ts` — Public API re-exports
6. `hooks/useAppNavigation.ts` — URL↔view synchronization + legacy redirects
7. `config/AppRoutes.tsx` — All `<Route>` elements + view-state conditional rendering

---

## B. Fixes Implemented (by priority)

### 1. Tightened `isKnownPath()` — False-Positive Prefix Matching (CRITICAL)

**Problem:** The old implementation looped over every registry entry and accepted any path that started with any registered path + `/`. This meant `/studyxyz` matched `/study`, `/admin/nonexistent` matched `/admin`, and essentially any path under a registered prefix passed validation — suppressing 404s.

**Fix:** Replaced the blanket prefix loop with a 3-tier strategy:
- **Exact match** against the full `KNOWN_PATHS` set (fast path)
- **Dynamic `/session/<id>`** — validates single-segment ID, rejects `/session/a/b`
- **Child-route matching** — only `/study/*` and `/admin/*` children are eligible, and only if a *specific registered child route* (e.g. `/study/knowledge`, `/admin/curation`) is an exact match or parent. The root prefixes themselves are excluded from the loop.

**Verified:** 26/26 test cases pass, including edge cases like `/study/nonexistent` → false, `/admin/nonexistent` → false, `/studyxyz` → false.

**File:** `config/routeRegistry.ts`

### 2. Deprecated Route Constants Replaced (HIGH)

**Problem:** `ROUTES.STUDY_REFERENCE` and `ROUTES.STUDY_TOOLKIT` pointed to legacy paths (`/study/reference`, `/study/toolkit`) that required a redirect hop through `useAppNavigation`. Five callsites in `AppRoutes.tsx` still used these deprecated constants.

**Fix:**
- Updated all 5 callsites to use `ROUTES.STUDY_KNOWLEDGE` / `ROUTES.STUDY_UTILITIES`
- Changed the deprecated constant values to point directly to canonical paths (`/study/knowledge`, `/study/utilities`) so any remaining consumers navigate correctly without a redirect
- Removed stale `@deprecated Not yet routed` comments from `LECTURE_CONVERTER` and `TECHNIQUE_CHECK` (they ARE routed)
- Added `/lecture-converter` and `/technique-check` to the route registry (they were missing)

**Files:** `config/routes.ts`, `config/AppRoutes.tsx`, `config/routeRegistry.ts`

### 3. AdminRoute Client-Side Guard (HIGH)

**Problem:** All 6 admin routes (`/admin`, `/admin/curation`, `/admin/refinery`, `/admin/taxonomies`, `/admin/system-mappings`, `/admin/question-generator`) rendered their page components directly in `<Route>` elements with zero client-side access control. While server-side APIs reject unauthorized calls, non-admin users could see the admin UI chrome, broken empty states, and error messages.

**Fix:** Created `components/auth/AdminRoute.tsx` — a route guard component that:
- Shows a loading state while Clerk auth resolves
- Redirects unauthenticated users to `/study`
- Shows a styled "403 — Access Denied" page for authenticated non-admins
- Uses `isAdmin()` from `lib/auth/rbac.ts` (respects role hierarchy: admin + superadmin)
- Wrapped all 6 admin route elements in `<AdminRoute>`

**File:** `components/auth/AdminRoute.tsx`, `config/AppRoutes.tsx`

### 4. Admin Nav UI Hidden from Non-Admins (HIGH)

**Problem:** The admin Shield icon/link appeared in two headers:
- `AppLayout.tsx` — guarded by `role === 'admin'` but missed `superadmin`
- `AppRoutes.tsx` catch-all route header — completely unguarded (visible to all users)

**Fix:**
- `AppLayout.tsx`: Broadened check to `role === 'admin' || role === 'superadmin'`
- `AppRoutes.tsx`: Added `useUser()` hook, computed `isUserAdmin`, wrapped Shield link in conditional

**Files:** `components/layout/AppLayout.tsx`, `config/AppRoutes.tsx`

### 5. Consolidated Duplicate Path Validation (MEDIUM)

**Problem:** Path validation was defined/re-exported in 4 places: `routeRegistry.isKnownPath`, `navigation.isKnownPath`, `lib/constants/routes.isKnownPath`, and `lib/constants/routes.isValidRoute`. The `navigation.ts` version also had a `getKnownPaths()` function using a runtime `require()` to break a circular dependency.

**Fix:**
- Eliminated the runtime `require()` in `navigation.ts` — training modes are already in the registry
- Marked `navigation.isKnownPath` and `navigation.getKnownPaths` as `@deprecated`
- Marked `NAVIGATION_CANONICAL_PATHS` re-export as `@deprecated`
- Canonical import path: `lib/constants/routes.ts` → delegates to `config/routeRegistry.ts`

**Files:** `config/navigation.ts`, `lib/constants/routes.ts`

### 6. Route Registry Completeness (MEDIUM)

**Problem:** `/lecture-converter` and `/technique-check` had `<Route>` entries in AppRoutes but were missing from `ROUTE_REGISTRY`, causing them to potentially fail `isKnownPath` checks.

**Fix:** Added both to the registry as React Router routes.

**File:** `config/routeRegistry.ts`

---

## C. Files Modified

| File | Changes |
|------|---------|
| `config/routeRegistry.ts` | Rewrote `isKnownPath()` and `getViewForPath()` with strict matching; added 2 missing routes |
| `config/routes.ts` | Updated deprecated constant values; cleaned stale comments |
| `config/AppRoutes.tsx` | Wrapped 6 admin routes in `<AdminRoute>`; guarded admin nav link; replaced 5 deprecated constant usages |
| `config/navigation.ts` | Removed `require()` circular dep hack; deprecated redundant exports |
| `lib/constants/routes.ts` | Deprecated `NAVIGATION_CANONICAL_PATHS` alias |
| `components/layout/AppLayout.tsx` | Fixed admin guard to include superadmin |
| `components/auth/AdminRoute.tsx` | **NEW** — Client-side admin route guard |
| `components/auth/index.ts` | Added AdminRoute export |

---

## D. Verification Matrix

| Scenario | Status |
|----------|--------|
| `/studyxyz` → 404 | ✅ `isKnownPath` returns false |
| `/admin/nonexistent` → 404 | ✅ No child route match |
| `/study/nonexistent` → 404 | ✅ No child route match |
| `/session/abc/extra` → 404 | ✅ Multi-segment rejected |
| `/study/knowledge` → works | ✅ Exact match |
| `/admin/curation` → works | ✅ Exact match |
| `/session/abc123` → works | ✅ Dynamic match |
| `/study/` (trailing slash) → works | ✅ Normalized |
| Deprecated `STUDY_REFERENCE` → `/study/knowledge` | ✅ Constant updated |
| Deprecated `STUDY_TOOLKIT` → `/study/utilities` | ✅ Constant updated |
| Admin routes guarded (non-admin) | ✅ AdminRoute shows 403 |
| Admin nav hidden (non-admin) | ✅ Conditional render |
| Training modes refresh-safe | ✅ All in registry with `includeIn404Check: true` |
| Legacy redirect `/study/reference` → `/study/knowledge` | ✅ useAppNavigation handles |

---

## E. Remaining Architectural Debt

### Should address in Sprint 4

1. **View-state → React Router migration.** Nine view-state routes (`/study/knowledge`, `/study/utilities`, `/study/path`, `/gap-analysis`, `/clinical-profile`, `/medical-database`, `/live-collaboration`, `/explorer`, `/menu`) are URL-backed but rendered via the view-state conditional block in AppRoutes.tsx rather than proper `<Route>` elements. Migrating them would simplify AppRoutes (currently 1336 lines) and eliminate the dual rendering path.

2. **Training modes as React Router routes.** All 26 training modes use view-state. The highest-traffic ones (core_adaptive, photo_drill, ecg_drill) should become proper `<Route>` entries for better code-splitting and simpler error boundaries.

3. **Extract ViewRenderer component.** The massive inline conditional block in AppRoutes.tsx (600+ lines of `{view === 'x' && <Component />}`) should be extracted to a dedicated `ViewRenderer` component.

4. **Remove `ROUTES.STUDY_REFERENCE` and `ROUTES.STUDY_TOOLKIT` entirely.** The deprecated constants now point to canonical paths, but they should be removed once all downstream components update their prop names (e.g. `onNavigateToReference` → `onNavigateToKnowledge`).

5. **AppRoutes prop explosion.** AppRoutes accepts 50+ props. This should be refactored to use context providers or a state management solution.

### Low priority / won't fix

6. **NAVIGATION_CONFIG legacy structure** — kept for backward compat, no active consumers found. Can be removed when confirmed unused.

7. **`matchesRoute()` in routes.ts** — uses the old prefix pattern. Not used in routing logic, only in UI highlight matching. Low risk.

### Where the hybrid router remains and why

The dual model (React Router + view-state) persists intentionally for training modes and drill sessions. These views share heavy state (session telemetry, FSRS data, question queues) through the App.tsx prop tree. Moving them to independent `<Route>` components would require lifting all shared state into context providers — a significant refactor that should be planned as a dedicated initiative, not squeezed into a routing correctness sprint.
