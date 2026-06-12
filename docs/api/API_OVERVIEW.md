# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

Unless an endpoint intentionally returns a raw `Response`, non-streaming API responses use the
standard middleware envelope:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Errors use:

```json
{
  "ok": false,
  "success": false,
  "error": {
    "code": "ERROR",
    "message": "Human-readable message",
    "details": {}
  },
  "code": "ERROR",
  "message": "Human-readable message",
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

The examples below show the `data` payload unless the envelope itself is relevant.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/fetch` | Fetches approved, progress-linked `PreGeneratedQuestion` rows for legacy/client-safe question pulls. |
| GET | `/api/questions/session` | Fetches an authenticated study session using query parameters, NCCPA blueprint weighting, and session-lane rules. |
| POST | `/api/questions/session` | Fetches an authenticated study session using a JSON body with the same serving and identity guarantees. |
| POST | `/api/questions/due-siblings` | Fetches approved sibling variants for due/quick-review concepts without repeating the original question. |
| OPTIONS | `/api/drills/submit-review` | Handles secure CORS preflight for single review submission without requiring auth headers. |
| POST | `/api/drills/submit-review` | Submits one answer through the canonical implicit FSRS review pipeline. |
| OPTIONS | `/api/drills/submit-reviews` | Handles secure CORS preflight for batched review submission without requiring auth headers. |
| POST | `/api/drills/submit-reviews` | Submits a batch of answers through the same resolver and review pipeline as the single-review endpoint. |

## Endpoint Contracts

### `POST /api/questions/fetch`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "system": "CV",
  "conditionId": "condition-id",
  "difficulty": "medium",
  "questionType": "mcq",
  "limit": 10
}
```

All fields are optional. `limit` defaults to `10`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "questions": [
    {
      "id": "pre-generated-question-id",
      "questionData": {},
      "system": "CV",
      "conditionId": "condition-id",
      "difficulty": "medium",
      "questionType": "mcq"
    }
  ],
  "source": "database",
  "count": 1,
  "needsGeneration": false,
  "generationNeeded": 0
}
```

**Error responses**

- `404` → `User not found`
- `500` → `Failed to fetch questions`

**Notes**

- The internal user is resolved from Clerk auth; clients must not send `userId`.
- Learner-facing serving fails closed to approved content: `validationStatus = "approved"`.
- Questions must be progress-linked (`conditionId IS NOT NULL`) so later review submissions can write durable progress state.
- Seen questions from `UserQuestionSeen` are excluded, optionally scoped by `questionType`.
- `timesServed` is incremented asynchronously for served rows; a failed increment does not fail the request.

---

### `GET /api/questions/session`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `count` | stringified number | Requested count, capped at `50`; defaults to `10`. |
| `system` | string | Optional system/rotation filter. Ignored for main-lane blueprint sessions. |
| `mode` | string | `standard`, `review`, `weakness`, `random`, or `interleaved` when applicable. |
| `simulationStrict` | boolean string | `true`/`1` enforces strict PANCE simulation selection. |
| `eorMode` | boolean string | `true`/`1` enables EOR lane behavior and rotation deadline clamping. |
| `eorDeadline` | ISO date string | Optional EOR deadline override. |
| `sessionLane` | enum | Optional explicit `main`, `eor`, or `drill` lane. |

**Success response (`200 OK`)**

```json
{
  "questions": [
    {
      "id": "question-id",
      "question": "Question stem",
      "vignette": "Optional vignette",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 0,
      "rationale": "string or structured rationale object",
      "system": "CV",
      "subcategory": "optional",
      "conditionId": "condition-id",
      "condition": "Condition name",
      "medicalContentId": "medical-content-id",
      "pearls": ["Clinical pearl"],
      "difficulty": "medium",
      "source": "pool",
      "questionSource": "pre_generated",
      "canonicalQuestionId": null,
      "sourceQuestionId": "pre-generated-question-id",
      "metadata": {}
    }
  ],
  "analytics": {
    "questionsServed": 1,
    "fromPool": 1,
    "fromMain": 0,
    "generated": 0,
    "fromSeeds": 0,
    "avgDifficulty": 2,
    "systemDistribution": {
      "CV": 1
    }
  },
  "poolStatus": {
    "available": 120,
    "needsGeneration": false
  }
}
```

When no eligible questions match, the same payload includes:

```json
{
  "emptyState": {
    "code": "SESSION_EMPTY",
    "message": "No questions matched this session configuration. Try a broader focus or try again later."
  }
}
```

**Error responses**

- `503` → `Session service unavailable`
- `500` → `Failed to fetch session questions`

**Notes**

- `eorMode` derives `sessionLane = "eor"`. Simulation or unfiltered requests derive `sessionLane = "main"`.
- Main-lane and strict-simulation sessions use NCCPA blueprint distribution and phase-aware question-order weighting.
- Learner phase is inferred from user profile fields such as rotation dates, exam date, training phase, and year in program.
- Served questions include review-pipeline identity fields: `questionSource`, `canonicalQuestionId`, and `sourceQuestionId`.
- Pool rows are served only when approved and progress-linked. Canonical `Question` rows are served only when `lifecycleStatus = "ACTIVE"`, `qaStatus = "APPROVED"`, and progress-linked.
- Rows with unresolvable correct answers are skipped instead of defaulting to option A.

