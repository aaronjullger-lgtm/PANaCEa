# Debugging the FSRS Submission Pipeline

This guide covers how to debug production issues in the review submission
pipeline — the core FSRS path that processes learning reviews. For the
developer-facing contract and entry-point map, see
[`docs/guides/SESSION_SUBMISSION_PIPELINE.md`](./guides/SESSION_SUBMISSION_PIPELINE.md).

## Pipeline Overview

```
Client entry point
  -> QuizView -> syncManager.queueReview() -> POST /api/drills/submit-reviews
  -> useDrillFSRS() -> POST /api/drills/submit-review
  -> legacy due-review UI -> POST /api/srs/submit
  -> stale queueAnswer item -> POST /api/questions/attempt (stats only; no FSRS)
  ↓
submit-review.ts / submit-reviews.ts / srs/submit.ts (Edge Functions)
  → validates request (Zod)
  → resolves user + question
  → enforces submission idempotency when idempotencyKey is present
  → creates PipelineTracer on the singular submit-review route
  ↓
submitDrillReview() (drillReviewService.ts)
  1. correctness_resolved    — exact match or option scan
  2. rapid_guess_gate        — MVRT threshold check
  3. implicit_rating         — behavioral telemetry -> binary Again/Good
  4. ghost_grader            — behavioral honesty override
  5. fsrs_gate               — skip for cram/rapid_recall/rapid guess
  6. fsrs_compute            — FSRS v6 scheduling + confidence pipeline v4
  7. durable_writes          — QuestionAttempt, ReviewLog, UserProgress, Card, stats
  8. pipeline_complete       — final summary
  ↓
Response + attachLogMeta (trace summary attached to request_end log)
```

`/api/questions/attempt` is intentionally absent from the FSRS writer path. It
records compatibility/statistics data for stale offline answers and must not be
used for ReviewLog, UserProgress, Card, or sibling-propagation writes.

## Where to Look

### Cloudflare Workers Logs

All structured logs are emitted via `console.log(JSON.stringify(...))` and indexed by Cloudflare Workers Logs. Filter by:

**Find a specific request:**
```
event:request_start requestId:"abc-123"
```

**Find all pipeline events for a user:**
```
pipeline:drill_review userId:"user_xyz"
```

**Find all decisions (gates/branches):**
```
event:pipeline:decision:*
```

**Find slow spans:**
```
event:pipeline:span:* durationMs:>500
```

### Key Log Events

| Event | What it tells you |
|---|---|
| `pipeline:step:correctness_resolved` | How correctness was determined (exactMatch vs optionScan) |
| `pipeline:decision:rapid_guess_gate` | Whether MVRT threshold was hit — if `outcome=skip_implicit_rating`, FSRS was bypassed |
| `pipeline:step:ghost_grader` | Which Ghost Grader rule fired (indecision, confidence_boost, elimination, none) |
| `pipeline:decision:fsrs_gate` | Whether FSRS update will run — `outcome=skip` means cram/rapid_recall session |
| `pipeline:span:fsrs_compute` | FSRS computation timing + before/after stability and difficulty |
| `pipeline:span:transactional_write` | DB transaction timing — slow here means DB pressure |
| `pipeline:step:pipeline_complete` | Final summary with all key metrics |
| `pipeline:warn:*` | Throttled warnings for non-fatal errors (DB upsert failures, etc.) |

### Correlation

Every log line in the pipeline includes `requestId`, `userId`, and `questionId`. To trace a single review end-to-end:

1. Start with `request_start` for the requestId
2. Filter all events with that requestId
3. The `request_end` log includes a `traceDecisions` array summarizing all gates
4. The `traceSpans` array shows timing for each sub-operation

### Request-End Metadata

The `request_end` log (from requestLogger) includes enriched metadata:

```json
{
  "event": "request_end",
  "requestId": "abc-123",
  "pipelineMs": 142,
  "isCorrect": true,
  "sessionType": "drill",
  "system": "Cardiovascular",
  "fsrsUpdated": true,
  "traceDecisions": ["rapid_guess_gate:proceed", "fsrs_gate:proceed"],
  "traceSpans": [
    { "name": "implicit_rating_derivation", "ms": 3 },
    { "name": "fsrs_compute", "ms": 45 },
    { "name": "transactional_write", "ms": 89 }
  ],
  "traceWarnings": 0,
  "traceTotalMs": 141
}
```

