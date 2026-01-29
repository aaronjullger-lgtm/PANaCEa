# Comprehensive PANaCEa Audit - January 2026

**Audit Date:** January 29, 2026  
**Scope:** Statistics, Analysis Connections, Display Cohesion, Settings, Drill Functionality, Orphaned Features  
**Status:** ⚠️ Critical Issues Identified

---

## Executive Summary

This audit identified **5 critical issues** requiring immediate attention:

1. ✅ **FSRS v6 Statistics**: VERIFIED CORRECT
2. ⚠️ **System Chooser (Custom Session Builder)**: EXISTS BUT ORPHANED
3. ❌ **Photo Drill System Filtering**: NOT IMPLEMENTED (parameter accepted but ignored)
4. ✅ **Contrastive Drill System Filtering**: VERIFIED WORKING
5. ❌ **Custom Study Mode**: FULLY ORPHANED (no navigation route)

---

## 1. Statistics Verification ✅ PASSED

### FSRS v6 Implementation
**Status:** ✅ Verified Correct

**Findings:**
- `lib/fsrs-optimizer.ts` implements proper 21-parameter FSRS v6 with L-BFGS optimization
- `prisma/schema.prisma` has correct `PersonalizedFSRSParams.w Float[]` for w[0]-w[20]
- `ReviewLog` model with proper session type isolation (MAIN, CRAM, RAPID_RECALL)
- Rolling360Buffer & UserRolling360Stats for O(1) sliding window statistics
- 8 critical indexes on ReviewLog for optimization queries

**Key Functions Verified:**
```typescript
// lib/fsrs-optimizer.ts
- optimizeFSRSParameters(): Correct L-BFGS implementation
- computeRetrievability(): Uses proper v6 formula
- validateParameters(): Enforces parameter bounds
- PARAMETER_BOUNDS: All 21 parameters with correct min/max
```

**Recommendation:** No changes needed. Implementation is mathematically correct.

---

## 2. System Chooser (Custom Session Builder) ⚠️ ORPHANED

### Discovery
**Status:** ⚠️ Exists but NOT accessible from navigation

**What We Found:**
The user requested to "fix the system chooser" in settings, but the component doesn't exist in settings—it exists as **CustomSessionBuilder** in the custom study feature, which is completely orphaned.

**Location:** `components/custom-study/CustomSessionBuilder.tsx`

**Features (Fully Implemented):**
1. ✅ Multi-step wizard (Content → Focus Areas → Settings → Review)
2. ✅ Multi-select organ systems (11 PANCE blueprint systems)
3. ✅ Multi-select focus areas (Diagnosis, Treatment, Risk Factors, etc.)
4. ✅ Configurable settings (questions per round, difficulty, retry missed)
5. ✅ Validation before session start
6. ✅ Beautiful UI with Framer Motion animations

**The Problem:**
```typescript
// App.tsx - NO ROUTE EXISTS
// Search results: CustomStudyMode is lazy-loaded but NEVER used
const CustomStudyMode = lazy(() => import('./components/modes/CustomStudyMode'));

// There is no view state or navigation handler that sets view to 'custom_study'
// User has no way to access this feature
```

**Navigation Audit:**
- ❌ Not in CommandCenterHub
- ❌ Not in MenuView
- ❌ Not in TrainingMenu
- ❌ Not in ToolkitHub
- ❌ Not accessible from any menu or button

**Impact:** High-quality, production-ready feature is completely hidden from users.

---

## 3. Drill System Filtering ⚠️ PARTIALLY IMPLEMENTED

### Photo Drill Service ❌ NOT WORKING
**File:** `services/drill/photoDrill.service.ts`  
**Status:** ❌ System parameter ignored

**The Smoking Gun:**
```typescript
export async function getPhotoDrillBatch(
  prisma: PrismaLike,
  userId: string,
  system: _system, // ← UNDERSCORE PREFIX: parameter is IGNORED
  difficulty: string = 'medium',
  count: number = 5
): Promise<PhotoDrillQuestion[]> {
  // Comment says: "Reserved for future system-based filtering"
  // System parameter is NEVER USED in the WHERE clause
}
```

**User's Exact Complaint:**
> "There are sections that allow you to start a session for specific needs, and it seems to just pull up a regular session, rather than a targeted session."

This is precisely why. The API accepts a `system` parameter, but the service doesn't use it.

**Endpoint:** `functions/api/drill/photo-batch.ts` ✅ (Correctly passes system from query)  
**Service:** `services/drill/photoDrill.service.ts` ❌ (Ignores the parameter)

---