---

### `POST /api/questions/session`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "count": 10,
  "system": "CV",
  "mode": "standard",
  "systems": ["CV", "PULM"],
  "prioritizeWeakAreas": false,
  "simulationStrict": false,
  "eorMode": false,
  "eorDeadline": "2026-01-01T00:00:00.000Z",
  "sessionLane": "main"
}
```

**Success response (`200 OK`)**

Same `data` shape as `GET /api/questions/session`.

**Error responses**

- `503` → `Session service unavailable`
- `500` → `Failed to fetch session questions`

**Notes**

- `count` is capped at `50`.
- `systems` and `prioritizeWeakAreas` are accepted by the schema for compatibility; the current service path uses `system`, `mode`, and derived `sessionLane` as the primary routing controls.
- The same production serving gates, identity fields, and answer-index safety rules as the GET endpoint apply.

---

### `POST /api/questions/due-siblings`

**Auth:** Required (AI endpoint)

**Request body**

```json
{
  "dueItems": [
    {
      "conditionId": "condition-id",
      "taskType": "diagnosis",
      "originalQuestionId": "question-id"
    }
  ]
}
```

`dueItems` must contain `1` to `50` items. `taskType` is optional and nullable.

**Success response (`200 OK`)**

```json
{
  "results": [
    {
      "question": {
        "id": "pre-generated-sibling-id",
        "question": "Sibling question stem",
        "vignette": "Optional vignette",
        "options": ["A", "B", "C", "D"],
        "correctAnswerIndex": 1,
        "correctAnswer": "B",
        "rationale": "Explanation",
        "system": "CV",
        "subcategory": "optional",
        "conditionId": "condition-id",
        "condition": "Condition name",
        "difficulty": "medium",
        "source": "pool",
        "canonicalQuestionId": null,
        "sourceQuestionId": "pre-generated-sibling-id",
        "questionSource": "pre_generated",
        "metadata": {}
      },
      "dueConceptKey": {
        "conditionId": "condition-id",
        "taskType": "diagnosis"
      }
    }
  ]
}
```

If no usable sibling exists for an item, that item returns `"question": null`.

**Error responses**

- `404` → `User not found`
- `500` → `Failed to fetch due siblings`

**Notes**

- The endpoint never returns the original question ID.
- It searches approved `PreGeneratedQuestion` siblings for the same `conditionId`, preferring matching `taskType` when available.
- If no sibling exists and `GEMINI_API_KEY` is configured, it attempts on-demand variant generation and retries the lookup.
- Returned sibling questions preserve submit-review identity as `questionSource = "pre_generated"`, `canonicalQuestionId = null`, and `sourceQuestionId = question.id`.
- Served sibling rows increment `timesServed` asynchronously.

---

### `OPTIONS /api/drills/submit-review`

**Auth:** None. Browser preflight requests do not include auth headers.

**Response:** Secure CORS preflight response from `handleCorsPreflightSecure()`.

---

### `POST /api/drills/submit-review`

**Auth:** Required (authenticated endpoint)

**Rate limit:** 120 requests/minute

**Request body**

```json
{
  "questionId": "rendered-question-id",
  "canonicalQuestionId": "canonical-question-id-or-null",
  "sourceQuestionId": "source-row-id",
  "questionSource": "pre_generated",
  "medicalContentId": "medical-content-id",
  "selectedAnswer": "A",
  "timeSpentMs": 12000,
  "timeToFirstClick": 2500,
  "answerSwitches": 1,
  "totalDwellTime": 12000,
  "timezone": "America/New_York",
  "wakeTimeHHMM": "06:30",
  "sessionType": "drill",
  "idempotencyKey": "review-unique-key",
  "telemetry": {
    "duration_ms": 12000,
    "time_to_first_interaction_ms": 2500,
    "rapid_guess": false,
    "question_type": "vignette",
    "mvrt_threshold_ms": 3000,
    "question_displayed_at": "2026-01-01T00:00:00.000Z",
    "answer_submitted_at": "2026-01-01T00:00:12.000Z",
    "answer_changes": 1,
    "hint_viewed": false,
    "hint_view_duration_ms": null,
    "session_id": "study-session-id",
    "urgency_multiplier": 1
  }
}
```

`selectedAnswer` may be a string or number. `sessionType` may be `main`, `drill`, `targeted`, `cram`, or `rapid_recall`. `idempotencyKey` is optional but should be a stable unique string for retryable submissions.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "isCorrect": true,
  "quality": 3,
  "parTimeMs": 45000,
  "timeSpentMs": 12000,
  "implicitMetrics": {
    "rating": 3,
    "gradeContinuous": 3.4,
    "confidence": 0.82,
    "latencyRatio": 0.27,
    "answerSwitches": 1
  },
  "circadian": {
    "phase": "peak",
    "stabilityModifier": 1.05,
    "localHour": 10
  },
  "fsrsSchedule": {
    "intervalDays": 3,
    "nextDueDate": "2026-01-04T00:00:00.000Z",
    "stability": 2.4,
    "difficulty": 5.8
  },
  "fireCredits": [
    {
      "conceptId": "condition-id",
      "stabilityMultiplier": 1.1
    }
  ],
  "mastery": {
    "wilsonLower": 0.7,
    "wilsonUpper": 0.95,
    "pointEstimate": 0.85,
    "effectiveN": 10,
    "totalN": 12,
    "isMastered": true,
    "isGoldMastery": false,
    "correctNeededForMastery": 1
  },
  "isRapidGuess": false,
  "nextReview": {
    "intervalDays": 3,
    "nextDueDate": "2026-01-04T00:00:00.000Z",
    "stability": 2.4,
    "difficulty": 5.8
  },
  "drillFeedback": {}
}
```

