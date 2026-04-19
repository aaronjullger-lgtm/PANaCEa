# Dashboard Trust Audit — 2026-04-17

**Role:** Dashboard & Analytics Agent
**Scope:** student-facing dashboards, retention curves, mastery heatmaps, forgetting-curve visualizations, blueprint coverage, metric correctness
**Mandate:** no dashboard lies; every metric has a known provenance path; no misleading defaults; prefer "insufficient data" over fake precision

---

## 1. Surface Inventory

| Surface | Location | Wired to | Notes |
|---|---|---|---|
| **Main dashboard** | `components/dashboard/DashboardPage.tsx` (923 lines) | primary student route | two tabs: `pilot` (Today) and `data` (Analytics) |
| Unified dashboard (widget grid) | `components/dashboard/UnifiedDashboard/index.tsx` | alt layout | |
| Insights hub | `components/dashboard/InsightsHub.tsx` | secondary | |
| Intelligence hub | `components/analytics/IntelligenceHub.tsx` (1056 lines) | `/progress` route | |
| Analytics dashboard | `components/analytics/AnalyticsDashboard.tsx` (995 lines) | | |
| SRS dashboard | `components/analytics/SrsDashboard.tsx` | | |
| Longitudinal progress | `components/analytics/LongitudinalProgressDashboard.tsx` | | |
| **Total** | **73 dashboard components + 37 analytics components** | | |

### Backing endpoints

- `functions/api/stats/retention.ts` — decay curve, stability pyramid, dueCount, totalCards
- `functions/api/dashboard/{daily-triad,review-queue,stats}.ts`
- `functions/api/analytics/*.ts` — 24 files (blueprint-gaps, calibration, confusion-pairs, metacognitive, review-forecast, readiness-projection, rating-audit, etc.)

### Core service layer

- `lib/services/analyticsService.ts` (348 lines) — peer benchmarks
- `lib/services/widgetService.ts` (416 lines)
- `lib/services/insightGenerationService.ts` (371 lines)
- `lib/services/calibrationDashboardService.ts` (459 lines)
- `lib/services/drillAnalyticsService.ts` (172 lines)
- `lib/services/userStatsService.ts` (78 lines)
- `lib/services/dashboardPersonalization.ts` (387 lines)

---

## 2. Confirmed & Suspected Trust Violations

Ordered by severity / student impact.

### P0 — Numbers the student sees are fabricated

1. **`retention.ts`: hardcoded `lastTuned`, `tuningReason`, `adjustment`** (lines 94–96)
   Every student sees "last tuned 6 hours ago, Pharmacology, tighten" regardless of any actual tuning event. This powers `AlgorithmStatusWidget`. Textbook dashboard lie.

2. **`retention.ts`: decay curve uses wrong formula** (lines 67–70)
   Uses `exp(-day / avgStability) * 100`. FSRS v6 retrievability is `(1 + FACTOR·t/S)^DECAY` with FACTOR=19/81, DECAY=-0.5. The exponential approximation understates retention at short intervals and overstates it at long intervals — the forgetting curve shown to the student does **not** match the scheduler that's actually grading them.

3. **`retention.ts`: `avgStability` has two null-injection paths** (lines 63–65)
   `|| 5` substitutes stability=5 for any null record, **and** `srsItems.length || 1` makes a zero-card user get `avgStability = 5 / 1 = 5` — then renders a fully-formed, purely fictional 31-day decay curve. New students are shown a forgetting curve without ever having forgotten anything.

4. **`review-forecast.ts` and `readiness-projection.ts` likely return empty for every student** (review-forecast.ts L52–64,117; readiness-projection.ts L58)
   Both query `UserProgress.userId === context.auth.userId`. Per `schema.prisma` L3085–3088, `User.id` is the internal PK and `User.clerkId` is the Clerk subject; `context.auth.userId` is the Clerk ID (see `_shared/auth.ts` L40–46). Other endpoints (`retention.ts`, `user/delete.ts`, `sync.ts`) explicitly resolve `clerkId → user.id` before querying. Needs a live DB check to confirm, but if the schema is honored as written, the review forecast and exam-readiness projection are silently empty for all real users.

### P1 — Default values masquerade as data

5. **`analyticsService.ts`: zero-attempt systems return `accuracy: 0` and `userPercentile: 0`** (L87, L304, L307)
   Zero attempts or zero cohort data produces a "0%" display, not an "insufficient data" signal — the student sees 0% accuracy in Rheumatology before ever answering a Rheum question. Should return `null` / `undefined` / explicit `insufficientData: true`.

6. **`DashboardPage.tsx`: `safeData` fallback lies on API failure** (L384–392)
   When `/api/stats/retention` errors, `safeData` is populated with `adjustment: 'tighten'` and zeros. The banner tells the student "some analytics unavailable," but the Pilot tab still renders QuickStats and actions built from fake zeros.

