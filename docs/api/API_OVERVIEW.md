# API Overview

This document tracks request/response contracts for recently changed learner-facing API routes. Non-streaming `functions/api` handlers use the unified envelope:

- Success: `{ "ok": true, "success": true, "data": ..., "traceId": "string", "timestamp": "ISO-8601" }`
- Error: `{ "ok": false, "success": false, "error": { "code": "string", "message": "string", "details": "optional" }, "code": "string", "message": "string", "traceId": "string", "timestamp": "ISO-8601" }`

Payload examples below show the value inside `data` unless the section is describing an error envelope.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/fetch` | Fetches approved, progress-linkable `PreGeneratedQuestion` rows for Quick Review and legacy question clients. |
| GET | `/api/questions/session` | Fetches a study-session question set from approved pool/main question sources with NCCPA blueprint weighting. |
| POST | `/api/questions/session` | Fetches a study-session question set using the same contract as GET with JSON body parameters. |
| POST | `/api/drills/submit-review` | Submits an answer through the canonical implicit FSRS review pipeline for drills, main sessions, and targeted sessions. |

## Shared Question Identity Fields

Question-serving responses now preserve review-pipeline identity fields so `/api/drills/submit-review` can resolve the source table correctly:

| Field | Type | Meaning |
|---|---|---|
| `questionSource` | `"question"` / `"pre_generated"` / `"seed"` / `"generated"` | Source table or source kind for the served question. |
| `canonicalQuestionId` | `string` or `null` | Canonical `Question.id` when the item came from `Question`; otherwise `null`. |
| `sourceQuestionId` | `string` | ID in the source system/table that should be used for resolver fallback. |

Learner-facing serving paths fail closed to approved content and require `conditionId` linkage so answers can persist durable review state.

## Endpoint Contracts

### `POST /api/questions/fetch`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "system": "CV",
  "conditionId": "optional-condition-id",
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
      "difficulty": "medium",
      "questionType": "mcq",
      "conditionId": "condition-id",
      "medicalContentId": "optional-medical-content-id",
      "validationStatus": "approved"
    }
  ],
  "source": "database",
  "count": 1,
  "needsGeneration": false,
  "generationNeeded": 0
}
```

**Error responses**

- `401` -> unified auth error envelope from middleware.
- `404` -> user record could not be resolved from Clerk auth.
- `500` -> failed to fetch questions.

**Notes**

- The server derives `userId` from Clerk auth; clients must not send it.
- Results exclude questions already present in `UserQuestionSeen` for the current user.
- Serving is restricted to `validationStatus = "approved"` and `conditionId != null`.
- `timesServed` is incremented asynchronously for served rows; increment failures do not fail the request.

---

### `GET /api/questions/session`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `count` | stringified integer | Optional; defaults to `10`, max `50`. |
| `system` | string | Optional organ-system filter. Ignored when strict simulation or main-lane blueprint mode is active. |
| `mode` | string | Optional session mode (`standard`, `review`, `weakness`, `random`, `interleaved`). |
| `simulationStrict` | boolean string | Optional; `true`/`1` enforces strict PANCE simulation distribution and medium/hard only. |
| `eorMode` | boolean string | Optional; `true`/`1` uses EOR deadline-aware selection. |
| `eorDeadline` | ISO date string | Optional EOR deadline override. |
| `sessionLane` | `"main"` / `"eor"` / `"drill"` | Optional lane override. `main` is blueprint-enforced, `eor` keeps rotation/system filtering, `drill` preserves legacy filtered behavior. |

**Success response (`200 OK`)**

```json
{
  "questions": [
    {
      "id": "question-id",
      "question": "Clinical vignette or stem",
      "vignette": "optional vignette",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 0,
      "rationale": "string or structured rationale object",
      "system": "CV",
      "subcategory": "optional",
      "conditionId": "condition-id",
      "condition": "optional condition name",
      "medicalContentId": "optional-medical-content-id",
      "pearls": ["optional clinical pearl"],
      "difficulty": "medium",
      "source": "pool",
      "questionSource": "pre_generated",
      "canonicalQuestionId": null,
      "sourceQuestionId": "question-id",
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
    "available": 42,
    "needsGeneration": true
  }
}
```

When no eligible questions match, the endpoint still returns `200 OK` with an empty `questions` array and:

```json
{
  "emptyState": {
    "code": "SESSION_EMPTY",
    "message": "No questions matched this session configuration. Try a broader focus or try again later."
  }
}
```

Strict simulation empty state uses `code: "SIMULATION_EMPTY"`.

**Error responses**

- `401` -> unified auth error envelope from middleware.
- `503` -> database not configured or temporarily unavailable.
- `500` -> failed to fetch session questions.

**Notes**

