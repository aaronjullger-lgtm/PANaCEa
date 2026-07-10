# API Overview

This document tracks request/response contracts for recently changed API routes under `functions/api/`. All routes deploy as Cloudflare Pages Functions and return JSON unless noted.

**Auth patterns**

| Middleware | Who can call |
|---|---|
| `authenticatedEndpoint` | Any signed-in user (Clerk JWT) |
| `adminEndpoint` / `adminAuthenticatedEndpoint` | Admin or superadmin only |

**Common error shape:** `{ "error": "string" }` with appropriate HTTP status.

---

## Changed Routes (summary)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (replaces public health internals). |
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject pending media assets. |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with confidence intervals. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches. |
| POST | `/api/branches` | User | Create a content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill. |
| POST | `/api/drills/lab-cases` | User | Lab-case utility actions (e.g. diagnosis list). |
| POST | `/api/feedback/submit` | User | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | User | Find shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval preprocessing. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Register a Web Push subscription. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Fetch filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build a subdomain-level second-chance review session. |
| GET | `/api/srs/due` | User | Canonical FSRS due queue from Card / UserTopicProgress / UserProgress. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization. |
| GET | `/api/users/me/daily-plan` | User | Get today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Complete, skip, or reschedule a study-plan task. |

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

**Error (`503`)** — `{ "status": "unhealthy", "diagnostics": { ... } }` when DB is missing or unreachable.

**Notes**

- Replaces the previous public `/api/health` diagnostic payload. Public `/api/health` is liveness-only.
- DB error details are intentionally exposed here for admin troubleshooting.

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

**Errors:** `400` (already approved), `404` (user or media not found), `500`.

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

**Notes:** Only updates rows with `approvalStatus: pending`.

---

## Analytics

### `GET /api/analytics/learner-analysis`

**Auth:** User

**Request:** None

**Success (`200 OK`)**

```json
{
  "cluster": {
    "archetype": "CONSISTENT_REVIEWER | CRAMMER | BREADTH_SEEKER | DEPTH_FOCUSED | AT_RISK",
    "confidence": 0.0,
    "distances": {}
  },
  "warnings": [
    {
      "type": "string",
      "message": "string",
      "severity": "low | medium | high",
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
```

**Errors:** `404` (user not synced), `500`.

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
  "overallReadiness": 0.0,
  "projectedAtExam": 0.0,
  "confidenceInterval": [0, 0],
  "estimatedScoreRange": [0, 0],
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

**Empty states**

- `404` + `meta.status: "user_not_synced"` when Clerk user has no internal row.
- `200` with zeroed readiness when no `READINESS` progress exists.

**Headers:** `Cache-Control: private, max-age=300`

---

### `POST /api/analytics/soap-note`

**Auth:** User

**Request body**

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": {}
  }
}
```

**Success (`200 OK`)** — `{ "success": true }`

**Validation:** `totalScore` must be finite, 0–100000. Unknown body fields rejected (`.strict()`).

**Notes:** Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success.

---

## Content branches

### `GET /api/branches`

**Auth:** User

**Query params:** `includeArchived=true|false` (optional)

**Success (`200 OK`)**

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
    "description": "optional string",
    "baseBranch": "optional string",
    "createdBy": "string"
  }
}
```

**Success (`200 OK`)** — `{ "success": true, "branchId": "string" }`

**Errors:** `503` (no database), `500`.

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "string",
  "targetBranch": "optional string (default: main)"
}
```

**Success (`200 OK`)** — `{ "success": true, "mergedCount": 0, ... }` (shape from `mergeBranch`)

**Errors:** `400` (merge failed), `503` (no database), `500`.

---

## Drills

### `GET /api/drills/lab-cases`

**Auth:** User

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter: `hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or `random` |
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
      "keyFindings": [],
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
{
  "action": "getDiagnoses"
}
```

**Success (`200 OK`)** — `{ "success": true, "diagnoses": ["string"] }`

---

## Feedback

### `POST /api/feedback/submit`

**Auth:** User

**Request body**

```json
{
  "body": {
    "questionId": "string",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
    "questionText": "optional string (max 5000)",
    "topic": "optional string (max 200)",
    "system": "optional string (max 100)"
  }
}
```

**Success (`201 Created`)**

```json
{
  "success": true,
  "feedbackId": "flag-<timestamp>-<random>"
}
```

**Errors:** `404` (user not found), `500`.

**Notes:** Creates a `QuestionFlag` row. `incorrect_fact` flags get `priority: high`.

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
  "algorithm": "bfs",
  "depth": 0,
  "visitedCount": 0,
  "nodes": [],
  "edgesDetail": []
}
```

