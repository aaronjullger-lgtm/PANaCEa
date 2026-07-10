# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** audit-stabilization batch (validation hardening, error-leak elimination, FSRS param safety).

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/media/approve` | Approve or reject a single pending media asset (admin). |
| PUT | `/api/admin/media/approve` | Batch approve or reject pending media assets (admin). |
| GET | `/api/admin/readiness` | Admin-only operational readiness diagnostics (replaces public health internals). |
| GET | `/api/analytics/learner-analysis` | Returns learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | Returns FSRS-based exam readiness projection with confidence intervals. |
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for the authenticated user. |
| GET | `/api/branches` | Lists content branches for version control. |
| POST | `/api/branches` | Creates a new content branch. |
| POST | `/api/branches/:branchName/merge` | Merges a content branch into a target branch (admin). |
| GET | `/api/drills/lab-cases` | Returns lab cases for the Mini Lab Drill mode. |
| POST | `/api/drills/lab-cases` | Lab-case utility actions (currently `getDiagnoses`). |
| POST | `/api/feedback/submit` | Submits authenticated question feedback / flag for admin review. |
| POST | `/api/graph/path` | Finds the shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Batch LLM contextualization for content-ingestion chunks (admin). |
| POST | `/api/medical-apis/validate-drugs` | Validates drug names via RxNorm and checks interactions. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription. |
| POST | `/api/questions/custom-session` | Fetches filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session from due concepts. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |
| GET | `/api/user/fsrs-params` | Returns personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | Triggers L-BFGS FSRS parameter optimization from review history. |
| GET | `/api/users/me/daily-plan` | Returns (or creates) the authenticated user's daily study plan. |
| POST | `/api/users/me/daily-plan` | Applies a study-plan action (complete, skip, reschedule) to a daily plan task. |

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

- Only updates rows with `approvalStatus: pending`.

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

**Error responses**

- `503` → `{ "data": { "status": "unhealthy", "diagnostics": { ... } } }`

**Notes**

- Replaces the previous public `/api/health` diagnostic payload. Public liveness remains at `/api/health`; operational internals are admin-only here.
- Database error details are intentionally included for admin diagnosis (`leak-ok`).

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

- `404` → structured `NOT_FOUND` via `fail()` when the user record is not synced
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

**Empty / not-synced responses**

- No study data → `200` with zeroed readiness fields and a message
- User not synced → `404` with `{ "message": "...", "overallReadiness": 0, "meta": { "status": "user_not_synced" } }`

**Error responses**

- `500` → `{ "error": "Readiness projection failed. Please try again." }`

**Notes**

- Reads `UserProgress` rows with `progressContext: READINESS`.
- Response cached with `Cache-Control: private, max-age=300`.

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

**Auth:** Required (authenticated endpoint)

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

**Notes**

- Returns `{ "success": true, "branches": [] }` when `DATABASE_URL` is missing.

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

**Request body**

```json
{
  "mergedBy": "string (required, max 100)",
  "targetBranch": "optional string (max 100, default main)"
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

**Error responses**

- `503` → `{ "error": "Database not configured" }`
- `500` → `{ "error": "Failed to merge branch. Please try again." }`

---

### `GET /api/drills/lab-cases`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter by category (`hematology`, `metabolic`, etc.; omit for all) |
| `limit` | int | `20` | Max cases (`1–100`) |
| `shuffle` | bool string | `true` | Set to `false` to preserve order |

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

**Error responses**

- `500` → `{ "data": { "success": false, "error": "Failed to fetch lab cases. Please try again." } }`

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

**Error responses**

- `400` → `{ "data": { "error": "Invalid action" } }`
- `500` → `{ "data": { "success": false, "error": "Request failed. Please try again." } }`

---

### `POST /api/feedback/submit`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

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

- Creates a `QuestionFlag` row with `status: pending`. `incorrect_fact` flags get `priority: high`.

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
  "edgeTypes": ["optional string"],
  "includeNodes": true,
  "includeEdges": true
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "path": ["node-id"],
    "edges": ["edge-id"],
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
| `q` | string | required | Search term (`1–200` chars) |
| `limit` | int string | `20` | Max results |
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

`chunks`: `1–50` items. Requires `GEMINI_API_KEY`.

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

- `500` → `{ "error": "Batch contextualization failed. Please try again." }`

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

- Uses the free public NLM RxNorm API; no external API key required.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

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
  "data": { "message": "Subscription stored" }
}
```

**Notes**

- Upserts `PushSubscription` and sets `UserPreferences.pushNotifications: true`.

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

- Disables `pushNotifications` in preferences when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` on body and config)

