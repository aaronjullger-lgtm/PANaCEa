# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Validation hardening (2026-07):** Mutation endpoints below export Zod `.strict()` schemas with bounded field sizes. Schema contracts are pinned in `functions/api/__tests__/validation-hardening.test.ts`. `GET /api/srs/due` validates flat query params and returns a resilient empty payload on internal errors (no HTTP 500).

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Stores OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Registers a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; middleware also accepts `{ "body": { ... } }` wrapper)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {}
}
```

**Validation rules**

- `caseId`: non-empty string, max 200 characters
- `totalScore`: finite number, 0–100,000 (rejects `NaN` / `Infinity`)
- `breakdown`: string-keyed record (values: any JSON-serializable shape)
- Unknown fields rejected (`.strict()`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (malformed score, empty/oversized `caseId`, unknown fields)
- `401` → missing/invalid Clerk token
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token server-side (not accepted in the body).
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.
- Client: `lib/services/soapAnalyticsService.ts` (best-effort, non-blocking sync).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Validation rules**

- `endpoint` must be a valid URL, max 2048 characters
- `keys.p256dh` and `keys.auth`: non-empty, max 512 characters each
- Unknown fields rejected at top level and inside `keys` (`.strict()`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized keys, unknown fields)
- `401` → missing/invalid Clerk token

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure
- `401` → missing/invalid Clerk token

**Notes**

- Deletes the matching `PushSubscription` row for the authenticated user.
- Sets `UserPreferences.pushNotifications = false` when no subscriptions remain.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (all fields optional; defaults applied)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "Cardiovascular",
    "conditionId": "optional-condition-id"
  }
}
```

**Validation rules**

- `count`: integer 1–25 (default `10`)
- `examType`: `PANCE` | `PANRE` | `EOR` (default `PANCE`)
- `scopeFilter.system`: max 100 characters
- `scopeFilter.conditionId`: max 200 characters
- Unknown fields rejected at top level and inside `scopeFilter` (`.strict()`)

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
          "source": "pre_generated",
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
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

`question.source` is `pre_generated` or `main_question`; `question` is `null` when content cannot be hydrated.

**Empty due queue (`200 OK`)**

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` → validation failure
- `401` → missing/invalid Clerk token
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Selection engine: `lib/services/secondChanceEngine.ts`.
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated rows.

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to 1–200 |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS partition |
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
        "source": "card",
        "questionId": "string | null",
        "questionIdentityId": "string | null",
        "conditionId": "string | null",
        "taskType": "string | null",
        "progressContext": "READINESS",
        "dueDate": "2026-07-09T00:00:00.000Z",
        "overdueDays": 0,
        "priority": 0,
        "stability": 0,
        "difficulty": 0,
        "state": 2,
        "system": "Cardiovascular"
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-07-09T00:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": null,
    "suppressedDuplicates": 0
  },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

`source` per item: `card` | `user_topic_progress` | `user_progress`.

**Degraded response (`200 OK`, not HTTP 500)**

On internal errors the handler returns an empty, consumer-safe payload:

```json
{
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-07-09T00:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Error responses**

- `400` → invalid query (e.g. non-numeric `limit` coerced; invalid `progressContext`)
- `401` → missing/invalid Clerk token

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` deprecated).
- Due `Card` rows require linked `Question.lifecycleStatus = ACTIVE` and `qaStatus = APPROVED`.
- `suppressDuplicateDueRows` drops broader condition-level rows when a more specific card/topic row covers the same condition/context.
- SDK mapping: `GET /api/srs/due` → `srsClient.getDueItems()` (`docs/strategy/SDK-PLAN.md`).
- Tests: `functions/api/srs/due.test.ts` (dashboard consumer contract + resilience).
