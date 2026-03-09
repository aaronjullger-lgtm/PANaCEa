# Route and View Map

Single reference for path → view/component and canonical vs redirect behavior. Used for 404 detection in App and for nav (NavRail, Command Palette).

## Canonical paths

Defined in `config/navigation.ts` as `CANONICAL_PATHS`. App.tsx uses this list (plus `path.startsWith(...)` for prefixes) to decide when to show the 404 page. Add new top-level routes here when adding a new route.

| Path | View / Component | Notes |
|------|------------------|--------|
| `/` | command_center | Redirects to `/study` in sync |
| `/study`, `/study/` | command_center | Dashboard (CommandCenterHub) |
| `/menu` | menu | Menu view |
| `/practice` | PracticePage | Explicit `<Route path="/practice">` |
| `/progress` | ProgressPage | Explicit `<Route path="/progress">` |
| `/study/knowledge` | reference_library | Knowledge base |
| `/study/utilities` | toolkit | Toolkit hub |
| `/study/path` | study_path_dashboard | Study path |
| `/study/reference` | (redirect) | Redirects to `/study/knowledge` |
| `/study/toolkit` | (redirect) | Redirects to `/study/utilities` |
| `/study/main-session` | (redirect) | Redirects to `/study` |
| `/core-adaptive` | core_adaptive | Core adaptive mode |
| `/modes/<slug>` | (mode view) | e.g. `/modes/ecg-drill` → ecg_drill view |
| `/session/<id>` | session_runner | In-session |
| `/admin`, `/admin/*` | Admin pages | Explicit routes |
| `/clinical-eye` | ClinicalEyePage | Explicit route |
| `/visualizer` | VisualizerPage | Explicit route |
| `/medical-database` | medical_database | |
| `/live-collaboration` | live_collaboration | |
| `/explorer` | cross_system_explorer | |

## 404 behavior

- If the current path is not in `CANONICAL_PATHS` and does not match any `path.startsWith(...)` (e.g. `/modes/`, `/session/`, `/study/knowledge`, etc.), App sets `showNotFound` and the catch-all route renders the 404 page with a "Go to Dashboard" button.

## Nav rail (single source of truth)

Nav rail items are defined in `config/navigation.ts` as `NAV_RAIL_ITEMS`. NavRail and Command Palette (when query is empty) use this config. Do not duplicate path/label definitions; add or change items only in `NAV_RAIL_ITEMS`.

## Legacy / deprecated

- `NAVIGATION_STRUCTURE` and `NAVIGATION_CONFIG` in `config/navigation.ts` are legacy. New code should use `NAV_RAIL_ITEMS` for the rail and `CANONICAL_PATHS` for route/404 logic.
- `getNavigationWithIcons()` still maps from `NAVIGATION_STRUCTURE`; prefer building from `NAV_RAIL_ITEMS` when adding new nav features.
