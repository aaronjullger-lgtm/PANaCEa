# Audit 3: Routing, Route Guards, Navigation State & Authenticated Redirects

**Auditor:** Claude (Senior Full-Stack Engineer role)
**Date:** 2026-04-01
**Scope:** Router config, route registry/constants, path guards, auth redirects, protected routes, unknown-path handling, sidebar/nav link generation, lazy-loaded route boundaries, path validation logic

---

## Architecture Overview: Dual Routing System

PANaCEa uses a **hybrid routing model** that mixes React Router `<Route>` components with an internal `view` state machine. This is the most significant architectural characteristic of the routing system and is the root cause of several findings.

```
URL change (e.g., /modes/ecg-drill)
  ├─ React Router: matches path="*" catch-all → renders full shell
  └─ useAppNavigation hook:
       ├─ isValidRoute(path) → checks routeRegistry
       ├─ getViewForPath(path) → returns 'ecg_drill'
       └─ setView('ecg_drill') → DrillViewRouter renders ECGDrillSession
```

**React Router routes** (explicit `<Route path=...>` in AppRoutes.tsx): `/practice`, `/progress`, `/daily-challenges`, `/admin`, `/admin/*`, `/clinical-eye`, `/visualizer`

**View-state routes** (matched via `path="*"` catch-all → `useAppNavigation` → `setView`): `/study`, `/study/knowledge`, `/study/utilities`, `/study/path`, `/modes/*`, `/menu`, `/gap-analysis`, `/clinical-profile`, `/explorer`, `/medical-database`, `/live-collaboration`, plus ~30 training mode routes

---

## Route Map: Major User-Visible Routes

| URL Path | Routing Method | View State | Component | Auth Required |
|----------|---------------|------------|-----------|---------------|
| `/` | App.tsx gate | — | LandingPage (unauth) | No |
| `/study` | RR + view-state | `command_center` | CommandCenterHub | Yes (Clerk) |
| `/practice` | React Router | — | PracticePage | Yes |
| `/progress` | React Router | — | ProgressPage | Yes |
| `/daily-challenges` | React Router | — | DailyChallengesHub | Yes |
| `/study/knowledge` | View-state | `reference_library` | KnowledgeBaseHub | Yes |
| `/study/utilities` | View-state | `toolkit` | ToolkitHub | Yes |
| `/study/path` | View-state | `study_path_dashboard` | StudyPathDashboard | Yes |
| `/admin` | React Router | — | AdminDashboard | Yes (client-side UI only) |
| `/admin/curation` | React Router | — | QuestionCurationPanel | Yes (client-side) |
| `/admin/refinery` | React Router | — | RefineryPage | Yes (client-side) |
| `/admin/taxonomies` | React Router | — | TaxonomiesPage | Yes (client-side) |
| `/admin/system-mappings` | React Router | — | SystemMappingsPage | Yes (client-side) |
| `/admin/question-generator` | React Router | — | QuestionGeneratorPage | Yes (client-side) |
| `/clinical-eye` | React Router | — | ClinicalEyePage | Yes |
| `/visualizer` | React Router | — | VisualizerPage | Yes |
| `/core-adaptive` | View-state | `core_adaptive` | CoreAdaptiveSession | Yes |
| `/modes/ecg-drill` | View-state | `ecg_drill` | ECGDrillSession | Yes |
| `/modes/derm-drill` | View-state | `derm_drill` | DermDrillSession | Yes |
| `/modes/patient-encounter` | View-state | `patient_encounter` | PatientEncounterMode | Yes |
| `/modes/grand-rounds` | View-state | `grand_rounds` | GrandRoundsMode | Yes |
| (30+ more modes) | View-state | (per mode) | (per mode) | Yes |
| `/study/reference` | Legacy redirect | → `/study/knowledge` | — | — |
| `/study/toolkit` | Legacy redirect | → `/study/utilities` | — | — |
| `/study/main-session` | Legacy redirect | → `/study` | — | — |

