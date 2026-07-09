# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All successful responses use the unified envelope unless noted:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

Validation failures return `400` with `ok: false` and a `Validation failed: …` message. Hardened mutation endpoints listed below use Zod `.strict()` — unknown fields are rejected.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a push subscription; disables push preference when no subscriptions remain. |
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

---

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200` |
| `progressContext` | string | — | `READINESS` or `TARGETED` (case-insensitive) |
| `context` | string | — | Alias for `progressContext` |

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
        "dueDate": "2026-04-01T12:00:00.000Z",
        "overdueDays": 0,
        "priority": 0,
        "system": "string | null"
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "TARGETED | READINESS | null",
    "suppressedDuplicates": 0
  }
}
```

**Degraded response (`200 OK`, not `500`)**

On database or internal errors, returns an empty queue so dashboard consumers stay stable:

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

- Reads from `Card`, `UserTopicProgress`, and `UserProgress` — legacy `SRSItem` is deprecated.
- Card rows are included only when the linked `Question` has `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Broader condition-level due rows are suppressed when a more specific Card or topic row covers the same condition/context.
- `priority` = `overdueDays × normalizedDifficulty` (default difficulty weight `0.3` when missing).
- Creates a placeholder user row when the Clerk user has no DB record yet.
- Dashboard contract tests: `functions/api/srs/due.test.ts`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; `.strict()` — no unknown fields)

```json
{
  "endpoint": "https://push.example.com/abc",
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
  "data": {
    "message": "Subscription stored"
  }
}
```

**Error responses**

- `400` → validation failure (invalid URL, oversized endpoint/keys, unknown fields)

**Notes**

- Upserts on `(userId, endpoint)`; updates `p256dh`/`auth` when re-subscribing.
- Sets `UserPreferences.pushNotifications = true`.
- Related: `functions/api/cron/push-reminders.ts`, `hooks/usePushNotifications.ts`.

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
  "data": {
    "message": "Subscription removed"
  }
}
```

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
- Sets `UserPreferences.pushNotifications = false` when no subscriptions remain.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (supports flat or `{ "body": { … } }` wrapper; inner object is `.strict()`)

```json
{
  "body": {
    "caseId": "case-1",
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
| `totalScore` | Finite number, `0`–`100000` (rejects `NaN`/`Infinity`) |
| `breakdown` | String-keyed record (`z.record`) |

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

- `400` → validation failure (empty/oversized `caseId`, non-finite score, unknown body fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- Client: `lib/services/soapAnalyticsService.ts`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; `.strict()` — no unknown fields)

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

| Field | Default | Constraints |
|---|---|---|
| `count` | `10` | Integer `1`–`25` |
| `examType` | `PANCE` | `PANCE`, `PANRE`, or `EOR` |
| `scopeFilter` | — | Optional; `.strict()` nested object |
| `scopeFilter.system` | — | Max 100 chars |
| `scopeFilter.conditionId` | — | Max 200 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0.4,
        "selectionMethod": "unused_variant",
        "learningTarget": {
          "conditionId": "string",
          "taskType": "diagnosis",
          "system": "CV",
          "stability": 10,
          "difficulty": 6,
          "lapses": 0,
          "isOverdue": true,
          "priorityScore": 0.8
        },
        "question": {
          "source": "pre_generated | main_question",
          "id": "string",
          "conditionId": "string",
          "system": "string",
          "difficulty": "string",
          "questionType": "mcq",
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

- `400` → validation failure (count out of range, invalid `examType`, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
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

---

## Validation Hardening (Implementation Expansion Pass)

The following mutation endpoints export Zod schemas tested in `functions/api/__tests__/validation-hardening.test.ts`:

| Endpoint | Hardening |
|---|---|
| `POST/DELETE /api/push/subscribe` | URL max 2048; key max 512; `.strict()` |
| `POST /api/analytics/soap-note` | `caseId` max 200; finite `totalScore` 0–100000; `.strict()` body |
| `POST /api/reviews/second-chance` | `count` 1–25; `examType` enum; `scopeFilter` bounds + `.strict()` |

Valid payloads are unchanged; invalid/oversized/unknown-field requests are rejected with `400`.
