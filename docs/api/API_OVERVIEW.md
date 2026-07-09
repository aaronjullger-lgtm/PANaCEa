# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/analytics/soap-note` | Stores OSCE SOAP note grading analytics (bounded, strict validation). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |
| POST | `/api/push/subscribe` | Upserts a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a push subscription; disables push preference when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |

## Validation Hardening (2026 audit pass)

Mutation endpoints below use **Zod `.strict()`** schemas: unknown fields are rejected with `400`. String and numeric fields are **bounded** (length caps, finite numbers, enum/range checks). Schemas are exported from their route files for direct unit tests in `functions/api/__tests__/validation-hardening.test.ts`.

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; middleware also accepts `{ "body": { ... } }` wrapper)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 82,
  "breakdown": {
    "subjective": 20
  }
}
```

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 characters |
| `totalScore` | Finite number, `0`–`100000` (NaN/Infinity rejected) |
| `breakdown` | Object with string keys; values are JSON-serializable |
| Unknown fields | Rejected (`.strict()` on body object) |

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

- `400` → validation failure (invalid/missing fields, unknown keys, non-finite score)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- Client: `lib/services/soapAnalyticsService.ts` sends flat `{ caseId, totalScore, breakdown }`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "base64-string",
    "auth": "base64-string"
  }
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 characters |
| `keys.p256dh` | Non-empty string, max 512 characters |
| `keys.auth` | Non-empty string, max 512 characters |
| Unknown fields | Rejected at top level and inside `keys` (`.strict()`) |

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

**Error responses**

- `400` → validation failure (invalid URL, oversized keys, unknown fields)
- `401` → missing or invalid Clerk token

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)`; sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://fcm.googleapis.com/..."
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 characters |
| Unknown fields | Rejected (`.strict()`) |

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

- Deletes matching `PushSubscription` rows for the authenticated user.
- Sets `UserPreferences.pushNotifications = false` when no subscriptions remain.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (all fields optional; defaults applied when body is empty)

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

| Field | Constraints |
|---|---|
| `count` | Integer `1`–`25`; default `10` |
| `examType` | `"PANCE"` \| `"PANRE"` \| `"EOR"`; default `"PANCE"` |
| `scopeFilter.system` | Optional string, max 100 characters |
| `scopeFilter.conditionId` | Optional string, max 200 characters |
| Unknown fields | Rejected at top level and inside `scopeFilter` (`.strict()`) |

**Success response (`200 OK`)** — items due

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": { "conditionId": "string", "taskType": "string", "system": "string" },
        "isVariant": true,
        "isSecondChance": true,
        "recognitionRisk": 0.72,
        "selectionMethod": "different_question",
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
      "withVariants": 1,
      "withSecondChance": 1,
      "examType": "PANCE"
    }
  }
}
```

**Success response (`200 OK`)** — nothing due

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

- Powered by `lib/services/secondChanceEngine.ts`; hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint; query-param validation via `{ source: 'query' }`)

**Query parameters**

| Param | Constraints |
|---|---|
| `limit` | Optional string parsed to integer; clamped `1`–`200`; default `100` |
| `progressContext` | Optional `"READINESS"` \| `"TARGETED"` (case-insensitive) |
| `context` | Alias for `progressContext` |

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
        "progressContext": "READINESS",
        "dueDate": "2026-04-01T12:00:00.000Z",
        "overdueDays": 6,
        "priority": 1.8,
        "stability": 2.5,
        "difficulty": 5.0,
        "state": "Review",
        "system": "CV"
      }
    ],
    "totalDue": 1,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": null,
    "suppressedDuplicates": 0
  }
}
```

**Degraded response (`200 OK`, not `500`)** — on internal error

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

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` deprecated).
- Card rows require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level rows omitted when a more specific card/topic row exists.
- Dashboard contract pinned in `functions/api/srs/due.test.ts` (`items`, `totalDue`, `timestamp` always present).
- Client/SDK: `hooks/useSRSItems.ts`, `lib/sdk/srsClient.ts` (`getDueItems()`).

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
