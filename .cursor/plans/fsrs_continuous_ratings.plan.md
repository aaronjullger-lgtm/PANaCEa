---
name: ""
overview: ""
todos: []
isProject: false
---

# FSRS Optimization with Continuous Ratings

## Overview

Transition from discrete 1-4 FSRS ratings to continuous grades (e.g., 3.2 vs 3.0), allowing more granular scheduling. "Standard Correct" with no red flags equals 3.0; deviations toward 4.0 or 1.0 are driven by behavioral metrics. Commitment Gap and Cursor Entropy (from the Micro-Kinetics plan) refine implicit_confidence, which directly influences the stability modifier.

---

## Current State

**Rating derivation:**

- [lib/implicit-metrics.ts](lib/implicit-metrics.ts) – `deriveImplicitRating()` outputs discrete `Rating` (1-4) from latency ratio, answer switches, trajectory
- [lib/services/drillReviewService.ts](lib/services/drillReviewService.ts) – Uses deriveImplicitRating, maps to quality 1-5, calls FSRS with integer rating
- [functions/api/srs/submit.ts](functions/api/srs/submit.ts) – Optional Ghost Grader (analyzeBehaviorGemini) returns impliedRating (rounded to int)

**Telemetry flow:**

- Session writes `par_time_ms`, `latency_ratio`, `answer_changes` to `ReviewLog.telemetry` and `QuestionAttempt.telemetryJson`
- `server_computed` includes `implicit_confidence`, `implicit_rating`
- Stability modifier: `applyCircadianModifier` in drillReviewService; `implicitDifficulty` in srs/submit influences stability when > 0.5

**FSRS integration:**

- [lib/fsrs.ts](lib/fsrs.ts) – `next(card, now, rating: Rating)` uses rating in formulas: `rating - 3`, `rating - 1`, and discrete branches (`rating === Rating.Hard`, `rating === Rating.Easy`)
- Formulas are arithmetic; continuous grades would work if discrete branches are interpolated

---

## Target Design

### Normalization (Centered at 3.0)

- **Baseline:** A "Standard Correct" answer with no behavioral red flags = 3.0.
- **Deviations:**
  - Toward 4.0: Fast, stable, no switches, low commitment gap, low entropy
  - Toward 1.0: Incorrect, or correct but high hesitation, many switches, high commitment gap, high entropy

### Continuous Grade Formula (Proposed)

```
base = isCorrect ? 3.0 : 1.0

// Red-flag penalties (subtract from base when correct)
penalty_switch = answerSwitches * 0.15        // Each switch ≈ -0.15
penalty_latency = clamp((latency_ratio - 0.85), 0, 2) * 0.3
penalty_commitment = commitment_gap_sec * 0.02  // e.g., 5s gap = -0.1
penalty_entropy = (cursor_entropy - 1) * 0.2   // entropy > 1 = meandering
penalty_oscillation = hover_oscillation * 0.1

// Bonuses (add when correct, fast and clean)
bonus_fast = latency_ratio < 0.5 ? 0.3 : (latency_ratio < 0.7 ? 0.15 : 0)

continuous_grade = clamp(base - penalties + bonus, 1.0, 4.0)
```

---

## Implementation Plan

### Phase 1: deriveContinuousRating

**1.1 New function in lib/implicit-metrics.ts**

- Add `deriveContinuousRating(metrics, config): { grade: number; confidence: number }`
- Input: Extended `ImplicitBehaviorMetrics` with optional `commitmentGapMs`, `cursorEntropy`, `hoverOscillationCount`
- Output: Float grade in [1.0, 4.0], confidence in [0, 1]
- Normalization: Standard correct (latency_ratio ~0.85, 0 switches, no gap) = 3.0

**1.2 Backward compatibility**

- Keep `deriveImplicitRating` for discrete path; have it call `deriveContinuousRating` and round, or keep both.
- Callers can opt into continuous by using `deriveContinuousRating` and passing `grade` to FSRS.

### Phase 2: FSRS Support for Continuous Grades

**2.1 lib/fsrs.ts modifications**

- Add overload or new path: `next(card, now, rating: number)` where rating is float.
- In `init_ds`: Interpolate `w[rating-1]` when rating is non-integer (e.g., linear interp between floor and ceil).
- In `next_recall_stability`: Interpolate `hard_penalty` and `easy_bonus`:
  - `hard_penalty`: 1 when rating >= 3, w15 when rating <= 2, interpolate for 2 < rating < 3
  - `easy_bonus`: 1 when rating <= 3, w16 when rating >= 4, interpolate for 3 < rating < 4
- In `next()`: For Learning state interval, map float to nearest or interpolate (Again < 2, Hard < 3, Good < 4, Easy >= 4).
- All arithmetic (`rating - 3`, `rating - 1`) already works with float.

**2.2 Alternative: Stability modifier instead of FSRS change**

