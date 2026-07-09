# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All responses use the unified envelope (`functions/api/_shared/api-response.ts`):

- **Success:** `{ ok: true, data, traceId, timestamp, message? }`
- **Error:** `{ ok: false, error: { code, message, details? }, traceId, timestamp }`

Mutation endpoints in this batch use Zod `.strict()` schemas — unknown fields are rejected with `400`.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Store a Web Push subscription and enable push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription; disables push preferences when none remain. |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session with hydrated questions. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (Clerk JWT)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": {}
  }
}
```

| Field | Constraints |
|---|---|
| `body.caseId` | Non-empty string, max 200 characters |
| `body.totalScore` | Finite number, `0`–`100000` (NaN/Infinity rejected) |
| `body.breakdown` | Object map (`Record<string, unknown>`) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "success": true },
  "traceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (invalid/missing fields, unknown keys, out-of-range values)
- `401` → authentication required
- `500` → `{ ok: false, error: { code, message: "Failed to store SOAP grading analytics" } }`

**Notes**

- `userId` is resolved from the Clerk token (not accepted in the request body).
- Persists to `SoapNoteGradingEvent` when the model exists; DB failures are logged and the endpoint still returns success (best-effort analytics).
- Source: `functions/api/analytics/soap-note.ts`

---

### `POST /api/push/subscribe`

**Auth:** Required (Clerk JWT)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/...",
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

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription stored" },
  "traceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized keys/endpoint, unknown fields)
- `401` → authentication required

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`
- Cron sender: `functions/api/cron/push-reminders.ts`
- Source: `functions/api/push/subscribe.ts`

---

### `DELETE /api/push/subscribe`

**Auth:** Required (Clerk JWT)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/..."
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 characters |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "message": "Subscription removed" },
  "traceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure
- `401` → authentication required

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.
- Source: `functions/api/push/subscribe.ts`

---

### `POST /api/reviews/second-chance`

**Auth:** Required (Clerk JWT)

**Request body** (`.strict()` — all fields optional; defaults applied)

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
| `count` | Integer `1`–`25` | `10` |
| `examType` | `"PANCE"` \| `"PANRE"` \| `"EOR"` | `"PANCE"` |
| `scopeFilter.system` | Optional string, max 100 characters | — |
| `scopeFilter.conditionId` | Optional string, max 200 characters | — |

**Success response (`200 OK`) — items found**

```json
{
  "ok": true,
  "data": {
    "selections": [
      {
        "questionId": "uuid",
        "learningTarget": {
          "conditionId": "string",
          "taskType": "string",
          "system": "string",
          "stability": 0,
          "difficulty": 0,
          "lapses": 0,
          "isOverdue": true
        },
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "unused_variant",
        "question": {
          "source": "pre_generated",
          "id": "uuid",
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
  "traceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

`question.source` is `pre_generated` or `main_question`. When no matching row exists, `question` is `null`.

**Success response (`200 OK`) — nothing due**

```json
{
  "ok": true,
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  },
  "traceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown fields)
- `401` → authentication required
- `404` → `{ ok: true, data: { error: "User not found" }, status: 404 }` (handler returns error payload inside `data`)
- `500` → `{ ok: true, data: { error: "Failed to build second-chance session", message: "Please try again." }, status: 500 }`

**Notes**

- Selection logic: `lib/services/secondChanceEngine.ts` (`buildSecondChanceReviewSet`).
- Hydrates from `PreGeneratedQuestion` first, then falls back to `Question`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated items.
- Source: `functions/api/reviews/second-chance.ts`

---

## Validation Tests

Schema contracts for these endpoints are covered by `functions/api/__tests__/validation-hardening.test.ts` (valid payloads pass; oversized/malformed/unknown-field payloads are rejected).
