# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/run` | General-purpose student-facing agent runner (clinical tools only). |
| POST | `/api/agents/infra-health` | Admin-only infrastructure health agent (DB integrity + FSRS calibration). |

Related agent family routes (same response envelope, domain-specific tool sets):

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/quality-check` | Content quality and verification agent. |
| POST | `/api/agents/coverage-audit` | NCCPA blueprint and drill coverage agent. |
| POST | `/api/agents/verify-condition` | Single-condition medical accuracy verification agent. |

## Shared Response Envelope

All non-streaming routes use the unified middleware envelope:

**Success (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "uuid",
  "timestamp": "2026-07-14T00:00:00.000Z"
}
```

**Error**

```json
{
  "ok": false,
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "traceId": "uuid",
  "timestamp": "2026-07-14T00:00:00.000Z"
}
```

Agent runs that stop early (`stopReason` ≠ `completed`) still return `200` with failure details in `data`; `5xx` is reserved for infrastructure faults.

## Agent Tool Catalog

Ten read-only tools are registered in `lib/services/agents/tools/index.ts`:

| Domain | Tools | Registry factory |
|---|---|---|
| Student-facing | `clinical_library_search`, `user_progress_summary`, `fsrs_due_count` | `createClinicalToolRegistry()` |
| Content quality | `content_health_audit`, `question_quality_check`, `condition_verify` | `createQualityToolRegistry()` |
| Coverage & analytics | `blueprint_coverage_check`, `drill_coverage_check` | `new ToolRegistry(COVERAGE_TOOLS)` |
| Infrastructure | `database_integrity_check`, `fsrs_calibration_status` | `createInfraToolRegistry()` |
| All tools | `DEFAULT_TOOL_NAMES` (10) | `createDefaultToolRegistry()` |

Public exports from `@/lib/services/agents`: `runAgent`, `createClinicalToolRegistry`, `CLINICAL_TOOL_NAMES`, registry factories, and individual tool definitions.

## Endpoint Contracts

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint` — Clerk token)

**Rate limit:** 25 req/min per user (default `aiEndpoint` limit)

**Request body**

```json
{
  "message": "string (1–4000 chars, required)",
  "allowedTools": ["clinical_library_search", "user_progress_summary", "fsrs_due_count"],
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

- When `allowedTools` is omitted, defaults to `CLINICAL_TOOL_NAMES` (the three student-safe clinical tools).
- Non-clinical tool names in `allowedTools` are rejected because this endpoint registers only clinical tools.
- `allowedCategories` defaults to `["read"]`.

**Success response (`200 OK`)** — `data` payload:

```json
{
  "finalText": "string",
  "stopReason": "completed",
  "iterations": 1,
  "tokensUsed": {
    "input": 0,
    "output": 0,
    "total": 0
  },
  "durationMs": 0,
  "error": {
    "message": "optional",
    "code": "optional"
  },
  "steps": []
}
```

`steps` is included only when `includeSteps: true`.

`stopReason` values: `completed` | `max_iterations` | `tool_error` | `model_error` | `safety_block` | `aborted`.

**Error responses**

- `400` → validation failure (invalid body, unknown tool name, etc.)
- `401` → missing or invalid Clerk token
- `429` → rate limit exceeded
- `500` → `{ "error": "Agent run failed" }` (infrastructure fault)

**Notes**

- Edge-runtime safe; uses Prisma Edge client with `safePrismaDisconnect` in `finally`.
- Telemetry is logged via `logAgentTelemetry` with `endpoint: '/api/agents/run'`.

---

### `POST /api/agents/infra-health`

**Auth:** Required (`adminAuthenticatedEndpoint` — Clerk token + admin role)

**Rate limit:** 60 req/min per user (default `adminAuthenticatedEndpoint` limit)

**Request body**

```json
{
  "action": "db_integrity",
  "userId": "optional-clerk-or-internal-user-id",
  "includeSteps": false,
  "customInstruction": "optional override (max 500 chars)"
}
```

`action` enum:

| Value | Behavior |
|---|---|
| `db_integrity` | Orphan-record audit across QuestionAttempt, ReviewLog, Card, StudentReservoirItem, ItemDifficulty |
| `fsrs_health` | FSRS scheduling health; optional `userId` scopes to one learner |
| `full_health` | Combined DB integrity + FSRS calibration check |

When `customInstruction` is omitted, the endpoint builds a domain-specific prompt from `action` (and `userId` for `fsrs_health`).

**Success response (`200 OK`)** — `data` payload:

```json
{
  "action": "full_health",
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
    "message": "optional",
    "code": "optional"
  },
  "steps": []
}
```

`steps` is included only when `includeSteps: true`.

**Tools used:** `INFRA_TOOLS` — `database_integrity_check`, `fsrs_calibration_status` (read-only).

**Error responses**

- `400` → validation failure
- `401` → missing or invalid Clerk token
- `403` → non-admin user
- `429` → rate limit exceeded
- `500` → `{ "error": "Infrastructure health agent run failed" }`

**Notes**

- `maxIterations` is set internally: `4` for `full_health`, `2` for other actions.
- Telemetry is logged with `endpoint: '/api/agents/infra-health'` and `action` from the request.

---

## Previously Documented Routes

The following routes were documented in an earlier batch and remain valid:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | Returns OSCE performance metrics and trend data. |

See git history on this file for full admin/OSCE request/response contracts if needed.
