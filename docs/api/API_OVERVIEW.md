# API Overview

This document tracks request/response contracts for recently changed API routes and shared edge infrastructure.

**Canonical service:** `lib/services/drillReviewService.ts` (`submitDrillReview`) is the single writer for FSRS scheduling, `ReviewLog`, `QuestionAttempt`, `UserProgress`, and related side effects. Edge handlers delegate to it; legacy `/api/srs/*` routes remain compatibility adapters only.

**Schema source of truth:** `lib/api/schemas/drills.ts` (`DrillSubmitReviewRequestSchema`) defines the POST body for both submit endpoints.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/drills/submit-review` | Submit one drill or main-session answer through the implicit FSRS review pipeline. |
| POST | `/api/drills/submit-reviews` | Batch-submit multiple reviews (offline sync replay); processes items sequentially. |

---

## Edge Infrastructure (not HTTP routes)

| Binding | Module | Description |
|---|---|---|
| `EDGE_DB` (D1) | `functions/api/_shared/d1-cache.ts` | SQL-queryable edge cache (`edge_cache` table) for prefix invalidation, TTL, and batch reads. Complements KV `CACHE` / `RATE_LIMIT_KV`. |
| `AI` (Workers AI) | — | Edge LLM inference via `env.AI.run()` (wrangler `[ai]` binding). |

### D1 `edge_cache` schema

| Column | Type | Purpose |
|---|---|---|
| `key` | `TEXT PRIMARY KEY` | Cache key (e.g. `condition:chf`, `user:<id>:stats`, `qseed:pool:1`) |
| `value` | `TEXT` | JSON-serialized payload |
| `expires_at` | `INTEGER` (unix seconds) | TTL; `NULL` = permanent |

**Key prefixes** (`D1_PREFIX` in `d1-cache.ts`): `condition:`, `question_pool:`, `user_stats:`, `drug:`, `guideline:`, `system:`, `study_path:`, `qseed:`, `sem:`.

**Wrangler binding** (`wrangler.toml`):

```toml
[[d1_databases]]
binding = "EDGE_DB"
database_name = "panacea-edge"
database_id = "5d8d23a1-3a32-42e4-aa7e-278c55469f1a"
```

When `EDGE_DB` is unavailable, `d1-cache` helpers no-op gracefully (cache miss semantics).

---

## Endpoint Contracts

### `POST /api/drills/submit-review`

**Auth:** Required (`authenticatedEndpoint`, 120 rpm)

**CORS:** `OPTIONS` handled by `onRequestOptions` (no auth on preflight)

**Request body** (see `DrillSubmitReviewRequestSchema`)

```json
{
  "questionId": "string",
  "canonicalQuestionId": "string (optional)",
  "sourceQuestionId": "string (optional)",
  "questionSource": "question | pre_generated | staging | seed | generated (optional)",
  "medicalContentId": "string (optional)",
  "selectedAnswer": "string | number",
  "timeSpentMs": 0,
  "timeToFirstClick": 0,
  "answerSwitches": 0,
  "totalDwellTime": 0,
  "timezone": "string (optional)",
  "wakeTimeHHMM": "string (optional)",
  "telemetry": {},
  "sessionType": "main | drill | cram | rapid_recall | targeted (optional, default drill)",
  "idempotencyKey": "string 8–128 chars (optional)"
}
```

**`sessionType` FSRS gating**

| Value | FSRS update | Notes |
|---|---|---|
| `main`, `drill`, `targeted` | Yes | Full pipeline when other gates pass |
| `cram`, `rapid_recall` | No | Attempt logged; scheduling skipped |
| omitted | Treated as `drill` | |

**Success response (`200 OK`)** — envelope `{ "data": { ... } }`

```json
{
  "success": true,
  "isCorrect": true,
  "quality": 0,
  "parTimeMs": 0,
  "timeSpentMs": 0,
  "implicitMetrics": {
    "rating": 1,
    "gradeContinuous": 0,
    "confidence": 0,
    "latencyRatio": 0,
    "answerSwitches": 0
  },
  "circadian": {
    "phase": "string",
    "stabilityModifier": 0,
    "localHour": 0
  },
  "fsrsSchedule": {
    "intervalDays": 0,
    "nextDueDate": "2026-01-01T00:00:00.000Z",
    "stability": 0,
    "difficulty": 0
  },
  "fireCredits": [{ "conceptId": "string", "stabilityMultiplier": 0 }],
  "mastery": {
    "wilsonLower": 0,
    "wilsonUpper": 0,
    "pointEstimate": 0,
    "effectiveN": 0,
    "totalN": 0,
    "isMastered": false,
    "isGoldMastery": false,
    "correctNeededForMastery": 0
  },
  "isRapidGuess": false,
  "nextReview": {
    "intervalDays": 0,
    "nextDueDate": "2026-01-01T00:00:00.000Z",
    "stability": 0,
    "difficulty": 0
  },
  "drillFeedback": {
    "conditionAccuracy": 0,
    "systemAccuracy": 0,
    "relativePerformance": 0,
    "conditionAttemptCount": 0,
    "systemAttemptCount": 0,
    "isRemediationTarget": false
  }
}
```

**Response field notes**

- `fsrsSchedule`, `mastery`, `nextReview` — omitted when FSRS was skipped (rapid guess, cram, `rapid_recall`, missing `conditionId`).
- `fireCredits` — FIRe prerequisite stability multipliers; omitted when graph lookup fails.
- `isRapidGuess` — from `telemetry.rapid_guess` (endpoint enrichment).
- `nextReview` — convenience mirror of `fsrsSchedule`; `null` when scheduling skipped.
- `drillFeedback` — relative performance vs. system average; only for `sessionType === 'drill'` (or omitted session type).
- **Ratings are implicit only** — no `confidenceRating` / Hard / Easy in the request schema.

**Error responses**

| Status | Body | When |
|---|---|---|
| `500` | `{ "error": "Database not configured" }` | Missing `DATABASE_URL` |
| `500` | `{ "error": "Failed to submit review", "code": "INTERNAL_ERROR", "retryable": false }` | Unhandled error |
| `500` | `{ "error": "Failed to submit review", "code": "DATABASE_ERROR", "retryable": true }` | Prisma/DB failure |
| `504` | `{ "error": "Failed to submit review", "code": "SUBMISSION_TIMEOUT", "retryable": true }` | Timeout |

**Idempotency**

- Optional `idempotencyKey` caches the successful `data` payload for 24h in KV `CACHE` (`idem:submit-review:<clerkId>:<key>`) and durable DB idempotency rows.
- Retries with the same key return the cached response without re-entering the FSRS pipeline.

---

### `POST /api/drills/submit-reviews`

**Auth:** Required (`authenticatedEndpoint`)

**CORS:** `OPTIONS` handled by `onRequestOptions` (no auth on preflight)

**Request body:** JSON **array** of `DrillSubmitReviewRequestSchema` objects (same shape as single submit).

**Success response (`200 OK`)**

```json
{
  "data": [
    {
      "questionId": "string",
      "success": true,
      "data": { },
      "source": "string"
    },
    {
      "questionId": "string",
      "success": false,
      "error": "Question not found",
      "source": "missing"
    },
    {
      "questionId": "string",
      "success": false,
      "error": "Failed to submit review"
    }
  ]
}
```

- Per-item `data` matches the single-submit `data` object (without `isRapidGuess` / `nextReview` / `drillFeedback` enrichments).
- Batch continues on per-item failure; check each element's `success`.
- Per-item `idempotencyKey` uses KV prefix `idem:submit-reviews:<clerkId>:<key>`.

**Error responses**

| Status | Body | When |
|---|---|---|
| `500` | `{ "error": "Database not configured" }` | Missing `DATABASE_URL` |
| `500` | `{ "error": "Failed to submit reviews", "details": "string" }` | Batch-level failure |

---

## Related Files

| File | Role |
|---|---|
| `functions/api/drills/submit-review.ts` | Single-submit edge handler |
| `functions/api/drills/submit-reviews.ts` | Batch-submit edge handler |
| `lib/services/drillReviewService.ts` | Canonical review pipeline |
| `lib/api/schemas/drills.ts` | Zod request schemas |
| `functions/api/_shared/d1-cache.ts` | D1 edge cache helpers |
| `wrangler.toml` | `EDGE_DB`, `AI`, KV bindings |
