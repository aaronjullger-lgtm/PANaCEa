# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All successful responses are wrapped in the unified envelope: `{ ok: true, data, traceId, timestamp }` (see `functions/api/_shared/api-response.ts`). Examples below show the `data` payload unless noted.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/analytics/soap-note` | Stores SOAP note grading analytics for OSCE sessions. |
| POST | `/api/push/subscribe` | Registers a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription and disables push when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Max items to return; clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS progress partition (case-insensitive). |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext`. |

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
      "dueDate": "2026-04-01T00:00:00.000Z",
      "overdueDays": 0,
      "priority": 0
    }
  ],
  "totalDue": 0,
  "timestamp": "2026-04-07T12:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": "READINESS | TARGETED | null",
  "suppressedDuplicates": 0
}
```

**Degraded response (`200 OK`, never `500`)**

On internal errors the handler returns an empty queue instead of throwing:

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-04-07T12:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Validation errors**

- `400` → invalid `progressContext` / `context` enum value.

**Notes**

- Reads from canonical `Card`, `UserTopicProgress`, and `UserProgress` stores (legacy `SRSItem` is deprecated).
- Due `Card` rows are filtered to linked questions with `lifecycleStatus=ACTIVE` and `qaStatus=APPROVED`.
- Duplicate condition/task rows are suppressed (`card` > `user_topic_progress` > `user_progress` specificity).
- Dashboard consumers depend on stable top-level keys `items`, `totalDue`, and `timestamp` (pinned in `functions/api/srs/due.test.ts`).

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body**

Flat JSON (middleware also accepts a `{ "body": { ... } }` wrapper):

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 82,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation (Zod `.strict()`)**

- `caseId`: non-empty string, max 200 characters.
- `totalScore`: finite number, `0`–`100_000`.
- `breakdown`: string-keyed record (arbitrary JSON values).
- Unknown fields at any level are rejected.

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation failure (malformed score, empty/oversized `caseId`, unknown fields).
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Validation (Zod `.strict()`)**

- `endpoint`: valid URL, max 2048 characters.
- `keys.p256dh` / `keys.auth`: non-empty strings, max 512 characters each.
- Unknown fields rejected at top level and inside `keys`.

**Success response (`200 OK`)**

```json
{
  "message": "Subscription stored"
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized keys/endpoint, unknown fields).

**Notes**

- Upserts `PushSubscription` by `(userId, endpoint)`.
- Sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

**Validation (Zod `.strict()`)**

- `endpoint`: valid URL, max 2048 characters.
- Unknown fields rejected.

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

**Error responses**

- `400` → validation failure.

**Notes**

- Deletes the matching `(userId, endpoint)` row.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body**

All fields optional; defaults applied when omitted:

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "condition-uuid"
  }
}
```

**Validation (Zod `.strict()`)**

- `count`: integer `1`–`25` (default `10`).
- `examType`: `PANCE` \| `PANRE` \| `EOR` (default `PANCE`).
- `scopeFilter.system`: optional string, max 100 characters.
- `scopeFilter.conditionId`: optional string, max 200 characters.
- Unknown fields rejected at top level and inside `scopeFilter`.

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {},
      "isVariant": false,
      "isSecondChance": false,
      "recognitionRisk": 0,
      "selectionMethod": "unused_variant",
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

**Empty queue (`200 OK`)**

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

**Error responses**

- `400` → validation failure.
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Hydrates question content from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).
