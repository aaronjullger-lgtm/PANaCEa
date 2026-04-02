# Confidence Pipeline v2 — Sprint Plan

**Created:** 2026-04-02
**Scope:** 6 improvements to PANaCEa's behavioral telemetry → confidence → FSRS scheduling pipeline
**Constraint:** No changes to core FSRS math (`lib/fsrs.ts`). Only behavioral inputs, confidence derivation, and stability modifiers.

---

## Sprint Overview

| Sprint | Name | Duration | Dependencies |
|--------|------|----------|-------------|
| 1 | Per-Student Baseline Normalization | 3 days | None (uses existing `userTimingProfileService`) |
| 2 | Metacognitive Calibration Score | 2 days | Sprint 1 (needs normalized signals) |
| 3 | Question-Type Signal Weighting | 2 days | Sprint 1 (extends per-user profiles) |
| 4 | Bayesian Confidence Accumulation | 3 days | Sprints 1–3 (consumes calibrated signals) |
| 5 | Optimizer Telemetry Quality Weighting | 2 days | Sprints 1–2 (needs calibration + quality tags) |
| 6 | Calibration Validation Pipeline | 2 days | All prior sprints (offline analysis) |

**Total estimated:** 14 dev-days

---

## Sprint 1: Per-Student Baseline Normalization

### Problem
The confidence model uses absolute thresholds: RT is scored as `1 - log(rtRatio) / log(3)`, answer switches are penalized at a flat 0.2 per switch, and hesitation signals use fixed normalization denominators (e.g., commitmentGap / 4000ms). A methodical student who always takes 25s gets the same RT penalty as a fast student who usually takes 8s but spiked to 25s — even though those mean very different things.

### Research Basis
- **Ratcliff & McKoon (2008)** — Response time distributions are log-normal and individual-specific. Within-person z-scoring produces better discriminability than raw RT.
- **Van der Linden (2006)** — Person-specific speed-accuracy tradeoff parameters improve item response models.
- The existing `userTimingProfileService.ts` already computes per-user speed factors and per-tier medians from the last 200 attempts across 60 days. This infrastructure can be extended.

### Design

#### 1.1 Extend UserTimingProfile with behavioral baselines

**File:** `lib/services/userTimingProfileService.ts`

Add rolling statistics beyond just speed factor:

```typescript
export interface UserBehavioralBaseline {
  // Existing
  speedFactor: number;
  tiers: TierProfile[];
  totalAttempts: number;
  computedAt: string;

  // NEW — per-signal baselines (rolling 50-attempt window)
  rtBaseline: {
    medianMs: number;
    stdDevMs: number;   // For z-scoring
    p25Ms: number;      // 25th percentile
    p75Ms: number;      // 75th percentile
    n: number;
  };
  switchBaseline: {
    medianSwitches: number;
    p75Switches: number;
    n: number;
  };
  hesitationBaseline: {
    medianCommitmentGapMs: number;
    medianCursorEntropy: number;
    medianOscillations: number;
    n: number;          // Only count attempts with CRPL data
  };
}
```

**New function:** `computeBehavioralBaseline(prisma, userId)` — queries recent QuestionAttempts with `telemetryJson IS NOT NULL`, extracts behavioral signals from the JSON, computes rolling percentile stats. Uses the same 200-attempt / 60-day window as existing speed factor.

**Caching:** Store in `UserStatistics.timingProfile` JSON (rename conceptually to `behavioralProfile`). Refresh when stale (>24h or >20 new attempts since last compute).

#### 1.2 Z-score normalization in confidence signals

**File:** `lib/implicit-metrics.ts`

Add an optional `baseline` parameter to `deriveContinuousRating`:

```typescript
export interface UserBaseline {
  rtMedianMs: number;
  rtStdDevMs: number;
  switchMedian: number;
  switchP75: number;
  commitmentGapMedianMs: number;
  cursorEntropyMedian: number;
  oscillationMedian: number;
}

deriveContinuousRating(
  metrics: ImplicitBehaviorMetrics,
  config?: ImplicitRatingConfig,
  baseline?: UserBaseline         // NEW — optional per-user baseline
): ContinuousRatingResult
```

When `baseline` is provided, normalize signals against user norms:

