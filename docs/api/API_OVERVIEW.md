# API Overview

This document tracks the request/response contracts for the most recently changed API routes under `functions/api/`.

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject pending media assets (max 100 IDs). |
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (replaces public `/api/health` internals). |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist SOAP note grading analytics for OSCE sessions. |
| GET | `/api/branches` | User | List content branches for version control. |
| POST | `/api/branches` | User | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch transformed lab cases for Mini Lab Drill. |
| POST | `/api/drills/lab-cases` | User | Lab-case utility actions (e.g. diagnosis autocomplete list). |
| POST | `/api/feedback/submit` | User | Submit question feedback / content flags. |
| POST | `/api/graph/path` | User | Find shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval preprocessing. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Fetch filtered questions for ephemeral custom study sessions (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build a blueprint-weighted second-chance review session. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters or defaults. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization (rate-limited). |
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
  "rejectionReason": "optional string (max 500)"
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

**Request body**

```json
{
  "mediaIds": ["string (1–100 items, each 1–100 chars)"],
  "action": "approve | reject",
  "reason": "optional string (max 500)"
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "action": "approve | reject",
    "count": 0,
    "message": "3 media items approved successfully"
  }
}
```

**Notes**

- Only updates assets with `approvalStatus: pending`.

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
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
      "dbUrlType": "direct-postgres | accelerate | missing | unknown",
      "database": { "status": "pass" },
      "userCount": 0,
      "contentSystemsCount": 0,
      "contentConditionCount": 0
    }
  }
}
```

**Unhealthy response (`503 Service Unavailable`)**

```json
{
  "data": {
    "status": "unhealthy",
    "diagnostics": {
      "database": { "status": "fail", "message": "...", "name": "Error" }
    }
  }
}
```

**Notes**

- Replaces the previous public `/api/health` diagnostic payload. Public `/api/health` is liveness-only.

---

### `GET /api/analytics/learner-analysis`

**Auth:** Required (authenticated endpoint)

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

- `404` → structured `fail(NOT_FOUND)` when user is not synced
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** Required (authenticated endpoint)

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
    "riskLevel": "critical | moderate | low"
  }
}
```

**Empty / unsynced responses**

- `404` with `meta.status: "user_not_synced"` when Clerk user has no DB row
- `200` with zeroed readiness when no `READINESS` progress records exist

**Notes**

- Response includes `Cache-Control: private, max-age=300`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": { "section": "value" }
  }
}
```

`totalScore` must be finite, `0 ≤ totalScore ≤ 100000`.

**Success response (`200 OK`)**

```json
{
  "data": { "success": true }
}
```

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success.

---

### `GET /api/branches`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Values | Description |
|---|---|---|
| `includeArchived` | `true` \| `false` | Include archived branches (default: false) |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branches": []
}
```

**Notes**

- Returns `{ success: true, branches: [] }` when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** Required (authenticated endpoint)

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

**Path params:** `branchName` — branch to merge

**Request body**

```json
{
  "mergedBy": "string (1–100 chars, required)",
  "targetBranch": "optional string (default: main)"
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

- `400` → merge validation failure in `data`
- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

### `GET /api/drills/lab-cases`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by category (`hematology`, `metabolic`, etc.) |
| `limit` | int 1–100 | `20` | Max cases returned |
| `shuffle` | boolean | `true` | Randomize order (`shuffle=false` to disable) |

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

**Auth:** Required (authenticated endpoint)

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

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string (1–200 chars)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
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

**Notes**

- `incorrect_fact` flags are stored with `priority: high`; others use `medium`.

---

### `POST /api/graph/path`

**Auth:** Required (authenticated endpoint)

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

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string 1–200 | required | Search term |
| `limit` | int | `20` | Max results |
| `nodeType` | string | — | Filter by node type |

**Success response (`200 OK`)**

```json
{
  "data": {
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

`chunks` array: 1–50 items. Requires `GEMINI_API_KEY`.

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
    "parentChildChunks": [],
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

**Auth:** Required (authenticated endpoint, 120 req/min)

**Request body**

```json
{
  "drugs": ["string (1–20 items, each 1–200 chars)"]
}
```

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

**Notes**

- Uses the public NLM RxNorm API; no external API key required.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "data": { "message": "Subscription stored" }
}
```

**Notes**

- Upserts by `userId` + `endpoint`; enables `pushNotifications` in user preferences.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "data": { "message": "Subscription removed" }
}
```

**Notes**

- Disables `pushNotifications` when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` on config and body)

```json
{
  "body": {
    "config": {
      "systems": ["string (max 50 items, each 1–100 chars)"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

`count` is optional, int 1–50 (default 10).

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

**Notes**

- Ephemeral session: does **not** write FSRS / user progress.
- Questions with missing options or unresolvable `correctAnswer` are skipped.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": {
    "system": "optional string (max 100)",
    "conditionId": "optional string (max 200)"
  }
}
```

`count`: 1–25 (default 10). `examType` defaults to `PANCE`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "selections": [
      {
        "questionId": "string",
        "conditionId": "string",
        "system": "string",
        "isVariant": false,
        "isSecondChance": true,
        "question": { "source": "pre_generated | main_question" }
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

**Empty response (`200 OK`)**

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

---

### `GET /api/user/fsrs-params`

**Auth:** Required (authenticated endpoint)

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

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to fetch FSRS parameters. Please try again." }`

**Notes**

- Off-scale legacy parameters are treated as absent; canonical defaults are returned.
- Eligibility counts only `review_type: real` with `sessionType` in `MAIN` or `DRILL`.

---

### `POST /api/user/fsrs-params`

**Auth:** Required (authenticated endpoint, 30 req/min)

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
    "optimizationTimeMs": 0,
    "previousParams": { "w": [], "brierScore": null }
  }
}
```

**Skipped optimization (`200 OK`)**

```json
{
  "data": {
    "success": false,
    "skipped": true,
    "reason": "Recently optimized with insufficient new data",
    "hoursSinceOptimization": 2,
    "reviewsSinceOptimization": 10
  }
}
```

**Error responses**

- `400` → insufficient review history or throttle message
- `404` → `{ "error": "User not found" }`
- `500` → invalid parameters or optimization failure

---

### `GET /api/users/me/daily-plan`

**Auth:** Required (authenticated endpoint, 30 req/min)

**Query params**

| Param | Type | Description |
|---|---|---|
| `date` | string (max 64) | Plan date (invalid values fall back to today) |

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
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

**Notes**

- Creates the plan on first access via `getOrCreateDailyStudyPlan`.

---

### `POST /api/users/me/daily-plan`

**Auth:** Required (authenticated endpoint, 30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "optional string (max 128)",
    "planDate": "optional YYYY-MM-DD",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "optional string (max 128)",
    "rescheduleDate": "optional string"
  }
}
```

`accuracy` is a 0–1 decimal. `durationMinutes` is 0–1440.

**Success response (`200 OK`)**

Returns the same `formatPlanResponse` shape as `GET` (see above).

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`

**Notes**

- Compatibility route for daily-plan task completion; authoritative session attribution may also flow through `/api/study-plan/progress`.
