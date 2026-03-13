# PANaCEa: Top 5 Priority Improvements

**Generated:** January 25, 2026  
**Last Updated:** January 25, 2026  
**Audit Focus:** Build integrity, app functionality, design, critical modes/stats

---

## Current State Summary

| Metric | Value | Status |
|--------|-------|--------|
| **Build Status** | ✅ Passes (16.7s) | Production-ready |
| **TypeScript Errors** | ~~1,120~~ **951** | ⚠️ In progress (-169 fixed, 15% reduction) |
| **Test Suite** | 392/393 pass | ✅ Excellent (1 FSRS precision issue) |
| **Bundle Size** | 5MB JS / 51MB total | ⚠️ Large |
| **Sentry Integration** | ❌ Misconfigured | Non-blocking |

### Progress Log
- **Session 1:** Fixed 169 TypeScript errors across 12 files
- Files completed: `micro-kinetics.ts`, `typing-rhythm.ts`, `advancedUserAnalyticsEngine.ts`, `patientEncounterGenerator.ts`, `statisticalAnalysis.ts`, `mediaMatcherUtils.ts`, `circadianAnalyticsService.ts`, `mobileOptimization.ts`, `ageFormatter.ts`, `poolMonitorService.ts`, `enhancedQuestionPool.ts`, `reviewService.ts`
- Fixed import paths in `routes/questions.ts`
- Build verified: ✅ Passes

### Error Distribution (Production Code)
| Category | Error Count | Priority |
|----------|-------------|----------|
| `lib/` | ~~82~~ ~50 | 🟡 MEDIUM |
| `services/` | ~~89~~ ~60 | 🟡 MEDIUM |  
| `scripts/` | 449 | 🟡 MEDIUM (dev-only) |
| `routes/` | ~~46~~ ~30 | 🟡 MEDIUM |
| `components/` | 8 | 🟢 LOW |

---

## 🎯 PRIORITY #1: Fix Production TypeScript Errors

**Impact:** Runtime safety, IDE experience, maintenance burden  
**Effort:** 4-6 hours  
**Files:** 15 high-priority files

### Problem
~~1,120~~ **951** TypeScript errors remain. While Vite builds despite these (using transpileOnly behavior), they represent real runtime risks—array index access returning `undefined`, type mismatches, and missing null checks.

### ✅ Completed Files
```
✅ 27 errors: lib/micro-kinetics.ts (mouse telemetry)
✅ 21 errors: lib/typing-rhythm.ts (typing patterns)  
✅ 14 errors: services/domain/patientEncounterGenerator.ts
✅ 14 errors: services/advancedUserAnalyticsEngine.ts
✅ 13 errors: services/ai/poolMonitorService.ts
✅ 13 errors: lib/utils/statisticalAnalysis.ts
✅ 11 errors: services/core/enhancedQuestionPool.ts
✅ 11 errors: lib/services/review/reviewService.ts
✅ 11 errors: lib/mediaMatcherUtils.ts
✅ 10 errors: lib/utils/mobileOptimization.ts
✅  9 errors: services/circadianAnalyticsService.ts
✅  8 errors: lib/utils/ageFormatter.ts
```

### Remaining High-Priority Files
```
28 errors: routes/questions.ts (import paths fixed, return types remain)
14 errors: routes/pearls.ts
11 errors: routes/games.ts
 8 errors: lib/services/autoAuthor/index.ts
 8 errors: lib/services/questionHistoryService.ts
 8 errors: components/library/DDxMatrixView.tsx
```

### Fix Pattern
Most errors are array index access issues requiring nullish coalescing:
```typescript
// Before (unsafe)
const value = array[index];

// After (safe)
const value = array[index] ?? defaultValue;
```

