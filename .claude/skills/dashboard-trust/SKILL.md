---
name: dashboard-trust
description: "Audit and fix dashboard metrics, chart rendering, and analytics correctness in PANaCEa. Use this skill whenever working on any dashboard, analytics panel, chart component, metric display, widget, insight card, or data visualization — even if the user just says 'the numbers look wrong' or 'the chart is broken'. Also use when adding new metrics, fixing null-data crashes, or verifying aggregation pipelines end-to-end."
---

# Dashboard Trust Audit & Repair

## Purpose
Ensure every metric displayed to students is accurate, null-safe, and trustworthy. Charts must render reliably, empty states must be handled, and all numbers must trace cleanly from database queries through transformations to the UI.

## Inspection Checklist: Data Source → API → Transform → Component → Render

Follow this checklist for any dashboard issue:

### 1. **Data Source** (Database Query)
- [ ] Check the Prisma query in `functions/api/dashboard/*` or `functions/api/analytics/*`
- [ ] Verify joins are correct (e.g., UserProgress.userId filters to correct student)
- [ ] Check date ranges: are filters using `startOfDay`, `endOfDay`, timezone-aware?
- [ ] Look for missing `WHERE` clauses that could return global data instead of per-student
- [ ] Run query manually in db studio to verify row count and values

### 2. **API Endpoint** (`functions/api/`)
- [ ] Is the endpoint using `authenticatedEndpoint` middleware?
- [ ] Does it call `safePrismaDisconnect(prisma)` in a `finally` block?
- [ ] Does it handle empty result set (no rows) and return sensible default (0, [], null)?
- [ ] Is caching strategy correct? (Check `Cache-Control` headers; watch for stale widget cache)
- [ ] Does it validate user ID matches authenticated user (no cross-student leaks)?

### 3. **Transform Layer** (`lib/services/analyticsService.ts`, `lib/services/widgetService.ts`, `lib/services/insightGenerationService.ts`)
- [ ] Are aggregations (sum, avg, count) receiving non-null data?
- [ ] Are edge cases handled: division by zero, empty arrays, null retrievability?
- [ ] Do timezone conversions match the user's profile timezone?
- [ ] Are streak calculations resetting correctly after missed days?
- [ ] Are implicit metrics (confidence, difficulty) correctly sourced from ReviewLog?

### 4. **Component Layer** (`components/dashboard/`, `components/analytics/`)
- [ ] Does the chart component receive data as prop? Check shape (array of objects, keys match recharts schema)
- [ ] Is there a loading state? (skeleton, spinner)
- [ ] Is there an error state? (error boundary, error message)
- [ ] **Is there an empty state?** (no data → show "No data yet" or similar, not a broken chart)
- [ ] Does the component handle null/undefined gracefully? (e.g., `data?.length > 0 ? ... : <EmptyChartState />`)

### 5. **Render & Display** (recharts or custom)
- [ ] Do all chart axes have sensible domains?
- [ ] Are colors accessible (contrast, colorblind-friendly)?
- [ ] Do tooltip values match the underlying data?
- [ ] Does the legend match what's actually plotted?
- [ ] Check browser console for recharts errors (common: "points is not iterable")

## Common Failure Modes in PANaCEa

### Null Retrievability Crashes recharts
**Symptom:** Chart component crashes with "Cannot read property 'length' of undefined" or recharts warns "points is not iterable"
- **Root cause:** Query returns null retrievability; component doesn't check before mapping
- **Fix:** Always guard: `data?.map(...)` or `if (!data || data.length === 0) return <EmptyChartState />`
- **Files to check:** `components/analytics/SrsDashboard.tsx`, `components/charts/SafeChart.tsx`, `lib/services/analyticsService.ts`

### Empty Session History
**Symptom:** "0 cards reviewed today", "no activity" when student has completed sessions
- **Root cause:** Date filter using wrong timezone or inclusive/exclusive boundaries; session not written to DB yet
- **Fix:** Verify `startOfDay(now, userTz)` and `endOfDay(now, userTz)`; check ReviewLog write timing
- **Files to check:** `functions/api/dashboard/activity.ts`, `lib/services/analyticsService.ts` (aggregateSessionsToday)

### Timezone Mismatches in Circadian Charts
**Symptom:** Circadian performance chart shows activity at wrong hours (e.g., peak at 2 AM instead of 9 AM)
- **Root cause:** Chart using UTC timestamps; user profile timezone not applied during query or transform
- **Fix:** Apply timezone offset in Prisma query or in transform: `toZonedTime(timestamp, userTz)`
- **Files to check:** `functions/api/analytics/circadian-performance.ts`, `lib/services/analyticsService.ts` (circadianAggregation)

