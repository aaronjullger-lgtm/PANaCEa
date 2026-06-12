# API Overview

This document tracks request/response contracts for actively maintained API routes,
with the most recent study-mode and review-pipeline contract changes listed first.

## Response Envelope

Non-streaming Cloudflare Pages Functions return the unified API envelope:

**Success**

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error**

```json
{
  "ok": false,
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Endpoint examples below show the `data` payload unless the envelope itself is
important to the contract.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/fetch` | Fetches approved, progress-linked pre-generated questions for the authenticated learner. |
| GET | `/api/questions/session` | Fetches a study-session question set from pool/main sources with blueprint, EOR, and identity metadata. |
| POST | `/api/questions/session` | Fetches a study-session question set using the JSON-body variant of the same session contract. |
| POST | `/api/drills/submit-review` | Submits one answer through the canonical implicit FSRS review pipeline. |
| POST | `/api/drills/submit-reviews` | Batch variant for offline/sync queues; each item uses the single-review schema and per-item result shape. |

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
      "conditionId": "condition-id-or-null",
      "medicalContentId": "medical-content-id-or-null",
      "difficulty": "medium",
      "questionType": "mcq",
      "validationStatus": "approved"
    }
  ],
  "source": "database",
  "count": 1,
  "needsGeneration": false,
  "generationNeeded": 0
}
```

The `questions` array contains `PreGeneratedQuestion` records. Consumers that
submit reviews must preserve the identity mapping:

```json
{
  "questionSource": "pre_generated",
  "canonicalQuestionId": null,
  "sourceQuestionId": "pre-generated-question-id"
}
```

**Error responses**

- `404` → `User not found`
- `500` → `Failed to fetch questions`

**Notes**

- User identity is resolved from Clerk auth; client-supplied `userId` is ignored.
- Learner-facing fetches are fail-closed to `validationStatus = "approved"`.
- Served questions must have `conditionId` or `medicalContentId` so review
  submissions can persist durable `ReviewLog` / `UserProgress` state.
- Already-seen questions for the requested `questionType` are excluded.
- `timesServed` increments asynchronously and is non-fatal if the update fails.

---

### `GET /api/questions/session`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Parameter | Type | Description |
|---|---:|---|
| `count` | stringified integer | Requested question count, capped at `50`; defaults to `10`. |
| `system` | string | Optional organ-system filter. Ignored for main-lane blueprint sessions. |
| `mode` | string | Session mode; commonly `standard`, `review`, or `weakness`. |
| `simulationStrict` | boolean string | `true`/`1` enforces strict PANCE blueprint behavior. |
| `eorMode` | boolean string | `true`/`1` routes to the EOR lane. |
| `eorDeadline` | ISO date string | Optional EOR deadline override. |
| `sessionLane` | `main` \| `eor` \| `drill` | Explicit lane override. |

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
      "rationale": "String rationale or structured rationale object",
      "system": "CV",
      "subcategory": "optional subcategory",
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
    "available": 20,
    "needsGeneration": false
  }
}
```

When no eligible questions are available, the response is still `200 OK` with an
`emptyState` object:

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

- If `eorMode` is true, the derived lane is `eor`.
- If no `system` filter is supplied, or `simulationStrict` is true, the derived
  lane is `main` and the service applies blueprint distribution.
- Pool questions are served only when `validationStatus = "approved"` and linked
  by `conditionId` or `medicalContentId`.
- Main-table questions are served only when `lifecycleStatus = "ACTIVE"`,
  `qaStatus = "APPROVED"`, and linked by `conditionId` or `medicalContentId`.
- `questionSource`, `canonicalQuestionId`, and `sourceQuestionId` are part of
  the contract. Clients must forward them to `/api/drills/submit-review(s)`.

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

**Success and error responses:** Same as `GET /api/questions/session`.

**Notes**

- `count` is validated as an integer from `1` to `50`.
- `mode` must be one of `standard`, `review`, `weakness`, `random`, or
  `interleaved` when present.
- `sessionLane` accepts `main`, `eor`, or `drill`.

---

### `POST /api/drills/submit-review`

**Auth:** Required (authenticated endpoint)

**CORS:** `OPTIONS` preflight is supported without auth.

**Request body**

```json
{
  "questionId": "rendered-question-id",
  "canonicalQuestionId": "canonical Question.id or null",
  "sourceQuestionId": "source table id",
  "questionSource": "pre_generated",
  "medicalContentId": "medical-content-id-or-null",
  "selectedAnswer": "A",
  "timeSpentMs": 42000,
  "timeToFirstClick": 5000,
  "answerSwitches": 1,
  "totalDwellTime": 38000,
  "timezone": "America/New_York",
  "wakeTimeHHMM": "06:30",
  "sessionType": "drill",
  "idempotencyKey": "review-unique-key",
  "telemetry": {
    "duration_ms": 42000,
    "time_to_first_interaction_ms": 5000,
    "rapid_guess": false,
    "question_type": "vignette",
    "mvrt_threshold_ms": 3000,
    "question_displayed_at": "2026-01-01T00:00:00.000Z",
    "answer_submitted_at": "2026-01-01T00:00:42.000Z",
    "answer_changes": 1,
    "hint_viewed": false,
    "hint_view_duration_ms": null,
    "session_id": "study-session-id",
    "option_interactions": []
  }
}
```

