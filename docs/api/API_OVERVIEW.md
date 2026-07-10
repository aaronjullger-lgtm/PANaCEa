# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All successful responses use the unified envelope unless the handler returns a raw `Response`:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Validation failures return `400` with `ok: false` and a structured `error` object. Schemas marked `.strict()` reject unknown fields.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP-note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Store a Web Push subscription (phone, laptop, etc.). |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription and disable push when none remain. |
| POST | `/api/reviews/second-chance` | Build a blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/srs/due` | Fetch canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON or `{ "body": { ... } }` wrapper — middleware accepts both)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation**

- `caseId`: non-empty string, max 200 characters
- `totalScore`: finite number, `0`–`100000`
- `breakdown`: string-keyed record (values unrestricted)
- Only `caseId`, `totalScore`, and `breakdown` are validated; unknown fields inside `body` are rejected (`.strict()`).

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

- `400` → validation failure (malformed score, empty `caseId`, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token, not the request body.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Client: `lib/services/soapAnalyticsService.ts` (best-effort, non-blocking sync).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/...",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Validation**

- `endpoint`: valid URL, max 2048 characters
- `keys.p256dh`, `keys.auth`: non-empty strings, max 512 characters each
- Unknown fields rejected (`.strict()` at top level and inside `keys`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "message": "Subscription stored"
  }
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized keys, unknown fields)

**Notes**

- Upserts on `(userId, endpoint)`; updates `p256dh`/`auth` on repeat subscribe.
- Sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`; cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/..."
}
```

**Validation**

- `endpoint`: valid URL, max 2048 characters
- Unknown fields rejected (`.strict()`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "message": "Subscription removed"
  }
}
```

**Error responses**

- `400` → validation failure

**Notes**

- Deletes the matching `PushSubscription` row for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

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
    "conditionId": "optional-condition-id"
  }
}
```

**Validation**

- `count`: integer `1`–`25` (default `10`)
- `examType`: `PANCE` | `PANRE` | `EOR` (default `PANCE`)
- `scopeFilter.system`: optional string, max 100 characters
- `scopeFilter.conditionId`: optional string, max 200 characters
- Unknown fields rejected (`.strict()` at top level and inside `scopeFilter`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {},
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "canonical_fallback",
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
  }
}
```

`question.source` is `pre_generated` or `main_question`. `question` is `null` when hydration fails.

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

- Powered by `lib/services/secondChanceEngine.ts`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for pre-generated rows.

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Max items returned; clamped to `1`–`200` |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS partition (case-insensitive) |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext` |

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card",
        "questionId": "string",
        "questionIdentityId": "string",
        "conditionId": "string",
        "taskType": "string",
        "progressContext": "READINESS",
        "dueDate": "2026-01-01T00:00:00.000Z",
        "overdueDays": 0,
        "priority": 0,
        "system": "Cardiovascular"
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-01-01T00:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": null,
    "suppressedDuplicates": 0
  }
}
```

`source` on each item is one of `card`, `user_topic_progress`, or `user_progress`.

**Degraded response (`200 OK`, never `500`)**

On internal errors the handler returns an empty queue instead of throwing:

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

- Legacy `SRSItem` is deprecated; reads canonical `Card`, `UserTopicProgress`, and `UserProgress`.
- Card rows are filtered to linked `Question` rows with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or UserTopicProgress row covers the same condition/context.
- Dashboard contract pinned in `functions/api/srs/due.test.ts` (stable top-level keys: `items`, `totalDue`, `timestamp`).
- SDK mapping: `srsClient.getDueItems()` — see `docs/strategy/SDK-PLAN.md`.

---

### `GET /api/admin/check-access`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "hasAccess": true,
  "role": "admin",
  "userId": "string",
  "email": "optional-string"
}
```

`role` can be `admin` or `superadmin`.

**Error responses**

- `403` → `{ "success": false, "hasAccess": false, "message": "Forbidden - Admin access required" }`
- `500` → `{ "error": "Internal server error", "hasAccess": false }`

**Notes**

- Access is resolved in this order: `SUPERADMIN_USER_IDS`/`ADMIN_USER_IDS` env values first, then database role lookup.

---

### `GET /api/admin/stats`

**Auth:** Required (admin-authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "data": {
    "totalUsers": 0,
    "activeUsersToday": 0,
    "totalStudySessions": 0,
    "averageAccuracy": 0,
    "popularSystems": [
      {
        "system": "string",
        "count": 0
      }
    ],
    "pendingFlags": 0
  }
}
```

**Error responses**

- `403` → `{ "error": "Admin access required" }`
- `500` → `{ "error": "Failed to fetch admin stats" }`

**Notes**

- If `DATABASE_URL` is missing, returns zeroed stats with `note: "Database not configured"`.

---

### `POST /api/osce/complete`

**Auth:** Required (authenticated endpoint)

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

**Success responses**

- `200 OK` → `{ "success": true }`
- `200 OK` (idempotent repeat) → `{ "success": true, "alreadyCompleted": true }`

**Error responses**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- Creates `CaseFile` on a best-effort basis when `soapComparison` or `timingAnalytics` is provided.
- `CaseFile` creation failure is logged but does not fail completion.

---

### `GET /api/osce/stats`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "totalEncounters": 0,
  "passRate": 0,
  "averageScore": 0,
  "averageClinicalReasoningScore": 0,
  "trend": [
    {
      "sessionId": "string",
      "date": "2026-01-01T00:00:00.000Z",
      "score": 0,
      "clinicalReasoningScore": 0
    }
  ]
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to load OSCE stats" }`

**Notes**

- Metrics are computed from completed `PatientEncounterSession` rows that have an `OsceResult`.
- Pass threshold is score `>= 70`.
