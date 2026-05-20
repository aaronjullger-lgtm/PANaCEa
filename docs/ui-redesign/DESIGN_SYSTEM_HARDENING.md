# Design System Hardening

Last updated: 2026-05-19

## Foundation Hardened

- Dark-first clinical shell is now the default when no user theme is stored.
- Primary navigation is centralized in `config/navigation.ts` and rendered through `NavRail`.
- Workspace pages share `WorkspacePage`, `WorkspacePageHeader`, `WorkspaceSurface`, `WorkspaceHeroStrip`, `WorkspaceMetricCard`, `WorkspaceSection`, and `WorkspaceEmptyState`.
- Accent language is centered on clinical cyan, steel blue, violet, pulse rose, clinical green, and restrained amber.
- Major route pages now use the same shell density, card rhythm, and command-center framing.
- Guest/API fallback states now use the same console primitives instead of isolated empty-state cards.

## Interaction Hardening

- Review no longer depends on a query-string view-state shortcut for primary navigation.
- `DrillViewRouter` no longer injects unrelated private-beta placeholders into non-drill pages.
- Toolkit cards now avoid nested interactive controls while preserving keyboard activation.
- Clinical Images now resolves to its real workspace from primary navigation.
- Settings/Profile now renders as a high-z-index control-center modal above the shell instead of a cramped legacy overlay.
- Study Path, Clinical Profile, and Gap Analysis now keep useful clinical intelligence visible in local guest QA without bypassing auth or writing fake progress.
- Knowledge Atlas now uses tokenized accents and guest-safe clinical preview cards instead of auth-error content states.
- Guest/status banners now respect the desktop nav rail offset.
- Medical Database health checks are lazy/opt-in so the evidence-search route does not call external APIs before user intent.

## Token Gaps Still Present

- `npm run lint` passes, but reports `270` existing warnings, mostly raw hex colors outside the token layer.
- Several pre-existing pages still use direct hex accents, including `pages/ClinicalEyePage.tsx`, `pages/PracticePage.tsx`, Study Path, Settings/Profile modal, and older analytics/library surfaces.
- These warnings are under the configured `--max-warnings 2000` threshold and were not all introduced by this redesign pass.

## Recommended Next Hardening Step

Run a focused token migration pass for high-traffic route pages first:

- `pages/ClinicalEyePage.tsx`
- `pages/PracticePage.tsx`
- `pages/MedicalDatabaseWorkspacePage.tsx`
- `components/dashboard/StudyPathDashboard/index.tsx`
- `components/modals/SettingsStatsModal.tsx`

The goal should be to replace inline raw hex values with `workspaceAccent`, semantic CSS variables, or token exports in `lib/tokens`.
