# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/learner-agent/connect` | Returns WebSocket connection metadata and a short-lived token for the Learner Agent worker. |
| GET | `/api/learner-agent/recommendation` | Returns the deterministic next-best-action for the authenticated learner. |
| POST | `/api/learner-agent/run` | Stateless agent turn (Gemini + learner tools) when the Durable Object is unavailable. |
| POST | `/api/learner-agent/session` | Starts or completes a learner-agent study session (Pages fallback without DO). |
| GET | `/api/learner-agent/memory` | Lists user-approved learner memories stored in KV. |
| POST | `/api/learner-agent/memory` | Proposes, confirms, or corrects a learner memory (`x-memory-action` header). |
| DELETE | `/api/learner-agent/memory` | Deletes a learner memory by `memoryId`. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

**Feature flag:** All `/api/learner-agent/*` routes require `ENABLE_LEARNER_AGENT=true` (server) and return `404` with `FEATURE_DISABLED` when unset.

**Related docs:** [Learner Agent architecture](../architecture/learner-agent.md) · [Runbook](../runbooks/learner-agent.md) · [Secrets](../configuration/learner-agent-secrets.md)

---

## Learner Agent Endpoint Contracts

### `POST /api/learner-agent/connect`

**Auth:** Required (Clerk bearer token)

**Rate limit:** 30 requests/minute per user

**Request body:** Optional empty object `{}`

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "correlationId": "string",
    "userId": "string",
    "durableObjectId": "sha256-hex",
    "websocketUrl": "https://learner-agent.panacea.workers.dev/agents/learner/{durableObjectId}",
    "connectionToken": "string",
    "expiresInSeconds": 300
  },
  "traceId": "string",
  "timestamp": "2026-07-15T00:00:00.000Z"
}
```

**Response headers:** `x-correlation-id`

**Error responses**

- `404` → `{ "ok": false, "error": { "code": "FEATURE_DISABLED", "message": "Learner Agent is not enabled" } }`
- `401` → Clerk auth failure
- `429` → Rate limit exceeded

**Notes**

- `connectionToken` is stored in `RATE_LIMIT_KV` under `learner-connect:{token}` with a 5-minute TTL.
- Client opens WebSocket at `websocketUrl` (swap `http` → `ws`) with `?token={connectionToken}`.
- `durableObjectId` is a SHA-256 hash of the internal `userId` (non-guessable).

---

### `GET /api/learner-agent/recommendation`

**Auth:** Required (Clerk bearer token)

**Rate limit:** 60 requests/minute per user

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `availableMinutes` | integer | No | Study time budget (5–240). Defaults to 45 in ranking logic. |
| `objective` | string | No | Learner-stated objective (max 200 chars); does not override deterministic ranking. |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "correlationId": "string",
    "recommendation": {
      "id": "string",
      "type": "fsrs_review_session | targeted_drill | main_readiness_session | plan_task | rest_day | defer",
      "title": "string",
      "whyNow": "string",
      "score": 0,
      "estimatedMinutes": 0,
      "launchRoute": "/study",
      "launchParams": { "mode": "targeted" },
      "sources": [{ "type": "fsrs | study_plan | allocator | rotation | blueprint", "detail": "string" }],
      "alternates": [{ "id": "string", "type": "string", "title": "string", "score": 0 }],
      "generatedAt": "2026-07-15T00:00:00.000Z"
    }
  },
  "traceId": "string",
  "timestamp": "2026-07-15T00:00:00.000Z"
}
```

**Response headers:** `x-correlation-id`

**Error responses**

- `404` → `FEATURE_DISABLED` when flag unset
- `401` → Clerk auth failure

**Notes**

- Ranking is fully deterministic via `lib/services/learner/learnerNextActionService.ts`.
- FSRS fields are read-only; this endpoint never writes scheduling state.

---

### `POST /api/learner-agent/run`

**Auth:** Required (Clerk bearer token; `aiEndpoint` stack)

**Rate limit:** 25 requests/minute per user

**Request body**

```json
{
  "message": "string (1–4000 chars)",
  "includeSteps": false
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "correlationId": "string",
    "finalText": "string",
    "stopReason": "completed | max_iterations | tool_error | model_error | safety_block | aborted",
    "iterations": 0,
    "steps": []
  },
  "traceId": "string",
  "timestamp": "2026-07-15T00:00:00.000Z"
}
```

`steps` is omitted unless `includeSteps: true`.

**Response headers:** `x-correlation-id`

**Error responses**

- `404` → `FEATURE_DISABLED` when flag unset
- `401` → Clerk auth failure
- `429` → Rate limit exceeded (AI endpoint)

