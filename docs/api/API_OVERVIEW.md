# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists SOAP Note grading analytics from OSCE sessions (best-effort; schema-hardened). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

### Validation hardening (Phase 4)

The analytics, push, and second-chance routes above export Zod schemas with `.strict()` and bounded fields. Valid payloads are unchanged; oversized, non-finite, or unknown fields are rejected with `400` validation errors. Schemas are exercised in `functions/api/__tests__/validation-hardening.test.ts`.

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (canonical wrapped shape; flat `{ caseId, totalScore, breakdown }` is also accepted via middleware auto-wrap)

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

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 characters |
| `totalScore` | Finite number, 0–100,000 |
| `breakdown` | String-keyed object (any JSON values); unknown sibling fields rejected (`.strict()`) |

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

- `400` → validation failure (empty/oversized `caseId`, `NaN`/`Infinity` score, unknown fields)
- `401` → unauthenticated
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- Client: `lib/services/soapAnalyticsService.ts` (best-effort, non-blocking).

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

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
| `endpoint` | Valid URL, max 2048 characters |
| `keys.p256dh` | Non-empty string, max 512 characters |
| `keys.auth` | Non-empty string, max 512 characters |

Unknown top-level or `keys` fields are rejected (`.strict()`).

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

- `400` → validation failure (non-URL endpoint, oversized endpoint/keys, unknown fields)
- `401` → unauthenticated

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`; cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 characters |

Unknown fields are rejected (`.strict()`).

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

**Error responses**

- `400` → validation failure
- `401` → unauthenticated

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
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
    "system": "CV",
    "conditionId": "atrial-fibrillation"
  }
}
```

| Field | Constraints |
|---|---|
| `count` | Integer 1–25 (default `10`) |
| `examType` | `PANCE` \| `PANRE` \| `EOR` (default `PANCE`) |
| `scopeFilter.system` | Optional string, max 100 characters |
| `scopeFilter.conditionId` | Optional string, max 200 characters |

Unknown top-level or `scopeFilter` fields are rejected (`.strict()`).

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
          "system": "CV",
          "stability": 0,
          "difficulty": 0,
          "lapses": 0,
          "isOverdue": true,
          "priorityScore": 0
        },
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "unused_variant",
        "question": {
          "source": "pre_generated",
          "id": "string",
          "conditionId": "string",
          "system": "CV",
          "difficulty": "medium",
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
  },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

`question.source` is `pre_generated` or `main_question`; `null` when hydration fails.

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

- `400` → validation failure (`count` out of range, invalid `examType`, unknown fields)
- `401` → unauthenticated
- `404` → `{ "data": { "error": "User not found" } }`
- `500` → `{ "data": { "error": "Failed to build second-chance session", "message": "Please try again." } }`

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts` (`buildSecondChanceReviewSet`).
- Hydrates from `PreGeneratedQuestion` first, then `Question`; increments `timesServed` on served pre-generated rows (fire-and-forget).

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
