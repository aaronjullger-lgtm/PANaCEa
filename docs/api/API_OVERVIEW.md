# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when no subscriptions remain. |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session with hydrated question content. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (`authenticatedEndpoint`)

**Request body** (flat JSON; middleware also accepts a `{ "body": { ... } }` wrapper)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20
  }
}
```

**Validation (Zod `.strict()`):**

- `caseId` — required, non-empty, max 200 characters
- `totalScore` — finite number, 0–100,000
- `breakdown` — required object with string keys (values: any JSON)
- Unknown top-level or body fields are rejected

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (`Validation failed: …`)
- `401` → missing or invalid Clerk token
- `500` → `{ "ok": false, "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token; callers do not supply it.
- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- Client: `lib/services/soapAnalyticsService.ts` (`storeSoapGradingEvent`).

---

### `POST /api/push/subscribe`

**Auth:** Required (`authenticatedEndpoint`)

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

**Validation (Zod `.strict()`):**

- `endpoint` — valid URL, max 2048 characters
- `keys.p256dh` / `keys.auth` — required, 1–512 characters each
- Unknown fields at any level are rejected

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure
- `401` → missing or invalid Clerk token
- `500` → database or internal error

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

**Validation (Zod `.strict()`):**

- `endpoint` — valid URL, max 2048 characters
- Unknown fields are rejected

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure
- `401` → missing or invalid Clerk token
- `500` → database or internal error

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (`authenticatedEndpoint`)

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

**Validation (Zod `.strict()`):**

- `count` — integer, 1–25 (default `10`)
- `examType` — `PANCE` | `PANRE` | `EOR` (default `PANCE`)
- `scopeFilter.system` — optional, max 100 characters
- `scopeFilter.conditionId` — optional, max 200 characters
- Unknown top-level or `scopeFilter` fields are rejected

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
      "total": 1,
      "withVariants": 0,
      "withSecondChance": 0,
      "examType": "PANCE"
    }
  },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
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
  }
}
```

**Error responses**

- `400` → validation failure
- `401` → missing or invalid Clerk token
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts` (`buildSecondChanceReviewSet`).
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

## Validation hardening

These endpoints export Zod schemas exercised by `functions/api/__tests__/validation-hardening.test.ts`:

| Schema | File |
|---|---|
| `SoapNoteSchema` | `functions/api/analytics/soap-note.ts` |
| `subscribeSchema` / `unsubscribeSchema` | `functions/api/push/subscribe.ts` |
| `SecondChanceRequestSchema` | `functions/api/reviews/second-chance.ts` |

All three use `.strict()` to reject unknown fields and bounded string/number limits to block oversized or malformed payloads.
