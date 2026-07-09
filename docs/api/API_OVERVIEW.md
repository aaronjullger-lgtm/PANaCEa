# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** 2026-07-09 (audit stabilization — API validation hardening + SRS due dashboard contract)

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics (best-effort; schema-hardened). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |

## Validation Hardening (2026-07)

The following mutation endpoints export Zod schemas with **bounded lengths**, **finite/range numerics**, and **`.strict()`** unknown-field rejection. Valid client payloads are unchanged; oversized or malformed bodies return `400`.

| Endpoint | Schema export | Tests |
|---|---|---|
| `POST/DELETE /api/push/subscribe` | `subscribeSchema`, `unsubscribeSchema` | `functions/api/__tests__/validation-hardening.test.ts` |
| `POST /api/analytics/soap-note` | `SoapNoteSchema` | same |
| `POST /api/reviews/second-chance` | `SecondChanceRequestSchema` | same |

`GET /api/srs/due` dashboard response shape is locked by contract tests in `functions/api/srs/due.test.ts` (stable top-level keys; degraded path returns empty items, not `500`).

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (flat JSON; middleware also accepts `{ "body": { ... } }`)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

- `totalScore`: finite number, `0`–`100000` (rejects `NaN`/`Infinity`)
- `breakdown`: keyed map (`z.record`); values are opaque JSON
- Unknown fields rejected (`.strict()` on body object)

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation failure (empty/oversized `caseId`, non-finite score, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token; callers do not send it.
- Persistence uses `SoapNoteGradingEvent` when the model exists; otherwise the handler logs and still returns success (best-effort analytics).
- Client: `lib/services/soapAnalyticsService.ts` (local storage + best-effort sync).

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

Unknown top-level or `keys` fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "message": "Subscription stored"
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized keys, unknown fields)
- `401` → missing/invalid Clerk token

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`; cron sender: `functions/api/cron/push-reminders.ts`.

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
  "message": "Subscription removed"
}
```

**Error responses**

- `400` → validation failure
- `401` → missing/invalid Clerk token

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
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

| Field | Constraints | Default |
|---|---|---|
| `count` | integer `1`–`25` | `10` |
| `examType` | `PANCE` \| `PANRE` \| `EOR` | `PANCE` |
| `scopeFilter.system` | max 100 chars | — |
| `scopeFilter.conditionId` | max 200 chars | — |

Unknown top-level or `scopeFilter` fields are rejected (`.strict()`).

**Success response (`200 OK`) — items due**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {},
      "isVariant": true,
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
    "total": 1,
    "withVariants": 1,
    "withSecondChance": 0,
    "examType": "PANCE"
  }
}
```

`question.source` is `pre_generated` or `main_question`; `question` may be `null` if content is missing.

**Success response (`200 OK`) — nothing due**

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

**Error responses**

- `400` → validation failure
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts`.
- Hydrates from `PreGeneratedQuestion` first, then `Question`; increments `timesServed` for pre-generated rows (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200` |
| `progressContext` | `READINESS` \| `TARGETED` | all contexts | Filter due rows |
| `context` | alias for `progressContext` | — | Accepted for backward compatibility |

**Success response (`200 OK`)**

```json
{
  "items": [
    {
      "id": "string",
      "source": "card",
      "questionId": "string",
      "questionIdentityId": "string",
      "conditionId": "string",
      "taskType": "string",
      "progressContext": "READINESS",
      "dueDate": "2026-04-01T00:00:00.000Z",
      "overdueDays": 0,
      "priority": 0
    }
  ],
  "totalDue": 0,
  "timestamp": "2026-04-07T12:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": null,
  "suppressedDuplicates": 0
}
```

`source` on each item is one of: `card`, `user_topic_progress`, `user_progress`.

**Degraded response (`200 OK` on handler error — not `500`)**

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-04-07T12:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Compatibility read model over canonical FSRS stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not read.
- Card rows linked to non-production-safe questions (`lifecycleStatus !== ACTIVE` or `qaStatus !== APPROVED`) are filtered out.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific card or topic row covers the same condition/context.
- Dashboard consumers depend on stable keys: `items`, `totalDue`, `timestamp`, and per-item `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, `priority`.

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
