# Behavioral Analysis Audit — Implementation Plan

**Date:** April 7, 2026
**Source:** `PANaCEa_Behavioral_Analysis_Audit.md`
**Author:** Claude (planning session with Aaron)

## Implementation Status (Updated April 7, 2026)

| Phase | Status | Files | Tests |
|-------|--------|-------|-------|
| Phase 0: Schema Foundation | COMPLETE | prisma/schema.prisma, migration SQL | n/a |
| Phase 0: Grade Modulation Coordinator | COMPLETE | lib/services/gradeModulationCoordinator.ts | 61 tests |
| Phase 0: User RT Baseline Service | COMPLETE | lib/services/userRtBaselineService.ts | included above |
| Phase 0: Weighted Wilson Score | COMPLETE | lib/statistics/wilsonScore.ts | included above |
| Phase 1: Pipeline Integration | COMPLETE | lib/services/drillReviewService.ts | 184 total |
| Phase 2: FSRS Optimizer Fix | COMPLETE | lib/fsrsOptimizerSidecar.ts | transpile verified |
| Phase 3: Quality Score Separation | COMPLETE | lib/services/questionQualityService.ts, questionReviewGate.ts, performance.ts | 36 tests |
| Phase 4: Validation & Calibration | PENDING (post-deploy) | — | — |

**Pre-deploy:** Run `prisma generate` + `prisma migrate deploy` locally.

---

## Critical Mismatches: Audit Assumptions vs. Actual Codebase

Before diving into the plan, there are four architectural mismatches between what the audit document assumes and what the codebase actually contains. These must be resolved first — they change the scope and approach of every implementation step.

### Mismatch 1: Binary Ratings vs. 4-Grade System

**Audit assumes:** Full FSRS 4-grade system (Again=1, Hard=2, Good=3, Easy=4) with continuous grade modulation on [1.0, 4.0].

**Codebase reality:** Binary ratings only — `Rating.Again = 1` and `Rating.Good = 3`. Hard and Easy are deprecated and not used anywhere in the live system.

**Impact:** The audit's entire grade modulation formula (`G_eff = clip(G_raw + δ_RT + δ_conf + δ_streak + δ_fatigue, 1, 4)`) and discrete mapping table need to be adapted. A continuous grade of 2.5 would map to "Good" in the audit's scheme, but "Good" is already 3 in the binary system. The delta values and thresholds must be recalibrated for a [1, 3] effective range, or the system needs to internally use 4-grade for scheduling while presenting binary to the user.

**Recommended resolution:** Keep user-facing binary (Again/Good). Internally, the behavioral pipeline already derives a `gradeContinuous` value on [1.0, 4.0] via `implicit-metrics.ts` → `deriveContinuousRating()`. The audit's modulation should layer on top of this continuous grade, and the existing continuous-to-discrete mapping can stay. This means the audit's delta tables are usable as-is — they modulate the continuous grade before it feeds into FSRS, which already handles continuous values.

### Mismatch 2: The Pipeline Is Far More Sophisticated Than Audited

**Audit assumes:** An undocumented "18-step confidence pipeline" that's a black box.

**Codebase reality:** A well-structured 13+ service pipeline across 3 "waves" with dedicated service files:
- Wave 1: lapseSeverity, rtTrajectory, sessionAccuracySlope, intervalDeviation
- Wave 2: distractorChronometry, switchDirection
- Wave 3: explanationEngagement, sessionRegularity, relearningSpeed, confusionPairRecurrence
- Plus: bayesianAccumulator, interferenceDetector, fluencyIllusionDampener, desirableDifficultyBonus, trendDetector, difficultyModulator

**Impact:** The audit's proposed `behavioralAnalysis.ts` as a single standalone service would be a *consolidation/simplification*, not a greenfield build. Many of the audit's proposed functions already exist in more sophisticated forms.

**Recommended resolution:** Don't create a monolithic `behavioralAnalysis.ts`. Instead, apply the audit's improvements as targeted upgrades to the existing modular architecture. The signal extraction layer, delta calculations, and grade modulation should be added as a new "coordination" layer that wraps the existing wave services.

### Mismatch 3: Behavioral Data Is in Telemetry JSON, Not Top-Level Columns

**Audit assumes:** ReviewLog lacks behavioral data entirely and needs new columns.

**Codebase reality:** ReviewLog already stores comprehensive behavioral data in a `telemetry` JSON column — including confidence pipeline v3 outputs, wave signals, RT trajectory, distractor chronometry, switch direction metrics, and more. It also has dedicated columns for `implicit_confidence`, `responseTimeMs`, `hover_oscillations`, `vignette_regressions`, `time_to_first_interaction`.

