# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All non-streaming responses use the unified envelope:

- **Success:** `{ "ok": true, "data": { ... }, "traceId": "string", "timestamp": "ISO-8601" }`
- **Error:** `{ "ok": false, "error": { "code": "string", "message": "string" }, "traceId": "string", "timestamp": "ISO-8601" }`

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP-note grading analytics for the authenticated user. |
| POST | `/api/feedback/submit` | Submits question feedback / content flags (creates a `QuestionFlag` record). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription and disables push when none remain. |
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

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (invalid/missing fields, unknown keys, non-finite score)
- `500` → `{ "error": { "message": "Failed to store SOAP grading analytics" } }`

**Notes**

- Schema: `SoapNoteSchema` — `.strict()` body; `caseId` length 1–200; `totalScore` must be finite, 0–100,000; `breakdown` is a string-keyed record.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).

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

**Success response (`201 Created`)**

```json
{
  "ok": true,
  "data": {
    "success": true,
    "feedbackId": "flag-1234567890-abc1234"
  },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (empty/oversized fields, invalid `flagType`, unknown keys)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- Schema: `FeedbackSubmitSchema` — `.strict()` body; all free-text fields length-bounded because they are persisted to `QuestionFlag`.
- `incorrect_fact` flags are stored with `priority: "high"`; other types use `priority: "medium"`.
- Used by the flag-question flow (`FlagQuestionModal`).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized endpoint/keys, unknown keys)

**Notes**

- Schema: `subscribeSchema` — `.strict()` top-level and nested `keys` object.
- Upserts `PushSubscription` by `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- See `functions/api/cron/push-reminders.ts` for scheduled delivery.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc (URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, unknown keys)

**Notes**

- Schema: `unsubscribeSchema` — `.strict()`.
- Deletes matching `PushSubscription` rows; disables `pushNotifications` when no subscriptions remain.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (all fields optional; defaults applied)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV (optional, max 100 chars)",
    "conditionId": "string (optional, max 200 chars)"
  }
}
```

| Field | Type | Default | Constraints |
|---|---|---|---|
| `count` | integer | `10` | 1–25 |
| `examType` | enum | `PANCE` | `PANCE`, `PANRE`, `EOR` |
| `scopeFilter.system` | string | — | max 100 chars |
| `scopeFilter.conditionId` | string | — | max 200 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
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
          "isOverdue": true
        },
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "string",
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
  },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Empty due queue (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown keys)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Schema: `SecondChanceRequestSchema` — `.strict()` top-level and nested `scopeFilter`.
- Hydrates questions from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to 1–200 |
| `progressContext` | enum | — | `READINESS` or `TARGETED` (case-insensitive) |
| `context` | enum | — | Alias for `progressContext` |

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
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
    "progressContext": "READINESS | null",
    "suppressedDuplicates": 0
  }
}
```

**Degraded response (`200 OK`, never `500`)**

When the database is unavailable, returns an empty queue with a user-safe message:

```json
{
  "ok": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-01-01T00:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Legacy compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (not deprecated `SRSItem`).
- Card rows are filtered to `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or UserTopicProgress row already covers the same condition/context.
- Dashboard contract (stable keys): `items`, `totalDue`, `timestamp` always present; each item includes `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, `priority`.
