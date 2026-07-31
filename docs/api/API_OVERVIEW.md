# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |
| GET | `/api/agents/health` | Reports agent registry, MCP server, model, and capability health for ops dashboards. |
| POST | `/api/agents/mcp` | Serves the PANaCEa MCP server over JSON-RPC 2.0 (streamable HTTP transport). |
| OPTIONS | `/api/agents/mcp` | CORS preflight for the MCP endpoint. |
| POST | `/api/agents/invoke` | Dispatches a named encounter-tier LangGraph agent with typed input/output. |
| POST | `/api/agents/invoke/stream` | SSE lifecycle streaming variant of `/api/agents/invoke`. |
| POST | `/api/agents/run` | Runs the legacy Gemini tool-using agent loop to completion. |
| POST | `/api/agents/runs` | Creates a background Agent Protocol run (in-memory store; Edge prototype). |
| GET | `/api/agents/runs` | Lists in-memory Agent Protocol runs. |
| GET | `/api/agents/runs/{run_id}` | Returns Agent Protocol run status and output. |
| GET | `/api/agents/runs/{run_id}/wait` | Polls until a run completes or times out (60s). |
| POST | `/api/agents/threads` | Creates an Agent Protocol conversation thread. |
| GET | `/api/agents/threads` | Lists in-memory Agent Protocol threads. |
| GET | `/api/agents/threads/{thread_id}` | Returns thread state (values, messages, metadata). |
| GET | `/api/agents/threads/{thread_id}/history` | Returns append-only thread revision history. |
| PATCH | `/api/agents/threads/{thread_id}` | Merges values/metadata and snapshots a history revision. |
| DELETE | `/api/agents/threads/{thread_id}` | Deletes a thread from the in-memory store. |
| POST | `/api/agents/quality-check` | Admin agent loop for content quality and verification tools. |
| POST | `/api/agents/coverage-audit` | Admin agent loop for NCCPA blueprint and drill coverage tools. |
| POST | `/api/agents/infra-health` | Admin agent loop for database integrity and FSRS health tools. |
| POST | `/api/agents/verify-condition` | Admin agent loop targeting a single condition for clinical verification. |

---

## Agent Orchestration (`/api/agents/*`)

Production agent routes live under `functions/api/agents/`. Two execution models coexist:

