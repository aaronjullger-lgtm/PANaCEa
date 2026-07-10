# API Overview

This document tracks the unified response envelope and the request/response contracts for recently changed API routes.

**Source of truth:** `functions/api/_shared/api-response.ts` (envelope helpers) and `functions/api/_shared/error-catalog.ts` (error codes).

---

## Unified Response Envelope

All non-streaming responses from middleware-wrapped endpoints (`authenticatedEndpoint`, `adminAuthenticatedEndpoint`, `publicEndpoint`, `aiEndpoint`, etc.) are serialized through `envelopeFromHandlerResult()` in `functions/api/_shared/middleware.ts`.

### Success (`2xx`)

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "uuid-or-fallback",
  "timestamp": "2026-07-10T12:00:00.000Z",
  "message": "optional success message"
}
```

### Error (non-`2xx`)

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Human-readable message",
    "details": {}
  },
  "success": false,
  "code": "NOT_FOUND",
  "message": "Human-readable message",
  "details": {},
  "traceId": "uuid-or-fallback",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

### Response headers

| Header | When set | Purpose |
|---|---|---|
| `Content-Type` | Always | `application/json; charset=utf-8` |
| `X-Request-ID` | Always | Same value as `traceId` in the JSON body |
| `X-Trace-ID` | Always | Same value as `traceId` in the JSON body |
| `Sentry-Trace` | When request includes `sentry-trace` | Forwards the inbound Sentry trace for correlation |
| `Retry-After` | `429` rate-limit responses | Seconds until retry (from `fail(..., { retryAfterSeconds })`) |

### Error codes

Stable codes are defined in `functions/api/_shared/error-catalog.ts` (`ErrorCode` enum). Common values:

| Code | Default status | Default message |
|---|---|---|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `VALIDATION_FAILED` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `GEMINI_ERROR` | 502 | Gemini API error |

Unknown error codes passed to `fail()` collapse to `ERROR` (500).

### Legacy compatibility fields

The envelope emits backward-compatible aliases while older consumers migrate:

- `success` mirrors `ok`
- Top-level `code`, `message`, and `details` mirror `error.code`, `error.message`, and `error.details`

Deprecated helpers `jsonSuccess()` and `jsonError()` delegate to `ok()` and `fail()` respectively.

### Legacy handler-data normalization

Handlers may return `{ data: { success: true, data: { ... } } }` (a nested legacy envelope). Before wrapping, `envelopeFromHandlerResult()` calls `unwrapLegacySuccessData()` to peel one layer so clients receive a single canonical envelope:

```
Handler returns:  { data: { success: true, data: { items: [1,2,3] } } }
Client receives:  { ok: true, success: true, data: { items: [1,2,3] }, traceId, timestamp }
```

Normalization applies when the inner object has `data` plus `ok: true` or `success: true`. Bare payloads are wrapped as-is.

### Client unwrapping

Frontend callers should use `unwrapApiEnvelope()` from `lib/utils/apiEnvelope.ts` to read `data` and surface `error.message` consistently.

### Exceptions (non-envelope responses)

These endpoints intentionally bypass the unified envelope:

- **Streaming:** `/api/gemini/stream`, `/api/ai/chat/stream` (SSE)
- **Webhooks:** `/api/webhooks/clerk` (provider-specific shape)
- **Sentry tunnel:** `/api/sentry-tunnel` (`application/x-sentry-envelope`)
- **Cron triggers:** some cron handlers return minimal `{ ok: true }` without full envelope (migration in progress)

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| *(shared)* | `functions/api/_shared/api-response.ts` | Unified envelope helpers (`ok`, `fail`, `envelopeFromHandlerResult`) and legacy normalization |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems) |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and persists optional telemetry on the session |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores |

---

## Endpoint Contracts

### `GET /api/admin/check-access`

**Auth:** Required (`authenticatedEndpoint` — non-admins receive a structured denial, not a raw 403 from the wrapper)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "hasAccess": true,
    "role": "admin"
  },
  "traceId": "…",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

`role` is `admin`, `superadmin`, or `user`.

**Denied access (`403`)**

```json
{
  "ok": false,
  "error": { "code": "ERROR", "message": "…" },
  "success": false,
  "code": "ERROR",
  "message": "…",
  "data": {
    "hasAccess": false,
    "role": "user"
  },
  "traceId": "…",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

Note: denied responses still include `data.hasAccess: false` inside the envelope because the handler returns `{ status: 403, data: { hasAccess: false, role: 'user' } }`.

**Error responses**

- `500` → `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Internal server error" }, … }`

**Notes**

- Access is resolved in this order: `SUPERADMIN_USER_IDS` / `ADMIN_USER_IDS` env values first, then database role lookup.
- PII (`email`, internal `userId`) is intentionally omitted from the response.

---

### `GET /api/admin/stats`

**Auth:** Required (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

The handler returns a nested legacy envelope; middleware normalizes it before the client sees it.

```json
{
  "ok": true,
  "success": true,
  "data": {
    "totalUsers": 0,
    "activeUsersToday": 0,
    "totalStudySessions": 0,
    "averageAccuracy": 0,
    "popularSystems": [
      { "system": "string", "count": 0 }
    ],
    "pendingFlags": 0
  },
  "traceId": "…",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

**Error responses**

- `403` → `{ "ok": false, "error": { "code": "ERROR", "message": "Admin access required" }, … }`
- `500` → `{ "ok": false, "error": { "code": "ERROR", "message": "Failed to fetch admin stats" }, … }`

**Notes**

- If `DATABASE_URL` is missing, returns zeroed stats with `note: "Database not configured"` inside `data`.

---

### `POST /api/osce/complete`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "string (optional)",
    "treatmentPlan": "string (optional)",
    "osceTelemetry": {
      "totalTimeMs": 0,
      "clinicalConfidenceIndex": 1,
      "redFlagsMissed": 0,
      "unnecessaryOrders": 0,
      "implicitRating": { "rating": 0, "confidence": 0 },
      "efficiencyScore": 0,
      "speechMetrics": {},
      "diagnosticEfficiency": {},
      "rapportMetrics": {},
      "actionCount": 0
    }
  }
}
```

**Success responses**

- `200 OK` (first completion):

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "…",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

- `200 OK` (idempotent repeat):

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true, "alreadyCompleted": true },
  "traceId": "…",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

**Error responses**

- `404` → `{ "ok": false, "error": { "code": "NOT_FOUND", "message": "User not found" }, … }` or `"Session not found"`
- `500` → `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Internal server error" }, … }`

**Notes**

- Writes only to `PatientEncounterSession` (status, diagnosis, treatmentPlan, optional `osceTelemetry`).
- Does **not** create `ReviewLog`. Grading is handled separately via `POST /api/osce/analysis/grade`.

---

### `GET /api/osce/stats`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "totalEncounters": 0,
    "passRate": 0,
    "averageScore": 0,
    "averageClinicalReasoningScore": 0,
    "averageCommunicationScore": 0,
    "averageDifferentialScore": 0,
    "totalDangerousActions": 0,
    "trend": [
      {
        "sessionId": "string",
        "date": "2026-01-01T00:00:00.000Z",
        "score": 0,
        "clinicalReasoningScore": 0,
        "communicationScore": 0,
        "differentialScore": 0,
        "dangerousActionCount": 0
      }
    ]
  },
  "traceId": "…",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

**Error responses**

- `404` → `{ "ok": false, "error": { "code": "NOT_FOUND", "message": "User not found" }, … }`
- `500` → `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Failed to load OSCE stats" }, … }`

**Notes**

- Metrics are computed from completed `PatientEncounterSession` rows that have an `OsceResult`.
- Pass threshold is score `>= 70`.
- Nullable aggregates (`passRate`, `averageScore`, etc.) return `null` when there is no scored data.
