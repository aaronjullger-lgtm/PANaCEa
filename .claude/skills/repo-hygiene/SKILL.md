---
name: repo-hygiene
description: "Clean up duplicate code, stale files, dead imports, overlapping service layers, and structural inconsistencies in the PANaCEa repository. Use whenever the repo feels messy, you find duplicate logic, imports point to wrong locations, there are unused files, or navigation is harder — even just 'clean this up'. Also use for consolidating service layers, removing dead code, or preparing major refactors."
tags: [code-quality, deduplication, maintenance, architecture]
composesWith: [panacea-dev, panacea-navigator, perf-bundle-edge]
---

# Repo Hygiene — PANaCEa Codebase Maintenance

## Purpose
A clean repo is a fast repo. Eliminate duplicate logic, stale files, and import confusion. Reduce cognitive load, improve build times (currently max-old-space-size=4096 indicates memory pressure), and make the 562-component, 421-API-function monorepo navigable and maintainable.

## Known Duplication Hotspots

### 1. Services Layer Fragmentation
- **services/ai/geminiService.ts** AND **services/domain/geminiService.ts** — AI orchestration split across dirs
- **lib/services/** (business logic: drillReviewService, calibrationService, etc.) vs **services/** (domain-specific concerns)
- **functions/api/_shared/** (edge utilities: auth, prisma-edge singleton)
- **Canonical rules:**
  - `lib/services/` → core business logic, client & server-side, Prisma models
  - `services/ai/` → AI provider orchestration (Gemini calls, streaming)
  - `services/domain/` → domain services that wrap multiple providers (e.g., grading orchestration)
  - `functions/api/_shared/` → edge-only utilities (Prisma singleton, middleware, secrets)

### 2. Frontend Routes Inconsistency
- **routes/** is Express for local dev ONLY — production uses `functions/api/`
- Never import from `routes/`; use `functions/api/` instead
- routes/ should be deleted post-migration if untouched in 6 months

### 3. 42 Subdirectories in services/
- Audit for dead dirs; consolidate thin wrappers into parent modules
- Group by concern (ai, domain, cache, etc.) not by tentative future feature

## Dead Code Detection Strategy

### Exports & Imports
1. Use `npm run panacea-navigator` to identify **unused exports** in lib/services, lib/confidence, components/
2. Search for component/hook/service names in `.tsx?`, `.ts?` files — if only exported, no callers exist
3. Grep for `import.*from '...'` across entire repo; cross-reference against codebase

### Files & Directories
- **plans/**, **docs/** — audit for outdated specs; delete or mark "historical" if >3 months stale
- **AUDIT_\*.md** → archive to `docs/audit-archive/` or delete
- **dist/** → verify not committed; add to `.gitignore` if present

### Stale Type Definitions
- Search for types only in generated types (`@generated` comments) or schema.prisma
- Check `lib/types/` for duplicates vs schema or incoming GraphQL

## Import Hygiene

### Absolute vs. Relative
- Enforce absolute imports for lib/, components/, services/ (configured in tsconfig.json paths)
- Use relative for same-directory re-exports (e.g., `./index.ts`)
- Avoid `@/../../../lib/` patterns — convert to absolute

### Barrel Files & Circular Dependencies
- Maintain `index.ts` only for stable, public APIs (e.g., `lib/confidence/` modules are imported individually — avoid barrel files unless the API surface is stable)
- Use `npm run typecheck` to detect cycles; resolve by extracting utilities or splitting modules
- Never barrel-export internal implementation details

### Wrong Imports (Most Common)
```typescript
❌ import { submitReview } from 'routes/api/drills'    // LOCAL DEV ONLY
✅ import { submitReview } from 'functions/api/drills'

❌ import gemini from 'services/domain/geminiService'
✅ import { generateQuestions } from 'lib/services/questionGenerationService'
// or check: is the function domain-orchestration or AI-call? Route to correct layer.
```

## Service Layer Consolidation Guidelines

### When to Consolidate
- If `serviceA` calls `serviceB` every time, merge them
- If both live in different dirs but serve one feature, unify
- If a "domain service" is just a thin wrapper around one AI call, push logic into lib/services

### Merge Pattern
1. Identify canonical location (prefer `lib/services/` for business logic)
2. Move all logic there; update all imports
3. Leave a deprecation stub in old location for 1 release cycle, or delete immediately if internal-only
4. Update CLAUDE.md's "Key Files" section

## File Organization Rules

**New code goes here:**
- Business logic (FSRS, confidence, drillReviewService) → `lib/services/`
- UI components → `components/` with domain subdirs (session/, drill/, etc.)
- Hooks → `hooks/` with domain grouping (useDrillFSRS, useStudyWellness)
- Edge API endpoints → `functions/api/` with domain structure (questions/, drills/, auth/)
- Type definitions → `lib/types/` or inline in schema.prisma if Prisma model
- Shared edge utilities → `functions/api/_shared/`
- AI orchestration → `services/ai/` for direct provider calls; `services/domain/` for business logic wrapped in AI

## Common Failure Modes

1. **Importing from routes/** → causes server mismatch in production
2. **Duplicate Prisma instantiation** → missing `safePrismaDisconnect(prisma)` in finally block
3. **Multiple geminiService imports** → services/ai/ and services/domain/ out of sync
4. **stale confidence/calibration type refs** → schema changed but type not updated
5. **Circular imports in lib/services/** → split into separate modules (e.g., core vs. advanced)
6. **Dead cron jobs** → `functions/api/cron/` cleanup script never triggered or returns error

## Cleanup Checklist

- [ ] Identify duplicate services (services/ai vs. lib/services vs. services/domain)
- [ ] Audit 42 subdirs in services/; mark thin wrappers for merge
- [ ] Search for unused exports in lib/services/ and components/
- [ ] Check all imports of geminiService, calibrationService, drillReviewService
- [ ] Verify no imports from routes/ (only functions/api/)
- [ ] Review plans/ and docs/ for stale specs; archive or delete
- [ ] Check dist/ not in git; add to .gitignore if found
- [ ] Run `npm run typecheck` to catch circular dependencies
- [ ] Validate all Prisma calls use safePrismaDisconnect in finally blocks
- [ ] Update CLAUDE.md "Key Files" if consolidations made
- [ ] Run `npm test` and `npm run db:studio` to ensure no schema drift

## Composition
This skill works alongside:
- **panacea-dev** — for testing, builds, local dev flow
- **panacea-navigator** — to find files and understand codebase shape
- **perf-bundle-edge** — to validate bundle size after deduplication