| Signal | Current | Normalized |
|--------|---------|-----------|
| sRT | `1 - log(rtRatio) / log(3)` | `1 - zScore(rtMs, baseline.rtMedian, baseline.rtStdDev) / 3` clamped [0, 1] |
| sSwitch | `1 - switches × 0.2` | `1 - (switches / max(1, baseline.switchP75 × 1.5)) × 0.5` clamped [0.2, 1] |
| sHesitation.gapNorm | `1 - gap / 4000` | `1 - gap / max(4000, baseline.commitmentGapMedian × 3)` |
| sHesitation.entropyNorm | `1 - max(0, entropy - 1) / 2` | `1 - max(0, entropy - baseline.cursorEntropyMedian) / (baseline.cursorEntropyMedian × 2)` |
| sHesitation.oscNorm | `1 - oscillations × 0.25` | `1 - oscillations / max(4, baseline.oscillationMedian × 3)` |

When `baseline` is absent (new users, <25 attempts), fall back to current absolute thresholds — zero behavior change for cold-start.

#### 1.3 Integrate in drillReviewService

**File:** `lib/services/drillReviewService.ts`

After fetching `userSpeedFactor`, also fetch the behavioral baseline:

```typescript
const baseline = await getUserBehavioralBaseline(prisma, userId);
const { grade, confidence, discreteRating } = deriveContinuousRating(
  behaviorMetrics,
  undefined,      // default config
  baseline        // per-user normalization
);
```

#### 1.4 Tests

**File:** `tests/per-user-normalization.test.ts`

- Slow student (rtMedian=25000ms) answering in 25000ms → sRT ≈ 0.5 (neutral), not penalized
- Fast student (rtMedian=8000ms) answering in 25000ms → sRT low (penalized — this is abnormally slow for them)
- New user with no baseline → falls back to absolute thresholds exactly
- Switch-heavy student (switchMedian=2) with 2 switches → neutral, not penalized
- Baseline refresh triggers after >20 new attempts
- Edge cases: baseline.rtStdDevMs = 0 (all same time), baseline with n < MIN_ATTEMPTS

### Files Modified
| File | Change |
|------|--------|
| `lib/services/userTimingProfileService.ts` | Add `UserBehavioralBaseline`, `computeBehavioralBaseline()`, `getUserBehavioralBaseline()` |
| `lib/implicit-metrics.ts` | Add `UserBaseline` interface, optional param to `deriveContinuousRating`, z-score normalization paths |
| `lib/services/drillReviewService.ts` | Fetch baseline, pass to `deriveContinuousRating` |
| `tests/per-user-normalization.test.ts` | New test file (~20 tests) |

---

## Sprint 2: Metacognitive Calibration Score

### Problem
Some students are well-calibrated (their behavioral confidence predicts actual retention), while others exhibit systematic bias — either overconfident (fast + decisive but frequently wrong on next review) or underconfident (hesitant but actually retains well). The current model treats all students' behavioral signals identically.

### Research Basis
- **Dunlosky & Nelson (1992)** — Judgments of learning (JOLs) vary dramatically in calibration across individuals. Calibration can be quantified and used as a correction factor.
- **Koriat (1997)** — Metacognitive monitoring accuracy differs by person. Cue utilization theory: some learners attend to non-diagnostic cues (fluency) while others use diagnostic cues (effort).
- **Brier (1950)** — Brier score = mean of (predicted probability - actual outcome)² is the standard metric for probability calibration.

### Design

#### 2.1 Calibration tracker

**New file:** `lib/services/calibrationService.ts`

```typescript
export interface CalibrationBucket {
  confidenceRange: [number, number]; // e.g., [0.3, 0.5]
  predictedRetention: number;        // mean confidence in bucket
  actualRetention: number;           // fraction correct on NEXT review
  count: number;
}

export interface UserCalibration {
  brierScore: number;           // 0 = perfect, 1 = worst
  calibrationSlope: number;     // >1 = underconfident, <1 = overconfident
  calibrationIntercept: number; // Bias term
  buckets: CalibrationBucket[];
  dampenerFactor: number;       // Derived correction: 1.0 = well-calibrated
  n: number;
  computedAt: string;
}
```

**Logic:** For each past review pair (review_i, review_i+1) of the same conditionId:
1. `predicted` = confidence from review_i
2. `actual` = wasCorrect from review_i+1 (binary: 0 or 1)
3. Bin into 5 calibration buckets: [0.3–0.5), [0.5–0.6), [0.6–0.7), [0.7–0.8), [0.8–0.95]
4. Compute Brier score, linear regression slope/intercept
5. Derive `dampenerFactor`:
   - Well-calibrated (slope 0.8–1.2, Brier < 0.25): factor = 1.0 (trust confidence as-is)
   - Overconfident (slope < 0.8): factor = 0.7 + 0.3 × slope (dampen high confidence)
   - Underconfident (slope > 1.2): factor = min(1.3, 0.7 + 0.3 × slope) (boost confidence)