- Keep FSRS receiving discrete rating (e.g., round continuous to nearest).
- Compute `stabilityModifier = f(continuous_grade)` such that grade 2.8 gives lower S growth than 3.0.
- After `fsrs.next()`, multiply `card.stability` by modifier.
- Simpler, no FSRS core changes; modifier formula can be tuned.

### Phase 3: Telemetry Pipeline Integration

**3.1 Extend telemetry with new metrics**

- From Micro-Kinetics plan: `commitment_gap_ms`, `cursor_entropy` (and optionally `hover_oscillation_count`).
- Ensure these are captured and passed to `deriveContinuousRating` / `deriveImplicitRating`.

**3.2 drillReviewService**

- Build `ImplicitBehaviorMetrics` including `commitmentGapMs`, `cursorEntropy` from telemetry.
- Call `deriveContinuousRating` instead of (or in addition to) `deriveImplicitRating`.
- Pass continuous `grade` to `fsrs.next()` (once FSRS supports float) or apply stability modifier.
- Write `grade_continuous` (or equivalent) to ReviewLog.telemetry for analysis and optimizer.

**3.3 ReviewLog schema**

- Option A: Migrate `grade` from `Int` to `Float` (breaking for existing code that expects 1-4).
- Option B: Add `gradeContinuous Float?`; keep `grade` as rounded int for backward compat.
- Option C: Store continuous in `telemetry.grade_continuous`; keep `grade` as int (rounded). No migration.

Recommendation: Option C for minimal risk. Optimizer can use `telemetry.grade_continuous ?? grade` when available.

### Phase 4: implicit_confidence and Stability Modifier

**4.1 Unified implicit_confidence**

- `implicit_confidence` = confidence in the derived rating (0-1). Already produced by `deriveImplicitRating` and `deriveContinuousRating`.
- Refine using Commitment Gap and Entropy:
  - High commitment gap → lower confidence (verification anxiety).
  - High cursor entropy → lower confidence (confusion/meandering).

**4.2 Stability modifier formula**

- `implicit_difficulty = 1 - implicit_confidence` (existing pattern in srs/submit).
- When `implicit_difficulty > 0.5`, reduce stability: `stability *= (1 - implicit_difficulty)` or similar.
- Ensure drillReviewService applies this modifier (it already uses `applyCircadianModifier`; add `applyImplicitConfidenceModifier`).

**4.3 Flow**

```
telemetry (par_time, latency_ratio, answer_changes, commitment_gap_ms, cursor_entropy)
    → deriveContinuousRating()
    → { grade: 2.8, confidence: 0.72 }
    → FSRS.next(card, now, 2.8)  OR  FSRS.next(card, now, 3) + stabilityModifier(2.8)
    → stability *= applyImplicitConfidenceModifier(confidence)
    → write ReviewLog(grade: round(2.8), telemetry: { grade_continuous: 2.8, implicit_confidence: 0.72, ... })
```

### Phase 5: Optimizer Compatibility

**5.1 fsrs-optimizer**

- `convertReviewLogRows` and `OptimizationReview` use `rating` (1-4). For optimization, continuous grades can be rounded or passed through if the optimizer supports float.
- L-BFGS / Brier score: Standard FSRS optimization typically uses discrete outcomes. Verify whether the optimizer expects integer ratings; if so, rounding is fine for the optimization input.
- Store raw continuous in telemetry for future optimizer upgrades.

---

## Files to Modify


| File                                             | Changes                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `lib/implicit-metrics.ts`                        | Add deriveContinuousRating; extend ImplicitBehaviorMetrics with commitmentGapMs, cursorEntropy                             |
| `lib/fsrs.ts`                                    | Support float rating: interpolate init_ds, next_recall_stability; or add applyStabilityModifierFromGrade                   |
| `lib/services/drillReviewService.ts`             | Use deriveContinuousRating; pass continuous grade; apply implicit confidence modifier; write grade_continuous to telemetry |
| `functions/api/srs/submit.ts`                    | Accept float rating in schema (or keep int, derive float from telemetry); apply implicit modifier                          |
| `functions/api/_shared/analyzeBehaviorGemini.ts` | Return impliedRating as float (remove Math.round) when continuous path is enabled                                          |
| `types/telemetry.ts`                             | Add commitment_gap_ms, cursor_entropy, grade_continuous to relevant interfaces                                             |


---

## Dependencies

- **Micro-Kinetics plan (III):** Commitment Gap and Cursor Entropy must be captured and present in telemetry before they can refine implicit_confidence. Phase 1 of this plan can proceed with latency_ratio and answer_changes only; Phases 3–4 integrate the new metrics when available.

---

## Summary


| Deliverable            | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| deriveContinuousRating | Output float grade 1–4 with 3.0 as standard correct baseline                      |
| FSRS float support     | Interpolate discrete branches or apply post-hoc stability modifier                |
| Telemetry extension    | commitment_gap_ms, cursor_entropy → refine implicit_confidence                    |
| Stability modifier     | implicit_confidence influences S via implicit_difficulty                          |
| ReviewLog.telemetry    | grade_continuous, par_time_ms, latency_ratio, answer_changes, implicit_confidence |


