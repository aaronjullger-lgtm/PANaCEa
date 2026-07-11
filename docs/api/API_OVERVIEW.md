# API Overview

This document tracks request/response contracts for recently changed Cloudflare Pages Functions under `functions/api/`. All routes use Clerk bearer auth unless marked **Public** or **Admin**.

**Error handling (2026-07):** Mutation endpoints use Zod `.strict()` schemas with bounded string/array lengths. On unexpected failures, handlers log details server-side and return generic `{ "error": "…" }` messages (no stack traces or raw DB errors). Admin-only `/api/admin/readiness` may include diagnostic detail for operators.

---

## Health & Readiness

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness probe only (`status: ok`); no env/DB/user diagnostics. |
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (env flags, DB connectivity, content counts). |

### `GET /api/health` (Public)

**Success (`200 OK`)**

```json
{
  "timestamp": "2026-07-11T00:00:00.000Z",
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

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Success (`200 OK`)**

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

**Error (`503`)** → `{ "status": "unhealthy", "diagnostics": { … } }` (may include DB error detail for admin diagnosis).

---

## Changed Routes (summary)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve/reject up to 100 pending media assets. |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches (optional `includeArchived=true`). |
| POST | `/api/branches` | User | Create a content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (`category`, `limit`, `shuffle`). |
| POST | `/api/drills/lab-cases` | User | Lab drill helper actions (`action: getDiagnoses`). |
| POST | `/api/feedback/submit` | User | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | User | Shortest path between two knowledge-graph nodes (BFS or Dijkstra). |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for library chunk ingestion. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm; check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | User | Ephemeral filtered question set (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build subdomain-weighted second-chance review session. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger L-BFGS FSRS parameter optimization (rate-limited). |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized study plan. |
| POST | `/api/users/me/daily-plan` | User | Complete, skip, or reschedule a study-plan task. |

---

## Admin

### `POST /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaId": "string",
  "action": "approve",
  "rejectionReason": "optional string (max 500, reject only)"
}
```

**Success (`200 OK`)**

```json
{
  "id": "string",
  "approvalStatus": "approved",
  "action": "approve",
  "message": "Media approved successfully"
}
```

**Errors:** `400` already approved · `404` user/media not found · `500` generic approval failure.

---

### `PUT /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaIds": ["id1", "id2"],
  "action": "reject",
  "reason": "optional string (max 500)"
}
```

**Success (`200 OK`)**

```json
{
  "action": "reject",
  "count": 2,
  "message": "2 media items rejected successfully"
}
```

Only items with `approvalStatus: pending` are updated.

---

### `GET /api/admin/check-access`

**Auth:** Required

**Success (`200 OK`)**

```json
{
  "success": true,
  "hasAccess": true,
  "role": "admin",
  "userId": "string",
  "email": "optional-string"
}
```

`role` can be `admin` or `superadmin`.

---

### `GET /api/admin/stats`

**Auth:** Admin

**Success (`200 OK`)**

```json
{
  "success": true,
  "data": {
    "totalUsers": 0,
    "activeUsersToday": 0,
    "totalStudySessions": 0,
    "averageAccuracy": 0,
    "popularSystems": [{ "system": "string", "count": 0 }],
    "pendingFlags": 0
  }
}
```

---

## Analytics

### `GET /api/analytics/learner-analysis`

**Auth:** Required · **Query:** none

**Success (`200 OK`)**

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

**Errors:** `404` user not synced · `500` generic failure message.

---

### `GET /api/analytics/readiness-projection`

**Auth:** Required

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Target exam date for forward projection |

**Success (`200 OK`)** — `Cache-Control: private, max-age=300`

```json
{
  "overallReadiness": 0.0,
  "projectedAtExam": 0.0,
  "confidenceInterval": [0.0, 0.0],
  "estimatedScoreRange": [0, 0],
  "systems": [
    {
      "system": "CV",
      "blueprintWeight": 0.0,
      "currentReadiness": 0.0,
      "projectedReadiness": 0.0,
      "projectedCI": [0.0, 0.0],
      "weakTopics": [],
      "topicCount": 0,
      "needsIntervention": false
    }
  ],
  "riskLevel": "low",
  "criticalSystems": [],
  "daysUntilExam": null,
  "projectedAt": "2026-07-11T00:00:00.000Z",
  "earlyWarnings": [],
  "decliningSystems": [],
  "plateauingSystems": [],
  "acceleratingSystems": []
}
```

**Empty state (`200 OK`)** when no `UserProgress` rows: `overallReadiness: 0`, `riskLevel: critical`, explanatory `message`.

**Errors:** `404` user not synced · `500` generic failure message.

---

### `POST /api/analytics/soap-note`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 82,
    "breakdown": { "subjective": 20 }
  }
}
```

