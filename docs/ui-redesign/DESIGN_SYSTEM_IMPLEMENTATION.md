# Design System Implementation

Last updated: 2026-05-19

## Direction

The redesigned product frame is the Clinical Study Console: a dark, desktop-first medical study workspace that gives every major page a clear next action, a consistent route shell, and clinically precise data surfaces.

## Foundation

- Background: deep navy/blue-black with subtle clinical grid and noise.
- Surfaces: translucent navy panels with thin blue/cyan borders.
- Accents: cyan primary, blue secondary, violet tertiary, pulse-pink risk, clinical green success, restrained amber for milestones.
- Typography: moderate page titles, compact section titles, readable body text, and tabular/mono treatments only for vitals-style numbers.
- Radius: route surfaces are tightened from large generated-card radii toward precise console panels.
- Motion: existing Framer Motion remains, with reduced-motion behavior preserved through existing hooks and CSS.

## Shared Primitives

Primary reusable layer:

- `AppLayout`
- `NavRail`
- `WorkspacePage`
- `WorkspacePageHeader`
- `WorkspaceSurface`
- `WorkspaceHeroStrip`
- `WorkspaceMetricCard`
- `WorkspaceFilterBar`
- `WorkspaceEmptyState`
- `MedicalGlassCard`
- `PremiumCTAButton`

These primitives now carry the unified console visual language across dashboard, practice, study plan, knowledge, and progress surfaces.

## App Shell

The shell is now built around:

- persistent left navigation with brand, product sections, current focus, and profile footer
- sticky top command bar for global search, current plan context, subtle tutor entry, sync/profile controls
- content frame that scrolls independently without sidebar overlap
- mobile bottom navigation fallback retained

## Page Patterns

- Dashboard: daily prescription, readiness vitals, weak-system intelligence, plan/forecast widgets, clinical lab and review widgets, right insight rail.
- Practice: launch mode selection, workload filters, adaptive target cue, recent/recommended modes.
- Study Plan: route summary, projection, session map, fatigue signal, alternatives.
- Knowledge: searchable clinical topic lanes with condition, pharmacology, labs, and procedure/imaging contexts.
- Progress: analytics framed around next interventions rather than raw chart dumps.

## Data And Mock Content

Live data hooks are preserved. Existing dashboard fallback/demo data remains centralized under `components/dashboard/adaptive/page/commandCenterMockData.ts`. Shell-level fallback context is centralized under `components/clinical-console/studyDemoData.ts`; no patient-specific identifiers are introduced.

## Runtime Guardrails

- Authenticated route protection remains in place for signed-out users.
- Existing local guest mode is now respected by `AuthenticatedRoute`, so limited/demo route rendering does not collapse every route back to `/study`.
- Server/API authorization still depends on real Clerk tokens; guest mode only affects local route rendering and graceful UI fallbacks.
- Progress analytics now renders a structured unavailable state when analytics return neither usable data nor a surfaced error.

## Accessibility

- Skip link remains in the shell.
- Visible focus states remain tokenized through `--color-focus-ring`.
- Primary controls keep semantic buttons/links.
- Reduced-motion CSS and hooks are preserved.
- Mobile nav remains available at small breakpoints.
