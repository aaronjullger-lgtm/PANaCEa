# API Overview

This document tracks request/response contracts for recently changed Cloudflare Pages Functions under `functions/api/`. All routes use structured JSON errors (`{ error: string }`) unless noted.

**Auth tiers:** `authenticated` (Clerk JWT), `admin` (admin role + rate limit), `adminAuthenticated` (admin without body validation wrapper).

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/media/approve` | admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | admin | Batch approve or reject up to 100 pending media assets. |
| GET | `/api/admin/readiness` | admin | Admin-only operational readiness diagnostics (replaces public health internals). |
| GET | `/api/analytics/learner-analysis` | authenticated | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | authenticated | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | authenticated | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | authenticated | List content branches (optional `includeArchived=true`). |
| POST | `/api/branches` | authenticated | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | authenticated | Fetch lab cases for Mini Lab Drill (category/limit/shuffle filters). |
| POST | `/api/drills/lab-cases` | authenticated | Lab-case actions (currently `getDiagnoses` for autocomplete). |
| POST | `/api/feedback/submit` | authenticated | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | authenticated | Find shortest path between two knowledge-graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | authenticated | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | adminAuthenticated | Batch LLM contextualization for content chunks (ingestion pipeline). |
| POST | `/api/medical-apis/validate-drugs` | authenticated | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | authenticated | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | authenticated | Remove a Web Push subscription by endpoint URL. |
| POST | `/api/questions/custom-session` | authenticated | Fetch filtered questions for ephemeral custom study sessions (no FSRS). |
| POST | `/api/reviews/second-chance` | authenticated | Build blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | authenticated | Canonical FSRS due queue from Card / UserProgress stores. |
| GET | `/api/user/fsrs-params` | authenticated | Retrieve personalized FSRS parameters or defaults. |
| POST | `/api/user/fsrs-params` | authenticated | Trigger L-BFGS FSRS parameter optimization (30 req/min). |
| GET | `/api/users/me/daily-plan` | authenticated | Get or create today's personalized study plan. |
| POST | `/api/users/me/daily-plan` | authenticated | Apply plan action: complete, skip, or reschedule a task. |

---

## Endpoint Contracts

### `POST /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mediaId": "string (1–100 chars)",
  "action": "approve | reject",
  "rejectionReason": "string (optional, max 500)"
}
```

**Success (`200`)**

```json
{
  "data": {
    "id": "string",
    "approvalStatus": "approved | rejected",
    "action": "approve | reject",
    "message": "Media approved successfully"
  }
}
```

**Errors:** `400` (already approved), `404` (user/media not found), `500`

---

### `PUT /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaIds": ["string (1–100 items)"],
  "action": "approve | reject",
  "reason": "string (optional, max 500)"
}
```

**Success (`200`)**

```json
{
  "data": {
    "action": "approve | reject",
    "count": 0,
    "message": "N media items approved successfully"
  }
}
```

**Notes:** Only updates assets with `approvalStatus: pending`.

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success (`200`)**

```json
{
  "data": {
    "status": "healthy",
    "diagnostics": {
      "timestamp": "ISO-8601",
      "runtime": "cloudflare-pages",
      "env": { "DATABASE_URL": true, "CLERK_SECRET_KEY": true, "GEMINI_API_KEY": true, "RATE_LIMIT_KV": true },
      "dbUrlType": "accelerate | direct-postgres | unknown | missing",
      "database": { "status": "pass" },
      "userCount": 0,
      "contentSystemsCount": 0,
      "contentConditionCount": 0
    }
  }
}
```

**Unhealthy (`503`)**

```json
{
  "data": {
    "status": "unhealthy",
    "diagnostics": { "database": { "status": "fail", "message": "..." } }
  }
}
```

**Notes:** Replaces the previous public `/api/health` diagnostic payload. Public `/api/health` is liveness-only.

---

### `GET /api/analytics/learner-analysis`

**Auth:** Authenticated

**Request body:** None

**Success (`200`)**

```json
{
  "data": {
    "cluster": { "archetype": "string", "confidence": 0, "distances": {} },
    "warnings": [{ "type": "string", "message": "string", "severity": "string", "recommendation": "string" }],
    "riskScore": 0,
    "features": {},
    "metadata": { "attemptsSampled": 0, "sessionsSampled": 0, "systemsCovered": 0, "totalSystems": 0 }
  }
}
```

**Errors:** `404` (user not synced), `500`

---

### `GET /api/analytics/readiness-projection`

**Auth:** Authenticated

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Target exam date for forward projection |

**Success (`200`)**

```json
{
  "data": {
    "overallReadiness": 0,
    "projectedAtExam": 0,
    "systems": [],
    "riskLevel": "critical | moderate | low"
  }
}
```

**Empty state (`200`)**

```json
{
  "data": {
    "message": "No study data found. Start studying to see readiness projections.",
    "overallReadiness": 0,
    "projectedAtExam": 0,
    "systems": [],
    "riskLevel": "critical"
  }
}
```

**Notes:** `Cache-Control: private, max-age=300`. Uses `UserProgress` with `progressContext: READINESS`.

---

### `POST /api/analytics/soap-note`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "body": {
    "caseId": "string (1–200)",
    "totalScore": 0,
    "breakdown": { "section": "value" }
  }
}
```