## Common Debugging Scenarios

### "Student's card isn't scheduling correctly"

1. Confirm the request hit `/api/drills/submit-review`,
   `/api/drills/submit-reviews`, or `/api/srs/submit`. A
   `/api/questions/attempt` write is stats-only.
2. Find the review by userId + questionId in `pipeline:step:pipeline_complete`.
3. Check `pipeline:decision:fsrs_gate` — was FSRS actually updated? (outcome=proceed)
4. Check `pipeline:decision:rapid_guess_gate` — was it flagged as rapid guess?
5. Look at `pipeline:span:fsrs_compute` for before/after stability and difficulty.
6. Check if `eorClamped: true` — EOR mode may be clamping the interval.

### "Reviews seem to be getting lost"

1. Search for `pipeline:span:transactional_write` with `error` in meta
2. Check for `pipeline:warn:user_progress_fail` warnings
3. Look at the `request_end` log — if `fsrsUpdated: false` but sessionType is `main`, the pipeline skipped FSRS.
4. For offline submissions, inspect `syncManager.getStatus()` for pending or dead-lettered reviews and verify queued reviews drain to `/api/drills/submit-reviews`.
5. For duplicate or missing retries, verify the same queued review reused the same `idempotencyKey`.

### "Confidence values look wrong"

1. Find `pipeline:span:implicit_rating_derivation` — check `implicitConfidence`, `gradeContinuous`, `hasBaseline`
2. Check `pipeline:step:ghost_grader` — the `rule` field shows if confidence was overridden
3. Look at `fsrs_compute` span and `ReviewLog.telemetry`. The service now runs confidence pipeline v4: Wave 1/2/3 behavioral signals, Bayesian accumulation, calibration, fatigue, interference, trend, Wilson mastery, hypercorrection, and shadow calibration signals. The persisted telemetry object still contains historical key names in places, so treat `lib/services/drillReviewService.ts` as authoritative when the label and implementation disagree.

### "Pipeline is slow"

1. Filter `pipeline:span:*` for the requestId
2. Compare `transactional_write` vs `fsrs_compute` timing
3. If `transactional_write` > 200ms, check DB connection pool / Prisma edge client
4. If `fsrs_compute` > 100ms, check if behavioral baseline fetch is slow

### "Too many warnings flooding logs"

The `warnThrottled()` mechanism deduplicates warnings by key within a 60-second window per worker isolate. If you see `pipeline:warn:*` events, the `count` field in the trace summary shows how many were suppressed. Common throttled keys:

- `user_stats_fail` — UserStatistics update failed
- `user_progress_fail` — UserProgress update failed (critical — investigate immediately)

## Files Reference

| File | Role |
|---|---|
| `lib/observability/pipelineTracer.ts` | PipelineTracer factory — creates trace context |
| `lib/services/drillReviewService.ts` | Canonical writer for QuestionAttempt, ReviewLog, UserProgress, Card, stats, and scheduling |
| `functions/api/drills/submit-review.ts` | Singular Edge endpoint — creates tracer, enforces idempotency, attaches summary |
| `functions/api/drills/submit-reviews.ts` | Batch Edge endpoint used by offline/main-session queue draining |
| `functions/api/srs/submit.ts` | Legacy due-review compatibility adapter that delegates to `submitDrillReview()` |
| `functions/api/questions/attempt.ts` | Stats-only compatibility endpoint; does not update FSRS |
| `lib/services/sync/syncManager.ts` | Offline queue and batch retry owner for `queueReview()` |
| `functions/api/_shared/requestLogger.ts` | Request lifecycle logs (request_start/end) |
| `functions/api/_shared/structuredLogger.ts` | Span timing + Sentry integration |
| `functions/api/_shared/secureLogger.ts` | Secret redaction layer |
| `lib/services/fsrsScheduleService.ts` | FSRS v6 computation (called from drillReviewService) |
| `lib/implicit-metrics.ts` | Behavioral telemetry → continuous rating |
| `lib/srs/ghostGrader.ts` | Honesty heuristic overrides |
