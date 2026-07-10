# API Overview

This document tracks request/response contracts for recently changed Cloudflare Pages Functions under `functions/api/`. Public liveness remains at `GET /api/health` (minimal payload only). Operational diagnostics moved to admin-only `GET /api/admin/readiness`.

**Last updated:** 2026-07-10

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (DB, env presence, content counts). Replaces public health diagnostics. |
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject pending media assets (max 100). |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches (`?includeArchived=true\|false`). |
| POST | `/api/branches` | User | Create a content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch (default `main`). |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (`category`, `limit`, `shuffle`). |
| POST | `/api/drills/lab-cases` | User | Lab drill actions (`action: getDiagnoses`). |
| POST | `/api/feedback/submit` | User | Submit question feedback (creates `QuestionFlag`). |
| POST | `/api/graph/path` | User | Shortest path between two graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | User | Full-text search over graph nodes (`q`, `limit`, `nodeType`). |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval chunks (max 50). |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store Web Push subscription and enable push preferences. |
| DELETE | `/api/push/subscribe` | User | Remove a push subscription by `endpoint`. |
| POST | `/api/questions/custom-session` | User | Ephemeral custom-filter question session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build blueprint-weighted second-chance review set. |
| GET | `/api/srs/due` | User | Canonical FSRS due queue from Card / UserTopicProgress / UserProgress. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization (rate-limited). |
| GET | `/api/users/me/daily-plan` | User | Get or create daily study plan (`?date=` optional). |
| POST | `/api/users/me/daily-plan` | User | Apply study-plan action (`complete`, `skip`, `reschedule`). |

---

## Admin

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request:** None

**Success (`200 OK`)**

```json
{
  "status": "healthy",
  "diagnostics": {
    "timestamp": "2026-07-10T00:00:00.000Z",
    "runtime": "cloudflare-pages",
    "env": {
      "DATABASE_URL": true,
      "CLERK_SECRET_KEY": true,
      "GEMINI_API_KEY": true,
      "RATE_LIMIT_KV": true
    },
    "dbUrlType": "direct-postgres",
    "database": { "status": "pass" },
    "userCount": 0,
    "contentSystemsCount": 0,
    "contentConditionCount": 0
  }
}
```

**Error responses**

- `503` → `{ "status": "unhealthy", "diagnostics": { ... } }` when `DATABASE_URL` is missing or DB probe fails.

**Notes**

- Admin-only replacement for detailed diagnostics previously exposed on public `/api/health`.
- DB failure messages are intentionally detailed for admin troubleshooting.

---

