# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All authenticated routes use the unified success envelope unless the handler returns a raw `Response`:

```json
{ "ok": true, "success": true, "data": { }, "traceId": "string", "timestamp": "ISO-8601" }
```

Validation failures return `400` with `{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "..." } }`.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/analytics/soap-note` | Persists SOAP Note grading analytics for OSCE sessions (best-effort DB write). |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200` |
| `progressContext` | `READINESS` \| `TARGETED` | — | Optional FSRS partition filter |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext` |

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
        "dueDate": "2026-04-07T12:00:00.000Z",
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
}
```

**Degraded response (still `200 OK`, never `500`)**

On internal errors the handler returns an empty queue so dashboard consumers stay stable:

```json
{
  "ok": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "ISO-8601",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Reads canonical FSRS stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not used.
- Card rows are filtered to linked questions with `lifecycleStatus=ACTIVE` and `qaStatus=APPROVED`.
- `suppressDuplicateDueRows` removes broader condition-level rows when a more specific card/topic row already covers the same target.
- Dashboard contract locked by `functions/api/srs/due.test.ts` (stable top-level keys: `items`, `totalDue`, `timestamp`).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "endpoint": "https://push.example.com/...",
  "keys": {
    "p256dh": "string",
    "auth": "string"
  }
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |
| `keys.p256dh` | Non-empty string, max 512 chars |
| `keys.auth` | Non-empty string, max 512 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription stored" }
}
```

**Error responses**

- `400` → validation failure (invalid URL, oversized keys, unknown fields)
- `401` → missing/invalid Clerk token

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications=true`.
- Each user may have multiple subscriptions (e.g. phone + laptop).
- See `hooks/usePushNotifications.ts` (client) and `functions/api/cron/push-reminders.ts` (sender).

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/..."
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription removed" }
}
```

**Notes**

- Deletes the matching `(userId, endpoint)` row.
- Sets `UserPreferences.pushNotifications=false` when no subscriptions remain.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint; `userId` resolved from Clerk token)

**Request body**

Accepted as either a flat JSON object (client default) or `{ "body": { ... } }` (middleware auto-wrap). Inner object is `.strict()`.

```json
{
  "caseId": "string",
  "totalScore": 82,
  "breakdown": { "subjective": 20 }
}
```

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 chars |
| `totalScore` | Finite number, `0`–`100000` (rejects `NaN`/`Infinity`) |
| `breakdown` | String-keyed record (`z.record(z.string(), z.unknown())`) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "success": true }
}
```

**Error responses**

- `400` → validation failure
- `500` → `{ "error": "Failed to store SOAP grading analytics" }` (unexpected handler failure)

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; DB errors are logged and the endpoint still returns success (best-effort analytics).
- Client: `lib/services/soapAnalyticsService.ts` (local storage + background sync).

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` at top level and inside `scopeFilter`)

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

| Field | Constraints | Default |
|---|---|---|
| `count` | Integer `1`–`25` | `10` |
| `examType` | `PANCE` \| `PANRE` \| `EOR` | `PANCE` |
| `scopeFilter.system` | Optional string, max 100 chars | — |
| `scopeFilter.conditionId` | Optional string, max 200 chars | — |

**Success response (`200 OK`) — items due**

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
}
```

**Success response (`200 OK`) — nothing due**

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
- Increments `timesServed` on served pre-generated questions (fire-and-forget).
- Does not modify FSRS scheduling — selection only.

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
