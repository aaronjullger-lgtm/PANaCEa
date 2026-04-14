# PANaCEa Sprint 7 — Post-Merge Code Review

**Date:** 2026-04-03
**Reviewer:** Claude (senior full-stack engineer review)
**Scope:** Confidence pipeline v3 merge + two same-day hotfixes
**Build status:** Green, deployed to Cloudflare Pages

---

## Task 1 — Hotfix Debt Review

### Hotfix A: `calibration-insights` endpoint

**File:** `functions/api/study/calibration-insights.ts`

**What happened:** The endpoint imported `retrievabilityCalibrationService` and `fsrsOptimizerService` — two services that exist in the codebase but caused the Cloudflare Pages build to fail (likely due to Node-only dependencies being pulled into the Edge bundle). The fix inlined four functions: `bucketReviews()`, `computeCorrectionFactor()`, `detectDrift()`, and `getCircadianPhase()`.

**Assessment: Stopgap, not permanent.**

The inlined functions directly duplicate logic from `lib/services/retrievabilityCalibrationService.ts`:

- `bucketReviews()` mirrors the service's identically-named export with the same 10-bucket binning logic.
- `detectDrift()` uses hardcoded constants (100-review minimum, 0.1 threshold, 1/3 window) that match the service's `DriftReport` calculation today — but will silently diverge if the service is updated.
- `computeCorrectionFactor()` duplicates the weighted-average correction formula.
- `getCircadianPhase()` is the only truly new helper (hour-to-phase mapping not found elsewhere).

**[HIGH] Drift risk:** Two copies of the same calibration math with no shared source of truth. When the canonical service is tuned (e.g., changing the 0.1 drift threshold), the endpoint won't pick up the change.

**Minimal correct refactor:**
1. Extract the Edge-compatible subset of `retrievabilityCalibrationService` into a new `lib/calibration/calibrationMath.ts` (pure functions, no Prisma, no Node APIs).
2. Have both the service and the endpoint import from the shared module.
3. Move `getCircadianPhase()` into the same shared module.

### Hotfix B: `user/calibration` endpoint

**File:** `functions/api/user/calibration.ts`

**What happened:** The endpoint imported `auth.ts` instead of `middleware.ts` and used `getPrismaClient` instead of `createEdgePrismaClient`. It also inlined a simplified calibration query (just accuracy over last 500 attempts) instead of calling the full `getUserCalibration()` service.

**Assessment: Middleware fix is permanent; inlined query is a stopgap.**

The middleware pattern now correctly uses `authenticatedEndpoint()` from `middleware.ts` and `createEdgePrismaClient()` + `safePrismaDisconnect()` — matching the canonical pattern in `drills/submit-review.ts` and other endpoints.

However, the inlined query returns a **degraded response** (only `totalAttempts` and `overallAccuracy`) compared to `getUserCalibration()` which provides Brier score, calibration slope, per-bucket breakdowns, and dampener factor. Any frontend component expecting the full calibration profile will receive empty/default values.

**[MEDIUM] Missing structured logging:** Neither hotfixed endpoint uses `createEndpointLogger()`, which is standard in other Edge function endpoints. This makes debugging harder in production.

**Minimal correct refactor:**
1. Make `getUserCalibration()` Edge-compatible (same pattern as calibration-insights: extract pure math, keep Prisma queries in the endpoint).
2. Add `createEndpointLogger()` to both endpoints.

### Middleware pattern consistency check

| Pattern | calibration-insights | user/calibration | Standard (submit-review) |
|---------|---------------------|------------------|--------------------------|
| `authenticatedEndpoint()` | ✓ | ✓ | ✓ |
| Zod validation schema | ✓ | ✓ | ✓ |
| `createEdgePrismaClient()` | ✓ | ✓ | ✓ |
| `safePrismaDisconnect()` | ✓ | ✓ | ✓ |
| `createEndpointLogger()` | ✗ missing | ✗ missing | ✓ |

---

## Task 2 — Confidence Pipeline v3 Integrity Check

### Bayesian Accumulator (`lib/confidence/bayesianAccumulator.ts`)

**Unbounded growth?** No. The prior weight is hard-capped at `maxPriorWeight = 0.4`, meaning history can never contribute more than 40% of the posterior. The shrinkage prior formula `min(0.4, n/(n+5))` saturates quickly and stays bounded regardless of review count. History is trimmed to `maxHistory = 10` entries, and a zero-`totalWeight` fallback returns the raw current confidence.

