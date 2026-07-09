---
name: route-and-import-verification
description: Verify that imports, modules, exports, and routes actually resolve before relying on them. Use when adding imports/routes or when a build fails on missing modules.
---

# Route & import verification

Prevent hallucinated modules/routes. See `anti-hallucination-imports.mdc`.

## When to use

- Adding an import or route, or debugging "cannot find module" / unresolved paths.

## Instructions

1. File exists: `rg --files | rg <name>` or Glob before importing. Remember some referenced modules are **absent on `main`** (`routes/`, `lib/services/tokenMatchCache.ts`) — do not import or fabricate them.
2. Export exists: open the target and confirm the named export; don't guess member names.
3. Alias resolves: `@/*` → repo root, `@src/*` per `tsconfig`/`vite.config`. Verify the resolved path.
4. Package exists: it's in `package.json` and Edge-safe if used in `functions/api/`.
5. Route registered: new React Router routes are wired into the route registry and the component is lazy-loaded per convention.

## Commands

- `npm run typecheck` (missing modules/exports/types).
- `npm run build` (unresolved bundle imports).
- `rg "export (const|function|class|default) <symbol>"` to confirm an export.

## Stop conditions

- Stop before writing code that depends on an unverified module/route.

## Verification

- typecheck + build pass for the touched files.

## Do not claim success unless

- typecheck/build confirm resolution (not just "looks right").

## Recovery

- Module truly missing → stop and flag; don't invent a stub to force a green build.
- Route not showing → confirm it's registered and the path matches the router config.
