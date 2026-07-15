# API Overview

This document tracks request/response contracts for recently changed Cloudflare Pages Functions under `functions/api/`.

All routes below run on the Edge runtime, require Clerk authentication unless noted, validate inputs with Zod via shared middleware (`authenticatedEndpoint`, `adminEndpoint`, or `adminAuthenticatedEndpoint`), and return structured JSON errors (never raw stack traces).

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject up to 100 pending media assets. |
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (replaces public `/api/health` internals). |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with confidence intervals. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches for version control. |
| POST | `/api/branches` | User | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch transformed lab cases for Mini Lab Drill. |
| POST | `/api/drills/lab-cases` | User | Lab drill helper actions (e.g. diagnosis autocomplete list). |
| POST | `/api/feedback/submit` | User | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | User | Find shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval preprocessing. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Fetch filtered questions for ephemeral custom study (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build a subdomain-level second-chance review session. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization from review history. |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Complete, skip, or reschedule a daily-plan task. |

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

**Success response (`200 OK`)**

```json
{
  "id": "string",
  "approvalStatus": "approved | rejected",
  "action": "approve | reject",
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
  "mediaIds": ["string (1–100 items, each 1–100 chars)"],
  "action": "approve | reject",
  "reason": "string (optional, max 500)"
}
```

**Success response (`200 OK`)**

```json
{
  "action": "approve | reject",
  "count": 0,
  "message": "3 media items approved successfully"
}
```

**Notes**

- Only updates assets with `approvalStatus: "pending"`.

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "status": "healthy",
  "diagnostics": {
    "timestamp": "2026-07-15T00:00:00.000Z",
    "runtime": "cloudflare-pages",
    "env": {
      "DATABASE_URL": true,
      "CLERK_SECRET_KEY": true,
      "GEMINI_API_KEY": true,
      "RATE_LIMIT_KV": true
    },
    "dbUrlType": "direct-postgres | accelerate | missing | unknown",
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

- Replaces the previous public `/api/health` diagnostic payload. Public liveness remains at `/api/health` (sanitized).

---

### `GET /api/analytics/learner-analysis`

**Auth:** User (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

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

- `404` → structured `fail(ErrorCode.NOT_FOUND)` when the Clerk user is not synced to `User`.
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
  "overallReadiness": 0,
  "projectedAtExam": 0,
  "confidenceInterval": [0, 0],
  "estimatedScoreRange": [0, 0],
  "systems": [],
  "riskLevel": "low | moderate | high | critical",
  "criticalSystems": [],
  "daysUntilExam": null,
  "projectedAt": "2026-07-15T00:00:00.000Z",
  "earlyWarnings": [],
  "decliningSystems": [],
  "plateauingSystems": [],
  "acceleratingSystems": []
}
```

**Empty / unsynced responses**

- `404` with zeroed readiness when the user record is not synced.
- `200` with zeroed readiness and a message when no `READINESS` progress rows exist.

**Notes**

- `Cache-Control: private, max-age=300`

---

### `POST /api/analytics/soap-note`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()` — unknown keys rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": {},
    "timestamp": "string (optional)",
    "userId": "string (optional, ignored — resolved from auth)"
  }
}
```

**Success response (`200 OK`)**

```json
{ "success": true }
```

**Notes**

- `totalScore` must be finite, `0–100000`.
- DB persistence is best-effort if `SoapNoteGradingEvent` is not yet migrated.

---

### `GET /api/branches`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Type | Description |
|---|---|---|
| `includeArchived` | `true` \| `false` (optional) | Include archived branches |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branches": []
}
```

**Notes**

- Returns `{ "success": true, "branches": [] }` when `DATABASE_URL` is not configured.

---

### `POST /api/branches`

**Auth:** User (`authenticatedEndpoint`)

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
  "targetBranch": "string (optional, default main)"
}
```

**Success response (`200 OK` or `400`)**

```json
{
  "success": true,
  "mergedCount": 0
}
```

**Error responses**

- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

### `GET /api/drills/lab-cases`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by inferred category (`hematology`, `metabolic`, etc.) |
| `limit` | int `1–100` | `20` | Max cases returned |
| `shuffle` | boolean | `true` | Randomize order (`shuffle=false` to disable) |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "cases": [
    {
      "id": "string",
      "clinicalContext": "string",
      "patientAge": 0,
      "patientSex": "F | M",
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
  "success": true,
  "diagnoses": ["string"]
}
```

---

