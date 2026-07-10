# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** Implementation Expansion Pass (validation hardening + `/api/srs/due` dashboard contract).

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/srs/due` | Canonical FSRS due queue/count from Card, UserTopicProgress, and UserProgress (compatibility read model). |
| POST | `/api/push/subscribe` | Store or upsert a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription; disables push preference when none remain. |
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP note grading analytics (best-effort; model may not exist yet). |
| POST | `/api/reviews/second-chance` | Build a subdomain-level, blueprint-weighted second-chance review session. |

## Endpoint Contracts

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | string (parsed int) | `100` | Clamped to `1`–`200`. |
| `progressContext` | `READINESS` \| `TARGETED` | — | Optional FSRS partition filter. |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext`. |

**Success response (`200 OK`)**

Unified envelope (handler `data` is the due payload):

```json
{
  "ok": true,
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card | user_topic_progress | user_progress",
        "questionId": "string | null",
        "conditionId": "string | null",
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
  },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Degraded response (`200 OK`, not `500`)**

On database or resolver failure the handler returns an empty, consumer-stable payload inside `data`:

```json
{
  "ok": true,
  "success": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Notes**

- Dashboard callers depend on stable top-level keys: `items`, `totalDue`, `timestamp`.
- Each due item exposes at minimum: `id`, `source`, `questionId`, `conditionId`, `dueDate` (ISO string), `overdueDays`, `priority`.
- Card rows are filtered to production-safe linked questions (`lifecycleStatus: ACTIVE`, `qaStatus: APPROVED`).
- Duplicate suppression merges overlapping Card / UserTopicProgress / UserProgress rows for the same condition/context.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "endpoint": "https://push.example.com/...",
  "keys": {
    "p256dh": "string",
    "auth": "string"
  }
}
```

| Field | Constraints |
|---|---|
| `endpoint` | Valid URL, max 2048 chars |
| `keys.p256dh` | 1–512 chars |
| `keys.auth` | 1–512 chars |

**Success response (`200 OK`)**

Unified envelope via `ok()`:

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (invalid URL, oversized keys, unknown fields)
- `401` → missing/invalid Clerk token

**Notes**

- Upserts on `(userId, endpoint)`; refreshes `p256dh` / `auth` on repeat subscribe.
- Sets `UserPreferences.pushNotifications = true`.
- Client: `hooks/usePushNotifications.ts`. Cron sender: `functions/api/cron/push-reminders.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/..."
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
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Notes**

- Deletes matching `(userId, endpoint)` rows.
- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body**

Flat JSON (middleware auto-wraps into `{ body: ... }` when needed):

```json
{
  "caseId": "string",
  "totalScore": 82,
  "breakdown": {
    "subjective": 20
  }
}
```

| Field | Constraints |
|---|---|
| `caseId` | 1–200 chars, non-empty |
| `totalScore` | Finite number, `0`–`100000` |
| `breakdown` | String-keyed record (arbitrary JSON values) |
| — | `.strict()` on inner body — unknown fields rejected |

**Success response (`200 OK`)**

Unified envelope:

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (empty `caseId`, NaN/Infinity score, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Best-effort persistence to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.
- Client: `lib/services/soapAnalyticsService.ts` (fire-and-forget sync after local storage).

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

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
| `examType` | `PANCE` \| `PANRE` \| `EOR` | `PANCE` |
| `scopeFilter.system` | Max 100 chars | — |
| `scopeFilter.conditionId` | Max 200 chars | — |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0,
        "selectionMethod": "unused_variant",
        "learningTarget": {},
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
      "total": 0,
      "withVariants": 0,
      "withSecondChance": 0,
      "examType": "PANCE"
    }
  },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Empty due state (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  },
  "traceId": "string",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown fields)
- `404` → envelope with `data: { "error": "User not found" }`
- `500` → envelope with `data: { "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (non-fatal on failure).

---

## Previously Documented (still valid)

These contracts were documented in an earlier pass and remain accurate:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user has admin access. |
| GET | `/api/admin/stats` | Admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | OSCE performance metrics and trend data. |

See git history for full admin/OSCE request/response shapes if needed.

## Validation Hardening (shared behavior)

Mutation endpoints in this pass export Zod schemas tested in `functions/api/__tests__/validation-hardening.test.ts`:

- Unknown fields are rejected via `.strict()`.
- String/url length caps prevent oversized payloads.
- Numeric fields reject `NaN` / `Infinity` and enforce bounded ranges.

Invalid payloads return `400` with `Validation failed: ...` from the shared middleware.
