# API Overview

This document tracks request/response contracts for recently hardened or changed API routes under `functions/api/`.

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (DB, env flags, content counts). Replaces public health diagnostics. |
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject up to 100 pending media assets. |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches (optional `includeArchived=true`). |
| POST | `/api/branches` | User | Create a content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch (default `main`). |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (`category`, `limit`, `shuffle` query params). |
| POST | `/api/drills/lab-cases` | User | Drill helper actions (`action=getDiagnoses` for diagnosis autocomplete). |
| POST | `/api/feedback/submit` | User | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | User | Shortest path between two graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextual retrieval preprocessing for content chunks. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Fetch filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build a blueprint-weighted second-chance review session. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization from review history. |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Apply a study-plan action (`complete`, `skip`, `reschedule`) on a task or plan. |

---

## Endpoint Contracts

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "status": "healthy",
  "diagnostics": {
    "timestamp": "2026-07-11T00:00:00.000Z",
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

- `503` → `{ "status": "unhealthy", "diagnostics": { ... } }` when `DATABASE_URL` is missing or the DB probe fails.

**Notes**

- Public liveness remains at `GET /api/health` (sanitized). Operational diagnostics live here only.

---

### `POST /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mediaId": "string",
  "action": "approve",
  "rejectionReason": "optional string (max 500, required semantics for reject)"
}
```

`action` is `approve` or `reject`.

**Success response (`200 OK`)**

```json
{
  "id": "string",
  "approvalStatus": "approved",
  "action": "approve",
  "message": "Media approved successfully"
}
```

**Error responses**

- `400` → `{ "error": "Media is already approved" }`
- `404` → `{ "error": "User not found" }` or `{ "error": "Media not found" }`
- `500` → `{ "error": "Approval failed. Please try again." }`

---

### `PUT /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mediaIds": ["id1", "id2"],
  "action": "approve",
  "reason": "optional string (max 500)"
}
```

`mediaIds`: 1–100 items. Only `pending` assets are updated.

**Success response (`200 OK`)**

```json
{
  "action": "approve",
  "count": 2,
  "message": "2 media items approved successfully"
}
```

---

### `GET /api/analytics/learner-analysis`

**Auth:** Required

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "cluster": {
    "archetype": "string",
    "confidence": 0.0,
    "distances": {}
  },
  "warnings": [
    {
      "type": "string",
      "message": "string",
      "severity": "string",
      "value": 0.0,
      "threshold": 0.0,
      "recommendation": "string"
    }
  ],
  "riskScore": 0.0,
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

- `404` → structured `fail(NOT_FOUND)` when the Clerk user is not synced to `User`.
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** Required

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Target exam date for forward projection |

**Success response (`200 OK`)**

Returns the `computeExamReadiness` projection object (per-system readiness, overall score, risk level, confidence intervals). Cached with `Cache-Control: private, max-age=300`.

**Empty / unsynced responses**

- `404` when user not synced → `{ "message": "...", "overallReadiness": 0, "systems": [], "riskLevel": "critical", "meta": { "status": "user_not_synced" } }`
- `200` with zero study data → `{ "message": "No study data found...", "overallReadiness": 0, ... }`

**Error responses**

- `500` → `{ "error": "Readiness projection failed. Please try again." }`

---

### `POST /api/analytics/soap-note`

**Auth:** Required

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 85,
    "breakdown": { "section": "score detail" }
  }
}
```

`totalScore`: finite number, `0`–`100000`.

**Success response (`200 OK`)**

```json
{ "success": true }
```

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.

---

### `GET /api/branches`

**Auth:** Required

**Query params**

| Param | Values | Description |
|---|---|---|
| `includeArchived` | `true` \| `false` | Include archived branches (default false) |

**Success response (`200 OK`)**

```json
{ "success": true, "branches": [] }
```

When `DATABASE_URL` is missing, returns `{ "success": true, "branches": [] }` without error.

---

### `POST /api/branches`

**Auth:** Required

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

**Success response (`200 OK`)**

```json
{ "success": true, "branchId": "string" }
```

**Error responses**

- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to create branch. Please try again." }`

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mergedBy": "string (1–100 chars)",
  "targetBranch": "optional string (default main)"
}
```

**Success response (`200 OK` or `400`)**

```json
{
  "success": true,
  "mergedCount": 0
}
```

Shape matches `mergeBranch()` result from `content-branching` shared helper.

**Error responses**

- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

### `GET /api/drills/lab-cases`

**Auth:** Required

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter by inferred category (`hematology`, `metabolic`, `random`, etc.) |
| `limit` | int 1–100 | `20` | Max cases returned |
| `shuffle` | boolean | `true` | Randomize order (`shuffle=false` to disable) |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "cases": [
    {
      "id": "string",
      "clinicalContext": "string",
      "patientAge": 45,
      "patientSex": "F",
      "panels": [{ "name": "CBC", "values": [] }],
      "correctDiagnosis": "string",
      "keyFindings": ["string"],
      "explanation": "string",
      "category": "hematology"
    }
  ],
  "total": 1
}
```