**Minimum data:** Requires ≥30 review pairs. Below threshold → dampenerFactor = 1.0 (no adjustment).

#### 2.2 Integration

**File:** `lib/services/drillReviewService.ts`

After computing `adjustedConfidence` (post fluency-illusion dampener):

```typescript
const calibration = await getUserCalibration(prisma, userId);
adjustedConfidence *= calibration.dampenerFactor;
// Store in ReviewLog telemetry for transparency
server_computed.calibration_factor = calibration.dampenerFactor;
server_computed.brier_score = calibration.brierScore;
```

#### 2.3 Storage

**Schema change:** Add `calibrationProfile Json?` to `UserStatistics` model. Recomputed every 50 new reviews or every 7 days (whichever comes first).

Alternatively: store in `UserStatistics.timingProfile` JSON alongside behavioral baseline (avoids schema migration).

#### 2.4 Tests

**File:** `tests/calibration-service.test.ts`

- Perfect calibration (confidence matches retention) → dampenerFactor = 1.0
- Overconfident student (confidence 0.8 but only 50% retention) → dampener < 1.0
- Underconfident student (confidence 0.4 but 80% retention) → dampener > 1.0
- Insufficient data (<30 pairs) → dampener = 1.0
- Brier score computation correctness
- Bucket edge cases (all reviews in same bucket)
- Dampener bounds (never below 0.7, never above 1.3)

### Files Modified/Created
| File | Change |
|------|--------|
| `lib/services/calibrationService.ts` | **New** — CalibrationBucket, UserCalibration, computeCalibration(), getUserCalibration() |
| `lib/services/drillReviewService.ts` | Fetch calibration, multiply into adjustedConfidence, log to telemetry |
| `prisma/schema.prisma` | Optional: add `calibrationProfile Json?` to UserStatistics (or reuse timingProfile) |
| `tests/calibration-service.test.ts` | **New** (~15 tests) |

---

## Sprint 3: Question-Type Signal Weighting

