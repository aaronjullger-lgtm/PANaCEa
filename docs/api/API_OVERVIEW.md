# API Overview

This document tracks request/response contracts for recently changed Cloudflare Pages Function routes under `functions/api/`.

**Cross-cutting behavior (2026-07 security hardening):**

- Mutation endpoints use Zod validation with bounded string/array lengths and `.strict()` bodies where noted.
- `500` responses return generic client messages; internal errors are logged server-side via `secureLogger` (no raw stack traces or DB error text in responses).
- Auth uses `authenticatedEndpoint` or `adminEndpoint` middleware unless noted.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/media/approve` | Approve or reject a single pending media asset (admin). |
| PUT | `/api/admin/media/approve` | Batch approve or reject up to 100 pending media assets (admin). |
| GET | `/api/analytics/learner-analysis` | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | List content branches for version control. |
| POST | `/api/branches` | Create a new content branch. |
| POST | `/api/branches/[branchName]/merge` | Merge a content branch into a target branch (admin). |
| GET | `/api/drills/lab-cases` | Fetch lab cases for Mini Lab Drill (filtered, shuffled). |
| POST | `/api/drills/lab-cases` | Lab drill utility actions (e.g. diagnosis autocomplete list). |
| POST | `/api/feedback/submit` | Submit question quality feedback / flag. |
| POST | `/api/graph/path` | Find shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Batch LLM contextualization for library ingestion (admin). |
| POST | `/api/medical-apis/validate-drugs` | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | Fetch filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Build a blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Canonical FSRS due queue from Card / UserTopicProgress / UserProgress. |
| GET | `/api/user/fsrs-params` | Retrieve personalized FSRS parameters or defaults. |
| POST | `/api/user/fsrs-params` | Trigger L-BFGS FSRS parameter optimization from review history. |

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

**Notes:** Only updates rows with `approvalStatus: 'pending'`.

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Batch approval failed. Please try again." }`

---

### `GET /api/analytics/learner-analysis`

**Auth:** Required

**Query params:** None

**Success response (`200 OK`)**

```json
{
  "data": {
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
}
```

**Error responses**

- `404` → structured `fail(NOT_FOUND)` when user account is not synced
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

---

### `GET /api/analytics/readiness-projection`

**Auth:** Required

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Days until exam for forward projection |

**Success response (`200 OK`)**

```json
{
  "data": {
    "overallReadiness": 0,
    "projectedAtExam": 0,
    "confidenceInterval": [0, 0],
    "estimatedScoreRange": [0, 0],
    "systems": [],
    "riskLevel": "critical | low | moderate | high",
    "criticalSystems": [],
    "daysUntilExam": null,
    "projectedAt": "2026-07-10T00:00:00.000Z",
    "earlyWarnings": [],
    "decliningSystems": [],
    "plateauingSystems": [],
    "acceleratingSystems": []
  }
}
```

**Empty / unsynced states**

- No study data → `200` with zeroed projection and informational `message`
- User not synced → `404` with `{ "message": "...", "overallReadiness": 0, "meta": { "status": "user_not_synced" } }`

**Error responses**

- `500` → `{ "error": "Readiness projection failed. Please try again." }`

**Notes:** `Cache-Control: private, max-age=300`. Reads `UserProgress` with `progressContext: 'READINESS'`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": { "sectionKey": "any" }
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

**Notes:** Best-effort persistence to `SoapNoteGradingEvent`; continues if model/table is absent.

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

**Error responses**

- `500` → `{ "error": "Failed to list branches" }`

**Notes:** Returns `{ "success": true, "branches": [] }` when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** Required

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

### `POST /api/branches/[branchName]/merge`

**Auth:** Admin (`adminEndpoint`)

**Path param:** `branchName` — source branch to merge

**Request body**

```json
{
  "mergedBy": "string (1–100 chars, required)",
  "targetBranch": "optional string (default: main)"
}
```

**Success response (`200 OK` or `400`)**

```json
{
  "data": {
    "success": true,
    "mergedCount": 0,
    "conflicts": [],
    "message": "optional string"
  }
}
```

**Error responses**

- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

### `GET /api/drills/lab-cases`

