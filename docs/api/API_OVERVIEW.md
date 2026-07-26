# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/staging` | Save a generated question to the staging lake with structural validation. |
| POST | `/api/questions/staging/:id/check` | Run an AI adequacy check on one staging question (fail-closed when review is unavailable). |
| POST | `/api/questions/staging/process` | Batch-process the pending staging queue with adequacy checks and auto-promotion. |
| GET | `/api/questions/staging/stats` | Return staging-lake counts by status. |
| GET | `/api/admin/staging/list` | List staging questions for admin review. |
| PATCH | `/api/admin/staging/update` | Edit a staging question before approval. |
| POST | `/api/admin/staging/approve` | Promote a staging question to the live `PreGeneratedQuestion` pool. |
| POST | `/api/admin/staging/reject` | Reject a staging question. |
| POST | `/api/admin/staging/run-critic` | Score pending staging questions with the Critic model and apply automation thresholds. |

## Shared Infrastructure

### AI Gateway (`functions/api/_shared/ai-gateway.ts`)

Gemini requests can be proxied through Cloudflare AI Gateway when both `CLOUDFLARE_ACCOUNT_ID` and `CF_AI_GATEWAY_ID` are set. `buildGeminiUrl()` falls back to the direct Google Generative Language API when those env vars are absent.

### Staging quality pipeline (`functions/api/_shared/staging-questions.ts`)

Staging adequacy and critic calls now route through `lib/ai/aiGateway` instead of direct Gemini SDK usage:

| Call site | Gateway tier | Model intent |
|---|---|---|
| `runAdequacyCheck` | `fast` | Cheap medical-accuracy review |
| `processStagingQueueWithCritic` | `balanced` | Higher-quality critic scoring |

**Fail-closed behavior:** If the adequacy AI check does not complete (`accuracyCheckCompleted: false`), queue processing leaves the question in `pending` and returns `skipped_pending` instead of promoting or discarding it.

**Promotion validation:** `saveToStaging` and `promoteToLive` require a resolvable `correctAnswer`, at least two options, and a non-empty explanation. Identity tags (`conditionName`, `conditionId`, `taskCategory`, etc.) are preserved in staging tags and copied into `questionData.provenance` on promotion.

## Endpoint Contracts

### `POST /api/questions/staging`

**Auth:** Required (admin endpoint)

**Request body**

```json
{
  "questionData": {
    "question": "string",
    "options": ["string"],
    "correctAnswer": "string",
    "explanation": "string or { rationale: string }",
    "system": "string (optional)",
    "difficulty": "easy|medium|hard|number (optional)",
    "vignette": "string (optional)",
    "metadata": {
      "taxonomyCode": "string (optional)",
      "conditionId": "string (optional)",
      "conditionName": "string (optional)",
      "taskCategory": "string (optional)"
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
    "options": ["string"],
    "correctAnswer": "string",
    "explanation": "string",
    "system": "string",
    "difficulty": "medium",
    "tags": ["taxonomy:PULM", "conditionName:Pulmonary embolism"]
  }
}
```

**Error responses**

- `400` → `{ "error": "Invalid staging question payload: ..." }`
- `500` → generic server error

---

### `POST /api/questions/staging/:id/check`

**Auth:** Required (admin endpoint)

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
    "explanationLength": 52,
    "hasMedicalErrors": false,
    "accuracyCheckCompleted": true,
    "score": 0.95,
    "details": "[]"
  }
}
```

**Error responses**

- `500` → structured failure via `fail(ErrorCode.INTERNAL_ERROR, ...)`

**Notes**

- Uses AI Gateway tier `fast` when `GEMINI_API_KEY` is configured.
- A question is valid only when it has a resolvable correct answer, explanation length ≥ 50 words, no medical errors, and a completed accuracy check.
- Updates staging status to `graded`, `rejected`, or leaves `pending` depending on the result.

---

### `POST /api/questions/staging/process`

**Auth:** Required (admin endpoint)

**Request body**

```json
{
  "limit": 10
}
```

`limit` is optional, integer `1–100`, default `10`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "results": [
    { "id": "uuid", "status": "promoted", "score": 0.95 },
    { "id": "uuid", "status": "skipped_pending", "score": 0.5, "error": "AI check failed" },
    { "id": "uuid", "status": "flagged", "score": 0.4 },
    { "id": "uuid", "status": "discarded", "score": 0.2 }
  ]
}
```

