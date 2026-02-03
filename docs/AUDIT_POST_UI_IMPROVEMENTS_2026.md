# Post–UI Improvements Audit (February 2026)

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Recent development plan (8 UI/UX items) + repository consistency, logic, security, scalability, refactoring.  
**Date:** February 2, 2026

---

## 1. Plan Fidelity

### Implemented as specified
- **Auto-save feedback:** Toast on Commuter Mode toggle; persistent hint in Settings tab. ✓
- **Destructive actions:** Ellipsis on Clear Performance Data / To Review / Flagged; type-to-confirm "DELETE" for performance data; `aria-label`s on destructive buttons. ✓
- **Loading vs broken:** Skeleton placeholders in Settings Stats tab when `hasNoStatsData` (wave skeletons for trend, streak, accuracy, today/week). ✓
- **Color-blind scale:** RadialProgress + SessionEndSummary + QuizView + SettingsStatsModal + VisualizationDemoPage use teal (≥80%), blue (60–80%), amber (<60%); no red for low scores. ✓
- **Mini Modes:** `max-h-64 overflow-y-auto` + search/filter; categories hidden when no match; "No modes match…" when empty. ✓
- **Widget overload:** `WIDGET_PREVIEW_INFO` in WidgetGrid; dense grid (`grid-flow-dense`); hover tooltip with thumbnail + description in StatisticsPreferences. ✓
- **Keyboard/focus:** Global `focus-visible` rings in `index.css`; Skip to main content visible only on `focus-visible`. ✓
- **Modal X button:** 44×44 hit area, `rounded-full`, subtle hover background. ✓

### Gaps vs plan
- **Stats “loading” vs “no data”:** Plan asked to show skeletons when data is *loading or missing*. Implementation shows skeletons when `isLoadingStats || performanceData.length === 0`. `useUserStats` exposes `isLoading` but **never sets it to `true`** (only `useState(false)`). So skeletons appear only when `performanceData.length === 0`, not during initial sync/load. True “loading” state is not wired.
- **Copy consistency:** Plan referred to “Clear Missed Questions…”; modal uses “Clear To Review…” (product term for the same list). Intentional naming; document for consistency.

---

## 2. Repo Consistency

### Aligned with conventions
- **Paths:** Settings/Stats modal in `components/modals/`; WidgetGrid and StatisticsPreferences in `components/ProgressDashboard/`; loading from `@/components/loading`. ✓
- **Styling:** Tailwind; CSS variables (`--color-accent`, `--color-data-pass`, etc.); `rounded-xl` cards; Lucide icons. ✓
- **Exports:** Named exports; `WidgetId` and `WIDGET_PREVIEW_INFO` from WidgetGrid. ✓

### Inconsistencies
- **Skeleton API:** `components/loading/SkeletonLoader.tsx` uses props `width`, `height`, `radius`, `variant`. `components/ui/SkeletonLoader.tsx` uses different API (e.g. `variant="text"`, `variant="rectangular"`). Two skeleton systems exist; SettingsStatsModal correctly uses `components/loading` Skeleton. Prefer consolidating on one system long-term.
- **“To Review” vs “Missed Questions”:** Used interchangeably in codebase; consider standardizing one term in UI and docs.

---

## 3. Logic & Security

### Logic
- **Silent stats “loading”:** `isLoading` in `useUserStats` is never set to `true`, so `isStatsLoading` in App is always `false`. Skeleton logic is effectively “no data yet” only.
- **Clear data flow:** `clearPerformanceData` / `clearMissedQuestionsData` / `clearFlaggedQuestionsData` in App call `setPerformanceData([])` etc. Debounced sync in `useUserStats` will push empty arrays on next sync; no try/catch but no async in the clear path. Acceptable.
- **handleClear in modal:** Two-step confirmation for performance (type DELETE); single-step confirm for missed/flagged. Matches plan.

### Security
- **API env:** Functions use `context.env.DATABASE_URL`, `context.env.GEMINI_API_KEY`, etc.; no `process.env` in Edge handlers. ✓
- **RLS:** Docs and migrations confirm RLS on user-scoped tables; sync and user APIs rely on Clerk auth and server-side checks. ✓
- **Secrets:** No hardcoded keys in scanned code. ✓

### Recommendations
- **useUserStats loading:** Set `isLoading = true` when starting `syncFromCloud`/initial load and `false` when done (or when `performanceData` is first populated from localStorage), so Settings and Command Center can show skeletons during real load.
- **Error feedback on clear:** If desired, show a brief toast after clear (e.g. “Performance data cleared”) so users get confirmation.

---

## 4. Holes & Scalability

