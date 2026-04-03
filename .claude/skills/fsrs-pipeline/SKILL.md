---
name: fsrs-pipeline
description: "FSRS v6 spaced repetition algorithm, implicit behavioral metrics, confidence scoring pipeline, and telemetry quality system. Use this skill whenever working on spaced repetition logic, review scheduling, implicit rating derivation, confidence scoring, stability multipliers, telemetry collection, par time calculations, circadian scheduling, the FSRS optimizer, or any code that touches ReviewLog, UserProgress, QuestionAttempt, or the drillReviewService. Also trigger when the user mentions SRS, spaced repetition, review intervals, forgetting curves, retention, difficulty, stability, or retrievability. This is a complex algorithmic subsystem — always consult this skill before modifying it."
---

# FSRS Pipeline

The FSRS (Free Spaced Repetition Scheduler) v6 pipeline is PANaCEa's core differentiator. It uses behavioral signals instead of self-rated buttons to schedule reviews. Understanding the full pipeline prevents accidentally breaking the scheduling algorithm.

## Architecture

The pipeline flows through these stages, in order:

```
Client Telemetry → Correctness Resolution → Implicit Rating → Par Time →
Circadian Context → Confidence Scoring → FSRS State Update →
Persistence (QuestionAttempt + ReviewLog + UserProgress) →
Confusion Pairs → Sibling Propagation
```

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/fsrs.ts` | 639 | FSRS v6 algorithm (21 params, state machine) |
| `lib/implicit-metrics.ts` | 767 | Behavioral signal → rating derivation |
| `lib/services/drillReviewService.ts` | 803 | Main submission pipeline orchestrator |
| `lib/circadian.ts` | — | Circadian-aware scheduling adjustments |
| `lib/srs/ghostGrader.ts` | — | Gemini-powered confidence inference |
| `lib/fsrs/eorScheduler.ts` | — | End-of-rotation scheduling clamp |
| `lib/confidence/bayesianAccumulator.ts` | — | Bayesian confidence blending |
| `lib/services/calibrationService.ts` | — | Per-user metacognitive calibration |
| `functions/api/drills/submit-review.ts` | — | API endpoint for submissions |

## Binary Rating System

PANaCEa uses ONLY two FSRS ratings:
- **Again (1)** — Incorrect or very low confidence
- **Good (3)** — Correct with adequate confidence

Hard (2) and Easy (4) are **deprecated**. Any incoming Hard/Easy values are normalized to Again/Good. Do not introduce new code paths for Hard or Easy ratings.

## Implicit Rating Derivation

The `deriveContinuousRating()` function in `lib/implicit-metrics.ts` computes a continuous rating from behavioral signals. This is the heart of the "no self-rated buttons" approach.

### Input Signals

| Signal | Source | Weight | What It Measures |
|--------|--------|--------|-----------------|
| `timeToFirstClick` | Client | 0.35 (default) | Response time — fast = confident |
| `answerSwitches` | Client | 0.25 | Answer changes — more = uncertain |
| `totalDwellTime` | Client | — | Total time on question |
| `isCorrect` | Server | — | Binary correctness |
| `parTimeMs` | Server | — | Expected time for this question type |
| `hintViewed` | Client | — | Whether hint was viewed before answering |
| `hintViewDurationMs` | Client | — | How long hint was visible |

### CRPL Micro-Kinetics (Optional)

When available, these fine-grained signals improve confidence estimation:
- `commitmentGapMs` — Time between first click and final answer
- `cursorEntropy` — Mouse movement randomness (high = uncertain)
- `hoverOscillationCount` — Back-and-forth between options

### Signal Weights by Question Type

Different question types weight signals differently because the behavioral patterns differ:

| Question Type | RT Weight | Switches Weight | Trajectory Weight | Hesitation Weight |
|---------------|-----------|----------------|-------------------|-------------------|
| Vignette | 0.40 | 0.25 | 0.15 | 0.20 |
| Recall | 0.30 | 0.40 | 0.10 | 0.20 |
| Image | 0.25 | 0.20 | 0.35 | 0.20 |
| Rapid Recall | 0.50 | 0.20 | 0.10 | 0.20 |

These are in `QUESTION_TYPE_WEIGHTS` in `lib/implicit-metrics.ts`.

## Confidence Scoring Pipeline (4-Step)

The confidence pipeline transforms raw behavioral signals into a stability multiplier:

### Step 1: Multi-Signal Weighted Confidence
```
confidence = Σ(wi × si) × hintFactor
```
Bounded to [0.3, 0.95]. For incorrect answers, confidence is fixed at 0.9 (high confidence the student got it wrong → aggressive rescheduling).

### Step 2: Bayesian Accumulation
Blends current-review confidence with exponentially-decayed history of past reviews for the same card. Prior weight capped at 0.4. Quality-aware. See `lib/confidence/bayesianAccumulator.ts`.

### Step 3: Metacognitive Calibration
Per-user dampener based on Brier score analysis. Overconfident students get dampened (factor < 1.0), underconfident get boosted (factor > 1.0). Range: 0.7–1.3×. Requires ≥30 review pairs. See `lib/services/calibrationService.ts`.

### Step 4: Fluency Illusion Dampener
```
dampener = 0.7 + 0.3 × clamp(elapsedDays, 0, 1)
```
Same-day reviews get 30% confidence reduction. Reviews ≥1 day apart → no adjustment. This prevents massed-repetition fluency from inflating stability (Kornell & Bjork, 2008).

### Final: Graduated Stability Multiplier
```
stabilityMult = 0.7 + 0.6 × σ((confidence - 0.6) × 5)
```
Sigmoid curve centered at 0.6. High confidence → up to ~1.28× stability. Low confidence → down to ~0.72× stability.

## Rapid-Guess Filtering

Responses below the Minimum Valid Response Time (MVRT) are flagged and skip FSRS state updates entirely. Thresholds are question-type-specific:

| Question Type | MVRT (ms) |
|---------------|-----------|
| VIGNETTE | 3000 |
| RECALL | 1500 |
| IMAGE | 2000 |
| DEFAULT | 2000 |

Server enforces a floor of 2000ms regardless.

## Telemetry Quality

Each ReviewLog entry is tagged with telemetry quality:
- **full** — Has first-click timing + answer switches + CRPL micro-kinetics
- **partial** — Has first-click OR switches but not both
- **minimal** — Only has total duration

The FSRS optimizer (`gcp-fsrs-optimizer/main.py`) weights reviews by quality: full=100%, partial=60%, minimal=30%.

## Session Type Gating

Only these combinations produce FSRS state updates:
- `sessionType: 'main'` + `review_type: 'real'`
- `sessionType: 'drill'` + `review_type: 'real'`

These are excluded from FSRS:
- `sessionType: 'cram'` — Review-only, no scheduling impact
- `sessionType: 'rapid_recall'` — Speed drills, no scheduling impact

## Modification Checklist

Before changing any FSRS pipeline code:

1. **Identify which stage** you're modifying (telemetry → rating → confidence → FSRS update → persistence)
2. **Check downstream consumers** — changes to rating derivation affect confidence scoring, which affects stability multipliers, which affect scheduling
3. **Preserve the binary rating constraint** — output must be Again(1) or Good(3)
4. **Run the test suite**: `npm test -- --grep "fsrs\|implicit\|confidence\|drill-review"` (134+ tests across 6 files)
5. **Verify telemetry quality tagging** — if adding new signals, update `assessTelemetryQuality()` in `lib/implicit-metrics.ts`
6. **Check optimizer compatibility** — if changing ReviewLog fields, update `gcp-fsrs-optimizer/main.py` to handle the new schema

## Key Exports

From `lib/implicit-metrics.ts`:
- `deriveContinuousRating()` — Main rating derivation
- `confidenceStabilityMultiplier()` — Sigmoid stability modifier
- `fluencyIllusionDampener()` — Same-day review penalty
- `assessTelemetryQuality()` — Quality tier classification
- `QUESTION_TYPE_WEIGHTS` — Per-type signal weight profiles
- `UserBaseline` — Interface for per-student normalization

From `lib/fsrs.ts`:
- `FSRS` class — The algorithm implementation
- `FSRSState` enum — New, Learning, Review, Relearning
- `Rating` enum — Again, Hard, Good, Easy (with normalization)
- `normalizeRating()` — Hard→Again, Easy→Good
- `computeDecayFactor()` — Memory decay calculation
