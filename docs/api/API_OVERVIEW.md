# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All non-streaming responses use the unified envelope:

- **Success:** `{ "ok": true, "success": true, "data": { ... }, "traceId": "...", "timestamp": "..." }`
- **Error:** `{ "ok": false, "error": { "code": "...", "message": "..." }, "traceId": "...", "timestamp": "..." }`

Validation uses Zod schemas with `.strict()` on the routes below — unknown fields are rejected with `400`.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (legacy SRSItem compatibility read model). |
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push preference when none remain. |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session with hydrated question content. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Max items to return. Clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter due rows to a single FSRS partition. |
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
        "progressContext": "READINESS | TARGETED | null",
        "dueDate": "2026-04-01T00:00:00.000Z",
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

**Resilient empty-state (`200 OK` on handler error)**

```json
{
  "ok": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Reads from `Card`, `UserTopicProgress`, and `UserProgress` — not deprecated `SRSItem`.
- Card rows are included only when the linked `Question` has `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or UserTopicProgress row already covers the same condition/context.
- Items are sorted by due date ascending, then by priority descending.

---

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
| `caseId` | Required string, `1`–`200` characters |
| `totalScore` | Required finite number, `0`–`100000` |
| `breakdown` | Required object with string keys (arbitrary values) |

Unknown top-level or body fields are rejected.

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

- `400` → validation failure (invalid score, empty/oversized `caseId`, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token — do not send it in the body.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success (best-effort).
- Client: `lib/services/soapAnalyticsService.ts` (local storage + fire-and-forget sync).

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
| `endpoint` | Required URL, max `2048` characters |
| `keys.p256dh` | Required string, `1`–`512` characters |
| `keys.auth` | Required string, `1`–`512` characters |

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

- `400` → validation failure (non-URL endpoint, oversized keys, unknown fields)

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`.
- Reminders sent by `functions/api/cron/push-reminders.ts`.

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
| `endpoint` | Required URL, max `2048` characters |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "message": "Subscription removed"
  }
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, unknown fields)

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
    "system": "Cardiovascular",
    "conditionId": "condition-uuid"
  }
}
```

| Field | Constraints |
|---|---|
| `count` | Integer `1`–`25`, default `10` |
| `examType` | `PANCE` \| `PANRE` \| `EOR`, default `PANCE` |
| `scopeFilter.system` | Optional string, max `100` characters |
| `scopeFilter.conditionId` | Optional string, max `200` characters |

**Success response (`200 OK`)**

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
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "unused_variant",
        "question": {
          "source": "pre_generated | main_question",
          "id": "string",
          "conditionId": "string",
          "system": "string",
          "difficulty": "string | null",
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

`selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

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

- Selection engine: `lib/services/secondChanceEngine.ts`.
- Questions are hydrated from `PreGeneratedQuestion` first, then `Question`.
- `question` is `null` when neither table has the selected ID.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated rows.
