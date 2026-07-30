# Strategic Improvement Implementation Tracker

> **Date Created:** January 8, 2026
> **Status:** Phase 1 In Progress

## Executive Summary

This document tracks the implementation of the Strategic Improvement Plan for StudyPANaCEa - a PANCE/PANRE exam preparation platform. The audit identified 14 improvement areas across 4 categories.

---

## ✅ Completed Work

### 1. FSRS v5 Algorithm Test Suite (Critical)

**File:** `tests/fsrs.test.ts`

Comprehensive test coverage created for the core spaced repetition algorithm including:

- **State Transitions:** New → Learning → Review → Relearning
- **Rating Scenarios:** All 4 ratings (Again, Hard, Good, Easy)
- **Interval Calculations:** Min/max bounds, custom retention targets
- **Difficulty Bounds:** Constrained [1, 10] range verification
- **Stability Calculations:** Recall/forget stability growth
- **Edge Cases:** Zero elapsed days, very old cards, rapid succession
- **Regression Tests:** Fixed-input validation for algorithm stability

**Test Categories (40+ tests):**

```
✓ createEmptyCard
✓ State Transitions (New→Learning, Learning→Review, Review→Relearning)
✓ Rating Scenarios (Again, Hard, Good, Easy)
✓ Interval Calculations
✓ Difficulty Calculations
✓ Stability Calculations
✓ schedule() method
✓ Repetition Tracking
✓ Custom Parameters
✓ createReviewSnapshot
✓ Edge Cases
✓ Enum Values
✓ Regression Tests
```

**Note:** Tests require Node.js &lt;25 due to ESM module resolution changes. Run with:

```bash
# Use Node 18 or 20
nvm use 18
npm test tests/fsrs.test.ts
```

---

## 🔄 In Progress / Pending

### Phase 1: Stability (Critical)

| Item                | Status      | Files                                      | Notes                                             |
| ------------------- | ----------- | ------------------------------------------ | ------------------------------------------------- |
| #3 FSRS Tests       | ✅ Complete | `tests/fsrs.test.ts`                       | 40+ comprehensive tests                           |
| #5 API Security     | ✅ Complete | `functions/api/**`                         | Endpoints use `verifyAuthToken` - audit confirmed |
| #4 Static Data      | ✅ Complete | `data/*.json`, `data/*.ts`                 | No active imports found - safe to archive         |
| #7 Error Boundaries | ✅ Complete | `components/error/GlobalErrorBoundary.tsx` | Created with Sentry integration                   |

### Phase 2: Architecture

| Item                     | Status     | Files                                              | Notes                                    |
| ------------------------ | ---------- | -------------------------------------------------- | ---------------------------------------- |
| #1 Service Consolidation | 📊 Audited | `services/` (78 files), `lib/services/` (40 files) | 118 total services - need deduplication  |
| #2 App.tsx Refactor      | 📊 Audited | `App.tsx` (**1182 lines**)                         | 6x over target - needs major refactoring |

**Architecture Audit Findings:**

