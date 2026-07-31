# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/agents/health` | Lists registered encounter agents and which AI providers are configured. |
| POST | `/api/agents/invoke` | Dispatches a named encounter-tier LangGraph agent (synchronous JSON response). |
| POST | `/api/agents/invoke/stream` | SSE streaming variant of `/api/agents/invoke` (lifecycle events). |
| GET | `/api/conditions/high-yield` | Public high-yield conditions for Cram Mode (buzzwords + pearls). |
| GET | `/api/conditions/illness-script` | Structured illness script for a condition, with optional differential comparison. |
| GET | `/api/conditions/pearls` | Fetch pearls for a condition or random pearls by organ system. |
| POST | `/api/conditions/pearls` | Save clinical pearls to `MedicalContent`. |
| POST | `/api/cron/agent-health-check` | Scheduled agent health checks (DB integrity, FSRS, content, bridge). |
| POST | `/api/cron/d1-cache-purge` | Purges expired rows from the D1 edge cache. |
| GET | `/api/questions/pool` | Fetch user-filtered questions from the pre-generated pool (with main-table fallback). |
| POST | `/api/questions/pool` | Admin-only: seed an approved question into the pre-generated pool. |

## Endpoint Contracts

### `GET /api/agents/health`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "timestamp": "2026-07-31T18:00:00.000Z",
    "providers": {
      "gemini": true,
      "openai": false,
      "anthropic": false,
      "deepseek": false,
      "deepinfra": false
    },
    "availableProviders": ["gemini"],
    "agents": [
      {
        "name": "standardized-patient",
        "tier": "encounter",
        "description": "string",
        "available": true
      }
    ],
    "totalAgents": 7,
    "userId": "string"
  }
}
```

**Notes**

- Encounter-tier agents only (`standardized-patient`, `intent-router`, `spbench-grader`, `ddx-generator`, `diagnostic-workup-advisor`, `feedback-summarizer`, `soap-note-grader`).
- `available` is `true` when at least one AI provider key is configured.

---

### `POST /api/agents/invoke`

**Auth:** Required (`aiEndpoint`, 25 rpm)

**Request body**

```json
{
  "agent": "standardized-patient",
  "input": {}
}
```

- `agent` — encounter-tier name from the registry allowlist.
- `input` — agent-specific payload (max ~256 KB serialized). Each agent validates its own shape.

**Success response (`200 OK`)**

```json
{
  "data": {
    "agent": "standardized-patient",
    "status": "ok",
    "output": {},
    "durationMs": 1234,
    "telemetry": {}
  }
}
```

**Error responses**

- `400` → `status: schema_invalid` or `no_input`
- `403` → agent not callable from production (ops-tier agents rejected)
- `404` → agent not found in registry
- `422` → `status: safety_blocked`
- `429` → `status: rate_limited`
- `500` → `status: internal_error` or `env_missing`

**Notes**

- Distinct from legacy `/api/agents/run` (open-ended Gemini tool loop).
- When `input.sessionId` is present, certain agents (e.g. `spbench-grader`) persist results to Prisma after an ownership check.

---

### `POST /api/agents/invoke/stream`

**Auth:** Required (`aiEndpoint`, 25 rpm)

**Request body:** Same as `POST /api/agents/invoke`.

**Success response (`200 OK`)** — `Content-Type: text/event-stream`

SSE lifecycle events (not token-level streaming):

| Event | Payload |
|---|---|
| `agent_started` | `{ "agent": "standardized-patient" }` |
| `agent_completed` | `{ "agent", "status": "ok", "output", "durationMs", "telemetry" }` |
| `agent_error` | `{ "agent", "status", "error": { "status", "message" }, "durationMs" }` |

**Error responses**

- `403` → agent not in production allowlist (returned before stream opens)

**Notes**

- Headers: `Cache-Control: no-cache`, `Connection: keep-alive`.
- Error messages are sanitized (URLs stripped, max 120 chars).

---

### `GET /api/conditions/high-yield`

**Auth:** None (`publicEndpoint`)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `50` | Max results (1–100). |
| `system` | string | — | Filter by organ system (e.g. `CV`). |
| `random` | `true` \| `false` | — | Shuffle before slicing to `limit`. |

**Success response (`200 OK`)**

```json
{
  "data": {
    "conditions": [
      {
        "condition": "Acute coronary syndrome",
        "system": "CV",
        "pearl": "string",
        "buzzwords": ["string"],
        "importance": "critical"
      }
    ],
    "total": 50,
    "source": "database"
  }
}
```

`importance` is `critical` \| `very_high` \| `high` (derived from `pance_yield`).

**Notes**

- Backed by D1 cache (`conditions:high-yield:*`, TTL 24 h).
- `Cache-Control`: `no-store` when `random=true`; otherwise `public, max-age=3600`.

---

### `GET /api/conditions/illness-script`

**Auth:** Required (`authenticatedEndpoint`)

**Query parameters**

| Param | Required | Description |
|---|---|---|
| `conditionId` | Yes | `MedicalContent.conditionId` |
| `compare` | No | Second `conditionId` for differential comparison |

**Success response (`200 OK`)** — raw JSON (not the standard `{ data }` envelope)

Single mode:

```json
{
  "mode": "single",
  "script": {
    "conditionId": "string",
    "conditionName": "string",
    "system": "string",
    "subcategory": "string",
    "enablingConditions": [],
    "fault": {},
    "consequences": [],
    "diagnostics": {},
    "treatment": {},
    "differential": {},
    "panceYield": "high_yield",
    "completeness": 0.85,
    "gaps": [],
    "clinicalPearls": [],
    "mnemonics": []
  }
}
```

Comparison mode (`compare` provided):

```json
{
  "mode": "comparison",
  "scriptA": {},
  "scriptB": {},
  "comparison": {
    "conditionA": "string",
    "conditionB": "string",
    "sharedFindings": [],
    "uniqueToA": [],
    "uniqueToB": [],
    "keyDistinguishers": []
  }
}
```

**Error responses**

- `404` → `{ "error": "Condition not found: <conditionId>" }`
- `500` → `{ "error": "Failed to build illness script: ..." }`

**Notes**

- D1 cache key: `illness-script:<conditionId>` or `illness-script:<id>:vs:<compare>` (TTL 1 h).
- Response header `X-Cache`: `HIT` \| `MISS`.

---

### `GET /api/conditions/pearls`

**Auth:** Required (`authenticatedEndpoint`)

**Query parameters** (one mode required)

| Mode | Params | Description |
|---|---|---|
| By condition | `conditionId` | Pearls stored on `MedicalContent.content`. |
| Random drill | `system` + `random=true` | Up to 10 random pearls for RapidRecallDrill. |

**Success response — by condition (`200 OK`)**

```json
{
  "conditionId": "string",
  "conditionName": "string",
  "pearls": ["string"]
}
```

**Success response — random by system (`200 OK`)**

```json
{
  "system": "CV",
  "pearls": [
    { "conditionId": "string", "conditionName": "string", "pearl": "string" }
  ],
  "totalAvailable": 42
}
```

**Error responses**

- `400` → `{ "error": "Invalid request: conditionId or system+random required" }`
- `404` → `{ "error": "Medical content not found" }`
- `500` → `{ "error": "Failed to fetch pearls" }`

**Notes**

- System-level random pearls are D1-cached (`pearls:system:<SYSTEM>`, TTL 24 h).
- `Cache-Control`: `public, max-age=3600` (by condition); `no-store` (random).

---

### `POST /api/conditions/pearls`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "conditionId": "string",
  "pearls": ["string"]
}
```

