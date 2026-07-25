# API Overview

This document tracks request/response contracts for recently changed API routes and shared infrastructure under `functions/api/`.

## Shared Infrastructure

### Cloudflare AI Gateway (Gemini routing)

Gemini calls in `functions/api/_shared/ai-gateway.ts` and `lib/ai/aiGateway.ts` route through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) when both env vars are set:

| Variable | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (renamed from legacy `CF_ACCOUNT_ID`) |
| `CF_AI_GATEWAY_ID` | AI Gateway instance ID |

When configured, `buildGeminiUrl()` targets `https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/google-ai-studio/...` instead of `generativelanguage.googleapis.com`. This applies to:

- `POST /api/ai/models` (non-streaming Gemini proxy)
- `POST /api/ai/chat/stream` (SSE streaming)
- Staging adequacy checks and critic scoring (`functions/api/_shared/staging-questions.ts`)

If either variable is missing, requests fall back to the direct Google Generative Language API.

### Staging question validation

`getStagingQuestionValidationErrors()` enforces these rules before a question enters the staging lake:

- `question` (or `stem` / `text`) is required
- At least two answer `options` (or `choices` / `answers`)
- `correctAnswer` must resolve to one of the options (exact match or letter index `a`–`z`)
- `explanation` or `rationale` is required

Emergency clinical topics (anaphylaxis, stroke, MI/ACS, sepsis, DKA, PE, etc.) **cannot be auto-promoted**; they require human review via admin approve or refinery action with `allowPendingHumanReview`.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/models` | Non-streaming Gemini proxy (auth + rate limit). |
| POST | `/api/ai/chat/stream` | SSE streaming Gemini proxy (auth + rate limit). |
| POST | `/api/agents/run` | General-purpose agent loop with tool allow-list. |
| POST | `/api/questions/staging` | Save a generated question to the staging lake. |
| POST | `/api/questions/staging/process` | Batch-process pending staging questions (adequacy check). |
| GET | `/api/questions/staging/stats` | Staging queue counts by status. |
| POST | `/api/questions/staging/:id/check` | Run adequacy check on a single staging question. |
| POST | `/api/admin/staging/approve` | Human-approve a staging question → live pool. |
| POST | `/api/admin/staging/reject` | Reject a staging question. |
| POST | `/api/admin/staging/run-critic` | Score pending questions with AI critic (0–100). |
| POST | `/api/admin/refinery/action` | Approve/reject content, media, or staging questions. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | Returns OSCE performance metrics and trend data. |

> **Legacy path aliases:** Middleware and rate-limit tiers still recognize `/api/gemini` and `/api/gemini/stream`, but deployed handlers live at `/api/ai/models` and `/api/ai/chat/stream` (see `lib/utils/apiConfig.ts`).

---

## Endpoint Contracts

### `POST /api/ai/models`

**Auth:** Required (`aiEndpoint`, 25 req/min per user)

**Request body**

```json
{
  "modelName": "gemini-2.0-flash",
  "prompt": "string (required)",
  "temperature": 0.8,
  "maxTokens": 2048,
  "systemInstruction": "optional string",
  "cachedContent": "cachedContents/xxx (optional)",
  "thinkingLevel": "MINIMAL | LOW | MEDIUM | HIGH (optional)"
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "text": "string",
    "model": "gemini-2.0-flash",
    "finishReason": "STOP",
    "usage": {
      "promptTokenCount": 0,
      "candidatesTokenCount": 0,
      "totalTokenCount": 0
    }
  }
}
```

**Error responses**

- `400` → content blocked or validation failure
- `429` → rate limit exceeded
- `500` / `503` → upstream or auth failure

**Notes**

- Routes through Cloudflare AI Gateway when `CLOUDFLARE_ACCOUNT_ID` + `CF_AI_GATEWAY_ID` are set.
- Rate limiting uses `RATE_LIMIT_KV` bucket `gemini`.

---

### `POST /api/ai/chat/stream`

**Auth:** Required (`aiStreamingEndpoint`, 25 req/min per user)

**Request body**

```json
{
  "modelName": "gemini-2.5-flash",
  "prompt": "string (required, max 128 KiB)",
  "temperature": 0.8,
  "cachedContent": "cachedContents/xxx (optional)",
  "thinkingLevel": "MINIMAL | LOW | MEDIUM | HIGH (optional)"
}
```

**Success response (`200 OK`)**

Server-Sent Events stream. Terminal frame may include `{ "thoughtSignatures": [...] }` for multi-turn reasoning continuity.

**Error responses**

Structured JSON envelope with `error`, `errorId`, `category`, `retryable`, and `retryAfterMs`.

**Notes**

- Uses `gateway.stream()` from `lib/ai/aiGateway.ts` (AI Gateway migration, Sprint 5c).
- Token usage tracked via `_shared/tokenTracking.ts`.

---

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint`, 25 req/min per user)

**Request body**

```json
{
  "message": "string (1–4000 chars, required)",
  "allowedTools": ["clinical_library_search", "user_progress_summary", "fsrs_due_count"],
  "allowedCategories": ["read", "compute", "write"],
  "maxIterations": 5,
  "model": "optional model override",
  "temperature": 0.2,
  "maxOutputTokens": 1024,
  "userContext": {
    "currentRotation": "string | null",
    "examDate": "string | null",
    "focusSystem": "string | null"
  },
  "includeSteps": false
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "finalText": "string",
    "stopReason": "completed | max_iterations | tool_error | model_error",
    "iterations": 1,
    "tokensUsed": { "prompt": 0, "completion": 0, "total": 0 },
    "durationMs": 0,
    "error": { "code": "string", "message": "string" },
    "steps": []
  }
}
```

