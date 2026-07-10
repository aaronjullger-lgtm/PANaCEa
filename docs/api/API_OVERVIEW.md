# API Overview

This document tracks request/response contracts for recently changed or hardened API routes under `functions/api/`. All mutation endpoints use Zod validation (`.strict()` where noted) and return generic client error messages; operational detail is logged server-side only.

**Health split:** Public liveness is `GET /api/health` (no diagnostics). Operational readiness diagnostics are admin-only at `GET /api/admin/readiness`.

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (DB, env flags, content counts). |
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject up to 100 pending media assets. |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches (optional `includeArchived=true`). |
| POST | `/api/branches` | User | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch (default `main`). |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (filter, limit, shuffle). |
| POST | `/api/drills/lab-cases` | User | Lab-case actions (e.g. `getDiagnoses` autocomplete list). |
| POST | `/api/feedback/submit` | User | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | User | Shortest path between two knowledge-graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval chunks (ingestion). |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription by endpoint URL. |
| POST | `/api/questions/custom-session` | User | Ephemeral custom-filter question session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build blueprint-weighted second-chance review session. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization from review history. |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Complete, skip, or reschedule a daily-plan task. |

---

## Endpoint Contracts

### `GET /api/health` (public liveness)

**Auth:** None

**Success response (`200 OK`)**

```json
{
  "timestamp": "2026-07-10T00:00:00.000Z",
  "endpoint": "/api/health",
  "status": "ok",
  "checks": {
    "functionDeployed": {
      "status": "pass",
      "message": "Cloudflare Pages Functions"
    }
  }
}
```

**Notes**

- Does **not** expose `DATABASE_URL`, auth, content, or user-count diagnostics.
- Use `GET /api/admin/readiness` for operational diagnostics (admin auth required).

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

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

- `503` → `{ "status": "unhealthy", "diagnostics": { ... } }` (missing `DATABASE_URL` or DB query failure)

**Notes**

- Replaces the previous public `/api/health` diagnostic payload.
- DB failure responses intentionally include error detail for admin troubleshooting.

---

### `POST /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body** (`.strict()`)

```json
{
  "mediaId": "string",
  "action": "approve | reject",
  "rejectionReason": "optional string (max 500, reject only)"
}
```

**Success response (`200 OK`)**

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

**Error responses**

- `400` → `{ "error": "Media is already approved" }`
- `404` → `{ "error": "User not found" }` or `{ "error": "Media not found" }`
- `500` → `{ "error": "Approval failed. Please try again." }`

---

### `PUT /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body** (`.strict()`)

```json
{
  "mediaIds": ["string"],
  "action": "approve | reject",
  "reason": "optional string (max 500, reject only)"
}
```

`mediaIds`: 1–100 items. Only `pending` assets are updated.

**Success response (`200 OK`)**

```json
{
  "data": {
    "action": "approve",
    "count": 3,
    "message": "3 media items approved successfully"
  }
}
```

---

### `GET /api/analytics/learner-analysis`

**Auth:** User (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
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
}
```

**Error responses**

- `404` → structured `fail(NOT_FOUND)` when user record is not synced
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Days until exam for forward projection |

**Success response (`200 OK`)**

```json
{
  "data": {
    "overallReadiness": 0.0,
    "projectedAtExam": 0.0,
    "confidenceInterval": [0.0, 0.0],
    "estimatedScoreRange": [0, 0],
    "systems": [],
    "riskLevel": "critical | low | moderate | high",
    "criticalSystems": [],
    "daysUntilExam": 0,
    "projectedAt": "2026-07-10T00:00:00.000Z",
    "earlyWarnings": [],
    "decliningSystems": [],
    "plateauingSystems": [],
    "acceleratingSystems": []
  }
}
```

**Empty / unsynced responses**

- No study data → `200` with zeroed projection and message
- User not synced → `404` with `{ "meta": { "status": "user_not_synced" } }`

**Headers:** `Cache-Control: private, max-age=300`

---

### `POST /api/analytics/soap-note`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": {}
  }
}
```

`totalScore`: finite number, `0`–`100000`.

**Success response (`200 OK`)**

```json
{
  "data": { "success": true }
}
```

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).

---

### `GET /api/branches`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Values | Description |
|---|---|---|
| `includeArchived` | `true` \| `false` | Include archived branches |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branches": []
}
```

When `DATABASE_URL` is missing, returns `{ "success": true, "branches": [] }`.

---

### `POST /api/branches`

**Auth:** User (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "name": "string (required)",
    "description": "optional string",
    "baseBranch": "optional string",
    "createdBy": "string (required)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branchId": "string"
}
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
  "mergedBy": "string (required, max 100)",
  "targetBranch": "optional string (default main)"
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "mergedCount": 0
  }
}
```

**Error responses**

- `400` → merge validation failure (`result.success === false`)
- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

### `GET /api/drills/lab-cases`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter by category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, `random`) |
| `limit` | `20` | Max cases (1–100) |
| `shuffle` | `true` | Randomize order (`shuffle=false` to disable) |

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "cases": [
      {
        "id": "string",
        "clinicalContext": "string",
        "patientAge": 45,
        "patientSex": "F",
        "panels": [{ "name": "string", "values": [] }],
        "correctDiagnosis": "string",
        "keyFindings": ["string"],
        "explanation": "string",
        "category": "string"
      }
    ],
    "total": 0
  }
}
```

---

### `POST /api/drills/lab-cases`

**Auth:** User (`authenticatedEndpoint`)

**Request body**

```json
{
  "action": "getDiagnoses"
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "diagnoses": ["string"]
  }
}
```

---

### `POST /api/feedback/submit`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string (1–200)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000)",
    "questionText": "optional string (max 5000)",
    "topic": "optional string (max 200)",
    "system": "optional string (max 100)"
  }
}
```

