# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/analytics/soap-note` | Stores SOAP Note grading analytics for OSCE sessions (best-effort DB persistence). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session with hydrated question content. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |

## Endpoint Contracts

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

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": {
      "subjective": 20
    }
  }
}
```

Validation uses `.strict()` on the inner `body` object — unknown fields are rejected. `totalScore` must be finite and in `[0, 100000]`.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "success": true
  }
}
```

**Error responses**

- `400` → validation failure (invalid/missing fields, NaN/Infinity score, oversized `caseId`)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token; callers do not supply it in the body.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Client: `lib/services/soapAnalyticsService.ts` (best-effort sync after local storage).

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

Validation uses `.strict()` — unknown top-level or nested fields are rejected.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "message": "Subscription stored"
  }
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized endpoint/keys, unknown fields)
- `401` → missing/invalid auth

**Notes**

- Upserts on `(userId, endpoint)`; updates `p256dh`/`auth` when the endpoint already exists.
- Sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`.

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
  "data": {
    "message": "Subscription removed"
  }
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, unknown fields)
- `401` → missing/invalid auth

**Notes**

- Deletes the matching `PushSubscription` row for the authenticated user.
- Sets `UserPreferences.pushNotifications = false` when no subscriptions remain.
- Cron sender: `functions/api/cron/push-reminders.ts`.

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

| Field | Type | Default | Constraints |
|---|---|---|---|
| `count` | `number` | `10` | integer, `1–25` |
| `examType` | `"PANCE" \| "PANRE" \| "EOR"` | `"PANCE"` | enum |
| `scopeFilter.system` | `string` | — | max 100 chars |
| `scopeFilter.conditionId` | `string` | — | max 200 chars |

Validation uses `.strict()` at the top level and inside `scopeFilter`.

**Success response (`200 OK`) — items due**

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
        "isSecondChance": true,
        "recognitionRisk": 0.5,
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
      "total": 1,
      "withVariants": 0,
      "withSecondChance": 1,
      "examType": "PANCE"
    }
  }
}
```

`question.source` is `"pre_generated"` or `"main_question"`; `null` when content could not be hydrated.

**Success response (`200 OK`) — nothing due**

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown fields)
- `404` → `{ "data": { "error": "User not found" } }`
- `500` → `{ "data": { "error": "Failed to build second-chance session", "message": "Please try again." } }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for pre-generated rows served.

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `string` (parsed int) | `100` | Clamped to `1–200` |
| `progressContext` | `"READINESS" \| "TARGETED"` | — | Filter due rows by FSRS partition |
| `context` | `"READINESS" \| "TARGETED"` | — | Alias for `progressContext` |

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
        "source": "card",
        "questionId": "string",
        "questionIdentityId": "string",
        "conditionId": "string",
        "taskType": "string",
        "progressContext": "TARGETED",
        "dueDate": "2026-04-01T00:00:00.000Z",
        "overdueDays": 6,
        "priority": 3.6,
        "stability": 10,
        "difficulty": 6,
        "state": 2,
        "system": "Cardiovascular"
      }
    ],
    "totalDue": 1,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "TARGETED",
    "suppressedDuplicates": 0
  }
}
```

`source` on each item is one of: `card`, `user_topic_progress`, `user_progress`.

**Degraded response (still `200 OK`, no thrown 500)**

When the DB lookup fails, the handler returns an empty queue with an error hint:

```json
{
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Error responses**

- `400` → invalid query params (e.g. invalid `progressContext`)

**Notes**

- Legacy SRS compatibility endpoint; reads canonical `Card`, `UserTopicProgress`, and `UserProgress` (not deprecated `SRSItem`).
- Card rows are filtered to linked `Question` rows with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or UserTopicProgress row covers the same condition/context.
- Dashboard contract tests in `functions/api/srs/due.test.ts` pin stable top-level keys (`items`, `totalDue`, `timestamp`) and per-item launcher fields.
- SDK mapping: `srsClient.getDueItems()` → `GET /api/srs/due` (see `docs/strategy/SDK-PLAN.md`).
