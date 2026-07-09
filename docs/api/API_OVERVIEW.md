# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** validation hardening pass on `push/subscribe`, `analytics/soap-note`, and `reviews/second-chance` (Zod `.strict()` bounds, exported schemas in `functions/api/__tests__/validation-hardening.test.ts`).

All authenticated routes use the unified envelope:

- **Success:** `{ ok: true, success: true, data: <payload>, traceId, timestamp }`
- **Error:** `{ ok: false, success: false, error: { code, message, details? }, traceId, timestamp }`

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP-note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Register a Web Push subscription (endpoint + VAPID keys) for SRS reminders. |
| DELETE | `/api/push/subscribe` | Remove one push subscription; disables push preference when none remain. |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session. |

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (`Authorization: Bearer <Clerk JWT>`)

**Request body** (flat JSON; middleware also accepts `{ "body": { ... } }` wrapper)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 0,
  "breakdown": {
    "subjective": 20,
    "objective": 25
  }
}
```

| Field | Type | Constraints |
|---|---|---|
| `caseId` | `string` | Required, 1–200 characters |
| `totalScore` | `number` | Required, finite, 0–100 000 |
| `breakdown` | `Record<string, unknown>` | Required keyed map (section scores / rubric fields) |

**Validation:** `.strict()` — unknown top-level or `body` fields are rejected (`400`). `NaN` / `Infinity` scores are rejected.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "uuid",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `400` → validation failure (`VALIDATION_FAILED`)
- `401` → missing/invalid Clerk token
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- `userId` is resolved from the Clerk token (not accepted in the body).
- Persists to `SoapNoteGradingEvent` when the Prisma model exists; otherwise logs and still returns success (graceful degradation).
- Client: `lib/services/soapAnalyticsService.ts` → `storeSoapGradingEvent()`.

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/…",
  "keys": {
    "p256dh": "base64-string",
    "auth": "base64-string"
  }
}
```

| Field | Type | Constraints |
|---|---|---|
| `endpoint` | `string` | Valid URL, max 2 048 characters |
| `keys.p256dh` | `string` | 1–512 characters |
| `keys.auth` | `string` | 1–512 characters |

**Validation:** `.strict()` on the root object and on `keys`.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "uuid",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `400` → invalid URL, oversized endpoint/keys, or unknown fields
- `401` → unauthenticated

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts` → `subscribe()`.
- Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/…"
}
```

| Field | Type | Constraints |
|---|---|---|
| `endpoint` | `string` | Valid URL, max 2 048 characters |

**Validation:** `.strict()` — only `endpoint` is allowed.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" },
  "traceId": "uuid",
  "timestamp": "ISO-8601"
}
```

**Notes**

- Deletes matching `PushSubscription` rows for the user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.
- Client: `hooks/usePushNotifications.ts` → `unsubscribe()`.

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
    "conditionId": "optional-condition-id"
  }
}
```

| Field | Type | Constraints | Default |
|---|---|---|---|
| `count` | `integer` | 1–25 | `10` |
| `examType` | `"PANCE" \| "PANRE" \| "EOR"` | enum | `"PANCE"` |
| `scopeFilter.system` | `string` | max 100 chars | — |
| `scopeFilter.conditionId` | `string` | max 200 chars | — |

**Validation:** `.strict()` on root and `scopeFilter`. Empty `{}` is valid (defaults apply).

**Success response (`200 OK`)** — selections present

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [
      {
        "questionId": "uuid",
        "learningTarget": {
          "conditionId": "string",
          "taskType": "diagnosis",
          "system": "CV",
          "stability": 12.5,
          "difficulty": 5.2,
          "lapses": 0,
          "isOverdue": true,
          "priorityScore": 0.87
        },
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0.42,
        "selectionMethod": "different_question",
        "question": {
          "source": "pre_generated",
          "id": "uuid",
          "conditionId": "string",
          "system": "CV",
          "difficulty": "medium",
          "questionType": "mcq",
          "questionData": {}
        }
      }
    ],
    "meta": {
      "total": 10,
      "withVariants": 7,
      "withSecondChance": 2,
      "examType": "PANCE"
    }
  },
  "traceId": "uuid",
  "timestamp": "ISO-8601"
}
```

`question.source` is `"pre_generated"` or `"main_question"`. `selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

**Success response (`200 OK`)** — nothing due

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

- `400` → validation failure (count out of range, invalid `examType`, unknown fields)
- `401` → unauthenticated
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts` (`buildSecondChanceReviewSet`).
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated items.
- Does **not** modify FSRS; use `/api/drills/submit-review` or `/api/questions/attempt` to record reviews.

---

## Schema exports (tests)

Exported Zod schemas for contract tests:

| Schema | File |
|---|---|
| `SoapNoteSchema` | `functions/api/analytics/soap-note.ts` |
| `subscribeSchema`, `unsubscribeSchema` | `functions/api/push/subscribe.ts` |
| `SecondChanceRequestSchema` | `functions/api/reviews/second-chance.ts` |

Run: `npx vitest run functions/api/__tests__/validation-hardening.test.ts`
