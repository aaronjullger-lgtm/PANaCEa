---
name: "panacea-fsrs-guardrails"
description: "Use this skill whenever a PANaCEa task touches FSRS, SRS, spaced repetition, review scheduling, retrievability, stability, difficulty, implicit ratings, behavioral telemetry, MVRT rapid-guess filtering, par time, Ghost Grader, review submission, UserProgress, ReviewLog, or QuestionAttempt."
---

# PANaCEa FSRS Guardrails

PANaCEa uses FSRS v6 math with a fully implicit, binary student experience. Load this before changing any scheduling or review submission code.

## First Files

- `CLAUDE.md` for repo-level invariants
- `lib/fsrs.ts` for canonical scheduler math, params, rating normalization, and v6/v7-alpha notes
- `lib/implicit-metrics.ts` for behavioral rating derivation
- `types/telemetry.ts` for MVRT thresholds and telemetry payloads
- `lib/services/drillReviewService.ts` for the canonical write pipeline
- `functions/api/drills/submit-review.ts` for canonical review submission
- `functions/api/srs/submit.ts` for the legacy compatibility adapter
- `functions/api/questions/attempt.ts` for attempt-only writes; it is not the FSRS writer

## Current Truths

- Student-facing review is binary and implicit. Do not add self-rated Hard/Easy controls.
- Internal `Rating` still has FSRS values: `Again=1`, `Hard=2`, `Good=3`, `Easy=4`.
- `normalizeRating()` maps `Hard -> Again` and `Easy -> Good`.
- `gradeContinuous`/`grade_continuous` is a telemetry/confidence signal in the `1.0..4.0` range; the actual `fsrs.next()` call uses the binary discrete rating.
- `retrievability` is `0.0..1.0`; `stability` is in days; `difficulty` is FSRS difficulty, not UI difficulty.
- `functions/api/drills/submit-review.ts` and `functions/api/srs/submit.ts` both delegate to `submitDrillReview()`.
- `functions/api/questions/attempt.ts` records attempt/seen/stat data only and explicitly avoids FSRS/Rolling360 writes.

## FSRS Eligibility

In the current pipeline, `main`, `drill`, `targeted`, and missing `sessionType` are FSRS-eligible unless another gate skips scheduling. `cram` and `rapid_recall` are not FSRS-eligible.

Scheduling can also be skipped for rapid guesses, missing condition/card identity, and compatibility paths that cannot resolve a valid submitted answer. Rapid guesses still create audit/review records with `review_type: 'rapid_guess'`.

## Change Boundaries

- Ask before changing FSRS parameters, optimizer behavior, rating logic, MVRT thresholds, or eligibility gates.
- Debug Ghost Grader, grade modulation, par time, and telemetry inputs before changing FSRS math.
- Add tests around pure logic and the writer boundary before touching live submission flow.
- Preserve idempotency and single-writer behavior; duplicate answer paths easily double-count progress.

## Targeted Tests

- `tests/fsrs.test.ts`
- `tests/fsrs-scale-guard.test.ts`
- `tests/fsrsSingleWriter.test.ts`
- `tests/drillReviewService.test.ts`
- `functions/api/drills/submit-review.test.ts`
- `functions/api/srs/submit.test.ts`
- `functions/api/questions/attempt.test.ts`
- `tests/retrievability*.test.ts`

## Common Failure Modes

- Treating `/api/questions/attempt` as the FSRS writer
- Feeding `gradeContinuous` directly into FSRS scheduling
- Letting cram or rapid recall update `UserProgress.fsrsCard`
- Ignoring MVRT/rapid-guess behavior when testing fast submissions
- Adding UI labels that imply the student controls FSRS difficulty
