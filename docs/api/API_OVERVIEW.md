# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** 2026-07-10 — validation hardening pass (`push/subscribe`, `analytics/soap-note`, `reviews/second-chance`) plus `/api/srs/due` dashboard response contract.

All successful responses use the unified envelope: `{ ok: true, data: …, traceId, timestamp }`. Examples below show the `data` payload only.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Stores SOAP Note grading analytics for OSCE sessions. |
| POST | `/api/push/subscribe` | Registers a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription and disables push when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (`authenticatedEndpoint`)

**Request body** (flat or `{ body: … }` wrapper — middleware accepts both)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {}
}
```

Validation (`.strict()` — unknown fields rejected):

- `caseId`: non-empty string, max 200 characters
- `totalScore`: finite number, `0`–`100000`
- `breakdown`: record keyed by string (arbitrary JSON values)

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation failure (empty `caseId`, NaN/Infinity score, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token; callers do not send it.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Client: `lib/services/soapAnalyticsService.ts` (best-effort, non-blocking sync).

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body**

```json
{
  "endpoint": "https://push.example.com/… (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

Validation (`.strict()` on top-level and `keys`):

- `endpoint`: valid URL, max 2048 characters
- `keys.p256dh`, `keys.auth`: non-empty strings, max 512 characters each
- Unknown fields at any level are rejected

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
- Client: `hooks/usePushNotifications.ts`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body**

```json
{
  "endpoint": "https://push.example.com/… (URL, max 2048 chars)"
}
```

Validation (`.strict()`): same URL rules as POST; unknown fields rejected.

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

**Notes**

- Deletes the matching `PushSubscription` row for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

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

Validation (`.strict()` on top-level and `scopeFilter`):

- `count`: integer `1`–`25`, default `10`
- `examType`: `"PANCE"` | `"PANRE"` | `"EOR"`, default `"PANCE"`
- `scopeFilter.system`: max 100 characters
- `scopeFilter.conditionId`: max 200 characters
- Unknown fields rejected at every level

**Success response (`200 OK`)**

```json
{
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
}
```

`question` is hydrated from `PreGeneratedQuestion` (preferred) or `Question`; `null` when neither row exists. `selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

**Empty due queue (`200 OK`)**

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

- Powered by `lib/services/secondChanceEngine.ts`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated rows.

---

### `GET /api/srs/due`

**Auth:** Required

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200` |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter all canonical due stores |
| `context` | alias for `progressContext` | — | Case-insensitive (`readiness` → `READINESS`) |

**Success response (`200 OK`)**

```json
{
  "items": [
    {
      "id": "string",
      "source": "card",
      "questionId": "string | null",
      "questionIdentityId": "string | null",
      "conditionId": "string | null",
      "taskType": "string | null",
      "progressContext": "READINESS | TARGETED | null",
      "dueDate": "2026-01-01T00:00:00.000Z",
      "overdueDays": 0,
      "priority": 0,
      "stability": 0,
      "difficulty": 0,
      "state": 0,
      "system": "string | null"
    }
  ],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": "TARGETED | null",
  "suppressedDuplicates": 0
}
```

`source` per item: `card` | `user_topic_progress` | `user_progress`. Card rows include `questionId` and `questionIdentityId` for study-mode launchers.

**Degraded response (`200 OK`, never `500`)**

On database or resolver errors the handler returns an empty queue with a user-safe message instead of throwing:

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` deprecated).
- Card rows filtered to `Question.lifecycleStatus === 'ACTIVE'` and `qaStatus === 'APPROVED'`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or UserTopicProgress row covers the same condition/context.
- Client/SDK: `hooks/useSRSItems.ts`, `lib/sdk/srsClient.ts` (`getDueItems()`).
- Dashboard contract pinned in `functions/api/srs/due.test.ts` (stable top-level keys, ISO `dueDate`, no HTTP 500 on failure).

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

## Validation hardening (2026-07)

Mutation endpoints above use Zod `.strict()` schemas — unknown fields are rejected with `400`. Direct schema tests live in `functions/api/__tests__/validation-hardening.test.ts`. Dashboard/study-queue consumers depend on the stable `/api/srs/due` response shape documented above; regressions are caught by `functions/api/srs/due.test.ts`.