Required fields are `questionId`, `selectedAnswer`, and `timeSpentMs`.
`selectedAnswer` can be a string or number. `questionSource` can be `question`,
`pre_generated`, `staging`, `seed`, or `generated`. `sessionType` can be `main`,
`drill`, `targeted`, `cram`, or `rapid_recall`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "isCorrect": true,
  "quality": 4,
  "parTimeMs": 60000,
  "timeSpentMs": 42000,
  "implicitMetrics": {
    "rating": 1,
    "gradeContinuous": 0.86,
    "confidence": 0.82,
    "latencyRatio": 0.7,
    "answerSwitches": 1
  },
  "circadian": {
    "phase": "neutral",
    "stabilityModifier": 1,
    "localHour": 14
  },
  "fsrsSchedule": {
    "intervalDays": 3,
    "nextDueDate": "2026-01-04T00:00:00.000Z",
    "stability": 3.2,
    "difficulty": 5.1
  },
  "mastery": {
    "wilsonLower": 0.71,
    "wilsonUpper": 0.94,
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
    "nextDueDate": "2026-01-04T00:00:00.000Z",
    "stability": 3.2,
    "difficulty": 5.1
  },
  "drillFeedback": {}
}
```

`fsrsSkippedReason` is present only when scheduling is skipped. Valid values are
`session_type_excluded`, `rapid_guess`, `missing_condition_linkage`, and
`fsrs_update_failed`.

**Error responses**

- `404` → `Question not found`
- `409` → `Submission is still processing. Retry shortly.` with
  `Retry-After` and `details.retryAfterSeconds`
- `500` → `Failed to submit review`
- `504` → `Failed to submit review` with code `SUBMISSION_TIMEOUT`

**Notes**

- The endpoint resolves source identity in this order:
  `PreGeneratedQuestion`, `Question`, then latest `QuestionAttempt` fallback.
- `idempotencyKey` is optional but recommended for retries/offline sync. Completed
  submissions are replayed from persistent idempotency storage; in-progress
  duplicates return `409`.
- `main`, `drill`, and `targeted` submissions are FSRS-eligible. `cram`,
  `rapid_recall`, rapid guesses, and unlinked questions persist the attempt but
  skip scheduling.
- If telemetry includes `session_id`, the corresponding reservoir item is marked
  consumed after a successful review.

---

### `POST /api/drills/submit-reviews`

**Auth:** Required (authenticated endpoint)

**CORS:** `OPTIONS` preflight is supported without auth.

**Request body**

An array of `/api/drills/submit-review` request objects:

```json
[
  {
    "questionId": "rendered-question-id",
    "sourceQuestionId": "source table id",
    "questionSource": "question",
    "selectedAnswer": "B",
    "timeSpentMs": 35000,
    "sessionType": "main",
    "idempotencyKey": "review-unique-key"
  }
]
```

**Success response (`200 OK`)**

```json
[
  {
    "questionId": "rendered-question-id",
    "success": true,
    "data": {
      "success": true,
      "isCorrect": false,
      "quality": 1
    },
    "source": "main_question"
  },
  {
    "questionId": "other-question-id",
    "success": false,
    "error": "Question not found",
    "source": "missing"
  }
]
```

Per-item `source` can be `pre_generated`, `main_question`, `question_attempt`,
`missing`, `idempotent-store`, or `idempotent-in-progress`.

**Error responses**

- `500` → `Failed to submit reviews`

**Notes**

- Batch submission is used by offline/sync queues. Each item has independent
  idempotency and failure handling.
- Successful per-item `data` uses the same core result shape as
  `/api/drills/submit-review`, but the batch endpoint does not add the singular
  endpoint's `nextReview`, `isRapidGuess`, or `drillFeedback` convenience fields.

---

## Previously Documented Route Contracts

The contracts below predate the current study-mode repair documentation pass and
are retained for reference.

### `GET /api/admin/check-access`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "hasAccess": true,
  "role": "admin",
  "userId": "string",
  "email": "optional-string"
}
```

`role` can be `admin` or `superadmin`.

**Error responses**

- `403` → `{ "success": false, "hasAccess": false, "message": "Forbidden - Admin access required" }`
- `500` → `{ "error": "Internal server error", "hasAccess": false }`

**Notes**

- Access is resolved in this order: `SUPERADMIN_USER_IDS`/`ADMIN_USER_IDS` env values first, then database role lookup.

---

### `GET /api/admin/stats`

**Auth:** Required (admin-authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "data": {
    "totalUsers": 0,
    "activeUsersToday": 0,
    "totalStudySessions": 0,
    "averageAccuracy": 0,
    "popularSystems": [
      {
        "system": "string",
        "count": 0
      }
    ],
    "pendingFlags": 0
  }
}
```

**Error responses**

- `403` → `{ "error": "Admin access required" }`
- `500` → `{ "error": "Failed to fetch admin stats" }`

**Notes**

- If `DATABASE_URL` is missing, returns zeroed stats with `note: "Database not configured"`.

---

### `POST /api/osce/complete`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "string (optional)",
    "treatmentPlan": "string (optional)",
    "soapComparison": {},
    "timingAnalytics": {},
    "infographics": ["string"]
  }
}
```

**Success responses**

- `200 OK` → `{ "success": true }`
- `200 OK` (idempotent repeat) → `{ "success": true, "alreadyCompleted": true }`

**Error responses**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- Creates `CaseFile` on a best-effort basis when `soapComparison` or `timingAnalytics` is provided.
- `CaseFile` creation failure is logged but does not fail completion.

---

### `GET /api/osce/stats`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "totalEncounters": 0,
  "passRate": 0,
  "averageScore": 0,
  "averageClinicalReasoningScore": 0,
  "trend": [
    {
      "sessionId": "string",
      "date": "2026-01-01T00:00:00.000Z",
      "score": 0,
      "clinicalReasoningScore": 0
    }
  ]
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to load OSCE stats" }`

**Notes**

- Metrics are computed from completed `PatientEncounterSession` rows that have an `OsceResult`.
- Pass threshold is score `>= 70`.
