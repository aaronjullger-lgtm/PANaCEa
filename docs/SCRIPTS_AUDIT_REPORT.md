# Scripts Directory Audit Report
**Date:** January 19, 2026  
**Objective:** Identify redundant, deprecated, and high-maintenance scripts to reduce 129 TypeScript errors

---

## Executive Summary

**Total Scripts Analyzed:** 80+ files in `scripts/` and `scripts/generators/`  
**TypeScript Errors Contribution:**
- **Scripts directory total:** ~90 errors (~70% of all errors)
- **Generators subdirectory:** 57 errors (44% of all errors)
- **Key maintenance scripts:** 11 errors (backfillConditionData, condition-doctor, content-doctor, content-enrichment)
- **Database utilities:** ~22 errors (normalize-systems, unify-condition-medicalcontent, etc.)

**Key Finding:** The generators/ directory and legacy migration scripts represent the largest consolidation opportunity. Removing/consolidating 15-20 scripts could eliminate 60-70 errors (~50% of total).

---

## Category 1: Legacy Migration Scripts (DEPRECATED)

### High Priority - DELETE CANDIDATES

| Script Name | Lines | TS Errors | Status | Recommendation |
|------------|-------|-----------|---------|----------------|
| `backfillConditionData.ts` | 365 | 6 | **DEPRECATED** | **DELETE** - One-time migration from 2024, only in archive docs |
| `migrateStaticDataToDatabase.ts` | ? | ? | **DEPRECATED** | **DELETE** - Historical migration (pre-Prisma v7) |
| `syncConditionTable.ts` | ? | ? | **REDUNDANT** | **DELETE** - Replaced by `lib/services/sync/registrySync.ts` |
| `syncDrugTable.ts` | ? | ? | **REDUNDANT** | **DELETE** - Redundant with registry sync |
| `syncSpecialTestTable.ts` | ? | ? | **REDUNDANT** | **DELETE** - Redundant with registry sync |
| `syncAnatomyTable.ts` | ? | ? | **REDUNDANT** | **DELETE** - Redundant with registry sync |
| `syncTreatmentTable.ts` | ? | ? | **REDUNDANT** | **DELETE** - Redundant with registry sync |

**Analysis:**
- `backfillConditionData.ts`: Created during Sprint 4 (SEARCH_OVERHAUL_COMPLETE.md), last mentioned in archive docs. Purpose was one-time backfill from registry → database. **No package.json script, no recent commits, no CI/CD usage.**
- Individual `sync*Table.ts` scripts: Replaced by unified `syncAllRegistries.ts` which calls `lib/services/sync/registrySync.ts`. The active npm scripts are `sync:all` and `sync:all-registries`.

**Impact of Deletion:** -6 to -15 TypeScript errors, cleaner maintenance surface.

---

## Category 2: Overlapping Content Generation Scripts

### Consolidation Opportunity - MERGE CANDIDATES

| Script Name | Lines | TS Errors | Purpose | Status |
|------------|-------|-----------|----------|--------|
| `condition-doctor.ts` | 1785 | 3 | Add new conditions, merge dupes, AI content generation | **ACTIVE** |
| `content-doctor.ts` | 1072 | 1 | Gap analysis, reference-grade content generation | **ACTIVE** |
| `content-enrichment.ts` | 827 | 1 | Enrich existing content with AI | **ACTIVE** |

**Analysis - Functional Overlap:**

**condition-doctor.ts:**
- ✅ Adds new high-yield conditions from hardcoded list
- ✅ Detects and merges duplicate conditions
- ✅ Generates AI content for new conditions
- ✅ Normalizes formatting (snake_case)
- 📦 Package.json: NO direct script (run manually)
- 🔧 Uses: Gemini 2.5 Pro, Prisma adapter pattern