**Impact:** The schema migration needs to be scoped more carefully. Some proposed fields (rtZone, confidenceRating, behavioralDeltas) are already captured in the telemetry JSON. The question is whether to promote them to top-level indexed columns for query performance and optimizer access, or leave them in JSON.

**Recommended resolution:** Promote `effectiveGrade` (as `grade_continuous` — which is similar but not identical) and `rawGrade` to top-level indexed columns on ReviewLog. Keep the rest in the telemetry JSON but ensure the FSRS optimizer can extract them. Add `medianResponseTimeMs` to UserSRSConfig as a materialized stat.

### Mismatch 4: Grade Field Semantics

**Audit assumes:** `ReviewLog.grade` stores the raw button-press grade.

**Codebase reality:** The `grade` field on ReviewLog stores the FSRS rating that was actually applied (which may already be the implicit/behavioral-derived rating). There is `grade_continuous` in telemetry but no separate `rawGrade` column.

**Impact:** The training/serving skew (Gaps 2 & 8) may be different than the audit describes. Need to trace exactly what value gets written to `grade` vs what FSRS actually uses.

**Recommended resolution:** Add explicit `rawGrade` and `effectiveGrade` columns. Backfill `rawGrade` from existing `grade` values for historical data. Going forward, store both.

---

## Phased Implementation Plan

### Phase 0: Schema Foundation (Prerequisites)
**Priority:** Critical — blocks all other phases
**Estimated effort:** 1–2 sessions

#### 0.1 Prisma Schema Changes

Add to `ReviewLog`:
```prisma
rawGrade          Float?    // The unmodulated grade (button press or binary implicit)
effectiveGrade    Float?    // The behaviorally-modulated grade fed to FSRS
behavioralDeltas  Json?     // {rtDelta, confDelta, streakDelta, fatigueDelta, total}
```

Add to `UserSRSConfig`:
```prisma
medianResponseTimeMs  Int?    // Rolling median RT, updated post-session
responseTimeSampleN   Int     @default(0)
```

Add to `DrillSessionRecord`:
```prisma
rollingAccuracy       Float?  // Last-10-question accuracy (for fatigue detection)
rollingMeanRtMs       Int?    // Last-10-question mean RT (for fatigue detection)
sessionMeanAccuracy   Float?  // Running session accuracy
```

#### 0.2 Migration

- Write Prisma migration with nullable columns (no breaking changes)
- Use `CREATE INDEX CONCURRENTLY` on `effectiveGrade` for optimizer queries
- Run `prisma generate`
- Backfill `rawGrade` = `grade` for all existing ReviewLog rows (async script)

#### 0.3 Verification Gate
- [ ] Migration applies cleanly
- [ ] `prisma generate` succeeds
- [ ] Existing tests pass (254 confidence + FSRS tests)
- [ ] Backfill script tested on staging subset

---

### Phase 1: Signal Extraction Coordination Layer
**Priority:** High
**Estimated effort:** 2–3 sessions
**Depends on:** Phase 0

Rather than replacing the existing wave services, create a coordination module that:
1. Collects outputs from existing services
2. Adds the audit's RT zone classification and fatigue scoring
3. Computes the aggregate delta values
4. Produces the final `GradeModulation` result

#### 1.1 Create `lib/services/gradeModulationCoordinator.ts`

This is the audit's `behavioralAnalysis.ts` adapted for the existing architecture:

**Types to define:** `BehavioralContext`, `BehavioralSignals`, `GradeModulation` (as specified in audit Part 4, Step 3)

**Constants:** `BEHAVIORAL_CONSTANTS` object (as specified in audit)

**Functions:**
- `classifyRtZone()` — NEW. Uses per-user median RT with 0.5×/1.5× thresholds
- `computeFatigueScore()` — NEW. Rolling window RT ratio + accuracy ratio
- `calculateRtDelta()` — NEW. Maps RT zone × correctness → delta value
- `calculateConfidenceDelta()` — WRAPS existing `bayesianAccumulator` output, maps to delta
- `calculateStreakDelta()` — NEW. Simple streak count → delta with hard cap
- `calculateFatigueDelta()` — NEW. Fatigue score × -0.2
- `modulateGrade()` — NEW COORDINATOR. Calls all delta functions, clips to [1.0, 4.0]