### Stale Widget Cache
**Symptom:** Widget metric doesn't update after student completes a drill
- **Root cause:** Endpoint caching too aggressively; cache not invalidated on QuestionAttempt write
- **Fix:** Use `Cache-Control: no-cache` or add cache-busting query param (timestamp)
- **Files to check:** `functions/api/dashboard/widget.ts`, check middleware cache headers

### Incorrect Streak Calculations
**Symptom:** Streak shows 3 days but student only studied 2 days; resets unexpectedly
- **Root cause:** Aggregation logic not handling time gaps correctly; querying wrong date range
- **Fix:** Walk backward from today, count consecutive days with ReviewLog entry, stop at first gap
- **Files to check:** `lib/services/analyticsService.ts` (calculateStreak), verify `startOfDay`/`endOfDay` usage

### Aggregation Mismatches
**Symptom:** Total reviews displayed = 100 but sum of daily reviews = 120
- **Root cause:** Aggregation logic double-counts duplicates or uses wrong grouping key
- **Fix:** Trace the query: are you grouping by `(userId, questionId, date)` or `(userId, date)`? Verify GROUP BY clause
- **Files to check:** `functions/api/stats/`, `lib/services/analyticsService.ts`

## Files to Inspect First

| Layer | File | Purpose |
|-------|------|---------|
| **Components** | `components/dashboard/` | Dashboard layout, cards, widgets |
| **Chart Components** | `components/charts/SafeChart.tsx` | Base chart wrapper; check null handling |
| **Analytics Dashboards** | `components/analytics/SrsDashboard.tsx` | FSRS metrics |
| | `components/analytics/AnalyticsDashboard.tsx` | Session summaries, trends |
| | `components/analytics/LearningProfileDashboard.tsx` | Performance, calibration |
| **Analytics Service** | `lib/services/analyticsService.ts` | Core aggregations: daily/weekly/monthly, streaks, circadian |
| **Widget Service** | `lib/services/widgetService.ts` | Widget data loading, caching |
| **Insight Service** | `lib/services/insightGenerationService.ts` | Insight text generation |
| **API Endpoints** | `functions/api/dashboard/` | Data endpoints (activity, widget, metrics) |
| | `functions/api/analytics/` | Advanced analytics (circadian, calibration, trends) |
| | `functions/api/stats/` | Aggregated stats |

## Good Looks Like

- **Every chart has an empty state:** If data is empty (no sessions, no reviews), the chart disappears and shows a friendly message like "Complete your first drill to see activity."
- **Every metric traces to a verified query:** You can run the same Prisma query in db studio and confirm the number matches what's displayed.
- **All aggregations match raw data:** Sum of daily review counts equals total review count. Streak is never longer than consecutive study days.
- **Null safety throughout:** No unchecked `.length`, `.map()`, or property access on potentially undefined data. Guard: `if (!data || data.length === 0) return <EmptyState />`.
- **Timezone handling is explicit:** All timestamps passed to charts are already in user timezone. No client-side timezone conversion that could be undone by browser settings.
- **Cache is correct:** Widget updates within 30 seconds of a new review. Stale data is never displayed. Cache headers match revalidation needs.
- **Empty session history catches edge cases:** New student (0 sessions), student on first day, student in timezone with no activity yet today all render properly.

## What NOT to Use This For

- **FSRS algorithm changes** → use `fsrs-pipeline` skill
- **UI styling, layout, visual polish** → use `panacea-style-system` skill
- **Question generation, content creation** → use `clinical-content-gen` skill
- **Database schema or migrations** → use `panacea-verify` skill
- **Cloudflare Edge Functions deployment, wrangler config** → use `cf-edge-api` skill

## Composes With

- **fsrs-pipeline:** When auditing FSRS-based metrics (stability, difficulty, retrievability). Verify implicit rating derivation and FSRS update timing.
- **panacea-verify:** When discovering missing migrations or schema issues that prevent metrics from being queried correctly.
- **cf-edge-api:** When debugging API endpoint caching, auth middleware, or Prisma edge client lifecycle issues.

## Quick Start

1. **User reports "the numbers look wrong":**
   - Identify which metric/chart (e.g., daily review count, circadian chart, streak)
   - Start at Step 1 (Data Source): Run the Prisma query in db studio, confirm raw data is correct
   - If raw data is correct, move to Step 2 (API), then Step 3 (Transform), then Step 4/5 (Component/Render)
   - Use the failure modes guide to narrow down the issue

2. **User reports "chart is broken":**
   - Check browser console for errors
   - Verify component receives data prop with correct shape
   - Check for empty state handling: does the component render <EmptyChartState /> when data is empty?
   - If still broken, check SafeChart.tsx and recharts dependency version

3. **User adds new metric:**
   - Write the Prisma query in a new `functions/api/dashboard/` endpoint
   - Add transform logic to `lib/services/analyticsService.ts`
   - Create or reuse a chart component in `components/charts/`
   - Add empty state, loading state, error boundary
   - Test with empty data, null data, large data sets
