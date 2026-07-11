# API Overview

This document tracks request/response contracts for recently hardened or changed Cloudflare Pages Functions under `functions/api/`.

**Related docs**

- Public liveness: `GET /api/health` (sanitized; no env/DB diagnostics)
- Admin diagnostics: `GET /api/admin/readiness` (replaces public health internals)
- Security posture: `docs/security/SECURITY_AUDIT_CHECKLIST.md`

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (DB, env presence, content counts). |
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject pending media assets (max 100). |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches (optional archived). |
| POST | `/api/branches` | User | Create a content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (filtered, shuffled). |
| POST | `/api/drills/lab-cases` | User | Lab drill helper actions (`getDiagnoses`). |
| POST | `/api/feedback/submit` | User | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | User | Shortest path between two knowledge-graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval preprocessing. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm; optional interaction check. |
| POST | `/api/push/subscribe` | User | Register a Web Push subscription. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Ephemeral custom-filter question set (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | User | Canonical FSRS due queue from Card / UserTopicProgress / UserProgress. |
| GET | `/api/user/fsrs-params` | User | Read personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger FSRS parameter optimization (rate-limited). |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Complete, skip, or reschedule a daily-plan task. |

---

## Endpoint Contracts

### Admin

#### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request:** None

**Success (`200`)**

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

**Error (`503`)** — `{ "status": "unhealthy", "diagnostics": { ... } }` when DB is missing or unreachable.

**Notes:** Replaces detailed diagnostics previously exposed on public `/api/health`.

---

#### `POST /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mediaId": "string",
  "action": "approve",
  "rejectionReason": "optional string (max 500, required semantics for reject)"
}
```

`action`: `approve` | `reject`

**Success (`200`)**

```json
{
  "id": "string",
  "approvalStatus": "approved",
  "action": "approve",
  "message": "Media approved successfully"
}
```

**Errors:** `400` (already approved), `404` (user or media not found), `500`

---

#### `PUT /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaIds": ["id1", "id2"],
  "action": "approve",
  "reason": "optional string (max 500)"
}
```

`mediaIds`: 1–100 items. Only `pending` rows are updated.

**Success (`200`)**

```json
{
  "action": "approve",
  "count": 2,
  "message": "2 media items approved successfully"
}
```

---

### Analytics

#### `GET /api/analytics/learner-analysis`

**Auth:** User

**Request:** None

**Success (`200`)**

```json
{
  "cluster": {
    "archetype": "steady_grinder",
    "confidence": 0.82,
    "distances": {}
  },
  "warnings": [
    {
      "type": "accuracy_decline",
      "message": "string",
      "severity": "medium",
      "value": 0.1,
      "threshold": 0.15,
      "recommendation": "string"
    }
  ],
  "riskScore": 0.35,
  "features": {},
  "metadata": {
    "attemptsSampled": 120,
    "sessionsSampled": 8,
    "systemsCovered": 6,
    "totalSystems": 12
  }
}
```

**Errors:** `404` (user not synced), `500`

---

#### `GET /api/analytics/readiness-projection`

**Auth:** User

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` | Optional; projects readiness to this date |

**Success (`200`)** — `ExamReadinessProjection` from `readinessProjectionService`:

```json
{
  "overallReadiness": 0.62,
  "projectedAtExam": 0.58,
  "confidenceInterval": [0.52, 0.68],
  "estimatedScoreRange": [610, 680],
  "systems": [],
  "riskLevel": "moderate",
  "criticalSystems": [],
  "daysUntilExam": 45,
  "projectedAt": "2026-01-01T00:00:00.000Z",
  "earlyWarnings": [],
  "decliningSystems": [],
  "plateauingSystems": [],
  "acceleratingSystems": []
}
```

**Empty state (`200`)** — zeroed readiness when no `READINESS` progress exists.

**Errors:** `404` (user not synced), `500`. Response includes `Cache-Control: private, max-age=300`.

---

#### `POST /api/analytics/soap-note`

**Auth:** User

**Request body** (strict; wrapped `body` object)

```json
{
  "body": {
    "caseId": "string",
    "totalScore": 85,
    "breakdown": { "subjective": 20, "objective": 25 }
  }
}
```

`totalScore`: finite number, `0`–`100000`.

**Success (`200`)** — `{ "success": true }`

**Notes:** Best-effort persistence to `SoapNoteGradingEvent`; missing model is logged and does not fail the request.

---

### Content branches

#### `GET /api/branches`

**Auth:** User

**Query params**

| Param | Values | Description |
|---|---|---|
| `includeArchived` | `true` \| `false` | Include archived branches |

