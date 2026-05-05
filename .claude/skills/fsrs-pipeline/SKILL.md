---
name: fsrs-pipeline
description: "PANaCEa FSRS submission pipeline: implicit metrics, telemetry quality, MVRT rapid-guess filtering, Ghost Grader, confidence modifiers, FSRS scheduling, ReviewLog/UserProgress/QuestionAttempt writes, optimizer, and calibration. Use before modifying SRS/review behavior."
---

# FSRS Pipeline

The canonical writer is `lib/services/drillReviewService.ts`. `/api/drills/submit-review` and `/api/srs/submit` delegate there. `/api/questions/attempt` is not the FSRS writer.

## Flow

Client telemetry -> correctness resolution -> implicit continuous grade -> Ghost Grader/behavior modulation -> MVRT gate -> confidence pipeline -> FSRS v6 update -> QuestionAttempt/ReviewLog/UserProgress/stat writes -> sibling/confusion/analytics side effects.

## Key Files

- `lib/fsrs.ts`: canonical FSRS v6 math, params, rating normalization, v7-alpha selection notes.
- `lib/implicit-metrics.ts`: behavioral grade/confidence derivation and telemetry quality.
- `types/telemetry.ts`: MVRT thresholds and telemetry schema.
- `lib/services/drillReviewService.ts`: pipeline orchestration and writes.
- `functions/api/drills/submit-review.ts`: canonical submission endpoint.
- `functions/api/srs/submit.ts`: compatibility adapter.
- `functions/api/questions/attempt.ts`: attempt-only endpoint.
- `lib/srs/ghostGrader.ts`: behavioral override.
- `lib/confidence/*`: confidence modifiers.
- `lib/services/*Calibration*`, `lib/scheduling/*`: calibration and shadow logging.

## Invariants

- Student-facing rating is implicit/binary.
- Internal `Rating` values: `Again=1`, `Hard=2`, `Good=3`, `Easy=4`.
- Hard/Easy are deprecated at the UX level and normalized by scheduler code.
- `grade_continuous` is `1.0..4.0`.
- `retrievability` is `0.0..1.0`; `stability` is days.
- `main`, `drill`, `targeted`, and missing `sessionType` are FSRS-eligible.
- `cram` and `rapid_recall` skip FSRS.
- Rapid guesses create audit/review records but skip schedule mutation.

## Confidence Pipeline

The code comments in `drillReviewService.ts` are authoritative. Current stages include Bayesian accumulation, metacognitive calibration, fatigue, interference, session accuracy slope, session regularity, fluency illusion, stability multiplier, RT trajectory, interval deviation, explanation engagement, relearning speed, desirable difficulty, trend detection, difficulty modulation, Ghost Grader, shadow calibration, Wilson mastery, hypercorrection, and confusion recurrence.

If a doc and the code disagree, update the doc after reading the code.

## Change Checklist

1. Identify the exact stage being changed.
2. Confirm whether the change affects scheduling, analytics-only signals, or persisted audit data.
3. Preserve binary scheduler input and idempotent single-writer behavior.
4. Add targeted tests before broad rewrites.
5. Run the relevant FSRS/API tests and `npm run test:critical` for broad behavior changes.

## Targeted Tests

- `tests/fsrs.test.ts`
- `tests/fsrs-scale-guard.test.ts`
- `tests/fsrsSingleWriter.test.ts`
- `tests/drillReviewService.test.ts`
- `functions/api/drills/submit-review.test.ts`
- `functions/api/srs/submit.test.ts`
- `functions/api/questions/attempt.test.ts`
- `tests/retrievability*.test.ts`
