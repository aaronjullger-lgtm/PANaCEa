# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/run` | Runs the PANaCEa tool-using agent loop to completion and returns the final answer. |
| POST | `/api/agents/runs` | Creates a background agent run (Agent Protocol). |
| GET | `/api/agents/runs` | Lists in-memory runs, or returns/waits on a run when `{run_id}` is present in the path. |
| POST | `/api/agents/threads` | Creates a multi-turn conversation thread (Agent Protocol). |
| GET | `/api/agents/threads` | Lists in-memory threads, fetches one by ID, or returns revision history via `/history`. |
| PATCH | `/api/agents/threads/{thread_id}` | Merges `values` / `metadata` into a thread and appends a history revision. |
| DELETE | `/api/agents/threads/{thread_id}` | Deletes a thread from the in-memory store. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint` — Clerk bearer token)

**Rate limit:** 25 requests/minute per user (AI route; fails closed if rate-limit KV is unavailable)

**Request body**

```json
{
  "message": "string (required, 1–4000 chars)",
  "allowedTools": ["clinical_library_search"],
  "allowedCategories": ["read"],
  "maxIterations": 6,
  "model": "string",
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

**Success response (`200 OK`)** — middleware envelope

```json
{
  "data": {
    "finalText": "string",
    "stopReason": "completed",
    "iterations": 1,
    "tokensUsed": { "input": 0, "output": 0, "total": 0 },
    "durationMs": 0,
    "error": { "message": "string", "code": "string" },
    "steps": []
  }
}
```

`stopReason` is one of: `completed`, `max_iterations`, `tool_error`, `model_error`, `safety_block`, `aborted`. The `error` and `steps` fields are omitted unless applicable; `steps` is only returned when `includeSteps: true`.

**Error responses**

- `401` → unauthorized (missing/invalid Clerk token)
- `429` → rate limit exceeded
- `500` → `{ "error": "Agent run failed" }`

**Notes**

- Default `allowedTools` when omitted: `clinical_library_search`, `user_progress_summary`, `fsrs_due_count`, `blueprint_coverage_check`, `content_health_audit`, `question_quality_check`, `condition_verify`, `database_integrity_check`, `fsrs_calibration_status`, `drill_coverage_check`.
- Default `allowedCategories`: `["read"]` (write tools require explicit allowance).
- Non-completed agent runs still return `200` with a `stopReason`; infrastructure faults use `5xx`.

---

### Agent Protocol — `/api/agents/runs` and `/api/agents/threads`

Implements a subset of the [LangChain Agent Protocol](https://langchain-ai.github.io/agent-protocol/api.html). Types live in `lib/agents/protocol/types.ts`. Handlers use `authenticatedEndpoint` from `functions/api/_shared/middleware` (300 req/min default).

**Storage:** In-memory `Map` stores inside the Edge isolate — data does not persist across requests or workers. Production should back these with D1/KV.

#### `POST /api/agents/runs`

**Request body**

```json
{
  "thread_id": "optional-string",
  "agent_id": "optional-string",
  "input": { "message": "required payload" },
  "config": { "model": "string", "temperature": 0.2, "stream": false },
  "metadata": {}
}
```

**Success response (`201 Created`)**

```json
{
  "run_id": "32-char-hex",
  "thread_id": "32-char-hex",
  "status": "pending"
}
```

**Error responses**

- `400` → `{ "error": "input is required" }`
- `500` → `{ "error": "string" }`

#### `GET /api/agents/runs`

| Path | Behavior |
|---|---|
| `/api/agents/runs` | `{ "data": [Run], "total": number }` — list all in-memory runs |
| `/api/agents/runs/{run_id}` | Full `Run` object |
| `/api/agents/runs/{run_id}/wait` | Poll up to 60s; returns `RunWaitResponse` when terminal or on timeout |

`Run.status`: `pending` \| `running` \| `success` \| `error` \| `cancelled` \| `interrupted`.

**Error responses**

- `404` → `{ "error": "Run not found: {run_id}" }`

**Not yet implemented:** `POST /api/agents/runs/wait`, `POST /api/agents/runs/{run_id}/cancel`.

#### `POST /api/agents/threads`

**Request body**

```json
{
  "thread_id": "optional-string",
  "values": {},
  "metadata": {}
}
```

**Success response (`201 Created`)** — `Thread` object:

```json
{
  "thread_id": "string",
  "status": "idle",
  "values": {},
  "messages": [],
  "metadata": {},
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

**Error responses**

- `409` → `{ "error": "Thread already exists: {thread_id}" }`
- `500` → `{ "error": "string" }`

#### `GET /api/agents/threads`

| Path | Behavior |
|---|---|
| `/api/agents/threads` | `{ "data": [Thread], "total": number }` |
| `/api/agents/threads/{thread_id}` | `Thread` object |
| `/api/agents/threads/{thread_id}/history` | `{ "data": [ThreadHistoryEntry], "total": number }` |

**Error responses**

- `404` → `{ "error": "Thread not found: {thread_id}" }`

#### `PATCH /api/agents/threads/{thread_id}`

**Request body**

```json
{
  "values": {},
  "metadata": {}
}
```

Merges into the existing thread and snapshots the prior state into `history`. Returns the updated `Thread` (`200 OK`).

**Error responses**

- `400` → `{ "error": "thread_id is required" }`
- `404` → `{ "error": "Thread not found: {thread_id}" }`

#### `DELETE /api/agents/threads/{thread_id}`

**Success response (`200 OK`)**

```json
{
  "deleted": true,
  "thread_id": "string"
}
```

**Not yet implemented:** `POST /api/agents/threads/search`.

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