**Success (`200`)** — `{ "success": true, "branches": [...] }`

**Notes:** Returns `{ "success": true, "branches": [] }` when `DATABASE_URL` is unset.

---

#### `POST /api/branches`

**Auth:** User

**Request body**

```json
{
  "body": {
    "name": "feature-branch",
    "description": "optional",
    "baseBranch": "main",
    "createdBy": "user-id"
  }
}
```

**Success (`200`)** — `{ "success": true, "branchId": "string" }`

**Errors:** `503` (DB not configured), `500`

---

#### `POST /api/branches/:branchName/merge`

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "admin-user-id",
  "targetBranch": "main"
}
```

**Success (`200` or `400`)** — `{ ...mergeResult }` from `mergeBranch` (includes `success`, `mergedCount` when applicable)

**Errors:** `503` (DB not configured), `500`

---

### Drills

#### `GET /api/drills/lab-cases`

**Auth:** User

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter: `hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or omit for all |
| `limit` | `20` | `1`–`100` |
| `shuffle` | `true` | Set `shuffle=false` to preserve DB order |

**Success (`200`)**

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
  "total": 10
}
```

---

#### `POST /api/drills/lab-cases`

**Auth:** User

**Request body**

```json
{ "action": "getDiagnoses" }
```

**Success (`200`)** — `{ "success": true, "diagnoses": ["Diagnosis A", "Diagnosis B"] }`

---

### Feedback

#### `POST /api/feedback/submit`

**Auth:** User

**Request body** (strict)

```json
{
  "body": {
    "questionId": "string",
    "flagType": "incorrect_fact",
    "description": "string (1–2000 chars)",
    "questionText": "optional (max 5000)",
    "topic": "optional (max 200)",
    "system": "optional (max 100)"
  }
}
```

`flagType`: `incorrect_fact` | `unclear_question` | `typo` | `outdated` | `other`

**Success (`201`)** — `{ "success": true, "feedbackId": "flag-..." }`

**Errors:** `404` (user not found), `500`

---

### Knowledge graph

#### `GET /api/graph/search`

**Auth:** User

**Query params**

| Param | Required | Description |
|---|---|---|
| `q` | yes | Search string (`1`–`200` chars) |
| `limit` | no | Max results (default `20`) |
| `nodeType` | no | Filter by node type |

**Success (`200`)**

```json
{
  "nodes": [
    {
      "id": "string",
      "nodeType": "condition",
      "label": "Atrial Fibrillation",
      "description": "optional",
      "sourceType": "string",
      "sourceId": "string",
      "taxonomyCode": "optional",
      "systemCodes": ["CV"],
      "metadata": {}
    }
  ],
  "totalCount": 1,
  "query": "afib"
}
```

---

#### `POST /api/graph/path`

**Auth:** User

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["treats"],
  "includeNodes": true,
  "includeEdges": true
}
```

`algorithm`: `bfs` | `dijkstra`

**Success (`200`)**

```json
{
  "path": ["node-a", "node-b"],
  "edges": ["edge-1"],
  "totalWeight": 1,
  "nodes": [],
  "edgesDetail": [],
  "algorithm": "bfs",
  "depth": 1,
  "visitedCount": 2
}
```

**Errors:** `404` (no path), `500`

---

### Library (admin ingestion)

#### `POST /api/library/contextualize-batch`

**Auth:** Admin

**Request body**

```json
{
  "chunks": [
    {
      "id": "chunk-1",
      "text": "content to contextualize",
      "metadata": { "conditionId": "optional", "system": "CV" }
    }
  ],
  "documentSummary": "optional (max 2000)",
  "splitParentChild": false,
  "concurrency": 5
}
```

`chunks`: 1–50 items; `text` max 10000 chars each.

**Success (`200`)**

```json
{
  "contextualized": [
    {
      "id": "chunk-1",
      "originalText": "truncated preview...",
      "contextualizedText": "full text with prepended context",
      "contextPrefix": "context sentence"
    }
  ],
  "parentChildChunks": null,
  "stats": { "totalChunks": 1, "processed": 1, "avgContextLength": 42 }
}
```

**Requires:** `GEMINI_API_KEY`

---

### Medical APIs

#### `POST /api/medical-apis/validate-drugs`

**Auth:** User (120 req/min)

**Request body**

```json
{ "drugs": ["metformin", "lisinopril"] }
```

`drugs`: 1–20 strings, each max 200 chars.

**Success (`200`)**

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

---

### Push notifications

#### `POST /api/push/subscribe`

**Auth:** User

