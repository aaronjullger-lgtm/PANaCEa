# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for a case. |
| POST | `/api/feedback/submit` | Submits authenticated question feedback; creates a `QuestionFlag` record. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

Unknown top-level or body fields are rejected (`.strict()`). `totalScore` must be finite, `0`–`100000`.

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation error (invalid/missing fields, NaN/Infinity score, oversized `caseId`)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token.
- Persistence to `SoapNoteGradingEvent` is best-effort; if the model is absent, the endpoint still returns success and logs the skip.

---

### `POST /api/feedback/submit`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "questionId": "string (1–200 chars)",
  "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
  "description": "string (1–2000 chars)",
  "questionText": "string (optional, max 5000)",
  "topic": "string (optional, max 200)",
  "system": "string (optional, max 100)"
}
```

Unknown fields are rejected (`.strict()`).

**Success response (`201 Created`)**

```json
{
  "success": true,
  "feedbackId": "flag-..."
}
```

**Error responses**

- `400` → validation error (empty/oversized fields, invalid `flagType`, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- Creates a `QuestionFlag` with `status: "pending"`.
- `incorrect_fact` flags receive `priority: "high"`; all others default to `"medium"`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://... (valid URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

Unknown top-level or `keys` fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "message": "Subscription stored"
}
```

**Error responses**

- `400` → validation error (non-URL endpoint, oversized endpoint/keys, unknown fields)

**Notes**

- Upserts on `(userId, endpoint)`; updates `p256dh`/`auth` when the endpoint already exists.
- Sets `UserPreferences.pushNotifications` to `true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://... (valid URL, max 2048 chars)"
}
```

Unknown fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

**Error responses**

- `400` → validation error (non-URL endpoint, oversized endpoint, unknown fields)

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications` to `false`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (all fields optional)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "string (optional, max 100)",
    "conditionId": "string (optional, max 200)"
  }
}
```

Defaults: `count` = `10` (range 1–25), `examType` = `"PANCE"` (`PANCE` | `PANRE` | `EOR`). Unknown top-level or `scopeFilter` fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {
        "conditionId": "string",
        "taskType": "string",
        "system": "string",
        "stability": 0,
        "difficulty": 0,
        "lapses": 0,
        "isOverdue": true,
        "priorityScore": 0
      },
      "isVariant": false,
      "isSecondChance": false,
      "recognitionRisk": 0,
      "selectionMethod": "unused_variant | different_question | cross_task_fallback | canonical_fallback",
      "question": {
        "source": "pre_generated | main_question",
        "id": "string",
        "conditionId": "string",
        "system": "string",
        "difficulty": "string",
        "questionType": "string",
        "questionData": {}
      }
    }
  ],
  "meta": {
    "total": 0,
    "withVariants": 0,
    "withSecondChance": 0,
    "examType": "PANCE"
  }
}
```

When nothing is due:

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

**Error responses**

- `400` → validation error (`count` out of range, invalid `examType`, oversized `scopeFilter`, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Question content is hydrated from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `limit` | string (optional) | Parsed to integer, clamped to `1`–`200` (default `100`). |
| `progressContext` | `READINESS` \| `TARGETED` (optional) | Filter due rows by FSRS progress partition. |
| `context` | alias of `progressContext` | Same filter; `progressContext` wins when both are set. |

**Success response (`200 OK`)**

```json
{
  "items": [
    {
      "id": "string",
      "source": "card | user_topic_progress | user_progress",
      "questionId": "string | null",
      "questionIdentityId": "string | null",
      "conditionId": "string | null",
      "taskType": "string | null",
      "progressContext": "READINESS | TARGETED | null",
      "dueDate": "2026-01-01T00:00:00.000Z",
      "overdueDays": 0,
      "priority": 0
    }
  ],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": "READINESS | TARGETED | null",
  "suppressedDuplicates": 0
}
```

**Resilient empty response (on internal error — never `500`)**

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Compatibility read model over canonical FSRS stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not used.
- Due `Card` rows require linked `Question` with `lifecycleStatus: "ACTIVE"` and `qaStatus: "APPROVED"`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific card or topic row already covers the same condition/context.