### `POST /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaId": "string",
  "action": "approve | reject",
  "rejectionReason": "optional string (max 500, reject only)"
}
```

**Success (`200 OK`)**

```json
{
  "id": "string",
  "approvalStatus": "approved | rejected",
  "action": "approve | reject",
  "message": "Media approved successfully"
}
```

**Error responses**

- `400` → already approved, invalid state
- `404` → user or media not found
- `500` → `{ "error": "Approval failed. Please try again." }`

---

### `PUT /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaIds": ["string"],
  "action": "approve | reject",
  "reason": "optional string (max 500)"
}
```

**Success (`200 OK`)**

```json
{
  "action": "approve | reject",
  "count": 0,
  "message": "N media items approved successfully"
}
```

**Notes**

- Only updates rows with `approvalStatus: pending`.
- `mediaIds` array: 1–100 items.

---

## Analytics

### `GET /api/analytics/learner-analysis`

**Auth:** User

**Request:** None

**Success (`200 OK`)**

```json
{
  "cluster": {
    "archetype": "string",
    "confidence": 0,
    "distances": {}
  },
  "warnings": [
    {
      "type": "string",
      "message": "string",
      "severity": "string",
      "value": 0,
      "threshold": 0,
      "recommendation": "string"
    }
  ],
  "riskScore": 0,
  "features": {},
  "metadata": {
    "attemptsSampled": 0,
    "sessionsSampled": 0,
    "systemsCovered": 0,
    "totalSystems": 0
  }
}
```

**Error responses**

- `404` → user not synced
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** User

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Target exam date for forward projection |

**Success (`200 OK`)**

```json
{
  "overallReadiness": 0,
  "projectedAtExam": 0,
  "confidenceInterval": [0, 0],
  "estimatedScoreRange": [300, 800],
  "systems": [],
  "riskLevel": "low | moderate | high | critical",
  "criticalSystems": [],
  "daysUntilExam": null,
  "projectedAt": "ISO-8601",
  "earlyWarnings": [],
  "decliningSystems": [],
  "plateauingSystems": [],
  "acceleratingSystems": []
}
```

**Empty / not-synced responses**

- `404` with `meta.status: user_not_synced` when Clerk user has no internal `User` row.
- `200` with zeroed readiness when no `READINESS` progress exists.

**Notes**

- `Cache-Control: private, max-age=300`
- Reads `UserProgress` where `progressContext = READINESS`.

---

### `POST /api/analytics/soap-note`

**Auth:** User

**Request body**

```json
{
  "body": {
    "caseId": "string",
    "totalScore": 0,
    "breakdown": { "sectionKey": {} }
  }
}
```

**Success (`200 OK`)**

```json
{ "success": true }
```

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful no-op).
- `totalScore` must be finite, 0–100000.

---

## Content branching

### `GET /api/branches`

**Auth:** User

**Query:** `includeArchived=true|false` (optional)

**Success (`200 OK`)**

```json
{ "success": true, "branches": [] }
```

**Notes**

- Returns `{ "success": true, "branches": [] }` when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** User

**Request body**

```json
{
  "body": {
    "name": "string",
    "description": "optional string",
    "baseBranch": "optional string",
    "createdBy": "string"
  }
}
```

**Success (`200 OK`)**

```json
{ "success": true, "branchId": "string" }
```

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "string",
  "targetBranch": "optional string (default main)"
}
```

**Success (`200 OK`)**

```json
{
  "success": true,
  "mergedCount": 0
}
```

**Error responses**

- `400` → merge validation failure (returned in `data`)
- `503` → database not configured
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

## Drills

### `GET /api/drills/lab-cases`

**Auth:** User

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter: `hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, `random` |
| `limit` | `20` | 1–100 |
| `shuffle` | `true` | Set `shuffle=false` to preserve DB order |

**Success (`200 OK`)**

```json
{
  "success": true,
  "cases": [
    {
      "id": "string",
      "clinicalContext": "string",
      "patientAge": 0,
      "patientSex": "M | F",
      "panels": [{ "name": "string", "values": [] }],
      "correctDiagnosis": "string",
      "keyFindings": ["string"],
      "explanation": "string",
      "category": "string"
    }
  ],
  "total": 0
}
```

---

### `POST /api/drills/lab-cases`

**Auth:** User

**Request body**

```json
{ "action": "getDiagnoses" }
```

**Success (`200 OK`)**

```json
{
  "success": true,
  "diagnoses": ["string"]
}
```

---

## Feedback

### `POST /api/feedback/submit`

**Auth:** User

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "questionId": "string",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
    "questionText": "optional (max 5000)",
    "topic": "optional (max 200)",
    "system": "optional (max 100)"
  }
}
```

**Success (`201 Created`)**

```json
{ "success": true, "feedbackId": "flag-..." }
```

**Error responses**

- `404` → user not found
- `500` → `{ "error": "Feedback submission failed" }`

---

## Knowledge graph

### `POST /api/graph/path`