**Result statuses**

| Status | Meaning |
|---|---|
| `promoted` | Passed adequacy check and mirrored to `PreGeneratedQuestion` |
| `skipped_pending` | Adequacy AI did not complete; question stays pending |
| `flagged` | Medical errors detected; flagged for human review |
| `discarded` | Failed non-medical adequacy checks |
| `error` | Processing exception |

---

### `GET /api/questions/staging/stats`

**Auth:** Required (admin endpoint)

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

### `GET /api/admin/staging/list`

**Auth:** Required (admin endpoint)

**Query parameters**

| Param | Values | Default |
|---|---|---|
| `status` | `pending`, `graded`, `rejected`, `approved`, `all` | `pending` |
| `limit` | `1–100` | `50` |

**Success response (`200 OK`)**

```json
{
  "items": [
    {
      "id": "uuid",
      "system": "string",
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

### `PATCH /api/admin/staging/update`

**Auth:** Required (admin endpoint)

**Request body**

```json
{
  "body": {
    "id": "uuid",
    "explanation": "string (optional, max 50000)",
    "question": "string (optional, max 5000)",
    "vignette": "string (optional, max 10000)"
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

**Error responses**

- `404` → `{ "error": "Staging question not found" }`
- `500` → `{ "error": "Failed to update" }`

---

### `POST /api/admin/staging/approve`

**Auth:** Required (admin endpoint)

**Request body**

```json
{
  "body": {
    "id": "uuid"
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

- `400` → `{ "error": "Already approved" }` or adequacy/human-review message
- `404` → `{ "error": "Staging question not found" }`
- `500` → `{ "error": "Failed to approve" }`

**Notes**

- `graded` questions auto-promote; `pending` questions can be approved through explicit human review.
- Emergency clinical topics require human review before automated promotion.
- Promotion upserts `PreGeneratedQuestion` using the staging row ID and mirrors to canonical `Question` with provenance including `conditionName`.

---

### `POST /api/admin/staging/reject`

**Auth:** Required (admin endpoint)

**Request body**

```json
{
  "body": {
    "id": "uuid"
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

**Auth:** Required (admin endpoint; rate-limited as `ai`)

**Request body**

```json
{
  "body": {
    "limit": 10
  }
}
```

`limit` is optional, integer `1–50`, default `10`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "processed": 2,
  "results": [
    { "id": "uuid", "status": "promoted", "score": 95 },
    { "id": "uuid", "status": "flagged_for_review", "score": 82 },
    { "id": "uuid", "status": "discarded", "score": 55 },
    { "id": "uuid", "status": "skipped", "error": "GEMINI_API_KEY not set" }
  ]
}
```

**Critic thresholds**

| Score | Action |
|---|---|
| `> 90` | Promote to live pool when structural validation passes; otherwise flag for review |
| `70–90` | Flag for human review |
| `< 70` | Discard (reject) |

**Notes**

- Uses AI Gateway tier `balanced`.
- Skips all items when `GEMINI_API_KEY` is unset.

---

## Previously Documented Endpoints

The following routes were documented in an earlier revision of this file and remain stable:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/check-access` | Verifies whether the authenticated user has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent). |
| GET | `/api/osce/stats` | Returns OSCE performance metrics and trends. |

For full request/response shapes of those endpoints, see git history for this file or the handler implementations under `functions/api/admin/` and `functions/api/osce/`.
