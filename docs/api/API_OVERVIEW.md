# API Overview

This document tracks request/response contracts for recently changed API routes. All authenticated endpoints require a valid Clerk bearer token unless noted otherwise.

**Response envelope:** Most handlers return `{ data: ... }` (or `{ status, data, error }`), which middleware wraps as `{ ok, success, data, traceId, timestamp }`. `POST`/`DELETE /api/push/subscribe` call `ok()` directly and already return the full envelope.

**Validation (2026 audit stabilization):** High-risk mutation endpoints now use Zod schemas with `.strict()` (unknown fields rejected) and bounded string/number lengths. Invalid payloads return `400` with a structured validation error before handler logic runs.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/feedback/submit` | Submit question feedback/flag; creates a `QuestionFlag` record. |
| POST | `/api/push/subscribe` | Store a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription; disables push prefs when none remain. |
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP note grading analytics. |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Fetch canonical FSRS due items (Card, UserTopicProgress, UserProgress). |
| GET | `/api/admin/check-access` | Verify whether the authenticated user has admin access. |
| GET | `/api/admin/stats` | Return admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Mark an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | Return OSCE performance metrics and trend data. |

---

## Endpoint Contracts

### `POST /api/feedback/submit`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "questionId": "string (1–200 chars)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
    "questionText": "string (optional, max 5000)",
    "topic": "string (optional, max 200)",
    "system": "string (optional, max 100)"
  }
}
```

Unknown fields inside `body` are rejected (`.strict()`).

**Success response (`201 Created`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "success": true,
    "feedbackId": "flag-<timestamp>-<random>"
  },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `400` → validation error (empty/oversized fields, invalid `flagType`, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- `incorrect_fact` flags are stored with `priority: high`; all other types use `medium`.
- Used by `FlagQuestionModal` and the flag-question flow.

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body**

```json
{
  "endpoint": "https://… (valid URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

Unknown top-level or `keys` fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `400` → validation error (non-URL endpoint, oversized endpoint/keys, unknown fields)

**Notes**

- Upserts on `(userId, endpoint)`; enables `pushNotifications` in `UserPreferences`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body**

```json
{
  "endpoint": "https://… (valid URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Notes**

- Deletes matching `PushSubscription` rows for the user; sets `pushNotifications: false` when no subscriptions remain.

---

### `POST /api/analytics/soap-note`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": "number (finite, 0–100000)",
    "breakdown": { "subjective": 20, "objective": 30 }
  }
}
```

`breakdown` is a string-keyed record; unknown fields inside `body` are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `400` → validation error (empty/oversized `caseId`, NaN/Infinity `totalScore`, unknown fields)
- `500` → internal error if handler throws

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Client: `lib/services/soapAnalyticsService.ts`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

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

| Field | Type | Default | Constraints |
|---|---|---|---|
| `count` | `number` | `10` | integer, 1–25 |
| `examType` | `string` | `PANCE` | `PANCE`, `PANRE`, or `EOR` |
| `scopeFilter.system` | `string` | — | max 100 chars |
| `scopeFilter.conditionId` | `string` | — | max 200 chars |

Unknown top-level or `scopeFilter` fields are rejected (`.strict()`).

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
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0.0,
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
      "withVariants": 1,
      "withSecondChance": 0,
      "examType": "PANCE"
    }
  },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

When nothing is due:

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` → validation error (count out of range, invalid `examType`, oversized scope, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Selection engine: `lib/services/secondChanceEngine.ts`. Hydrates from `PreGeneratedQuestion` first, then `Question`.
- `selectionMethod`: `unused_variant`, `different_question`, `cross_task_fallback`, or `canonical_fallback`.

---

### `GET /api/srs/due`

**Auth:** Required

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `string` (parsed int) | `100` | Clamped to 1–200 |
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
        "source": "card | user_topic_progress | user_progress",
        "questionId": "string | null",
        "questionIdentityId": "string | null",
        "conditionId": "string | null",
        "taskType": "string | null",
        "progressContext": "READINESS | TARGETED | null",
        "dueDate": "2026-04-01T00:00:00.000Z",
        "overdueDays": 0,
        "priority": 0.0,
        "stability": 0,
        "difficulty": 0,
        "state": 0,
        "system": "string | null"
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "READINESS",
    "suppressedDuplicates": 0
  },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Degraded response (errors return empty queue, not HTTP 500)**

```json
{
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "ISO-8601",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` deprecated).
- Card rows require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level rows are dropped when a more specific Card or topic row covers the same condition/context.
- Dashboard contract tests in `functions/api/srs/due.test.ts` pin `items`, `totalDue`, and `timestamp` as stable top-level keys.

---

### `GET /api/admin/check-access`

**Auth:** Required

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

**Auth:** Required (admin)

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
    "popularSystems": [{ "system": "string", "count": 0 }],
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

**Auth:** Required

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

**Auth:** Required

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