**Request body** (strict Web Push shape)

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "base64url string",
    "auth": "base64url string"
  }
}
```

**Success (`200`)** — `{ "message": "Subscription stored" }`

**Notes:** Upserts by `(userId, endpoint)` and sets `pushNotifications: true` in preferences.

---

#### `DELETE /api/push/subscribe`

**Auth:** User

**Request body**

```json
{ "endpoint": "https://fcm.googleapis.com/..." }
```

**Success (`200`)** — `{ "message": "Subscription removed" }`

**Notes:** Disables `pushNotifications` when no subscriptions remain.

---

### Questions

#### `POST /api/questions/custom-session`

**Auth:** User

**Request body** (strict)

```json
{
  "body": {
    "config": {
      "systems": ["CV", "PULM"],
      "subcategories": ["optional category ids"],
      "conditions": ["condition-id"],
      "focusAreas": ["optional"],
      "difficulty": "same"
    },
    "count": 10
  }
}
```

`difficulty`: `same` | `easier` | `harder`. `count`: 1–50 (default 10).

**Success (`200`)**

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
      "difficulty": 50
    }
  ],
  "totalAvailable": 120,
  "warning": "optional when pool is smaller than requested count"
}
```

**Notes:** No FSRS or progress writes. Questions with missing/invalid options are skipped server-side.

---

### Reviews

#### `POST /api/reviews/second-chance`

**Auth:** User

**Request body** (strict)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "optional"
  }
}
```

`count`: 1–25. `examType`: `PANCE` | `PANRE` | `EOR`.

**Success (`200`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "conditionId": "string",
      "taskType": "diagnosis",
      "isVariant": true,
      "isSecondChance": true,
      "question": { "source": "pre_generated", "questionData": {} }
    }
  ],
  "meta": {
    "total": 10,
    "withVariants": 4,
    "withSecondChance": 10,
    "examType": "PANCE"
  }
}
```

**Empty (`200`)** — `{ "selections": [], "message": "No items due for second-chance review." }`

---

### SRS (compatibility)

#### `GET /api/srs/due`

**Auth:** User

**Query params**

| Param | Description |
|---|---|
| `limit` | Max items (default 100, clamped 1–200) |
| `progressContext` or `context` | `READINESS` or `TARGETED` (case-insensitive) |

**Success (`200`)**

```json
{
  "items": [
    {
      "id": "string",
      "source": "card",
      "questionId": "string",
      "conditionId": "string",
      "taskType": "mcq",
      "progressContext": "READINESS",
      "dueDate": "2026-01-01T00:00:00.000Z",
      "overdueDays": 2,
      "priority": 0.6
    }
  ],
  "totalDue": 5,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": "READINESS",
  "suppressedDuplicates": 1
}
```

**Notes:** Merges `Card`, `UserTopicProgress`, and `UserProgress` with duplicate suppression. On internal errors returns empty `items` with a generic `error` string (no stack traces).

---

### User / FSRS

#### `GET /api/user/fsrs-params`

**Auth:** User

**Success (`200`)**

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
  "reviewsNeeded": 150,
  "message": "Need more reviews before optimization"
}
```

**Notes:** Off-scale legacy parameters are treated as absent; client receives canonical defaults. Eligibility counts only `review_type: 'real'` with `sessionType` in `MAIN` | `DRILL`.

---

#### `POST /api/user/fsrs-params`

**Auth:** User (30 req/min)

**Request body** (optional)

```json
{
  "body": {
    "forceReoptimize": false,
    "includeSystemModifiers": true
  }
}
```

**Success (`200`)** — optimization result with `success`, `params`, `summary`, `optimizationTimeMs`

**Skipped (`200`)** — `{ "success": false, "skipped": true, "reason": "Recently optimized..." }`

**Errors:** `400` (insufficient reviews), `404`, `500` (invalid optimized parameters)

---

### Daily study plan

#### `GET /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Query params**

| Param | Description |
|---|---|
| `date` | Optional date string (invalid values fall back to today) |

**Success (`200`)** — formatted plan:

```json
{
  "id": "string",
  "planDate": "2026-01-01",
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
    "completedTasks": 0,
    "totalTasks": 2
  },
  "completedAt": null,
  "wasEffective": null,
  "feedbackReason": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

#### `POST /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete",
    "taskId": "optional",
    "planDate": "2026-01-01",
    "accuracy": 0.85,
    "durationMinutes": 45,
    "questionsAnswered": 30,
    "linkedSessionId": "optional",
    "rescheduleDate": "optional ISO date"
  }
}
```

`action`: `complete` | `skip` | `reschedule`

**Success (`200`)** — same shape as GET response for the updated plan.

**Errors:** `400` (invalid action), `500`
