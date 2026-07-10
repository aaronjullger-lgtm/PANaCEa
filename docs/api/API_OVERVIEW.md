# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All non-streaming responses use the unified envelope from `functions/api/_shared/api-response.ts`:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Validation failures return `400` with `ok: false` and a structured `error` object. Schemas use `.strict()` — unknown fields are rejected.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Fetch canonical FSRS due items for the authenticated user (compatibility read model). |
| POST | `/api/analytics/soap-note` | Store SOAP Note grading analytics for OSCE sessions. |
| POST | `/api/push/subscribe` | Register a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription. |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200` |
| `progressContext` | string | — | `READINESS` or `TARGETED` (case-insensitive) |
| `context` | string | — | Alias for `progressContext` |

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
}
```

**Degraded response (still `200 OK`)**

On internal errors the handler returns an empty queue instead of `500`:

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

- Reads from `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` is deprecated).
- Card rows are filtered to `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED` only.
- Duplicate suppression removes broader condition-level rows when a more specific card/topic row already covers the same condition/context.
- Dashboard consumers depend on stable top-level keys `items`, `totalDue`, and `timestamp` (pinned in `functions/api/srs/due.test.ts`).

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; middleware also accepts a `{ "body": { ... } }` wrapper)

```json
{
  "caseId": "string",
  "totalScore": 82,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation**

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 chars |
| `totalScore` | Finite number, `0`–`100000` |
| `breakdown` | Record of string keys to arbitrary JSON values |
| Unknown fields | Rejected (`.strict()` on body) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "success": true
  }
}
```

**Error responses**

- `400` → validation failure (invalid score, empty `caseId`, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (best-effort).
- Client: `lib/services/soapAnalyticsService.ts` sends flat `{ caseId, totalScore, breakdown }`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc",
  "keys": {
    "p256dh": "base64-key",
    "auth": "base64-key"
  }
}
```

**Validation**

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |
| `keys.p256dh` | Non-empty string, max 512 chars |
| `keys.auth` | Non-empty string, max 512 chars |
| Unknown fields | Rejected (`.strict()` at top level and inside `keys`) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "message": "Subscription stored"
  }
}
```

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

**Validation**

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |
| Unknown fields | Rejected (`.strict()`) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "message": "Subscription removed"
  }
}
```

**Notes**

- Deletes matching `PushSubscription` rows for the user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.
- Scheduled sender: `functions/api/cron/push-reminders.ts`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (all fields optional; defaults applied)

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

| Field | Constraints |
|---|---|
| `count` | Integer `1`–`25` (default `10`) |
| `examType` | `PANCE`, `PANRE`, or `EOR` (default `PANCE`) |
| `scopeFilter.system` | Optional string, max 100 chars |
| `scopeFilter.conditionId` | Optional string, max 200 chars |
| Unknown fields | Rejected (`.strict()` at top level and inside `scopeFilter`) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "unused_variant",
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
      "total": 1,
      "withVariants": 0,
      "withSecondChance": 0,
      "examType": "PANCE"
    }
  }
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

- `400` → validation failure
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`; hydrates from `PreGeneratedQuestion` first, then `Question`.
- Does not modify FSRS — selection only. Reviews are scored via `POST /api/drills/submit-review`.