**Success response (`201 Created`)**

```json
{
  "data": {
    "success": true,
    "feedbackId": "flag-..."
  }
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

---

### `POST /api/graph/path`

**Auth:** User (`authenticatedEndpoint`)

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs | dijkstra",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["optional string"],
  "includeNodes": true,
  "includeEdges": true
}
```

**Success response (`200 OK`)**

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

**Error responses**

- `404` → `{ "error": "No path found between the specified nodes" }`
- `500` → `{ "error": "Path finding failed. Please try again." }`

**Headers:** `Cache-Control: private, max-age=60`

---

### `GET /api/graph/search`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Description |
|---|---|
| `q` | Search string (1–200 chars, required) |
| `limit` | Max results (default `20`) |
| `nodeType` | Optional node-type filter |

**Success response (`200 OK`)**

```json
{
  "data": {
    "nodes": [
      {
        "id": "string",
        "nodeType": "string",
        "label": "string",
        "description": "optional string",
        "sourceType": "string",
        "sourceId": "string",
        "taxonomyCode": "optional string",
        "systemCodes": [],
        "metadata": {}
      }
    ],
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
  "documentSummary": "optional string (max 2000)",
  "splitParentChild": false,
  "concurrency": 5
}
```

`chunks`: 1–50 items. Requires `GEMINI_API_KEY`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "contextualized": [
      {
        "id": "string",
        "originalText": "truncated preview...",
        "contextualizedText": "string",
        "contextPrefix": "string"
      }
    ],
    "parentChildChunks": null,
    "stats": {
      "totalChunks": 0,
      "processed": 0,
      "avgContextLength": 0
    }
  }
}
```

---

### `POST /api/medical-apis/validate-drugs`

**Auth:** User (`authenticatedEndpoint`, 120 req/min)

**Request body**

```json
{
  "drugs": ["string"]
}
```

`drugs`: 1–20 items, each 1–200 chars. Uses free public RxNorm API (no API key).

**Success response (`200 OK`)**

```json
{
  "data": {
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
}
```

`interactions` is `null` when interaction check is unavailable.

---

### `POST /api/push/subscribe`

**Auth:** User (`authenticatedEndpoint`)

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
{
  "message": "Subscription stored"
}
```

Upserts by `(userId, endpoint)` and enables `pushNotifications` in user preferences.

---

### `DELETE /api/push/subscribe`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://..."
}
```

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

Disables `pushNotifications` when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "body": {
    "config": {
      "systems": ["optional, max 50"],
      "subcategories": ["optional, max 50"],
      "conditions": ["optional, max 50"],
      "focusAreas": ["optional, max 50"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

`count`: 1–50 (default 10). Does **not** write FSRS / user progress.

**Success response (`200 OK`)**

```json
{
  "data": {
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
        "difficulty": 50
      }
    ],
    "totalAvailable": 0,
    "warning": "optional string when pool is smaller than requested count"
  }
}
```

---

### `POST /api/reviews/second-chance`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": {
    "system": "optional string",
    "conditionId": "optional string"
  }
}
```

`count`: 1–25 (default 10).

**Success response (`200 OK`)**

```json
{
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {},
        "isVariant": false,
        "isSecondChance": false,
        "recognitionRisk": 0.0,
        "selectionMethod": "unused_variant",
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
}
```

Empty due queue → `200` with `{ "selections": [], "message": "No items due for second-chance review." }`

---

### `GET /api/user/fsrs-params`

**Auth:** User (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
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
}
```

**Notes**

- Off-scale legacy `w` arrays are treated as absent; canonical defaults are returned.
- Optimization eligibility counts only `review_type: 'real'` with `sessionType` in `MAIN` \| `DRILL`.

---

### `POST /api/user/fsrs-params`

**Auth:** User (`authenticatedEndpoint`, 30 req/min)

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
  "data": {
    "success": true,
    "params": {},
    "summary": "string",
    "previousParams": { "w": [], "brierScore": null },
    "optimizationTimeMs": 0
  }
}
```

**Skipped optimization (`200 OK`)**

```json
{
  "data": {
    "success": false,
    "skipped": true,
    "reason": "Recently optimized with insufficient new data"
  }
}
```

**Error responses**

- `400` → insufficient review history for optimization
- `404` → `{ "error": "User not found" }`
- `500` → invalid parameters or optimization failure

---

### `GET /api/users/me/daily-plan`

**Auth:** User (`authenticatedEndpoint`, 30 req/min)

**Query params**

| Param | Description |
|---|---|
| `date` | Optional date string (defaults to today) |

**Success response (`200 OK`)**

```json
{
  "data": {
    "id": "string",
    "planDate": "2026-07-10",
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
      "estimatedDurationMinutes": 0,
      "completedTasks": 0,
      "totalTasks": 0
    },
    "completedAt": null,
    "wasEffective": null,
    "feedbackReason": null,
    "createdAt": "2026-07-10T00:00:00.000Z",
    "updatedAt": "2026-07-10T00:00:00.000Z"
  }
}
```

Creates the plan on first access when missing.

---

### `POST /api/users/me/daily-plan`

**Auth:** User (`authenticatedEndpoint`, 30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "optional string",
    "planDate": "optional YYYY-MM-DD",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "optional string",
    "rescheduleDate": "optional date string"
  }
}
```

`accuracy`: 0–1 decimal. `durationMinutes`: 0–1440.

**Success response (`200 OK`)**

Returns the same `formatPlanResponse` shape as `GET` (updated plan).

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`
