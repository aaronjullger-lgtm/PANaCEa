# API Overview

This document tracks request/response contracts for recently changed API routes under `functions/api/` and shared agent services.

**Routing:** Cloudflare Pages Functions map file paths to URLs (e.g. `functions/api/agents/protocol.ts` → `/api/agents/protocol`). Subpaths use nested directories (e.g. `functions/api/agents/invoke/stream.ts` → `/api/agents/invoke/stream`).

---

## Changed Routes (agent orchestration)

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/protocol` | Execute an agent via the unified Edge/Node bridge (`invokeUnifiedAgent`). |
| GET | `/api/agents/protocol` | List discoverable agents and Edge/Node bridge health. |
| POST | `/api/agents/runs` | Create a background Agent Protocol run (in-memory store; async execution). |
| GET | `/api/agents/runs` | List runs or get run status; supports `/wait` suffix for polling completion. |
| POST | `/api/agents/threads` | Create an Agent Protocol conversation thread. |
| GET | `/api/agents/threads` | Get thread state or browse history. |
| PATCH | `/api/agents/threads` | Update thread values (append-only revision log). |
| DELETE | `/api/agents/threads` | Delete a thread. |
| POST | `/api/agents/invoke` | Dispatch a named encounter-tier LangGraph agent (production allowlist). |
| POST | `/api/agents/invoke/stream` | SSE lifecycle events for encounter-tier agent invocation. |
| POST | `/api/agents/run` | Legacy Gemini tool-using agent loop (read-only tools by default). |
| GET | `/api/agents/health` | Agent registry, MCP servers, model availability, capability summary. |
| POST | `/api/agents/mcp` | PANaCEa MCP server (JSON-RPC 2.0 over HTTP). |
| POST | `/api/agents/quality-check` | Admin content-quality agent (audit, psychometrics, verification). |
| POST | `/api/agents/coverage-audit` | Blueprint coverage audit agent. |
| POST | `/api/agents/infra-health` | Infrastructure health audit agent. |
| POST | `/api/agents/verify-condition` | Targeted medical content verification for one condition. |

**Middleware note:** `runs` and `threads` now use `authenticatedEndpoint` from `functions/api/_shared/middleware` with Zod-validated empty schemas (replacing the legacy `../_shared/auth` import). Auth behavior is unchanged: Clerk token required.

---

## Agent API Surface

| Tier | Endpoint | Auth | Rate limit | Response envelope |
|---|---|---|---|---|
| Unified protocol | `POST/GET /api/agents/protocol` | `authenticatedEndpoint` | default | Raw JSON (no `ok` envelope) |
| LangGraph invoke | `POST /api/agents/invoke` | `aiEndpoint` | 25 rpm | Standard `{ ok, data }` envelope |
| LangGraph stream | `POST /api/agents/invoke/stream` | `aiEndpoint` | 25 rpm | `text/event-stream` (SSE) |
| Tool loop | `POST /api/agents/run` | `aiEndpoint` | 25 rpm | Standard envelope |
| Protocol runs | `POST/GET /api/agents/runs` | `authenticatedEndpoint` | default | Raw JSON |
| Protocol threads | `POST/GET/PATCH/DELETE /api/agents/threads` | `authenticatedEndpoint` | default | Raw JSON |
| Ops health | `GET /api/agents/health` | `authenticatedEndpoint` | default | Standard envelope |
| MCP | `POST /api/agents/mcp` | none (CORS open) | — | JSON-RPC 2.0 |
| Admin agents | `POST /api/agents/*-check` etc. | `authenticatedEndpoint` | 10–20 rpm | Standard envelope |

**Encounter-tier agents** callable from `invoke` / `invoke/stream` (from `lib/agents/registry.encounter`): `standardized-patient`, `intent-router`, `spbench-grader`, `ddx-generator`, `diagnostic-workup-advisor`, `feedback-summarizer`, `soap-note-grader`, `preceptor-pimping`. Ops-tier agents are rejected at the Edge invoke layer.

**Distinct runners:** `/api/agents/run` uses `lib/services/agents/agentRunner` (Gemini tool loop). `/api/agents/invoke` uses `lib/agents/registry.encounter`. `/api/agents/protocol` uses `lib/agents/unified` (Edge registry + Node orchestrator bridge). `lib/services/agents/agentPipeline.ts` wraps the tool loop with optional HITL/filesystem middleware but does not expose a separate HTTP route.

---

## Endpoint Contracts

### `POST /api/agents/protocol`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "agentName": "ddx-generator",
  "input": {},
  "threadId": "optional-session-or-thread-id",
  "metadata": {}
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `agentName` | string | yes | Edge agent name or Node orchestrator role |
| `input` | unknown | yes | Agent-specific payload |
| `threadId` | string | no | Langfuse `sessionId` / trace correlation |
| `metadata` | object | no | Arbitrary trace metadata |

**Success response (`200 OK`)** — raw JSON, not the standard envelope

```json
{
  "id": "run_1735689600000_abc123",
  "status": "completed",
  "agentName": "ddx-generator",
  "input": {},
  "output": {},
  "error": null,
  "startedAt": "2026-08-01T00:00:00.000Z",
  "completedAt": "2026-08-01T00:00:01.234Z",
  "durationMs": 1234
}
```

`status` is `completed` when `invokeUnifiedAgent` returns `ok`, otherwise `failed`.

**Error responses**

- `500` → same shape with `status: "failed"` and `error` message string
- `401` → standard auth envelope from middleware

---

### `GET /api/agents/protocol`

**Auth:** Required

**Request body:** None

**Success response (`200 OK`)** — raw JSON

```json
{
  "agents": [
    {
      "name": "ddx-generator",
      "description": "string",
      "tier": "encounter",
      "source": "edge",
      "status": "online"
    }
  ],
  "health": {
    "edge": "online",
    "node": "online"
  }
}
```

`health.node` is `online` when the Node orchestrator HTTP bridge responds; otherwise `offline`. Node agents are discovered lazily via `lib/agents/node-bridge`.

---

### `POST /api/agents/invoke`

**Auth:** Required (`aiEndpoint`, 25 req/min)

**Request body**

```json
{
  "agent": "spbench-grader",
  "input": {
    "sessionId": "optional-osce-session-id"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `agent` | string | yes | Encounter-tier agent name (allowlist enforced) |
| `input` | object | yes | Agent-specific input; max ~256KB serialized |

**Success response (`200 OK`)** — standard envelope

```json
{
  "ok": true,
  "data": {
    "agent": "spbench-grader",
    "status": "ok",
    "output": {},
    "durationMs": 1200,
    "telemetry": {}
  },
  "traceId": "string",
  "timestamp": "2026-08-01T00:00:00.000Z"
}
```

**Error responses** (envelope with `ok: false`)

| HTTP | Agent `status` | When |
|---|---|---|
| `400` | `schema_invalid`, `no_input` | Bad input shape |
| `403` | — | Agent not on production allowlist |
| `404` | — | Agent missing from registry |
| `429` | `rate_limited` | Provider or guardrail limit |
| `422` | `safety_blocked` | Safety filter |
| `500` | `internal_error` | Unhandled failure |

**Notes**

- When `input.sessionId` is present and the agent is `spbench-grader`, results may be persisted to `SpbenchScore` after an ownership check on the OSCE session.
- Cost guardrails (`costTracker`, `circuitBreaker`) are set per request via `lib/ai/costGuardrailContext`.

---

### `POST /api/agents/invoke/stream`

**Auth:** Required (`aiEndpoint`, 25 req/min)

**Request body:** Same as `POST /api/agents/invoke`

**Success response:** `Content-Type: text/event-stream`

| Event | Payload |
|---|---|
| `agent_started` | `{ "agent": "agent-name" }` |
| `agent_completed` | Same fields as invoke success `data` |
| `agent_error` | `{ agent, status, error: { status, message }, durationMs }` |

Token-level streaming is not yet exposed; this endpoint streams lifecycle events only.

---

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint`, 25 req/min)

**Request body**

```json
{
  "message": "What should I focus on for cardiology this week?",
  "allowedTools": ["clinical_library_search"],
  "allowedCategories": ["read"],
  "maxIterations": 5,
  "model": "optional-gemini-model-id",
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
  "ok": true,
  "data": {
    "finalText": "string",
    "stopReason": "completed",
    "iterations": 2,
    "tokensUsed": { "input": 0, "output": 0 },
    "durationMs": 3000,
    "steps": []
  },
  "traceId": "string",
  "timestamp": "2026-08-01T00:00:00.000Z"
}
```

`steps` is included only when `includeSteps: true`. Default tool allowlist: `clinical_library_search`, `user_progress_summary`, `fsrs_due_count`. Default categories: `read` only.

---

### `GET /api/agents/health`

**Auth:** Required

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-08-01T00:00:00.000Z",
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
    "agents": [],
    "mcp": { "servers": [], "totalServers": 0, "totalTools": 0 },
    "models": [],
    "tasks": []
  }
}
```

`status` is `healthy`, `degraded`, or `unhealthy` based on provider and registry availability.

---

### `POST /api/agents/mcp`

**Auth:** None (public CORS; restrict at edge in production if needed)

**Protocol:** JSON-RPC 2.0 over HTTP. Supports MCP streamable HTTP transport via `lib/agents/mcp/server`.

**Request body:** Standard JSON-RPC request object (`jsonrpc`, `id`, `method`, `params`).

**Responses**

- `200` → JSON-RPC result
- `202` → notification accepted (no body)
- `400` → parse error (`code: -32700`)
- `500` → internal error (`code: -32603`)

**OPTIONS:** CORS preflight returns `204`.

---

### `POST /api/agents/runs` (Agent Protocol)

**Auth:** Required

**Request body** (`RunCreateRequest`)

```json
{
  "thread_id": "optional-existing-thread",
  "agent_id": "optional-agent-id",
  "input": {},
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

**Notes:** Runs are stored in-memory on the Edge isolate (not durable across requests in production). Execution is simulated until wired to the orchestrator queue. Spec reference: [Agent Protocol OpenAPI](https://langchain-ai.github.io/agent-protocol/api.html).

---

### `GET /api/agents/runs` and `GET /api/agents/runs/{run_id}`

**Auth:** Required

- No `run_id` → `{ "data": [Run...], "total": N }`
- With `run_id` → single `Run` object
- With `run_id/wait` → polls up to 60s, returns `RunWaitResponse`

`Run.status`: `pending` | `running` | `success` | `error` | `cancelled` | `interrupted`

---

### `POST /api/agents/threads` and thread CRUD

**Auth:** Required

**Create body** (`ThreadCreateRequest`)

```json
{
  "thread_id": "optional",
  "values": {},
  "metadata": {}
}
```

**Success (`201`):** `Thread` object with `thread_id`, `status`, `values`, `messages`, `metadata`, timestamps.

**PATCH** body: `ThreadUpdateRequest` (`values`, `metadata`). **DELETE** returns confirmation or `404`.

Thread store is in-memory on the Edge isolate (same durability constraints as runs).

---

### `POST /api/agents/quality-check`

**Auth:** Required (10 req/min)

**Request body**

```json
{
  "action": "audit_all",
  "targetId": "optional",
  "targetName": "optional",
  "system": "optional",
  "includeSteps": false,
  "customInstruction": "optional"
}
```

`action`: `audit_all` | `check_question` | `verify_condition` | `scan_quality`

**Success:** Standard envelope with agent run result (`finalText`, `stopReason`, `iterations`, `tokensUsed`, `durationMs`, optional `steps`).

---

### `POST /api/agents/verify-condition`

**Auth:** Required (20 req/min)

**Request body**

```json
{
  "conditionId": "optional",
  "conditionName": "optional",
  "crossReference": false,
  "includeSteps": false,
  "customInstruction": "optional"
}
```

Requires `conditionId` or `conditionName`.

---

### `POST /api/agents/coverage-audit` and `POST /api/agents/infra-health`

**Auth:** Required (admin-oriented ops agents)

Same response shape as `quality-check` (tool-loop agent result in standard envelope). See handler files under `functions/api/agents/` for action-specific request fields.

---

## Related Documentation

- **Node orchestrator HTTP API** (`packages/agent-orchestrator`): see `docs/agents/RUNBOOK.md` (`/health`, `/agents`, `/agents/:role/invoke`, SSE stream).
- **Cloud Agents (Cursor):** `docs/automation/CLOUD_AGENTS_API.md` — external Cursor API, not PANaCEa Edge routes.
- **LangSmith / tracing:** `docs/agents/langsmith-observability.md`