**[LOW] Minor gap:** No dedicated unit test file — coverage comes indirectly through integration tests in `confidence-scoring.test.ts`. Consider adding edge-case unit tests for the zero-weight fallback path.

### Interference Detector (`lib/confidence/interferenceDetector.ts`)

**Decay semantics:** Uses linear decay based on card distance (not time): `decayFactor = min(1.0, distance / decayDistance)` with `decayDistance = 10`. Same-condition reviews get a minimum 15% confidence penalty (`sameConditionMinDiscount = 0.85`); confusion pairs get 10%.

**[MEDIUM] Over-firing risk:** The detector applies the same-condition discount any time the same condition appears within the 10-card lookback window, regardless of whether the spacing is pedagogically intentional (e.g., interleaved practice). A student reviewing card A, then 8 unrelated cards, then card A again still receives ~85% of their confidence. This is arguably too aggressive for intentional interleaving. Consider adding a time-based floor (e.g., >5 minutes between same-condition reviews = no discount).

### Ex-Gaussian RT Model (`lib/confidence/exGaussianRT.ts`)

**Extreme outlier handling:** Excellent.
- Trims 2% from both tails before fitting.
- Returns null (triggering z-score fallback) if fewer than 30 samples or stdDev < 1ms.
- Falls back to Gaussian-only if skewness ≤ 0.1.
- Classifies RT into automatic/normal/effortful/lapse categories with `signalQuality = 0.6` for lapses — meaning attentional lapses (phone buzzes, zone-outs) only carry 60% weight instead of tanking the grade.

**[LOW] The lapse-aware weight redistribution in `implicit-metrics.ts` is particularly well-designed:** when lapse is detected, the effective RT weight is reduced and redistributed proportionally to switch/trajectory/hesitation signals. No corruption of `grade_continuous` from extreme outliers.

### Desirable Difficulty Bonus (`lib/confidence/desirableDifficultyBonus.ts`)

**Gating:** Correctly gated on `isCorrect AND confidence < 0.55`. The effort signal is `(0.55 - confidence) / (0.55 - 0.3)`, meaning only genuinely low-confidence correct answers receive a bonus — being slow alone doesn't qualify. The spacing signal (0–1 over 0–3 days) implements Bjork's spacing effect.

**Bonus range:** [1.05, 1.25] with 60% effort / 40% spacing weighting. Combined with the graduated confidence stability multiplier (which penalizes low confidence at ×0.72), the net effect for a struggling-but-correct answer is `0.72 × 1.25 = 0.90` — a mild penalty, not a paradoxical harsh one.

**[LOW] Edge case:** A lucky guess with high confidence + low latency + long spacing could receive an undeserved bonus, but this is rare and offset by the Ghost Grader's oscillation detection running earlier in the pipeline.

### Bidirectional Ghost Grader (`ghostGrader.ts`)

**Composition with pipeline:** Clean. The Ghost Grader runs **before** the 8-step confidence pipeline in `drillReviewService` (lines 479–502). It produces a `gradeContinuousAdjustment` (range: [-0.10, +0.40]) that modifies `grade_continuous`, which is then clamped to [1.0, 4.0] before entering the stability pipeline.

**Indecision pathway:** Oscillations > 2, selection drift > 3000ms, or tremor > 0.6 → downgrade to Again + cap `grade_continuous` at 1.5. Uses per-user z-score normalization to make thresholds adaptive.

**Confidence boost pathway:** Requires ALL of: zero oscillations, zero regressions, drift < 1000ms, tremor < 0.2, correct answer, latency ratio < 0.8. Produces +0.25 to grade_continuous.

**Elimination velocity:** Fast elimination (>0.8/sec) adds +0.15; slow (<0.2/sec) subtracts 0.10 (only if not already boosted). Maximum combined adjustment: +0.40 (boost + elimination), confirmed by tests.

**[LOW] No conflicting adjustments found.** Indecision and confidence boost are mutually exclusive by construction (a review with oscillations cannot satisfy the zero-oscillation boost requirement). The adjustment is applied once, clamped, and then fed forward — no feedback loop.

### Overall Pipeline Bounding

**Multiplicative stacking worst-case (all bonuses firing):**
Circadian(1.2) × Confidence(1.28) × RT(1.1) × Interval(1.2) × Explanation(1.2) × Relearning(1.3) × DD(1.25) × Trend(1.15) = **~4.5× base stability**

For a new card with 10-day base stability, this yields ~45 days. FSRS itself caps stability at ~36,500 days, so there's no unbounded growth. Each individual multiplier is independently clamped.

