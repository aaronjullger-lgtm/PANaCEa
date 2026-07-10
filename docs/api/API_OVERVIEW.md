# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress (legacy SRSItem compatibility read model). |
| POST | `/api/feedback/submit` | Submits authenticated question feedback; persists a `QuestionFlag` for admin review. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/analytics/soap-note` | Stores OSCE SOAP note grading analytics for a case. |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session with hydrated question content. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Max items to return; clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Optional FSRS partition filter (case-insensitive). |
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
        "dueDate": "2026-04-07T12:00:00.000Z",
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

**Degraded response (`200 OK`, never `500`)**

On internal errors the endpoint returns an empty, consumer-safe payload instead of throwing:

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

- Reads from canonical FSRS stores (`Card`, `UserTopicProgress`, `UserProgress`); legacy `SRSItem` is not queried.
- Card rows are included only when the linked `Question` has `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate due rows across stores are suppressed (broader condition-level rows dropped when a more specific Card or topic row exists).
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`. Each item must expose `id`, `source`, `questionId`, `conditionId`, `dueDate`, `overdueDays`, `priority`.

---

### `POST /api/feedback/submit`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "questionId": "string (1–200 chars)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
    "questionText": "string (max 5000, optional)",
    "topic": "string (max 200, optional)",
    "system": "string (max 100, optional)"
  }
}
```

**Success response (`201 Created`)**

```json
{
  "ok": true,
  "data": {
    "success": true,
    "feedbackId": "flag-1234567890-abc1234"
  }
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`
- `400` → validation failure when `questionId`, `description`, `flagType`, or free-text fields are empty, oversized, or unknown keys are present.

**Notes**

- Creates a `QuestionFlag` with `status: pending`.
- `incorrect_fact` flags receive `priority: high`; all other types receive `priority: medium`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "message": "Subscription stored"
  }
}
```

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)`.
- Sets `UserPreferences.pushNotifications: true`.
- Used by `hooks/usePushNotifications.ts`; reminders sent by `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)"
}
```

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

- Deletes the matching subscription for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications: false`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 82,
    "breakdown": {
      "subjective": 20,
      "objective": 30
    }
  }
}
```

`totalScore` must be a finite number in `0`–`100000`. `breakdown` is a string-keyed record (values arbitrary JSON).

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

- `500` → internal failure (`Failed to store SOAP grading analytics`)
- `400` → validation failure for empty/oversized `caseId`, non-finite `totalScore`, or unknown body fields.

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- Called fire-and-forget from `lib/services/soapAnalyticsService.ts`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected at top level and inside `scopeFilter`)

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
| `count` | int | `10` | `1`–`25` |
| `examType` | enum | `PANCE` | `PANCE`, `PANRE`, `EOR` |
| `scopeFilter.system` | string | — | max 100 chars |
| `scopeFilter.conditionId` | string | — | max 200 chars |

**Success response (`200 OK`) — items due**

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
        "isSecondChance": true,
        "recognitionRisk": 0.5,
        "selectionMethod": "unused_variant | different_question | cross_task_fallback | canonical_fallback",
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
      "total": 1,
      "withVariants": 1,
      "withSecondChance": 1,
      "examType": "PANCE"
    }
  }
}
```

**Success response (`200 OK`) — nothing due**

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

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`
- `400` → validation failure for out-of-range `count`, invalid `examType`, oversized scope fields, or unknown keys.

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`; hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).
