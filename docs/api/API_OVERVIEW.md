# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/run` | Runs the general-purpose student agent loop (Gemini tool-calling) and returns the final answer. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint` — Clerk bearer token)

**Rate limit:** 25 requests/minute per user (AI endpoint default; fails closed if rate-limit KV is unavailable)

**Request body**

```json
{
  "message": "string (required, 1–4000 chars)",
  "allowedTools": ["clinical_library_search"],
  "allowedCategories": ["read"],
  "maxIterations": 6,
  "model": "string (optional Gemini model override)",
  "temperature": 0.2,
  "maxOutputTokens": 2048,
  "userContext": {
    "currentRotation": "string | null",
    "examDate": "string | null",
    "focusSystem": "string | null"
  },
  "includeSteps": false
}
```

| Field | Required | Default | Notes |
|---|---|---|---|
| `message` | Yes | — | Student prompt. |
| `allowedTools` | No | All `DEFAULT_TOOL_NAMES` | Up to 16 tool names. When omitted or empty, uses the full default set: `clinical_library_search`, `user_progress_summary`, `fsrs_due_count`, `blueprint_coverage_check`, `content_health_audit`, `question_quality_check`, `condition_verify`, `database_integrity_check`, `fsrs_calibration_status`, `drill_coverage_check`. |
| `allowedCategories` | No | `["read"]` | Tool categories permitted: `read`, `compute`, `write`. |
| `maxIterations` | No | Runner default (6) | Clamped to 1–10 at the endpoint. |
| `model` | No | `FLASH_2_5` | Gemini model override. |
| `temperature` | No | `0.2` | Range 0–1. |
| `maxOutputTokens` | No | Runner default (2048) | Range 256–4096. |
| `userContext` | No | — | Optional rotation/exam/focus hints injected into the system prompt. |
| `includeSteps` | No | `false` | When `true`, includes the full `steps[]` transcript (debug/observability). |

**Success response (`200 OK`)**

Envelope: `{ "data": { ... } }` (see `functions/api/_shared/api-response.ts`).

```json
{
  "data": {
    "finalText": "string",
    "stopReason": "completed",
    "iterations": 2,
    "tokensUsed": {
      "input": 0,
      "output": 0,
      "total": 0
    },
    "durationMs": 0,
    "error": {
      "message": "string",
      "code": "string"
    },
    "steps": []
  }
}
```

`stopReason` is one of: `completed`, `max_iterations`, `tool_error`, `model_error`, `safety_block`, `aborted`.

`error` is present when `stopReason` indicates a non-successful stop. `steps` is omitted unless `includeSteps: true`.

**Error responses**

- `400` → `{ "error": "Validation failed: …" }` or `{ "error": "Invalid JSON in request body" }`
- `401` → `{ "error": "Authentication required" }`
- `429` → Rate limit exceeded (AI endpoint)
- `500` → `{ "error": "Agent run failed" }` (infrastructure/unhandled fault)

**Notes**

- Non-completed agent runs still return `200` with a `stopReason` other than `completed`; clients render failure UI from `stopReason` / `error`. `5xx` is reserved for infra faults.
- Default tool allowlist is read-only clinical/study tools; `write` tools require `allowedCategories` to include `write`.
- Primary consumer: `components/agents/AgentChat.tsx` (sends `includeSteps: true` for the trace panel).
- Distinct from `POST /api/agents/invoke` (LangGraph orchestrator bridge) and `POST /api/agents/runs` (background run lifecycle).

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