| Model | Endpoints | Runtime |
|---|---|---|
| **LangGraph dispatch** | `/invoke`, `/invoke/stream` | `lib/agents/registry.encounter` — encounter-tier agents only |
| **Gemini tool loop** | `/run`, `/quality-check`, `/coverage-audit`, `/infra-health`, `/verify-condition` | `lib/services/agents/agentRunner` |
| **Agent Protocol** | `/runs`, `/threads` | In-memory prototype of the [LangChain Agent Protocol](https://langchain-ai.github.io/agent-protocol/api.html) |
| **MCP bridge** | `/mcp` | `lib/agents/mcp/server` — JSON-RPC tool server |
| **Ops introspection** | `/health` | Registry, MCP, model, and capability summary |

**Auth summary:** `/health`, `/invoke*`, `/run`, and admin tool-loop endpoints require Clerk auth. `/mcp` is unauthenticated (system-level tools). `/runs` and `/threads` require Clerk auth.

**Storage note:** `/runs` and `/threads` use per-isolate in-memory `Map` stores. State does not persist across Cloudflare isolates or cold starts. Treat as prototype infrastructure until backed by D1/KV.

### `GET /api/agents/health`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2026-07-31T00:00:00.000Z",
    "summary": {
      "totalAgents": 0,
      "productionReady": 0,
      "byTier": {},
      "byCapability": {},
      "byStrategy": {},
      "totalTools": 0
    },
    "providers": {
      "gemini": true,
      "openai": false,
      "anthropic": false,
      "deepseek": false,
      "deepinfra": false,
      "openrouter": false
    },
    "availableProviders": ["gemini"],
    "agents": [
      {
        "name": "string",
        "tier": "encounter",
        "description": "string",
        "available": true,
        "capabilities": [],
        "strategy": "single-invoke",
        "tools": [],
        "productionReady": false
      }
    ],
    "mcp": {
      "servers": [
        {
          "name": "string",
          "transport": "stdio",
          "status": "configured",
          "toolCount": 0,
          "toolNames": [],
          "required": false
        }
      ],
      "totalServers": 0,
      "totalTools": 0
    },
    "models": [
      { "name": "string", "provider": "gemini", "available": true }
    ],
    "tasks": [
      {
        "task": "string",
        "primaryModel": "string",
        "fallbackModels": [],
        "primaryAvailable": true
      }
    ]
  }
}
```

`status` is `healthy` when at least one AI provider and one registered agent exist; `degraded` when agents exist but no provider is configured; `unhealthy` when no agents are registered.

---

### `POST /api/agents/mcp`

**Auth:** None (system-level MCP server)

**Request body:** JSON-RPC 2.0 envelope (MCP streamable HTTP transport)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Success responses**

- `200 OK` → JSON-RPC result object
- `202 Accepted` → notification request (no response body)

**Error responses**

- `400` → `{ "jsonrpc": "2.0", "id": 0, "error": { "code": -32700, "message": "Parse error" } }`
- `500` → `{ "jsonrpc": "2.0", "id": 0, "error": { "code": -32603, "message": "Internal error: ..." } }`

**Notes**

- CORS enabled for `POST` and `OPTIONS`.
- DB-dependent tools return errors when Prisma is not wired into the tool context.

---

### `POST /api/agents/invoke`

**Auth:** Required (`aiEndpoint`, 25 req/min)

**Request body**

```json
{
  "agent": "spbench-grader",
  "input": {}
}
```

`agent` must be an encounter-tier name from `lib/agents/registry.encounter`. `input` is agent-specific (validated by each agent's Zod schema) and capped at 256 KB serialized.

**Success response (`200 OK`)**

```json
{
  "data": {
    "agent": "spbench-grader",
    "status": "ok",
    "output": {},
    "durationMs": 1234,
    "telemetry": {}
  }
}
```

**Error responses**

- `400` → schema validation or agent input errors (`status: "schema_invalid"` / `"no_input"`)
- `403` → ops-tier or unknown agent name
- `404` → agent not found in registry
- `422` → `status: "safety_blocked"`
- `429` → `status: "rate_limited"`
- `500` → agent execution failure

**Notes**

- Distinct from `/api/agents/run` (Gemini tool loop). Use `/invoke` for typed LangGraph agents.
- When `input.sessionId` is provided and the agent is `spbench-grader`, scores are persisted to `SpbenchScore` after an ownership check on the OSCE session.

---

### `POST /api/agents/invoke/stream`

**Auth:** Required (`aiEndpoint`, 25 req/min)

**Request body:** Same as `/api/agents/invoke`.

**Success response (`200 OK`, `text/event-stream`)**

SSE lifecycle events (not token-level streaming):

```
event: agent_started
data: {"agent":"spbench-grader"}

event: agent_completed
data: {"agent":"spbench-grader","status":"ok","output":{},"durationMs":1234,"telemetry":{}}

event: agent_error
data: {"agent":"spbench-grader","status":"internal_error","error":{"status":"internal_error","message":"..."},"durationMs":0}
```

---

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint`)

**Request body**

```json
{
  "message": "string (1–4000 chars, required)",
  "allowedTools": ["clinical_library_search"],
  "allowedCategories": ["read"],
  "maxIterations": 5,
  "model": "optional-gemini-model",
  "temperature": 0.2,
  "maxOutputTokens": 1024,
  "userContext": {
    "currentRotation": "string",
    "examDate": "string",
    "focusSystem": "string"
  },
  "includeSteps": false
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "finalText": "string",
    "stopReason": "completed",
    "iterations": 1,
    "tokensUsed": { "prompt": 0, "completion": 0, "total": 0 },
    "durationMs": 1234,
    "error": { "code": "string", "message": "string" },
    "steps": []
  }
}
```

`error` and `steps` are optional. Non-completed runs still return `200` with a `stopReason`; `500` is reserved for infrastructure faults.

**Default tools:** `clinical_library_search`, `user_progress_summary`, `fsrs_due_count` (read-only categories).

---

### Agent Protocol — `/api/agents/runs`