**[MEDIUM] Recommendation:** Add a telemetry alert if `modifiedStability > 80 days` to catch real-world cases where multiple bonuses stack simultaneously.

---

## Task 3 — New Drill and Session Component Wiring

### Drills: ElaborationDrill, ICDCodingDrill, TeachBackDrill

All three drills are **correctly wired into FSRS** via the standard path:

| Drill | Hook | Submits via | sessionType | DrillShell wrapper |
|-------|------|-------------|-------------|-------------------|
| ElaborationDrill | `useElaborationDrill` → `useDrillFSRS` | `/api/drills/submit-review` | `'drill'` | ✓ |
| ICDCodingDrill | `useICDDrill` → `useDrillFSRS` | `/api/drills/submit-review` | `'drill'` | ✓ |
| TeachBackDrill | `useTeachBackDrill` → `useDrillFSRS` | `/api/drills/submit-review` | `'drill'` | ✓ |

All three handle loading (skeleton states), error (fallback to previous phase), and empty states. No outcome logging outside the standard FSRS pipeline was detected.

### **[CRITICAL] Missing route registrations**

None of the three new drills are registered in the routing system:

- `lazyComponents.tsx` — no lazy-load entries for ElaborationDrill, ICDCodingDrill, or TeachBackDrill
- `AppRoutes.tsx` — no route definitions
- `DrillViewRouter.tsx` — no routing switch cases
- `routeRegistry.ts` — no ROUTE_REGISTRY entries

**Impact:** The drills are fully built and functional but **completely unreachable** through normal navigation. Users cannot access them.

**Minimal fix:** Add lazy imports, route definitions, router cases, and registry entries for all three drills. Pattern is well-established by the existing 11 drills.

### Session Components

CalibrationFeedbackBadge, SessionPacer, SessionScopeSelector, and HighlightToolbar are all **purely presentational/UI components** with no direct FSRS interaction — they don't log outcomes outside the standard path. No issues found.

---

## Task 4 — Cron and Push Infrastructure

### Cron endpoint security

All cron endpoints use `CRON_SECRET` bearer token validation **except one**:

**[CRITICAL] `push-reminders.ts` uses `authenticatedEndpoint()` instead of `CRON_SECRET`.**

This means the push reminder cron:
- Requires a Clerk JWT token (user authentication) instead of a server-side secret
- Cannot be triggered by external cron schedulers (cron-job.org, GitHub Actions)
- Will fail silently when called by the scheduled job infrastructure

**Minimal fix:** Replace `authenticatedEndpoint()` with the standard `CRON_SECRET` bearer token check used by all other cron endpoints (`reservoir-maintenance.ts`, `generate-daily-plans.ts`, etc.).

### **[CRITICAL] PushSubscription model missing from Prisma schema**

The `push/subscribe.ts` endpoint references `prisma.pushSubscription` for storing push tokens, but **no `PushSubscription` model exists in `prisma/schema.prisma`**. This means:
- Push notification subscriptions cannot be stored
- The push-reminders cron's cleanup logic (lines 184–188) will fail
- The entire push notification system is non-functional

The only push-related field in the schema is `pushNotifications: Boolean @default(false)` in `UserPreferences` — a toggle with no backing subscription storage.

**Minimal fix:** Create a Prisma migration adding the `PushSubscription` model with fields for `endpoint`, `p256dh`, `auth`, `userId`, `createdAt`, and an `expiresAt` TTL column. Add an index on `userId` and a cleanup query in the nightly health check cron.

### Streak auto-freeze offline handling

**[HIGH] The auto-freeze is entirely client-triggered** — it runs on `POST /api/streaks/auto-freeze` which is called on app open. There is **no server-side cron job** that applies freezes for users who are offline.

**Impact:** If a user's device is offline on a day when a freeze should trigger, their streak will break. The freeze is only applied retroactively when they next open the app and connect — but by then the streak gap may have already been counted.

**Minimal fix:** Add a nightly `auto-freeze-all` cron job that iterates eligible users (those with `streakFreezes > 0` and no activity today) and applies freezes server-side.

---

## Task 5 — Exam Readiness Projection Trust

### Linear extrapolation

**File:** `lib/services/insightGenerationService.ts` (lines 210–250)

The projection maps user accuracy to PANCE score scale (200–800) and extrapolates linearly using a weekly gain rate derived from `(recentAccuracy - overallAccuracy) / 4 weeks`.

**Bounding:** Score is clamped to [200, 800] via `Math.min(800, Math.max(200, ...))`. This prevents absurd projections at the extremes.