- `pearls`: 1–20 new pearl strings (deduplicated case-insensitively; max 50 per condition).

**Success response (`200 OK`)**

```json
{
  "success": true,
  "totalPearls": 12,
  "addedPearls": 2
}
```

**Error responses**

- `404` → `{ "error": "Medical content not found" }`
- `500` → `{ "error": "Failed to save pearls" }`

**Notes**

- Invalidates D1 cache prefix `pearls:system:<SYSTEM>` for the condition's organ system.

---

### `POST /api/cron/agent-health-check`

**Auth:** `CRON_SECRET` bearer token (`cronEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "checkedAt": "2026-07-31T18:00:00.000Z",
  "totalDurationMs": 45000,
  "checksRun": 3,
  "ok": 3,
  "warnings": 0,
  "errors": 0,
  "details": [
    {
      "check": "database_integrity",
      "status": "ok",
      "finalText": "string",
      "tokensUsed": 0,
      "durationMs": 12000
    }
  ],
  "bridge": {
    "edgeAgentCount": 7,
    "nodeReachable": true,
    "nodeAgentCount": 12,
    "bridgeStatus": "healthy"
  },
  "langsmithMetrics": {
    "metricCount": 4,
    "timestamp": "2026-07-31T18:00:00.000Z"
  },
  "qualityGates": [],
  "alertRules": []
}
```

**Error responses**

- `401` → invalid or missing cron secret
- `500` → `{ "error": "Agent health check failed", "detail": "..." }`

**Notes**

- Runs four sequential checks: database integrity, FSRS calibration, content health, agent bridge/LangSmith.
- When `AGENT_ORCHESTRATOR_URL` is set, pings the Node orchestrator via the agent bridge.

---

### `POST /api/cron/d1-cache-purge`

**Auth:** `CRON_SECRET` bearer token (`cronEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "purged": 42,
  "before": 1000,
  "after": 958
}
```

Skipped when `EDGE_DB` is not bound:

```json
{
  "purged": 0,
  "skipped": true,
  "reason": "EDGE_DB not bound"
}
```

---

### `GET /api/questions/pool`

**Auth:** Required (`aiEndpoint`, query validation)

**Query parameters**

| Param | Description |
|---|---|
| `count` | Number of questions (default `10`). |
| `system` | Single organ-system filter. |
| `systems` | Comma-separated multi-system filter (e.g. `CV,PULM`). |
| `category` | Question type / category filter. |
| `difficulty` | Difficulty filter. |
| `mode` | `curation` — admin-only raw pool listing (max 100). |

**Success response (`200 OK`)**

```json
{
  "data": {
    "questions": [
      {
        "id": "string",
        "vignette": "string",
        "question": "string",
        "options": ["string"],
        "correctAnswer": "A",
        "correctAnswerIndex": 0,
        "explanation": "string",
        "system": "CV",
        "difficulty": "medium",
        "source": "pool",
        "fromStaging": false
      }
    ],
    "poolStatus": {
      "available": 150,
      "needsGeneration": false,
      "threshold": 40
    }
  }
}
```

**Error responses**

- `403` → `{ "error": "Admin access required" }` (curation mode)
- `503` → `{ "error": "Pool unavailable", "message": "..." }` (DB not configured or unavailable)
- `500` → `{ "error": "Failed to fetch pool questions", "message": "..." }`

**Notes**

- Excludes questions in the user's `UserQuestionSeen` history (up to 5 000 recent).
- When no system filter is set, fetches are quota-weighted by NCCPA blueprint distribution.
- Supplements from the main `Question` table when the pre-generated pool is thin.
- Learner hot-path generation is suppressed; pool refill is owned by reservoir/admin cron.
- D1 cache (primary) + KV `CACHE` namespace (fallback) for pool rows. Header `X-Cache`: `HIT` \| `MISS`.
- Increments `timesServed` on served `PreGeneratedQuestion` rows (fire-and-forget).

---

### `POST /api/questions/pool`

**Auth:** Required (`authenticatedEndpoint`, 30 rpm, admin only)

**Request body**

```json
{
  "question": {
    "id": "string",
    "question": "string",
    "options": ["string"],
    "correctAnswer": "A",
    "explanation": "string",
    "system": "CV",
    "conditionId": "string",
    "medicalContentId": "string",
    "difficulty": "medium",
    "vignette": "string",
    "conditionName": "string",
    "subcategory": "string",
    "tags": ["string"]
  }
}
```

**Success response (`201 Created`)**

```json
{
  "data": {
    "success": true
  }
}
```

**Error responses**

- `400` → correct answer not in options, or question not mirrorable to canonical `Question` table
- `403` → `{ "error": "Admin access required" }`
- `500` → `{ "error": "Failed to seed question to pool", "message": "..." }`

**Notes**

- Creates `PreGeneratedQuestion` with `validationStatus: approved` and upserts the canonical `Question` mirror.