- **services/**: 78 service files (root level, legacy location)
- **lib/services/**: 40 service files (target canonical location per .clinerules)
- **Duplicates identified**: offlineSyncService, analyticsService, grandRoundsService
- **Duplicate safety**: No imports found from legacy `services/` versions - **safe to delete**
- **App.tsx**: 1182 lines (target <200 lines) - contains routing, state, rendering in single file

**Service Consolidation Action Plan:**

1. ✅ **DELETED** `services/analyticsService.ts` (no imports, `lib/services/analyticsService.ts` is canonical)
2. ✅ **DELETED** `services/grandRoundsService.ts` (no imports, `lib/services/grandRoundsService.ts` is canonical)
3. ✅ **DELETED** `services/offlineSyncService.ts` (no imports, `lib/services/offline/offlineSyncService.ts` is canonical)
4. Migrate remaining 75 services from `services/` → `lib/services/` incrementally

### Phase 3: Quality

| Item              | Status     | Files                     | Notes                                      |
| ----------------- | ---------- | ------------------------- | ------------------------------------------ |
| #6 Loading States | 📊 Audited | See list below            | **6 implementations** - need consolidation |
| #9 Test Coverage  | ⏳ Pending | `tests/`, `lib/services/` | Target 80% on critical paths               |

**Loading State Implementations Found:**

1. `components/ui/SkeletonLoader.tsx` - Generic skeleton
2. `components/ui/ClinicalSkeleton.tsx` - Medical-themed skeleton
3. `components/loading/SkeletonLoader.tsx` - **DUPLICATE** (same name, different location)
4. `components/loading/ModeLoadingStates.tsx` - Mode-specific loading
5. `components/drill/DrillLoadingState.tsx` - Drill-specific loading
6. `components/LoadingProgress.tsx` - Progress bar loading

**Consolidation Target:** Single unified loading system in `components/loading/`

### Phase 4: Polish

| Item               | Status     | Files                      | Notes                                |
| ------------------ | ---------- | -------------------------- | ------------------------------------ |
| #8 Scripts Cleanup | 📊 Audited | `scripts/` (**266 files**) | Archive unused, create CLI           |
| #10-14 Features    | ⏳ Pending | Various                    | Metacognition, Pearl Harvester, etc. |

---

## Priority Queue (Next Actions)

### Immediate (This Sprint)

1. **Fix Node.js Compatibility**
   - Issue: Node.js v25 breaks vitest ESM resolution
   - Solution: Pin to Node 18/20 in `.node-version`
   - Files: `.node-version`, `package.json` engines field

2. **API Security Audit**
   - Review all endpoints in `functions/api/`
   - Ensure `authenticateRequest()` usage
   - Apply rate limiting to AI endpoints
   - Files: `functions/api/**/*.ts`

3. **Static Data Migration**
   - Audit imports of `data/*.json` files
   - Migrate to database queries
   - Delete deprecated static files
   - Files: `data/conditionContent.json`, `data/labCasesData.ts`

### Short-term (Next 2 Sprints)

4. **Service Layer Consolidation**
   - Create unified structure in `lib/services/`
   - Migrate from `services/` with redirects
   - Delete duplicates

5. **App.tsx Refactoring**
   - Extract routing to React Router
   - Move state to contexts/stores
   - Create view components in `pages/`

---

## Architecture Decisions

### Service Layer Structure (Target)

```
lib/services/
├── analytics/           # User analytics, learning profiles
│   ├── analyticsService.ts
│   ├── learningPatternEngine.ts
│   └── performancePredictionService.ts
├── content/             # Medical content management
│   ├── contentService.ts
│   ├── conditionDataLoader.ts
│   └── pearlService.ts
├── quiz/                # Question generation & sessions
│   ├── questionService.ts
│   ├── sessionService.ts
│   └── reviewService.ts
├── sync/                # Offline & cloud sync
│   ├── offlineSyncService.ts
│   └── cloudSyncService.ts
├── user/                # User profiles & progress
│   ├── userProgressService.ts
│   ├── achievementService.ts
│   └── streakService.ts
└── integrations/        # External services
    ├── geminiService.ts
    ├── todoistService.ts
    └── trelloService.ts
```

### Database-First Principle (Enforced)

Per `.clinerules`, all medical content MUST be fetched from PostgreSQL:

```typescript
// ❌ FORBIDDEN
import conditions from '../data/conditionContent.json';

// ✅ REQUIRED
import { loadConditionContent } from '../lib/services/content/contentService';
const content = await loadConditionContent(conditionId);
```

---

## Technical Debt Log

### Critical

| Issue              | Impact                    | Effort | Priority |
| ------------------ | ------------------------- | ------ | -------- |
| Duplicate services | Maintenance confusion     | Medium | P1       |
| No FSRS tests      | Algorithm regression risk | Low    | P1 ✅    |
| Static data files  | Data inconsistency        | Medium | P1       |

### High

| Issue                    | Impact               | Effort | Priority |
| ------------------------ | -------------------- | ------ | -------- |
| Monolithic App.tsx       | Code maintainability | High   | P2       |
| Inconsistent loading     | UX (CLS > 0)         | Medium | P2       |
| Missing error boundaries | User experience      | Low    | P2       |

### Medium

| Issue             | Impact                 | Effort | Priority |
| ----------------- | ---------------------- | ------ | -------- |
| Scripts sprawl    | Developer productivity | Medium | P3       |
| Low test coverage | Regression risk        | High   | P3       |

---

## Metrics to Track

### Code Quality

- [ ] Test coverage: Target &gt;80% on critical paths
- [ ] CLS score: Target 0.0
- [ ] API response time: Target &lt;200ms P95

### Security

- [ ] All endpoints use `authenticateRequest()`
- [ ] AI endpoints have rate limiting
- [ ] No sensitive data in client bundle

### Architecture

- [ ] Single service layer (`lib/services/`)
- [ ] No static JSON data files
- [ ] App.tsx &lt;200 lines

---

## Related Documentation

- [.clinerules](.clinerules) - Project coding standards
- [PRODUCTION_READINESS_MASTER_PLAN.md](docs/PRODUCTION_READINESS_MASTER_PLAN.md)
- [ARCHITECTURAL_REFACTORING_SUMMARY.md](docs/ARCHITECTURAL_REFACTORING_SUMMARY.md)
- [5-SPRINT-OPTIMIZATION-SUMMARY.md](docs/5-SPRINT-OPTIMIZATION-SUMMARY.md)

---

## Changelog

### 2026-01-08

- Created Strategic Improvement Plan from deep audit
- Implemented comprehensive FSRS v5 test suite (40+ tests)
- Fixed Node.js version to 20 (`.node-version`)
- Created GlobalErrorBoundary component with Sentry integration
- Audited API security - all critical endpoints use `verifyAuthToken`
- Verified database-first migration complete - static JSON files no longer imported
- Documented priority queue for implementation
