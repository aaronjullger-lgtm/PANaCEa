---
name: fsrs-domain
description: "FSRS v6/v7-alpha domain guidance for PANaCEa scheduling. Use for spaced repetition, retrievability, stability, difficulty, w-parameters, binary implicit ratings, Ghost Grader, par time, MVRT, continuous grade, and optimizer/calibration work."
---

# FSRS Domain

PANaCEa uses stock FSRS v6 scheduler math with repo-specific implicit inputs and confidence modifiers. Do not rely on generic four-button FSRS assumptions.

## Current Math

- Canonical implementation: `lib/fsrs.ts`.
- Current production default: FSRS v6 with 21 params.
- v7-alpha exists in `lib/fsrs-v7.ts`; treat it as experimental unless the task explicitly targets it.
- Retrievability formula is the v6 curve from `lib/fsrs.ts`:

```text
R(t,S) = (1 + w[19] * t / S)^(-w[20])
```

Do not use old FSRS-4/5 constants such as `9` and `1` for `w[19]`/`w[20]`.

## Rating System

- Student-facing rating is implicit/binary only.
- Internal enum values remain `Again=1`, `Hard=2`, `Good=3`, `Easy=4`.
- `normalizeRating()` maps `Hard -> Again` and `Easy -> Good`.
- `gradeContinuous`/`grade_continuous` is `1.0..4.0` and informs calibration/analysis; the scheduler call uses binary discrete rating.

## Concepts

- `retrievability`: probability `0.0..1.0`.
- `stability`: days.
- `difficulty`: FSRS difficulty scale, not UI difficulty.
- `ReviewLog.grade_continuous`: behavioral confidence grade.
- `ReviewLog.review_type`: `real` vs `rapid_guess` and other audit distinctions.

## Pipeline Files

- `lib/implicit-metrics.ts`: derives continuous grade/confidence/discrete rating from behavior.
- `types/telemetry.ts`: MVRT thresholds and telemetry shape.
- `lib/srs/ghostGrader.ts`: can force Again or adjust continuous grade from behavior.
- `lib/services/drillReviewService.ts`: confidence pipeline, FSRS update, ReviewLog/UserProgress writes.
- `lib/services/fsrsOptimizerService.ts`: per-user parameter optimization.
- `lib/services/retrievabilityCalibrationService.ts`: predicted-vs-actual calibration.
- `lib/scheduling/calibrationLogger.ts`: shadow calibration logging.

## Gating

`main`, `drill`, `targeted`, and omitted `sessionType` are FSRS-eligible. `cram` and `rapid_recall` are not. Rapid guesses are recorded but skip schedule mutation.

## Pitfalls

- Never expose Hard/Easy controls.
- Never feed `gradeContinuous` directly into `fsrs.next()`.
- Never change `w[19]`/`w[20]` without scale-guard tests.
- Stability is days, not milliseconds.
- MVRT changes affect both anti-gaming and scheduler eligibility.