**Success (`200`)**

```json
{ "data": { "success": true } }
```

**Notes:** Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success.

---

### `GET /api/branches`

**Auth:** Authenticated

**Query params:** `includeArchived` = `true` | `false` (optional)

**Success (`200`)**

```json
{ "success": true, "branches": [] }
```

---

### `POST /api/branches`

**Auth:** Authenticated

**Request body**

```json
{
  "body": {
    "name": "string (required)",
    "description": "string (optional)",
    "baseBranch": "string (optional)",
    "createdBy": "string (required)"
  }
}
```

**Success (`200`)**

```json
{ "success": true, "branchId": "string" }
```

**Errors:** `503` (no database), `500`

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "string (required, max 100)",
  "targetBranch": "string (optional, default main)"
}
```

**Success (`200`)**

```json
{ "data": { "success": true, "mergedCount": 0 } }
```

**Errors:** `400` (merge failed), `503` (no database), `500`

---

### `GET /api/drills/lab-cases`

**Auth:** Authenticated

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter by category (`hematology`, `metabolic`, etc.) |
| `limit` | int 1–100 | 20 | Max cases returned |
| `shuffle` | boolean | true | Randomize order (`shuffle=false` to disable) |

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "cases": [{
      "id": "string",
      "clinicalContext": "string",
      "panels": [{ "name": "string", "values": [] }],
      "correctDiagnosis": "string",
      "keyFindings": [],
      "explanation": "string",
      "category": "string"
    }],
    "total": 0
  }
}
```

---

### `POST /api/drills/lab-cases`

**Auth:** Authenticated

**Request body**

```json
{ "action": "getDiagnoses" }
```

**Success (`200`)**

```json
{ "data": { "success": true, "diagnoses": ["string"] } }
```

---

### `POST /api/feedback/submit`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string (1–200)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000)",
    "questionText": "string (optional, max 5000)",
    "topic": "string (optional, max 200)",
    "system": "string (optional, max 100)"
  }
}
```

**Success (`201`)**

```json
{ "data": { "success": true, "feedbackId": "string" } }
```

**Errors:** `404` (user not found), `500`

---

### `POST /api/graph/path`

**Auth:** Authenticated

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs | dijkstra",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["string"],
  "includeNodes": true,
  "includeEdges": true
}
```

**Success (`200`)**

```json
{
  "data": {
    "path": ["nodeId"],
    "edges": ["edgeId"],
    "totalWeight": 0,
    "algorithm": "bfs",
    "depth": 0,
    "visitedCount": 0,
    "nodes": [],
    "edgesDetail": []
  }
}
```

**Errors:** `404` (no path), `500`

---

### `GET /api/graph/search`

**Auth:** Authenticated

**Query params:** `q` (required, 1–200), `limit` (int, default 20), `nodeType` (optional)

**Success (`200`)**

```json
{
  "data": {
    "nodes": [{ "id": "string", "nodeType": "string", "label": "string" }],
    "totalCount": 0,
    "query": "string"
  }
}
```

---

### `POST /api/library/contextualize-batch`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body**

```json
{
  "chunks": [{ "id": "string", "text": "string (1–10000)", "metadata": {} }],
  "documentSummary": "string (optional, max 2000)",
  "splitParentChild": false,
  "concurrency": 5
}
```

**Success (`200`)**

```json
{
  "data": {
    "contextualized": [{ "id": "string", "contextualizedText": "string", "contextPrefix": "string" }],
    "parentChildChunks": [],
    "stats": { "totalChunks": 0, "processed": 0, "avgContextLength": 0 }
  }
}
```

**Notes:** Requires `GEMINI_API_KEY`. Max 50 chunks per request.

---

### `POST /api/medical-apis/validate-drugs`

**Auth:** Authenticated (120 req/min)

**Request body**

```json
{ "drugs": ["string (1–20 items, max 200 chars each)"] }
```

**Success (`200`)**

```json
{
  "data": {
    "allValid": true,
    "results": [{ "drug": "string", "isValid": true, "normalizedName": "string", "rxcui": "string" }],
    "interactions": { "hasInteractions": false, "drugCount": 0, "interactions": [] }
  }
}
```

