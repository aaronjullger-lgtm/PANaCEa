---
name: "panacea-repo-hygiene"
description: "Use to clean up PANaCEa's codebase: find and remove dead code, duplicate pathways, deprecated compatibility shells, stale documentation, unused dependencies, and orphaned imports. Trigger when asked to clean up the repo, remove dead code, audit imports, find duplicates, or reduce codebase debt."
---

# PANaCEa Repo Hygiene

You hunt dead code. PANaCEa has 36 skills, 461+ Edge functions, 169+ services, 603+ components — entropy accumulates. Your job is controlled removal of what's truly dead.

## First Files

- `CLAUDE.md` for architecture rules
- `AGENTS.md` for decision authority (ask before deleting files)
- `APP_FUNCTIONALITY_PLAN.md` for known dead code and cleanup history
- `package.json` for dependency census
- `vite.config.ts` for chunk splitting and excluded packages

## Known Dead Code Categories

### Already Cleaned (do not re-audit)
- `pages/LandingPage.tsx` — removed, canonical is `components/landing/LandingPage.tsx`
- `components/ui/SkeletonLoader.tsx` — removed, canonical is `components/loading/index.tsx`
- `components/ui/SectionHeader.tsx` — removed, canonical is `components/studypanacea/SectionHeader.tsx`
- `components/ui/SmartImage.tsx` — removed, canonical is `components/library/SmartImage.tsx`
- `components/panels/ExplanationPanel.tsx` — removed, canonical is `components/questions/ExplanationPanel.tsx`
- `components/toolkit/RotationSelector.tsx` — removed, canonical is `components/onboarding/RotationSelector.tsx`
- `gsap`, `@react-three/fiber`, `@react-three/drei` — removed from dependencies
- `geist` — removed from dependencies
- Stale `docs/repo-audit/*` bundle — removed

### Still Needs Auditing (from scorecard: 78/100)
- Compatibility shells and stale docs remain
- Import census for orphaned files
- Duplicate route/menu registrations (`CommandCenterPage`, `/menu`, `TrainingMenu`)
- Historical docs referencing FSRS v5, old dashboards, old smoke routes
- Deprecated API routes with no remaining consumers
- Unused barrel exports and index files
- Dead services and utilities
- Stale configuration files

## Hygiene Rules

- **Ask before deleting any file** — files may appear dead but serve compatibility
- **`trash` > `rm`** — always move to trash, never permanently delete
- **Verify with `rg` before claiming dead** — search the entire repo for imports/references
- **Check barrel exports** — a file may be unused directly but re-exported through an index
- **Check lazy imports** — `config/lazyComponents.tsx` and dynamic `import()` calls may be the only consumer
- **Check route registries** — `config/appViews.ts`, `config/AppRoutes.tsx`, `config/routes.ts` may reference the file
- **One file at a time** — delete, verify build passes, commit, then next
- **Document every removal** — what was removed, why, and what replaced it

## Audit Methods

### Find Dead Files
```bash
# For a suspected dead file:
rg "from.*<file-basename>" --type ts --type tsx
rg "import.*<file-basename>" --type ts --type tsx
rg "<file-path-pattern>" --type ts --type tsx
```

### Find Unused Dependencies
```bash
npm ls <package-name> --all
rg "from ['\"]<package-name>" --type ts --type tsx
rg "require\(['\"]<package-name>" --type ts --type tsx
```

### Find Duplicate Implementations
```bash
# Find files with similar names in different directories
find . -name "*<ComponentName>*" -not -path "*/node_modules/*" -not -path "*/dist/*"
```

### Find Stale Docs
```bash
# Find docs referencing removed features
rg "FSRS v5|old dashboard|deprecated" docs/ --type md
```

## Verification

After any file removal:
```bash
npm run typecheck
npm run build
npm run test:critical
npm run lint
```

If any command fails, the file was not truly dead — restore it.

## Reporting

```
## Hygiene Pass Summary

**Files Removed:** <count>
**Lines Removed:** <count>
**Dependencies Removed:** <list>
**Docs Cleaned:** <list>
**Verification:** <commands run and results>
**Risks Noted:** <any files that looked dead but weren't>
```
