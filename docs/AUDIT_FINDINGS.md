# Full Site Audit Findings

**Date:** 2026-02-01  
**Scope:** Lint, TypeScript, tests, build, and codebase scan.

---

## Summary

| Check | Result | Count / Notes |
|-------|--------|----------------|
| **ESLint** | ❌ Fail | 9,911 problems (15 errors, 9,896 warnings). `--max-warnings 0` causes exit 1. |
| **TypeScript** | ❌ Fail | ~200+ unique TS errors across app, components, functions, lib. |
| **Unit tests** | ✅ Pass | 406 tests, 31 files. |
| **Build** | ✅ Pass | Vite build succeeds; chunk size warning for 700KB+ chunks. |

---

## 1. ESLint

- **Errors (15):** Unused vars / no-explicit-any in strict mode.
- **Warnings (9,896):** Mostly:
  - `@typescript-eslint/no-unused-vars` (unused imports, params, vars)
  - `react-hooks/exhaustive-deps` (missing deps in useCallback/useEffect)
  - `@typescript-eslint/no-explicit-any`
  - `react-refresh/only-export-components`
  - `no-console` (use warn/error only)
- **Fixable:** 5 warnings (auto-fix with `npm run lint:fix`).

---

## 2. TypeScript (high-impact / user-facing)

### App & shell

- **App.tsx:** `MyPearlsPanel` used but not in lazyComponents / not imported → add to lazyComponents and import.
- **components/error/index.ts:** `../GeminiErrorBoundary` wrong path (file is in same folder) → use `./GeminiErrorBoundary`.

### Components

- **MyPearlsPanel.tsx:** `Zap` used but not imported from lucide-react.
- **AnalyticsDashboard.tsx:** `performanceData` undefined in scope at 302–303; recharts `recharts/es6/cartesian/Bar` has no declaration → use `Bar` from `recharts` or add declaration.
- **StudyCalendar.tsx:** `ChevronDown` not defined → add import.
- **TopicMasteryBreakdown.tsx (analytics + dashboard):** `colors` possibly undefined; dashboard uses `CLINICAL_PEARL` not on type.
- **UserFriendlyStatsDisplay.tsx:** `string` not assignable to `"improving" | "declining" | "neutral"` → narrow or assert type.
- **GapAnalysisDashboard.tsx:** `data` possibly null → add guards or optional chaining.
- **DdxTrainer.tsx:** `../Loader` not found → use `@/components/loading/Loader` or correct path.
- **ContrastiveDrillSession.tsx:** `isStarting` does not exist on `DrillLandingPageProps`.
- **SessionSetupModal, ConditionDetailModal, MenuView, etc.:** `../types`, `@src/constants`, `@src/types/conditions`, `@src/lib/...` module not found → align with actual paths/aliases (`@/` or `./`).

### Functions (Edge/API)

- **prisma-edge.ts:** Circular type reference; cache/cached implicit any.
- **middleware.ts:** `string[]` not assignable to union of env names.
- **auth.test.ts:** `number | undefined` not assignable to `number`.
- **srs-summary.ts:** `resolveUserId` not found.
- **pool.ts:** `fisherYatesShuffle` not found; `imageUrl` not on type.
- **user/pearls.ts, user/fsrs-params.ts, user/statistics.ts:** Wrong auth/env types, missing request, missing module `userStatisticsService`.
- **taskTypes:** `getTaskTypeFromContent` not exported but used by srs/next, srs/submit, topic-progress.

### Lib & services

- **lib/dashboardUtils.ts:** `string | undefined` passed to `Date`/overloads.
- **lib/loadConditions.ts:** `null` not assignable to `Record<string, unknown>`.
- **lib/middleware/validation.ts:** Not all code paths return a value.
- **lib/fsrs.ts, lib/fsrs-optimizer.ts, lib/nccpa-blueprint.ts:** Possibly undefined / strict null issues.

---

## 3. Tests

- All 406 tests pass.
- Expected stderr in a few tests (e.g. stagingQuestionService “Invalid or empty AI response”, clerkAuth “CLERK_SECRET_KEY is not configured”, offlineSync “Failed to process queued request”).

---

## 4. Build

- Succeeds.
- Warning: some chunks &gt; 700KB (e.g. SettingsStatsModal, MenuView, index).
- Note: `routes/**/*` excluded from tsconfig; typecheck still runs over included code and reports the TS errors above.

---

## 5. Recommended fix order

1. **P0 – Broken references (fix first)**  
   - App: add `MyPearlsPanel` to lazyComponents and import in App.  
   - error/index: fix GeminiErrorBoundary path to `./GeminiErrorBoundary`.  
   - MyPearlsPanel: add `Zap` import.  
   - DdxTrainer: fix Loader path.  
   - AnalyticsDashboard: fix `performanceData` scope and Bar import.

2. **P1 – Types and null safety**  
   - TopicMasteryBreakdown `colors` and CLINICAL_PEARL.  
   - UserFriendlyStatsDisplay trend literal type.  
   - GapAnalysisDashboard `data` null checks.  
   - StudyCalendar `ChevronDown` import.

3. **P2 – Paths and modules**  
   - Replace `@src/` and `../types` with correct aliases (`@/`, `@/types`, etc.) and add missing modules or re-exports.

4. **P3 – Lint**  
   - Run `npm run lint:fix`; then address remaining errors and high-value warnings (unused vars, deps, any).

5. **P4 – Functions and lib**  
   - prisma-edge types, middleware env type, auth/test types, pool.ts and taskTypes exports, user stats/pearls/fsrs-params types.

---

## 6. Fixes applied (this pass)

- **App.tsx:** Added `MyPearlsPanel` to `config/lazyComponents.tsx` and imported it in App so the pearl deck view resolves.
- **components/error/index.ts:** Fixed GeminiErrorBoundary import path from `../GeminiErrorBoundary` to `./GeminiErrorBoundary`.
- **components/pearls/MyPearlsPanel.tsx:** Added missing `Zap` import from lucide-react.
- **components/modes/DdxTrainer.tsx:** Fixed Loader import from `../Loader` to `../loading/Loader`.
- **components/analytics/AnalyticsDashboard.tsx:** Destructured `performanceData` from props with default `[]`; removed `recharts/es6/cartesian/Bar` and use `Bar` from `recharts`.
- **components/analytics/WorkloadChart.tsx:** Use `Bar` from main `recharts` import instead of `recharts/es6/cartesian/Bar`.
- **components/analytics/StudyCalendar.tsx:** Added missing `ChevronDown` import from lucide-react.
- **components/analytics/TopicMasteryBreakdown.tsx:** Introduced `DEFAULT_MASTERY_COLORS` and use it as fallback so `colors` is never undefined in the topic row.
- **components/analytics/UserFriendlyStatsDisplay.tsx:** Cast `sys.trend` to `'improving' | 'declining' | 'neutral'` at all four `SystemStrengthBar` call sites.

**Still to fix (for a future pass):** Remaining TS errors (path aliases `@src/`, `../types`, missing modules, GapAnalysisDashboard `data` null, dashboard TopicMasteryBreakdown CLINICAL_PEARL, QuizView/getMetrics/nextReview, EnhancedSettingsTab profile type, functions/api and lib strict null/typing). Lint: 9,911 issues (run `npm run lint:fix` for 5 auto-fixable; then address remaining incrementally).

---

## 7. Re-audit

After applying fixes:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. Manual or E2E pass on dashboard, drills, settings, and pearl deck.