`totalScore` must be finite, `0–100000`. Unknown fields rejected.

**Success (`200 OK`)** → `{ "success": true }`

Persistence is best-effort if `SoapNoteGradingEvent` model is not yet migrated.

---

## Branches (content versioning)

### `GET /api/branches`

**Auth:** Required

**Query:** `includeArchived` = `true` | `false` (optional)

**Success (`200 OK`)** → `{ "success": true, "branches": [ … ] }`

Returns `[]` when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "name": "string (required)",
    "description": "optional",
    "baseBranch": "optional",
    "createdBy": "string (required)"
  }
}
```

**Success (`200 OK`)** → `{ "success": true, "branchId": "string" }`

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "string (required)",
  "targetBranch": "main"
}
```

**Success (`200 OK`)**

```json
{
  "success": true,
  "mergedCount": 0,
  "message": "optional"
}
```

**Conflict (`400`)** → `{ "success": false, "conflicts": [{ "contentId": "…", "reason": "…" }] }`

---

## Drills

### `GET /api/drills/lab-cases`

**Auth:** Required

**Query params**

| Param | Default | Description |
|---|---|---|
| `category` | — | Filter: `hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or omit for all |
| `limit` | `20` | Max cases (`1–100`) |
| `shuffle` | `true` | Set `shuffle=false` to preserve DB order |

**Success (`200 OK`)**

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
      "keyFindings": [],
      "explanation": "string",
      "category": "hematology"
    }
  ],
  "total": 0
}
```

---

### `POST /api/drills/lab-cases`

**Auth:** Required

**Request body**

```json
{ "action": "getDiagnoses" }
```

**Success (`200 OK`)** → `{ "success": true, "diagnoses": ["…"] }` (sorted unique list).

---

## Feedback

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

`flagType`: `incorrect_fact` | `unclear_question` | `typo` | `outdated` | `other`

**Success (`201 Created`)** → `{ "success": true, "feedbackId": "flag-…" }`

---

## Graph

### `GET /api/graph/search`

**Auth:** Required · **Cache:** `private, max-age=60`

**Query params**

| Param | Required | Description |
|---|---|---|
| `q` | yes | Search string (`1–200` chars) |
| `limit` | no | Max results (default `20`) |
| `nodeType` | no | Filter by node type |

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

### `POST /api/graph/path`

**Auth:** Required · **Cache:** `private, max-age=60`

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

`algorithm`: `bfs` (default) | `dijkstra`

**Success (`200 OK`)**

```json
{
  "path": ["nodeId1", "nodeId2"],
  "edges": ["edgeId1"],
  "totalWeight": 0,
  "nodes": [],
  "edgesDetail": [],
  "algorithm": "bfs",
  "depth": 1,
  "visitedCount": 2
}
```

**Errors:** `404` no path found · `500` generic failure.

---

## Library

### `POST /api/library/contextualize-batch`

**Auth:** Admin · **Requires:** `GEMINI_API_KEY`

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

Max 50 chunks per request.

**Success (`200 OK`)**

```json
{
  "contextualized": [
    {
      "id": "string",
      "originalText": "truncated preview…",
      "contextualizedText": "full text with prepended context",
      "contextPrefix": "LLM-generated prefix"
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

---

## Medical APIs

### `POST /api/medical-apis/validate-drugs`

**Auth:** Required · **Rate limit:** 120 req/min

**Request body**

```json
{
  "drugs": ["metformin", "lisinopril"]
}
```

`1–20` drug names, each `1–200` chars.

**Success (`200 OK`)**

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

`interactions` is `null` when fewer than two valid drugs.

---

## Push notifications

### `POST /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://… (max 2048)",
  "keys": {
    "p256dh": "string (max 512)",
    "auth": "string (max 512)"
  }
}
```

**Success (`200 OK`)** → `{ "message": "Subscription stored" }`

Upserts subscription and sets `UserPreferences.pushNotifications: true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://…"
}
```

**Success (`200 OK`)** → `{ "message": "Subscription removed" }`

Disables push preference when no subscriptions remain.

---

## Questions

### `POST /api/questions/custom-session`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "body": {
    "config": {
      "systems": ["CV"],
      "subcategories": ["optional category ids"],
      "conditions": ["conditionId"],
      "focusAreas": [],
      "difficulty": "same"
    },
    "count": 10
  }
}
```

