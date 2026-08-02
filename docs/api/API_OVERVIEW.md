# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/mcp` | MCP server over HTTP (JSON-RPC 2.0); Prisma-backed tool execution context. |
| GET | `/api/dashboard/stats` | Compact dashboard metrics (streak, weak area, pass chance, review queue, study plan). |
| POST | `/api/drills/submit-review` | Canonical FSRS review pipeline for main/drill sessions; idempotent retries. |
| POST | `/api/embeddings/generate-questions` | Admin batch-embed pre-generated questions with `gemini-embedding-2` (768-dim pgvector). |
| POST | `/api/library/semantic-search` | Semantic or hybrid library search over `MedicalContent` via `gemini-embedding-2`. |
| POST | `/api/questions/attempt` | Stats-only attempt recording; FSRS writes go through `/api/drills/submit-review`. |

## Endpoint Contracts

### `POST /api/agents/mcp`

**Auth:** None (system-level MCP tools; not user-scoped)

**CORS:** `POST`, `OPTIONS` — `Access-Control-Allow-Origin: *`

**Request body:** JSON-RPC 2.0 envelope (e.g. `initialize`, `tools/list`, `tools/call`)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Success responses**

- `200 OK` → JSON-RPC result envelope
- `202 Accepted` → notification (no body) when the request is a JSON-RPC notification

**Error responses**

- `400` → `{ "jsonrpc": "2.0", "id": 0, "error": { "code": -32700, "message": "Parse error" } }`
- `500` → `{ "jsonrpc": "2.0", "id": 0, "error": { "code": -32603, "message": "Internal error: ..." } }`

**Notes**

- Creates a Prisma Edge client from `DATABASE_URL` and passes it to `McpServer` tool context (`userId: "mcp-system"`).
- DB-dependent tools require a configured `DATABASE_URL`; client is disconnected in `finally`.

---

