# API Overview

Current API surface for recently changed Cloudflare Pages Functions routes.

## Conventions

- **Auth:** Most endpoints use Clerk bearer auth via middleware (`authenticatedEndpoint` / `adminEndpoint`).
- **Error envelope:** Middleware-backed errors are returned as JSON: `{ "error": "..." }`.
- **Body shape:** Some endpoints validate top-level JSON fields; others expect wrapped payloads in `{ "body": { ... } }`.
- **Query source:** Endpoints that pass `{ source: 'query' }` validate URL query params; otherwise validation defaults to request body.

## Changed Routes (summary)

| Method | Path | Auth | One-line description |
|---|---|---|---|
| GET | `/api/health` | Public | Health and environment diagnostics, including DB connectivity. |
| POST | `/api/gemini` | Required | Non-streaming Gemini proxy with rate limiting and optional context cache. |
| GET | `/api/content/library` | Required | Condition library list with system/subcategory/high-yield/search filtering. |
| GET | `/api/content/systems` | Required | Distinct system list with condition counts. |
| GET | `/api/content/condition/:conditionId/summary` | Public | Lightweight condition summary for header/cheat-sheet UX. |
| GET | `/api/content/condition/:conditionId/details` | Public | Full condition details and linked relational content. |
| GET | `/api/dashboard/stats` | Required | Dashboard rollups (streak, weakest system, predicted pass chance). |
| GET | `/api/diagnostic-puzzle/daily` | Required | Daily puzzle payload + user state for the current date. |
| POST | `/api/diagnostic-puzzle/submit` | Required | Submit diagnostic puzzle guess and update puzzle state. |
| GET | `/api/diagnostic-puzzle/stats` | Required | User diagnostic puzzle performance stats and streak. |
| POST | `/api/drills/contrastive/start` | Required | Load a contrastive drill set by ID. |
| POST | `/api/osce/analysis/grade` | Required | Grade completed OSCE session transcript, persist result/concept gap. |
| POST | `/api/questions/generate` | Required | Generate (or cache-hit) question by query text/type/system/difficulty. |
| POST | `/api/questions/attempt` | Required | Record attempt telemetry and update stats/SRS/Rolling 360. |
| POST | `/api/recommendations/generate` | Required | Generate personalized recommendation list for user. |
| GET | `/api/reference/normal-labs` | Required | Fetch normal lab reference records (optional category filter). |
| GET | `/api/user/daily-performance` | Required | Daily attempt/accuracy trend for configurable lookback window. |
| GET | `/api/user/goals` | Required | List goals with optional status/type filters. |
| POST | `/api/user/goals` | Required | Create new goal. |
| PATCH | `/api/user/goals/:id` | Required | Update goal progress/status/metadata. |
| DELETE | `/api/user/goals/:id` | Required | Delete goal by ID. |
| GET | `/api/sync` | Required | Download the authenticated user's cloud-synced records (performance, SRS, saved questions). |
| POST | `/api/sync` | Required | Upload and merge local user data into cloud state, then return merged server state. |
| POST | `/api/user/session` | Required | Start study session. |
| PATCH | `/api/user/session` | Required | Update or end study session. |
| GET | `/api/admin/enrich-condition` | Admin | Endpoint usage contract + enrichable field list. |
| POST | `/api/admin/enrich-condition` | Admin | AI-enrich missing `MedicalContent` fields for a condition. |
| GET | `/api/admin/library-enrichment-logs` | Required + admin role check in handler | Read enrichment run logs with filters/pagination. |
| GET | `/api/admin/library-enrichment-priority` | Required + admin role check in handler | Read prioritized enrichment queue payload. |

## Request/Response Contracts

### `GET /api/health`

- **Request:** No auth; no body required.
- **Success:** `200` (healthy) or `503` (unhealthy) with:
  - `status`, `timestamp`, `endpoint`
  - `checks` (environment/database/content checks)
  - `diagnostics` (env presence, db URL type, optional errors)
- **Errors:** `503` with diagnostics if top-level failure occurs.

### `POST /api/gemini`

- **Request body (top-level JSON):**