**Errors:** `404` (no path), `500`.

---

### `GET /api/graph/search`

**Auth:** User

**Query params:** `q` (required, 1–200 chars), `limit` (default 20), `nodeType` (optional)

**Success (`200 OK`)**

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
  "parentChildChunks": null,
  "stats": {
    "totalChunks": 0,
    "processed": 0,
    "avgContextLength": 0
  }
}
```

**Requires:** `GEMINI_API_KEY`. Max 50 chunks per request.

---

## Medical APIs

### `POST /api/medical-apis/validate-drugs`

**Auth:** User (120 req/min)

**Request body**

```json
{
  "drugs": ["string"]
}
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

**Validation:** 1–20 drug names, each max 200 chars. Uses public RxNorm API (no API key).

---

## Push notifications

### `POST /api/push/subscribe`

**Auth:** User

**Request body**

```json
{
  "endpoint": "https://...",
  "keys": {
    "p256dh": "string",
    "auth": "string"
  }
}
```

**Success (`200 OK`)** — `{ "message": "Subscription stored" }`

**Notes:** Upserts `PushSubscription` and sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** User

**Request body**

```json
{
  "endpoint": "https://..."
}
```

**Success (`200 OK`)** — `{ "message": "Subscription removed" }`

**Notes:** Disables push preferences when no subscriptions remain.

---

## Questions

### `POST /api/questions/custom-session`

**Auth:** User

**Request body**

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
      "options": [],
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
```

**Notes**

- Does **not** write FSRS / progress. For ephemeral practice sessions.
- Filter arrays capped at 50 entries; `count` capped at 50.
- Questions without valid options or resolvable `correctAnswer` are skipped.

---

## Reviews

### `POST /api/reviews/second-chance`

**Auth:** User

**Request body**

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
      "selectionMethod": "unused_variant | different_question | cross_task_fallback | canonical_fallback",
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

**Empty:** `{ "selections": [], "message": "No items due for second-chance review." }`

---

## SRS (compatibility)

### `GET /api/srs/due`

**Auth:** User

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `100` | Clamped 1–200 |
| `progressContext` or `context` | — | `READINESS` or `TARGETED` |

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
      "priority": 0.0
    }
  ],
  "totalDue": 0,
  "timestamp": "ISO-8601",
  "source": "canonical_fsrs_progress",
  "progressContext": null,
  "suppressedDuplicates": 0
}
```

**Notes**

- Reads canonical `Card`, `UserTopicProgress`, and `UserProgress` (not legacy `SRSItem`).
- Suppresses broader condition-level rows when a more specific card/topic row exists.
- Card rows require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- On internal errors, returns empty items with an `error` message instead of HTTP 500.

---

## User / FSRS

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

- Returns canonical FSRS v6 defaults when no personalized params exist.
- Off-scale legacy params (pre-2026-04) are treated as absent.
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

**Errors:** `400` (insufficient reviews), `404` (user), `500` (invalid optimized params).

**Notes:** Uses Python sidecar when `FSRS_OPTIMIZER_URL` is set; otherwise in-process TypeScript optimizer.

---

## Daily study plan

### `GET /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Query params:** `date` (optional ISO date string; defaults to today)

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
```

---

### `POST /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "optional string",
    "planDate": "optional YYYY-MM-DD",
    "accuracy": 0.0,
    "durationMinutes": 0,
    "questionsAnswered": 0,
    "linkedSessionId": "optional string",
    "rescheduleDate": "optional string"
  }
}
```

**Success (`200 OK`)** — Same shape as GET (updated plan).

**Errors:** `400` when the action cannot be applied.

**Notes:** `accuracy` is a 0–1 decimal. Creates the plan on first access if missing.