### `GET /api/dashboard/stats`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "currentStreak": 0,
    "weakestSystem": "CV (13% of PANCE)",
    "predictedPassChance": 50,
    "streakFreezes": 0,
    "userCoins": 0,
    "streakGoalDays": "all",
    "reviewQueueStats": {
      "dueNow": 0,
      "overdue": 0,
      "dueToday": 0,
      "upcoming7Days": 0,
      "totalActive": 0
    },
    "studyPlanProgress": {
      "planDate": "2026-08-02",
      "status": "in_progress",
      "targetQuestionsCount": 40,
      "actualQuestionsAnswered": 12,
      "completionPercent": 30,
      "actualAccuracy": 75,
      "estimatedTimeMinutes": 45
    }
  }
}
```

`studyPlanProgress` may be `null` when no active plan exists. `streakGoalDays` is `"all"` or `"weekdays"`.

**Error responses**

- `500` → `{ "success": false, "error": "Internal server error", "details": "optional-string" }`

**Notes**

- Responses are cached in D1 (`EDGE_DB`) under `dashboard:stats:{clerkUserId}` for **120 seconds**.
- Cache is invalidated (fire-and-forget) after successful writes to `/api/questions/attempt` or `/api/drills/submit-review`.
- Rate limit: 60 requests/minute per user.

---

### `POST /api/drills/submit-review`

**Auth:** Required (`authenticatedEndpoint`)

**CORS:** `OPTIONS` handled without auth (preflight only).

**Request body** — canonical schema: `lib/api/schemas/drills.ts` → `DrillSubmitReviewRequestSchema`

```json
{
  "questionId": "string",
  "canonicalQuestionId": "string (optional)",
  "sourceQuestionId": "string (optional)",
  "questionSource": "question | pre_generated | staging | seed | generated (optional)",
  "medicalContentId": "string (optional)",
  "selectedAnswer": "string | number",
  "timeSpentMs": 12000,
  "timeToFirstClick": 3000,
  "answerSwitches": 1,
  "totalDwellTime": 8000,
  "timezone": "America/New_York (optional)",
  "wakeTimeHHMM": "07:00 (optional)",
  "sessionType": "main | drill | cram | rapid_recall | targeted (optional, default drill)",
  "idempotencyKey": "8-128 char string (optional)",
  "telemetry": {
    "duration_ms": 12000,
    "rapid_guess": false,
    "question_type": "vignette | recall | image | rapid_recall | unknown",
    "mvrt_threshold_ms": 3000,
    "question_displayed_at": "ISO-8601",
    "answer_submitted_at": "ISO-8601",
    "answer_changes": 0,
    "hint_viewed": false,
    "session_id": "optional-session-id",
    "urgency_multiplier": 1.0
  }
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "isCorrect": true,
    "quality": 4,
    "parTimeMs": 45000,
    "timeSpentMs": 12000,
    "implicitMetrics": {
      "rating": 1,
      "gradeContinuous": 0.82,
      "confidence": 0.75,
      "latencyRatio": 0.27,
      "answerSwitches": 1
    },
    "circadian": {
      "phase": "peak",
      "stabilityModifier": 1.0,
      "localHour": 14
    },
    "fsrsSchedule": {
      "intervalDays": 4,
      "nextDueDate": "2026-08-06T00:00:00.000Z",
      "stability": 2.1,
      "difficulty": 5.3
    },
    "mastery": {
      "wilsonLower": 0.6,
      "wilsonUpper": 0.9,
      "pointEstimate": 0.75,
      "effectiveN": 8,
      "totalN": 10,
      "isMastered": false,
      "isGoldMastery": false,
      "correctNeededForMastery": 2
    },
    "isRapidGuess": false,
    "nextReview": {
      "intervalDays": 4,
      "nextDueDate": "2026-08-06T00:00:00.000Z",
      "stability": 2.1,
      "difficulty": 5.3
    },
    "drillFeedback": {
      "conditionAccuracy": 72,
      "systemAccuracy": 68,
      "relativePerformance": 1.06,
      "conditionAttemptCount": 12,
      "systemAttemptCount": 45,
      "isRemediationTarget": false
    }
  }
}
```

`fsrsSchedule`, `mastery`, `nextReview`, and `drillFeedback` may be omitted or `null` depending on session type, rapid-guess filter, and data availability. `drillFeedback` is populated for `sessionType` of `drill` (or omitted/default).

**Error responses**

- `404` → `{ "error": "Question not found" }`
- `409` → `{ "error": "Submission is still processing. Retry shortly.", "code": "CONFLICT", "details": { "retryAfterSeconds": 5 } }` (header `Retry-After`)
- `500` / `504` → `{ "error": "Failed to submit review", "code": "INTERNAL_ERROR | DATABASE_ERROR | SUBMISSION_TIMEOUT", "retryable": true }`

**Notes**

- **Single writer for FSRS:** ReviewLog, UserProgress, Card, and scheduling are owned by `drillReviewService` via this endpoint.
- **Idempotency:** Optional `idempotencyKey` uses persistent DB idempotency plus KV cache (`idem:submit-review:{clerkId}:{key}`, 24h TTL).
- **Session gating:** `main`, `drill`, and `targeted` update FSRS; `cram` and `rapid_recall` skip FSRS.
- **Implicit ratings only:** No self-reported confidence fields; ratings are derived from telemetry.
- Invalidates `dashboard:stats:{clerkUserId}` D1 cache on success.
- Rate limit: 120 requests/minute per user.

---

### `POST /api/embeddings/generate-questions`

**Auth:** Required (admin-authenticated endpoint)

**Request body**

```json
{
  "body": {
    "questionIds": ["id-1", "id-2"]
  }
}
```

Max **100** IDs per request.

**Success response (`200 OK`)**

```json
{
  "data": {
    "embedded": 8,
    "skipped": 2,
    "errors": ["Question id-x: insufficient text for embedding"],
    "total": 10
  }
}
```

`errors` is capped at 10 entries.

**Error responses**

- `500` → `{ "error": "AI embedding service not configured" }` or embedding failure message

**Notes**

- Model: **`gemini-embedding-2`** (768 dimensions) stored in `QuestionEmbedding` (pgvector).
- Skips questions that already have embeddings; upserts on conflict.
- Rate limit: 10 requests/minute (expensive Gemini calls).

---

### `POST /api/library/semantic-search`

**Auth:** Required (`aiEndpoint` — authenticated + Gemini env)

**Request body**

```json
{
  "query": "acute chest pain differential",
  "limit": 20,
  "mode": "semantic",
  "crag": false
}
```

| Field | Default | Description |
|---|---|---|
| `query` | required | 1–2000 characters |
| `limit` | `20` | 1–50 results |
| `mode` | `"semantic"` | `"semantic"` (pure vector) or `"hybrid"` (keyword + semantic RRF) |
| `crag` | `false` | Corrective RAG grading to filter low-relevance hits |

**Success response (`200 OK`)**

```json
{
  "data": {
    "results": [
      {
        "id": "mc-id",
        "condition": "Acute coronary syndrome",
        "conditionId": "cond-id",
        "system": "CV",
        "similarity": 0.87,
        "overview": "...",
        "symptoms": "...",
        "first_line_rx": "...",
        "gold_standard_dx": "..."
      }
    ],
    "count": 1,
    "mode": "semantic",
    "queryComplexity": "simple",
    "crag": {
      "qualityScore": 0.85,
      "accepted": 1,
      "rejected": 0,
      "fallbackTriggered": false
    }
  }
}
```

Hybrid mode adds `keywordScore`, `semanticScore`, and `source` per result. `crag` metadata is present only when `crag: true`.

**Error responses**

- `500` → `{ "error": "AI search service not configured" }` or `{ "error": "Semantic search failed" }`

**Notes**

- Embedding model: **`gemini-embedding-2`** via shared `lib/gemini.ts#getEmbedding`.
- Semantic path uses HNSW `ef_search = 100` for recall tuning.
- Response header: `Cache-Control: private, max-age=60`.
- Rate limit: 10 requests/minute.

