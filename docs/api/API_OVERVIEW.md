# API Overview

This document tracks request/response contracts for the most recently changed API surface.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/content/library` | Returns filtered clinical library cards with optional full-text search ranking. |
| POST | `/api/questions/attempt` | Records a question attempt and updates user/question analytics and review scheduling. |

## Shared Behavior (Both Routes)

- **Auth required** via `Authorization: Bearer <Clerk session token>`.
- **Middleware stack** enforces:
  - `DATABASE_URL` + `CLERK_SECRET_KEY` present
  - request validation via Zod
  - rate limit (default `300` requests/minute per authenticated identity)
  - CORS + `OPTIONS` preflight handling
- **Common error envelopes**:
  - Middleware validation/auth/rate-limit errors return top-level JSON:
    - `{"error":"Validation failed: ..."}`
    - `{"error":"Authentication required"}`
    - `{"error":"Too many requests. Please try again later."}`
  - Missing env configuration returns:
    - `{"success":false,"error":{"code":"MISSING_ENVIRONMENT_CONFIG","message":"Server configuration error. Required environment variables are missing."}}`

---

## `GET /api/content/library`

**Auth:** Required  
**Body:** None (query-string endpoint)

### Query parameters

| Param | Type | Required | Notes |
|---|---|---|---|
| `system` | string | No | When omitted or `all`, no system filter is applied. |
| `subcategory` | string | No | Exact subcategory filter. |
| `search` | string | No | Trimmed and capped to 200 chars server-side. |
| `highYield` | string | No | `true` filters to `pance_yield >= 3`. |
| `page` | string | No | Accepted by schema (currently no pagination logic). |
| `pageSize` | string | No | Accepted by schema (currently no pagination logic). |

### Success response (`200 OK`)

```json
{
  "content": [
    {
      "id": "string",
      "condition": "Atrial Fibrillation",
      "conditionId": "atrial-fibrillation",
      "system": "CARDIOVASCULAR",
      "subcategory": "Arrhythmias",
      "pance_yield": 4,
      "classic_patient": "string-or-array",
      "buzzwords": ["string"],
      "overview": "string"
    }
  ],
  "count": 1
}
```

### Error responses

- `401` → `{"error":"Authentication required"}`
- `503` (DB not configured) → `{"error":"Library unavailable","message":"Database is not configured."}`
- `503` (runtime/query failure) →  
  `{"error":"failed_to_load_library","message":"Clinical content temporarily unavailable. Please try again later.","error_code":"failed_to_load_library","content":[],"count":0}`

### Notes

- Full-text search uses `search_vector @@ websearch_to_tsquery('english', search)`.
- If FTS errors or yields no rows, endpoint falls back to case-insensitive `contains` matching across `condition`, `overview`, and `classic_patient`.
- Successful responses include `Cache-Control: public, max-age=3600`.
- KV cache (TTL 1 hour) is used only when `search` is not present.

---

## `POST /api/questions/attempt`

**Auth:** Required

### Request body

> This handler validates a `body` envelope.

```json
{
  "body": {
    "questionId": "string",
    "isCorrect": true,
    "wasCorrect": true,
    "system": "CARDIOVASCULAR",
    "conditionId": "atrial-fibrillation",
    "medicalContentId": "string",
    "questionType": "diagnosis",
    "mode": "session",
    "timeSpent": 21000,
    "timeSpentMs": 21000,
    "answerChangedCount": 1,
    "isRankedAttempt": false,
    "selectedAnswer": 2,
    "telemetryJson": {},
    "durationMs": 21000,
    "isMainSession": true,
    "rating": 3
  }
}
```

### Field notes

- `isCorrect` and `wasCorrect` are both accepted; endpoint uses whichever is provided.
- `selectedAnswer` accepts either numeric index `0..3` or `"A" | "B" | "C" | "D"`.
- `rating` accepts integers `1..4` (FSRS scale).

### Success response (`200 OK`)

```json
{
  "success": true,
  "attemptId": "attempt-user-question-timestamp",
  "stats": {
    "totalQuestionsAnswered": 120,
    "correctAnswers": 89,
    "overallAccuracy": 74
  },
  "systemStats": {
    "system": "CARDIOVASCULAR",
    "totalAttempts": 25,
    "correctAttempts": 18,
    "accuracy": 72,
    "recentTrend": "improving"
  },
  "nextReviewDate": "2026-03-18T18:23:11.000Z"
}
```

`nextReviewDate` is returned when FSRS scheduling runs for the attempt.

### Error responses

- `400` → `{"error":"Validation failed: ..."}`
- `401` → `{"error":"Authentication required"}`
- `404` → `{"error":"User not found","message":"Account not synced yet."}`
- `500` → `{"error":"Internal server error"}`

### Side effects

- Writes `QuestionAttempt`.
- Upserts `UserQuestionSeen` and updates per-user aggregates.
- Best-effort updates of question-level counters.
- Best-effort SRS scheduling (`scheduleConceptReview`, FSRS `UserTopicProgress` updates).
- Best-effort Rolling 360 update when `isMainSession=true`.
