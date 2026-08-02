# API Overview

This document tracks the request/response contracts for the most recently changed API routes and shared API infrastructure.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/fetch` | Fetch validated pre-generated questions for the authenticated user, excluding recently seen items. |
| POST | `/api/questions/generate-deep` | Admin-only deep-context question preview using AI Gateway + PANCE blueprint cache. |

## Shared Infrastructure

### Vertex AI routing (`functions/api/_shared/ai-service.ts`)

`callGemini()` and `streamGemini()` prefer **Google Cloud Vertex AI** when `VERTEX_AI_PROJECT` and `VERTEX_AI_API_KEY` are set. Non-retryable Vertex errors surface to the caller; retryable errors (429/503) fall back to the direct Gemini API (`GEMINI_API_KEY`).

**Env vars** (optional — defined in `functions/api/_shared/types.ts`):

| Variable | Purpose |
|---|---|
| `VERTEX_AI_PROJECT` | Google Cloud project ID |
| `VERTEX_AI_LOCATION` | Region (default `us-central1`) |
| `VERTEX_AI_API_KEY` | Vertex AI API key |

**Affected callers:** Any edge handler using `callGemini`, `streamGemini`, `callAIMultiProvider`, `generateObject`, or `callWithTools` from `functions/api/_shared/ai-service.ts`.

---

## Endpoint Contracts

### `POST /api/questions/fetch`

**Auth:** Required (`authenticatedEndpoint`). User identity is resolved from the Clerk session — **do not** send `userId` in the body.

**Request body**

```json
{
  "system": "string (optional)",
  "conditionId": "string (optional)",
  "difficulty": "string (optional)",
  "questionType": "string (optional)",
  "limit": 10
}
```

`limit` defaults to `10` when omitted.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "success": true,
    "questions": [],
    "source": "database",
    "count": 0,
    "needsGeneration": true,
    "generationNeeded": 10
  },
  "traceId": "string",
  "timestamp": "2026-08-02T00:00:00.000Z"
}
```

`questions` contains `PreGeneratedQuestion` rows that pass production serving safety filters (`withProductionPregeneratedSafety`). Seen-question exclusion uses the **5,000 most recently seen** question IDs (`orderBy: lastSeenAt desc`).

**Error responses**

- `404` → `{ "ok": false, "error": { "code": "...", "message": "User not found" } }`
- `500` → `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Failed to fetch questions" } }`

**Notes**

- Learner-facing fetches are fail-closed to validated content; admin/authoring surfaces use separate routes for drafts.
- `timesServed` is incremented asynchronously via `context.waitUntil` for served question IDs (powers the flag-rate kill switch when `timesServed >= 20`).

---

### `POST /api/questions/generate-deep`

**Auth:** Required — **admin only** (`adminAuthenticatedEndpoint`, 25 req/min).

**Purpose:** High-fidelity preview generation using Gemini cached PANCE blueprint context (`cachedContents/...`). Output is **not** learner-servable — `submissionReady: false`, `requiresApproval: true`, `persistence: "admin_preview_only"`.

**Request body**

```json
{
  "body": {
    "condition": "Heart Failure",
    "category": "Cardiology",
    "implicitDifficulty": 0.5,
    "cachedContent": "cachedContents/cache_pance_master_v1",
    "count": 1
  }
}
```

| Field | Required | Description |
|---|---|---|
| `condition` | Yes | Condition or topic (e.g. `"COPD"`) |
| `category` | No | PANCE system/category for cache cross-reference |
| `implicitDifficulty` | No | `0–1` behavioral difficulty hint for vignette complexity |
| `cachedContent` | No | Cached content resource name; falls back to `CACHE_PANCE_MASTER_NAME` env |
| `count` | No | Questions to generate (`1–5`, default `1`) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "questions": [
      {
        "question": "stem text",
        "options": ["A", "B", "C", "D"],
        "correctAnswerIndex": 0,
        "explanation": "brief rationale",
        "system": "Cardiovascular",
        "conditionId": "optional-id",
        "id": "deep-preview-1730000000000-0",
        "submissionReady": false,
        "requiresApproval": true,
        "metadata": {
          "source": "generate-deep-preview",
          "persistence": "admin_preview_only",
          "adminPreviewOnly": true,
          "submissionReady": false,
          "requiresApproval": true,
          "condition": "Heart Failure",
          "category": "Cardiology"
        }
      }
    ]
  },
  "traceId": "string",
  "timestamp": "2026-08-02T00:00:00.000Z"
}
```

Malformed items (missing required fields, fewer than four options, invalid `correctAnswerIndex`) are filtered before the response is returned.

**Error responses**

- `400` → validation failure (e.g. missing `cachedContent` and `CACHE_PANCE_MASTER_NAME`)
- `429` → rate limited (`ErrorCode.RATE_LIMITED`)
- `500` → `{ "ok": false, "error": { "code": "ENV_MISCONFIGURED", "message": "AI generation service not configured" } }` when `GEMINI_API_KEY` is absent
- `502` → gateway/provider error (`ErrorCode.GEMINI_ERROR`)

**Notes**

- AI calls route through `lib/ai/aiGateway.ts` (`task: 'generation'`, `tier: 'balanced'`, `grounded: true`) with `cachedContent` for blueprint depth.
- Response JSON may arrive wrapped in markdown fences; the handler strips fences before parsing.
- When `ENABLE_QUALITY_GATE=true`, questions failing the shared clinical content validator are quarantined (dropped from the response, logged for admin review).

**Related env vars**

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required for generation |
| `CACHE_PANCE_MASTER_NAME` | Default cached content name when `body.cachedContent` is omitted |
| `ENABLE_QUALITY_GATE` | Set to `true` to run `runQualityGate()` on each generated question |