Filter arrays max 50 entries each. `count` default `10`, max `50`. `difficulty`: `same` | `easier` | `harder`.

**Success (`200 OK`)**

```json
{
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": ["A", "B"],
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
  "totalAvailable": 0,
  "warning": "optional — pool smaller than requested count"
}
```

No FSRS or progress writes — ephemeral practice only.

---

## Reviews

### `POST /api/reviews/second-chance`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "optional",
    "conditionId": "optional"
  }
}
```

`count`: `1–25` (default `10`). `examType`: `PANCE` | `PANRE` | `EOR`.

**Success (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {
        "conditionId": "string",
        "taskType": "string",
        "system": "CV",
        "stability": 0.0,
        "difficulty": 0.0,
        "lapses": 0,
        "isOverdue": true,
        "priorityScore": 0.0
      },
      "isVariant": true,
      "isSecondChance": false,
      "recognitionRisk": 0.0,
      "selectionMethod": "unused_variant",
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
```

**Empty (`200 OK`)** → `{ "selections": [], "message": "No items due for second-chance review." }`

---

## User (FSRS)

### `GET /api/user/fsrs-params`

**Auth:** Required

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

Returns canonical defaults when no on-scale personalized params exist. Review count uses `review_type: real` and `sessionType` in `MAIN` | `DRILL` only.

---

### `POST /api/user/fsrs-params`

**Auth:** Required · **Rate limit:** 30 req/min

**Request body** (optional)

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

**Skipped (`200 OK`)** when recently optimized with insufficient new data → `{ "success": false, "skipped": true, "reason": "…" }`

**Errors:** `400` insufficient review history · `500` invalid optimized parameters or generic failure.

---

## Users (study plan)

### `GET /api/users/me/daily-plan`

**Auth:** Required · **Rate limit:** 30 req/min

**Query:** `date` — optional ISO date string (defaults to today)

**Success (`200 OK`)**

```json
{
  "id": "string",
  "planDate": "2026-07-11",
  "status": "active",
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
  "createdAt": "2026-07-11T00:00:00.000Z",
  "updatedAt": "2026-07-11T00:00:00.000Z"
}
```

Creates the plan on first access via `getOrCreateDailyStudyPlan`.

---

### `POST /api/users/me/daily-plan`

**Auth:** Required · **Rate limit:** 30 req/min

**Request body**

```json
{
  "body": {
    "action": "complete",
    "taskId": "optional",
    "planDate": "2026-07-11",
    "accuracy": 0.85,
    "durationMinutes": 30,
    "questionsAnswered": 20,
    "linkedSessionId": "optional",
    "rescheduleDate": "optional ISO date"
  }
}
```

`action`: `complete` | `skip` | `reschedule` (optional). `accuracy` is `0–1`.

**Success (`200 OK`)** — same shape as GET (updated plan).

**Errors:** `400` invalid action · generic message on apply failure.

---

## OSCE (unchanged contracts)

### `POST /api/osce/complete`

**Auth:** Required

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "optional",
    "treatmentPlan": "optional",
    "soapComparison": {},
    "timingAnalytics": {},
    "infographics": []
  }
}
```

**Success:** `200` → `{ "success": true }` or `{ "success": true, "alreadyCompleted": true }`

---

### `GET /api/osce/stats`

**Auth:** Required

**Success (`200 OK`)**

```json
{
  "totalEncounters": 0,
  "passRate": 0,
  "averageScore": 0,
  "averageClinicalReasoningScore": 0,
  "trend": [
    {
      "sessionId": "string",
      "date": "2026-01-01T00:00:00.000Z",
      "score": 0,
      "clinicalReasoningScore": 0
    }
  ]
}
```

Pass threshold: score `>= 70`.