### Implementation Plan
1. Fix `lib/micro-kinetics.ts` and `lib/typing-rhythm.ts` first (behavioral telemetry)
2. Fix `services/advancedUserAnalyticsEngine.ts` (analytics core)
3. Fix `services/domain/patientEncounterGenerator.ts` (patient simulator)
4. Fix remaining `lib/` and `services/` files
5. Run `npm run typecheck` to verify < 200 remaining (scripts can be addressed later)

---

## 🎯 PRIORITY #2: Optimize Bundle Size & Chunking

**Impact:** Initial load time, PWA performance, mobile UX  
**Effort:** 3-4 hours  
**Metric:** Reduce main bundle from 831KB → 400KB

### Problem
Current largest bundles:
```
831KB: index-4jfjlN9P.js (main entry)
671KB: SettingsStatsModal-D846n8pi.js  
461KB: MenuView-WYGZZVG3.js
291KB: CommandCenterHub-CiMKtSpo.js
269KB: CategoricalChart-B7_4HguR.js (Recharts)
```

### Issues Identified
1. **SettingsStatsModal (671KB)** - Should be lazy-loaded, rarely used
2. **MenuView (461KB)** - Contains too much inline logic
3. **Recharts (269KB)** - Consider tree-shaking or lighter alternative
4. **html2canvas (203KB)** - Only needed for screenshot export

### Implementation Plan
1. Add manual chunks in `vite.config.ts`:
```typescript
manualChunks: {
  'vendor-charts': ['recharts'],
  'vendor-export': ['html2canvas'],
  'feature-settings': ['./components/SettingsStatsModal'],
}
```
2. Lazy-load SettingsStatsModal with `React.lazy()`
3. Lazy-load html2canvas only when export button clicked
4. Target: Main bundle < 500KB, total JS < 4MB

---

## 🎯 PRIORITY #3: Stabilize FSRS Statistics Pipeline

**Impact:** Learning accuracy, spaced repetition effectiveness  
**Effort:** 4-6 hours  
**Core Files:** `lib/fsrs.ts`, `services/advancedUserAnalyticsEngine.ts`

### Problem
The FSRS v6 implementation has 21 parameters (w[0]-w[20]) but several services access array indices unsafely. This can cause:
- Silent NaN propagation in scheduling calculations
- Incorrect review intervals
- Stale cognitive state estimates

### Current State
✅ Core FSRS (`lib/fsrs.ts`) - Fixed with nullish coalescing  
⚠️ Analytics engine (`advancedUserAnalyticsEngine.ts`) - 14 errors remain  
⚠️ Circadian service (`circadianAnalyticsService.ts`) - 9 errors  
⚠️ Session momentum (`sessionMomentumService.ts`) - Needs verification  

### Data Integrity Concerns
1. **SystemMasteryProfile** interface changed - verify all consumers updated
2. **DeepAnalyticsStore** localStorage keys - ensure backward compatibility
3. **CognitiveState** calculations - validate against null inputs

### Implementation Plan
1. Audit all `panceai_*` localStorage keys for schema consistency
2. Fix remaining TypeScript errors in analytics services
3. Add runtime validation for FSRS parameter arrays
4. Create integration test for full learning cycle:
   ```
   New card → Review → FSRS scheduling → Stats update → Dashboard display
   ```
5. Verify "Statistical Quarantine" rule: Only `session_type = 'MAIN'` affects weights

---

## 🎯 PRIORITY #4: Complete Drill Mode End-to-End Testing

**Impact:** Core study functionality, user engagement  
**Effort:** 6-8 hours  
**Modes:** 10 drill types identified

