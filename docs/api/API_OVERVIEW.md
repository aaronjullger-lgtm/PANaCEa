# API Overview

This document tracks the request/response contracts for the most recently changed API routes and shared infrastructure.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/staging` | Save a generated question to the staging lake (admin). |
| POST | `/api/questions/staging/:id/check` | Run AI adequacy check on one staging question (admin). |
| POST | `/api/questions/staging/process` | Batch-process pending staging rows with adequacy checks (admin). |
| GET | `/api/questions/staging/stats` | Return staging queue counts by status (admin). |
| GET | `/api/admin/staging/list` | List staging questions for admin review. |
| POST | `/api/admin/staging/approve` | Promote a staging question to the live `PreGeneratedQuestion` pool. |
| POST | `/api/admin/staging/reject` | Reject a staging question. |
| PATCH | `/api/admin/staging/update` | Edit staging fields before approval. |
| POST | `/api/admin/staging/run-critic` | Batch-score pending rows with the AI critic and auto-route outcomes. |

## Shared Infrastructure

### Cloudflare AI Gateway (`functions/api/_shared/ai-gateway.ts`)

`buildGeminiUrl(apiKey, model, action, env?)` builds Gemini REST URLs. When **both** `CLOUDFLARE_ACCOUNT_ID` and `CF_AI_GATEWAY_ID` are set in the handler `env`, requests route through Cloudflare AI Gateway (`gateway.ai.cloudflare.com`) for semantic caching, analytics, and provider-level rate limiting. Otherwise the helper falls back to the direct Google Generative Language API.

Supported `action` values: `generateContent`, `streamGenerateContent`, `embedContent`.

### Staging quality pipeline (`functions/api/_shared/staging-questions.ts`)

Staging AI checks no longer call the Google SDK directly. They use the centralized `gateway.callText()` path (`lib/ai/aiGateway.ts`) so adequacy/critic calls share telemetry, fallback, and cost tracking with other generation endpoints.

| Internal function | Gateway tier | Model intent | Used by |
|---|---|---|---|
| `runAdequacyCheck` | `fast` | Cheap medical-accuracy check (`gemini-2.0-flash` equivalent) | `POST /api/questions/staging/:id/check`, `POST /api/questions/staging/process` |
| `processStagingQueueWithCritic` | `balanced` | Quality critic (`gemini-2.5-flash` equivalent) | `POST /api/admin/staging/run-critic` |

**Promotion safeguards**

- `saveToStaging` and `promoteToLive` validate structure (question text, ≥2 options, resolvable correct answer, non-empty explanation).
- Adequacy checks are **fail-closed**: if the AI critic does not complete, the row stays `pending` instead of auto-promoting.
- Emergency clinical topics (anaphylaxis, stroke/MI, sepsis, DKA, PE, etc.) require **mandatory human review** before promotion unless `allowPendingHumanReview` is set (admin approve path).

**Optional env vars for AI Gateway routing**

```env
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CF_AI_GATEWAY_ID=your_ai_gateway_id
GEMINI_API_KEY=your_gemini_api_key
```

---

## Endpoint Contracts

### `POST /api/questions/staging`

**Auth:** Admin

**Request body**

```json
{
  "questionData": {
    "question": "string",
    "options": ["string"],
    "correctAnswer": "string",
    "explanation": "string",
    "vignette": "string (optional)",
    "system": "string (optional)",
    "difficulty": "easy|medium|hard|number (optional)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "stagingQuestion": {
    "id": "uuid",
    "status": "pending"
  }
}
```

**Error responses**

- `400` → `{ "error": "Invalid staging question payload: …" }`

---

### `POST /api/questions/staging/:id/check`

**Auth:** Admin

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
  "result": {
    "isValid": true,
    "hasCorrectAnswer": true,
    "explanationLength": 72,
    "hasMedicalErrors": false,
    "accuracyCheckCompleted": true,
    "score": 0.95,
    "details": "[]"
  }
}
```

**Error responses**

- `500` → structured `fail()` with `ENV_MISCONFIGURED` or `INTERNAL_ERROR`

**Notes**

- Requires `GEMINI_API_KEY` for a full pass; without it, `accuracyCheckCompleted` is `false` and `isValid` is `false`.
- Safety-filter blocks return `accuracyCheckCompleted: false` (row stays pending).

---

### `POST /api/questions/staging/process`

**Auth:** Admin

**Request body**

```json
{
  "limit": 10
}
```

`limit` is optional, integer 1–100, default `10`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "results": [
    { "id": "uuid", "status": "promoted", "score": 0.95 },
    { "id": "uuid", "status": "skipped_pending", "score": 0.5, "error": "AI check failed" },
    { "id": "uuid", "status": "flagged", "score": 0.4 },
    { "id": "uuid", "status": "discarded", "score": 0.3 }
  ]
}
```

**Result `status` values:** `promoted`, `skipped_pending`, `flagged`, `discarded`, `error`.

---

### `GET /api/questions/staging/stats`

**Auth:** Admin

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

### `GET /api/admin/staging/list`

**Auth:** Admin

**Query params**

| Param | Values | Default |
|---|---|---|
| `status` | `pending`, `graded`, `rejected`, `approved`, `all` | `pending` |
| `limit` | 1–100 | `50` |

**Success response (`200 OK`)**

```json
{
  "items": [
    {
      "id": "uuid",
      "system": "CV",
      "difficulty": "medium",
      "status": "pending",
      "vignette": "string",
      "question": "string",
      "explanation": "string",
      "aiGrade": {},
      "adminReview": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### `POST /api/admin/staging/approve`

**Auth:** Admin

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

- `400` → already approved, or adequacy not passed (unless pending + human review path)
- `404` → staging question not found
- `500` → promotion failure (e.g. emergency topic without human review, canonical mirror failure)

**Notes**

- Mirrors to `PreGeneratedQuestion` using the **same id** as the staging row for provenance continuity.
- Pending rows can be approved via human review (`allowPendingHumanReview: true`).

---

### `POST /api/admin/staging/reject`

**Auth:** Admin

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

### `PATCH /api/admin/staging/update`

**Auth:** Admin

**Request body**

```json
{
  "body": {
    "id": "staging-question-uuid",
    "explanation": "string (optional)",
    "question": "string (optional)",
    "vignette": "string (optional)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "message": "Updated"
}
```

---

### `POST /api/admin/staging/run-critic`

**Auth:** Admin (rate-limited under `ai` bucket)

**Request body**

```json
{
  "body": {
    "limit": 10
  }
}
```

`limit` is optional, integer 1–50, default `10`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "processed": 3,
  "results": [
    { "id": "uuid", "status": "promoted", "score": 92 },
    { "id": "uuid", "status": "discarded", "score": 55 },
    { "id": "uuid", "status": "flagged_for_review", "score": 78 }
  ]
}
```

**Critic routing**

| Score | Outcome |
|---|---|
| `> 90` | Auto-promote when structural validation passes; otherwise flag for review |
| `70–90` | Flag for human review |
| `< 70` | Discard (`rejected`) |

**Result `status` values:** `promoted`, `discarded`, `flagged_for_review`, `skipped`, `error`.

**Notes**

- Requires `GEMINI_API_KEY`; without it every row returns `status: "skipped"`.
- Safety-filter blocks return `status: "skipped"` with `error: "Critic blocked by safety filter"`.

---

## Previously Documented Routes

The following routes were documented in an earlier pass and remain unchanged:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | Returns OSCE performance metrics and trends. |

See git history of this file for full contracts on those endpoints.
