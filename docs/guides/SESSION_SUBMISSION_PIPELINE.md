# Session Submission Pipeline

This guide documents the canonical answer submission path for main sessions,
drills, and due-review compatibility screens. It is intended for developers
debugging progress loss, duplicate scheduling, offline retry behavior, or FSRS
state drift.

## Source of truth

The canonical writer for real review scheduling is:

```
lib/services/drillReviewService.ts
```

All production routes that should update FSRS delegate to
`submitDrillReview()`. Do not add ReviewLog, UserProgress, Card, or sibling
propagation writes to another endpoint.

## Entry points

| Flow | Client/server entry | Network path | Scheduling behavior |
|---|---|---|---|
| Main study session | `components/session/QuizView.tsx` -> `syncManager.queueReview()` | `POST /api/drills/submit-reviews` | Delegates each item to `submitDrillReview()` |
| Drill modes | `hooks/useDrillFSRS.ts` -> SDK drills client | `POST /api/drills/submit-review` | Delegates directly to `submitDrillReview()` |
| Drill offline fallback | `useDrillFSRS` catch block -> `syncManager.queueReview()` | `POST /api/drills/submit-reviews` on retry | Uses the same batch route as main sessions |
| Legacy due-review UI | `functions/api/srs/submit.ts` | `POST /api/srs/submit` | Compatibility adapter; delegates to `submitDrillReview()` |
| Stale offline answers | `syncManager.queueAnswer()` | `POST /api/questions/attempt` | Stats-only compatibility path; no FSRS writes |

## Main session flow

```
QuizView answer
  -> syncManager.queueReview()
  -> /api/drills/submit-reviews
  -> resolveReviewQuestion()
  -> submitDrillReview()
  -> QuestionAttempt + UserQuestionSeen + stats
  -> ReviewLog + UserProgress + Card when FSRS-eligible
  -> response item returned to syncManager
```

`QuizView` intentionally does not call `queueAnswer()` for the main write path.
The old `queueAnswer()` method remains for stale offline items and writes only
to `/api/questions/attempt`.

## Request contract

The shared Zod contract lives in:

```
lib/api/schemas/drills.ts
```

Key fields:

- `questionId`: source identifier used to resolve the submitted question.
- `canonicalQuestionId`, `sourceQuestionId`, `questionSource`: identity fields
  used when a question may originate from `Question`, `PreGeneratedQuestion`,
  staging, seed, or generated sources.
- `selectedAnswer`: string or number. Callers should prefer the actual answer
  label when available.
- `timeSpentMs`, `timeToFirstClick`, `answerSwitches`, `totalDwellTime`:
  timing signals used by implicit metrics.
- `telemetry`: strict telemetry payload with MVRT, interaction, device,
  Ghost Grader, and optional study-plan context.
- `sessionType`: `main`, `drill`, `targeted`, `cram`, or `rapid_recall`.
- `idempotencyKey`: stable retry key, 8-128 characters, used to prevent
  duplicate writes on retry.

Change this schema before changing endpoint or SDK payload shapes.

## Session type and rapid-guess gates

`submitDrillReview()` treats scheduling eligibility as follows:

| Condition | QuestionAttempt | ReviewLog | FSRS/UserProgress/Card |
|---|---:|---:|---:|
| `main`, `drill`, `targeted`, or missing session type | Yes | Yes | Yes, unless rapid guess or missing condition |
| `cram` or `rapid_recall` | Yes | No for normal attempts | No |
| Rapid guess in an FSRS-eligible flow | Yes | Yes, as `review_type: rapid_guess` | No |

Rapid guesses are detected from telemetry (`rapid_guess`) or by comparing
response time to the effective MVRT threshold. They are logged for analytics
but do not change FSRS state.

PANaCEa is implicit-only. User-facing Hard/Easy buttons are not part of the
submission contract; scheduling uses the binary Again/Good rating derived from
behavioral telemetry and correctness.

## Idempotency and offline retry

`syncManager.queueReview()` stores reviews locally and drains them through the
batch endpoint. Each queued review uses its local queue id as `idempotencyKey`.

The Edge routes enforce idempotency in two layers:

1. Persistent submission idempotency records via
   `functions/api/_shared/submission-idempotency.ts`.
2. A 24-hour CACHE KV response cache keyed by endpoint, Clerk user id, and
   idempotency key.

Retry rules:

- Reusing the same `idempotencyKey` must return the prior response or a
  conflict while the first submission is still in progress.
- Generating a new key for a retry re-enters the pipeline and can create
  duplicate review state. Do not do this in retry logic.
- Batch retries are per item; one failed item should not force already
  completed items back through FSRS.

## What `/api/questions/attempt` is for

`functions/api/questions/attempt.ts` is a compatibility/statistics endpoint.
It writes `QuestionAttempt`, user seen data, question stats, and identity
mirror data for legacy callers. It does not write `ReviewLog`, `UserProgress`,
`Card`, FSRS schedules, sibling propagation, or Rolling 360 review state.

Use this endpoint only for attempt/stat bookkeeping. Use
`/api/drills/submit-review` or `/api/drills/submit-reviews` for real learning
review submissions.

## Troubleshooting checklist

### A submitted answer did not schedule

1. Confirm the request hit `/api/drills/submit-review`,
   `/api/drills/submit-reviews`, or `/api/srs/submit`.
2. Check `sessionType`; `cram` and `rapid_recall` skip FSRS.
3. Check rapid-guess telemetry and the effective MVRT threshold.
4. Confirm the resolved question has a usable condition/medical content id.
5. Inspect `ReviewLog.telemetry.server_computed` for rating, telemetry quality,
   rapid-guess, and learning identity details.

### Duplicate reviews or cards appeared

1. Check whether retries reused the same `idempotencyKey`.
2. Verify no caller added a second write path through `/api/questions/attempt`.
3. Inspect `functions/api/srs/submit.ts`; it should remain a delegation adapter,
   not an independent scheduler.
4. Run the focused idempotency and submit-review tests before changing code.

### Offline progress looks stale

1. Confirm `syncManager.setTokenProvider()` is registered by the UI using Clerk
   `getToken`.
2. Inspect pending and dead-lettered review counts from `syncManager.getStatus()`.
3. Check that queued review items are posting to `/api/drills/submit-reviews`.
4. Stale `queueAnswer()` items can drain to `/api/questions/attempt`; they will
   not update FSRS.

## Verification commands

Use the narrowest check that covers the change:

```bash
npx vitest run tests/syncManager.test.ts tests/useDrillFSRS.test.ts tests/useDrillFSRS-offline-fallback.test.ts
npx vitest run functions/api/drills/submit-review.test.ts functions/api/drills/submit-reviews.test.ts
npx vitest run functions/api/questions/attempt.test.ts tests/drillReviewService.test.ts tests/fsrsSingleWriter.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
```

For docs-only edits, `git diff --check` is usually sufficient.
