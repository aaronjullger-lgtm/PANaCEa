# API Overview

This document tracks the request/response contracts for the most recently changed API routes (Implementation Expansion Pass — validation hardening, security, and endpoint repairs).

**Runtime:** Cloudflare Pages Functions under `functions/api/`.

**Auth:** Unless noted, endpoints require a Clerk bearer token via `authenticatedEndpoint` or `adminEndpoint` middleware. Admin routes require admin/superadmin role.

**Validation hardening (this pass):** Mutation endpoints now use bounded Zod schemas with `.strict()` to reject unknown fields and oversized payloads. Invalid input returns `400` with a structured error; internal failures return generic messages (no stack traces).

---

## Changed Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/media/approve` | Admin | Approve or reject a single pending media asset. |
| PUT | `/api/admin/media/approve` | Admin | Batch approve or reject up to 100 pending media assets. |
| GET | `/api/admin/readiness` | Admin | Operational readiness diagnostics (replaces public health internals). |
| GET | `/api/analytics/learner-analysis` | User | Learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | User | Exam readiness projection with per-system breakdown and optional exam date. |
| POST | `/api/analytics/soap-note` | User | Persist OSCE SOAP note grading analytics. |
| GET | `/api/branches` | User | List content branches (optional `includeArchived=true`). |
| POST | `/api/branches` | User | Create a new content branch. |
| POST | `/api/branches/:branchName/merge` | Admin | Merge a content branch into a target branch. |
| GET | `/api/drills/lab-cases` | User | Fetch lab cases for Mini Lab Drill (category, limit, shuffle). |
| POST | `/api/drills/lab-cases` | User | Lab-case actions (currently `getDiagnoses` for autocomplete). |
| POST | `/api/feedback/submit` | User | Submit question feedback / content flag. |
| POST | `/api/graph/path` | User | Find shortest path between two knowledge-graph nodes. |
| GET | `/api/graph/search` | User | Full-text search over graph node labels and descriptions. |
| POST | `/api/library/contextualize-batch` | Admin | Batch LLM contextualization for library content ingestion. |
| POST | `/api/medical-apis/validate-drugs` | User | Validate drug names via RxNorm and check interactions. |
| POST | `/api/push/subscribe` | User | Store a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | User | Remove a Web Push subscription by endpoint URL. |
| POST | `/api/questions/custom-session` | User | Fetch filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | User | Build a blueprint-weighted second-chance review session. |
| GET | `/api/user/fsrs-params` | User | Retrieve personalized FSRS parameters and optimization eligibility. |
| POST | `/api/user/fsrs-params` | User | Trigger server-side FSRS parameter optimization. |
| GET | `/api/users/me/daily-plan` | User | Get or create today's personalized daily study plan. |
| POST | `/api/users/me/daily-plan` | User | Apply a study-plan action (complete, skip, reschedule). |

---

## Admin

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

**Error responses:** `400` (already approved), `404` (user or media not found), `500`

---

### `PUT /api/admin/media/approve`

**Auth:** Admin

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
  "message": "N media items approved successfully"
}
```

Only items with `approvalStatus: pending` are updated.

---

### `GET /api/admin/readiness`

**Auth:** Admin (`adminAuthenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "status": "healthy",
  "diagnostics": {
    "timestamp": "ISO-8601",
    "runtime": "cloudflare-pages",
    "env": {
      "DATABASE_URL": true,
      "CLERK_SECRET_KEY": true,
      "GEMINI_API_KEY": true,
      "RATE_LIMIT_KV": true
    },
    "dbUrlType": "accelerate | direct-postgres | unknown | missing",
    "database": { "status": "pass" },
    "userCount": 0,
    "contentSystemsCount": 0,
    "contentConditionCount": 0
  }
}
```

**Unhealthy (`503`):** `status: unhealthy` with `database.status: fail` and error message.

**Notes:** Replaces detailed diagnostics previously exposed on public `/api/health`. Public liveness remains at `GET /api/health` (minimal payload only).

---

## Analytics

### `GET /api/analytics/learner-analysis`

**Auth:** User

**Request body:** None (user resolved from Clerk token)

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

**Error responses:** `404` (user not synced), `500`

---

### `GET /api/analytics/readiness-projection`

**Auth:** User

**Query params**

| Param | Type | Description |
|---|---|---|
| `examDate` | `YYYY-MM-DD` (optional) | Target exam date for forward projection |

**Success response (`200 OK`)**

Returns `computeExamReadiness()` output: `overallReadiness`, `projectedAtExam`, per-system breakdown, `riskLevel`, confidence intervals. Cached `private, max-age=300`.

**Empty state (`200 OK`):** Zeroed readiness with message when no `UserProgress` rows exist.

**Error responses:** `404` (user not synced), `500`

---

### `POST /api/analytics/soap-note`

**Auth:** User

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": { "subjective": 20 }
  }
}
```

`totalScore` must be finite, `0–100000`. `NaN`/`Infinity` rejected.

**Success response (`200 OK`)**

```json
{ "success": true }
```

**Notes:** Best-effort persistence to `SoapNoteGradingEvent`; if the model is absent, logs and still returns success.

---

## Content Branches

### `GET /api/branches`

**Auth:** User

**Query params:** `includeArchived=true|false` (optional)

**Success response (`200 OK`)**

```json
{
  "success": true,
  "branches": []
}
```