### Brittle / high-change areas
- **SettingsStatsModal size:** Very large file (~2.7k lines). Stats, Settings, Preferences, Activity, Data Management, and Mini Modes all live in one component. Any change to stats layout or new tab increases risk of regressions. Consider splitting by tab or by domain (e.g. `SettingsStatsModal`, `StatsTab`, `DataManagementSection`).
- **Mini Modes list:** Mode list is hardcoded in the modal (visualModes, recallModes, pharmModes, etc.). Adding a mode requires editing this file and keeping in sync with `ALL_MINI_MODES` / `MODE_REGISTRY`. Prefer a single source of truth (e.g. derive from `config/training-modes`) and map to categories for the UI.
- **Accuracy color thresholds:** 80 / 60 thresholds and colors are repeated in RadialProgress, SessionEndSummary, QuizView, SettingsStatsModal. A shared util (e.g. `getAccuracyColor(score)`) or shared constants would reduce drift if product changes the scale.
- **Performance data shape:** Stats tab assumes `PerformanceRecord[]` with `timestamp`, `isCorrect`, system codes, etc. Any new field or change to shape may require updates in `stats` useMemo and in heatmap/sparkline components.

### Load / scale
- **Stats useMemo:** Single pass over `performanceData` for aggregations is appropriate. For very large histories (e.g. 50k+ records), consider sampling or server-side aggregation for the dashboard; not urgent for typical usage.
- **Mini Modes search:** In-memory filter; fine for current list size. If the list grows into hundreds, debouncing the search input would be reasonable.

---

## 5. Refactoring Opportunities (DRY / Code Smells)

- **Accuracy color logic (DRY):** Repeated 80/60/teal/blue/amber logic in:
  - `components/ui/RadialProgress.tsx` (inline `pColor`)
  - `components/quiz/SessionEndSummary.tsx` (`getAccuracyClass`, `getAccuracyBarClass`, `getDistributionScoreClass`, `getDistributionBarClass`, grade colors)
  - `components/session/QuizView.tsx` (`getBarColor`)
  - `components/modals/SettingsStatsModal.tsx` (system breakdown bars)
  - `components/demo/VisualizationDemoPage.tsx`
  Extract to e.g. `lib/accuracyColorUtils.ts`: `getAccuracyColorClass(score)`, `getAccuracyHex(score)`, and use everywhere.
- **Two Skeleton systems:** `components/loading/SkeletonLoader.tsx` (Skeleton, variant wave/pulse, radius) vs `components/ui/SkeletonLoader.tsx` (variant text/rectangular/circular). Consolidate on one and re-export from `components/loading` for consistency.
- **Widget preview tooltip:** `StatisticsPreferences.tsx` uses `aria-hidden` on the tooltip div. For hover-only previews this is common, but `role="tooltip"` with `aria-hidden` is contradictory for assistive tech. Prefer either removing `role="tooltip"` and keeping it decorative, or exposing a short live-region/text for screen readers (e.g. “Preview: [widget label]”).
- **Skip link:** Relies on many Tailwind classes; could be a small component or shared class (e.g. `.skip-link`) to avoid duplication if reused.

---

## 6. Output Summary

### Critical Fixes
1. **Wire stats loading state:** In `useUserStats`, set `isLoading` to `true` when starting initial load or `syncFromCloud`, and to `false` when data is ready (or after first localStorage read). Ensures Settings and Command Center show skeletons during real load, not only when `performanceData.length === 0`.

### Logical Omissions
1. **Loading vs empty:** Skeleton behavior is correct for “no data”; “loading” is not represented because `isLoading` is never true.
2. **Optional:** Toast or inline message after “Clear performance data” so users see explicit confirmation.

### Technical Debt
1. **Accuracy colors:** Centralize 80/60 thresholds and teal/blue/amber in one util; use in RadialProgress, SessionEndSummary, QuizView, SettingsStatsModal, VisualizationDemoPage.
2. **Skeleton consolidation:** Standardize on one Skeleton API (prefer `components/loading`) and deprecate or re-export the other.
3. **SettingsStatsModal size:** Split by tab or by domain to reduce complexity and regression risk.
4. **Mini Modes source of truth:** Derive modal list from `ALL_MINI_MODES`/MODE_REGISTRY instead of duplicating mode definitions.

### Verification Steps
1. **Stats loading:** Sign in and open Settings → Stats tab immediately; confirm skeletons show briefly if sync is in progress (after implementing `isLoading`). With empty account, confirm skeletons until first session.
2. **Destructive actions:** In Settings → Data, trigger “Clear Performance Data…”, type DELETE, confirm; then “Clear To Review…” and “Clear Flagged Questions…” with confirm. Verify data clears and (if implemented) toast appears.
3. **Color-blind scale:** In Stats tab and Session End Summary, check that low accuracy uses amber, mid blue, high teal—no red for low scores.
4. **Widget preview:** In Settings → Preferences, hover each dashboard widget; confirm tooltip with thumbnail and description appears; confirm dense grid when toggling widgets.
5. **Keyboard:** Tab through Settings modal (including Mini Modes search and destructive buttons); confirm visible focus rings. Tab from top of app; confirm “Skip to main content” appears on focus and moves to main.
6. **Mini Modes:** In Settings, use search (e.g. “ECG”, “pharm”); confirm filtering and “No modes match…” when appropriate; confirm list scrolls in `max-h-64`.
7. **Modal X:** Open Settings; hover and focus the top-right X; confirm 44×44 hit area, circular hover, and focus ring.

---

*End of audit.*