7. **`DashboardPage.tsx`: streak has two authorities that can disagree** (L351–357)
   Prefers `dbStats.overall.currentStreak` but falls back to `calculateDayStreak(performanceData)` (localStorage). No reconciliation — a bug in either path is invisible to the student. Needs a single authority with explicit provenance and a mismatch alarm.

8. **`DashboardPage.tsx`: `systemAccuracy` / `systemCounts` dual-sourced** (L399–451)
   Same pattern — DB preferred, localStorage fallback, no reconciliation, no provenance mark in the UI. The `BlueprintProgressBar` and `RotationFocusCard` silently switch sources.

### P2 — Time and bucketing errors

9. **`DashboardPage.tsx`: StudyHeatmap uses UTC year + localStorage first** (L469–493)
   `new Date().getUTCFullYear()` filters to the UTC year, so a Western-hemisphere student on Dec 31 local time sees a suddenly-empty heatmap. Worse, `performanceData` (localStorage) is consulted before `recentSessions` (server), so the heatmap silently uses whichever source has data regardless of freshness.

10. **`review-forecast.ts`: UTC-bucketed days** (L43–49)
    `todayStart = UTC 00:00`. A PT student studying at 22:00 local (= 06:00 UTC next day) sees cards due "tomorrow" when the scheduler considers them due today. Circadian/timezone profile on `User` exists but isn't applied.

11. **`DashboardPage.tsx`: rotation-week math ignores DST** (L454–461)
    `diffMs / (7 * 86400000) + 1` over a date range that crosses a DST transition is off by one hour and can flip a Sunday-night student's "week 4" to "week 5" or vice versa.

### P3 — Missing trust mechanisms

12. **No reconciliation tests.** Nothing checks: "sum of daily review counts == total review count," "streak length ≤ consecutive study days," "blueprint coverage sums to 100%," "retention endpoint stability pyramid counts sum to totalCards."
13. **No provenance badges.** Students can't tell which metrics are server-verified vs. cached-locally vs. computed-from-fallback.
14. **No "insufficient data" primitive.** Several places return `0` instead of an honest empty-state marker.

---

## 3. Proposed Sprint Plan

Each sprint scoped to 1–4 files + reconciliation tests. Ordered by student-impact ROI. Every sprint ends with `npm test` + typecheck green.

### Sprint 1 — Fix the retention endpoint (P0 #1, #2, #3)
**Files:** `functions/api/stats/retention.ts`, `tests/api/stats/retention.test.ts` (new), `components/dashboard/AlgorithmStatusWidget.tsx`
- Remove hardcoded `lastTuned`/`tuningReason`/`adjustment`. Either source them from a real tuning log (ReviewLog cluster? FSRS optimizer state?) or return `lastTuned: null` and hide `AlgorithmStatusWidget` when missing.
- Replace `exp(-day / avgStability)` with the actual FSRS v6 retrievability curve from `lib/fsrs.ts`.
- Gate on `srsItems.length > 0` — return `insufficientData: true` + hide decay curve + stability pyramid when empty. Do not fabricate `avgStability = 5`.
- New reconciliation test: (a) sum of stability-bucket counts equals `totalCards`; (b) decay curve values monotonically non-increasing; (c) empty user → `insufficientData: true`, no fake curve.

### Sprint 2 — Resolve the clerkId/userId bug across analytics endpoints (P0 #4)
**Files:** `functions/api/analytics/review-forecast.ts`, `functions/api/analytics/readiness-projection.ts`, possibly others; plus a shared helper `functions/api/_shared/resolveUserId.ts`
- Add a `resolveUserId(prisma, auth.userId)` helper (wraps the `findUnique({ where: { clerkId } })` pattern).
- Replace raw `userId: auth.userId` queries against user-scoped tables. Sweep every analytics endpoint for the pattern.
- Tests: (a) empty-progress user returns empty arrays, not 500; (b) populated user gets correct row counts; (c) clerkId-vs-internal mismatch is caught by a single typed helper.

### Sprint 3 — Kill default-value lies (P1 #5, #6)
**Files:** `lib/services/analyticsService.ts`, `components/dashboard/DashboardPage.tsx`, new `lib/types/metric.ts`
- Introduce `type Metric<T> = { status: 'ok'; value: T; source: 'db' | 'cache' } | { status: 'insufficient_data' } | { status: 'error'; reason: string }`.
- Update `getUserAccuracyProfile`, `generatePeerComparison` to return `Metric`-typed values instead of coercing to 0.
- Update consumers to render "—" or "Insufficient data (N attempts)" rather than "0%".
- Remove the `safeData` fallback for widgets that require real data; show per-widget degraded states.