`steps` is included only when `includeSteps: true`. Non-completed runs return `200` with a `stopReason` (not 5xx).

**Notes**

- Agent runner uses provider-agnostic `runLLMTurn` via Vercel AI SDK (`lib/services/agents/llmTurnClient.ts`).
- Default tool allow-list is read-only clinical tools.

---

### `POST /api/questions/staging`

**Auth:** Required (admin)

**Request body**

```json
{
  "questionData": {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "explanation": "string or { rationale: string }",
    "vignette": "optional string",
    "system": "Cardiovascular",
    "difficulty": "medium | 0.65",
    "metadata": {
      "taxonomyCode": "CV",
      "conditionId": "string",
      "medicalContentId": "string"
    }
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "stagingQuestion": {
    "id": "uuid",
    "status": "pending",
    "question": "string",
    "options": [],
    "correctAnswer": "string",
    "explanation": "string",
    "system": "string",
    "difficulty": "medium",
    "tags": []
  }
}
```

**Error responses**

- `400` → `Invalid staging question payload: <validation errors>`
- `403` → admin access required

---

### `POST /api/questions/staging/process`

**Auth:** Required (admin)

**Request body**

```json
{
  "limit": 10
}
```

`limit` is optional (1–100, default 10).

**Success response (`200 OK`)**

```json
{
  "success": true,
  "results": [
    { "id": "uuid", "status": "promoted | skipped_pending | flagged | discarded | error", "score": 0.95, "error": "optional" }
  ]
}
```

**Notes**

- Runs `runAdequacyCheck` (tier `fast` via AI Gateway) on each pending question.
- Valid questions auto-promote; medical errors flag for review; incomplete AI checks stay `skipped_pending` (fail-closed).
- Emergency topics are blocked from auto-promotion.

---

### `GET /api/questions/staging/stats`

**Auth:** Required (admin)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "stats": {
    "total": 0,
    "pending": 0,
    "passed": 0,
    "failed": 0,
    "flagged": 0,
    "promoted": 0,
    "discarded": 0
  }
}
```

---

### `POST /api/questions/staging/:id/check`

**Auth:** Required (admin)

**Request body**

```json
{
  "body": {
    "force": false
  }
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "result": {
      "isValid": true,
      "hasCorrectAnswer": true,
      "explanationLength": 75,
      "hasMedicalErrors": false,
      "accuracyCheckCompleted": true,
      "score": 1,
      "details": "[]"
    }
  }
}
```

**Error responses**

- `500` → adequacy check failure

**Notes**

- Uses AI Gateway tier `fast` (gemini-2.0-flash equivalent) for medical accuracy review.
- `isValid` requires `accuracyCheckCompleted: true` (fail-closed when AI unavailable).

---

### `POST /api/admin/staging/approve`

**Auth:** Required (admin)

**Request body**

```json
{
  "body": {
    "id": "staging-question-uuid"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "message": "Approved and mirrored to live pool"
}
```

**Error responses**

- `400` → already approved, failed adequacy check, or emergency topic without human review
- `404` → staging question not found
- `500` → promotion failure (e.g. canonical mirror creation failed)

**Notes**

- Calls `promoteToLive()` with `allowPendingHumanReview` when status is `pending`.
- Retains staging row as `approved` for provenance; mirrors to `PreGeneratedQuestion` and canonical `Question`.

---

### `POST /api/admin/staging/reject`

**Auth:** Required (admin)

**Request body**

```json
{
  "body": {
    "id": "staging-question-uuid"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "message": "Rejected"
}
```

---

### `POST /api/admin/staging/run-critic`

**Auth:** Required (admin)

**Request body**

```json
{
  "body": {
    "limit": 10
  }
}
```

`limit` is optional (1–50, default 10).

**Success response (`200 OK`)**

```json
{
  "success": true,
  "processed": 3,
  "results": [
    { "id": "uuid", "status": "promoted | discarded | flagged_for_review | skipped | error", "score": 92, "error": "optional" }
  ]
}
```

**Notes**

- Critic uses AI Gateway tier `balanced` (gemini-2.5-flash equivalent).
- Score > 90 + structural validation → auto-promote; < 70 → reject; 70–90 → flag for human review.
- Skipped when `GEMINI_API_KEY` is not set.

---

### `POST /api/admin/refinery/action`

**Auth:** Required (approver or admin via `refineryEndpoint`)

**Request body**

```json
{
  "type": "content | media | question",
  "id": "string",
  "action": "approve | reject",
  "reason": "optional string (max 500)",
  "isClassicPortrayal": true,
  "modality": "string",
  "correctDiagnosis": "string",
  "conditionId": "string",
  "licenseType": "string"
}
```

Media-specific fields apply only when `type: "media"` and `action: "approve"`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "message": "Question approved and mirrored to live pool"
}
```

**Error responses**

- `404` → item not found
- `502` → storage copy failure (media approve)
- `500` → action failure

**Notes**

- `type: "question"` calls `promoteToLive()` or `discardStagingQuestion()`.
- Emergency topics require human review path (same as staging approve).

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