```json
{
  "prompt": "string",
  "modelName": "gemini-2.0-flash",
  "temperature": 0.8,
  "maxTokens": 2048,
  "systemInstruction": "optional string",
  "cachedContent": "cachedContents/...",
  "thinkingLevel": "MINIMAL | LOW | MEDIUM | HIGH"
}
```

- **Success (`200`):**

```json
{
  "data": {
    "text": "generated output",
    "model": "gemini-2.0-flash",
    "finishReason": "..."
  }
}
```

- **Errors:** `400`, `429`, `500`, `503` with `{ "error": "..." }`.

### `GET /api/content/library`

- **Auth:** Required.
- **Query params:** `system`, `subcategory`, `search`, `highYield`, `page`, `pageSize`.
  - Current implementation uses `system`, `subcategory`, `search`, `highYield`.
- **Success (`200`):**

```json
{
  "content": [/* MedicalContent card payload */],
  "count": 123
}
```

- **Errors:** `503` when DB unavailable; fallback error payload includes empty `content` and `count: 0`.

### `GET /api/content/systems`

- **Success (`200`):**

```json
[
  { "id": "Cardiology", "label": "Cardiology", "count": 120 }
]
```

- **Errors:** `503` (DB unavailable), `500` (query failure).

### `GET /api/content/condition/:conditionId/summary`

- **Auth:** Public.
- **Params:** `conditionId`.
- **Success (`200`): Minimal summary object including IDs/system/yield/buzzwords/synonyms/triad/pearls/mnemonic and `confusedWith[]`.
- **Errors:** `404` condition not found, `503` DB unavailable, `500` load failure.

### `GET /api/content/condition/:conditionId/details`

- **Auth:** Public.
- **Params:** `conditionId`.
- **Success (`200`): Rich condition payload (overview, diagnostics, treatment, differentials, linked labs/imaging/drugs/findings/ECG/treatments, related conditions).
- **Errors:** `404`, `503`, `500`.

### `GET /api/dashboard/stats`

- **Success (`200`):**

```json
{
  "currentStreak": 0,
  "weakestSystem": "Pulmonary (9% of PANCE)",
  "predictedPassChance": 72,
  "streakFreezes": 0,
  "userCoins": 0,
  "streakGoalDays": "all | weekdays"
}
```

- **Errors:** `404` user not found; `500` internal error.

### `GET /api/diagnostic-puzzle/daily`

- **Auth:** Required.
- **Current validated request shape:** `{ "query": { "date": "optional ISO string" } }` (handler reads `validated.query.date`).
- **Success (`200`):**

```json
{
  "id": "dailyPuzzleId",
  "date": "YYYY-MM-DD",
  "puzzle": {
    "id": "puzzleId",
    "conditionId": "string",
    "conditionName": "string",
    "system": "string | null",
    "title": "string | null",
    "difficulty": 1,
    "clues": ["..."],
    "totalClues": 6
  },
  "userState": {
    "guesses": ["..."],
    "status": "playing | won | lost",
    "cluesRevealed": 1,
    "attemptsLeft": 6,
    "maxAttempts": 6
  }
}
```

- **Errors:** `400` service validation error, `404` user not found, `500` internal error.

### `POST /api/diagnostic-puzzle/submit`

- **Request body:**

```json
{
  "body": {
    "guess": "string",
    "date": "optional ISO string"
  }
}
```

- **Success:** Same payload structure as `/api/diagnostic-puzzle/daily`, with updated `userState`.
- **Errors:** `400`, `404`, `500`.

### `GET /api/diagnostic-puzzle/stats`

- **Success (`200`):**

```json
{
  "total": 0,
  "wins": 0,
  "losses": 0,
  "winRate": 0,
  "streak": 0,
  "guessDistribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 }
}
```

### `POST /api/drills/contrastive/start`

- **Request body:**

```json
{
  "body": { "setId": "string" }
}
```

- **Success (`200`):** `{ "set": { ...contrastiveSetRecord } }`
- **Errors:** `404`/`500` style failures with `{ "error": "..." }`.

### `POST /api/osce/analysis/grade`

- **Request body:**

```json
{
  "body": { "sessionId": "string" }
}
```

- **Success (`200`):**