**Auth:** Required

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter: `hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or `random` |
| `limit` | int | `20` | `1–100` |
| `shuffle` | boolean | `true` | Pass `shuffle=false` to disable |

**Success response (`200 OK`)**

```json
{
  "data": {
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
}
```

**Error responses**

- `500` → `{ "data": { "success": false, "error": "Failed to fetch lab cases. Please try again." } }`

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
    "diagnoses": ["string"]
  }
}
```

**Error responses**

- `400` → `{ "data": { "error": "Invalid action" } }`
- `500` → `{ "data": { "success": false, "error": "Request failed. Please try again." } }`

---

### `POST /api/feedback/submit`

**Auth:** Required

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

---

### `POST /api/graph/path`

**Auth:** Required

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

`maxDepth`: `1–20`. `maxVisits`: `1–5000`.

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

**Auth:** Required

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Search term (`1–200` chars) |
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

**Error responses**

- `500` → `{ "error": "Graph search failed. Please try again." }`

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

`chunks`: `1–50` items. `concurrency`: `1–10`.

**Success response (`200 OK`)**

```json
{
  "data": {
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
}
```

**Error responses**

- Missing `GEMINI_API_KEY` → env validation response
- `500` → `{ "error": "Batch contextualization failed. Please try again." }`

---

### `POST /api/medical-apis/validate-drugs`

**Auth:** Required (rate limit: 120 req/min)

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
      "interactions": [
        {
          "drug1": "string",
          "drug2": "string",
          "severity": "string",
          "description": "string",
          "source": "string"
        }
      ]
    }
  }
}
```

**Error responses**

- `500` → `{ "error": "Drug validation failed. Please try again." }`

**Notes:** Uses public NLM RxNorm API; no external API key required.

---

### `POST /api/push/subscribe`

**Auth:** Required

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
{
  "message": "Subscription stored"
}
```

**Notes:** Upserts `PushSubscription` and sets `UserPreferences.pushNotifications: true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

**Notes:** Disables `pushNotifications` preference when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required

**Request body** (`.strict()` on `config` and top-level)

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

`count`: `1–50` (default `10`).

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
        "difficulty": 0
      }
    ],
    "totalAvailable": 0,
    "warning": "optional string when pool is smaller than requested count"
  }
}
```

**Notes:** Does not write FSRS state. Uses production question safety filters.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

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

`count`: `1–25` (default `10`).

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
        "recognitionRisk": 0,
        "selectionMethod": "string",
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

**Empty due queue**

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `404` → `{ "data": { "error": "User not found" } }`
- `500` → `{ "data": { "error": "Failed to build second-chance session", "message": "Please try again." } }`

---

### `GET /api/srs/due`

**Auth:** Required

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `100` | `1–200` |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS partition |
| `context` | alias for `progressContext` | — | Legacy alias |

**Success response (`200 OK`)**

```json
{
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card | user_topic_progress | user_progress",
        "questionId": "string | null",
        "questionIdentityId": "string | null",
        "conditionId": "string | null",
        "taskType": "string | null",
        "progressContext": "READINESS | TARGETED | null",
        "dueDate": "2026-07-10T00:00:00.000Z",
        "overdueDays": 0,
        "priority": 0
      }
    ],
    "totalDue": 0,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "READINESS | null",
    "suppressedDuplicates": 0
  }
}
```

**Resilient error fallback (`200 OK`, not `500`)**

```json
{
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes:** Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress`. Suppresses duplicate condition-level rows when a more specific card/topic row exists. Card items require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.

---

### `GET /api/user/fsrs-params`

**Auth:** Required (rate limit: 300 req/min)

**Success response (`200 OK`)**

```json
{
  "data": {
    "params": {
      "w": [0],
      "sampleSize": 0,
      "lastOptimizedAt": "2026-07-10T00:00:00.000Z | null",
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

**Notes:** Off-scale legacy `w` arrays are treated as absent; returns canonical defaults. Eligibility counts only `review_type: 'real'` with `sessionType` in `MAIN` \| `DRILL`.

---

### `POST /api/user/fsrs-params`

**Auth:** Required (rate limit: 30 req/min)

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

**Skipped (recent optimization)**

```json
{
  "data": {
    "success": false,
    "skipped": true,
    "reason": "Recently optimized with insufficient new data",
    "hoursSinceOptimization": 0,
    "reviewsSinceOptimization": 0
  }
}
```

**Error responses**

- `400` → insufficient review history message
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Optimization failed. Please try again." }` or invalid-parameter message

**Notes:** Uses in-process TypeScript optimizer or optional `FSRS_OPTIMIZER_URL` sidecar. Persists to `PersonalizedFSRSParams` with algorithm version tag (`6` or `7-alpha`).
