# Full Site Audit Findings

**Date:** 2026-02-01  
**Scope:** Lint, TypeScript, tests, build, and codebase scan.

---

## Summary

| Check | Result | Count / Notes |
|-------|--------|----------------|
| **ESLint** | ❌ Fail | 9,911 problems (15 errors, 9,896 warnings). `--max-warnings 0` causes exit 1. |
| **TypeScript** | ❌ Fail | ~1,061 TS errors (down from ~1,087 after second-pass fixes). |
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

## 6. Fixes applied (pass 3 – 2026-02-01)

- **App.tsx:** Added `MyPearlsPanel` to `config/lazyComponents.tsx` and imported it in App so the pearl deck view resolves.
- **components/error/index.ts:** Fixed GeminiErrorBoundary import path from `../GeminiErrorBoundary` to `./GeminiErrorBoundary`.
- **components/pearls/MyPearlsPanel.tsx:** Added missing `Zap` import from lucide-react.
- **components/modes/DdxTrainer.tsx:** Fixed Loader import from `../Loader` to `../loading/Loader`.
- **components/analytics/AnalyticsDashboard.tsx:** Destructured `performanceData` from props with default `[]`; removed `recharts/es6/cartesian/Bar` and use `Bar` from `recharts`.
- **components/analytics/WorkloadChart.tsx:** Use `Bar` from main `recharts` import instead of `recharts/es6/cartesian/Bar`.
- **components/analytics/StudyCalendar.tsx:** Added missing `ChevronDown` import from lucide-react.
- **components/analytics/TopicMasteryBreakdown.tsx:** Introduced `DEFAULT_MASTERY_COLORS` and use it as fallback so `colors` is never undefined in the topic row.
- **components/analytics/UserFriendlyStatsDisplay.tsx:** Cast `sys.trend` to `'improving' | 'declining' | 'neutral'` at all four `SystemStrengthBar` call sites.

### Additional fixes (second pass – 2026-01-31)

- **services/core/conditionDataLoader.ts:** Added local `import type { ConditionData }` so `ConditionData` is in scope for the return type (re-export kept).
- **services/core/questionService.ts (core):** `pearls: undefined` → `pearls: []`; optional chaining for `match[1]` in `extractPearlsFromRationale`; imported `calcAdaptiveStateFn` / `selectOptimalQuestionsFn` from adaptive engine and used them in the default export for correct `Parameters<typeof …>`.
- **services/core/comparisonGenerator.ts:** Built explicit `GenerateComparisonOptions` and skipped pairs with missing required fields before calling `generateComparison`.
- **services/core/drillService.ts:** `focus: null` → `focus: 'all'` to satisfy `PerformanceRecord.focus: string`.
- **services/core/customSessionService.ts:** `return state.currentQuestions[state.currentQuestionIndex] ?? null` for possibly undefined index.
- **services/core/questionSeedService.ts:** Guard `if (!seed) continue` in seed loop.
- **services/core/variantQueueService.ts:** Use `existingVariants[0]` in a variable and return its `id` only when defined.
- **services/core/wordleService.ts:** `isoDate` / `normalizedDate` with `?? ''`; `DailyWordleWithWord.Buzzword.explanation` typed as `string | null`.
- **services/domain/index.ts:** Removed duplicate `export type { StudySessionPlan }` (already exported from adaptiveFSRSService).
- **lib/apiClient.ts:** New file – re-exports `API_ENDPOINTS` (with `SYSTEM_PERFORMANCE`), provides `fetchWithAuth` for bearer requests. **services/domain/panaceScorePredictor.ts:** Import from `@/lib/apiClient`.
- **src/components/dashboard/NeuralLinkLog.tsx:** Typewriter effect: use `line ?? ''` for `SetStateAction<string[]>`; `return undefined` in `useEffect` so all code paths return.
- **types/telemetry.ts:** `median_duration_ms` / `p90_duration_ms` use `durations[idx] ?? 0` to satisfy `number`.
- **services/questionService.ts (root):** `condition` with `?? ''`; `pearls: []`; removed `fromStaging` from cast (not on PoolQuestion).
- **src/types.ts & src/types/index.ts:** Added `difficulty?: string` to `SessionSettings`.

