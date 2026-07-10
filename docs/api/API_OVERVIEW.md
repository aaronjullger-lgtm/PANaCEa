# API Overview

This document tracks request/response contracts for recently changed API routes under `functions/api/`.

**Auth legend:** *Authenticated* = Clerk token required. *Admin* = admin role or allowlist. *Public* = no auth (not listed here).

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject pending media assets (max 100). |
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (replaces public `/api/health` internals). |
| GET | `/api/analytics/learner-analysis` | Authenticated | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | Authenticated | FSRS-based exam readiness projection with per-system breakdown. |
| POST | `/api/analytics/soap-note` | Authenticated | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | Authenticated | List content branches for version control. |
| POST | `/api/branches` | Authenticated | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | Authenticated | Fetch lab cases for Mini Lab Drill. |
| POST | `/api/drills/lab-cases` | Authenticated | Lab-case utility actions (e.g. diagnosis list). |
| POST | `/api/feedback/submit` | Authenticated | Submit question feedback / flag for admin review. |
| POST | `/api/graph/path` | Authenticated | Find shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | Authenticated | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for retrieval chunks. |
| POST | `/api/medical-apis/validate-drugs` | Authenticated | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | Authenticated | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Authenticated | Remove a Web Push subscription. |
| POST | `/api/questions/custom-session` | Authenticated | Fetch filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Authenticated | Build a blueprint-weighted second-chance review session. |
| GET | `/api/user/fsrs-params` | Authenticated | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | Authenticated | Trigger L-BFGS FSRS parameter optimization from review history. |
| GET | `/api/users/me/daily-plan` | Authenticated | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | Authenticated | Apply a study-plan action (complete, skip, reschedule). |

---

## Admin

### `POST /api/admin/media/approve`

**Auth:** Admin (`adminEndpoint`)

**Request body**

```json
{
  "mediaId": "string",
  "action": "approve | reject",
  "rejectionReason": "optional-string (max 500, required for reject)"
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

**Error responses:** `400` (already approved), `404` (user or media not found), `500`

---

### `PUT /api/admin/media/approve`

**Auth:** Admin

**Request body**

```json
{
  "mediaIds": ["string"],
  "action": "approve | reject",
  "reason": "optional-string (max 500)"
}
```

`mediaIds`: 1–100 items. Only `pending` assets are updated.

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

**Unhealthy (`503`)** — missing `DATABASE_URL` or DB probe failure. Admin-only DB error detail is intentional for ops diagnosis.

**Notes:** Public `/api/health` returns liveness only; use this endpoint for operational diagnostics.

---

## Analytics

### `GET /api/analytics/learner-analysis`

**Auth:** Authenticated

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

**Error responses:** `404` (user not synced), `500`

---

### `GET /api/analytics/readiness-projection`

**Auth:** Authenticated

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

**Empty state (`200`)** — no `READINESS` progress records: `overallReadiness: 0`, `message` explaining no study data.

**Cache:** `Cache-Control: private, max-age=300`

---

### `POST /api/analytics/soap-note`

**Auth:** Authenticated

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": {}
  }
}
```

`totalScore`: finite number, 0–100000.

**Success response (`200 OK`)**

```json
{
  "data": { "success": true }
}
```

**Notes:** Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success.

---

## Content Branching

### `GET /api/branches`

**Auth:** Authenticated

**Query params:** `includeArchived` = `true` | `false` (optional)

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branches": []
}
```

Returns `{ success: true, branches: [] }` when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** Authenticated

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

**Error responses:** `503` (no database), `500`

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin

**Request body**

```json
{
  "mergedBy": "string (required)",
  "targetBranch": "optional-string (default: main)"
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "mergedCount": 0,
    "message": "Successfully merged N change(s) from branch to main"
  }
}
```

**Conflict (`400`)** — `success: false` with optional `conflicts` array.

---

## Drills

### `GET /api/drills/lab-cases`

**Auth:** Authenticated

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter: `hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, `random` |
| `limit` | int 1–100 | 20 | Max cases returned |
| `shuffle` | boolean | true | Randomize order (`shuffle=false` to disable) |

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

---

### `POST /api/drills/lab-cases`

**Auth:** Authenticated

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

## Feedback

