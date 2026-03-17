# API Overview

Canonical request/response reference for the recently changed API surface.

All routes below are Cloudflare Pages Functions under `functions/api/` and are protected by auth middleware unless noted otherwise.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/conditions/:conditionId/pearls` | Returns clinical pearls for a condition ID or slug-like identifier. |
| GET | `/api/sync` | Downloads authenticated user's synced performance/SRS/saved-question data. |
| POST | `/api/sync` | Uploads and merges local client data into cloud state, then returns merged data. |
| GET | `/api/user/preferences` | Fetches preferences; auto-creates a default preference row if none exists. |
| POST | `/api/user/preferences` | Creates or fully updates user preferences (upsert semantics). |
| PATCH | `/api/user/preferences` | Partially updates preferences (merges `customSettings` keys). |
| DELETE | `/api/user/preferences` | Resets preferences by deleting the preferences row. |
| GET | `/api/user/stats` | Returns aggregated analytics (overall, by-system, trend, speed, weak/strong areas). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally writes `CaseFile` analytics. |
| POST | `/api/osce/analysis/grade` | Grades a completed OSCE transcript and persists `OsceResult` (+ optional `ConceptGap`). |

## Endpoint Contracts

### `GET /api/conditions/:conditionId/pearls`

**Auth:** Required

**Path params**

- `conditionId: string` (UUID or slug-like identifier; decoded server-side)

**Success (`200`)**

```json
{
  "pearls": ["string"]
}
```

**Behavior notes**

- If no condition content is found, returns `200` with an empty `pearls` array.
- Reads `content.clinicalPearls` first, then falls back to `content.pearls`.

**Errors**

- `500` → `{ "error": "Failed to fetch clinical pearls" }`

---

### `GET /api/sync`

**Auth:** Required

**Request:** no body

**Success (`200`)**

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "performanceRecords": [
      {
        "id": "uuid",
        "topic": "string",
        "focus": "string",
        "isCorrect": true,
        "timestamp": 1700000000000
      }
    ],
    "srsItems": [],
    "savedQuestions": []
  }
}
```

**Errors**

- `500` → `{ "error": "Sync GET failed: <details>" }`

---

### `POST /api/sync`

**Auth:** Required

**Request body**

```json
{
  "userId": "clerk_user_id",
  "performanceRecords": [],
  "srsItems": [],
  "savedQuestions": []
}
```

**Validation highlights**

- `userId` required and must match authenticated Clerk user ID.
- `performanceRecords` max `1000`, `srsItems` max `1000`, `savedQuestions` max `500`.

**Success (`200`)**

```json
{
  "success": true,
  "message": "Data synced successfully",
  "data": {
    "performanceRecords": [],
    "srsItems": [],
    "savedQuestions": []
  }
}
```

**Errors**

- `400` → validation failure (`{ "error": "Validation failed: ..." }`)
- `403` → `{ "error": "User ID mismatch" }`
- `500` → `{ "error": "Sync POST failed: <details>" }`

---

### `GET /api/user/preferences`

**Auth:** Required

**Request:** no body

**Success (`200`)**

```json
{
  "success": true,
  "preferences": {
    "userId": "uuid",
    "dailyGoal": 20,
    "theme": "auto",
    "customSettings": {}
  }
}
```

**Errors**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Internal server error" }`

---

### `POST /api/user/preferences`

**Auth:** Required

**Request body**

Top-level preferences object (no `body` wrapper). All fields are optional; route upserts row for the authenticated user.

```json
{
  "dailyGoal": 25,
  "sessionLength": 45,
  "difficulty": "adaptive",
  "streakGoalDays": "weekdays",
  "customSettings": {
    "activeKnowledgeCacheName": "cardio"
  }
}
```

**Success (`200`)**

```json
{
  "success": true,
  "preferences": {},
  "message": "Preferences saved successfully"
}
```

**Errors**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Internal server error" }`

---

### `PATCH /api/user/preferences`

**Auth:** Required

**Request body**

Same shape as POST, partial updates allowed.

**Success**

- `200` → `{ "success": true, "preferences": {}, "message": "Preferences updated successfully" }`
- `201` → `{ "success": true, "preferences": {}, "message": "Preferences created successfully" }` (when row did not exist)

**Behavior notes**

- `customSettings` is merged with existing keys.
- `customSettings` keys set to `null` are removed.

**Errors**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Internal server error" }`

---

### `DELETE /api/user/preferences`

**Auth:** Required

**Request:** no body

**Success (`200`)**

```json
{
  "success": true,
  "message": "Preferences deleted successfully"
}
```

**Errors**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Internal server error" }`

---

### `GET /api/user/stats`

**Auth:** Required

**Request:** no body

**Success (`200`)**

```json
{
  "success": true,
  "stats": {
    "overall": {
      "totalAttempts": 0,
      "correctAttempts": 0,
      "accuracy": 0,
      "questionsSeenCount": 0,
      "currentStreak": 0
    },
    "bySystems": {},
    "byConditions": [],
    "weakAreas": [],
    "strongAreas": [],
    "recentPerformance": {
      "last7Days": { "attempts": 0, "accuracy": null },
      "previous7Days": { "attempts": 0, "accuracy": null },
      "trend": "insufficient_data"
    },
    "speedByType": {
      "recall": { "avgTimeMs": null, "count": 0 },
      "clinicalReasoning": { "avgTimeMs": null, "count": 0 }
    },
    "recommendations": []
  }
}
```

**Headers**

- `X-Cache: HIT|MISS`

**Errors**

- `404` → `{ "success": false, "error": "User not found - must be synced from Clerk webhook first" }`
- `503` → `{ "success": false, "error": "Analytics unavailable", "message": "..." }`
- `500` → `{ "success": false, "error": "Failed to fetch user stats", "message": "Please try again later." }`

---

### `POST /api/osce/complete`

**Auth:** Required

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

**Success**

- `200` → `{ "success": true }`
- `200` (idempotent repeat) → `{ "success": true, "alreadyCompleted": true }`

**Errors**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- `CaseFile` creation is best-effort when analytics payload is present.
- `CaseFile` write failures are non-blocking for session completion.

---

### `POST /api/osce/analysis/grade`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "sessionId": "string"
  }
}
```

**Success (`200`)**

```json
{
  "resultId": "string",
  "score": 0,
  "checklist": [
    {
      "item": "string",
      "status": "PASS",
      "feedback": "string"
    }
  ],
  "redFlagsMissed": ["string"],
  "clinicalReasoningScore": 0,
  "billingCodeSuggestion": "string",
  "softSkillsReport": {
    "empathy": { "score": 1, "feedback": "string" },
    "professionalism": { "score": 1, "feedback": "string" },
    "pacing": { "score": 1, "feedback": "string" }
  },
  "conceptGapCreated": false
}
```

**Error responses**

- `400` → `{ "error": "Session must be completed before grading" }`
- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }` or `{ "error": "Case record not found" }`
- `422` → `{ "error": "Invalid grading response format", "details": "..." }`
- `429` → `{ "error": "Rate limit exceeded" }`
- `502` → `{ "error": "Grading service failed" }` or `{ "error": "Invalid grading response format" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- If no `CaseRubric` exists, the endpoint builds a fallback checklist from case essentials/workup.
- Persists/updates `OsceResult` and may create/schedule a `ConceptGap` review item.