```json
{
  "resultId": "string",
  "score": 0,
  "checklist": [{ "item": "string", "status": "PASS | FAIL", "feedback": "string" }],
  "redFlagsMissed": ["string"],
  "clinicalReasoningScore": 0,
  "billingCodeSuggestion": "string",
  "softSkillsReport": {
    "empathy": { "score": 1, "feedback": "string" },
    "professionalism": { "score": 1, "feedback": "string" },
    "pacing": { "score": 1, "feedback": "string" }
  },
  "conceptGapCreated": false
}
```

- **Notable errors:** `400`, `404`, `422`, `429`, `502`, `500`.

### `POST /api/questions/generate`

- **Request body (top-level JSON):**

```json
{
  "queryText": "string",
  "questionType": "string",
  "system": "optional string",
  "difficulty": "optional string"
}
```

- **Success (`200`):**

```json
{
  "success": true,
  "question": { "id": "string", "text": "string", "metadata": {} },
  "cached": false,
  "similarity": 0.91
}
```

(`similarity` is present only when returning a semantic cache hit.)

### `POST /api/questions/attempt`

- **Request body:**

```json
{
  "body": {
    "questionId": "string",
    "isCorrect": true,
    "wasCorrect": true,
    "system": "optional string",
    "conditionId": "optional string",
    "medicalContentId": "optional string",
    "questionType": "optional string",
    "mode": "session",
    "timeSpent": 1200,
    "timeSpentMs": 1200,
    "answerChangedCount": 1,
    "isRankedAttempt": false,
    "selectedAnswer": 0,
    "telemetryJson": {},
    "durationMs": 1200,
    "isMainSession": false
  }
}
```

- **Success (`200`):**

```json
{
  "success": true,
  "attemptId": "string",
  "stats": {
    "totalQuestionsAnswered": 0,
    "correctAnswers": 0,
    "overallAccuracy": 0
  },
  "systemStats": {
    "system": "Cardiology",
    "totalAttempts": 0,
    "correctAttempts": 0,
    "accuracy": 0,
    "recentTrend": "improving | declining | neutral"
  }
}
```

### `POST /api/recommendations/generate`

- **Request:** Empty object `{}`.
- **Success (`200`):**

```json
{
  "success": true,
  "count": 3,
  "recommendations": [/* recommendation objects */]
}
```

### `GET /api/reference/normal-labs`

- **Query params:** `category` (optional), `limit` (1-500, default 200).
- **Consumers:**
  - `NormalLabsPanel` — in-session slide-out panel during quiz questions
  - `NormalLabsLibraryView` — Knowledge Base → Lab Reference → Normal Ranges tab
- **Success (`200`):**

```json
{
  "success": true,
  "labs": [/* NormalLabValue fields */]
}
```

### `GET /api/user/daily-performance`

- **Query params:** `days` (1-90, default 30).
- **Success (`200`):**

```json
{
  "period": "30d",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "dailyPerformance": [
    { "date": "YYYY-MM-DD", "attempts": 0, "correct": 0, "accuracy": 0 }
  ],
  "summary": {
    "totalAttempts": 0,
    "totalCorrect": 0,
    "activeDays": 0,
    "avgAttemptsPerActiveDay": 0
  }
}
```

### `GET/POST/PATCH/DELETE /api/user/goals`

- **GET query params:** `status`, `goalType`, `limit`.
- **POST body:** `{ "body": { title, goalType, targetValue?, targetUnit?, targetDate?, ... } }`
- **PATCH body:** `{ "body": { title?, currentValue?, status?, targetDate?, ... } }` against `/api/user/goals/:id`.
- **DELETE:** `/api/user/goals/:id`.
- **Success pattern:** `{ "success": true, "goal": { ... }, "message": "..." }` (or list payload for GET).

### `GET /api/sync`