**Key design decision:** This coordinator does NOT replace the existing confidence pipeline. It runs *after* the existing pipeline and produces the final effective grade. The existing pipeline's `gradeContinuous` becomes the `rawGrade` input to the coordinator.

#### 1.2 Per-User RT Baseline Materialization

Create `lib/services/userRtBaselineService.ts`:
- `updateUserMedianRt(userId, prisma)` — queries last 50 ReviewLogs, computes median, upserts to UserSRSConfig
- Called at session completion (end of submit-review for final question, or from session completion endpoint)
- 5-session grace period: if `responseTimeSampleN < 25`, RT delta = 0

#### 1.3 Session Rolling Window Persistence

Update DrillSessionRecord to track rolling stats incrementally:
- After each question submission, update `rollingAccuracy`, `rollingMeanRtMs`, `sessionMeanAccuracy`
- These feed into the fatigue score calculation

#### 1.4 Verification Gate
- [ ] All delta functions individually unit tested
- [ ] `modulateGrade()` boundary cases tested (per audit Step 7 spec)
- [ ] RT baseline update tested with <5 reviews (should no-op)
- [ ] Fatigue detection tested with sessionQuestionIndex < 10 (should return 0)
- [ ] TypeScript compiles clean

---

### Phase 2: Pipeline Integration
**Priority:** High
**Estimated effort:** 2 sessions
**Depends on:** Phase 1

#### 2.1 Refactor `drillReviewService.ts`

Integrate the grade modulation coordinator into the existing pipeline:

1. After existing confidence pipeline runs and produces `gradeContinuous`:
   - Build `BehavioralContext` from available signals
   - Call `modulateGrade(context)` → `GradeModulation`
   - Use `GradeModulation.discreteGrade` for FSRS update (instead of current discrete mapping)

2. Store both grades in ReviewLog:
   - `rawGrade` = original `gradeContinuous` (before modulation)
   - `effectiveGrade` = `GradeModulation.effectiveGrade`
   - `behavioralDeltas` = JSON of all delta components

3. Add Sentry span `'behavioral-grade-modulation'` wrapping the coordinator call

4. Log `GradeModulation` result at DEBUG level via structuredLogger

**Constraints (from audit):**
- Do NOT change function signatures called by `submit-review.ts`
- Do NOT change what is returned to the caller
- Do NOT change FSRS update logic itself
- ONLY change how the grade fed to FSRS is computed

#### 2.2 Update `submit-review.ts`

- Pass `userMedianRtMs` from UserSRSConfig into the review context
- Pass `rollingAccuracy`, `rollingMeanRtMs` from DrillSessionRecord
- Call `updateUserMedianRt()` after final question in session

#### 2.3 Verification Gate
- [ ] Existing 254 tests still pass
- [ ] New integration tests for modulated grade flow
- [ ] Shadow mode: log effectiveGrade but schedule with rawGrade (2-week validation)
- [ ] Sentry spans visible in dashboard

---

### Phase 3: FSRS Optimizer Fix
**Priority:** Critical (blocks personalization)
**Estimated effort:** 1 session
**Depends on:** Phase 2

#### 3.1 Fix Known Field Name Bugs in `fsrs-params.ts`

Per audit: `review_date` → `reviewedAt`, `rating` → `grade`, `duration` → `responseTimeMs`

#### 3.2 Update Optimizer to Use `effectiveGrade`

```typescript
// Select both grades
select: {
  reviewedAt: true,
  effectiveGrade: true,  // NEW: prefer modulated
  grade: true,           // FALLBACK: raw/historical
  responseTimeMs: true,
  stability: true,
  difficulty: true,
  state: true,
}

// In mapping:
rating: (r.effectiveGrade ?? r.grade) as ReviewSnapshot['rating'],
```

#### 3.3 Add Monitoring

Log what percentage of training records use `effectiveGrade` vs `grade` fallback. This should trend toward 100% effectiveGrade over time as new reviews accumulate.

#### 3.4 Verification Gate
- [ ] Optimizer compiles and runs on test data
- [ ] Field name fixes verified against actual Prisma schema
- [ ] Logging shows correct effectiveGrade/grade split

---

### Phase 4: Wilson Score Enhancement
**Priority:** Medium
**Estimated effort:** 0.5 session
**Depends on:** Phase 0

#### 4.1 Add `weightedWilsonScore()` to `lib/statistics/wilsonScore.ts`