Implements a subset of the [Agent Protocol runs API](https://langchain-ai.github.io/agent-protocol/api.html). Types are defined in `lib/agents/protocol/types.ts`.

#### `POST /api/agents/runs`

**Auth:** Required

**Request body**

```json
{
  "thread_id": "optional-existing-thread-id",
  "agent_id": "optional-agent-name",
  "input": { "message": "required payload" },
  "config": {},
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
- `500` → `{ "error": "message" }`

#### `GET /api/agents/runs`

**Auth:** Required

**Success response (`200 OK`)**

```json
{
  "data": [
    {
      "run_id": "string",
      "thread_id": "string",
      "agent_id": "string",
      "status": "pending",
      "input": {},
      "output": {},
      "error": "string",
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601",
      "completed_at": "ISO-8601",
      "metadata": {}
    }
  ],
  "total": 0
}
```

#### `GET /api/agents/runs/{run_id}`

Returns a single `Run` object (same shape as list items). `404` when not found.

#### `GET /api/agents/runs/{run_id}/wait`

Polls every 500 ms for up to 60 s.

**Success response (`200 OK`)**

```json
{
  "run_id": "string",
  "thread_id": "string",
  "status": "success",
  "output": {},
  "error": "optional timeout or run error message"
}
```

**Planned (not yet routed):** `POST /api/agents/runs/wait` (stateless create-and-wait), `POST /api/agents/runs/{run_id}/cancel`.

---

### Agent Protocol — `/api/agents/threads`

#### `POST /api/agents/threads`

**Auth:** Required

**Request body**

```json
{
  "thread_id": "optional-custom-id",
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

- `409` → `{ "error": "Thread already exists: {id}" }`

#### `GET /api/agents/threads`

Lists all threads: `{ "data": [Thread], "total": N }`.

#### `GET /api/agents/threads/{thread_id}`

Returns a single `Thread`. `404` when not found.

#### `GET /api/agents/threads/{thread_id}/history`

```json
{
  "data": [
    {
      "revision_id": "string",
      "thread_id": "string",
      "values": {},
      "messages": [],
      "created_at": "ISO-8601",
      "run_id": "optional"
    }
  ],
  "total": 0
}
```

#### `PATCH /api/agents/threads/{thread_id}`

**Request body**

```json
{
  "values": {},
  "metadata": {}
}
```

Merges into existing state and appends a history revision. Returns updated `Thread`.

#### `DELETE /api/agents/threads/{thread_id}`

```json
{ "deleted": true, "thread_id": "string" }
```

**Planned (not yet routed):** `POST /api/agents/threads/search`.

---

### Admin agent tool-loop endpoints

Shared response envelope for `/quality-check`, `/coverage-audit`, `/infra-health`, and `/verify-condition`:

```json
{
  "data": {
    "action": "string",
    "finalText": "string",
    "stopReason": "completed",
    "iterations": 1,
    "tokensUsed": {},
    "durationMs": 1234,
    "error": {},
    "steps": []
  }
}
```

Field presence varies by endpoint (`action` omitted on `verify-condition`; condition fields added there).

#### `POST /api/agents/quality-check`

**Auth:** Required (`authenticatedEndpoint`, 10 req/min)

```json
{
  "action": "audit_all | check_question | verify_condition | scan_quality",
  "targetId": "optional",
  "targetName": "optional",
  "system": "optional organ system",
  "includeSteps": false,
  "customInstruction": "optional max 500 chars"
}
```

#### `POST /api/agents/coverage-audit`

**Auth:** Required (15 req/min)

```json
{
  "action": "blueprint_coverage | drill_coverage | full_coverage",
  "system": "optional",
  "drillType": "optional e.g. AnatomyDrill",
  "includeSteps": false,
  "customInstruction": "optional"
}
```

#### `POST /api/agents/infra-health`

**Auth:** Required (10 req/min)

```json
{
  "action": "db_integrity | fsrs_health | full_health",
  "userId": "optional for fsrs_health",
  "includeSteps": false,
  "customInstruction": "optional"
}
```

#### `POST /api/agents/verify-condition`

**Auth:** Required (20 req/min)

```json
{
  "conditionId": "optional",
  "conditionName": "optional",
  "crossReference": false,
  "includeSteps": false,
  "customInstruction": "optional"
}
```

Requires `conditionId` or `conditionName`. Response `data` also includes `conditionId`, `conditionName`, and `crossReferenced`.

---

## Admin Endpoints

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

## OSCE Endpoints

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