**Auth:** User

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs | dijkstra",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["optional"],
  "includeNodes": true,
  "includeEdges": true
}
```

**Success (`200 OK`)**

```json
{
  "path": ["nodeId"],
  "edges": ["edgeId"],
  "totalWeight": 0,
  "nodes": [],
  "edgesDetail": [],
  "algorithm": "bfs",
  "depth": 0,
  "visitedCount": 0
}
```

**Error responses**

- `404` → no path found
- `500` → `{ "error": "Path finding failed. Please try again." }`

---

### `GET /api/graph/search`

**Auth:** User

**Query params**

| Param | Required | Description |
|---|---|---|
| `q` | yes | Search string (1–200 chars) |
| `limit` | no | Default `20` |
| `nodeType` | no | Filter by node type |

**Success (`200 OK`)**

```json
{
  "nodes": [
    {
      "id": "string",
      "nodeType": "string",
      "label": "string",
      "description": "string",
      "sourceType": "string",
      "sourceId": "string",
      "taxonomyCode": "string",
      "systemCodes": [],
      "metadata": {}
    }
  ],
  "totalCount": 0,
  "query": "string"
}
```

---

## Library (admin ingestion)

### `POST /api/library/contextualize-batch`

**Auth:** Admin

**Request body**

```json
{
  "chunks": [
    {
      "id": "string",
      "text": "string (1–10000)",
      "metadata": {
        "source": "optional",
        "section": "optional",
        "conditionId": "optional",
        "system": "optional"
      }
    }
  ],
  "documentSummary": "optional (max 2000)",
  "splitParentChild": false,
  "concurrency": 5
}
```

**Success (`200 OK`)**

```json
{
  "contextualized": [
    {
      "id": "string",
      "originalText": "truncated preview",
      "contextualizedText": "string",
      "contextPrefix": "string"
    }
  ],
  "parentChildChunks": [],
  "stats": {
    "totalChunks": 0,
    "processed": 0,
    "avgContextLength": 0
  }
}
```

**Notes**

- Requires `GEMINI_API_KEY`. Max 50 chunks per request.
- Uses `gemini-2.0-flash` for context prefix generation.

---

## Medical APIs

### `POST /api/medical-apis/validate-drugs`

**Auth:** User (120 req/min)

**Request body**

```json
{ "drugs": ["string"] }
```

**Success (`200 OK`)**

```json
{
  "allValid": true,
  "results": [
    {
      "drug": "string",
      "isValid": true,
      "normalizedName": "string",
      "rxcui": "string",
      "suggestions": [],
      "termType": "string"
    }
  ],
  "interactions": {
    "hasInteractions": false,
    "drugCount": 0,
    "interactions": []
  }
}
```

**Notes**

- 1–20 drug names per request. Uses public NLM RxNorm API (no API key).

---

## Push notifications

### `POST /api/push/subscribe`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://...",
  "keys": {
    "p256dh": "string",
    "auth": "string"
  }
}
```

**Success (`200 OK`)**

```json
{ "message": "Subscription stored" }
```

**Notes**

- Upserts `PushSubscription` and sets `userPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** User

**Request body**

```json
{ "endpoint": "https://..." }
```

**Success (`200 OK`)**

```json
{ "message": "Subscription removed" }
```

---

## Questions & reviews

### `POST /api/questions/custom-session`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "body": {
    "config": {
      "systems": ["optional"],
      "subcategories": ["optional"],
      "conditions": ["optional"],
      "focusAreas": ["optional"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

**Success (`200 OK`)**

```json
{
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": ["string"],
      "correctAnswerIndex": 0,
      "rationale": "string",
      "topic": "string",
      "system": "string",
      "subcategory": "string",
      "conditionId": "string",
      "difficulty": 0
    }
  ],
  "totalAvailable": 0,
  "warning": "optional — pool too small"
}
```

**Notes**

- Does **not** write FSRS / progress. Filter arrays capped at 50 entries; `count` max 50.
- Skips questions with missing options or unresolvable `correctAnswer`.

---

### `POST /api/reviews/second-chance`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": {
    "system": "optional",
    "conditionId": "optional"
  }
}
```

