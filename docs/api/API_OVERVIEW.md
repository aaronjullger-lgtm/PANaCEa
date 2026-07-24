# API Overview

This document tracks request/response contracts for recently changed API routes and shared infrastructure that affects edge handlers.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| — | *(shared)* | Gemini routing now reads `CLOUDFLARE_ACCOUNT_ID` (renamed from `CF_ACCOUNT_ID`) with `CF_AI_GATEWAY_ID` for Cloudflare AI Gateway proxying. |
| POST | `/api/admin/staging/approve` | Human-approve a staging question and mirror it to `PreGeneratedQuestion`; emergency topics require explicit human review. |
| POST | `/api/admin/staging/reject` | Reject a staging question (`status: rejected`). |
| PATCH | `/api/admin/staging/update` | Edit staging question fields before approval. |
| GET | `/api/admin/staging/list` | List staging-lake questions by status. |
| POST | `/api/admin/staging/run-critic` | Batch-score pending staging questions with the AI critic and auto-route by score. |
| POST | `/api/questions/staging` | Save a generated question to the staging lake. |
| POST | `/api/questions/staging/process` | Run adequacy checks on pending staging questions (auto-promote/flag/discard). |
| GET | `/api/questions/staging/stats` | Return staging-lake queue counts. |
| POST | `/api/questions/staging/:id/check` | Run adequacy check on a single staging question. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

---

## Shared Infrastructure

### Cloudflare AI Gateway routing (`functions/api/_shared/ai-gateway.ts`)

Gemini calls made through `buildGeminiUrl()` (and the unified `lib/ai/aiGateway` stack) route through Cloudflare AI Gateway when **both** env vars are set:

| Variable | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (formerly `CF_ACCOUNT_ID`; that name is no longer read) |
| `CF_AI_GATEWAY_ID` | AI Gateway instance ID |

When configured, requests use:

`https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CF_AI_GATEWAY_ID}/google-ai-studio/...`

When either value is missing, requests fall back to the direct Google Generative Language API (`generativelanguage.googleapis.com`).

**Affected callers:** all edge handlers and shared services that invoke Gemini through `ai-service.ts` / `lib/ai/aiGateway.ts`, including staging adequacy/critic checks, question generation, OSCE grading, and tutor/chat endpoints.

---

## Staging Lake Endpoints

Staging questions are generated content held for QA before promotion to `PreGeneratedQuestion`. Shared logic lives in `functions/api/_shared/staging-questions.ts`.

### Promotion rules (shared behavior)

- **Adequacy check** (`runAdequacyCheck`): uses AI gateway tier `fast` (gemini-2.0-flash). Requires correct answer resolution, explanation ≥ 50 words, no medical errors, and a completed AI check.
- **Critic** (`processStagingQueueWithCritic`): uses AI gateway tier `balanced` (gemini-2.5-flash). Score `> 90` → promote; `< 70` → reject; `70–90` → flag for human review.
- **Emergency topics:** questions matching emergency keywords (e.g. anaphylaxis, STEMI, stroke, sepsis, DKA) **cannot auto-promote**. `promoteToLive()` returns an error unless `allowPendingHumanReview: true` (set by `POST /api/admin/staging/approve` for `pending` rows).

---

### `POST /api/admin/staging/approve`

**Auth:** Admin required

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

- `400` → `{ "error": "Already approved" }`
- `400` → `{ "error": "Run adequacy check first or approve a pending question through human review." }`
- `404` → `{ "error": "Staging question not found" }`
- `500` → `{ "error": "Failed to approve" }` (includes emergency-topic blocks when status is not `pending`)

**Notes**

- Mirrors the staging row to `PreGeneratedQuestion` and upserts the canonical `Question` mirror.
- For `pending` questions, passes `allowPendingHumanReview: true` so admins can override automated gates (including emergency topics).

---

### `POST /api/admin/staging/reject`

**Auth:** Admin required

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

**Error responses**

- `404` → `{ "error": "Staging question not found" }`
- `500` → `{ "error": "Failed to reject" }`

---

### `PATCH /api/admin/staging/update`

**Auth:** Admin required

**Request body**

```json
{
  "body": {
    "id": "staging-question-uuid",
    "explanation": "optional string",
    "question": "optional string",
    "vignette": "optional string"
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

### `GET /api/admin/staging/list`

**Auth:** Admin required

**Query parameters**

| Param | Default | Values |
|---|---|---|
| `status` | `pending` | `pending`, `graded`, `rejected`, `approved`, `all` |
| `limit` | `50` | `1–100` |

**Success response (`200 OK`)**

```json
{
  "items": [
    {
      "id": "string",
      "system": "string",
      "difficulty": "string",
      "status": "pending",
      "vignette": "string",
      "question": "string",
      "explanation": "string",
      "aiGrade": {},
      "adminReview": "string | null",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "count": 0
}
```

**Error responses**

- `500` → `{ "error": "Failed to list staging questions" }`

---

### `POST /api/admin/staging/run-critic`

**Auth:** Admin required

**Request body**

```json
{
  "body": {
    "limit": 10
  }
}
```

`limit` is optional (`1–50`, default `10`).

**Success response (`200 OK`)**

```json
{
  "success": true,
  "processed": 3,
  "results": [
    { "id": "uuid", "status": "promoted", "score": 95 },
    { "id": "uuid", "status": "flagged_for_review", "score": 82 },
    { "id": "uuid", "status": "discarded", "score": 55 },
    { "id": "uuid", "status": "skipped", "error": "GEMINI_API_KEY not set" },
    { "id": "uuid", "status": "error", "error": "Emergency clinical topics require mandatory human review before promotion" }
  ]
}
```

**Error responses**

- `500` → `{ "error": "Failed to run critic" }`

---

### `POST /api/questions/staging`

**Auth:** Admin required

**Request body**

```json
{
  "questionData": {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "explanation": "string (≥ 50 words for adequacy pass)",
    "vignette": "optional string",
    "system": "optional string",
    "difficulty": "optional string | number",
    "tags": ["optional"]
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

### `POST /api/questions/staging/process`

**Auth:** Admin required

**Request body**

```json
{
  "limit": 10
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "results": [
    { "id": "uuid", "status": "promoted", "score": 1 },
    { "id": "uuid", "status": "skipped_pending", "score": 0.5, "error": "AI check failed" },
    { "id": "uuid", "status": "flagged", "score": 0 },
    { "id": "uuid", "status": "discarded", "score": 0.3 },
    { "id": "uuid", "status": "error", "error": "Emergency clinical topics require mandatory human review before promotion" }
  ]
}
```

---

### `GET /api/questions/staging/stats`

**Auth:** Admin required

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

**Auth:** Admin required

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
    "explanationLength": 120,
    "hasMedicalErrors": false,
    "accuracyCheckCompleted": true,
    "score": 1,
    "details": "[]"
  }
}
```

**Error responses**

- Structured failure via `fail()` helper (`ENV_MISCONFIGURED`, `INTERNAL_ERROR`)

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
