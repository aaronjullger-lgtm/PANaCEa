# API Overview

Current Cloudflare Pages Function contracts for the API routes changed in this update.

## Conventions

- **Auth stack:** `authenticatedEndpoint(...)` requires Clerk bearer auth and validates `DATABASE_URL` + `CLERK_SECRET_KEY` before handler execution.
- **Public stack:** `publicEndpoint(...)` does not require auth but still applies validation and rate limiting.
- **Validation source:** endpoints with `{ source: 'query' }` validate URL query params; defaults validate JSON body.
- **Error envelope:** middleware returns JSON errors as `{ "error": "..." }` with proper HTTP status.

## Changed Routes (summary)

| Method | Path | Auth | One-line description |
|---|---|---|---|
| GET | `/api/health` | Public | Health/runtime diagnostics with DB/env checks and anonymous rate limiting. |
| GET | `/api/content/library` | Required | Returns filtered clinical library cards with FTS + ILIKE fallback. |
| GET | `/api/content/systems` | Required | Returns distinct systems and per-system counts for library filters. |
| GET | `/api/content/condition/:conditionId/details` | Public | Loads heavy condition detail payload with linked relational resources. |
| POST | `/api/osce/chat` | Required | Saves chat transcript for an owned OSCE session. |
| POST | `/api/osce/complete` | Required | Marks an OSCE session complete and optionally persists analytics artifacts. |
| POST | `/api/questions/due-siblings` | Required | Fetches sibling questions for due concepts; may trigger on-demand variant generation. |
| POST | `/api/questions/generate-enhanced` | Required | Generates Kaplan-style questions with CoVe verification metadata. |
| GET | `/api/questions/pool` | Required | Fetches user-tailored pool questions with blueprint-aware selection and fallback logic. |
| POST | `/api/questions/pool` | Required | Seeds a question into `PreGeneratedQuestion` pool. |
| GET | `/api/questions/session` | Required | Fetches a session question set (query-driven contract). |
| POST | `/api/questions/session` | Required | Fetches a session question set (JSON-body contract). |

## Request/Response Contracts

### `GET /api/health`

- **Auth:** Public.
- **Rate limit:** anonymous profile via shared rate limiter.
- **Success:** `200` (healthy) or `503` (unhealthy), including:
  - `status`, `timestamp`, `endpoint`
  - `checks` (function/env/db/auth/cache/content checks)
  - `diagnostics` (masked env presence, DB URL type, optional errors)
- **Top-level failure:** `503` with `status: "unhealthy"` and `diagnostics.error`.

### `GET /api/content/library`

- **Auth:** Required.
- **Query params:** `system`, `subcategory`, `search`, `highYield`, `page`, `pageSize`.
  - Current handler behavior actively uses `system`, `subcategory`, `search`, `highYield`.
- **Success (`200`):**

```json
{
  "content": [],
  "count": 0
}
```

- **Notes:** FTS (`search_vector`) preferred; falls back to case-insensitive contains matching when needed. Non-search requests are KV-cached (1h).
- **Errors:** `503` (DB unavailable or load failure), typically with `error`/`message` and optional fallback `content`/`count`.

### `GET /api/content/systems`

- **Auth:** Required.
- **Success (`200`):**

```json
[
  { "id": "Cardiology", "label": "Cardiology", "count": 120 }
]
```

- **Notes:** KV-cached (1h).
- **Errors:** `503` (DB missing), `500` (query failure).

### `GET /api/content/condition/:conditionId/details`

- **Auth:** Public.
- **Params:** `conditionId` (1..200 chars).
- **Success (`200`):** full detail object (overview/diagnostics/treatment/differentials + linked labs/imaging/drugs/findings/ECG/treatments + related conditions).
- **Headers:** `Cache-Control: public, max-age=300`.
- **Errors:** `404` (`not_found`), `503` (DB/config/load failures).

### `POST /api/osce/chat`

- **Auth:** Required.
- **Request body:**

```json
{
  "body": {
    "sessionId": "string",
    "messages": [
      { "role": "user", "content": "..." }
    ]
  }
}
```

- **Validation:** `messages` length `1..100`, each `content` max `10000`.
- **Success (`200`):**

```json
{ "success": true }
```

- **Errors:** `404` (user/session not found), `500`.

### `POST /api/osce/complete`