```json
{
  "body": {
    "config": {
      "systems": ["optional string (max 50 items)"],
      "subcategories": ["optional (maps to Question.category)"],
      "conditions": ["optional condition IDs"],
      "focusAreas": ["optional"],
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
        "condition": "Unknown",
        "pearls": [],
        "focusArea": null,
        "difficulty": 50
      }
    ],
    "totalAvailable": 0,
    "warning": "optional string when pool is smaller than requested count"
  }
}
```

**Notes**

- Ephemeral session: **no FSRS / progress writes**.
- Questions pass through `withProductionQuestionSafety` filters.
- Invalid questions (missing options or unresolvable correct answer) are skipped.

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

`count`: `1–25` (default `10`).

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

**Empty due queue**

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int string | `100` | Max items (`1–200`) |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS partition |
| `context` | alias of `progressContext` | — | Accepted for backward compatibility |

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

**Resilience behavior**

- On internal error, returns `200` with empty items and `{ "error": "Unable to load due items. Please try again." }` rather than `500`.

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress`.
- Suppresses broader condition-level rows when a more specific card/topic row covers the same condition/context.
- Card-linked questions must be `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.

---

### `GET /api/user/fsrs-params`

**Auth:** Required (authenticated endpoint, 300 req/min)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "params": {
      "w": [],
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

**Notes**

- Off-scale legacy parameter vectors are treated as absent; canonical defaults are returned instead.
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
    "reason": "Recently optimized with insufficient new data",
    "hoursSinceOptimization": 0,
    "reviewsSinceOptimization": 0
  }
}
```

**Error responses**

- `400` → `{ "error": "Insufficient review history message" }`
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Optimization failed. Please try again." }` or invalid-parameter message

**Notes**

- Uses Python sidecar when `FSRS_OPTIMIZER_URL` is configured; otherwise in-process TypeScript optimizer.
- Persists to `PersonalizedFSRSParams` with algorithm version tag (`6` or `7-alpha` from `w.length`).

---

### `GET /api/users/me/daily-plan`

**Auth:** Required (authenticated endpoint, 30 req/min)

**Query params**

| Param | Type | Description |
|---|---|---|
| `date` | string | Optional plan date (invalid values fall back to today) |

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
    "rescheduleDate": "optional date string"
  }
}
```

`accuracy` is a `0–1` decimal. `durationMinutes` is clamped to `0–1440`.

**Success response (`200 OK`)**

Returns the same `formatPlanResponse` shape as GET.

**Error responses**

- `400` → `{ "error": "Could not apply that study-plan action. Please check the action and try again." }`

**Notes**

- `planDate` and `linkedSessionId` are honored for compatibility with session-attribution flows.

---

## Cross-cutting changes (this batch)

- **Validation hardening:** Mutation endpoints listed above use bounded Zod schemas with `.strict()` where noted. Oversized arrays and unknown fields are rejected before handler logic runs.
- **Error-leak elimination:** Handlers log detailed errors server-side and return generic client messages (except admin-only readiness diagnostics).
- **Regression guards:** `tests/no-response-error-leaks.test.ts`, colocated endpoint tests, and `tests/fsrs-param-validation.test.ts`.

## Related docs

- Public liveness: `GET /api/health` (minimal, unauthenticated)
- Admin diagnostics: `GET /api/admin/readiness` (this batch)
- FSRS implicit rating model: `docs/FSRS_V6_QUICK_REFERENCE.md`
- Security audit checklist: `docs/security/SECURITY_AUDIT_CHECKLIST.md`
