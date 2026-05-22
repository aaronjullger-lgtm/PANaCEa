---
name: "panacea-repo-hygiene"
description: "Use to audit and clean PANaCEa-specific dead code, duplicate pathways, deprecated docs, compatibility shells, stale barrel exports, orphaned imports, and unused dependencies. Trigger when asked to clean up the repo, find dead code, audit imports, remove duplicates, or perform repo hygiene."
---

# PANaCEa Repo Hygiene

You find and remove dead weight in the PANaCEa codebase. Duplicate components, stale compatibility shells, deprecated docs, orphaned imports, unused dependencies — you track them down and clean them up.

## First Files

- `CLAUDE.md` for stack and architecture rules
- `AGENTS.md` for repo conventions
- `APP_FUNCTIONALITY_PLAN.md` for known dead-code items
- `package.json` for dependencies
- `vite.config.ts` for chunk configuration
- `config/lazyComponents.tsx` for lazy loading registry
- `config/AppRoutes.tsx` for route registration
- `config/routes.ts` for route definitions

## Audit Domains

### Dead Components
- Run `rg` to find components with no active imports
- Check barrel exports pointing to deleted files
- Check for duplicate implementations (e.g., two TopicMasteryBreakdown components)
- Known cleanup targets from APP_FUNCTIONALITY_PLAN.md:
  - Legacy landing pages, UI components, section headers
  - Skeleton loader shims
  - Smart image duplicates
  - Rotation selector duplicates

### Deprecated Docs
- Search `docs/` for docs referencing removed dependencies (GSAP, R3F, drei)
- Flag docs with stale no-launch claims or outdated setup instructions
- Check for docs contradicting current implementation

### Compatibility Shells
- Express routes that duplicate production Edge Functions
- Legacy API wrappers that just forward to canonical paths
- Outdated mode/route registrations
- Historical dashboards still in route registry

### Orphaned Imports
- Check for imports of deleted files (broken barrel exports)
- Find `export * from './deleted-file'` patterns
- Audit circular dependencies that could cause build issues

### Unused Dependencies
- Audit `package.json` against actual imports (`rg` import patterns)
- Flag packages in lockfile not used by source
- Check for packages that could be devDependencies instead of dependencies

## Cleanup Workflow

1. Run `rg` to find the target pattern (imports, file references)
2. Verify zero active consumers before deletion
3. Use `trash` not `rm` — move to `_trash/` for review
4. Remove barrel export entries pointing to deleted files
5. Run `npm run typecheck` and `npm run build` after cleanup
6. Run `npm test` to catch missed imports

## Verification Ladder After Cleanup

1. `npm run typecheck` — no new errors
2. `npm run build` — builds clean, no missing import errors
3. `npm run test:critical` — no regressions
4. `git diff --check` — clean diff

## Known Targets (from scorecard)

- Compatibility shells from deprecated dashboards
- Stale docs referencing removed GSAP/R3F/drei
- Express-only routes that shadow production Functions
- Orphaned training mode registrations
- Historical docs/archive sweep for FSRS v5 claims and old smoke routes
- Duplicate `CommandCenterPage`, `/menu`, `TrainingMenu` routes

## Hard Guardrails

- Never delete a file without verifying zero active imports
- Always use `trash` not `rm` — recoverable
- Run typecheck and build after every deletion
- Do not touch actively imported production code
- Preserve user work in dirty working tree
- Document what was removed and why
