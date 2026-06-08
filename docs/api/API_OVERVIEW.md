# API Overview

This document tracks request/response contracts for recently changed API routes and
shared API-facing runtime behavior. The June 2026 shared-runtime hardening did not
add a new product route, but it changed the behavior that API consumers and
operators rely on for the Sentry tunnel, Supabase configuration, Prisma runtime
setup, and Cloudflare compatibility-date parity.

## Changed Routes and Runtime Surfaces

| Method | Path | Description |
|---|---|---|
| POST | `/api/sentry-tunnel` | Proxies Sentry browser envelopes through PANaCEa's Cloudflare Pages Function, with project-ID validation and per-IP rate limiting. |
| OPTIONS | `/api/sentry-tunnel` | Handles CORS preflight for the Sentry tunnel. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/sentry-tunnel`

**Auth:** None. This endpoint is intentionally unauthenticated because it is called
by the browser Sentry SDK before or outside user-authenticated API flows.

**Rate limit:** 100 envelopes per minute per IP, tracked per Cloudflare isolate.

**Request headers**

| Header | Required | Description |
|---|---:|---|
| `Content-Type: application/x-sentry-envelope` | Recommended | Sentry SDK envelope content type. |

**Request body**

The body is a raw Sentry envelope: newline-delimited JSON/text owned by the
Sentry SDK. PANaCEa reads the first non-empty line as the envelope header and
accepts an optional `dsn`.

```json
{"dsn":"https://public-key@o4510664011087872.ingest.us.sentry.io/4510664023212032"}
{"type":"event"}
{"message":"example"}
```

**Success response**

Success is proxied directly from Sentry ingest, not wrapped in PANaCEa's normal
JSON success envelope.

- Status: Sentry ingest response status
- Body: Sentry ingest response body
- Headers: `Access-Control-Allow-Origin: *`, `Content-Type` from Sentry or
  `text/plain`

**Error responses**

Errors use the shared API error envelope:

```json
{
  "ok": false,
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Empty envelope body"
  },
  "code": "VALIDATION_FAILED",
  "message": "Empty envelope body",
  "traceId": "string",
  "timestamp": "2026-06-07T00:00:00.000Z"
}
```

- `400 VALIDATION_FAILED` -> empty envelope body, malformed envelope header, or
  invalid DSN format.
- `403 FORBIDDEN` -> envelope DSN resolves to a project ID other than
  `4510664023212032`.
- `429 RATE_LIMITED` -> more than 100 envelopes per minute for the same IP in
  the current isolate.
- `500 INTERNAL_ERROR` -> unexpected tunnel/proxy failure.

**Notes**

- The browser Sentry client uses `tunnel: "/api/sentry-tunnel"` only in
  production when `VITE_SENTRY_DSN` is configured.
- `reportActionError()` sends only unexpected user-action failures to Sentry.
  Expected auth/session messages such as "sign in", "unauthorized", or
  "session expired" still show a toast but are not reported as Sentry errors.
- The Sentry SDK transport suppresses tunnel-send failures after logging a debug
  message, so tunnel outages should not create console-noise cascades in the
  browser.

---

### `OPTIONS /api/sentry-tunnel`

**Auth:** None

**Request body:** None

**Success response (`204 No Content`)**

Headers:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

---

## Shared API Runtime Contracts

### Supabase client configuration

Shared Supabase client validation now uses `validateSupabaseConfigValues()` from
`lib/supabase/config.ts`.

| Consumer | Accepted environment values | Validation behavior |
|---|---|---|
| Server/shared anon client (`lib/supabase/client.ts`) | `SUPABASE_URL` or `VITE_SUPABASE_URL`; `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` | Requires a configured URL, anon key, and an `https://` URL. |
| Browser Clerk-aware client (`lib/supabaseClient.ts`) | `VITE_SUPABASE_URL`; `VITE_SUPABASE_ANON_KEY` | Reads `import.meta.env` in the browser and supports `globalThis.__TEST_VITE_ENV__` only for tests. |

Validation result shape:

```json
{
  "valid": false,
  "code": "MISSING_URL",
  "message": "Supabase URL is not configured"
}
```

Possible validation codes are `VALID`, `MISSING_URL`, `MISSING_ANON_KEY`, and
`INVALID_URL`. The browser Clerk-aware client disables Supabase's built-in auth
session persistence and injects `Authorization: Bearer <Clerk token>` on each
request when a token is available.

### Prisma runtime configuration

`lib/prisma.ts` remains Node/server-only shared code. It is not a Cloudflare
Pages Function handler and must not be imported into browser code.

| Environment | Connection behavior |
|---|---|
| `NODE_ENV=development`, `NODE_ENV=test`, or unset | Uses the Prisma PG adapter with `DIRECT_DATABASE_URL` when present, otherwise `DATABASE_URL`. Local connection strings are normalized before pool creation. |
| `NODE_ENV=production` | Uses Prisma Accelerate via `DATABASE_URL` and extends the client with `withAccelerate()`. |

If `DATABASE_URL` is missing, Prisma initialization throws a detailed
configuration error before any database query is attempted.

### Numeric analytics guardrail

`safeDivide(numerator, denominator, fallback = 0)` is the shared guard for
analytics/scoring ratios. It returns the fallback when either input is non-finite
or the denominator is zero. Error diagnostics and fluency scoring use this guard
for `latencyRatio` and stability calculations, so serialized scoring payloads no
longer surface `Infinity` or `NaN` from divide-by-zero edge cases.

### Cloudflare compatibility-date parity

The Pages runtime compatibility date is `2025-12-15` in `wrangler.toml`,
`npm run pages:serve`, `npm run pages:dev`, and the advisory CI Wrangler smoke
command. `npm run env:check:compat-date` runs
`scripts/validate-compatibility-date.mjs`, which fails when `wrangler.toml` and
`.github/workflows/ci.yml` drift or contain an invalid `YYYY-MM-DD` date.

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