**Low-data protection:** The system requires 100+ total attempts before returning a trend classification (on_track / at_risk / ahead). Below 100, trend = `'insufficient_data'`. Per-system insights require MIN_SYSTEM_ATTEMPTS = 10.

**[MEDIUM] Gap in the 20–99 attempt range:** The projection algorithm still **calculates and returns** `currentScore` and `projectedScore` for users with < 100 attempts — only the trend label is blocked. A frontend component could display a specific projected score (e.g., "Projected: 650") alongside "insufficient data," creating mixed signals.

**Minimal fix:** Return `null` for `projectedScore` when `totalAttempts < 100`, or include a `projectionReliable: boolean` flag that the frontend respects.

### Cold-start handling

Well-designed. `coldStartCalibrationService.ts` detects users below 30 attempts and serves a balanced calibration session (10 easy / 12 medium / 8 hard). No readiness projections are shown during calibration. The InsightsHub component gates the readiness gauge on `data.examReadiness` being present.

### **[MEDIUM] False precision in confidence display**

The readiness gauge shows:
- An exact projected score as an integer (e.g., "Projected: 642") with no uncertainty bands
- A single "X% confidence" number that is a composite of data volume (60%) and time-to-exam (40%) — not a statistical confidence interval
- A pass/fail threshold line on a progress bar with no visual uncertainty margin

Users will likely interpret "642 at 38% confidence" as a precise prediction with low reliability, rather than understanding that the number itself could vary by ±50–100 points. No tooltip or explanation of what "confidence" means is provided.

**[LOW] Inverted time-confidence:** The confidence score *decreases* as the exam approaches (because `timeConfidence = max(0.3, 1 - daysToExam/365)` — wait, this actually *increases* as the exam approaches). Correction: the formula is fine, but the overall confidence can still be low (30–40%) near the exam if the user has few reviews, which could be alarming.

**Minimal fix:**
1. Display a range instead of a point estimate: "Projected: 620–680"
2. Add a tooltip: "Based on your current pace of improvement. Assumes consistent study."
3. Suppress exact projected scores when `confidence < 0.5`.

---

## Task 6 — Post-Sprint Risk Register

### [CRITICAL] — Fix immediately

**C1. PushSubscription model missing from Prisma schema**
- Root cause: Model was referenced in code but never added to `schema.prisma`
- Affected files: `functions/api/push/subscribe.ts`, `functions/api/cron/push-reminders.ts`, `prisma/schema.prisma`
- Minimal fix: Create migration adding `PushSubscription` model with `endpoint`, `p256dh`, `auth`, `userId`, `createdAt`, `expiresAt`
- Follow-up: Add TTL cleanup to nightly health check cron

**C2. Three new drills have no route registrations**
- Root cause: Components built but routing boilerplate not added
- Affected files: `lazyComponents.tsx`, `AppRoutes.tsx`, `DrillViewRouter.tsx`, `routeRegistry.ts`
- Minimal fix: Add lazy imports, routes, router cases, and registry entries (copy pattern from existing drills)
- Follow-up: None needed; this is the complete fix

**C3. `push-reminders.ts` cron uses user auth instead of CRON_SECRET**
- Root cause: Endpoint scaffolded with wrong middleware
- Affected files: `functions/api/cron/push-reminders.ts`
- Minimal fix: Replace `authenticatedEndpoint()` with `CRON_SECRET` bearer token check
- Follow-up: None

### [HIGH] — Fix within the week

**H1. Inlined calibration math duplicates canonical service logic**
- Root cause: Build-unblocking hotfix copied functions instead of extracting shared module
- Affected files: `functions/api/study/calibration-insights.ts`, `lib/services/retrievabilityCalibrationService.ts`
- Minimal fix: Extract `calibrationMath.ts` shared module; import from both locations
- Follow-up: Audit all Edge endpoints for other Node-only import issues

**H2. `user/calibration` returns degraded response (accuracy only, no Brier/slope/buckets)**
- Root cause: Hotfix replaced full service call with simplified inline query
- Affected files: `functions/api/user/calibration.ts`, `lib/services/calibrationService.ts`
- Minimal fix: Make `getUserCalibration()` Edge-compatible and restore the full call
- Follow-up: Add integration test verifying full response shape

**H3. Streak auto-freeze is client-only — offline users lose streaks**
- Root cause: No server-side cron for applying freezes
- Affected files: `functions/api/streaks/auto-freeze.ts`
- Minimal fix: Add nightly `auto-freeze-all` cron job iterating eligible users
- Follow-up: Consider push notification fallback to remind users before streak breaks

