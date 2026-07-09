---
name: dependency-review
description: Review a dependency addition/upgrade for necessity, safety, and impact. Use on dependency-bump PRs or before adding a package.
---

# Dependency review

Assess dependency changes safely. See `dependency-and-package-safety.mdc`.

## When to use

- A PR changes `package.json`/lockfile, or you're about to add/upgrade a package.

## Instructions

1. Summarize the change: which deps, old→new versions, why.
2. Necessity: can the existing stack do it (React/Vite/Tailwind/Radix/Framer Motion/Zustand/TanStack/Zod)? Prefer no new dep.
3. Safety: publisher/maintenance/known advisories; confirm the package+version exist (don't invent). Flag any **production** dep for human approval.
4. Compatibility: Edge-safe if used in `functions/api/` (no Node built-ins); no yarn/pnpm/bun lockfiles.
5. Impact: bundle size for UI libs.

## Commands

- `npm install` (clean lockfile update) → `npm run typecheck` → `npm run build` → `npm test`.
- Bundle: `npm run build:analyze` or `npm run build:check-size`.
- Advisories: `npm audit` (report only — do **not** run `npm audit fix --force`).

## Stop conditions

- Stop and request approval before adding/upgrading any production dependency.

## Verification

- Install/build/test results captured; bundle impact noted.

## Do not claim success unless

- Install + build + tests pass and approval is obtained for prod deps.

## Recovery

- Breaking major bump → pin to a safe version or defer; document.
- Lockfile churn → regenerate via `npm install`, never hand-edit.
