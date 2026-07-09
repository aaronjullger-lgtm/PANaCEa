# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Latest update (Implementation Expansion Pass):** validation hardening on three mutation endpoints (`/api/push/subscribe`, `/api/analytics/soap-note`, `/api/reviews/second-chance`) and a locked dashboard response contract for `GET /api/srs/due`. Schemas use bounded lengths, finite/range numerics, and `.strict()` to reject unknown fields. Valid payloads are unchanged.

## Response envelope

Unless noted otherwise, successful responses use the unified envelope:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Error responses use `{ "ok": false, "error": { "code", "message", "details?" }, "traceId", "timestamp" }`. Validation failures return `400` with a `VALIDATION_FAILED`-style message.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/analytics/soap-note` | Persists SOAP Note grading analytics for OSCE sessions. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a push subscription; disables push when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

---

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter due rows by FSRS partition. |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext`. |

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

**Degraded response (still `200 OK`, no thrown 500)**

On internal errors the handler returns an empty queue with an error hint:

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

- Reads from canonical FSRS stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not used.
- Card rows are filtered to `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED` questions only.
- Duplicate suppression prefers Card rows over topic/condition progress for the same condition/task key.
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`. Each item must include `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, `priority`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat or `{ "body": { ... } }` — middleware accepts both)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation rules**

- `caseId`: non-empty, max 200 characters.
- `totalScore`: finite number, `0`–`100000`.
- `breakdown`: record of string keys to arbitrary JSON values.
- Unknown top-level or body fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "success": true }
}
```

**Error responses**

- `400` → validation failure (invalid score, empty `caseId`, unknown fields).
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token.
- Persistence to `SoapNoteGradingEvent` is best-effort; if the model is absent, the endpoint still returns success and logs a skip.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/... (valid URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Validation rules**

- `endpoint` must be a valid URL, max 2048 characters.
- `keys.p256dh` and `keys.auth`: non-empty, max 512 characters each.
- Unknown fields rejected at top level and inside `keys` (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription stored" }
}
```

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)`.
- Sets `UserPreferences.pushNotifications` to `true`.
- Used by `hooks/usePushNotifications.ts`; reminders sent by `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/... (valid URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription removed" }
}
```

**Notes**

- Deletes the matching `(userId, endpoint)` row.
- When no subscriptions remain, sets `UserPreferences.pushNotifications` to `false`.

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
    "conditionId": "condition-id"
  }
}
```

**Validation rules**

- `count`: integer `1`–`25` (default `10`).
- `examType`: `PANCE` \| `PANRE` \| `EOR` (default `PANCE`).
- `scopeFilter.system`: max 100 characters.
- `scopeFilter.conditionId`: max 200 characters.
- Unknown fields rejected at top level and inside `scopeFilter` (`.strict()`).

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
        "selectionMethod": "unused_variant | different_question | cross_task_fallback | canonical_fallback",
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

- `400` → validation failure.
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`; does not modify FSRS — selects *what* to review.
- Hydrates questions from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

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
