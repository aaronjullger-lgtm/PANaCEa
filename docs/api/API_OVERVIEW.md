# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** Implementation Expansion Pass (validation hardening + SRS due dashboard contract).

All authenticated endpoints require a Clerk Bearer token. Successful responses use the unified envelope `{ ok: true, success: true, data: …, traceId, timestamp }` unless noted.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription and disables push when none remain. |
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for a case. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Max items to return; clamped to `1–200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS progress partition (case-insensitive). |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext`. |

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
        "dueDate": "2026-04-01T12:00:00.000Z",
        "overdueDays": 0,
        "priority": 0,
        "system": "string | null"
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "READINESS | TARGETED | null",
    "suppressedDuplicates": 0
  },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Degraded response (`200 OK`, never `500`)**

On database or internal errors, returns an empty queue with a consumer-safe shape:

```json
{
  "ok": true,
  "success": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Reads from canonical stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not used.
- Due `Card` rows are filtered to linked questions with `lifecycleStatus=ACTIVE` and `qaStatus=APPROVED`.
- Duplicate condition/task rows are suppressed when a more specific Card or topic row already covers the same target.
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`. Each item must include `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, and `priority`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; `.strict()` — unknown fields rejected)

```json
{
  "endpoint": "https://push.example.com/abc",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |
| `keys.p256dh` | Non-empty, max 512 chars |
| `keys.auth` | Non-empty, max 512 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (invalid URL, oversized endpoint/keys, unknown fields)
- `401` → missing or invalid Clerk token

**Notes**

- Upserts on `(userId, endpoint)`; updates `p256dh`/`auth` when re-subscribing.
- Sets `UserPreferences.pushNotifications = true` on subscribe.
- Client: `hooks/usePushNotifications.ts`. Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; `.strict()`)

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Notes**

- Deletes the matching `(userId, endpoint)` row.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (body-wrapped; inner object is `.strict()`)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 82,
    "breakdown": {
      "subjective": 20
    }
  }
}
```

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 chars |
| `totalScore` | Finite number, `0–100000` |
| `breakdown` | Record of string keys to arbitrary JSON values |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (empty/oversized `caseId`, `NaN`/`Infinity` score, unknown body fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- `userId` is resolved from the Clerk token via `resolveUserId`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; `.strict()` at top level and inside `scopeFilter`)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "optional-string"
  }
}
```

| Field | Constraints | Default |
|---|---|---|
| `count` | Integer `1–25` | `10` |
| `examType` | `PANCE` \| `PANRE` \| `EOR` | `PANCE` |
| `scopeFilter.system` | Max 100 chars | — |
| `scopeFilter.conditionId` | Max 200 chars | — |

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
        "selectionMethod": "unused_variant | different_question | cross_task_fallback | canonical_fallback",
        "question": {
          "source": "pre_generated | main_question",
          "id": "string",
          "conditionId": "string",
          "system": "string",
          "difficulty": "string | null",
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
  "timestamp": "2026-04-07T12:00:00.000Z"
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

- `400` → validation failure (count out of range, invalid `examType`, oversized scope, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts` — subdomain-level, blueprint-weighted selection with recognition-risk awareness.
- Hydrates question content from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

## Validation Hardening (shared behavior)

The routes above (except `GET /api/srs/due` query validation) use Zod `.strict()` schemas that reject unknown fields. Oversized or malformed payloads return `400` with:

```json
{
  "ok": false,
  "error": { "code": "…", "message": "Validation failed: …" },
  "success": false
}
```

Schema unit tests: `functions/api/__tests__/validation-hardening.test.ts`. Dashboard contract tests: `functions/api/srs/due.test.ts` (describe block `dashboard response contract`).
