# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All non-streaming responses use the unified envelope from `functions/api/_shared/api-response.ts`:

- **Success:** `{ ok: true, success: true, data, traceId, timestamp, message? }`
- **Error:** `{ ok: false, error: { code, message, details? }, traceId, timestamp }`

Validation failures on mutation endpoints return **400** with a structured error message. Hardened schemas use Zod `.strict()` — unknown fields are rejected.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Optional filter (case-insensitive). |
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
    "progressContext": "TARGETED | null",
    "suppressedDuplicates": 0
  }
}
```

**Degraded response (`200 OK`, never `500`)**

On internal errors the handler returns an empty, dashboard-safe payload:

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

- Reads canonical stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not queried.
- Card rows are filtered to `lifecycleStatus=ACTIVE` and `qaStatus=APPROVED`.
- Duplicate condition/task rows are suppressed (`card` > `user_topic_progress` > `user_progress` specificity).
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`. Each item must include `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, `priority`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat or `{ body: … }` wrapper — middleware accepts both)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {}
}
```

**Validation rules**

- `caseId`: non-empty, max 200 characters.
- `totalScore`: finite number, `0`–`100000`.
- `breakdown`: record keyed by string; values are opaque JSON.
- Unknown fields rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "success": true }
}
```

**Error responses**

- `400` → validation failure (malformed score, empty/oversized `caseId`, unknown fields).
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Client: `lib/services/soapAnalyticsService.ts` (best-effort sync after local storage).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://… (URL, max 2048 chars)",
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

**Error responses**

- `400` → validation failure (invalid URL, oversized keys/endpoint, unknown fields).

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`. Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://… (URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription removed" }
}
```

**Error responses**

- `400` → validation failure (invalid URL, unknown fields).

**Notes**

- Deletes matching `PushSubscription` rows for the user.
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
    "system": "string (max 100 chars, optional)",
    "conditionId": "string (max 200 chars, optional)"
  }
}
```

**Validation rules**

- `count`: integer `1`–`25` (default `10`).
- `examType`: `PANCE` \| `PANRE` \| `EOR` (default `PANCE`).
- `scopeFilter`: optional; unknown nested fields rejected (`.strict()`).
- Unknown top-level fields rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {},
        "isVariant": true,
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
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown fields).
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`. Hydrates from `PreGeneratedQuestion` first, then `Question`.
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
