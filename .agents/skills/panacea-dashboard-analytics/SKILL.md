---
name: "panacea-dashboard-analytics"
description: "Use this skill for PANaCEa dashboards, progress pages, readiness projections, analytics APIs, metric cards, charts, daily prescriptions, blueprint coverage, calibration reports, weak areas, peer stats, rolling aggregates, and any task where displayed learning metrics must match backend calculations."
---

# PANaCEa Dashboard Analytics

Use for analytics and dashboard work where trust in the number matters more than visual polish.

## First Files By Surface

- Progress dashboard UI: `components/progress-dashboard/*`, `pages/ProgressPage.tsx`
- Dashboard endpoints: `functions/api/dashboard/*`, `functions/api/analytics/*`, `functions/api/admin/*stats*`
- Metric services: `lib/services/dashboardAnalyticsService.ts`, `lib/services/readinessProjectionService.ts`, `lib/services/userStatsService.ts`, `lib/services/rolling360Service.ts`
- Blueprint/calibration: `lib/services/blueprintCoverageService.ts`, `lib/services/calibrationDashboardService.ts`, `lib/services/retrievabilityCalibrationService.ts`
- Daily planning: `lib/services/studyPlanService.ts`, `functions/api/cron/daily-prescription.ts`
- Charts/primitives: `components/charts/*`, `components/ui/TrendSparkline.tsx`, `components/ui/Sparkline.tsx`

## Metric Contract Workflow

1. Identify the exact metric displayed and its source endpoint/service.
2. Read the service calculation before changing UI labels or chart transforms.
3. Check time window, timezone, denominator, filtering, and missing-data behavior.
4. Keep backend and frontend naming aligned; do not rederive critical metrics in components.
5. Add empty/error/loading states that state absence without implying failure or zero performance.
6. Test at least one normal, empty, and edge case for changed calculations.

## Trust Rules

- Never show a derived metric without knowing its denominator.
- Do not mix session-local stats, rolling 360 stats, and lifetime stats under one label.
- Blueprint coverage should reflect NCCPA/PANRE category weighting where that is the promise.
- Calibration/readiness projections must expose uncertainty or stale data when available.
- Prefer server-calculated metrics for anything persisted, user-specific, or cross-session.

## UI Rules

- Operational dashboards should be dense, scannable, and restrained.
- Cards are for individual repeated widgets; avoid nested cards.
- Charts need stable dimensions, empty states, and accessible labels.
- Do not let chart animations or responsive text shift the layout.

## Validation

- Run targeted service tests for metric math.
- Run component tests if UI transforms or empty states changed.
- Run `npm run typecheck` for cross-layer contract edits.
- Run Playwright when navigation, real dashboard loading, auth, or API integration changed.

## Common Traps

- Frontend filtering that disagrees with backend filtering
- Treating missing data as zero mastery
- Changing chart labels without updating tooltip/legend semantics
- Ignoring stale aggregate jobs after changing service calculations
- Making admin analytics and student analytics share a component with incompatible assumptions
