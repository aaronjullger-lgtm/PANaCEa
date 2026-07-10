# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/analytics/soap-note` | Stores SOAP Note grading analytics for OSCE sessions. |
| POST | `/api/push/subscribe` | Registers a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription and disables push when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200` |
| `progressContext` | `READINESS` \| `TARGETED` | — | Optional; filters all canonical due stores |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext` |

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
  },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Degraded response (`200 OK`, resilient fallback)**

On database errors the handler returns an empty queue instead of HTTP 500:

```json
{
  "ok": true,
  "success": true,
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
- Due `Card` rows require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Broader condition-level due rows are suppressed when a more specific Card or topic row covers the same condition/context.
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`. Each item must include `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, `priority`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat or `{ "body": { ... } }` — middleware accepts both)

```json
{
  "caseId": "string",
  "totalScore": 82,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation (`.strict()` on body)**

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 chars |
| `totalScore` | Finite number, `0`–`100000` (rejects `NaN`/`Infinity`) |
| `breakdown` | Record of string keys to arbitrary JSON values |
| Unknown fields | Rejected |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (malformed score, empty/oversized `caseId`, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token; callers do not send it.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON, `.strict()`)

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
| Unknown fields | Rejected at top level and inside `keys` |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications: true`.
- See `hooks/usePushNotifications.ts` (client) and `functions/api/cron/push-reminders.ts` (sender).

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON, `.strict()`)

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

**Validation:** `endpoint` must be a valid URL, max 2048 chars. Unknown fields rejected.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Notes**

- Deletes the matching subscription for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications: false`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON, `.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "optional-condition-id"
  }
}
```

**Validation**

| Field | Constraints |
|---|---|
| `count` | Optional integer, `1`–`25` (default `10`) |
| `examType` | Optional enum: `PANCE`, `PANRE`, `EOR` (default `PANCE`) |
| `scopeFilter.system` | Optional string, max 100 chars |
| `scopeFilter.conditionId` | Optional string, max 200 chars |
| Unknown fields | Rejected at top level and inside `scopeFilter` |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
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
          "isOverdue": true,
          "priorityScore": 0
        },
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
}
```

**Empty due queue (`200 OK`)**

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

- `404` → `{ "error": "User not found" }`
- `400` → validation failure (out-of-range `count`, invalid `examType`, unknown fields)
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`; hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).
