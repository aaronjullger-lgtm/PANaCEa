---
name: panacea-navigator
description: >
  PANaCEa codebase map and architecture guide for navigating the StudyPANaCEa repo.
  Use this skill whenever working on PANaCEa code — adding features, debugging, modifying
  services, understanding imports, or figuring out where a file belongs. Also use when
  the user says "where does X go", "how does Y work in the codebase", "what calls what",
  or any task that touches the repo structure. This skill prevents wrong-directory mistakes,
  forgotten imports, and misunderstood data flows that waste entire sprint cycles.
---

# PANaCEa Codebase Navigator

## Why this exists

PANaCEa is a 6,000+ TypeScript file clinical education platform. Without a mental map,
you'll waste time grepping, put files in wrong directories, miss existing utilities,
or break import chains. This skill gives you that map.

## Repo location

`/Users/aaronullger/GitHub/StudyPANaCEa` — deployed on Cloudflare Pages.

## Architecture overview

PANaCEa is a React + Vite frontend with Cloudflare Pages Functions as the API layer,
backed by Supabase Postgres (project ID: `lzfescdrpezzjhgveotz`, PG 17, 130+ tables)
via Prisma ORM with Accelerate.

## Directory map

```
config/
  appViews.ts          — Master view registry. Config-driven: add view here → it exists.
  lazyComponents.tsx   — Lazy-loaded component mappings for code splitting.

components/
  session/             — Core study session UI (QuizView, SessionRunner, CalibrationPanel, etc.)
  quiz/                — Quiz sub-components (Tracker, answer rendering)
  dashboard/           — Dashboard page components (CurriculumGrid, RetentionForecast, charts/)
  layout/              — DrillViewRouter, navigation, app shell

hooks/
  useMicroKinetics.ts  — Mouse behavioral telemetry (oscillations, tremor, drift)
  useTouchKinetics.ts  — Touch-equivalent behavioral signals
  useUnifiedKinetics.ts — Device-detecting adapter (routes to mouse or touch hook)

lib/
  fsrs.ts + fsrs/      — FSRS v6 implementation. Rating enum lives in lib/fsrs.
  implicit-metrics.ts  — deriveContinuousRating(), assessTelemetryQuality()
  circadian.ts         — buildCircadianContext(), applyCircadianModifier()
  srs/
    ghostGrader.ts     — Behavioral honesty enforcement (bidirectional v2)
  services/
    drillReviewService.ts        — THE central review pipeline. Most changes flow through here.
    retrievabilityCalibrationService.ts — Predicted vs actual recall + drift detection
    fsrsOptimizerService.ts      — Coordinate descent parameter optimizer + circadian
    userTimingProfileService.ts  — Per-user behavioral baselines (RT, switches, hesitation)
    userProgressService.ts       — UserProgress CRUD + history
```

```
    semanticSiblingService.ts    — Propagate recall to related concepts
    rolling360Service.ts         — 360-review aggregation
    sessionFatigueService.ts     — Fatigue correction for par time
    antiGamingDistribution.ts    — Prevents gaming via answer distribution checks
    learnerStageBlueprint.ts     — Learner-stage-aware session blueprints
    conceptMasteryIntegration.ts — Concept-level mastery tracking
    conceptQuestionSelector.ts   — Question selection by concept

functions/api/
  srs/submit.ts        — POST /api/srs/submit — the API route for drill review submission
  study/               — Study session endpoints (calibration-insights, session/generate, etc.)

types/
  telemetry.ts         — TelemetryData interface, getMVRTThreshold

tests/                 — Vitest test files (ghostGraderV2, retrievabilityDrift, etc.)
pages/                 — Top-level page components (ProgressPage, SimulationPage, etc.)
```

## Key data flow: Drill review submission

This is the most important pipeline. Almost every FSRS/behavioral feature touches it:

```
QuizView.tsx (user answers)
  → useUnifiedKinetics (behavioral telemetry)
  → POST /api/srs/submit (functions/api/srs/submit.ts)
    → drillReviewService.submitDrillReview()
      1. calculateParTime → applyFatigueCorrection → applyCircadianParTimeModifier
      2. deriveContinuousRating() — implicit behavioral rating
      3. applyHonestRatingWithDetail() — Ghost Grader (bidirectional)
      4. getStabilityCorrectionFactor() — retrievability calibration
      5. getOptimizedParameters() — personalized FSRS w-params
      6. FSRS.repeat() — compute next interval
      7. Write: QuestionAttempt, ReviewLog, UserProgress, UserStatistics
```

## Config-driven views

PANaCEa uses a config-driven view system. To add a new view:
1. Add the component to `config/lazyComponents.tsx`
2. Register the route/view in `config/appViews.ts`
3. The DrillViewRouter in `components/layout/` picks it up automatically

Do NOT create ad-hoc routing. Everything goes through the config.

## Prisma gotchas

- **Accelerate proxy**: Prisma runs through Cloudflare's Accelerate, not direct DB.
  Some features (raw SQL, certain aggregations) may not work as expected.
- **Schema location**: `prisma/schema.prisma` — 130+ tables. Check it before assuming
  a column exists.
- **Enum values**: Prisma enums use UPPER_CASE (e.g., `CircadianPhase.PEAK`).
  The lib/ circadian code uses lowercase strings — convert with helper functions.

## Import conventions

- FSRS Rating enum: `import { Rating } from '../fsrs'` (from lib/fsrs/index.ts)
- Services import each other freely within `lib/services/`
- Hooks are in `hooks/` at project root
- Types in `types/` at project root
- Always use relative imports, never aliases (no `@/` paths)

## When adding a new service

1. Create in `lib/services/`
2. Export pure algorithm functions (for testing) AND async DB-integrated functions
3. Add tests in `tests/` with the service name
4. Wire into `drillReviewService.ts` if it affects the review pipeline
5. Cache with in-memory TTL pattern (see existing services for examples)