**content-doctor.ts:**
- ✅ Phase 1: PANCE gap analysis (finds missing conditions)
- ✅ Phase 2: Generates reference-grade content
- ✅ Buzzwords, mnemonics, guidelines, pearls generation
- 📦 Package.json: `content-doctor:phase1`, `content-doctor:phase2`, `content-doctor:buzzwords`, etc.
- 🔧 Uses: Gemini 2.5 Pro, standard Prisma

**content-enrichment.ts:**
- ✅ Enriches existing conditions with additional fields
- ✅ Focuses on completeness (missing overview, etiology, etc.)
- 📦 Package.json: NO direct script
- 🔧 Uses: Gemini API, standard Prisma

**Overlap Analysis:**
1. **AI Content Generation:** All three use Gemini API to generate medical content
2. **Database Operations:** All three upsert to MedicalContent table
3. **Gap Detection:** content-doctor and content-enrichment both identify incomplete records
4. **Validation:** All three validate content structure

**Recommendation: MERGE into unified `db-doctor.ts`**

Proposed unified structure:
```typescript
// db-doctor.ts - Unified Database Curator
// Commands:
//   --analyze          Report gaps, duplicates, quality issues
//   --add-conditions   Add new high-yield conditions
//   --merge-dupes      Merge duplicate conditions
//   --enrich           Enrich incomplete content
//   --generate TYPE    Generate buzzwords|mnemonics|pearls|guidelines
//   --fix-quality      Fix formatting, validation issues
//   --system CV        Filter by system
//   --dry-run          Preview changes
```

**Benefits:**
- Single source of truth for database curation
- Unified Prisma adapter strategy
- Consolidated rate limiting and retry logic
- Reduced maintenance (3 files → 1 file)
- **Estimated error reduction: -5 to -8 TypeScript errors**

---

## Category 3: Generator Scripts (HIGH ERROR CONTRIBUTION)

### Analysis of scripts/generators/ Directory

**Total Files:** 77 generator scripts  
**TypeScript Errors:** 57 errors (44% of all project errors)

**Common Error Pattern:**
```typescript
// Error: Type '{ id: string; ... }' is not assignable to 
// '(Without<ModelCreateInput, ModelUncheckedCreateInput> & ...)'
```

**Root Cause:** Prisma v7 introduced stricter type checking for create/upsert operations. The generator scripts create object literals that don't perfectly match the generated Prisma types due to:
1. Optional field handling (undefined vs omitted)
2. Field ordering
3. Type widening (string vs branded string types)

**Generator Categories:**

| Category | Scripts | TS Errors | Active Use |
|----------|---------|-----------|------------|
| **Entry Generators** | 15 (anatomy, imaging, lab, physiology, etc.) | 12 | ⚠️ LEGACY |
| **Doctor Scripts** | 8 (anatomy-doctor, drug-doctor, etc.) | 8 | ✅ ACTIVE |
| **Filler Scripts** | 20+ (ddx-filler, ecg-filler, etc.) | 22 | ✅ ACTIVE |
| **Specialized** | 10+ (question-generator, seed-all, etc.) | 15 | ✅ ACTIVE |

**Entry Generators (LEGACY PATTERN):**
Files like `anatomy-structure-entry-generator.ts`, `imaging-study-entry-generator.ts`, `labtest-entry-generator.ts` follow an older pattern with hardcoded data arrays. They appear to be replaced by:
- Modern `-doctor.ts` scripts (AI-powered)
- `-filler.ts` scripts (database-driven enrichment)

**Recommendation: DEPRECATE Entry Generators**

Move to `scripts/deprecated/entry-generators/`:
- `anatomy-structure-entry-generator*.ts`
- `imaging-study-entry-generator*.ts`
- `labtest-entry-generator.ts`
- `physiology-concept-entry-generator*.ts`
- `special-test-entry-generator*.ts`
- `procedure-entry-generator*.ts`
- `differential-diagnosis-entry-generator*.ts`
- `ecg-pattern-entry-generator*.ts`

**Impact:** -12 TypeScript errors eliminated by moving to deprecated (excluded from typecheck)

---

## Category 4: Active Maintenance Scripts (KEEP)