`fsrsSchedule`, `fsrsSkippedReason`, `fireCredits`, `mastery`, `nextReview`, and `drillFeedback` are conditional.

**Error responses**

- `404` → `Question not found`
- `409` → `Submission is still processing. Retry shortly.` with `Retry-After`
- `500` → `Database not configured` or `Failed to submit review`
- `504` → `Failed to submit review` with code `SUBMISSION_TIMEOUT`

**Notes**

- The resolver accepts source-aware identity fields and resolves in this order: approved `PreGeneratedQuestion`, approved canonical `Question`, then latest `QuestionAttempt` fallback for legacy/ephemeral IDs.
- `questionSource = "question"` with a `canonicalQuestionId` prefers canonical `Question` lookup first, then falls back to `PreGeneratedQuestion` if the canonical claim misses.
- The pipeline is implicit-only. Do not add self-rated Hard/Easy request fields.
- `main`, `drill`, and `targeted` are FSRS-eligible. `cram` and `rapid_recall` persist attempts but skip FSRS scheduling.
- Rapid guesses write analytics review logs but skip FSRS state updates.
- Missing `conditionId` returns `fsrsSkippedReason = "missing_condition_linkage"` when a legacy/offline submission reaches the writer; learner-facing serving filters such rows out.
- Successful submissions are persisted through `QuestionAttempt`, `ReviewLog`, `UserProgress`, calibration/analytics signals, and optional confusion-pair/variant side effects.
- `idempotencyKey` uses a persistent idempotency record and a 24-hour `CACHE` KV entry scoped by Clerk user ID. Completed retries return the prior response; in-progress duplicates return `409`.
- When `telemetry.session_id` is present, the source reservoir item is marked consumed after a successful review.

---

### `OPTIONS /api/drills/submit-reviews`

**Auth:** None. Browser preflight requests do not include auth headers.

**Response:** Secure CORS preflight response from `handleCorsPreflightSecure()`.

---

### `POST /api/drills/submit-reviews`

**Auth:** Required (authenticated endpoint)

**Rate limit:** 60 requests/minute

**Request body**

```json
[
  {
    "questionId": "rendered-question-id",
    "canonicalQuestionId": null,
    "sourceQuestionId": "pre-generated-question-id",
    "questionSource": "pre_generated",
    "selectedAnswer": "A",
    "timeSpentMs": 12000,
    "sessionType": "main",
    "idempotencyKey": "review-unique-key",
    "telemetry": {
      "duration_ms": 12000,
      "time_to_first_interaction_ms": 2500,
      "rapid_guess": false,
      "question_type": "vignette",
      "mvrt_threshold_ms": 3000,
      "question_displayed_at": "2026-01-01T00:00:00.000Z",
      "answer_submitted_at": "2026-01-01T00:00:12.000Z",
      "answer_changes": 0,
      "hint_viewed": false,
      "hint_view_duration_ms": null
    }
  }
]
```

Each item uses the same schema as `POST /api/drills/submit-review`.

**Success response (`200 OK`)**

```json
[
  {
    "questionId": "rendered-question-id",
    "success": true,
    "data": {
      "success": true,
      "isCorrect": true,
      "quality": 3
    },
    "source": "pre_generated"
  },
  {
    "questionId": "duplicate-question-id",
    "success": false,
    "error": "Submission is still processing. Retry shortly.",
    "source": "idempotent-in-progress",
    "retryAfterSeconds": 3
  }
]
```

**Error responses**

- Top-level `500` → `Failed to submit reviews`
- Per-item `success: false` → item-specific `Question not found`, idempotency conflict, or `Failed to submit review`

**Notes**

- Batch submission shares the single-review resolver and `drillReviewService` pipeline.
- Per-item idempotency uses endpoint `/api/drills/submit-reviews` and 24-hour `CACHE` KV keys scoped by Clerk user ID.
- Per-item successful reviews can mark reservoir items consumed when `telemetry.session_id` is present.
- A failed item does not stop later batch items from processing.