- **Auth:** Required (`Authorization: Bearer <Clerk token>`).
- **Request:** No body; query-validated with an empty schema.
- **Success (`200`):**

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "performanceRecords": [
      {
        "id": "uuid",
        "topic": "Cardiology",
        "focus": "all",
        "isCorrect": true,
        "timestamp": 1738022400000
      }
    ],
    "srsItems": [],
    "savedQuestions": []
  }
}
```

- **Notes:**
  - `performanceRecords[].timestamp` is returned as a number (converted from DB bigint).
  - If the Clerk user does not exist in `User`, the endpoint creates a placeholder user record and then returns empty/new data.
- **Errors:** `401` (auth required), `429` (rate limit), `500` (sync retrieval failure).

### `POST /api/sync`

- **Auth:** Required (`Authorization: Bearer <Clerk token>`).
- **Request body (top-level JSON):**

```json
{
  "userId": "clerk_user_id",
  "performanceRecords": [
    {
      "id": "optional uuid",
      "topic": "Cardiology",
      "system": "Cardiology",
      "focus": "all",
      "difficulty": "medium",
      "isCorrect": true,
      "timestamp": 1738022400000,
      "questionWordCount": 88,
      "errorTag": null,
      "subcategoryName": "Arrhythmias",
      "conditionName": "Atrial fibrillation"
    }
  ],
  "srsItems": [
    {
      "questionId": "q_123",
      "interval": 3,
      "repetition": 4,
      "easiness": 2.45,
      "dueDate": "2026-03-16T00:00:00.000Z",
      "lastReviewed": "2026-03-14T10:30:00.000Z",
      "quality": 4,
      "difficulty": "2.2",
      "stabilityScore": 0.78,
      "updatedAt": "2026-03-14T10:30:00.000Z"
    }
  ],
  "savedQuestions": [
    {
      "questionId": "q_123",
      "questionText": "Which rhythm is most likely?",
      "type": "missed",
      "updatedAt": "2026-03-14T10:30:00.000Z"
    }
  ]
}
```

- **Validation constraints:**
  - `userId`: required string.
  - `performanceRecords`: optional, max `1000`.
  - `srsItems`: optional, max `1000`.
  - `savedQuestions`: optional, max `500`, `type` is one of `saved | flagged | missed`.
- **Success (`200`):**

```json
{
  "success": true,
  "message": "Data synced successfully",
  "data": {
    "performanceRecords": [],
    "srsItems": [],
    "savedQuestions": []
  }
}
```

- **Behavior notes:**
  - `userId` must match the authenticated Clerk user ID, otherwise request is rejected.
  - Endpoint uses batched upserts/replace patterns and retries transient Accelerate/network failures.
  - Response always returns the latest server state after merge.
- **Errors:** `400` (validation), `401` (auth required), `403` (`userId` mismatch), `429` (rate limit), `500` (sync failure).

### `POST /api/user/session`

- **Request body:**

```json
{
  "body": {
    "sessionType": "mixed | focused | review",
    "systemsTargeted": ["Cardiology"]
  }
}
```

- **Success (`200`):**

```json
{
  "success": true,
  "session": {
    "id": "string",
    "sessionType": "mixed",
    "startedAt": "ISO timestamp"
  }
}
```

### `PATCH /api/user/session`

- **Request body:**

```json
{
  "body": {
    "sessionId": "string",
    "action": "end | update",
    "questionsAnswered": 0,
    "correctCount": 0,
    "thinkingTimeMs": 0
  }
}
```

- **Success:** `{ "success": true, "session": { ...updated fields... } }`

### `GET/POST /api/admin/enrich-condition`

- **GET success:** usage contract object including `enrichableFields`.
- **POST body:**

```json
{
  "body": {
    "conditionId": "string",
    "fieldsToEnrich": ["overview", "etiology"],
    "forceRegenerate": false
  }
}
```

- **POST success:** `{ conditionId, condition, fieldsUpdated, displayPriority, success }`

### `GET /api/admin/library-enrichment-logs`

- **Current validated request shape:** `{ "query": { "entityType"?, "status"?, "limit"?, "offset"? } }`
- **Success (`200`):**

```json
{
  "logs": [/* log records */],
  "total": 0
}
```

### `GET /api/admin/library-enrichment-priority`

- **Success (`200`):** priority JSON payload (default `{ "priorityList": [] }` if file unavailable).

## Operational Notes

- `POST /api/osce/analysis/grade` updates existing `OsceResult` when re-grading a session (`sessionId` uniqueness), and deduplicates `ConceptGap` by `(userId, system, sourceType, sourceId)`.
- `GET /api/content/library` uses FTS (`search_vector`) first and falls back to ILIKE matching if FTS errors or returns zero rows.
- `GET /api/admin/library-enrichment-logs` and `/api/admin/library-enrichment-priority` currently read local JSON files under `data/` (filesystem-backed behavior).