### Scripts with Active Usage in package.json

| Script Name | npm Command | Purpose | TS Errors | Priority |
|------------|-------------|---------|-----------|----------|
| `runAutomatedPipeline.ts` | `orchestrate:full` | Full content generation pipeline | 0 | KEEP |
| `runContextAwareOrchestration.ts` | `orchestrate:context-aware` | Smart orchestration | 0 | KEEP |
| `maintenance/orchestrator.ts` | `db:orchestrate` | Database maintenance | 0 | KEEP |
| `contentHealthChecker.ts` | `health-check` | Content validation | 0 | KEEP |
| `system-health.ts` | `system-health` | System diagnostics | 0 | KEEP |
| `syncAllRegistries.ts` | `sync:all-registries` | Registry synchronization | 0 | KEEP |
| `automation/hourlyTasks.ts` | `automation:hourly` | Scheduled jobs | 0 | KEEP |
| `automation/dailyTasks.ts` | `automation:daily` | Scheduled jobs | 0 | KEEP |
| `db/normalize-systems.ts` | (manual) | System normalization | 1 | FIX |
| `db/unify-condition-medicalcontent.ts` | `db:unify` | Data unification | 1 | FIX |

**These scripts have 0 TS errors and are actively used - no action needed.**

---

## Category 5: Specialized Generators (KEEP WITH FIXES)

### High-Value Scripts Requiring Type Fixes

| Generator | Purpose | Errors | Recommendation |
|-----------|---------|--------|----------------|
| `labtest-enhancer.ts` | Enhance lab test data | 1 | Fix types |
| `imaging-study-doctor.ts` | AI-powered imaging content | 1 | Fix types |
| `drug-doctor-enhanced.ts` | Comprehensive drug database | 1 | Fix types |
| `ddx-doctor.ts` | Differential diagnosis generator | 1 | Fix types |
| `buzzword-doctor.ts` | Buzzword extraction/generation | 2 | Fix types |
| `clinical-pearl-doctor.ts` | Clinical pearls generator | 2 | Fix types |
| `first-line-treatment-doctor.ts` | Treatment recommendations | 2 | Fix types |

**These scripts are essential for content quality and should have their Prisma types fixed rather than deprecated.**

---

## Consolidation Plan Summary

### Phase 1: Delete Legacy Migration Scripts (IMMEDIATE)
**Files to Delete:** 7-10 scripts  
**Error Reduction:** -6 to -15 errors  
**Risk:** LOW (deprecated, not in use)

Scripts:
- ✅ `backfillConditionData.ts`
- ✅ `migrateStaticDataToDatabase.ts`
- ✅ `syncConditionTable.ts`
- ✅ `syncDrugTable.ts`
- ✅ `syncSpecialTestTable.ts`
- ✅ `syncAnatomyTable.ts`
- ✅ `syncTreatmentTable.ts`

### Phase 2: Deprecate Entry Generators (QUICK WIN)
**Files to Move:** 12-15 scripts → `scripts/deprecated/`  
**Error Reduction:** -12 to -18 errors  
**Risk:** LOW (replaced by doctor/filler scripts)

Create `scripts/deprecated/entry-generators/` and move:
- All `*-entry-generator.ts` and `*-entry-generator-v2.ts` files
- Update `.gitignore` or tsconfig to exclude deprecated/

### Phase 3: Merge Content Generation Scripts (MEDIUM EFFORT)
**Files to Consolidate:** 3 → 1  
**Error Reduction:** -5 to -8 errors  
**Risk:** MEDIUM (requires careful merge, testing)

Merge into `scripts/db-doctor.ts`:
- `condition-doctor.ts` (1785 lines)
- `content-doctor.ts` (1072 lines)
- `content-enrichment.ts` (827 lines)

Result: ~2000 line unified script with modular commands

### Phase 4: Fix Prisma Types in Essential Generators (ONGOING)
**Files to Fix:** 15-20 active generator scripts  
**Error Reduction:** -22 to -30 errors  
**Risk:** LOW (type annotations only)