### `POST /api/feedback/submit`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "body": {
    "questionId": "string (1–200)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000)",
    "questionText": "optional-string (max 5000)",
    "topic": "optional-string (max 200)",
    "system": "optional-string (max 100)"
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

**Error responses:** `404` (user not found), `500`

---

## Knowledge Graph

### `POST /api/graph/path`

**Auth:** Authenticated

**Request body**

```json
{
  "startNodeId": "string",
  "endNodeId": "string",
  "algorithm": "bfs | dijkstra",
  "maxDepth": 10,
  "maxVisits": 1000,
  "edgeTypes": ["optional-string"],
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

**Error responses:** `404` (no path), `500`

---

### `GET /api/graph/search`

**Auth:** Authenticated

**Query params:** `q` (required, 1–200), `limit` (default 20), `nodeType` (optional)

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

## Library

### `POST /api/library/contextualize-batch`

**Auth:** Admin

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

`chunks`: 1–50 items. Requires `GEMINI_API_KEY`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "contextualized": [
      {
        "id": "string",
        "originalText": "truncated...",
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

## Medical APIs

### `POST /api/medical-apis/validate-drugs`

**Auth:** Authenticated (120 req/min)

**Request body**

```json
{
  "drugs": ["string"]
}
```

`drugs`: 1–20 items, each 1–200 chars. Uses free NLM RxNorm API (no API key).

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

## Push Notifications

### `POST /api/push/subscribe`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (max 2048)",
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

Upserts `PushSubscription` and sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Authenticated

**Request body**

```json
{
  "endpoint": "https://..."
}
```

**Success response (`200 OK`)**

```json
{
  "data": { "message": "Subscription removed" }
}
```

Disables push preferences when no subscriptions remain.

---

## Questions

### `POST /api/questions/custom-session`

**Auth:** Authenticated

**Request body** (`.strict()` on `config` and body)

```json
{
  "body": {
    "config": {
      "systems": ["string"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

Filter arrays: max 50 entries, each max 100 chars. `count`: 1–50 (default 10).

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
    "warning": "optional-string when pool is smaller than requested count"
  }
}
```

**Notes:** No FSRS or progress writes — ephemeral practice only.

---

## Reviews

### `POST /api/reviews/second-chance`

**Auth:** Authenticated

**Request body** (`.strict()`)

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": {
    "system": "optional-string (max 100)",
    "conditionId": "optional-string (max 200)"
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
}
```

**Empty due set (`200`)** — `{ "selections": [], "message": "No items due for second-chance review." }`

---

## User / FSRS

### `GET /api/user/fsrs-params`

**Auth:** Authenticated (300 req/min)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "params": {
      "w": [],
      "sampleSize": 0,
      "lastOptimizedAt": "2026-01-01T00:00:00.000Z",
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

**Notes:** Off-scale legacy `w` arrays are treated as absent; canonical defaults returned. Eligibility counts only `review_type: 'real'` with `sessionType` in `MAIN` | `DRILL`.

---

### `POST /api/user/fsrs-params`

**Auth:** Authenticated (30 req/min)

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

**Skipped (`200`)** — recently optimized with insufficient new data: `success: false`, `skipped: true`.

**Error responses:** `400` (insufficient reviews), `404` (user), `500` (invalid optimized params)

**Notes:** Uses Python sidecar when `FSRS_OPTIMIZER_URL` is configured; otherwise in-process TypeScript optimizer. Persists `version` tag (`6` or `7-alpha`) when column exists.

---

## Study Plan

### `GET /api/users/me/daily-plan`

**Auth:** Authenticated (30 req/min)

**Query params:** `date` — optional ISO date string (defaults to today)

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

Creates the plan on first access if missing.

---

### `POST /api/users/me/daily-plan`

**Auth:** Authenticated (30 req/min)

**Request body**

```json
{
  "body": {
    "action": "complete | skip | reschedule",
    "taskId": "optional-string (max 128)",
    "planDate": "optional YYYY-MM-DD",
    "accuracy": 0.0,
    "durationMinutes": 0,
    "questionsAnswered": 0,
    "linkedSessionId": "optional-string (max 128)",
    "rescheduleDate": "optional ISO date string"
  }
}
```

`accuracy`: 0–1 decimal. `durationMinutes`: 0–1440.

**Success response (`200 OK`)** — same shape as GET (updated plan).

**Error responses:** `400` (invalid action), `500`