---

### `POST /api/push/subscribe`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://...",
  "keys": { "p256dh": "string", "auth": "string" }
}
```

**Success (`200`)**

```json
{ "data": { "message": "Subscription stored" } }
```

---

### `DELETE /api/push/subscribe`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{ "endpoint": "https://..." }
```

**Success (`200`)**

```json
{ "data": { "message": "Subscription removed" } }
```

---

### `POST /api/questions/custom-session`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "body": {
    "config": {
      "systems": ["string (max 50)"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

**Success (`200`)**

```json
{
  "data": {
    "questions": [{
      "id": "string",
      "question": "string",
      "options": ["string"],
      "correctAnswerIndex": 0,
      "rationale": "string",
      "system": "string"
    }],
    "totalAvailable": 0,
    "warning": "string (optional)"
  }
}
```

**Notes:** No FSRS tracking — ephemeral practice only. Filter arrays capped at 50 entries; `count` max 50.

---

### `POST /api/reviews/second-chance`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": { "system": "string", "conditionId": "string" }
}
```

**Success (`200`)**

```json
{
  "data": {
    "selections": [{ "questionId": "string", "question": {}, "isVariant": false, "isSecondChance": false }],
    "meta": { "total": 0, "withVariants": 0, "withSecondChance": 0, "examType": "PANCE" }
  }
}
```

**Empty (`200`)**

```json
{ "data": { "selections": [], "message": "No items due for second-chance review." } }
```

---

### `GET /api/srs/due`

**Auth:** Authenticated

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int 1–200 | 100 | Max due items returned |
| `progressContext` | `READINESS` \| `TARGETED` | all | Filter by progress context |
| `context` | alias for `progressContext` | — | Legacy alias |

**Success (`200`)**

```json
{
  "data": {
    "items": [{
      "id": "string",
      "source": "card | user_topic_progress | user_progress",
      "questionId": "string | null",
      "conditionId": "string | null",
      "dueDate": "ISO-8601",
      "overdueDays": 0,
      "priority": 0
    }],
    "totalDue": 0,
    "timestamp": "ISO-8601",
    "source": "canonical_fsrs_progress",
    "progressContext": "READINESS | null",
    "suppressedDuplicates": 0
  }
}
```

**Notes:** Compatibility endpoint reading canonical Card / UserTopicProgress / UserProgress stores. Returns empty items on error instead of 500.

---

### `GET /api/user/fsrs-params`

**Auth:** Authenticated (300 req/min)

**Request body:** None

**Success (`200`)**

```json
{
  "data": {
    "params": {
      "w": [],
      "sampleSize": 0,
      "lastOptimizedAt": "ISO-8601 | null",
      "improvementOverDefault": 0,
      "brierScore": null,
      "systemModifiers": {}
    },
    "isDefault": true,
    "canOptimize": false,
    "reviewsNeeded": 0,
    "message": "string"
  }
}
```

**Errors:** `404` (user not found), `500`

**Notes:** Off-scale legacy params are treated as absent; client receives canonical defaults.

---

### `POST /api/user/fsrs-params`

**Auth:** Authenticated (30 req/min)

**Request body**

```json
{
  "body": {
    "forceReoptimize": false,
    "includeSystemModifiers": true
  }
}
```

**Success (`200`)**

```json
{
  "data": {
    "success": true,
    "params": {},
    "summary": "string",
    "optimizationTimeMs": 0
  }
}
```

**Skipped (`200`)**

```json
{
  "data": {
    "success": false,
    "skipped": true,
    "reason": "Recently optimized with insufficient new data"
  }
}
```

**Errors:** `400` (insufficient reviews), `404`, `500`

**Notes:** Uses real `MAIN` + `DRILL` ReviewLog rows only. May route to Python sidecar when `FSRS_OPTIMIZER_URL` is set.

---

### `GET /api/users/me/daily-plan`

**Auth:** Authenticated (30 req/min)

**Query params:** `date` (optional ISO date string; defaults to today)

**Success (`200`)**

```json
{
  "data": {
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
    "wasEffective": null
  }
}
```

---

### `POST /api/users/me/daily-plan`

**Auth:** Authenticated (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "string (optional)",
    "planDate": "YYYY-MM-DD (optional)",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "string (optional)",
    "rescheduleDate": "string (optional)"
  }
}
```

**Success (`200`)** — same shape as GET response (`formatPlanResponse`)

**Errors:** `400` (invalid action), `500`

**Notes:** Creates the plan if missing. `accuracy` is a 0–1 decimal. `durationMinutes` clamped 0–1440.
