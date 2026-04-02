# Confidence Scoring Upgrade — Research-Backed Behavioral Analytics for FSRS

**Date:** 2026-04-02
**Author:** Staff Data Engineer / Learning Science Architect
**Status:** IMPLEMENTATION IN PROGRESS

---

## Problem Statement

The current confidence model in PANaCEa (`deriveContinuousRating()`) has three critical limitations:

1. **No positive feedback path**: High confidence (0.95) gives zero scheduling benefit. Only the floor case (≤0.5) applies a penalty (-25% stability). Students who demonstrate strong automatic retrieval are treated identically to those who answer correctly but slowly with hesitation.

2. **Simplistic calculation**: Only 3 discrete binary penalties (answer switches ≥1, commitment gap >3s, cursor entropy >1.5) subtracted from a fixed base of 0.7. This ignores the rich continuous signals available from response time, trajectory, and dual-process classification.

3. **No review-context adjustment**: Confidence doesn't account for review interval — a correct answer 12 hours after last seeing the card (massing) should be valued less than the same answer 7 days later (genuine spaced retrieval). This is the "fluency illusion" (Kornell & Bjork, 2008).

## Research Basis

| Finding | Source | Application |
|---------|--------|-------------|
| Faster retrieval predicts long-term retention (2.6s advantage) | Benjamin et al., 1998; PMC3348658 | Weight RT signal into confidence via log-transform |
| Mouse trajectory deviation (MAD, AUC) measures response competition | Freeman & Ambady, 2010 | Use existing trajectory.confidenceScore in confidence calc |
| 71% of students misjudge massed items as well-learned | Kornell & Bjork, 2008 | Fluency illusion correction for short intervals |
| System 1 (fast correct) = strong retrieval; System 2 (slow correct) = weak | Kahneman; PMC7870645 | Dual-process classification for confidence bonus/penalty |
| SDT: confidence maps to continuous memory signal strength | Parsimonious SDT models, 2019 | Multi-signal geometric mean for robustness |
| Higher confidence responses are faster (strong RT↔confidence correlation) | PMC4263084 | Validate RT as confidence proxy |

---

## Proposed Changes

### CHANGE-A: Multi-Signal Confidence Model [HIGH PRIORITY]

**Replace** the current additive-penalty confidence calculation with a **weighted multi-signal model** inspired by Signal Detection Theory:

```
confidence = clamp(
  Σ(wi × si) × hintFactor × fluencyIllusion,
  min: 0.3,
  max: 0.95
)
```

Where signals `si` are:
- **s_rt** (weight 0.35): Response time signal via log-ratio to par time. Fast = high, slow = low.
- **s_switch** (weight 0.25): Answer stability signal. 0 switches = 1.0, each switch reduces.
- **s_trajectory** (weight 0.20): Trajectory confidence from micro-kinetics (if available).
- **s_hesitation** (weight 0.20): Composite of commitment gap, entropy, oscillations.

**New floor**: 0.3 (was 0.5). This gives the graduated stability modifier more dynamic range.

**For incorrect answers**: Confidence remains high (0.9) — we're confident the student got it wrong, so FSRS should schedule aggressively.

### CHANGE-B: Graduated Stability Modifier [HIGH PRIORITY]

**Replace** the binary threshold (`if implicitDifficulty >= 0.5, stability *= 0.75`) with a **continuous sigmoid function** that both rewards high confidence and penalizes low:

```
stabilityMultiplier = 0.7 + 0.6 × sigmoid((confidence - 0.6) × 5)
```

This produces:
- confidence 0.3 → multiplier ≈ 0.72 (28% stability reduction)
- confidence 0.5 → multiplier ≈ 0.82 (18% reduction)
- confidence 0.6 → multiplier ≈ 1.0 (neutral)
- confidence 0.7 → multiplier ≈ 1.12 (12% bonus)
- confidence 0.9 → multiplier ≈ 1.28 (28% bonus)

**Why sigmoid**: It's bounded (prevents extreme outliers), smooth (no discontinuities), and centers on 0.6 (slightly above the old base of 0.5, matching the empirical median confidence).

### CHANGE-C: Fluency Illusion Correction [MEDIUM PRIORITY]

**Rationale**: Kornell & Bjork (2008) showed 71% of students overestimate retention on massed items. A correct answer 12 hours after last review feels fluent but doesn't predict long-term retention.

**Implementation**: When `elapsedDays < 1.0` (less than 24 hours since last review), apply a dampening factor to confidence:

```
fluencyDampener = 0.7 + 0.3 × min(elapsedDays / 1.0, 1.0)
```

- 0 elapsed days → 0.7 (30% confidence reduction)
- 0.5 elapsed days → 0.85 (15% reduction)
- 1.0+ elapsed days → 1.0 (no adjustment)

This only fires for very short intervals and corrects the illusion of knowing.

---

## What We Are NOT Changing

1. **FSRS core equations** — `FSRS.next()` math untouched
2. **Grade derivation** — `deriveContinuousRating()` grade calculation unchanged (only confidence refactored)
3. **Ghost Grader** — Still operates on grade, not confidence
4. **Optimizer format** — Still consumes grade/state/stability, not confidence
5. **Binary rating model** — Again(1)/Good(3) effective output unchanged

---

## Implementation Order

| Step | Change | File | Risk |
|------|--------|------|------|
| 1 | Multi-signal confidence (CHANGE-A) | `lib/implicit-metrics.ts` | Medium — changes confidence values for all students |
| 2 | Graduated stability modifier (CHANGE-B) | `lib/services/drillReviewService.ts` | Medium — changes stability for all FSRS updates |
| 3 | Fluency illusion correction (CHANGE-C) | `lib/services/drillReviewService.ts` | Low — only affects short-interval reviews |
| 4 | Unit tests | `tests/confidence-scoring.test.ts` | None |

---

## Test Plan

1. **Multi-signal confidence**: Fast correct (RT < 35% par) → confidence > 0.8
2. **Multi-signal confidence**: Slow correct with switches → confidence < 0.5
3. **Multi-signal confidence**: Incorrect answer → confidence ≈ 0.9
4. **Graduated modifier**: confidence 0.3 → stability multiplier < 0.75
5. **Graduated modifier**: confidence 0.9 → stability multiplier > 1.2
6. **Graduated modifier**: confidence 0.6 → stability multiplier ≈ 1.0 (neutral)
7. **Fluency illusion**: elapsedDays 0 → dampener ≈ 0.7
8. **Fluency illusion**: elapsedDays 1+ → dampener = 1.0
9. **Backwards compatibility**: Existing test cases still pass with new confidence model
