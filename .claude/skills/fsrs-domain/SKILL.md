---
name: fsrs-domain
description: >
  FSRS v6 spaced repetition domain expertise for PANaCEa's scheduling system.
  Use this skill whenever working on anything related to FSRS, spaced repetition,
  scheduling intervals, retrievability, stability, difficulty, w-parameters,
  rating systems, Ghost Grader, behavioral biometrics, par time, or continuous
  grades. Also use when the user mentions "SRS", "review scheduling", "forgetting
  curve", "retention", "recall prediction", or any memory/learning science concept
  that feeds into the scheduler. This prevents mathematical errors in scheduling
  logic and ensures the binary rating system is respected.
---

# FSRS v6 Domain Expert

## Why this exists

PANaCEa uses a heavily customized FSRS v6 implementation with a binary rating
system (Again/Good only — no Hard/Easy from the student). Many FSRS resources
online assume 4 ratings. Getting this wrong means broken scheduling. This skill
encodes PANaCEa's specific FSRS conventions so you don't have to rediscover them.

## Binary rating system

PANaCEa presents students with only two choices:
- **Again (1)**: "I didn't know this" — resets to short interval
- **Good (3)**: "I knew this" — normal SRS progression

Hard (2) and Easy (4) are never shown to the student but ARE used internally:
- Ghost Grader can downgrade Good → Again when behavioral signals indicate guessing
- Ghost Grader can boost grade_continuous when signals indicate confident mastery
- The FSRS engine still accepts all 4 ratings internally

## Key FSRS concepts

### Retrievability (R)
Probability of recall at review time. Computed from stability and elapsed days:
```
R = (1 + elapsedDays / (9 * stability))^(-1)
```
Stored in ReviewLog.retrievability. This is what calibration services compare
against actual outcomes.

### Stability (S)
How many days until R drops to 90%. Higher = longer intervals. Modified by:
- Rating (Again resets, Good increases)
- Difficulty
- Calibration correction factor (from retrievabilityCalibrationService)
- Optimized w-parameters (from fsrsOptimizerService)

### Difficulty (D)
0-10 scale. Higher = harder card. Adjusted each review based on rating.
Mean reversion pulls toward 5.0 over time (controlled by w[7]).

### The 21 w-parameters
FSRS v6 has 21 parameters (w[0]–w[20]) controlling all scheduling behavior:
- w[0-3]: Initial stability per rating (Again/Hard/Good/Easy)
- w[4-7]: Difficulty computation
- w[8-10]: Recall stability growth
- w[11-14]: Forget stability
- w[15-16]: Hard penalty / Easy bonus (deprecated in binary system — skip)
- w[17-18]: Short-term stability (sensitive — skip optimization)
- w[19-20]: Retrievability curve modifiers

**Safe to optimize**: indices [0-14, 19, 20]
**Do NOT touch**: indices [15-18]

## Continuous grade system

PANaCEa extends FSRS's discrete ratings with a continuous grade (1.0–4.0):
- `deriveContinuousRating()` in `lib/implicit-metrics.ts` produces `{ grade, confidence, discreteRating }`
- `grade` is a float (e.g., 2.7) based on response time, behavioral signals
- `confidence` weights how much to trust the continuous vs discrete grade
- Stored in ReviewLog.grade_continuous

The continuous grade feeds into the FSRS optimizer for personalized parameters.

## Ghost Grader pipeline

Ghost Grader (`lib/srs/ghostGrader.ts`) runs AFTER deriveContinuousRating:

```
Student answers → deriveContinuousRating() → applyHonestRatingWithDetail()
```

It's bidirectional (v2):
- **Downgrade path**: Indecision signals (oscillations, drift, tremor) → Again
- **Boost path**: All signals clean + fast latency → +0.25 grade_continuous
- **Elimination velocity**: Fast distractor elimination → +0.15, absent → -0.10
- **Z-score normalization**: When per-user baseline exists, signals fire at z > 2.0
  above the user's personal median, not absolute thresholds

## Par time pipeline

Response time is compared to "par time" — the expected time for a question:

```
calculateParTime(questionComplexity)
  → applyFatigueCorrection(parTime, sessionPosition)
  → applyCircadianParTimeModifier(parTime, circadianPhase)
  = final par time
```

`latencyRatio = actualResponseTime / parTime` — values < 1.0 mean faster than par.

## Calibration system

Two independent calibration systems:
1. **JOL Calibration** (metacognitive): Student predicts confidence → compared to outcome
   - `services/analytics/calibrationService.ts`, `CalibrationPanel.tsx`
2. **Retrievability Calibration** (FSRS): Predicted R vs actual recall rate
   - `retrievabilityCalibrationService.ts`, `CalibrationInsightsDashboard.tsx`
   - Produces stability correction factors (0.7–1.4 range)
   - Rolling-window drift detection (last 200 vs last 50 reviews)

## Circadian phases

Four phases affect scheduling and par time:
- Morning (06–12): High cortisol, strong encoding
- Afternoon (12–17): Post-lunch dip
- Evening (17–22): Second wind
- Night (22–06): Fatigue

The circadian-aware optimizer trains separate FSRS parameters per phase.

## Common pitfalls

- Rating enum values: Again=1, Hard=2, Good=3, Easy=4. NOT 0-indexed.
- Never show Hard/Easy to the student — only Again/Good in the UI
- grade_continuous is 1.0–4.0, not 0.0–1.0
- retrievability is 0.0–1.0 (probability)
- stability is in DAYS, not hours or seconds
- Log-loss uses natural log, not log2
- Coordinate descent step size should scale with parameter magnitude