---

### `POST /api/questions/attempt`

**Auth:** Required (`authenticatedEndpoint`)

**Request body** — canonical schema: `lib/api/schemas/questions.ts` → `QuestionAttemptRequestSchema`

```json
{
  "body": {
    "questionId": "string",
    "canonicalQuestionId": "string (optional)",
    "sourceQuestionId": "string (optional)",
    "questionSource": "question | pre_generated | staging | seed | generated (optional)",
    "isCorrect": true,
    "system": "CV (optional)",
    "conditionId": "string (optional)",
    "medicalContentId": "string (optional)",
    "questionType": "mcq (optional)",
    "mode": "session | drill | review | exam | rapid_recall (optional)",
    "timeSpentMs": 15000,
    "answerChangedCount": 1,
    "selectedAnswer": "B",
    "telemetryJson": {},
    "isMainSession": false,
    "idempotencyKey": "8-128 char string (optional)"
  }
}
```

Either `isCorrect` or `wasCorrect` is required.

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "attemptId": "attempt-userId-key",
    "stats": {
      "totalQuestionsAnswered": 150,
      "correctAnswers": 112,
      "overallAccuracy": 75
    },
    "systemStats": {
      "system": "CV",
      "totalAttempts": 30,
      "correctAttempts": 22,
      "accuracy": 73,
      "recentTrend": "improving"
    },
    "deduped": false
  }
}
```

`deduped: true` when an idempotent retry returns an existing attempt. `systemStats` is omitted when no `system` was sent.

**Error responses**

- `400` → `{ "success": false, "error": "Question identity could not be resolved", "code": "QUESTION_IDENTITY_UNRESOLVED" }`
- `500` → unhandled failure (`Failed to record attempt`)

**Notes**

- **Stats-only:** Writes `QuestionAttempt`, `UserQuestionSeen`, and question aggregate counters. Does **not** write FSRS state — use `/api/drills/submit-review` for scheduling.
- **Idempotency:** Optional `idempotencyKey` uses deterministic attempt IDs and KV cache (`idem:questions-attempt:{clerkId}:{key}`, 24h TTL).
- **Identity:** Resolves `questionIdentityId` when possible; mirrors pre-generated questions to canonical `Question` rows before FK writes.
- Aggregate stats use O(1) SQL `COUNT`/`SUM` (not full history scan).
- Invalidates `dashboard:stats:{clerkUserId}` D1 cache on success.
- Legacy fields `isMainSession` and `rating` are accepted for stale offline sync but ignored for FSRS.