- Accepts `Array<{ isCorrect: boolean; reviewedAt: Date }>`
- Attempts within `recentDaysCutoff` (default 30) get 2× weight
- Returns `{ lower, upper, point, n_effective }`
- Does NOT modify existing `wilsonScore()` function

#### 4.2 Update `hasMastery()` and `masteryLevel()`

Add optional `weighted: boolean` parameter that delegates to new variant when true.

#### 4.3 Verification Gate
- [ ] Weighted Wilson score unit tests (all-recent, mixed old/recent, mastery threshold)
- [ ] Existing Wilson score tests unchanged and passing

---

### Phase 5: Quality Score Separation
**Priority:** Medium
**Estimated effort:** 1 session
**Depends on:** Phase 1

#### 5.1 Audit `qualityScore` Usage

Per audit Gap 5: `qualityScore` on `PreGeneratedQuestion` is used for both question quality assessment AND student performance signals. These must be separated.

- Question quality: DifficultyAlignment, DiscriminationIndex, DistractorEffectiveness, ClinicalRelevance
- Student performance: behavioral pipeline output (completely separate concern)

#### 5.2 Create `lib/services/questionQualityService.ts`

Implement the audit's 4-component quality score formula:
- Q = 0.40×DifficultyAlignment + 0.25×DiscriminationIndex + 0.20×DistractorEffectiveness + 0.15×ClinicalRelevance
- Auto-approve only when ALL four components ≥ 85 (not just composite ≥ 90)

#### 5.3 Verification Gate
- [ ] Quality score no longer conflated with confidence pipeline
- [ ] Question review queue uses new quality service
- [ ] Existing question generation flow unaffected

---

### Phase 6: Validation & Calibration (Post-Deploy)
**Priority:** High (but sequential after Phases 1–4)
**Estimated effort:** Ongoing, 4–6 weeks

#### 6.1 Shadow Mode (Weeks 1–2)

- Run `modulateGrade()` on all reviews
- Log `effectiveGrade` in ReviewLog
- Continue scheduling with `rawGrade`
- Compare Brier scores: `effectiveGrade` predictions vs `rawGrade` predictions vs actual outcomes

#### 6.2 A/B Test (Weeks 3–4)

- Enable behavioral modulation for 10% of users
- Measure: session Brier score, 7-day retention rate, next-session accuracy
- Rollback if Brier score increases

#### 6.3 Optimizer Re-Train (Week 5+)

- After 4 weeks of `effectiveGrade` data
- Re-run FSRS parameter optimization for top-10 users by review count
- Verify Brier score improvement > 5% vs default parameters

#### 6.4 Ongoing Monitoring Targets

| Metric | Target | Alert |
|--------|--------|-------|
| Mean fatigueScore/session | < 0.15 | > 0.40 |
| Reviews with RT modulation | 20–40% | < 5% |
| effectiveGrade vs rawGrade divergence | < ±0.5 avg | > ±1.0 |
| FSRS Brier score (30d rolling) | < 0.08 | > 0.12 |
| Wilson mastery inflation | < 5%/month | > 10% |

---

## Implementation Order Summary

```
Phase 0 (Schema)           ← START HERE
  ↓
Phase 1 (Signal Layer)     ← Core new code
  ↓
Phase 2 (Integration)      ← Wire into existing pipeline
  ↓                    ↘
Phase 3 (Optimizer)    Phase 4 (Wilson)    Phase 5 (Quality Score)
  ↓                        ↓                    ↓
Phase 6 (Validation)  ← All phases complete, begin shadow mode
```

## Known Risks

1. **RT baseline cold start:** New users have no median RT. The 15,000ms fallback is conservative. Implement 5-session grace period where RT delta = 0.

2. **Confidence rating not captured in UX:** No pre/post-answer confidence prompt exists. The confidence delta branch will default to `'unknown'` (zero delta) until a 3-point confidence prompt is added. This is the highest-leverage UX addition for the pipeline.

3. **Session reconnection:** Rolling window stats must persist to DrillSessionRecord (Phase 1.3) before fatigue detection is reliable. Without this, a page refresh resets the window.

4. **Backward compatibility:** All new ReviewLog columns are nullable. Historical data gets `rawGrade` backfilled from `grade`. The optimizer falls back to `grade` when `effectiveGrade` is null. Zero breaking changes.

5. **Pipeline latency:** Adding the grade modulation coordinator adds one more step to an already 13+ step pipeline. The coordinator itself is pure math (microseconds), but the RT baseline query (Phase 1.2) adds a DB read. Mitigate by caching `userMedianRtMs` in the request context at session start.