- GET defaults to `sessionLane = "main"` when no system filter is present, enforcing NCCPA blueprint distribution.
- Pool items (`source: "pool"`) are served from approved `PreGeneratedQuestion` rows and include `questionSource: "pre_generated"`.
- Main items (`source: "main"`) are served from active/approved `Question` rows and include `questionSource: "question"`, `canonicalQuestionId: id`, and `sourceQuestionId: id`.
- Learner hot-path generation is disabled here; shortfalls are returned as fewer questions rather than unlinked generated content.

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
  "prioritizeWeakAreas": true,
  "simulationStrict": false,
  "eorMode": false,
  "eorDeadline": "2026-07-01T00:00:00.000Z",
  "sessionLane": "main"
}
```

**Success and error responses:** Same as `GET /api/questions/session`.

**Notes**

- `count` must be an integer from `1` to `50`.
- `mode` must be one of `standard`, `review`, `weakness`, `random`, or `interleaved`.
- `systems` and `prioritizeWeakAreas` are accepted for compatibility, but current selection is driven by `system`, `simulationStrict`, `eorMode`, `sessionLane`, learner phase, and blueprint weighting.

---

### `POST /api/drills/submit-review`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "questionId": "served-question-id",
  "canonicalQuestionId": "canonical-question-id-or-null",
  "sourceQuestionId": "source-question-id",
  "questionSource": "pre_generated",
  "medicalContentId": "optional-medical-content-id",
  "selectedAnswer": "A",
  "timeSpentMs": 18000,
  "timeToFirstClick": 2500,
  "answerSwitches": 1,
  "totalDwellTime": 18000,
  "timezone": "America/New_York",
  "wakeTimeHHMM": "06:30",
  "sessionType": "drill",
  "idempotencyKey": "review-unique-client-key",
  "telemetry": {
    "duration_ms": 18000,
    "time_to_first_interaction_ms": 2500,
    "rapid_guess": false,
    "question_type": "vignette",
    "mvrt_threshold_ms": 3000,
    "question_displayed_at": "2026-06-12T02:00:00.000Z",
    "answer_submitted_at": "2026-06-12T02:00:18.000Z",
    "answer_changes": 1,
    "hint_viewed": false,
    "hint_view_duration_ms": null,
    "session_id": "session-id"
  }
}
```

Required fields are `questionId`, `selectedAnswer`, and `timeSpentMs`. `telemetry`, identity fields, timing details, and `idempotencyKey` are optional but recommended.

`questionSource` must be one of `question`, `pre_generated`, `staging`, `seed`, or `generated`. `sessionType` must be one of `main`, `drill`, `targeted`, `cram`, or `rapid_recall`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "isCorrect": true,
  "quality": 1,
  "parTimeMs": 30000,
  "timeSpentMs": 18000,
  "implicitMetrics": {
    "rating": 3,
    "gradeContinuous": 3.4,
    "confidence": 0.86,
    "latencyRatio": 0.6,
    "answerSwitches": 1
  },
  "circadian": {
    "phase": "peak",
    "stabilityModifier": 1,
    "localHour": 14
  },
  "fsrsSchedule": {
    "intervalDays": 3,
    "nextDueDate": "2026-06-15T02:00:18.000Z",
    "stability": 3.2,
    "difficulty": 5.8
  },
  "fireCredits": [],
  "mastery": {
    "wilsonLower": 0.7,
    "wilsonUpper": 0.95,
    "pointEstimate": 0.84,
    "effectiveN": 12,
    "totalN": 14,
    "isMastered": true,
    "isGoldMastery": false,
    "correctNeededForMastery": 0
  },
  "isRapidGuess": false,
  "nextReview": {
    "intervalDays": 3,
    "nextDueDate": "2026-06-15T02:00:18.000Z",
    "stability": 3.2,
    "difficulty": 5.8
  },
  "drillFeedback": {}
}
```

`fsrsSchedule`, `mastery`, `fireCredits`, and `drillFeedback` may be omitted or `null` when not applicable. `nextReview` is `null` when FSRS scheduling is skipped. `implicitMetrics.rating` is an internal server-derived FSRS enum (`1` = Again, `3` = Good); clients must not send self-rated difficulty.

**Error responses**

- `401` -> unified auth error envelope from middleware.
- `404` -> question could not be resolved from `PreGeneratedQuestion`, `Question`, or recent `QuestionAttempt` fallback.
- `409` -> duplicate idempotency key is still processing; response includes `Retry-After` and `details.retryAfterSeconds`.
- `500` -> failed to submit review.
- `504` -> submission timeout.

**Notes**

- `/api/drills/submit-review` is the canonical answer writer for real review scheduling. It owns `QuestionAttempt`, `ReviewLog`, `Card`, `UserProgress`, confusion-pair, and session-question linking side effects.
- FSRS updates run for `main`, `drill`, `targeted`, and omitted `sessionType`; `cram` and `rapid_recall` persist attempts but skip FSRS scheduling.
- Rapid guesses skip FSRS scheduling and return `fsrsSkippedReason: "rapid_guess"`.
- Missing condition linkage skips FSRS scheduling with `fsrsSkippedReason: "missing_condition_linkage"`; current serving routes filter those rows out before the learner sees them.
- `idempotencyKey` is persisted per user/endpoint for duplicate-safe retries and should be stable per submission.