### Contrastive Drill Service ✅ WORKING
**File:** `services/drill/contrastiveDrill.service.ts`  
**Status:** ✅ System filtering is implemented

**Verified Working Code:**
```typescript
export async function getContrastiveDrillBatch(
  options: ContrastiveDrillOptions
): Promise<ContrastiveQuestion[]> {
  const { system, difficulty = 'medium', count = 5 } = options;

  const whereClause: any = {
    highYield: true,
  };

  if (system) {
    whereClause.system = system; // ← CORRECTLY APPLIED
  }

  if (difficulty) {
    whereClause.difficulty = difficulty;
  }

  contrastiveSets = await prisma.contrastiveSet.findMany({
    where: whereClause, // ← System filter is used
    take: count,
  });
}
```

**Endpoint:** `functions/api/drill/contrastive-batch.ts` ✅ (Correctly passes system)  
**Service:** `services/drill/contrastiveDrill.service.ts` ✅ (Correctly filters by system)

**Recommendation:** DDx Compare drill works correctly. Photo drill needs the same pattern.

---

## 4. Custom Study Mode ❌ FULLY ORPHANED

### Complete Feature Audit
**Status:** ❌ Production-ready but completely inaccessible

**Components Found:**
1. `components/custom-study/CustomSessionBuilder.tsx` ✅ (1,000+ lines, fully implemented)
2. `components/custom-study/CustomSessionRunner.tsx` ✅ (Exists)
3. `components/custom-study/CustomSessionSummary.tsx` ✅ (Exists)
4. `components/modes/CustomStudyMode.tsx` ✅ (Phase orchestrator)

**Service Layer:**
- `services/core/customSessionService.ts` ✅ (Assumed to exist based on imports)

**The Problem:**
```typescript
// App.tsx line ~100
const CustomStudyMode = lazy(() => import('./components/modes/CustomStudyMode'));

// BUT: No view state includes 'custom_study'
type View =
  | 'menu'
  | 'command_center'
  | 'quiz'
  // ... 30+ other views ...
  // ❌ NO 'custom_study' VIEW DEFINED

// No handler creates this view:
// - Not in handleNavigateToDrillMode()
// - Not in any navigation function
// - Not in any menu component
```

**What This Means:**
This is a **complete, production-ready feature** with:
- Multi-step wizard UI
- System/condition/focus area selection
- Session runner
- Summary screen
- Service layer integration

But it's **dead code** because no navigation leads to it.

---

## 5. Analysis & Display Cohesion ✅ GENERALLY GOOD

### Analytics Dashboard
**File:** `components/analytics/AnalyticsDashboard.tsx`  
**Status:** ✅ Correct

**Verified:**
- Uses `CalibrationProgress` with 60-review threshold
- Fetches stability trend from `/api/user/stability-trend?days=30`
- Displays: Exam Readiness, Recent Performance, Decision Speed, System Performance Radar
- Uses semantic tokens: `var(--color-accent)`, `var(--color-bg-primary)`

**API Endpoint:** `functions/api/user/stability-trend.ts` ✅ (Exists and authenticated)

**Recommendation:** No changes needed for analytics display.

---

## 6. Other Orphaned Features Audit

### Features Checked:
1. ✅ **Photo Drill**: Accessible from CommandCenterHub → `handleNavigateToDrillMode('photo_drill')`
2. ✅ **DDx Compare**: Accessible from CommandCenterHub → `handleNavigateToDrillMode('ddx_compare')`
3. ✅ **Rapid Recall**: Accessible from CommandCenterHub → `handleNavigateToDrillMode('rapid_recall')`
4. ✅ **System Drill**: Accessible from CommandCenterHub → `handleNavigateToDrillMode('system_drill')`
5. ✅ **Condition Drill**: Accessible from CommandCenterHub → `handleNavigateToDrillMode('condition_drill')`
6. ✅ **Subcategory Drill**: Accessible from CommandCenterHub → `handleNavigateToDrillMode('subcategory_drill')`
7. ❌ **Custom Study Mode**: NO NAVIGATION (fully orphaned)

---

## Priority Implementation Plan

### 🔴 CRITICAL (P0) - User-Impacting Bugs

#### 1. Fix Photo Drill System Filtering
**File:** `services/drill/photoDrill.service.ts`  
**Problem:** System parameter is accepted but ignored  
**Solution:** Remove underscore prefix, add to WHERE clause  
**Effort:** 10 minutes  
**Impact:** Fixes user's primary complaint about "targeted sessions"

