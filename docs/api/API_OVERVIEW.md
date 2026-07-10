# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All non-streaming endpoints return the **unified envelope** (`functions/api/_shared/api-response.ts`):

- **Success:** `{ ok: true, data, traceId, timestamp, message? }`
- **Error:** `{ ok: false, error: { code, message, details? }, traceId, timestamp }`

The sections below describe the `data` payload (or top-level error) unless noted otherwise.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/feedback/submit` | Submit authenticated question feedback; creates a `QuestionFlag` record. |
| POST | `/api/push/subscribe` | Store or update a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription; disables push preference when none remain. |
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP note grading analytics (best-effort). |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Fetch canonical FSRS due items (Card, UserTopicProgress, UserProgress compatibility read). |

## Endpoint Contracts

### `POST /api/feedback/submit`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON or `{ "body": { ... } }` — middleware accepts both)

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

**Validation:** `.strict()` — unknown fields rejected. All free-text fields are length-bounded.

**Success response (`201 Created`)**

```json
{
  "success": true,
  "feedbackId": "flag-<timestamp>-<random>"
}
```

**Error responses**

- `400` → validation failure (`Validation failed: …`)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- `incorrect_fact` flags are stored with `priority: high`; other types use `medium`.
- Persists to `QuestionFlag` with `status: pending`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://… (valid URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Validation:** `.strict()` on top-level and `keys` object.

**Success response (`200 OK`)**

```json
{
  "message": "Subscription stored"
}
```

**Error responses**

- `400` → validation failure (invalid URL, oversized endpoint/keys, unknown fields)

**Notes**

- Upserts on `(userId, endpoint)` composite key.
- Sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://… (valid URL, max 2048 chars)"
}
```

**Validation:** `.strict()` — unknown fields rejected.

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

**Error responses**

- `400` → validation failure

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON or `{ "body": { … } }`)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {}
}
```

- `totalScore`: finite number, `0`–`100000`
- `breakdown`: record keyed by string (SOAP section scores/metadata)

**Validation:** `.strict()` on the body object — unknown fields rejected.

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation failure (empty/oversized `caseId`, NaN/Infinity score, unknown fields)
- `500` → `{ "error": { "message": "Failed to store SOAP grading analytics" } }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- `userId` is resolved from the Clerk token, not accepted from the client body.

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

- `count`: integer `1`–`25` (default `10`)
- `examType`: `PANCE` | `PANRE` | `EOR` (default `PANCE`)

**Validation:** `.strict()` on top-level and `scopeFilter` — unknown fields rejected.

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

**Empty due queue (`200 OK`)**

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, oversized scope, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Hydrates question content from `PreGeneratedQuestion` first, then `Question`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated rows.
- Powered by `lib/services/secondChanceEngine.ts`.

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `limit` | string (optional) | Max items to return; parsed as integer, clamped to `1`–`200` (default `100`). |
| `progressContext` | `READINESS` \| `TARGETED` (optional) | Filter due rows by FSRS progress partition. |
| `context` | `READINESS` \| `TARGETED` (optional) | Alias for `progressContext`. |

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
      "progressContext": "string | null",
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

**Resilient empty state (`200 OK` on handler error)**

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Compatibility read over `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` is deprecated).
- Card rows require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or `UserTopicProgress` row covers the same condition/context.
- Never returns HTTP 500 for DB errors — returns an empty `items` array with an error message in `data`.
