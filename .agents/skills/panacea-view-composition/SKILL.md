---
name: "panacea-view-composition"
description: "Use this skill when adding, moving, refactoring, or debugging PANaCEa pages, app views, route registry entries, lazy components, navigation items, app shell layout, protected routes, mode pages, dashboards, or frontend composition through config/appViews.ts and config/lazyComponents.tsx."
---

# PANaCEa View Composition

Use for frontend route/view wiring and page composition. PANaCEa uses config-driven view registration; do not invent ad-hoc routes when a view belongs in the app shell.

## First Files

- `config/appViews.ts`
- `config/lazyComponents.tsx`
- `config/AppRoutes.tsx`
- `config/navigation.ts`
- `components/layout/DrillViewRouter.tsx`
- `components/layout/AppLayout.tsx`
- The target page under `pages/` or component under `components/`
- `components/layout/LAYOUT_README.md` when layout behavior is unclear

## View Wiring Workflow

1. Identify whether the surface is a public route, authenticated app view, admin view, drill/mode view, or modal/panel.
2. Find a neighboring existing view with similar auth/navigation behavior.
3. Add or update the lazy component mapping in `config/lazyComponents.tsx`.
4. Register metadata, route/view id, icon/nav grouping, and access behavior in `config/appViews.ts` or the appropriate config file.
5. Ensure navigation, breadcrumbs/back links, and layout shells use existing primitives.
6. Verify the route renders through the app shell and that direct URL load works.

## Component Composition Rules

- Reuse `components/layout`, `components/ui`, and workspace primitives before creating new shells.
- Keep page files as orchestration; move reusable UI into `components/<area>/`.
- Do not put Prisma, server-only services, or secrets into frontend routes.
- Avoid nested cards and marketing-style sections inside operational app surfaces.
- Use stable dimensions for boards, charts, toolbars, and fixed-format widgets.

## Auth And Admin

- For protected pages, inspect `components/auth/AuthenticatedRoute.tsx`, `AdminRoute.tsx`, and existing admin registrations.
- Do not trust hidden nav as access control; enforce backend auth/RBAC on data routes too.
- If the view has an API dependency, load error/empty states intentionally.

## Validation

- `npm run typecheck` for config/lazy import changes.
- `npm run build` for code-splitting/lazy import changes.
- Playwright for navigation, auth gates, direct deep links, and mode flows.
- Browser screenshot pass for substantial UI or responsive layout changes.

## Common Traps

- Creating a page component without registering it in the lazy component map
- Adding navigation that points to a route the router cannot resolve
- Duplicating view IDs or route names
- Putting a full app shell inside a page that already renders inside `AppLayout`
- Making an admin UI page without matching backend RBAC
