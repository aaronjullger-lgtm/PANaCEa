# API Overview

This document is the current API surface reference for recently changed question, streak, gamification, telemetry, and tutor-session endpoints.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/gamification/phantom-patient` | Fetches current phantom patient state and computes decay/status from last interaction. |
| POST | `/api/gamification/phantom-patient` | Heals and updates phantom patient state after study activity. |
| POST | `/api/questions/seeds` | Creates a new reusable question seed (admin-only). |
| POST | `/api/questions/staging` | Saves generated question payload to staging for validation/promote pipeline (admin-only). |
| POST | `/api/streaks/use-freeze` | Consumes one streak freeze for a specified date (not future). |
| POST | `/api/user/behavior-metrics` | Stores implicit interaction telemetry for a question attempt. |
| GET | `/api/user/behavior-metrics` | Retrieves a user’s behavior telemetry with pagination/filtering. |
| POST | `/api/questions/due-siblings` | Returns concept-matched sibling variants for due review items. |
| GET | `/api/reference/normal-labs` | Returns normal lab reference values for in-session lookup. |
| GET | `/api/intelligence/profile` | Returns concept-gap aggregates and tutor context string. |
| POST | `/api/user/session` | Starts a study session record. |
| PATCH | `/api/user/session` | Updates or ends an existing study session record. |

---

## Endpoint Contracts

### `GET /api/gamification/phantom-patient`

**Auth:** Required

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "patient": {
      "id": "string",
      "healthState": 85,
      "status": "healthy",
      "daysSinceInteraction": 3
    }
  }
}
```

**Errors**
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Internal server error" }`

> If no patient exists yet, the endpoint creates a default phantom patient and returns it.

### `POST /api/gamification/phantom-patient`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "heal": 10
  }
}
```

`heal` is optional and defaults to `10`.

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "patient": {}
  }
}
```

**Errors**
- `404` → `{ "error": "Phantom patient not found" }`
- `500` → `{ "error": "Internal server error" }`

---

### `POST /api/questions/seeds`

**Auth:** Required (admin endpoint)

**Request body** (no outer `body` wrapper)

```json
{
  "conditionId": "string",
  "questionType": "string",
  "corePathology": "string",
  "variables": {},
  "template": "string",
  "correctAnswer": "string",
  "explanation": "string",
  "distractors": ["string"],
  "difficulty": "string",
  "system": "string"
}
```

`system` is optional.

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "seed": {}
  }
}
```

### `POST /api/questions/staging`

**Auth:** Required (admin endpoint)

**Request body** (no outer `body` wrapper)

```json
{
  "questionData": {}
}
```

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "stagingQuestion": {}
  }
}
```

---

### `POST /api/streaks/use-freeze`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "date": "2026-03-17"
  }
}
```

`date` must be `YYYY-MM-DD` and cannot be a future date.

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "date": "2026-03-17",
    "streakFreezesRemaining": 2
  }
}
```

**Errors**
- `400` → invalid date, future date, or no freezes available
- `500` → generic failure

---

### `POST /api/user/behavior-metrics`

**Auth:** Required

**Request body** (flat payload, no outer `body` wrapper)

```json
{
  "questionId": "string",
  "questionType": "string",
  "timeToFirstClick": 0,
  "dwellTime": 0,
  "totalResponseTime": 0,
  "wasCorrect": true,
  "confidenceLevel": 0.7,
  "derivedRating": 3
}
```

Additional optional telemetry fields are supported (`answerChanges`, `optionHovers`, `scrollDepth`, `hesitationEvents`, `backtrackCount`, `ratingConfidence`, `trajectoryData`, `typingRhythm`).

**Success (`201`)**

```json
{
  "data": {
    "id": "string",
    "message": "Behavior metrics stored successfully"
  }
}
```

**Errors**
- `404` → `{ "error": "User not found" }`
- `500` → generic failure

### `GET /api/user/behavior-metrics`

**Auth:** Required

**Query params**
- `limit` (optional, max 500)
- `offset` (optional)
- `questionId` (optional filter)

**Success (`200`)**

```json
{
  "data": {
    "metrics": [],
    "pagination": {
      "total": 120,
      "limit": 100,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## Related Endpoint Contracts Used by Updated UI/Shared API Code

### `POST /api/questions/due-siblings`

**Auth:** Required

**Request body**

```json
{
  "dueItems": [
    {
      "conditionId": "string",
      "taskType": "string or null",
      "originalQuestionId": "string"
    }
  ]
}
```

**Success (`200`)**

```json
{
  "data": {
    "results": [
      {
        "question": {},
        "dueConceptKey": {
          "conditionId": "string",
          "taskType": "string or null"
        }
      }
    ]
  }
}
```

`question` may be `null` when no sibling variant is available.

### `GET /api/reference/normal-labs`

**Auth:** Required

**Query params**
- `category` (optional)
- `limit` (optional, defaults to 200, max 500)

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "labs": []
  }
}
```

### `GET /api/intelligence/profile`

**Auth:** Required

**Success (`200`)**

```json
{
  "data": {
    "conceptGaps": {
      "bySystem": {},
      "byTask": {},
      "gaps": []
    },
    "tutorContext": "Student Weaknesses: ..."
  }
}
```

### `POST /api/user/session`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "sessionType": "mixed",
    "systemsTargeted": []
  }
}
```

**Success (`200`)** returns `data.session.id`, `sessionType`, `startedAt`.

### `PATCH /api/user/session`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "action": "update",
    "questionsAnswered": 10,
    "correctCount": 7,
    "thinkingTimeMs": 1800
  }
}
```

`action` is `update` or `end`. Success returns the updated session summary.
