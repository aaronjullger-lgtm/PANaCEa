# Architecture Integrity Report — PANaCEa "Nervous System" Audit

**Date:** 2026-01-31  
**Scope:** Database ↔ Service Layer ↔ Edge API ↔ Frontend Types  
**Convention:** Edge-safe APIs, singleton Prisma, type sync (Zod ↔ Prisma), service isolation.

---

## 1. Edge safety

**Rule:** No Node-only APIs in `functions/api` or in `lib/` code used by Edge (e.g. `fs`, `path`, `crypto`, `os`).

**Result:** No violations.

- No `fs`, `path`, `crypto`, or `os` imports in `functions/` or `lib/`.
- Payload size in `functions/api/_shared/zodSchemas.ts` uses `TextEncoder` (Web API), not `Buffer`.

**Action:** None.

---

## 2. Connection pooling (Prisma)

**Rule:** Use the singleton from `@/lib/prisma` (or equivalent) everywhere except Edge handlers. In `functions/api/*`, use `createEdgePrismaClient(env.DATABASE_URL)` and disconnect in `finally`. Never call `new PrismaClient()` in app/service code.

### 2.1 Edge API (`functions/api/*`)

**Result:** Compliant.

- All checked handlers use `createEdgePrismaClient` from `../_shared/prisma-edge` (or relative equivalent) and `safePrismaDisconnect` in `finally`.

### 2.2 Violations — `new PrismaClient()` in lib/services and services/

**Status:** Fixed (2026-01-31). All listed files now use the singleton.

| # | File | Status |
|---|------|--------|
| 1 | `lib/services/sync/registrySync.ts` | ✅ Uses `import { prisma } from '../../prisma'` |
| 2 | `lib/services/autoAuthor/databaseService.ts` | ✅ Uses `import { prisma } from '@/lib/prisma'` |
| 3 | `lib/services/referenceService.ts` | ✅ Uses `import { prisma } from '../prisma'` |
| 4 | `services/core/enhancedQuestionPool.ts` | ✅ Receives prisma as parameter (no change needed) |
| 5 | `services/core/poolMonitorService.ts` | ✅ Uses `import { prisma } from '@/lib/prisma'` |
| 6 | `lib/services/streakService.ts` | ✅ Migrated from `getPrismaClient` to `import { prisma } from '../prisma'` |
| 7 | `lib/services/socialService.ts` | ✅ Migrated from `getPrismaClient` to `import { prisma } from '../prisma'` |
| 8 | `lib/services/achievementService.ts` | ✅ Migrated from `getPrismaClient` to `import { prisma } from '../prisma'` |

### 2.3 Special cases

- **`lib/prisma.ts`** — Singleton factory; uses `new PrismaClient()` internally. OK.
- **`lib/db.ts`** — Exports `getPrismaClient()` with Accelerate. Previously used by streakService, socialService, achievementService; those now use `lib/prisma`. `lib/db.ts` is retained for Edge/Accelerate use cases if needed.
- **`scripts/**`** — One-off scripts; using `new PrismaClient()` per script is acceptable. No change required for this audit.
- **`prisma/config.ts`** — Config / generator; OK.

### 2.4 Correct patterns (for reference)

- **Edge:** `createEdgePrismaClient(env.DATABASE_URL)` + `safePrismaDisconnect` in `finally`.
- **Node (app/services):** `import { prisma } from '@/lib/prisma'` or `import { prisma } from '../prisma'` (from under `lib/`).

---

## 3. Type synchronization (Zod vs Prisma)

