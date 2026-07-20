# API Overview

This document tracks the request/response contracts for the most recently
changed API routes and the shared response-envelope conventions used by
Cloudflare Pages Functions.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists OSCE telemetry on the session. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Response Envelope Contract

The active non-streaming Cloudflare Pages Functions contract is the unified
API envelope implemented in `functions/api/_shared/api-response.ts`.

### Server-side shape

Use `ok()`, `fail()`, and `ErrorCode` for new or touched `functions/api/*`
handlers:

```ts
import { ok, fail, ErrorCode } from '../_shared/api-response'; // adjust relative depth

return ok({ totalDue: 12 });
return ok({ id: goal.id }, { status: 201 });
return fail(ErrorCode.VALIDATION_FAILED, {
  message: 'At least one update field is required',
  details: validationErrors,
});
```

Success responses are shaped as:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "uuid-or-request-id",
  "timestamp": "2026-07-20T16:00:00.000Z"
}
```

The same `traceId` is also emitted as `X-Request-ID` and `X-Trace-ID`
headers for log/Sentry correlation.

Error responses are shaped as:

```json
{
  "ok": false,
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": []
  },
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "traceId": "uuid-or-request-id",
  "timestamp": "2026-07-20T16:00:00.000Z"
}
```

`success`, top-level `code`, top-level `message`, and top-level `details` are
backward-compatible aliases. New client code should prefer `ok` and
`error.code`/`error.message`.

### Handler wrappers

- `withEndpoint()` in `functions/api/_shared/endpoint.ts` is the preferred
  declarative builder for new simple endpoints.
- Existing `authenticatedEndpoint`, `adminAuthenticatedEndpoint`,
  `aiEndpoint`, `publicEndpoint`, `cmsEndpoint`, and `refineryEndpoint` stacks
  return legacy handler objects (`{ data }` or `{ error }`) but are converted
  by `middleware.ts` through `envelopeFromHandlerResult()`.
- `cronEndpoint()` verifies `CRON_SECRET`, validates payload/query/params when
  a schema is provided, and returns the same envelope.
- `jsonSuccess()` and `jsonError()` in `_shared/response.ts` are deprecated
  aliases that delegate to `ok()`/`fail()`.

### Client-side usage

Frontend code that calls PANaCEa internal `/api/*` routes should unwrap the
server envelope through `lib/utils/apiEnvelope.ts`:

```ts
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

const response = await fetch('/api/srs/due', {
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});

const json = await response.json();
if (!response.ok) {
  throw new Error(getApiEnvelopeError(json, `Request failed: ${response.status}`));
}

const payload = unwrapApiEnvelope<{ totalDue: number; items: unknown[] }>(json);
```

`unwrapApiEnvelope<T>()` intentionally unwraps one level only:

- `{ ok: true, data: T }` -> `T`
- `{ success: true, data: T }` -> `T`
- bare payloads -> returned unchanged
- `{ ok: false, error }` or `{ success: false, error }` -> throws

Do not hand-roll `json.data ?? json` at new call sites. That pattern loses
structured error messages and breaks when endpoints migrate from legacy
`success` envelopes to canonical `ok` envelopes.

### Exceptions and checks

- Streaming routes, Sentry tunnel payloads, and multipart upload/proxy routes
  may intentionally use non-standard body protocols. Verify the route source
  before forcing Zod or the JSON envelope onto those paths.
- External provider calls from `scripts/` or service integrations parse the
  provider's response shape, not PANaCEa's envelope.
- To find internal frontend callers that still read raw `response.json()`
  without an envelope helper, run:

```bash
node scripts/audit-api-envelope-callers.mjs --fail-on-findings
```

Regression coverage for the client helper lives in
`tests/lib/utils/apiEnvelope.test.ts` and `lib/utils/apiEnvelope.test.ts`.

## Endpoint Contracts

Unless a route explicitly returns a raw `Response`, handlers behind the shared
middleware return the envelope described above. The route-specific examples
below focus on the domain payload inside `data`.

### `GET /api/admin/check-access`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success payload (`200 OK`)**

```json
{
  "hasAccess": true,
  "role": "admin"
}
```

`role` can be `admin` or `superadmin`.

**Access-denied payload (`403`)**

```json
{
  "hasAccess": false,
  "role": "user"
}
```

**Error responses**

- `500` → envelope error with message `Internal server error`

**Notes**

- Access is resolved in this order: `SUPERADMIN_USER_IDS`/`ADMIN_USER_IDS`
  env values first, then database role lookup when `DATABASE_URL` is present.
- This endpoint intentionally uses `authenticatedEndpoint`, not
  `adminAuthenticatedEndpoint`, so non-admin users can receive a structured
  negative access probe instead of a hard authz failure.
- The response intentionally omits email and internal user IDs.

---

### `GET /api/admin/stats`

**Auth:** Required (admin-authenticated endpoint)

**Request body:** None

**Success payload (`200 OK`)**

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

**Non-success status payloads**

- `403` → payload `{ "error": "Admin access required" }`
- `500` → payload `{ "error": "Failed to fetch admin stats" }`

**Notes**

- If `DATABASE_URL` is missing, returns zeroed stats with `note: "Database not configured"`.
- The implementation currently returns a nested legacy payload
  `{ success: true, data: { ... } }` inside the outer shared envelope.

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
    "osceTelemetry": {
      "totalTimeMs": 120000,
      "clinicalConfidenceIndex": 3,
      "redFlagsMissed": 0,
      "unnecessaryOrders": 1,
      "implicitRating": {
        "rating": 1,
        "confidence": 0.82,
        "components": {}
      },
      "efficiencyScore": 0.74,
      "speechMetrics": {},
      "diagnosticEfficiency": {},
      "rapportMetrics": {},
      "actionCount": 12
    }
  }
}
```

**Success responses**

- `200 OK` → `{ "success": true }`
- `200 OK` (idempotent repeat) → `{ "success": true, "alreadyCompleted": true }`

**Envelope error responses**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- Completion updates `PatientEncounterSession.status`, optional diagnosis,
  optional treatment plan, `completedAt`, and optional `osceTelemetry`.
- The route is idempotent when the session is already `completed`.
- It does not create `ReviewLog`; OSCE grading persists `OsceResult` through
  `/api/osce/analysis/grade`.

---

### `GET /api/osce/stats`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success payload (`200 OK`)**

```json
{
  "totalEncounters": 1,
  "passRate": 100,
  "averageScore": 82,
  "averageClinicalReasoningScore": 80,
  "averageCommunicationScore": 78,
  "averageDifferentialScore": 84,
  "totalDangerousActions": 0,
  "trend": [
    {
      "sessionId": "string",
      "date": "2026-01-01T00:00:00.000Z",
      "score": 82,
      "clinicalReasoningScore": 80,
      "communicationScore": 78,
      "differentialScore": 84,
      "dangerousActionCount": 0
    }
  ]
}
```

**Envelope error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to load OSCE stats" }`

**Notes**

- Metrics are computed from completed `PatientEncounterSession` rows that have an `OsceResult`.
- Pass threshold is score `>= 70`.
- Average metrics are `null` when no scored encounters exist.
