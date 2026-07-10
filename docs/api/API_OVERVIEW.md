# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** 2026-07-10 (validation hardening pass — bounded Zod `.strict()` schemas on mutation endpoints; dashboard response-contract tests for `/api/srs/due`).

All authenticated routes use the standard middleware envelope on the wire:

```json
{
  "ok": true,
  "success": true,
  "data": { },
  "traceId": "string",
  "timestamp": "2026-07-10T00:00:00.000Z"
}
```

Validation failures return `400` with `ok: false` and a `Validation failed: …` message. Unknown fields are rejected when the schema uses `.strict()`.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Fetch canonical FSRS due items (Card, UserTopicProgress, UserProgress) for the authenticated user. |
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP-note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Store a Web Push subscription and enable push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |

---

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint, 300 req/min)

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Case-insensitive. Filters all progress stores. |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext`. |

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card | user_topic_progress | user_progress",
        "questionId": "string | null",
        "questionIdentityId": "string | null",
        "conditionId": "string | null",
        "taskType": "string | null",
        "progressContext": "string | null",
        "dueDate": "2026-07-10T00:00:00.000Z",
        "overdueDays": 0,
        "priority": 0
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "READINESS | TARGETED | null",
    "suppressedDuplicates": 0
  },
  "traceId": "string",
  "timestamp": "2026-07-10T00:00:00.000Z"
}
```

**Degraded response (still `200 OK`, never `500`)**

On internal errors the handler returns an empty, consumer-safe payload:

```json
{
  "ok": true,
  "success": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Legacy `SRSItem` is deprecated; this compatibility endpoint reads from `Card`, `UserTopicProgress`, and `UserProgress`.
- Card rows are filtered to `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED` linked questions only.
- Duplicate condition-level rows are suppressed when a more specific Card or UserTopicProgress row already covers the same condition/context.
- Dashboard/study-queue consumers depend on stable top-level keys `items`, `totalDue`, and `timestamp` on every response.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat or `{ "body": { … } }` — middleware accepts both)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation (`.strict()` on inner body)**

- `caseId`: non-empty string, max 200 characters.
- `totalScore`: finite number, `0`–`100000` (rejects `NaN`/`Infinity`).
- `breakdown`: string-keyed record (arbitrary JSON values per key).
- Unknown fields inside `body` are rejected.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-07-10T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (malformed score, empty/oversized `caseId`, unknown fields).
- `500` → `{ "error": "Failed to store SOAP grading analytics" }` on unexpected handler failure.

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Client: `lib/services/soapAnalyticsService.ts` posts flat `{ caseId, totalScore, breakdown }`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat, `.strict()`)

```json
{
  "endpoint": "https://push.example.com/… (valid URL, max 2048 chars)",
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
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-07-10T00:00:00.000Z"
}
```

**Error responses**

- `400` → non-URL endpoint, oversized endpoint/keys, or unknown fields.
- `401` → missing/invalid Clerk token.

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications: true`.
- Client: `hooks/usePushNotifications.ts`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat, `.strict()`)

```json
{
  "endpoint": "https://push.example.com/… (valid URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-07-10T00:00:00.000Z"
}
```

**Notes**

- Deletes matching `PushSubscription` rows for the user.
- Sets `UserPreferences.pushNotifications: false` when no subscriptions remain.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (flat, `.strict()`; all fields optional)

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

**Validation**

| Field | Default | Constraints |
|---|---|---|
| `count` | `10` | Integer `1`–`25`. |
| `examType` | `PANCE` | `PANCE` \| `PANRE` \| `EOR`. |
| `scopeFilter.system` | — | Max 100 characters. |
| `scopeFilter.conditionId` | — | Max 200 characters. |
| Unknown top-level or `scopeFilter` fields | — | Rejected (`.strict()`). |

**Success response (`200 OK`) — items due**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "unused_variant",
        "learningTarget": { },
        "question": {
          "source": "pre_generated | main_question",
          "id": "string",
          "conditionId": "string",
          "system": "string",
          "difficulty": "string",
          "questionType": "string",
          "questionData": { }
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
}
```

**Success response (`200 OK`) — nothing due**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown fields).
- `404` → `{ "error": "User not found" }`.
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`.

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts` (subdomain-level weakness targeting; does not modify FSRS).
- Hydrates from `PreGeneratedQuestion` first, then `Question`; increments `timesServed` on served pre-generated rows (fire-and-forget).
