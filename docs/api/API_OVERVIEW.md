# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/drills/submit-review` | Submits one drill review, resolves question source, and returns correctness plus scheduling feedback. |
| POST | `/api/drills/submit-reviews` | Submits a batch of drill reviews and returns per-item success/error results. |
| POST | `/api/questions/attempt` | Records a question attempt and updates attempt-driven analytics, seen tracking, and optional scheduling state. |

## Endpoint Contracts

### `POST /api/drills/submit-review`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "questionId": "string",
  "selectedAnswer": "string-or-number",
  "timeSpentMs": 12000,
  "timeToFirstClick": 3000,
  "answerSwitches": 1,
  "totalDwellTime": 14500,
  "timezone": "America/New_York",
  "wakeTimeHHMM": "07:30",
  "sessionType": "main",
  "telemetry": {
    "duration_ms": 12000,
    "time_to_first_interaction_ms": 3000,
    "rapid_guess": false,
    "question_type": "vignette",
    "mvrt_threshold_ms": 2000,
    "question_displayed_at": "2026-03-19T12:00:00.000Z",
    "answer_submitted_at": "2026-03-19T12:00:12.000Z",
    "answer_changes": 1,
    "hint_viewed": false,
    "hint_view_duration_ms": null
  }
}
```

`questionId` accepts both database IDs and non-empty ephemeral/generated IDs.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "isCorrect": true,
  "quality": 4,
  "parTimeMs": 18000,
  "timeSpentMs": 12000,
  "implicitMetrics": {
    "rating": 3,
    "gradeContinuous": 3.4,
    "confidence": 0.81,
    "latencyRatio": 0.67,
    "answerSwitches": 1
  },
  "circadian": {
    "phase": "peak",
    "stabilityModifier": 1.05,
    "localHour": 9
  },
  "fsrsSchedule": {
    "intervalDays": 3,
    "nextDueDate": "2026-03-22T12:00:00.000Z",
    "stability": 1.42,
    "difficulty": 4.91
  },
  "isRapidGuess": false,
  "nextReview": {
    "intervalDays": 3,
    "nextDueDate": "2026-03-22T12:00:00.000Z",
    "stability": 1.42,
    "difficulty": 4.91
  }
}
```

`fsrsSchedule`/`nextReview` can be `null`/omitted when scheduling is skipped (e.g., cram, rapid recall, rapid guess, or missing condition context).

**Error responses**

- `400` → `{ "error": "Validation failed: ..." }`
- `401` → `{ "error": "Authentication required" }`
- `404` → `{ "error": "User not found" }` or `{ "error": "Question not found" }`
- `500` → `{ "error": "Database not configured" }` or `{ "error": "Failed to submit review" }`

**Notes**

- Question resolution order is: `PreGeneratedQuestion` → `Question` → latest `QuestionAttempt` fallback.
- Fallback resolution supports ephemeral IDs by synthesizing minimal question data from the user’s latest attempt.
- `sessionType` supports `main`, `cram`, and `rapid_recall` (defaults to main behavior when omitted).

---

### `POST /api/drills/submit-reviews`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
[
  {
    "questionId": "string",
    "selectedAnswer": "string-or-number",
    "timeSpentMs": 9000,
    "sessionType": "main",
    "telemetry": {
      "duration_ms": 9000,
      "rapid_guess": false,
      "question_type": "recall",
      "mvrt_threshold_ms": 2000,
      "question_displayed_at": "2026-03-19T12:00:00.000Z",
      "answer_submitted_at": "2026-03-19T12:00:09.000Z",
      "answer_changes": 0,
      "hint_viewed": false,
      "hint_view_duration_ms": null
    }
  }
]
```

Each array item uses the same request schema as `POST /api/drills/submit-review`.

**Success response (`200 OK`)**

```json
[
  {
    "questionId": "q-1",
    "success": true,
    "source": "pre_generated",
    "data": {
      "success": true,
      "isCorrect": true,
      "quality": 4
    }
  },
  {
    "questionId": "seed-ephemeral-1",
    "success": false,
    "source": "missing",
    "error": "Question not found"
  }
]
```

Per-item `source` can be `pre_generated`, `main_question`, `question_attempt`, or `missing`.

**Error responses**

- `400` → `{ "error": "Validation failed: ..." }`
- `401` → `{ "error": "Authentication required" }`
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Database not configured" }` or `{ "error": "Failed to submit reviews" }`

**Notes**

- Batch processing is best-effort: one item failing does not fail the entire batch.
- The endpoint always returns per-item statuses for client-side retry/error handling.

---

### `POST /api/questions/attempt`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "body": {
    "questionId": "string",
    "isCorrect": true,
    "wasCorrect": true,
    "system": "Cardiology",
    "conditionId": "condition-id",
    "medicalContentId": "medical-content-id",
    "questionType": "diagnosis",
    "mode": "session",
    "timeSpentMs": 12000,
    "answerChangedCount": 1,
    "isRankedAttempt": false,
    "selectedAnswer": "B",
    "telemetryJson": {
      "time_to_first_interaction_ms": 2800,
      "answer_changes": 1
    },
    "durationMs": 12000,
    "isMainSession": true,
    "rating": 3
  }
}
```

`selectedAnswer` accepts either `0..3` or `A..D`.  
`isCorrect` and `wasCorrect` are both supported for compatibility.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "attemptId": "attempt-user-question-1710849600000",
  "stats": {
    "totalQuestionsAnswered": 120,
    "correctAnswers": 89,
    "overallAccuracy": 74
  },
  "systemStats": {
    "system": "Cardiology",
    "totalAttempts": 42,
    "correctAttempts": 31,
    "accuracy": 74,
    "recentTrend": "improving"
  },
  "nextReviewDate": "2026-03-24T09:00:00.000Z"
}
```

`nextReviewDate` is optional and is present when FSRS scheduling runs.

**Error responses**

- `400` → `{ "error": "Validation failed: ..." }`
- `401` → `{ "error": "Authentication required" }`
- `404` → `{ "error": "User not found", "message": "Account not synced yet." }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- Writes `QuestionAttempt` and upserts `UserQuestionSeen` in a transaction.
- Updates Rolling 360 only when `isMainSession` is `true`.
- Supports behavior-derived FSRS updates using telemetry and timing signals.
