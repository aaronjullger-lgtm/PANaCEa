# API Overview

This document tracks the request/response contracts for the most recently changed API routes under `functions/api/`.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/readiness` | Admin-only operational readiness diagnostics (replaces public `/api/health` internals). |
| POST | `/api/admin/media/approve` | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Batch approve or reject up to 100 pending media assets. |
| GET | `/api/analytics/learner-analysis` | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | FSRS-based exam readiness projection with optional `examDate`. |
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | List content branches (optional `includeArchived=true`). |
| POST | `/api/branches` | Create a content branch. |
| POST | `/api/branches/:branchName/merge` | Merge a content branch into a target branch (admin). |
| GET | `/api/drills/lab-cases` | Fetch lab cases for Mini Lab Drill (`category`, `limit`, `shuffle`). |
| POST | `/api/drills/lab-cases` | Lab drill helper actions (`action=getDiagnoses`). |
| POST | `/api/feedback/submit` | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | Shortest path between two knowledge-graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin batch contextual retrieval preprocessing for ingestion. |
| POST | `/api/medical-apis/validate-drugs` | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | Ephemeral custom-filter study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Build blueprint-weighted second-chance review set. |
| GET | `/api/srs/due` | Canonical FSRS due queue from Card / UserProgress stores. |
| GET | `/api/user/fsrs-params` | Retrieve personalized FSRS parameters or defaults. |
| POST | `/api/user/fsrs-params` | Trigger L-BFGS FSRS parameter optimization. |
| GET | `/api/users/me/daily-plan` | Get or create today's personalized study plan. |
| POST | `/api/users/me/daily-plan` | Apply study-plan task action (`complete`, `skip`, `reschedule`). |

## Endpoint Contracts

### `GET /api/admin/readiness`

**Auth:** Admin required (`adminAuthenticatedEndpoint`)

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

- `503` → `{ "status": "unhealthy", "diagnostics": { ... } }` when `DATABASE_URL` is missing or the DB probe fails.

**Notes**

- Replaces the previous public `/api/health` diagnostic payload. Public `/api/health` remains liveness-only.

---

### `POST /api/admin/media/approve`

**Auth:** Admin required

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

**Auth:** Admin required

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
  "data": {
    "action": "approve",
    "count": 2,
    "message": "2 media items approved successfully"
  }
}
```

---

### `GET /api/analytics/learner-analysis`

**Auth:** Required

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
        "value": 0,
        "threshold": 0,
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

- `404` → structured `fail(NOT_FOUND)` when the Clerk user is not synced to `User`.
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** Required

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Days-until-exam for forward projection |

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

Empty-study and not-synced users receive zeroed payloads with explanatory `message` / `meta.status`.

**Headers:** `Cache-Control: private, max-age=300`

**Error responses**

- `404` → user not synced (`meta.status: "user_not_synced"`)
- `500` → `{ "error": "Readiness projection failed. Please try again." }`

---

### `POST /api/analytics/soap-note`

**Auth:** Required