Returns empty array when `DATABASE_URL` is unset.

---

### `POST /api/branches`

**Auth:** User

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
{ "success": true, "branchId": "string" }
```

---

### `POST /api/branches/:branchName/merge`

**Auth:** Admin

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

Shape matches `mergeBranch()` result from `_shared/content-branching`.

---

## Drills

### `GET /api/drills/lab-cases`

**Auth:** User

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by category; `random` skips filter |
| `limit` | int 1–100 | 20 | Max cases returned |
| `shuffle` | boolean string | true | Randomize order (`false` to disable) |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "cases": [
    {
      "id": "string",
      "clinicalContext": "string",
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

**Error responses:** `500` with `{ "success": false, "error": "..." }` (generic message, no internal leak)

---

### `POST /api/drills/lab-cases`

**Auth:** User

**Request body**

```json
{ "action": "getDiagnoses" }
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "diagnoses": ["string"]
}
```

---

## Feedback

### `POST /api/feedback/submit`

**Auth:** User

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
{ "success": true, "feedbackId": "string" }
```

**Error responses:** `404` (user not found), `500`

**Notes:** Creates a `QuestionFlag` row. `incorrect_fact` flags get `priority: high`.

---

## Knowledge Graph

### `GET /api/graph/search`

**Auth:** User

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string 1–200 | required | Search term |
| `limit` | int | 20 | Max results |
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

Cached `private, max-age=60`.

---

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

**Error responses:** `404` (no path), `500`

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

Max 50 chunks per request. Requires `GEMINI_API_KEY`.

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

---

## Medical APIs

### `POST /api/medical-apis/validate-drugs`

**Auth:** User (120 req/min)

**Request body**

```json
{ "drugs": ["string (1–20 items, each 1–200 chars)"] }
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

Uses NLM RxNorm (no API key required).

---

## Push Notifications

### `POST /api/push/subscribe`

**Auth:** User

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://... (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Success response (`200 OK`)**

```json
{ "message": "Subscription stored" }
```

Upserts `PushSubscription` and sets `UserPreferences.pushNotifications: true`.

---

### `DELETE /api/push/subscribe`

**Auth:** User

**Request body** (`.strict()`)

```json
{ "endpoint": "https://..." }
```

**Success response (`200 OK`)**

```json
{ "message": "Subscription removed" }
```

Disables push preferences when no subscriptions remain.

**Cron sender:** `functions/api/cron/push-reminders.ts`

---

## Questions

### `POST /api/questions/custom-session`

**Auth:** User

**Request body** (`.strict()` on config and body)

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

Filter arrays: max 50 entries, each 1–100 chars. `count`: int 1–50 (default 10).

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
      "difficulty": 50
    }
  ],
  "totalAvailable": 0,
  "warning": "string (optional)"
}
```

**Notes:** No FSRS or progress writes. Questions filtered through `withProductionQuestionSafety()`. Use the Cloudflare Pages local dev server for testing (Express legacy server is retired).

---

## Reviews

### `POST /api/reviews/second-chance`

**Auth:** User

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

`count`: int 1–25 (default 10).

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "conditionId": "string",
      "system": "string",
      "subdomain": "string",
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
```

**Empty state:** `{ "selections": [], "message": "No items due for second-chance review." }`

---

## User — FSRS

### `GET /api/user/fsrs-params`

**Auth:** User (300 req/min)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "params": {
    "w": [],
    "sampleSize": 0,
    "lastOptimizedAt": "ISO-8601 | null",
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

Returns canonical `defaultParameters.w` when no personalized params exist or stored params are off-scale (legacy optimizer).

**Error responses:** `404` (user not found), `500`

---

### `POST /api/user/fsrs-params`

**Auth:** User (30 req/min — heavy optimization)

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

**Skipped (`200 OK`):** `{ "success": false, "skipped": true, "reason": "...", "hoursSinceOptimization": 0, "reviewsSinceOptimization": 0 }`

**Error responses:** `400` (insufficient reviews), `404`, `500`

**Notes:** Optimization runs server-side only. Review history filtered to `review_type: 'real'` and `sessionType ∈ {MAIN, DRILL}`. May use `FSRS_OPTIMIZER_URL` sidecar when configured.

---

## Users — Daily Plan

### `GET /api/users/me/daily-plan`

**Auth:** User (30 req/min)

**Query params:** `date` (optional ISO date string; invalid dates fall back to today)

**Success response (`200 OK`)**

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

Creates the plan on first access via `getOrCreateDailyStudyPlan()`.

---

### `POST /api/users/me/daily-plan`

**Auth:** User (30 req/min)

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
    "linkedSessionId": "string (optional, max 128)",
    "rescheduleDate": "string (optional)"
  }
}
```

`accuracy` is a 0–1 decimal. `durationMinutes` clamped 0–1440.

**Success response (`200 OK`)**

Same shape as `GET` (`formatPlanResponse`).

**Error responses:** `400` (invalid action), `500`

---

## Related Docs

- [FSRS v6 Quick Reference](../FSRS_V6_QUICK_REFERENCE.md) — implicit rating pipeline (no self-rated buttons)
- [Security Hardening Report](../security-hardening-report.md) — validation and dependency posture
- [Implementation Expansion Pass Report](../implementation-expansion-pass-report.md) — change log for this pass

**Last updated:** 2026-07-10