**Error responses**

- `500` → `{ "success": false, "error": "Failed to fetch lab cases. Please try again." }`

---

### `POST /api/drills/lab-cases`

**Auth:** Required

**Request body**

```json
{ "action": "getDiagnoses" }
```

**Success response (`200 OK`)**

```json
{ "success": true, "diagnoses": ["Anemia", "..."] }
```

**Error responses**

- `400` → `{ "error": "Invalid action" }`

---

### `POST /api/feedback/submit`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string (1–200)",
    "flagType": "incorrect_fact",
    "description": "string (1–2000)",
    "questionText": "optional (max 5000)",
    "topic": "optional (max 200)",
    "system": "optional (max 100)"
  }
}
```

`flagType`: `incorrect_fact` \| `unclear_question` \| `typo` \| `outdated` \| `other`

**Success response (`201 Created`)**

```json
{ "success": true, "feedbackId": "flag-..." }
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

---

### `POST /api/graph/path`

**Auth:** Required

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["optional"],
  "includeNodes": true,
  "includeEdges": true
}
```

`algorithm`: `bfs` (default) or `dijkstra`. `maxDepth`: 1–20. `maxVisits`: 1–5000.

**Success response (`200 OK`)**

```json
{
  "path": ["nodeId1", "nodeId2"],
  "edges": ["edgeId1"],
  "totalWeight": 0,
  "algorithm": "bfs",
  "depth": 1,
  "visitedCount": 2,
  "nodes": [],
  "edgesDetail": []
}
```

`nodes` / `edgesDetail` omitted when `includeNodes` / `includeEdges` are false.

**Error responses**

- `404` → `{ "error": "No path found between the specified nodes" }`
- `500` → `{ "error": "Path finding failed. Please try again." }`

---

### `GET /api/graph/search`

**Auth:** Required

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string 1–200 | required | Search term |
| `limit` | int | `20` | Max nodes returned |
| `nodeType` | string | — | Filter by node type |

**Success response (`200 OK`)**

```json
{
  "nodes": [
    {
      "id": "string",
      "nodeType": "string",
      "label": "string",
      "description": "optional",
      "sourceType": "string",
      "sourceId": "string",
      "taxonomyCode": "optional",
      "systemCodes": [],
      "metadata": {}
    }
  ],
  "totalCount": 0,
  "query": "search term"
}
```

---

### `POST /api/library/contextualize-batch`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

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

`chunks`: 1–50 items. Requires `GEMINI_API_KEY`.

**Success response (`200 OK`)**

```json
{
  "contextualized": [
    {
      "id": "string",
      "originalText": "truncated preview...",
      "contextualizedText": "full text with context prefix",
      "contextPrefix": "LLM-generated context"
    }
  ],
  "parentChildChunks": null,
  "stats": {
    "totalChunks": 1,
    "processed": 1,
    "avgContextLength": 120
  }
}
```

---

### `POST /api/medical-apis/validate-drugs`

**Auth:** Required (120 req/min)

**Request body**

```json
{ "drugs": ["metformin", "lisinopril"] }
```

`drugs`: 1–20 strings, each 1–200 chars.

**Success response (`200 OK`)**

```json
{
  "allValid": true,
  "results": [
    {
      "drug": "metformin",
      "isValid": true,
      "normalizedName": "Metformin",
      "rxcui": "6809",
      "suggestions": [],
      "termType": "IN"
    }
  ],
  "interactions": {
    "hasInteractions": false,
    "drugCount": 2,
    "interactions": []
  }
}
```

`interactions` is `null` when fewer than two valid drugs are supplied.

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://...",
  "keys": {
    "p256dh": "string (max 512)",
    "auth": "string (max 512)"
  }
}
```

**Success response (`200 OK`)**

```json
{ "message": "Subscription stored" }
```

Upserts `PushSubscription` and sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

```json
{ "endpoint": "https://..." }
```

**Success response (`200 OK`)**

```json
{ "message": "Subscription removed" }
```

Disables `pushNotifications` preference when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required

**Request body** (`.strict()` on config and body)