### Routes with NO URL (view-only, no deep link):
| View State | Component | Reachable Via |
|------------|-----------|---------------|
| `cram_mode` | CramMode | `handleNavigateToDrillMode('cram_mode')` only |
| `medical_wordle` | MedicalWordleMode | `handleNavigateToDrillMode('medical_wordle')` only |
| `admin_media` | MediaApproval | `setView('admin_media')` only |

---

## Findings

### Finding 1: `isKnownPath` prefix matching allows any sub-path — suppresses 404s
- **Severity:** HIGH
- **Type:** Correctness
- **Files:** `config/routeRegistry.ts` (lines 107–109)
- **Root Cause:** The `isKnownPath` function uses greedy prefix matching:
  ```ts
  for (const route of ROUTE_REGISTRY) {
    if (path.startsWith(route.path + '/') || path === route.path) {
      return true;
    }
  }
  ```
  This means `/study/anything/garbage` matches `/study`, `/admin/nonexistent` matches `/admin`, and `/modes/ecg-drill/extra/segments` matches `/modes/ecg-drill`. ALL of these return `true`, preventing 404 detection.
- **User Impact:** Visiting `studypanacea.com/study/xyzzy` silently renders the dashboard with a wrong URL instead of showing a 404. Search engine crawlers can index infinite path variations. Users who typo a URL never see an error.
- **The same flaw exists in `getViewForPath`** (lines 128-133): it returns the parent route's view for any sub-path, so `/study/garbage` maps to `command_center`.
- **Recommended Fix:** Change prefix matching to only match routes that are explicitly marked as having sub-routes (e.g., `/admin/*` is legitimate). For leaf routes, require exact match only. Or add a `hasSubRoutes` flag to `RouteDefinition`.
- **Blocks Production:** Yes — allows URL spoofing and defeats 404 detection.

### Finding 2: `ROUTES.STUDY_TOOLKIT` and `ROUTES.STUDY_REFERENCE` used in active code despite being deprecated
- **Severity:** HIGH
- **Type:** Correctness / UX
- **Files:** `config/AppRoutes.tsx` (lines 669, 679, 742, 1005, 1012), `config/routes.ts` (lines 26, 28)
- **Root Cause:** Five navigation callbacks in AppRoutes.tsx use `ROUTES.STUDY_TOOLKIT` (`/study/toolkit`) and `ROUTES.STUDY_REFERENCE` (`/study/reference`). Both are marked `@deprecated` in routes.ts. When triggered, `navigate('/study/toolkit')` fires, React Router updates the URL, then `useAppNavigation` detects the deprecated path and fires a second `navigate('/study/utilities', { replace: true })`.
- **User Impact:** Double navigation on every click of "Navigate to Toolkit" or "Navigate to Reference" from CommandCenterHub, MenuView, and CommandCenterPage. The URL bar briefly flashes the old path before redirecting. This can cause React state tearing (view state and URL out of sync for one render cycle) and a visible browser history entry for the deprecated path.
- **Affected callbacks:**
  - `CommandCenterHub.onNavigateToToolkit` (line 669)
  - `CommandCenterHub.onNavigateToReference` (line 679)
  - `MenuView.onNavigateToToolkit` (line 742)
  - `CommandCenterPage.onNavigateToToolkit` (line 1005)
  - `CommandCenterPage.onNavigateToReference` (line 1012)
- **Recommended Fix:** Replace all five occurrences with `navigate(ROUTES.STUDY_UTILITIES)` and `navigate(ROUTES.STUDY_KNOWLEDGE)` respectively. Then delete the deprecated constants from routes.ts.
- **Blocks Production:** No, but causes visible URL flicker and unnecessary redirect overhead.