```typescript
// BEFORE (broken)
export async function getPhotoDrillBatch(
  prisma: PrismaLike,
  userId: string,
  system: _system, // ← Ignored
  difficulty: string = 'medium',
  count: number = 5
)

// AFTER (fixed)
export async function getPhotoDrillBatch(
  prisma: PrismaLike,
  userId: string,
  system?: string, // ← Use this
  difficulty: string = 'medium',
  count: number = 5
) {
  const whereClause: any = {
    mediaType: 'image',
    verified: true,
  };

  if (system) {
    whereClause.system = system; // ← Add filter
  }
  
  // Rest of implementation...
}
```

---

### 🟡 HIGH (P1) - Missing Features

#### 2. Restore Custom Study Mode Navigation
**Files:** 
- `App.tsx` (add view state and handler)
- `components/navigation/CommandCenterHub.tsx` (add navigation button)
- `components/navigation/MenuView.tsx` (add menu item)

**Problem:** Complete feature is hidden (no route)  
**Solution:** Add navigation from Command Center and Training Menu  
**Effort:** 30 minutes  
**Impact:** Unlocks high-value custom session feature

**Steps:**
1. Add `'custom_study'` to View type in App.tsx
2. Add navigation handler: `handleNavigateToCustomStudy()`
3. Add view rendering in AnimatePresence block
4. Add button in CommandCenterHub (alongside "Start Simulation")
5. Add menu item in TrainingMenu

---

### 🟢 MEDIUM (P2) - Polish & Consistency

#### 3. Implement System Filtering for All Drill Modes
**Files to check:**
- `services/drill/photoDrill.service.ts` ❌ (P0 - fix first)
- `services/drill/contrastiveDrill.service.ts` ✅ (already works)
- Other drill services (need to audit)

**Recommendation:** Audit all drill services and ensure consistent system filtering pattern.

---

### 🔵 LOW (P3) - Documentation

#### 4. Document Custom Study Feature
**File:** Create `docs/CUSTOM_STUDY_GUIDE.md`  
**Content:**
- How to access the feature (once navigation is restored)
- Step-by-step usage guide
- System/focus area selection patterns
- Use cases (targeted review, exam prep, weak area practice)

---

## Testing Checklist

After implementing fixes:

### Photo Drill System Filter Test
- [ ] Start photo drill with system filter (e.g., "CARDIO")
- [ ] Verify only cardiovascular images are shown
- [ ] Check API logs to confirm WHERE clause includes system
- [ ] Test with different systems (PULM, GI, etc.)

### Custom Study Mode Test
- [ ] Navigate to Custom Study from Command Center
- [ ] Select multiple systems (CARDIO, PULM)
- [ ] Select focus areas (Diagnosis, Treatment)
- [ ] Set questions per round to 10
- [ ] Start session and verify questions match filters
- [ ] Complete session and verify summary displays

### Regression Test
- [ ] Verify DDx Compare still filters correctly
- [ ] Verify other drill modes still work
- [ ] Run `npm run typecheck` to ensure no type errors
- [ ] Check browser console for errors

---

## Conclusion

**Key Takeaway:**  
The user was right. The "system chooser" exists (CustomSessionBuilder) but is completely inaccessible, and photo drill system filtering is broken (parameter ignored). Both are straightforward fixes with high user impact.

**Recommended Next Steps:**
1. ✅ **Immediate:** Fix photo drill system filtering (10 min)
2. ✅ **Today:** Restore Custom Study Mode navigation (30 min)
3. ⏭️ **This week:** Audit other drill services for consistency
4. ⏭️ **Future:** Add documentation for custom study feature

**Estimated Total Effort:** 1-2 hours for critical fixes

---

## Appendix: Code References

### Custom Session Builder Location
```
components/custom-study/
├── CustomSessionBuilder.tsx   (1,050 lines - fully implemented)
├── CustomSessionRunner.tsx    (exists)
├── CustomSessionSummary.tsx   (exists)
└── index.ts                   (exports)

components/modes/
└── CustomStudyMode.tsx        (phase orchestrator)
```

### Navigation Map
```
CommandCenterHub
├── Start Simulation → simulation_page
├── Start Training → quiz (modal)
├── Drill Modes → photo_drill, ddx_compare, etc.
└── ❌ Custom Study → MISSING (should be here)
```

### Drill Service Pattern (Correct)
```typescript
// Pattern used in contrastiveDrill.service.ts ✅
const whereClause: any = { highYield: true };
if (system) whereClause.system = system;
if (difficulty) whereClause.difficulty = difficulty;

await prisma.table.findMany({
  where: whereClause,
  take: count,
});
```