```json
{
  "body": {
    "config": {
      "systems": ["CV"],
      "subcategories": ["optional, max 50 each"],
      "conditions": ["optional conditionIds"],
      "focusAreas": ["optional"],
      "difficulty": "same"
    },
    "count": 10
  }
}
```

Filter arrays: max 50 strings, each 1–100 chars. `count`: 1–50 (default 10). `difficulty`: `same` \| `easier` \| `harder`.

**Success response (`200 OK`)**

```json
{
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 0,
      "rationale": "string",
      "topic": "string",
      "system": "CV",
      "subcategory": "string",
      "conditionId": "string",
      "condition": "Unknown",
      "pearls": [],
      "focusArea": null,
      "difficulty": 50
    }
  ],
  "totalAvailable": 100,
  "warning": "optional when pool is smaller than requested count"
}
```

**Notes**

- Does not write FSRS / `UserProgress`. Questions with missing options or unresolvable `correctAnswer` are skipped.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "optional (max 100)",
    "conditionId": "optional (max 200)"
  }
}
```

`count`: 1–25 (default 10). `examType`: `PANCE` \| `PANRE` \| `EOR`.

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "conditionId": "string",
      "system": "string",
      "isVariant": false,
      "isSecondChance": true,
      "question": { "source": "main_question", "questionData": {} }
    }
  ],
  "meta": {
    "total": 1,
    "withVariants": 0,
    "withSecondChance": 1,
    "examType": "PANCE"
  }
}
```

**Empty session**

```json
{ "selections": [], "message": "No items due for second-chance review." }
```

---

### `GET /api/user/fsrs-params`

**Auth:** Required (300 req/min)

**Request body:** None

**Success response (`200 OK`)**

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
  "reviewsNeeded": 50,
  "message": "string"
}
```

Returns canonical defaults when no on-scale personalized params exist. Off-scale legacy params are treated as absent.

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to fetch FSRS parameters. Please try again." }`

---

### `POST /api/user/fsrs-params`

**Auth:** Required (30 req/min)

**Request body**

```json
{
  "body": {
    "forceReoptimize": false,
    "includeSystemModifiers": true
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "params": {},
  "summary": "string",
  "previousParams": { "w": [], "brierScore": null },
  "optimizationTimeMs": 1200
}
```

**Skipped optimization (`200 OK`)**

```json
{
  "success": false,
  "skipped": true,
  "reason": "Recently optimized with insufficient new data",
  "hoursSinceOptimization": 2,
  "reviewsSinceOptimization": 10
}
```

**Error responses**

- `400` → insufficient review history message from `canOptimize()`
- `404` → `{ "error": "User not found" }`
- `500` → invalid parameters or optimization failure

**Notes**

- Uses only `review_type: 'real'` with `sessionType` in `MAIN` \| `DRILL`.
- Persists `version` tag (`6` or `7-alpha`) when the `PersonalizedFSRSParams.version` column exists.

---

### `GET /api/users/me/daily-plan`

**Auth:** Required (30 req/min)

**Query params**

| Param | Type | Description |
|---|---|---|
| `date` | string (max 64) | Plan date (invalid values fall back to today) |

**Success response (`200 OK`)**

```json
{
  "id": "string",
  "planDate": "2026-07-11",
  "status": "active",
  "recommendedModes": ["main"],
  "recommendedSessions": [],
  "tasks": [],
  "targetQuestionsCount": 40,
  "targetSystemFocus": ["CV"],
  "estimatedTimeMinutes": 60,
  "progress": {
    "questionsAnswered": 0,
    "questionsTarget": 40,
    "percentComplete": 0,
    "accuracy": null,
    "durationMinutes": null,
    "estimatedDurationMinutes": 60,
    "completedTasks": 0,
    "totalTasks": 0
  },
  "completedAt": null,
  "wasEffective": null,
  "feedbackReason": null,
  "createdAt": "2026-07-11T00:00:00.000Z",
  "updatedAt": "2026-07-11T00:00:00.000Z"
}
```

Creates the plan on first access via `getOrCreateDailyStudyPlan`.

---

### `POST /api/users/me/daily-plan`

**Auth:** Required (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete",
    "taskId": "optional (max 128)",
    "planDate": "2026-07-11",
    "accuracy": 0.85,
    "durationMinutes": 45,
    "questionsAnswered": 30,
    "linkedSessionId": "optional (max 128)",
    "rescheduleDate": "optional ISO date string"
  }
}
```

`action`: `complete` \| `skip` \| `reschedule`. `accuracy`: 0–1 decimal. `durationMinutes`: 0–1440. `questionsAnswered`: 0–500.

**Success response (`200 OK`)**

Returns the same `formatPlanResponse` shape as GET after applying the action.

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`