### Problem
A clinical vignette and an image interpretation question produce completely different behavioral signatures. For vignettes, RT is highly diagnostic (reading speed varies). For image questions, dwell time and cursor trajectory matter more (scanning patterns). For recall questions, answer switches are the strongest signal (you either know it or you don't). The current model uses one global weight vector for all question types.

### Research Basis
- **Rayner (1998)** — Eye tracking in reading vs. scene perception shows fundamentally different cognitive engagement patterns.
- **Ericsson & Kintsch (1995)** — Long-term working memory theory: different question formats engage different retrieval mechanisms that produce different behavioral signatures.
- The existing `QuestionType` enum already classifies questions: `vignette | recall | image | rapid_recall | unknown`.

### Design

#### 3.1 Per-type weight profiles

**File:** `lib/implicit-metrics.ts`

```typescript
export const QUESTION_TYPE_WEIGHTS: Record<QuestionType, ConfidenceWeights> = {
  vignette: {
    rtWeight: 0.40,          // Reading speed highly diagnostic
    switchWeight: 0.20,
    trajectoryWeight: 0.15,
    hesitationWeight: 0.25,  // Deliberation expected, penalize less
  },
  recall: {
    rtWeight: 0.30,          // Fast/slow less informative
    switchWeight: 0.40,      // Switching = didn't know it
    trajectoryWeight: 0.10,
    hesitationWeight: 0.20,
  },
  image: {
    rtWeight: 0.20,          // Scanning time varies widely
    switchWeight: 0.20,
    trajectoryWeight: 0.35,  // Cursor movement very diagnostic
    hesitationWeight: 0.25,
  },
  rapid_recall: {
    rtWeight: 0.50,          // Speed is the whole point
    switchWeight: 0.30,
    trajectoryWeight: 0.05,
    hesitationWeight: 0.15,
  },
  unknown: {                 // Fall back to current global weights
    rtWeight: 0.35,
    switchWeight: 0.25,
    trajectoryWeight: 0.20,
    hesitationWeight: 0.20,
  },
};
```

#### 3.2 Pass question type through the pipeline

**Current state:** `telemetry.question_type` is available in the submission payload but not passed to `deriveContinuousRating`.

**Change in `lib/implicit-metrics.ts`:**
- Add `questionType?: QuestionType` to `ImplicitBehaviorMetrics`
- In the confidence computation block, look up `QUESTION_TYPE_WEIGHTS[metrics.questionType ?? 'unknown']` and use those weights instead of the global `confidenceParams`

**Change in `lib/services/drillReviewService.ts`:**
- Pass `questionType: telemetry?.question_type as QuestionType` into `behaviorMetrics`

#### 3.3 Tests

**File:** `tests/question-type-weights.test.ts`

- Vignette with slow RT penalized less than recall with same RT
- Image question with high cursor entropy penalized more than vignette
- Recall question with 3 switches penalized more than image with 3 switches
- Unknown/missing type falls back to global weights exactly
- Weight vectors all sum to 1.0 (validated programmatically)
- rapid_recall type with fast RT produces very high confidence

### Files Modified
| File | Change |
|------|--------|
| `lib/implicit-metrics.ts` | Add `QUESTION_TYPE_WEIGHTS`, `questionType` to metrics interface, weight lookup in confidence block |
| `lib/services/drillReviewService.ts` | Pass `questionType` into behaviorMetrics |
| `types/telemetry.ts` | No change needed (QuestionType already exported) |
| `tests/question-type-weights.test.ts` | **New** (~15 tests) |

---

## Sprint 4: Bayesian Confidence Accumulation

### Problem
Currently each review produces a one-shot confidence estimate. But if a student has reviewed the same card 5 times with behavioral hesitation every time, that's much stronger evidence of weak encoding than a single hesitant review. Conversely, one anomalously slow review after 4 fast ones shouldn't tank confidence.

### Research Basis
- **Bayesian updating** — Standard probabilistic inference. Prior belief × likelihood → posterior belief.
- **Mozer et al. (2009)** — Bayesian models of memory demonstrate that accumulating evidence across study events improves prediction of long-term retention.
- **Benjamin et al. (1998)** — Judgments of learning become more accurate with repeated testing (the "delayed-JOL effect"). Historical context improves metacognitive accuracy.

### Design

#### 4.1 Confidence history on UserProgress

**File:** `lib/services/drillReviewService.ts` (or new service)

UserProgress.reviewHistory already stores JSON snapshots per review. Extend the shape to include confidence:

```typescript
interface ReviewSnapshot {
  // Existing fields
  date: string;
  grade: number;
  state: number;

  // NEW
  confidence: number;        // From that review's deriveContinuousRating
  wasCorrect: boolean;
  telemetryQuality: TelemetryQuality;
}
```

#### 4.2 Bayesian accumulator

**New file:** `lib/confidence/bayesianAccumulator.ts`

```typescript
export interface AccumulatedConfidence {
  posterior: number;        // Bayesian-updated confidence
  priorWeight: number;      // How much the prior influenced (0 = all current, 1 = all history)
  historyLength: number;
}

export function accumulateConfidence(
  currentConfidence: number,
  history: Array<{ confidence: number; wasCorrect: boolean; telemetryQuality: TelemetryQuality }>,
  config?: {
    decayFactor?: number;       // Weight decay for older reviews (default: 0.7)
    minHistoryForPrior?: number; // Don't use prior until N reviews (default: 3)
    maxHistory?: number;         // Only use last N reviews (default: 10)
    qualityWeights?: Record<TelemetryQuality, number>; // full=1.0, partial=0.6, minimal=0.3
  }
): AccumulatedConfidence
```

**Algorithm:**
1. If `history.length < minHistoryForPrior` → return `currentConfidence` unchanged
2. Compute weighted historical mean:
   - Weight each past review by: `decayFactor^(age_index) × qualityWeight × correctnessAlignment`
   - `correctnessAlignment`: if past review was correct AND current is correct, weight more (consistent signal); if mismatch, weight less (the card's difficulty may have changed)
3. Bayesian blend:
   - `priorWeight = min(0.4, history.length / (history.length + 5))` — shrinkage prior, capped at 40%
   - `posterior = priorWeight × historicalMean + (1 - priorWeight) × currentConfidence`

The cap at 0.4 ensures current-session behavior always dominates (≥60%), preventing stale history from overriding genuine improvement.

#### 4.3 Integration

**File:** `lib/services/drillReviewService.ts`

After `deriveContinuousRating` but before `confidenceStabilityMultiplier`:

```typescript
const reviewHistory = existingProgress?.reviewHistory as ReviewSnapshot[] ?? [];
const accumulated = accumulateConfidence(implicitConfidence, reviewHistory);
const adjustedConfidence = accumulated.posterior * fluencyIllusionDampener(elapsedDays);
// Log for transparency
server_computed.confidence_accumulated = accumulated.posterior;
server_computed.confidence_prior_weight = accumulated.priorWeight;
```

#### 4.4 Tests

**File:** `tests/bayesian-accumulator.test.ts`

- Single review (no history) → returns currentConfidence unchanged
- 2 reviews (below threshold) → returns currentConfidence unchanged
- 5 consistent high-confidence reviews → posterior slightly above current (smoothing)
- 5 consistent low-confidence reviews → posterior slightly below current (strengthening signal)
- 1 anomalous review after 5 consistent ones → posterior barely moves (outlier resistance)
- Decay factor: oldest review contributes less than newest
- Telemetry quality weighting: 'full' reviews count more than 'minimal'
- priorWeight never exceeds 0.4
- Empty history → returns currentConfidence

### Files Modified/Created
| File | Change |
|------|--------|
| `lib/confidence/bayesianAccumulator.ts` | **New** — AccumulatedConfidence, accumulateConfidence() |
| `lib/services/drillReviewService.ts` | Fetch review history, call accumulator, log to telemetry |
| `tests/bayesian-accumulator.test.ts` | **New** (~18 tests) |

---

## Sprint 5: Optimizer Telemetry Quality Weighting

### Problem
The FSRS optimizer sidecar (`gcp-fsrs-optimizer/main.py`) fits personalized w[] parameters from ReviewLog data. Currently all reviews are weighted equally during fitting. But a review with `telemetry_quality: 'full'` (first-click timing + switches + CRPL micro-kinetics) has much more behavioral signal than one with `telemetry_quality: 'minimal'` (only duration). The grade derived from full telemetry is more trustworthy and should influence the optimizer more.

### Research Basis
- **Weighted maximum likelihood estimation** — Standard statistical technique. Observations with higher measurement precision should receive proportionally more weight.
- **Measurement reliability** — In psychometrics, item discrimination parameters are improved by weighting responses by their reliability (Lord & Novick, 1968).

### Design

#### 5.1 Pass quality weights to optimizer

**File:** `gcp-fsrs-optimizer/main.py`

The fsrs-optimizer Python library supports sample weights via `optimizer.fit(reviews, weights=...)`.

**Change the input format** to include per-review weights:

```python
# Current
reviews = [
    {"card_id": ..., "review_time": ..., "review_rating": ..., "review_state": ..., "review_duration": ...},
    ...
]

# New: add weight field
reviews = [
    {"card_id": ..., "review_time": ..., "review_rating": ..., "review_state": ...,
     "review_duration": ..., "weight": 1.0},  # full telemetry
    {"card_id": ..., ..., "weight": 0.6},      # partial telemetry
    {"card_id": ..., ..., "weight": 0.3},      # minimal telemetry
]
```

**Weight mapping:**

```python
QUALITY_WEIGHTS = {
    "full": 1.0,
    "partial": 0.6,
    "minimal": 0.3,
}
```

#### 5.2 Also weight by calibration score

If Sprint 2 calibration data is available, further modulate weight:

```python
# Well-calibrated user's reviews are more trustworthy signal
calibration_weight = max(0.5, 1.0 - brier_score)
final_weight = quality_weight * calibration_weight
```

#### 5.3 Extract quality tag from ReviewLog

**File:** `gcp-fsrs-optimizer/main.py`

The `telemetry_quality` tag is already stored in `ReviewLog.telemetry.server_computed.telemetry_quality`. Update the review extraction query:

```python
# Extract from ReviewLog telemetry JSON
quality = review.get("telemetry", {}).get("server_computed", {}).get("telemetry_quality", "minimal")
weight = QUALITY_WEIGHTS.get(quality, 0.3)
```

#### 5.4 Tests

- Unit test in Python: verify weight mapping for all 3 quality tiers
- Integration test: optimizer with mixed-quality reviews produces different weights than uniform
- Edge case: all reviews 'minimal' → still runs, just uniform weighting
- Verify optimizer accepts the weight parameter (may need to check fsrs-optimizer library version)

### Files Modified
| File | Change |
|------|--------|
| `gcp-fsrs-optimizer/main.py` | Extract telemetry_quality, compute weights, pass to optimizer.fit() |
| `gcp-fsrs-optimizer/requirements.txt` | Verify fsrs-optimizer version supports weights (may need update) |

---

## Sprint 6: Calibration Validation Pipeline

### Problem
We've built a sophisticated confidence model but have no way to verify it's actually working. Is the graduated stability multiplier helping retention? Do normalized signals outperform absolute ones? We need offline validation that can run periodically.

### Research Basis
- **Cross-validation** — Standard ML evaluation technique. Hold out recent reviews and test prediction accuracy on them.
- **Calibration plots** — Visual validation of predicted probability vs. observed frequency.

### Design

#### 6.1 Offline validation script

**New file:** `scripts/validate-confidence-pipeline.ts`

```typescript
interface ValidationResult {
  // Calibration metrics
  brierScoreOverall: number;
  brierScoreByTier: Record<string, number>;
  calibrationBuckets: CalibrationBucket[];

  // A/B comparison
  stabilityCorrelation: number;   // Correlation between confidence-adjusted stability and actual retention
  baselineComparison: {
    withConfidence: { brierScore: number; meanAbsError: number };
    withoutConfidence: { brierScore: number; meanAbsError: number };
    improvement: number;          // % improvement from confidence model
  };

  // Per-feature contribution
  featureImportance: Record<string, number>; // Ablation: drop each signal, measure degradation

  // Normalization impact
  normalizedVsAbsolute: {
    normalizedBrier: number;
    absoluteBrier: number;
    improvement: number;
  };
}
```

**Logic:**
1. Pull all ReviewLog pairs (review_i → review_i+1 for same conditionId) from last 90 days
2. For each pair: recompute confidence using the current model, compare predicted retention to actual
3. Compute Brier scores, calibration curves, feature ablation
4. Output as JSON + optional HTML report

#### 6.2 Scheduled execution

Run weekly via `scripts/` or as a GitHub Action. Output to `docs/validation/` for tracking over time.

#### 6.3 Dashboard visualization (optional)

If time permits: an HTML dashboard showing calibration curves, per-signal contribution, and trend over time. Could use the `data:build-dashboard` skill for this.

#### 6.4 Tests

**File:** `tests/validation-pipeline.test.ts`

- Mock ReviewLog pairs → correct Brier score computation
- Ablation: removing a signal changes the score
- Empty dataset → graceful handling
- Calibration bucket computation matches manual calculation

### Files Created
| File | Change |
|------|--------|
| `scripts/validate-confidence-pipeline.ts` | **New** — Full validation pipeline |
| `tests/validation-pipeline.test.ts` | **New** (~10 tests) |
| `docs/validation/` | **New directory** — Output for validation runs |

---

## Dependency Graph

```
Sprint 1: Per-Student Baseline Normalization
    ↓
    ├── Sprint 2: Metacognitive Calibration ──┐
    │       ↓                                 │
    ├── Sprint 3: Question-Type Weights       │
    │       ↓                                 │
    └── Sprint 4: Bayesian Accumulation       │
                ↓                             ↓
        Sprint 5: Optimizer Quality Weighting
                ↓
        Sprint 6: Calibration Validation Pipeline
```

Sprints 2 and 3 can run in parallel after Sprint 1 completes.
Sprint 4 can start once Sprint 1 is done (Sprints 2–3 are nice-to-have for it, not blockers).
Sprint 5 benefits from Sprints 1–2 but could start as early as after Sprint 1.
Sprint 6 should come last since it validates everything.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Per-user queries add latency to submissions | High | Cache aggressively in UserStatistics; refresh async, not inline |
| Bayesian prior makes confidence sticky, masking improvement | Medium | Cap prior weight at 0.4; decay factor ensures recent reviews dominate |
| Question-type weights are speculative without real data | Medium | Start with literature-informed weights; Sprint 6 validates; easy to tune |
| Optimizer library may not support sample weights natively | Medium | Check fsrs-optimizer docs in Sprint 5; worst case, pre-filter by quality tier |
| Cold-start: new users have no baseline | Low | All features gracefully fall back to current behavior when data is insufficient |

---

## Success Criteria

After all 6 sprints, run the Sprint 6 validation pipeline. Success means:
1. **Calibration improvement:** Brier score improves ≥10% vs. the current absolute-threshold model
2. **Normalization impact:** Per-user normalized confidence has lower prediction error than absolute
3. **Retention prediction:** Confidence-adjusted stability correlates with actual retention (r > 0.3)
4. **No regressions:** All existing 57 tests still pass; drillReviewService latency p95 stays < 200ms
5. **Test coverage:** ≥75 new tests across all sprint test files
