# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/run` | Runs the general-purpose Gemini agent loop with an optional tool allow-list and returns the final answer. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint` — Clerk bearer token)

**Rate limit:** 25 requests/min per user (Gemini cost guard)

**Request body**

```json
{
  "message": "string (required, 1–4000 chars)",
  "allowedTools": ["clinical_library_search", "user_progress_summary"],
  "allowedCategories": ["read"],
  "maxIterations": 6,
  "model": "optional-gemini-model-id",
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
| `message` | Yes | — | Student prompt for the agent. |
| `allowedTools` | No | All 10 built-in tools (see below) | Max 16 tool names per run. |
| `allowedCategories` | No | `["read"]` | Permitted tool categories: `read`, `compute`, `write`. |
| `maxIterations` | No | Runner default (6) | Clamped to 1–10. |
| `model` | No | `FLASH_2_5` | Gemini model override. |
| `temperature` | No | `0.2` | Range 0–1. |
| `maxOutputTokens` | No | `2048` | Range 256–4096. |
| `userContext` | No | — | Injected into the system prompt for personalization. |
| `includeSteps` | No | `false` | When `true`, includes the full `steps[]` transcript. |

**Success response (`200 OK`)**

Envelope: `{ ok: true, data: { … }, traceId, timestamp }`

```json
{
  "ok": true,
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
      "message": "optional-string",
      "code": "optional-string"
    },
    "steps": []
  },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`stopReason` is one of: `completed`, `max_iterations`, `tool_error`, `model_error`, `safety_block`, `aborted`.

`steps` is omitted unless `includeSteps: true`. Each step has `iteration`, `role` (`user` | `model` | `tool`), `parts[]`, and optional `durationMs`.

**Error responses**

- `401` → Unauthorized (missing or invalid Clerk token)
- `429` → Rate limit exceeded (25 req/min per user)
- `500` → `{ "ok": false, "error": { "code": "…", "message": "Agent run failed" } }`

**Notes**

- Non-completed runs still return `200` with a `stopReason` other than `completed`; clients render the failure surface-side. `5xx` is reserved for infrastructure faults.
- The endpoint builds its tool registry via `createDefaultToolRegistry()` from `lib/services/agents/toolRegistry.ts` (lazy-import to avoid circular deps with `tools/index.ts`).
- Default `allowedCategories: ["read"]` enforces clinical safety — all 10 built-in tools are read-only.
- Frontend consumer: `components/agents/AgentChat.tsx` (sends `includeSteps: true` for the reasoning panel).

**Built-in tools** (all `category: "read"`)

| Tool name | Domain |
|---|---|
| `clinical_library_search` | Student — condition knowledge base search |
| `user_progress_summary` | Student — per-user study progress |
| `fsrs_due_count` | Student — FSRS due-card count |
| `content_health_audit` | Quality — content health scan |
| `question_quality_check` | Quality — question validation |
| `condition_verify` | Quality — condition record verification |
| `blueprint_coverage_check` | Coverage — NCCPA blueprint gaps |
| `drill_coverage_check` | Coverage — drill-type coverage |
| `database_integrity_check` | Infrastructure — DB integrity probes |
| `fsrs_calibration_status` | Infrastructure — FSRS calibration metrics |

Registry factories (shared library, not HTTP):

- `createDefaultToolRegistry()` — all 10 tools (`toolRegistry.ts` or `tools/index.ts`)
- `createClinicalToolRegistry()` — 3 student-facing tools
- `createQualityToolRegistry()` — 3 content-quality tools
- `createInfraToolRegistry()` — 2 infrastructure tools (`tools/index.ts` only)

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