**Notes**

- Uses `runAgent` with learner tool registry (`get_next_best_action`, `start_study_session`, etc.).
- Requires `GEMINI_API_KEY` in the worker environment.
- Fallback path when the Durable Object WebSocket is unavailable.

---

### `POST /api/learner-agent/session`

**Auth:** Required (Clerk bearer token)

**Rate limit:** 60 requests/minute per user

**Request body — start**

```json
{
  "action": "start",
  "objective": "string (1–300 chars)"
}
```

**Request body — complete**

```json
{
  "action": "complete",
  "sessionId": "string",
  "questionsAnswered": 0,
  "accuracy": 0.0,
  "durationMinutes": 0
}
```

**Success response — start (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "correlationId": "string",
    "sessionId": "ls_...",
    "objective": "string",
    "recommendedAction": { },
    "startedAt": "2026-07-15T00:00:00.000Z"
  }
}
```

`recommendedAction` matches the `recommendation` shape from `GET /api/learner-agent/recommendation`.

**Success response — complete (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "correlationId": "string",
    "sessionId": "string",
    "completedAt": "2026-07-15T00:00:00.000Z",
    "progressSummary": {
      "totalAttempts": 0,
      "overallAccuracy": 0,
      "dueToday": 0,
      "overdue": 0,
      "todayPlanProgress": null,
      "weakestSystems": []
    },
    "nextAction": { }
  }
}
```

**Error responses**

- `404` → `FEATURE_DISABLED` when flag unset
- `400` → Validation failure (invalid `action` discriminator or out-of-range fields)
- `401` → Clerk auth failure

**Notes**

- Creates a `StudySession` row with `mode: 'learner_agent'` on start.
- Question attempts and FSRS updates still flow through `drillReviewService`, not this endpoint.

---

### `GET /api/learner-agent/memory`

**Auth:** Required (Clerk bearer token)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "memories": [
      {
        "id": "mem_...",
        "proposed": "string",
        "category": "preference | goal | difficulty | schedule | rotation_note",
        "source": "learner_stated | tool_derived | inferred",
        "timestamp": "2026-07-15T00:00:00.000Z",
        "confidence": 1,
        "expirationPolicy": "session | 30d | until_exam | manual",
        "userVisible": true,
        "requiresConfirmation": false,
        "confirmedAt": "2026-07-15T00:00:00.000Z",
        "correctedFrom": "optional-string"
      }
    ]
  }
}
```

**Error responses**

- `404` → `FEATURE_DISABLED` when flag unset

**Notes**

- Stored in `CACHE` KV at `learner-memory:{userId}` (not Postgres v1).
- Returns `[]` when KV is unavailable or the user has no memories.

---

### `POST /api/learner-agent/memory`

**Auth:** Required (Clerk bearer token)

**Header:** `x-memory-action` — `propose` (default), `confirm`, or `correct`

#### Propose (default)

**Request body**

```json
{
  "proposed": "string (1–500 chars)",
  "category": "preference | goal | difficulty | schedule | rotation_note",
  "source": "learner_stated | tool_derived | inferred"
}
```

`source` defaults to `learner_stated`.

**Success — auto-confirmed (`201 Created`)**

```json
{
  "ok": true,
  "data": {
    "candidate": { },
    "stored": { }
  }
}
```

**Success — pending confirmation (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "candidate": { },
    "pendingConfirmation": true
  }
}
```

High-impact categories (`schedule`, `goal`), inferred low-confidence items, and sensitive patterns require confirmation.

#### Confirm (`x-memory-action: confirm`)

**Request body**

```json
{
  "memoryId": "string"
}
```

**Success (`200 OK`)** → `{ "data": { "memory": { } } }`

#### Correct (`x-memory-action: correct`)

**Request body**

```json
{
  "memoryId": "string",
  "correctedText": "string (1–500 chars)"
}
```

**Success (`200 OK`)** → `{ "data": { "memory": { } } }`

**Error responses**

- `404` → `FEATURE_DISABLED` or `Memory not found`
- `400` → Missing `memoryId` / `correctedText` for confirm/correct
- `503` → `Memory storage unavailable` (no `CACHE` KV binding)

---

### `DELETE /api/learner-agent/memory`

**Auth:** Required (Clerk bearer token)

**Request body**

```json
{
  "memoryId": "string"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "deleted": "mem_..."
  }
}
```

**Error responses**

- `404` → `FEATURE_DISABLED` or `Memory not found`
- `503` → `Memory storage unavailable`

---

## Admin & OSCE Endpoint Contracts

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