### Finding 3: `cram_mode` and `medical_wordle` have no route — unlinked and unrecoverable
- **Severity:** MEDIUM
- **Type:** Correctness / UX
- **Files:** `config/training-modes.ts` (TRAINING_MODES array), `components/layout/DrillViewRouter.tsx` (lines 384–442), `App.tsx` (lines 913, 916)
- **Root Cause:** Both `cram_mode` and `medical_wordle` exist as `View` values and have render blocks in DrillViewRouter, but they have **no entry in TRAINING_MODES** and therefore no `route` property. They are not in the ROUTE_REGISTRY. They can only be entered via the fallback `modeViewMap` in `handleNavigateToDrillMode`, which calls `setView()` without updating the URL.
- **User Impact:** If a user enters Cram Mode or Medical Wordle:
  - The URL stays at `/study` (or wherever they were)
  - Refreshing the page returns them to the dashboard, losing their drill session
  - The drill cannot be bookmarked or shared
  - Back button behavior is unpredictable (URL didn't change, so browser back exits the app)
- **Recommended Fix:** Add TRAINING_MODES entries for both:
  ```ts
  { id: 'cram_mode', label: 'Cram Mode', route: '/modes/cram-mode', ... }
  { id: 'medical_wordle', label: 'Medical Wordle', route: '/modes/medical-wordle', ... }
  ```
- **Blocks Production:** No (modes are reachable), but poor UX and refresh-loss is user-hostile.

### Finding 4: Admin routes have NO client-side route guard
- **Severity:** MEDIUM
- **Type:** Security / UX
- **Files:** `config/AppRoutes.tsx` (lines 312–370), `pages/admin/AdminDashboard.tsx`
- **Root Cause:** All six `/admin/*` routes render their components directly inside `<Suspense>` + `<ErrorBoundary>` with no route guard or role check. Any authenticated user can navigate to `/admin` and see the admin dashboard. The AdminDashboard component itself does client-side role checking (as noted in its header comment: "Client-side access checks in this component are for UI/UX purposes only"), and the API endpoints use `requireAdmin()` middleware for actual security. However, the route itself is unguarded.
- **User Impact:** Non-admin users can navigate to `/admin` and see the admin UI shell (though API calls will fail). This creates a confusing experience where the admin page loads but data fails to populate. The admin link in the header (`<Link to={ROUTES.ADMIN}>`) is visible to ALL authenticated users.
- **Recommended Fix:** Create a `<ProtectedRoute requiredRole="admin">` wrapper component that checks the user's role and redirects non-admins to `/study`. Apply it to all `/admin/*` routes. Also conditionally render the admin Shield icon in the header based on role.
- **Blocks Production:** No (server-side security is in place), but it's a confusing UX and reveals admin surface area to regular users.

### Finding 5: `MODES_WITH_DEDICATED_ROUTES` has wrong filter logic
- **Severity:** MEDIUM
- **Type:** Correctness
- **Files:** `config/training-modes.ts` (lines 553–555)
- **Root Cause:** The filter is:
  ```ts
  export const MODES_WITH_DEDICATED_ROUTES: TrainingModeId[] = MODE_REGISTRY.filter(
    (m) => m.route !== 'core_adaptive'
  ).map((m) => m.id);
  ```
  This compares `m.route` (a URL path like `/core-adaptive`, `/modes/ecg-drill`) against the string `'core_adaptive'`. Since NO mode has `route === 'core_adaptive'` (core_adaptive's route is `/core-adaptive`), the filter excludes nothing — every mode passes. The intent was to exclude `core_adaptive` from the list but the comparison uses the wrong field. It should be `m.id !== 'core_adaptive'`.
- **User Impact:** `MODES_WITH_DEDICATED_ROUTES` includes `core_adaptive` when it shouldn't. This array is used by `TrainingMenu` and `use-training-actions` to decide which modes have dedicated route navigation vs. view-state navigation. With core_adaptive incorrectly included, the training menu may route to `/core-adaptive` when it should use a different code path.
- **Recommended Fix:** Change to `m.id !== 'core_adaptive'` to match the intent.
- **Blocks Production:** Unlikely (core_adaptive's route `/core-adaptive` does exist and works), but the logic is wrong and could cause subtle misrouting.

### Finding 6: Three separate route definition locations create drift risk
- **Severity:** MEDIUM
- **Type:** Architecture / Maintainability
- **Files:** `config/routes.ts`, `config/routeRegistry.ts`, `lib/constants/routes.ts`
- **Root Cause:** Route paths are defined in THREE places:
  1. **`config/routes.ts`** — `ROUTES` object with static string paths (used for `navigate(ROUTES.STUDY)`)
  2. **`config/routeRegistry.ts`** — `ROUTE_REGISTRY` array with `RouteDefinition` objects (used for 404 detection, view mapping)
  3. **`lib/constants/routes.ts`** — `ROUTES_STATIC` object (another copy) plus re-exports from both above files

  Additionally, `config/navigation.ts` has `NAV_RAIL_ITEMS` with hardcoded paths, and `config/training-modes.ts` has `route` fields per mode.

  There are already drift instances:
  - `ROUTES` has `CROSS_SYSTEM_EXPLORER: '/explorer'` but `ROUTE_REGISTRY` has it as a view-state route at `/explorer`
  - `ROUTES` has `MENU: '/menu'` but there's no React Router `<Route path="/menu">` — it's a view-state route
  - `ROUTES_STATIC` is missing `ADMIN_REFINERY`, `ADMIN_TAXONOMIES`, `ADMIN_SYSTEM_MAPPINGS`, `ADMIN_QUESTION_GENERATOR` which exist in both `ROUTES` (partially) and `ROUTE_REGISTRY`
  - `ROUTES` has `CORE_ADAPTIVE: '/core-adaptive'` but this path is NOT a React Router route — it's resolved via `path="*"` → view-state

- **Recommended Fix:** Delete `config/routes.ts` and `lib/constants/routes.ts` ROUTES_STATIC. Derive the `ROUTES` object from `ROUTE_REGISTRY.map(r => [r.label.toUpperCase(), r.path])` so there's truly one source.
- **Blocks Production:** No, but every new route added is a regression risk.

### Finding 7: `navigation.ts` `getKnownPaths()` uses `require()` for circular dependency avoidance
- **Severity:** LOW
- **Type:** Architecture / Build Risk
- **Files:** `config/navigation.ts` (lines 239–250)
- **Root Cause:**
  ```ts
  export const getKnownPaths = (): string[] => {
    const { TRAINING_MODES } = require('./training-modes');
    // ...
  }
  ```
  Using CommonJS `require()` inside an ESM file works in Vite dev mode but is fragile in production builds. If Vite's tree-shaking or Cloudflare's bundler eliminates the CJS compatibility shim, this call will fail at runtime.
- **Mitigation:** The function is marked `@deprecated` and the `isKnownPath` import at line 2 uses proper ESM imports. However, `getKnownPaths` is still exported and could be called.
- **User Impact:** If called in production with a broken CJS shim, would throw `require is not defined`, crashing route validation.
- **Recommended Fix:** Remove `getKnownPaths` entirely (it's deprecated) or convert to a lazy ESM import.
- **Blocks Production:** No (function is deprecated and unlikely called), but a latent runtime bomb.

### Finding 8: View-state navigation doesn't update the URL for many views
- **Severity:** MEDIUM
- **Type:** UX / Architecture
- **Files:** `config/AppRoutes.tsx` (lines 849–1188), `App.tsx` `handleNavigateToDrillMode`
- **Root Cause:** Many view-state transitions use `setView('gap_analysis')`, `setView('clinical_profile')`, `setView('training_menu')`, `setView('simulation_page')`, `setView('tutor_chat')`, `setView('study_companion')`, `setView('srs_review')`, `setView('custom_study')`, `setView('my_library')`, `setView('pearl_deck')` WITHOUT calling `navigate()` to update the URL. The URL stays at whatever it was before (usually `/study`).
- **User Impact:** For ALL of these views:
  - Refreshing the page returns to the dashboard, losing context
  - Browser back button doesn't work (URL didn't change)
  - Can't bookmark or share a direct link to the view
  - Analytics/monitoring can't distinguish which view the user is on
- **Recommended Fix:** For each view-state view, add a corresponding URL path and call `navigate()` alongside `setView()`. This is the migration described in routeRegistry.ts line 45: "these need to be migrated to React Router."
- **Blocks Production:** No, but significantly degrades navigation UX for these features.

### Finding 9: `path="*"` catch-all route renders the ENTIRE app shell for unknown paths
- **Severity:** MEDIUM
- **Type:** UX / Performance
- **Files:** `config/AppRoutes.tsx` (lines 391–1309)
- **Root Cause:** The `path="*"` route handles BOTH the 404 case (`showNotFound` = true → renders `<NotFoundPage>`) AND the entire authenticated app shell (header, NavRail, main content area with all view-state components). This means:
  1. Every view-state route (30+ drill modes, all dashboard views) renders inside this catch-all
  2. The catch-all fragment contains ~900 lines of JSX including all modals, the onboarding flow, the command palette, and the product tour
  3. React Router has no way to optimize rendering because everything is one giant catch-all
- **User Impact:** No direct user-facing bug, but this architecture means React Router's built-in code-splitting and route-level lazy loading can't be leveraged. All view-state components are always in the bundle decision tree even when they're not needed.
- **Recommended Fix:** Gradually migrate view-state routes to proper `<Route>` components. Start with the highest-traffic ones: `/study/knowledge`, `/study/utilities`, `/study/path`.
- **Blocks Production:** No.

### Finding 10: `handleNavigateToDrillMode` has a redundant fallback map duplicating TRAINING_MODES
- **Severity:** LOW
- **Type:** Maintainability
- **Files:** `App.tsx` (lines 878–923)
- **Root Cause:** `handleNavigateToDrillMode` first checks `TRAINING_MODES.find(m => m.id === modeId)` for a route, then falls through to a hardcoded `modeViewMap` with ~30 entries mapping mode IDs to view names. This map duplicates information that's already in the View type and TRAINING_MODES config. When a new mode is added to TRAINING_MODES with a route, it works via the first branch. The fallback map only catches modes WITHOUT routes (cram_mode, medical_wordle, admin_media, toolkit).
- **User Impact:** None directly, but adding a new drill mode requires updating BOTH TRAINING_MODES and the fallback map if the mode doesn't have a route. Missing one silently fails (the mode can't be navigated to).
- **Recommended Fix:** Reduce the fallback map to ONLY the exceptions (modes without routes). Add a warning log if a mode ID isn't found in either path.
- **Blocks Production:** No.

### Finding 11: NavRail `isPathActive` can't match view-state routes
- **Severity:** LOW
- **Type:** UX
- **Files:** `components/layout/NavRail.tsx` (BottomTabBar and desktop renderItem)
- **Root Cause:** The NavRail items include `/study/knowledge` (view-state) and `/study/utilities` (view-state). The `isPathActive` function compares against `pathname`, but when the user is viewing the Knowledge Base, the URL is `/study/knowledge` (set by useAppNavigation redirect) — so this actually works for the nav items that have URL-backed paths. However, for views that DON'T update the URL (Finding 8), the nav indicator can't possibly highlight correctly. If a user is in `tutor_chat` view, the URL is still `/study`, so "Home" stays highlighted.
- **User Impact:** Nav rail shows "Home" as active when the user is in tutor_chat, study_companion, srs_review, gap_analysis, etc. Confusing wayfinding.
- **Recommended Fix:** Fixing Finding 8 (URL for all views) would automatically fix this.
- **Blocks Production:** No.

### Finding 12: `pageTransition` prop type is `object` — loses type safety
- **Severity:** LOW
- **Type:** Maintainability
- **Files:** `config/AppRoutes.tsx` (line 174: `pageTransition: object`)
- **Root Cause:** The `pageTransition` prop is typed as bare `object` instead of Framer Motion's `Transition` type. This means any object is accepted with no compile-time validation.
- **User Impact:** None directly. But if App.tsx passes an invalid transition config, it won't be caught at build time.
- **Recommended Fix:** Type as `import('framer-motion').Transition`.
- **Blocks Production:** No.

---

## Path Inconsistencies: "Defined in One Place, Hardcoded in Another"

| Path | Defined In | Also Hardcoded In | Issue |
|------|-----------|-------------------|-------|
| `/study/toolkit` | `ROUTES.STUDY_TOOLKIT` (deprecated) | `AppRoutes.tsx` lines 669, 742, 1005 | Active code uses deprecated route → double-redirect |
| `/study/reference` | `ROUTES.STUDY_REFERENCE` (deprecated) | `AppRoutes.tsx` lines 679, 1012 | Active code uses deprecated route → double-redirect |
| `/study` | `ROUTES.STUDY` | `AppRoutes.tsx` line 562 (`navigate('/study')`) | Hardcoded string instead of constant |
| `/study?tab=analytics` | `NAVIGATION_CONFIG` | nowhere in routes/registry | URL with query param, not in route registry |
| `/medical-database` | `ROUTE_REGISTRY` | `NAVIGATION_CONFIG` | In registry but no nav rail item |
| `/live-collaboration` | `ROUTE_REGISTRY` | `NAVIGATION_CONFIG` | In registry but no nav rail item |
| `/modes/*` (30 routes) | `TRAINING_MODES[].route` | `ROUTE_REGISTRY` via spread | Correctly derived, no drift |

---

## Top 10 Findings (Priority Order)

1. **[HIGH]** `isKnownPath` prefix matching suppresses 404s for invalid sub-paths (Finding 1)
2. **[HIGH]** Deprecated `ROUTES.STUDY_TOOLKIT` / `STUDY_REFERENCE` used in 5 active callbacks → double-redirect (Finding 2)
3. **[MEDIUM]** `cram_mode` and `medical_wordle` have no URL route — refresh loses session (Finding 3)
4. **[MEDIUM]** Admin routes have no client-side route guard — any user sees admin UI (Finding 4)
5. **[MEDIUM]** `MODES_WITH_DEDICATED_ROUTES` has wrong filter (`m.route` vs `m.id`) (Finding 5)
6. **[MEDIUM]** 10+ view-state views don't update URL — can't bookmark, refresh, or use back button (Finding 8)
7. **[MEDIUM]** Triple route definition (routes.ts, routeRegistry.ts, constants/routes.ts) creates drift (Finding 6)
8. **[MEDIUM]** `path="*"` catch-all holds entire app shell — prevents route-level optimization (Finding 9)
9. **[LOW]** `navigation.ts` `getKnownPaths()` uses CJS `require()` in ESM — latent runtime risk (Finding 7)
10. **[LOW]** Redundant 30-entry fallback map in `handleNavigateToDrillMode` (Finding 10)

---

## 3 Highest-Leverage Fixes

### Fix 1: Tighten `isKnownPath` to prevent false-positive 404 suppression (Finding 1)
**Files:** `config/routeRegistry.ts` (lines 102–117, 122–138)
**What:** Replace the greedy prefix matching with exact-match + explicit sub-route allowlist. Add a `hasSubRoutes: boolean` field to `RouteDefinition`. Only routes with `hasSubRoutes: true` (like `/admin`) should allow prefix matching.
```ts
export function isKnownPath(path: string): boolean {
  if (KNOWN_PATHS.has(path)) return true;
  if (path.startsWith('/session/')) return true;
  // Only allow prefix match for routes explicitly marked as having sub-routes
  for (const route of ROUTE_REGISTRY) {
    if (route.hasSubRoutes && path.startsWith(route.path + '/')) return true;
  }
  return false;
}
```
**Why:** Fixes the most impactful correctness issue — invalid URLs should show 404, not silently render the wrong view.
**Risk:** Low — may surface URLs that were previously silently accepted. Monitor 404 rate after deployment.
**Time:** 30 minutes.

### Fix 2: Replace deprecated route constants with current paths (Finding 2)
**Files:** `config/AppRoutes.tsx` (5 occurrences)
**What:**
- Replace `navigate(ROUTES.STUDY_TOOLKIT)` → `navigate(ROUTES.STUDY_UTILITIES)`
- Replace `navigate(ROUTES.STUDY_REFERENCE)` → `navigate(ROUTES.STUDY_KNOWLEDGE)`
- Delete `STUDY_TOOLKIT` and `STUDY_REFERENCE` from `config/routes.ts`

**Why:** Eliminates 5 double-navigations that cause URL flicker and potential state tearing on every toolkit/reference navigation.
**Risk:** None — the deprecated paths just redirect to the new ones anyway.
**Time:** 10 minutes.

### Fix 3: Add routes for `cram_mode` and `medical_wordle` + fix `MODES_WITH_DEDICATED_ROUTES` filter (Findings 3, 5)
**Files:** `config/training-modes.ts`
**What:**
1. Add TRAINING_MODES entries:
   ```ts
   { id: 'cram_mode', label: 'Cram Mode', description: '...', category: 'question_practice',
     iconName: 'Timer', theme: 'amber', route: '/modes/cram-mode', estimatedMinutes: 15 },
   { id: 'medical_wordle', label: 'Medical Wordle', description: '...', category: 'specialty_drills',
     iconName: 'Grid', theme: 'green', route: '/modes/medical-wordle', estimatedMinutes: 5 },
   ```
2. Fix the filter: `(m) => m.route !== 'core_adaptive'` → `(m) => m.id !== 'core_adaptive'`

**Why:** Makes all drill modes deep-linkable and refresh-safe. Fixes the incorrect filter that was silently including core_adaptive in the wrong list.
**Risk:** Low — both modes already work via view-state; adding routes just makes them URL-addressable.
**Time:** 15 minutes.

---

## Minimal Safe Implementation Plan

### Phase 1: Quick Wins (Day 1, 45 min)
1. Replace 5 deprecated route usages in AppRoutes.tsx (Fix 2)
2. Fix `MODES_WITH_DEDICATED_ROUTES` filter (Fix 3, part 2)
3. Add TRAINING_MODES entries for `cram_mode` and `medical_wordle` (Fix 3, part 1)
4. Test: verify all nav actions reach correct destinations, check URL bar

### Phase 2: Path Validation (Day 1–2, 1 hour)
1. Add `hasSubRoutes` field to `RouteDefinition`, set `true` for `/admin` and `/session`
2. Tighten `isKnownPath` and `getViewForPath` to use exact matching by default (Fix 1)
3. Test: visit `/study/garbage`, `/admin/nonexistent`, `/modes/fake` — all should show 404
4. Monitor: check if any legitimate paths now 404 (add to registry if so)

### Phase 3: Admin Guard (Day 2, 30 min)
1. Create `<AdminRoute>` wrapper that checks user role and redirects non-admins
2. Wrap all 6 `/admin/*` routes with it
3. Conditionally render the Shield icon in the header based on admin role

### Phase 4: URL-Backed Views (Day 3–5, incremental)
1. Pick 3 highest-traffic view-state views: `gap_analysis`, `tutor_chat`, `srs_review`
2. Add React Router `<Route>` for each, with proper Suspense boundaries
3. Update navigation callbacks to use `navigate()` instead of bare `setView()`
4. Repeat for remaining views over time

---

## What to Audit Next

**Recommended: Audit 4 — OSCE / Virtual Patient Encounter Mode**
- Gemini AI conversation flow and error handling
- Scoring rubric generation and display
- HUD overlay (vitals, timer, waveform) rendering
- Session persistence and recovery
- API call patterns and rate limiting
- Accessibility of conversation interface

**Alternative: Audit 4 — Knowledge Base / Clinical Library**
- KnowledgeBaseHub data loading and search
- Condition modal rendering (extensive CSS, markdown pipeline)
- Content source resolution (DB vs. AI-generated)
- Image loading and error states