### Sprint 4 — Single streak authority + provenance badge (P1 #7, #8, P3 #13)
**Files:** `components/dashboard/DashboardPage.tsx`, `hooks/useUserStats.ts`, `hooks/useDatabaseStats.ts`, new `components/ui/ProvenanceBadge.tsx`
- Pick one authority for streak, system accuracy, system counts (DB). LocalStorage may inform optimistic rendering but the source of truth is DB.
- Emit a lightweight `ProvenanceBadge` ("server verified" / "offline cache" / "local only") on any metric whose source isn't obvious.
- Add a dev-only reconciliation hook that warns when DB and localStorage disagree by > tolerance.

### Sprint 5 — Timezone-correct review forecast + study heatmap (P2 #9, #10)
**Files:** `functions/api/analytics/review-forecast.ts`, `components/dashboard/DashboardPage.tsx` (`studyActivityData`), `lib/time/userTz.ts` (new or reuse existing timezone helper)
- Accept user timezone (from `UserCircadianProfile` or user preferences) in forecast endpoint. Bucket days in local tz.
- StudyHeatmap: use local year, prefer server `recentSessions` over localStorage, drop the `getUTCFullYear` filter.
- Test: forecast for a PT user at 22:00 PT correctly returns overdue/today/forecast based on local calendar.

### Sprint 6 — Retention / forgetting-curve chart hardening
**Files:** `components/dashboard/charts/DecayCurve.tsx`, `components/analytics/FSRSDecayVisualization.tsx`, `components/analytics/LearningCurveChart.tsx`, `components/dashboard/RetentionForecastCard.tsx`, new `components/analytics/InsufficientDataState.tsx`
- Every curve component: explicit empty state, null-safe data access, bounded axes, tooltip values matching the source.
- Replace any ad-hoc forgetting-curve math with a shared `lib/fsrs.ts` export.
- Test: snapshot render with `data=[]`, `data=[{day:0,retentionProb:null}]`, full data; none should crash or show bogus curves.

### Sprint 7 — Mastery heatmap + blueprint coverage denominator audit
**Files:** `components/analytics/CompetencyHeatmap.tsx`, `components/analytics/TopicHeatmap.tsx`, `components/analytics/SystemMasteryMap.tsx`, `components/dashboard/BlueprintGapHeatmap.tsx`, `components/dashboard/ClinicalProfile/SystemRadarChart.tsx`, `components/dashboard/Rolling360/SystemTriageHeatmap.tsx`, `functions/api/analytics/blueprint-gaps.ts`, `functions/api/analytics/blueprint-coverage.ts`
- For each heatmap: confirm denominator is (attempts in that cell) not (attempts overall); confirm blueprint weights match `NCCPA_BLUEPRINT_WEIGHTS`; confirm color scale caps aren't misleading (3 attempts green = lie).
- Reconciliation test: per-cell `correct/total` ≤ 1, sum of cell totals equals user total attempts, blueprint weights sum to 100 ± ε.

### Sprint 8 — Rotation-week + calendar-boundary math
**Files:** `components/dashboard/DashboardPage.tsx`, `lib/time/rotationWeek.ts` (new)
- Replace ad-hoc `diffMs / (7*86400000) + 1` with a DST-safe helper that uses calendar-day differences in user tz.
- Apply same helper anywhere a "week N of rotation" appears.

### Sprint 9 — Reconciliation test suite + provenance coverage
**Files:** `tests/dashboard/reconciliation/*.test.ts` (new directory)
- One test per metric family: streak, review forecast, retention, blueprint coverage, confusion pairs, calibration quadrants.
- Each test compares the rendered value to a direct Prisma aggregate over the same user/time window.
- CI-gated; any new metric must add a reconciliation test.

---

## 4. Rules of engagement (for this agent across all sprints)

- Every metric returns one of: `ok+value`, `insufficient_data`, or `error`. Never a silent zero.
- Every user-facing chart has an empty state, an error state, and a null-safe render path.
- Every aggregation has a reconciliation test.
- Every dual-sourced metric either (a) becomes single-authority, or (b) exposes a provenance badge.
- Timezone-dependent math uses the user's tz profile, never `Date.UTC*` or `new Date().getHours()` in isolation.
- No hardcoded demo values in production endpoints.

---

## 5. Open questions for Aaron

1. Is there an authoritative tuning-event source for `lastTuned` / `tuningReason`? (ReviewLog cluster? `FSRSOptimizerRun` model?) If not, Sprint 1 will default to hiding `AlgorithmStatusWidget` when none exists.
2. Prefer `Metric<T>` discriminated union (Sprint 3) or a simpler `value: number | null` + `reason: string | null` pair?
3. OK to add `ProvenanceBadge` as a Tier-1 UI primitive in `components/ui/`?
4. Any sprint to deprioritize or reorder? Sprint 2 (userId bug) is the single highest student-impact fix if confirmed, but it's a 30-minute change — should it go before Sprint 1?
