# API Overview

This document tracks the request/response contracts for the most recently changed API routes under `functions/api/`.

**Error handling (2026-04):** Mutation and read endpoints listed below return **generic** client messages on `500` responses. Detailed errors are logged server-side only. Admin-only `/api/admin/readiness` intentionally surfaces DB diagnostic messages to authenticated admins.

**Health split:** Public `GET /api/health` returns liveness only. Operational diagnostics (env flags, DB probe, content counts) live at `GET /api/admin/readiness` (admin auth required).

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (DB probe, env flags, content counts). |
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject pending media assets. |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist SOAP note grading analytics for OSCE sessions. |
| GET | `/api/branches` | User | List content branches (`?includeArchived=true\|false`). |
| POST | `/api/branches` | User | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (`category`, `limit`, `shuffle`). |
| POST | `/api/drills/lab-cases` | User | Lab drill utility actions (`action: "getDiagnoses"`). |
| POST | `/api/feedback/submit` | User | Submit question feedback / content flag. |
| POST | `/api/graph/path` | User | Shortest path between two knowledge-graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval preprocessing. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Ephemeral custom-filter study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Blueprint-weighted second-chance review session builder. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization. |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Apply a study-plan action (complete, skip, reschedule). |

---

## Endpoint Contracts

### `GET /api/health` (public liveness — unchanged surface)

**Auth:** None

**Success response (`200 OK`)**

```json
{
  "timestamp": "2026-01-01T00:00:00.000Z",
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

- Does **not** expose `DATABASE_URL`, Clerk, Gemini, KV, user counts, or DB error details.
- Use `GET /api/admin/readiness` for operational diagnostics.

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "status": "healthy",
  "diagnostics": {
    "timestamp": "2026-01-01T00:00:00.000Z",
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

- `503` → `{ "status": "unhealthy", "diagnostics": { ... } }` (missing `DATABASE_URL` or DB probe failure; DB error message included for admin diagnosis)

---

### `POST /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mediaId": "string",
  "action": "approve",
  "rejectionReason": "optional-string (max 500, required semantics for reject)"
}
```

`action` is `"approve"` or `"reject"`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "id": "string",
    "approvalStatus": "approved",
    "action": "approve",
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

**Auth:** Admin

**Request body**

```json
{
  "mediaIds": ["string"],
  "action": "approve",
  "reason": "optional-string (max 500)"
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

**Auth:** User

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

- `404` → structured `fail(NOT_FOUND)` when user not synced
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** User

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Target exam date for forward projection |

**Success response (`200 OK`)**

```json
{
  "data": {
    "overallReadiness": 0.0,
    "projectedAtExam": 0.0,
    "systems": [],
    "riskLevel": "critical"
  }
}
```

Empty study data returns `overallReadiness: 0` with a guidance `message`. Response includes `Cache-Control: private, max-age=300`.

**Error responses**

- `404` → user-not-synced payload with `meta.status: "user_not_synced"`
- `500` → `{ "error": "Readiness projection failed. Please try again." }`

---

### `POST /api/analytics/soap-note`

**Auth:** User

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 82,
    "breakdown": { "subjective": 20 }
  }
}
```

`totalScore` must be finite, `0–100000`.

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

**Auth:** User

**Query params:** `includeArchived` = `"true"` \| `"false"` (optional)

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branches": []
}
```

Returns `{ "success": true, "branches": [] }` when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** User

**Request body**

```json
{
  "body": {
    "name": "string",
    "description": "optional-string",
    "baseBranch": "optional-string",
    "createdBy": "string"
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

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "string",
  "targetBranch": "optional-string (default: main)"
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

Returns `400` with `data.success: false` when merge preconditions fail.

---

### `GET /api/drills/lab-cases`

**Auth:** User

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, `random`) |
| `limit` | `20` | `1–100` |
| `shuffle` | `true` | Pass `shuffle=false` to disable randomization |

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "cases": [
      {
        "id": "string",
        "clinicalContext": "string",
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

**Auth:** User

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

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string",
    "flagType": "incorrect_fact",
    "description": "string (1–2000)",
    "questionText": "optional-string (max 5000)",
    "topic": "optional-string (max 200)",
    "system": "optional-string (max 100)"
  }
}
```

`flagType`: `incorrect_fact` \| `unclear_question` \| `typo` \| `outdated` \| `other`

**Success response (`201 Created`)**