### `POST /api/feedback/submit`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string (1–200 chars)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
    "questionText": "string (optional, max 5000)",
    "topic": "string (optional, max 200)",
    "system": "string (optional, max 100)"
  }
}
```

**Success response (`201 Created`)**

```json
{
  "success": true,
  "feedbackId": "flag-..."
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
  "edgeTypes": ["string"],
  "includeNodes": true,
  "includeEdges": true
}
```

**Success response (`200 OK`)**

```json
{
  "path": ["nodeId"],
  "edges": ["edgeId"],
  "totalWeight": 0,
  "algorithm": "bfs",
  "depth": 0,
  "visitedCount": 0,
  "nodes": [],
  "edgesDetail": []
}
```

**Error responses**

- `404` → `{ "error": "No path found between the specified nodes" }`
- `500` → `{ "error": "Path finding failed. Please try again." }`

---

### `GET /api/graph/search`

**Auth:** User (`authenticatedEndpoint`)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string `1–200` | required | Search term |
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

### `POST /api/library/contextualize-batch`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body**

```json
{
  "chunks": [
    {
      "id": "string",
      "text": "string (1–10000 chars)",
      "metadata": {
        "source": "string",
        "section": "string",
        "conditionId": "string",
        "system": "string"
      }
    }
  ],
  "documentSummary": "string (optional, max 2000)",
  "splitParentChild": false,
  "concurrency": 5
}
```

**Success response (`200 OK`)**

```json
{
  "contextualized": [
    {
      "id": "string",
      "originalText": "string (truncated preview)",
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

---

### `POST /api/medical-apis/validate-drugs`

**Auth:** User (`authenticatedEndpoint`, 120 req/min)

**Request body**

```json
{
  "drugs": ["string (1–20 items, each 1–200 chars)"]
}
```

**Success response (`200 OK`)**

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

---

### `POST /api/push/subscribe`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (max 2048 chars)",
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

**Notes**

- Upserts by `(userId, endpoint)` and enables `pushNotifications` in `UserPreferences`.

---

### `DELETE /api/push/subscribe`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{ "message": "Subscription removed" }
```

---

### `POST /api/questions/custom-session`

**Auth:** User (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "config": {
      "systems": ["string (max 50 items)"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

**Success response (`200 OK`)**

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
  "warning": "string (optional)"
}
```

**Notes**

- No FSRS or progress writes — ephemeral study only.
- `count` defaults to 10, max 50. Filter arrays max 50 entries each.

---

### `POST /api/reviews/second-chance`

**Auth:** User (`authenticatedEndpoint`)

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": {
    "system": "string (optional, max 100)",
    "conditionId": "string (optional, max 200)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {},
      "isVariant": false,
      "isSecondChance": false,
      "recognitionRisk": 0,
      "selectionMethod": "unused_variant",
      "question": {}
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

**Empty response**

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

---

### `GET /api/user/fsrs-params`

**Auth:** User (`authenticatedEndpoint`)

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
  "reviewsNeeded": 0,
  "message": "string"
}
```

**Notes**

- Off-scale legacy parameters are treated as absent; canonical defaults are returned.
- Eligibility counts only `review_type: "real"` with `sessionType` in `MAIN` or `DRILL`.

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
  "success": true,
  "params": {},
  "summary": "string",
  "previousParams": { "w": [], "brierScore": null },
  "optimizationTimeMs": 0
}
```

**Skipped optimization (`200 OK`)**

```json
{
  "success": false,
  "skipped": true,
  "reason": "Recently optimized with insufficient new data",
  "hoursSinceOptimization": 0,
  "reviewsSinceOptimization": 0
}
```

**Error responses**

- `400` → insufficient review history for optimization
- `404` → `{ "error": "User not found" }`
- `500` → invalid optimized parameters or optimization failure

---

### `GET /api/users/me/daily-plan`

**Auth:** User (`authenticatedEndpoint`, 30 req/min)

**Query params**

| Param | Type | Description |
|---|---|---|
| `date` | string (optional) | Plan date; invalid values fall back to today |

**Success response (`200 OK`)**

```json
{
  "id": "string",
  "planDate": "2026-07-15",
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
  "createdAt": "2026-07-15T00:00:00.000Z",
  "updatedAt": "2026-07-15T00:00:00.000Z"
}
```

---

### `POST /api/users/me/daily-plan`

**Auth:** User (`authenticatedEndpoint`, 30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "string (optional, max 128)",
    "planDate": "YYYY-MM-DD (optional)",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "string (optional)",
    "rescheduleDate": "string (optional)"
  }
}
```

**Success response (`200 OK`)**

Same shape as `GET /api/users/me/daily-plan` (updated plan).

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`

**Notes**

- `accuracy` is a `0–1` decimal. `durationMinutes` is clamped to `0–1440`.
