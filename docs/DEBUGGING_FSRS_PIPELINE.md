# Debugging the FSRS Submission Pipeline

This guide covers how to debug production issues in the drill review submission pipeline — the core FSRS path that processes every student answer.

## Pipeline Overview

```
POST /api/drills/submit-review
  ↓
submit-review.ts (Edge Function)
  → validates request (Zod)
  → resolves user + question
  → creates PipelineTracer (requestId, userId, questionId)
  ↓
submitDrillReview() (drillReviewService.ts)
  1. correctness_resolved   — exact match or option scan
  2. rapid_guess_gate        — MVRT threshold check
  3. implicit_rating         — behavioral telemetry → continuous grade
  4. ghost_grader            — honesty heuristic override
  5. fsrs_gate               — skip for cram/rapid_recall/rapid guess
  6. fsrs_compute            — FSRS v6 scheduling + confidence pipeline
  7. transactional_write     — ReviewLog + UserProgress + UserTopicProgress (atomic)
  8. pipeline_complete       — final summary
  ↓
Response + attachLogMeta (trace summary attached to request_end log)
```

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

1. Find the review by userId + questionId in `pipeline:step:pipeline_complete`
2. Check `pipeline:decision:fsrs_gate` — was FSRS actually updated? (outcome=proceed)
3. Check `pipeline:decision:rapid_guess_gate` — was it flagged as rapid guess?
4. Look at `pipeline:span:fsrs_compute` for before/after stability and difficulty
5. Check if `eorClamped: true` — EOR mode may be clamping the interval

### "Reviews seem to be getting lost"

1. Search for `pipeline:span:transactional_write` with `error` in meta
2. Check for `pipeline:warn:user_progress_fail` warnings
3. Look at the `request_end` log — if `fsrsUpdated: false` but sessionType is 'main', the pipeline skipped FSRS

### "Confidence values look wrong"

1. Find `pipeline:span:implicit_rating_derivation` — check `implicitConfidence`, `gradeContinuous`, `hasBaseline`
2. Check `pipeline:step:ghost_grader` — the `rule` field shows if confidence was overridden
3. Look at `fsrs_compute` span — `confidenceTelemetry` in the ReviewLog telemetry JSON has the full 8-step pipeline breakdown

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
| `lib/services/drillReviewService.ts` | Main pipeline — 8 traced steps |
| `functions/api/drills/submit-review.ts` | Edge endpoint — creates tracer, attaches summary |
| `functions/api/_shared/requestLogger.ts` | Request lifecycle logs (request_start/end) |
| `functions/api/_shared/structuredLogger.ts` | Span timing + Sentry integration |
| `functions/api/_shared/secureLogger.ts` | Secret redaction layer |
| `lib/services/fsrsScheduleService.ts` | FSRS v6 computation (called from drillReviewService) |
| `lib/implicit-metrics.ts` | Behavioral telemetry → continuous rating |
| `lib/srs/ghostGrader.ts` | Honesty heuristic overrides |