```json
{
  "data": {
    "success": true,
    "feedbackId": "flag-..."
  }
}
```

---

### `POST /api/graph/path`

**Auth:** User

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["optional-string"],
  "includeNodes": true,
  "includeEdges": true
}
```

`algorithm`: `bfs` \| `dijkstra`

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

---

### `GET /api/graph/search`

**Auth:** User

**Query params**

| Param | Required | Description |
|---|---|---|
| `q` | Yes | Search string (`1–200` chars) |
| `limit` | No | Default `20` |
| `nodeType` | No | Filter by node type |

**Success response (`200 OK`)**

```json
{
  "data": {
    "nodes": [
      {
        "id": "string",
        "nodeType": "string",
        "label": "string",
        "description": "optional-string",
        "sourceType": "string",
        "sourceId": "string",
        "systemCodes": []
      }
    ],
    "totalCount": 0,
    "query": "string"
  }
}
```

---

### `POST /api/library/contextualize-batch`

**Auth:** Admin (`adminAuthenticatedEndpoint`; requires `GEMINI_API_KEY`)

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
  "documentSummary": "optional-string (max 2000)",
  "splitParentChild": false,
  "concurrency": 5
}
```

`chunks`: 1–50 items.

**Success response (`200 OK`)**

```json
{
  "data": {
    "contextualized": [
      {
        "id": "string",
        "originalText": "string",
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

**Auth:** User (rate limit: 120/min)

**Request body**

```json
{
  "drugs": ["string"]
}
```

`drugs`: 1–20 items, each `1–200` chars.

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

---

### `POST /api/push/subscribe`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/...",
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

Upserts subscription and sets `UserPreferences.pushNotifications: true`.

---

### `DELETE /api/push/subscribe`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/..."
}
```

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

Disables push preferences when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** User

**Request body** (`.strict()` on `body` and `config`)

```json
{
  "body": {
    "config": {
      "systems": ["string"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same"
    },
    "count": 10
  }
}
```

- Filter arrays: max 50 entries, each max 100 chars.
- `count`: `1–50` (default `10`).
- `difficulty`: `same` \| `easier` \| `harder`.

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
        "system": "string"
      }
    ],
    "totalAvailable": 0,
    "warning": "optional-string"
  }
}
```

**Notes**

- Does **not** write FSRS / progress. Skips questions with missing or unresolvable `correctAnswer`.

---

### `POST /api/reviews/second-chance`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "optional-string",
    "conditionId": "optional-string"
  }
}
```

- `count`: `1–25` (default `10`).
- `examType`: `PANCE` \| `PANRE` \| `EOR`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "selections": [
      {
        "questionId": "string",
        "conditionId": "string",
        "isVariant": false,
        "isSecondChance": true,
        "question": { "source": "pre_generated", "questionData": {} }
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

Empty due queue: `{ "selections": [], "message": "No items due for second-chance review." }`

---

### `GET /api/user/fsrs-params`

**Auth:** User

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

- Off-scale stored parameters (legacy pre-2026-04 optimizer) are treated as absent; canonical defaults are returned.
- Eligibility counts only `review_type: 'real'` with `sessionType` in `MAIN` \| `DRILL`.

---

### `POST /api/user/fsrs-params`

**Auth:** User (rate limit: 30/min)

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

- `400` → insufficient review history
- `500` → `{ "error": "Optimization failed. Please try again." }` or invalid-parameter message

---

### `GET /api/users/me/daily-plan`

**Auth:** User

**Query params:** `date` — optional ISO date string (defaults to today)

**Success response (`200 OK`)**

```json
{
  "data": {
    "id": "string",
    "planDate": "2026-01-01",
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
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Creates the plan on first access via `getOrCreateDailyStudyPlan`.

---

### `POST /api/users/me/daily-plan`

**Auth:** User

**Request body**

```json
{
  "body": {
    "action": "complete",
    "taskId": "optional-string",
    "planDate": "2026-01-01",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "optional-string",
    "rescheduleDate": "optional-ISO-date"
  }
}
```

`action`: `complete` \| `skip` \| `reschedule` (optional). `accuracy` is `0–1`.

**Success response (`200 OK`)**

Returns the same `formatPlanResponse` shape as `GET` after applying the action.

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`

**Notes**

- Route file: `functions/api/users/me/daily-plan.ts` (both GET and POST share `/api/users/me/daily-plan`).
- Uses request-scoped Edge Prisma (not the module-level proxy).