**Success (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {},
      "isVariant": false,
      "isSecondChance": false,
      "recognitionRisk": 0,
      "selectionMethod": "canonical_fallback",
      "question": { "source": "pre_generated | main_question", "questionData": {} }
    }
  ],
  "meta": {
    "total": 0,
    "withVariants": 0,
    "withSecondChance": 0,
    "examType": "PANCE"
  }
}
```

**Empty due queue**

```json
{ "selections": [], "message": "No items due for second-chance review." }
```

---

## SRS (compatibility read model)

### `GET /api/srs/due`

**Auth:** User

**Query params**

| Param | Description |
|---|---|
| `limit` | 1–200 (default 100) |
| `progressContext` or `context` | `READINESS` or `TARGETED` (optional filter) |

**Success (`200 OK`)**

```json
{
  "items": [
    {
      "id": "string",
      "source": "card | user_topic_progress | user_progress",
      "questionId": "string | null",
      "conditionId": "string | null",
      "taskType": "string | null",
      "progressContext": "READINESS | TARGETED | null",
      "dueDate": "ISO-8601",
      "overdueDays": 0,
      "priority": 0
    }
  ],
  "totalDue": 0,
  "timestamp": "ISO-8601",
  "source": "canonical_fsrs_progress",
  "progressContext": "READINESS | null",
  "suppressedDuplicates": 0
}
```

**Notes**

- Reads canonical `Card`, `UserTopicProgress`, and `UserProgress` (not legacy `SRSItem`).
- Suppresses broader condition-level rows when a more specific card/topic row exists.
- Card rows require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- On unexpected errors, returns `200` with empty `items` and a generic `error` string (resilience over 500).

---

## User FSRS parameters

### `GET /api/user/fsrs-params`

**Auth:** User

**Success (`200 OK`)**

```json
{
  "params": {
    "w": [],
    "sampleSize": 0,
    "lastOptimizedAt": null,
    "improvementOverDefault": 0,
    "brierScore": null,
    "defaultBrierScore": null,
    "systemModifiers": {}
  },
  "isDefault": true,
  "canOptimize": false,
  "reviewsNeeded": 0,
  "message": "string"
}
```

**Notes**

- Off-scale legacy `w` arrays are treated as absent; canonical defaults returned.
- Eligibility counts only `review_type: real` with `sessionType` in `MAIN`, `DRILL`.

---

### `POST /api/user/fsrs-params`

**Auth:** User (30 req/min)

**Request body**

```json
{
  "body": {
    "forceReoptimize": false,
    "includeSystemModifiers": true
  }
}
```

**Success (`200 OK`)**

```json
{
  "success": true,
  "params": {},
  "summary": "string",
  "optimizationTimeMs": 0
}
```

**Skipped optimization (`200 OK`)**

```json
{
  "success": false,
  "skipped": true,
  "reason": "Recently optimized with insufficient new data"
}
```

**Error responses**

- `400` → insufficient review history
- `404` → user not found
- `500` → invalid optimized parameters or optimization failure

**Notes**

- Uses Python sidecar when `FSRS_OPTIMIZER_URL` is set; otherwise in-process TypeScript optimizer.
- Persists `version` tag (`6` or `7-alpha`) when `PersonalizedFSRSParams.version` column exists.

---

## Daily study plan

### `GET /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Query:** `date` — optional ISO date string (defaults to today)

**Success (`200 OK`)**

```json
{
  "id": "string",
  "planDate": "YYYY-MM-DD",
  "status": "string",
  "recommendedModes": [],
  "recommendedSessions": [],
  "tasks": [],
  "targetQuestionsCount": 0,
  "targetSystemFocus": [],
  "estimatedTimeMinutes": 0,
  "progress": {
    "questionsAnswered": 0,
    "questionsTarget": 0,
    "percentComplete": 0,
    "accuracy": null,
    "durationMinutes": null,
    "completedTasks": 0,
    "totalTasks": 0
  },
  "completedAt": null,
  "wasEffective": null,
  "feedbackReason": null,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

---

### `POST /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "optional",
    "planDate": "YYYY-MM-DD (optional)",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "optional",
    "rescheduleDate": "optional"
  }
}
```

**Success (`200 OK`)**

Same shape as `GET` (`formatPlanResponse`).

**Error responses**

- `400` → invalid action / task

**Notes**

- Route file is `functions/api/users/me/daily-plan.ts`; Cloudflare maps both GET and POST to `/api/users/me/daily-plan`.
- `accuracy` is a 0–1 decimal. `durationMinutes` clamped 0–1440.

---

## Error-handling convention (2026-07)

Changed endpoints log detailed errors server-side and return **generic** client messages (no stack traces or raw DB errors). Regression guard: `tests/no-response-error-leaks.test.ts`. Admin readiness diagnostics are the intentional exception (`leak-ok`).