**H4. Exam readiness projections shown for users with 20–99 attempts**
- Root cause: Trend is blocked at <100 attempts but `projectedScore` is still calculated and returned
- Affected files: `lib/services/insightGenerationService.ts`, `components/dashboard/InsightsHub.tsx`
- Minimal fix: Return `projectedScore: null` when `totalAttempts < 100`
- Follow-up: Add visual uncertainty bands to the readiness gauge

### [MEDIUM] — Address this sprint

**M1. Interference detector may over-fire on intentional interleaving**
- Root cause: Distance-only decay with no time-based floor
- Affected files: `lib/confidence/interferenceDetector.ts`
- Minimal fix: Add time-based floor (>5 min between same-condition reviews = no discount)
- Follow-up: A/B test interference sensitivity

**M2. No structured logging in hotfixed endpoints**
- Root cause: `createEndpointLogger()` omitted during hotfix
- Affected files: `functions/api/study/calibration-insights.ts`, `functions/api/user/calibration.ts`
- Minimal fix: Add logger initialization (one-liner per endpoint)
- Follow-up: Lint rule requiring logger in all Edge endpoints

**M3. No telemetry alert for extreme stability stacking**
- Root cause: 9 multiplicative modifiers can compound to ~4.5× base stability
- Affected files: `lib/services/drillReviewService.ts`
- Minimal fix: Add `console.warn` or telemetry event when `modifiedStability > 80 days`
- Follow-up: Dashboard for monitoring stability distribution

**M4. Readiness gauge shows false precision (exact integer, no uncertainty bands)**
- Root cause: UI designed for point estimates without confidence visualization
- Affected files: `components/dashboard/InsightsHub.tsx`, `lib/services/insightGenerationService.ts`
- Minimal fix: Display score range instead of point estimate; add tooltip explaining confidence
- Follow-up: Implement proper bootstrap confidence intervals

**M5. Bayesian accumulator and ex-Gaussian RT lack dedicated unit tests**
- Root cause: Tested only indirectly through integration tests
- Affected files: Need new `bayesianAccumulator.test.ts`, `exGaussianRT.test.ts`
- Minimal fix: Add unit tests for edge cases (zero weight, degenerate distributions, lapse path)
- Follow-up: Coverage target for all confidence pipeline modules

### [LOW] — Backlog

**L1. `getCircadianPhase()` only exists in the inlined endpoint code**
- Root cause: New helper created during hotfix, not extracted
- Affected files: `functions/api/study/calibration-insights.ts`
- Minimal fix: Move to shared calibration math module
- Follow-up: None

**L2. Desirable difficulty bonus can reward lucky guesses (rare)**
- Root cause: No explicit "guess detection" gate
- Affected files: `lib/confidence/desirableDifficultyBonus.ts`
- Minimal fix: None needed now (Ghost Grader catches most cases)
- Follow-up: Monitor via telemetry; add gate if false positive rate > 5%

**L3. Cold-start to full-projection transition is abrupt at 100 attempts**
- Root cause: Binary threshold with no graduated confidence scaling
- Affected files: `lib/services/insightGenerationService.ts`
- Minimal fix: Add graduated scaling in 50–100 range
- Follow-up: User research on perceived reliability

**L4. Session components (CalibrationFeedbackBadge, SessionPacer, etc.) have no integration tests**
- Root cause: New UI components merged without test coverage
- Affected files: `components/session/*.tsx`
- Minimal fix: Add render + interaction tests
- Follow-up: Storybook stories for visual QA

---

## Top 3 Things to Fix Before Next Sprint

1. **Register routes for ElaborationDrill, ICDCodingDrill, TeachBackDrill** [C2] — These are fully built, FSRS-wired drills that users literally cannot reach. Four files need boilerplate additions following the existing 11-drill pattern. Estimated effort: 30 minutes.

2. **Create the PushSubscription Prisma model and fix `push-reminders.ts` auth** [C1 + C3] — The entire push notification system is non-functional. The subscribe endpoint will crash on any call, and the cron can't be triggered by the scheduler. Create the migration, add the model, swap the middleware. Estimated effort: 1 hour.

3. **Extract shared calibration math module to eliminate hotfix duplication** [H1 + H2] — Two endpoints now carry inlined copies of calibration logic. Every future change to drift detection thresholds or bucket binning must be made in two places. Extract `lib/calibration/calibrationMath.ts` and rewire both the service and the endpoints. Estimated effort: 2 hours.
