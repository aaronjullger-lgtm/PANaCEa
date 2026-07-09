# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All responses use the unified envelope (`functions/api/_shared/api-response.ts`):

- **Success:** `{ ok: true, success: true, data, traceId, timestamp, message? }`
- **Error:** `{ ok: false, error: { code, message, details? }, traceId, timestamp }`

Mutation endpoints below validate with Zod `.strict()` schemas — unknown fields and out-of-bounds values return `400` validation errors. Tests: `functions/api/__tests__/validation-hardening.test.ts`.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; middleware auto-wraps for schema validation)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

| Field | Constraints |
|---|---|
| `caseId` | Non-empty string, max 200 chars |
| `totalScore` | Finite number, 0–100,000 |
| `breakdown` | String-keyed object (section scores / metadata) |

Unknown top-level or `breakdown` sibling fields are rejected (`.strict()`). `NaN`/`Infinity` scores are rejected.

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

- `400` → validation failed (malformed payload, empty `caseId`, score out of range, unknown fields)
- `500` → `{ "error": { "message": "Failed to store SOAP grading analytics" } }`

**Notes**

- `userId` is resolved from the Clerk token (client-sent `userId` is ignored).
- Send only `caseId`, `totalScore`, and `breakdown` — extra fields (e.g. `timestamp`) are rejected by `.strict()`.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- Client: `lib/services/soapAnalyticsService.ts`

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc",
  "keys": {
    "p256dh": "base64-string",
    "auth": "base64-string"
  }
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |
| `keys.p256dh` | Non-empty string, max 512 chars |
| `keys.auth` | Non-empty string, max 512 chars |

Unknown fields at any level are rejected (`.strict()`).

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

- `400` → validation failed (non-URL endpoint, oversized endpoint/keys, unknown fields)

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`
- Cron sender: `functions/api/cron/push-reminders.ts`

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
| `endpoint` | Valid URL, max 2048 chars |

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

**Error responses**

- `400` → validation failed (non-URL endpoint, unknown fields)

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
    "conditionId": "optional-condition-id"
  }
}
```

| Field | Constraints |
|---|---|
| `count` | Integer 1–25 (default `10`) |
| `examType` | `"PANCE"` \| `"PANRE"` \| `"EOR"` (default `"PANCE"`) |
| `scopeFilter.system` | Optional string, max 100 chars |
| `scopeFilter.conditionId` | Optional string, max 200 chars |

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
  "timestamp": "ISO-8601"
}
```

`selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

`question.source` is `pre_generated` or `main_question`; `question` may be `null` if hydration fails.

**Success response (`200 OK`) — nothing due**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `400` → validation failed (`count` out of range, invalid `examType`, unknown fields)
- `404` → `{ "data": { "error": "User not found" } }`
- `500` → `{ "data": { "error": "Failed to build second-chance session", "message": "Please try again." } }`

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts` (`buildSecondChanceReviewSet`).
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated items.

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
