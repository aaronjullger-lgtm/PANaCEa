# API Overview

This document tracks request/response contracts for recently changed Cloudflare Pages Function routes under `functions/api/`.

All authenticated endpoints require a Clerk JWT (`Authorization: Bearer <token>`). Successful responses use the unified envelope:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

Validation failures return `400` with `{ "ok": false, "error": { "message": "Validation failed: …" }, … }`. Mutation schemas on the routes below use Zod `.strict()` — unknown fields are rejected.

---

## Changed Routes (Validation Hardening — Phase 4)

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| POST | `/api/push/subscribe` | Stores or updates a Web Push subscription and enables push in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when none remain. |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session with hydrated question content. |

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (`authenticatedEndpoint`)

**Source:** `functions/api/analytics/soap-note.ts` · **Client:** `lib/services/soapAnalyticsService.ts`

**Request body** (flat JSON is auto-wrapped by middleware; both shapes validate)

```json
{
  "caseId": "string (1–200 chars)",
  "totalScore": 82,
  "breakdown": {
    "subjective": 20
  }
}
```

| Field | Type | Constraints |
|---|---|---|
| `caseId` | string | Required, 1–200 chars |
| `totalScore` | number | Required, finite, 0–100_000 |
| `breakdown` | object | Required; string keys, arbitrary values |

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

- `400` → validation failure (empty `caseId`, NaN/Infinity `totalScore`, unknown fields)
- `401` → missing/invalid Clerk token
- `500` → `{ "error": { "message": "Failed to store SOAP grading analytics" } }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- `userId` is resolved from the Clerk token — never accepted from the client body.

---

### `POST /api/push/subscribe`

**Auth:** Required (`authenticatedEndpoint`)

**Source:** `functions/api/push/subscribe.ts` · **Client:** `hooks/usePushNotifications.ts` · **Cron sender:** `functions/api/cron/push-reminders.ts`

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc",
  "keys": {
    "p256dh": "base64-string (1–512 chars)",
    "auth": "base64-string (1–512 chars)"
  }
}
```

| Field | Type | Constraints |
|---|---|---|
| `endpoint` | string | Required, valid URL, max 2048 chars |
| `keys.p256dh` | string | Required, 1–512 chars |
| `keys.auth` | string | Required, 1–512 chars |

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

- `400` → non-URL endpoint, oversized endpoint/keys, unknown fields
- `401` → missing/invalid Clerk token

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)` and sets `UserPreferences.pushNotifications = true`.
- Each user may have multiple subscriptions (e.g. phone + laptop).

---

### `DELETE /api/push/subscribe`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc"
}
```

| Field | Type | Constraints |
|---|---|---|
| `endpoint` | string | Required, valid URL, max 2048 chars |

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

- `400` → invalid URL, unknown fields
- `401` → missing/invalid Clerk token

**Notes**

- Deletes the matching `(userId, endpoint)` row. When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (`authenticatedEndpoint`)

**Source:** `functions/api/reviews/second-chance.ts` · **Engine:** `lib/services/secondChanceEngine.ts`

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
| `count` | integer | 1–25 | `10` |
| `examType` | enum | `PANCE`, `PANRE`, `EOR` | `PANCE` |
| `scopeFilter.system` | string | max 100 chars | — |
| `scopeFilter.conditionId` | string | max 200 chars | — |

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
          "taskType": "diagnosis",
          "system": "CV",
          "stability": 12.5,
          "difficulty": 5.2,
          "lapses": 0,
          "isOverdue": true,
          "priorityScore": 0.85
        },
        "isVariant": true,
        "isSecondChance": true,
        "recognitionRisk": 0.72,
        "selectionMethod": "unused_variant",
        "question": {
          "source": "pre_generated",
          "id": "string",
          "questionData": {},
          "conditionId": "string",
          "system": "CV",
          "difficulty": "medium",
          "questionType": "mcq"
        }
      }
    ],
    "meta": {
      "total": 10,
      "withVariants": 7,
      "withSecondChance": 4,
      "examType": "PANCE"
    }
  },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

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

- `400` → `count` out of range, invalid `examType`, unknown fields
- `401` → missing/invalid Clerk token
- `404` → `{ "data": { "error": "User not found" } }`
- `500` → `{ "data": { "error": "Failed to build second-chance session", "message": "Please try again." } }`

**Notes**

- Selects subdomain-level, blueprint-weighted questions via `buildSecondChanceReviewSet`; hydrates from `PreGeneratedQuestion` first, then `Question`.
- `question.source` is `pre_generated` or `main_question`. `selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.
- Increments `PreGeneratedQuestion.timesServed` fire-and-forget for served pre-generated items.

---

## Previously Documented Routes

These routes were documented in an earlier pass and remain unchanged:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | Returns OSCE performance metrics and trend data. |

See git history for the prior full contracts of these four endpoints, or inspect `functions/api/admin/` and `functions/api/osce/`.

---

## Validation Tests

Schema contracts for the Phase 4 routes are covered by `functions/api/__tests__/validation-hardening.test.ts`:

- `subscribeSchema` / `unsubscribeSchema` — URL bounds, key size limits, `.strict()` rejection
- `SoapNoteSchema` — finite score bounds, `caseId` length, `.strict()` rejection
- `SecondChanceRequestSchema` — defaults, count/examType bounds, scope filter limits
