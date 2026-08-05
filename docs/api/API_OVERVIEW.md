# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/invoke` | Dispatch a named encounter-tier LangGraph agent with typed input; returns final output in the unified API envelope. |
| POST | `/api/agents/invoke/stream` | SSE lifecycle stream for agent invocation (`agent_started`, `agent_completed`, `agent_error`). |
| POST | `/api/agents/protocol` | Agent Communication Protocol run — execute any unified-registry agent via `invokeUnifiedAgent`. |
| GET | `/api/agents/protocol` | List unified-registry agents and bridge health (edge + node). |
| POST | `/api/agents/mcp` | JSON-RPC 2.0 MCP server over HTTP (streamable transport). |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

---

## Agent Endpoints

Production agent dispatch lives under `/api/agents/`. These endpoints are distinct from the legacy tool-loop surface at `/api/agents/run` (Gemini tool-using agent in `lib/services/agents/`).

**Encounter-tier allowlist (`/api/agents/invoke` and `/invoke/stream`):** Only agents registered in `lib/agents/registry.encounter.ts` are callable. Current production names:

`standardized-patient`, `intent-router`, `spbench-grader`, `ddx-generator`, `diagnostic-workup-advisor`, `feedback-summarizer`, `soap-note-grader`, `preceptor-pimping`

Ops-tier agents (e.g. `callgemini-auditor`) are dev/CI-only and rejected by the invoke endpoints.

**Client hook:** `hooks/useAgentStream.ts` POSTs to `/api/agents/invoke/stream` and parses SSE lifecycle events.

---

### `POST /api/agents/invoke`

**Auth:** Required (`aiEndpoint` — Clerk JWT, 25 req/min per user)

**Request body**

```json
{
  "agent": "spbench-grader",
  "input": {
    "sessionId": "uuid",
    "transcript": "..."
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `agent` | `string` | Must be an encounter-tier agent name (see allowlist above). |
| `input` | `object` | Agent-specific payload; each agent validates via its own Zod `inputSchema`. Max ~256 KB serialized. |

**Success response (`200 OK`)** — unified envelope

```json
{
  "ok": true,
  "success": true,
  "data": {
    "agent": "spbench-grader",
    "status": "ok",
    "output": {},
    "durationMs": 1234,
    "telemetry": {}
  },
  "traceId": "string",
  "timestamp": "2026-08-05T00:00:00.000Z"
}
```

**Error responses** (envelope `ok: false`)

| HTTP | Agent `status` | When |
|---|---|---|
| `400` | `schema_invalid`, `no_input` | Input failed agent schema validation |
| `403` | — | Agent not in encounter-tier allowlist |
| `404` | — | Agent name passed schema but missing from registry |
| `422` | `safety_blocked` | Safety filter blocked the run |
| `429` | `rate_limited` | Agent or AI rate limit exceeded |
| `500` | `internal_error` | Unhandled agent failure |

**Notes**

- LangSmith tracing via `traceAgentInvocation` (`lib/agents/langsmith-edge.ts`).
- Per-request cost guardrails (`costTracker`, `circuitBreaker`) are set for the request scope.
- `spbench-grader` results with `sessionId` in input are persisted to `SpbenchScore` when the OSCE session belongs to the caller (ownership-checked; silent skip otherwise).

---

### `POST /api/agents/invoke/stream`

**Auth:** Required (`aiEndpoint` — Clerk JWT, 25 req/min per user)

**Request body:** Same shape as `POST /api/agents/invoke` (`agent` + `input`).

**Response:** `text/event-stream` (not the JSON envelope). HTTP `200` for the stream itself; agent-level failures arrive as SSE events.

| Event | Payload |
|---|---|
| `agent_started` | `{ "agent": "string" }` |
| `agent_completed` | `{ "agent", "status", "output", "durationMs", "telemetry?" }` |
| `agent_error` | `{ "agent", "status", "error": { "status", "message" }, "durationMs" }` |

**Pre-request errors** (auth, validation, rate limit) return JSON envelope errors before the stream opens.

**Notes**

- Lifecycle-level streaming only (not token-by-token). Sufficient for loading states and progress UI (`useAgentStream`, `AgentChat`).
- Same encounter-tier allowlist and tracing as `/api/agents/invoke`.

---

### `POST /api/agents/protocol`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "agentName": "standardized-patient",
  "input": {},
  "threadId": "optional-session-id",
  "metadata": {}
}
```

**Success response (`200 OK`)** — raw JSON (not the unified envelope)

```json
{
  "id": "run_1735689600000_abc123",
  "status": "completed",
  "agentName": "standardized-patient",
  "input": {},
  "output": {},
  "error": null,
  "startedAt": "2026-08-05T00:00:00.000Z",
  "completedAt": "2026-08-05T00:00:01.000Z",
  "durationMs": 1000
}
```

**Error responses**

- `500` → same shape with `"status": "failed"` and `error` message string

**Notes**

- Uses `invokeUnifiedAgent` from `lib/agents/unified.ts` (broader registry than encounter-only invoke).
- Implements the Agent Communication Protocol run surface; route is `/api/agents/protocol` (POST = run).

---

### `GET /api/agents/protocol`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)** — raw JSON

```json
{
  "agents": [
    {
      "name": "string",
      "description": "string",
      "tier": "encounter",
      "source": "edge",
      "status": "ok"
    }
  ],
  "health": {
    "edge": "ok",
    "node": "online"
  }
}
```

**Notes**

- `health.node` is `"online"` when the Node bridge HTTP health check succeeds, otherwise `"offline"`.
- Route is `/api/agents/protocol` (GET = list agents).

---

### `POST /api/agents/mcp`

**Auth:** None at handler level (system-scoped MCP tools; CORS enabled)

**Protocol:** JSON-RPC 2.0 over HTTP

**Request body:** Standard MCP JSON-RPC request object.

**Success response (`200 OK`)** — JSON-RPC result

**Other responses**

- `202 Accepted` — notification (no body)
- `400` → parse error (`-32700`)
- `500` → internal error (`-32603`)

**Notes**

- Creates an Edge Prisma client per request for DB-backed tools; `safePrismaDisconnect` in `finally`.
- Distinct from editor-local MCP config; this is the production HTTP MCP transport.

---

## Admin & OSCE Endpoints

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