- **Auth:** Required.
- **Request body:**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "optional string",
    "treatmentPlan": "optional string",
    "soapComparison": {},
    "timingAnalytics": {},
    "infographics": []
  }
}
```

- **Success (`200`):**
  - Standard completion: `{ "success": true }`
  - Idempotent re-complete: `{ "success": true, "alreadyCompleted": true }`
- **Errors:** `404` (user/session not found), `500`.

### `POST /api/questions/due-siblings`

- **Auth:** Required.
- **Request body (top-level JSON):**

```json
{
  "dueItems": [
    {
      "conditionId": "string",
      "taskType": "optional string or null",
      "originalQuestionId": "string"
    }
  ]
}
```

- **Success (`200`):**

```json
{
  "results": [
    {
      "question": {
        "id": "string",
        "question": "string",
        "options": [],
        "correctAnswerIndex": 0,
        "rationale": "string",
        "system": "string",
        "difficulty": "string",
        "source": "pool"
      },
      "dueConceptKey": { "conditionId": "string", "taskType": null }
    }
  ]
}
```

- **Notes:** never returns the `originalQuestionId`; may generate a sibling variant on demand when none exists and `GEMINI_API_KEY` is configured.
- **Errors:** `404` (user not found), `500`.

### `POST /api/questions/generate-enhanced`

- **Auth:** Required.
- **Request body:**

```json
{
  "body": {
    "context": "string",
    "conditionId": "string",
    "conditionName": "string",
    "system": "string",
    "task": "string",
    "difficulty": "easier | same | harder"
  }
}
```

- **Success (`200`):**

```json
{
  "success": true,
  "question": {
    "id": "string",
    "vignette": "string",
    "question": "string",
    "options": [],
    "correctAnswerIndex": 0,
    "rationale": {},
    "pearls": [],
    "conditionId": "string",
    "conditionName": "string",
    "system": "string",
    "task": "string",
    "difficulty": "same"
  },
  "verification": {
    "verified": true,
    "confidence": 0.9,
    "attempts": 1,
    "verificationId": "optional string",
    "recommendation": "accept | review",
    "flags": []
  }
}
```

- **Notes:** runs CoVe verification and returns verification metadata to clients.
- **Errors:** middleware-formatted `500` on generation failure.

### `GET /api/questions/pool`

- **Auth:** Required.
- **Query params:** `system`, `systems` (comma-separated), `category`, `difficulty`, `count`, `mode`.
- **Special mode:** `mode=curation` is admin-only.
- **Success (`200`):**

```json
{
  "questions": [],
  "poolStatus": {
    "available": 0,
    "needsGeneration": false,
    "threshold": 20
  }
}
```

- **Headers:** `X-Cache: HIT|MISS` when KV cache is used.
- **Errors:** `403` (curation without admin role), `404` (user not found), `503`/`500`.

### `POST /api/questions/pool`

- **Auth:** Required.
- **Request body (top-level JSON):**

```json
{
  "question": {
    "id": "string",
    "question": "string",
    "options": [],
    "correctAnswer": "A",
    "explanation": "string",
    "system": "optional string",
    "conditionId": "optional string",
    "medicalContentId": "optional string",
    "difficulty": "optional string",
    "vignette": "optional string",
    "conditionName": "optional string",
    "subcategory": "optional string",
    "tags": []
  }
}
```

- **Success:** `201` with `{ "success": true }`.
- **Errors:** `500`.

### `GET /api/questions/session`

- **Auth:** Required.
- **Query params:** `count`, `system`, `mode`, `simulationStrict`, `eorMode`, `eorDeadline`.
- **Success (`200`):** session payload from `SessionService`, including:

```json
{
  "questions": [],
  "analytics": {},
  "poolStatus": { "available": 0, "needsGeneration": false }
}
```

- **Errors:** `503` when DB unavailable/transient lookup failures, otherwise `500`.

### `POST /api/questions/session`

- **Auth:** Required.
- **Request body (top-level JSON):**

```json
{
  "count": 10,
  "system": "optional string",
  "mode": "standard | review | weakness | random | interleaved",
  "systems": ["optional", "system", "array"],
  "prioritizeWeakAreas": true,
  "simulationStrict": false,
  "eorMode": false,
  "eorDeadline": "optional ISO string"
}
```

- **Success (`200`):** same shape as `GET /api/questions/session`.
- **Errors:** `503`/`500`.

## Operational Notes

- Shared middleware now consistently injects `X-Request-ID` and forwards `Sentry-Trace` when present.
- Authenticated endpoints are rate-limited (default `300 req/min`) unless overridden per endpoint.
- Public endpoints use IP-based rate limiting; `/api/health` additionally uses the anonymous profile from `rateLimiter.ts`.