**Rule:** Zod schemas used by the API should align with Prisma models (same logical fields; no required API fields missing in DB, no required DB fields missing in API where they're required).

### 3.1 Schema locations

- **Edge API:** `functions/api/_shared/zodSchemas.ts` and `functions/api/_shared/schemas.ts` (with `validateRequest`).
- **Express/legacy:** `lib/validation/zodSchemas.ts` (Express middleware: `Request`, `Response`, `NextFunction`). Not used by Edge.

### 3.2 Drift and inconsistencies

| Issue | Location | Status |
|-------|----------|--------|
| Two review submission shapes | `zodSchemas.ts` vs `schemas.ts` | ✅ Documented: `reviewSubmissionSchema` = legacy; `DrillSubmitReviewSchema` = canonical for `/api/drills/submit-review`. |
| Organ system casing | `zodSchemas.ts` UPPERCASE vs `schemas.ts` lowercase | ✅ Documented in both files. `organSystemSchema` = question gen; `OrganSystemSchema` = session/analytics. |
| Express-only validation | `lib/validation/zodSchemas.ts` | Note: Shared types should live in `functions/api/_shared` or shared `lib` module. |

### 3.3 Aligned areas

- **ReviewLog:** `rating`, `duration` (responseTimeMs), `review_date`, etc. match usage in submit-review flow.
- **QuestionAttempt:** `selectedAnswer`, `durationMs`, `telemetryJson` match `DrillSubmitReviewSchema` and handler.
- **StudySession** vs `sessionAnalyticsSchema` / session generation: Optional analytics fields map to `StudySession` columns; no required-field drift found.

---

## 4. Service isolation

**Rule:** API routes in `functions/api/*` should only do auth, validation, and delegation; complex business logic should live in `lib/services/*`.

### 4.1 Violations — logic that should move to services

**Status:** Fixed (2026-01-31).

| # | File | Status |
|---|------|--------|
| 1 | `functions/api/drills/submit-review.ts` | ✅ Logic extracted to `lib/services/drillReviewService.ts`. Route now: auth, validation, delegation only. |

### 4.2 Other routes

- Other sampled routes (`questions/pool.ts`, admin content, analytics) mostly validate and delegate; no additional violations called out here.
- A full file-by-file pass is recommended for any route that has >~50 lines of non-validation, non-delegation logic.

---

## 5. Summary table

| Category | Status | Violation count |
|----------|--------|-----------------|
| Edge safety | Pass | 0 |
| Connection pooling (Prisma) | Pass | 0 (all fixed) |
| Type sync (Zod vs Prisma) | Minor drift (documented) | 2 schema inconsistencies documented |
| Service isolation | Pass | 0 (submit-review extracted) |

**Last updated:** 2026-01-31. See sections 2.2, 3.2, 4.1 for fix details.

---

## 6. Auto-fix checklist and script

Use this to fix the most common issues (imports and Prisma usage). Review diffs before committing.

### 6.1 Prisma singleton (manual)

For each of the 5 files below, replace local `new PrismaClient()` with the singleton:

1. **lib/services/sync/registrySync.ts**
   - Remove: `import { PrismaClient } from '@prisma/client';` and `const prisma = new PrismaClient();`
   - Add: `import { prisma } from '../../prisma';` (or `@/lib/prisma` if alias is set).

2. **lib/services/autoAuthor/databaseService.ts**
   - Same pattern: use `import { prisma } from '@/lib/prisma'` (or correct relative path from `lib/services/autoAuthor/`).

3. **lib/services/referenceService.ts**
   - Same: `import { prisma } from '../prisma';` from `lib/services/`.

4. **services/core/enhancedQuestionPool.ts**
   - Same: `import { prisma } from '@/lib/prisma';`, remove `new PrismaClient()`.

5. **services/core/poolMonitorService.ts**
   - Same: `import { prisma } from '@/lib/prisma';`, remove `new PrismaClient()`.

If any of these are ever invoked from Edge (e.g. via a serverless function), they must receive a Prisma instance from the Edge layer (e.g. from `createEdgePrismaClient`) instead of using the Node singleton. The script below does not change that; it only standardizes on the singleton for Node usage.

### 6.2 Bash script (optional checks + placeholder fixes)

See `scripts/architecture-integrity-fixes.sh`.

Run from repo root: `chmod +x scripts/architecture-integrity-fixes.sh && ./scripts/architecture-integrity-fixes.sh`.

---

**End of report.**