### Third pass (2026-02-01 – main repo)

- **App.tsx:** Removed unused imports (PharmDrillSession, QuestionCurationPanel), removed SystemCode from type import, renamed safeParse→_safeParse, prefixed unused handlers (_handleNavigateToDrillWithSystem, _handleNavigateToCommandCenter), fixed pageTransition `as any` → `as { duration: number; ease: number[] }`.
- **AuthProvider + SetupRequiredPage:** New SetupRequiredPage component; AuthProvider renders it when Clerk key is missing instead of throwing. Users see setup instructions, Clerk Dashboard link, and copy button.
- **services/core/comparisonGenerator.ts:** Added guard for `pair` possibly undefined; push `{ pairIndex: i, comparison: null }` and continue when pair is missing.
- **services/core/wordleService.ts:** `DailyWordleWithWord.Buzzword.subcategory` typed as `string | null` to match Prisma schema.

### Fourth pass (2026-02-01 – continued)

- **services/CoachingService.test.ts:** Import from `./core/CoachingService`; typed `(area: string)`.
- **services/core/comparisonGenerator.ts:** `if (!pair) continue` before using pair.
- **services/core/wordleService.ts:** `Buzzword.subcategory: string | null`.
- **services/client/questionApi.ts:** Removed `type` from returned Question object.
- **services/domain/buzzwordService.ts:** Guard `b.buzzword != null`; filter `b.condition` for string[].
- **services/markdownParser.ts:** `match[1] ?? ''`, `colonMatch[1] ?? ''`, `colonMatch[2] ?? ''`, `match[1] ?? ''` in toParts.
- **src/lib/drugSearch.ts:** `ApiDrug` type and `mapDrugToEntry` accept API shape; guard `match[1]` in findDrugById.
- **src/lib/conditionSearch.test.ts:** `top?.condition` optional chaining.
- **src/lib/unifiedSearch.test.ts:** Guard and optional chaining for `result`.
- **services/analytics/studentInsightsService.ts:** Guard `if (!weakest) return null`.
- **services/analytics/masteryVelocityPredictor.ts:** `prev`/`curr` vars; slope with null checks for `recent[2]`/`recent[0]`.
- **services/domain/anatomyModelService.ts:** `dateAccessed` with `?? ''`; `modelId`/`url` with `??`.
- **services/markdownParser.test.ts:** Guard `first` and `first?.children ?? []`.
- **src/archived/pharm-old/pharmRegistry.ts:** `if (!drugs) continue` in loop.
- **src/data/labDrivenConditions.ts:** `LAB_DRIVEN_CONDITIONS[idx] ?? ''` for getRandomCondition.

### Fifth pass (2026-01-31 – taskTypes, GapAnalysis, API)

- **lib/taskTypes.ts:** Added `CLINICAL_PEARL: 'clinical_pearl'`; extended `getTaskTypeLabel`, `getTaskTypeDescription`, and `inferTaskType` for clinical pearls.
- **components/dashboard/GapAnalysisDashboard.tsx:** Added `if (!data) return null` after error UI branch for type narrowing before `chartData`/`topSystems`.
- **functions/api/analytics/srs-summary.ts:** Added missing `import { resolveUserId } from '../_shared/user-resolver';`.
- **functions/api/questions/pool.ts:** Import `fisherYatesShuffle` from `lib/poolSelection`; added `imageUrl?: string` to `PoolQuestionOutput`.

**Still to fix:** ~1,0xx TS errors (possibly undefined in services/domain, conceptDependencyService, examService, etc.). Lint: ~9,8xx issues.

---

## 7. Re-audit

After applying fixes:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. Manual or E2E pass on dashboard, drills, settings, and pearl deck.