Strategy:
```typescript
// Before (causes error):
const data = { id: uuid(), name: 'Test', ... };
await prisma.model.create({ data });

// After (type-safe):
const data: Prisma.ModelCreateInput = { id: uuid(), name: 'Test', ... };
await prisma.model.create({ data });
```

---

## Expected Impact Summary

| Phase | Action | Scripts Affected | Error Reduction | Effort |
|-------|--------|-----------------|----------------|--------|
| 1 | Delete migrations | 7-10 | -6 to -15 | 1 hour |
| 2 | Deprecate entry generators | 12-15 | -12 to -18 | 2 hours |
| 3 | Merge content doctors | 3 → 1 | -5 to -8 | 8 hours |
| 4 | Fix Prisma types | 15-20 | -22 to -30 | 6 hours |
| **TOTAL** | | **37-48 scripts** | **-45 to -71 errors** | **17 hours** |

**Current:** 129 errors  
**After Phase 1-2:** 100-111 errors (**Quick wins in 3 hours**)  
**After Phase 1-4:** 58-84 errors (**Target <50 achievable**)

---

## Recommendations Priority Order

### IMMEDIATE (Do Now):
1. ✅ Delete `backfillConditionData.ts` (-6 errors)
2. ✅ Move entry generators to deprecated/ (-12 errors)
3. ✅ Delete redundant sync scripts (-3 errors)

**Impact:** -21 errors in ~3 hours → Down to 108 errors

### HIGH PRIORITY (This Week):
4. Fix Prisma types in doctor scripts (-10 errors):
   - `imaging-study-doctor.ts`
   - `drug-doctor-enhanced.ts`
   - `buzzword-doctor.ts`
   - `clinical-pearl-doctor.ts`

**Impact:** -10 errors in ~3 hours → Down to 98 errors

### MEDIUM PRIORITY (Next Week):
5. Merge condition-doctor + content-doctor + content-enrichment (-8 errors)
6. Fix remaining generator Prisma types (-20 errors)

**Impact:** -28 errors in ~14 hours → Down to 70 errors

### Achieve <50 Errors Target:
- Complete Phases 1-4
- Fix remaining lib/ and routes/ errors (already in progress)
- **Timeline:** 2-3 days of focused work

---

## Appendix: Package.json Scripts Usage

### Active Script References (Keep Associated Files):
```json
"orchestrate:full": "tsx ./scripts/runAutomatedPipeline.ts"
"orchestrate:context-aware": "tsx ./scripts/runContextAwareOrchestration.ts"
"db:orchestrate": "tsx ./scripts/maintenance/orchestrator.ts"
"health-check": "tsx ./scripts/contentHealthChecker.ts"
"sync:all-registries": "tsx ./scripts/syncAllRegistries.ts"
"automation:hourly": "tsx ./scripts/automation/hourlyTasks.ts"
"content-doctor:phase1": "tsx ./scripts/content-doctor.ts --phase1"
"generate:labtest-enhancer": "tsx ./scripts/generators/labtest-enhancer.ts"
```

### No Package.json Reference (Candidates for Cleanup):
- `backfillConditionData.ts` ❌
- `condition-doctor.ts` (run manually via docs)
- `content-enrichment.ts` ❌
- All `*-entry-generator.ts` files ❌

---

## Next Steps

1. **Get User Approval** for Phase 1-2 deletions/deprecations
2. **Create** `scripts/deprecated/` directory structure
3. **Move** entry generators (don't delete yet, preserve history)
4. **Delete** migration scripts after confirming no dependencies
5. **Update** tsconfig.json to exclude `scripts/deprecated/**`
6. **Run** typecheck to confirm error reduction
7. **Commit** with detailed message documenting rationale
8. **Plan** Phase 3 merge strategy for content doctors

**Estimated Timeline to <50 Errors:** 2-3 days with focused effort on Phases 1-4.