**Request body** (strict — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 85,
    "breakdown": { "section": "value" }
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

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.

---

### `GET /api/branches`

**Auth:** Required

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

When `DATABASE_URL` is unset, returns `{ "success": true, "branches": [] }`.

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

**Auth:** Admin required

**Request body**

```json
{
  "mergedBy": "string (1–100 chars)",
  "targetBranch": "optional string (default: main)"
}
```

**Success response (`200 OK` or `400`)**

```json
{
  "data": {
    "success": true,
    "mergedCount": 0
  }
}
```

Status is `400` when `result.success` is false.

---

### `GET /api/drills/lab-cases`

**Auth:** Required

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter by category (`hematology`, `metabolic`, etc.; omit for all) |
| `limit` | `20` | `1`–`100` |
| `shuffle` | `true` | Pass `shuffle=false` to preserve DB order |

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "cases": [
      {
        "id": "string",
        "clinicalContext": "string",
        "panels": [],
        "correctDiagnosis": "string",
        "keyFindings": [],
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

**Auth:** Required

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
    "diagnoses": ["Diagnosis A", "Diagnosis B"]
  }
}
```

---

### `POST /api/feedback/submit`

**Auth:** Required

**Request body** (strict)

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

`algorithm`: `bfs` (default) \| `dijkstra`. `maxDepth`: `1`–`20`. `maxVisits`: `1`–`5000`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "path": ["nodeId1", "nodeId2"],
    "edges": [],
    "totalWeight": 0,
    "algorithm": "bfs",
    "depth": 1,
    "visitedCount": 2,
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

**Auth:** Required

**Query params**

| Param | Default | Description |
|---|---|---|
| `q` | required | Search string (`1`–`200` chars) |
| `limit` | `20` | Max results |
| `nodeType` | — | Optional node-type filter |

**Success response (`200 OK`)**

```json
{
  "data": {
    "nodes": [
      {
        "id": "string",
        "nodeType": "string",
        "label": "string",
        "sourceType": "string",
        "sourceId": "string",
        "systemCodes": []
      }
    ],
    "totalCount": 0,
    "query": "search term"
  }
}
```

---

### `POST /api/library/contextualize-batch`

**Auth:** Admin required

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
      "totalChunks": 1,
      "processed": 1,
      "avgContextLength": 120
    }
  }
}
```

---

### `POST /api/medical-apis/validate-drugs`

**Auth:** Required (120 req/min)

**Request body**

```json
{
  "drugs": ["metformin", "lisinopril"]
}
```

`drugs`: 1–20 strings, each `1`–`200` chars. Uses public NLM RxNorm API.

**Success response (`200 OK`)**

```json
{
  "data": {
    "allValid": true,
    "results": [
      {
        "drug": "metformin",
        "isValid": true,
        "normalizedName": "string",
        "rxcui": "string",
        "suggestions": [],
        "termType": "string"
      }
    ],
    "interactions": {
      "hasInteractions": false,
      "drugCount": 2,
      "interactions": []
    }
  }
}
```

`interactions` is `null` when fewer than two valid drugs are supplied.

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body** (strict)

```json
{
  "endpoint": "https://...",
  "keys": {
    "p256dh": "string (1–512)",
    "auth": "string (1–512)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "message": "Subscription stored"
}
```

Upserts by `(userId, endpoint)` and enables `pushNotifications` in `UserPreferences`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body**

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

**Auth:** Required

**Request body** (strict)

```json
{
  "body": {
    "config": {
      "systems": ["CV"],
      "subcategories": ["optional"],
      "conditions": ["optional conditionId"],
      "focusAreas": ["optional"],
      "difficulty": "same"
    },
    "count": 10
  }
}
```

Filter arrays: max 50 entries, each `1`–`100` chars. `count`: `1`–`50` (default `10`). `difficulty`: `same` \| `easier` \| `harder`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "questions": [
      {
        "id": "string",
        "question": "string",
        "options": [],
        "correctAnswerIndex": 0,
        "rationale": "string",
        "system": "string"
      }
    ],
    "totalAvailable": 0,
    "warning": "optional when pool is smaller than requested count"
  }
}
```

**Notes**

- Does not write FSRS / progress. Questions with missing options or unresolvable `correctAnswer` are skipped server-side.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

**Request body** (strict)

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

`count`: `1`–`25` (default `10`). `examType`: `PANCE` \| `PANRE` \| `EOR`.

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
}
```

Empty due queue: `{ "selections": [], "message": "No items due for second-chance review." }`

---

### `GET /api/srs/due`

**Auth:** Required

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `100` | `1`–`200` |
| `progressContext` | — | `READINESS` \| `TARGETED` |
| `context` | — | Alias for `progressContext` |

**Success response (`200 OK`)**

```json
{
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card",
        "questionId": "string",
        "conditionId": "string",
        "dueDate": "2026-07-10T00:00:00.000Z",
        "overdueDays": 0,
        "priority": 0.0
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": null,
    "suppressedDuplicates": 0
  }
}
```

**Notes**

- Reads from `Card`, `UserTopicProgress`, and `UserProgress` with duplicate suppression.
- On unexpected errors, returns `200` with an empty `items` array and a generic `error` message (resilience over hard 500).

---

### `GET /api/user/fsrs-params`

**Auth:** Required (300 req/min)

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

Off-scale legacy parameters are treated as absent; canonical defaults are returned instead.

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to fetch FSRS parameters. Please try again." }`

---

### `POST /api/user/fsrs-params`

**Auth:** Required (30 req/min — heavy optimization)

**Request body** (optional)

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

- `400` → insufficient review history or throttle message from `canOptimize`
- `404` → `{ "error": "User not found" }`
- `500` → invalid optimized parameters or optimizer failure

**Notes**

- Uses real `MAIN` + `DRILL` `ReviewLog` rows only. May delegate to `FSRS_OPTIMIZER_URL` sidecar when configured.

---

### `GET /api/users/me/daily-plan`

**Auth:** Required (30 req/min)

**Query params**

| Param | Description |
|---|---|
| `date` | Optional date string (invalid values fall back to today) |

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

---

### `POST /api/users/me/daily-plan`

**Auth:** Required (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete",
    "taskId": "optional (max 128)",
    "planDate": "2026-07-10",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "optional (max 128)",
    "rescheduleDate": "optional date string"
  }
}
```

`action`: `complete` \| `skip` \| `reschedule` (optional). `accuracy`: `0`–`1`. `durationMinutes`: `0`–`1440`. `questionsAnswered`: `0`–`500`.

**Success response (`200 OK`)**

Same shape as `GET` (`formatPlanResponse`).

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`

**Notes**

- Compatibility route for StudyPlanTask V2; authoritative progress may also flow through `/api/study-plan/*`.
