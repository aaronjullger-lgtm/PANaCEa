# Autonomous UI Audit

Last updated: 2026-05-19

## Stack Discovered

- React 19, TypeScript, Vite, React Router, Tailwind, Framer Motion, Recharts, Lucide.
- Authenticated app shell is routed through `App.tsx`, `config/AppRoutes.tsx`, and `components/layout/AppLayout.tsx`.
- Primary navigation source is `config/navigation.ts`, rendered by `components/layout/NavRail.tsx`.
- Major signed-in routes use shared primitives from `components/workspace/WorkspacePrimitives.tsx`.
- Dashboard uses live hooks in `components/navigation/command-center/CommandCenterWorkspace.tsx` and adaptive widgets under `components/dashboard/adaptive`.
- Existing PANaCEa visual primitives live in `components/studypanacea`.

## Relevant File Map

- Shell: `components/layout/AppLayout.tsx`, `components/layout/NavRail.tsx`, `components/layout/AppBrand.tsx`
- Navigation: `config/navigation.ts`, `config/routes.ts`, `config/routeRegistry.ts`
- Tokens: `index.css`, `tailwind.config.js`, `lib/tokens/workspacePalette.ts`
- Shared workspace UI: `components/workspace/WorkspacePrimitives.tsx`
- Dashboard: `components/dashboard/adaptive/page/DashboardShell.tsx`, `components/dashboard/adaptive/page/DashboardShellSections.tsx`
- Study home adapter: `components/navigation/command-center/CommandCenterWorkspace.tsx`
- Practice: `pages/PracticePage.tsx`
- Progress: `pages/ProgressPage.tsx`
- Study plan: `components/dashboard/StudyPathDashboard/index.tsx`
- Knowledge: `components/knowledge/KnowledgeBaseHub.tsx`

## Routes And Pages Found

- Public: `/`
- Core workspace: `/study`
- Practice: `/practice`
- Progress: `/progress`
- Knowledge: `/study/knowledge`
- Study plan: `/study/path`
- Main session: `/study/main-session`
- Weak areas: `/gap-analysis`
- Clinical profile/cases-adjacent surface: `/clinical-profile`
- Clinical images: `/clinical-eye`
- Resources/toolkit: `/study/utilities`
- Visualizer, lecture converter, technique check, admin routes, and private-beta placeholders.

## Components Reused

- Existing analytics/study hooks remain intact.
- Existing route guards remain intact for signed-out users, with the pre-existing local guest mode now allowed through `AuthenticatedRoute`.
- Existing adaptive dashboard widgets remain intact where they already map real study signals to UI.
- Existing `WorkspacePage`, `WorkspaceSurface`, `WorkspaceMetricCard`, and related primitives are retained as the cross-page substrate.

## Components To Replace Or Reframe

- App shell visual chrome needs a stable left console nav and restrained top command bar.
- Dashboard should no longer present a competing nested sidebar inside the route.
- Workspace palette should move away from warm/gold dominance into a dark clinical console palette.
- Primary button styling should use the medical action color, not legacy brass.
- Major page copy should be more direct about next study actions.

## Styling Architecture Found

- CSS variables are centralized in `index.css`.
- Tailwind maps semantic tokens from CSS variables.
- The app supports light/dark theme, but the product direction is dark-first.
- Several old utility names still exist for compatibility; the redesign should add semantic behavior without breaking existing consumers.

## Biggest UI Defects

- Competing navigation surfaces: global rail plus dashboard-local sidebar.
- Warm/gold theme drift conflicts with the new clinical console brief.
- Cards use inconsistent levels of glow, radius, density, and copy rhythm.
- Several routes are visually related through workspace primitives, but palette and shell treatment make them feel less unified than they should.
- The dashboard has useful data but too many simultaneously loud visual accents.
- Guest-mode route rendering opened the shell but collapsed protected routes back to `/study`.
- `/progress` could render an empty content frame when analytics produced no data and no surfaced error.

## Root Causes

- Product direction changed faster than the shared shell and token system.
- Dashboard-specific visual components evolved separately from the route-level workspace primitives.
- Navigation inventory is too narrow for the current product scope.
- The default theme can resolve to light mode even though the app identity is dark-first.

## Implementation Plan

1. Switch default theme to dark when no user preference is stored.
2. Rework semantic tokens and workspace palette toward deep navy, cyan, blue, violet, pulse-pink, clinical green, and restrained amber.
3. Redesign `AppLayout` + `NavRail` into a stable app shell with sidebar brand, product navigation, focus card, and profile footer.
4. Remove the dashboard-local sidebar from the dashboard composition and make the primary content plus right rail the core dashboard layout.
5. Tune workspace primitives so all route pages inherit the same dark clinical console surfaces.
6. Refresh navigation labels and routes to cover study plan, practice, review, knowledge, cases/profile, weak areas, clinical images, progress, resources, and settings.
7. Update documentation and verification history after build/runtime checks.

## Verification Commands

- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm run test:critical` if the broader checks stay healthy
- Browser smoke on `/study`, `/practice`, `/study/path`, `/study/knowledge`, and `/progress` when a local server is available.