### Drill Modes Inventory
| Mode | Hook | Component | Status |
|------|------|-----------|--------|
| Photo Drill | `use-photo-drill.ts` | `PhotoDrillSession.tsx` | ✅ Fixed |
| Mini Lab | `use-mini-lab-drill.ts` | `MiniLabDrillSession.tsx` | ✅ Fixed |
| DDx Drill | `use-ddx-drill.ts` | `DDxDrillSession.tsx` | ✅ Fixed |
| First-Line | `use-first-line-drill.ts` | `FirstLineDrillSession.tsx` | ✅ Fixed |
| Guideline | `use-guideline-drill.ts` | `GuidelineDrillSession.tsx` | ✅ Fixed |
| Contrastive | `use-contrastive-drill.ts` | `ContrastiveDrillSession.tsx` | ⚠️ Needs test |
| Pharm | `use-pharm-drill.ts` | `PharmDrillSession.tsx` | ⚠️ Needs test |
| Anatomy | `use-anatomy-drill.ts` | `AnatomyDrillSession.tsx` | ⚠️ Needs test |
| Physiology | `use-physiology-drill.ts` | `PhysiologyDrillSession.tsx` | ⚠️ Needs test |
| Ventilator | `use-ventilator-drill.ts` | `VentilatorDrillSession.tsx` | ⚠️ Needs test |

### Missing E2E Coverage
No Playwright tests exist for drill modes. Users may encounter:
- Broken question loading from database
- Statistics not persisting
- Incorrect answer validation

### Implementation Plan
1. Create `e2e/drills/` test directory
2. Write smoke test for each drill mode:
   - Start drill → Answer question → Verify feedback → Check stats update
3. Add visual regression tests for drill UI
4. Test offline mode behavior (PWA cache)
5. Add performance assertions (< 2s question load)

---

## 🎯 PRIORITY #5: Design System Consistency

**Impact:** User trust, professional appearance, accessibility  
**Effort:** 4-6 hours  
**Focus:** Clinical palette, component patterns, loading states

### Current Design Tokens
```css
/* From copilot-instructions.md */
Text: slate-700 (light) / slate-100 (dark)
Accent: blue-600 / blue-400
Cards: rounded-xl, hover:translate-x-1
Motion: ease-out, 0.2-0.3s duration
Icons: Lucide
```

### Issues Identified
1. **Inconsistent Loading States**
   - Some components use `Loader.tsx`, others use inline spinners
   - No skeleton screens for data-heavy components

2. **Error State Gaps**
   - `GeminiErrorBoundary.tsx` exists but not consistently used
   - Missing fallback UI for drill data loading failures

3. **Accessibility Gaps**
   - No visible focus indicators on some interactive elements
   - Contrast ratios may not meet WCAG AA in some color combinations

4. **Mobile Responsiveness**
   - Large tables overflow on mobile (e.g., IntelligenceHub)
   - Touch targets may be too small for some buttons

### Implementation Plan
1. Create `components/ui/` shared component library:
   ```
   Button.tsx, Card.tsx, Skeleton.tsx, ErrorState.tsx
   ```
2. Audit all drill components for consistent loading/error patterns
3. Add `@container` queries for responsive drill cards
4. Run axe-core accessibility audit
5. Add Storybook for design system documentation

---

## Implementation Order

| Week | Priority | Deliverable |
|------|----------|-------------|
| 1 | #1 TypeScript | < 200 errors, all production code fixed |
| 1 | #2 Bundles | Main bundle < 500KB |
| 2 | #3 FSRS | Verified stats pipeline with tests |
| 2 | #4 Drills | Playwright smoke tests for all modes |
| 3 | #5 Design | Shared component library, a11y audit |

---

## Quick Wins (< 1 hour each)

1. **Fix Sentry config** - Add `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` to Cloudflare env
2. **Remove unused scripts** - Archive 50+ rarely-used npm scripts
3. **Add bundle analyzer** - `npm run build -- --analyze` for ongoing monitoring
4. **Enable TypeScript strict incrementally** - Add `// @ts-strict` to new files

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| TypeScript errors | 1,120 | < 50 |
| Main bundle size | 831KB | < 500KB |
| Total JS | 5MB | < 4MB |
| Lighthouse Performance | TBD | > 90 |
| E2E test coverage | 0% drills | 100% drills |
| WCAG compliance | Partial | AA |

---

*Document generated from comprehensive repository audit. Implementation should be iterative with CI verification at each step.*
