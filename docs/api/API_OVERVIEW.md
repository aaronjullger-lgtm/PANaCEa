# API Overview

This document tracks request/response contracts for the recently changed Cloudflare Pages Functions routes and shared API helpers.

## Response envelope

Most non-streaming Functions use the shared middleware envelope:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Errors use:

```json
{
  "ok": false,
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

The endpoint examples below describe the `data` payload unless otherwise noted.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/run` | Runs the general PANaCEa agent loop with an optional tool allow-list. |
| POST | `/api/agents/coverage-audit` | Runs blueprint and drill coverage audit tools through the agent loop. |
| POST | `/api/agents/infra-health` | Runs database integrity and FSRS health checks through the agent loop. |
| POST | `/api/agents/quality-check` | Runs content health, question quality, and condition verification tools. |
| POST | `/api/agents/verify-condition` | Verifies one medical condition by ID or name, optionally cross-referencing library search. |
| POST | `/api/cron/agent-health-check` | Runs scheduled agent health checks behind the cron secret. |
| POST | `/api/drills/submit-reviews` | Submits a batch of review answers through the canonical drill review pipeline with per-item idempotency. |
| POST | `/api/osce/complete` | Marks an OSCE encounter complete and persists optional OSCE telemetry on the session. |
| POST | `/api/osce/evaluate` | Feature-gated SPBench evaluation for completed OSCE sessions. |
| GET | `/api/study-plan/current` | Returns or creates the current multi-day adaptive study plan window. |
| PUT | `/api/study-plan/current` | Updates study-plan settings and regenerates the current plan window. |
| POST | `/api/study-plan/progress` | Starts, completes, or skips a persisted study-plan task. |
| GET | `/api/study-plan/today` | Returns today's daily study allocation plus persisted launchable tasks. |
| POST | `/api/questions/generate` | Generates or retrieves a preview-only learner question backed by approved clinical source content. |
| POST | `/api/library/answer` | Answers a library query using retrieved reference cards and a short AI-generated answer. |
| POST | `/api/ai/generate-mnemonic` | Generates a structured medical mnemonic with semantic-cache lookup/write. |

Shared helpers changed:

- `functions/api/_shared/studyPlanService.ts` normalizes persisted plan tasks, launch routes, progress, settings, and stale-plan regeneration for `/api/study-plan/current` and `/api/study-plan/progress`.
- `functions/api/_shared/semantic-cache.ts` is a token/Jaccard cache wrapper, not vector semantic search. It is used by `/api/questions/generate`, `/api/library/answer`, and `/api/ai/generate-mnemonic`.

## Endpoint Contracts

### `POST /api/agents/run`

**Auth:** Required (`aiEndpoint`, default AI rate limit)

**Request body**

```json
{
  "message": "string (1-4000 chars)",
  "allowedTools": ["clinical_library_search"],
  "allowedCategories": ["read"],
  "maxIterations": 4,
  "model": "optional-model-name",
  "temperature": 0.2,
  "maxOutputTokens": 2048,
  "userContext": {
    "currentRotation": "optional-string",
    "examDate": "optional-string",
    "focusSystem": "optional-string"
  },
  "includeSteps": false
}
```

**Success `data`**

```json
{
  "finalText": "string",
  "stopReason": "completed",
  "iterations": 1,
  "tokensUsed": {
    "input": 0,
    "output": 0,
    "total": 0
  },
  "durationMs": 0,
  "error": {
    "code": "optional-code",
    "message": "optional-message"
  },
  "steps": []
}
```

`steps` is included only when `includeSteps` is true. Non-completed agent runs can still return `200 OK`; clients should inspect `stopReason` and optional `error`.

---

### `POST /api/agents/coverage-audit`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "action": "blueprint_coverage | drill_coverage | full_coverage",
  "system": "optional-organ-system",
  "drillType": "optional-drill-type",
  "includeSteps": false,
  "customInstruction": "optional override, max 500 chars"
}
```

**Success `data`**

```json
{
  "action": "full_coverage",
  "finalText": "string",
  "stopReason": "completed",
  "iterations": 0,
  "tokensUsed": {
    "total": 0
  },
  "durationMs": 0,
  "error": {},
  "steps": []
}
```

Uses read-only coverage tools: `blueprint_coverage_check` and `drill_coverage_check`.

---

### `POST /api/agents/infra-health`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "action": "db_integrity | fsrs_health | full_health",
  "userId": "optional-internal-user-id-for-fsrs-health",
  "includeSteps": false,
  "customInstruction": "optional override, max 500 chars"
}
```

**Success `data`**

```json
{
  "action": "full_health",
  "finalText": "string",
  "stopReason": "completed",
  "iterations": 0,
  "tokensUsed": {
    "total": 0
  },
  "durationMs": 0,
  "error": {},
  "steps": []
}
```

Uses read-only infrastructure tools: `database_integrity_check` and `fsrs_calibration_status`.

---

### `POST /api/agents/quality-check`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "action": "audit_all | check_question | verify_condition | scan_quality",
  "targetId": "optional-question-or-condition-id",
  "targetName": "optional-condition-name",
  "system": "optional-organ-system",
  "includeSteps": false,
  "customInstruction": "optional override, max 500 chars"
}
```

**Success `data`**

```json
{
  "action": "audit_all",
  "finalText": "string",
  "stopReason": "completed",
  "iterations": 0,
  "tokensUsed": {
    "total": 0
  },
  "durationMs": 0,
  "error": {},
  "steps": []
}
```

Uses read-only quality tools: `content_health_audit`, `question_quality_check`, and `condition_verify`.

---

### `POST /api/agents/verify-condition`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "conditionId": "optional-condition-id",
  "conditionName": "optional-condition-name",
  "crossReference": false,
  "includeSteps": false,
  "customInstruction": "optional override, max 500 chars"
}
```

Either `conditionId` or `conditionName` is required.

**Success `data`**

```json
{
  "conditionId": "optional-condition-id",
  "conditionName": "optional-condition-name",
  "crossReferenced": false,
  "finalText": "string",
  "stopReason": "completed",
  "iterations": 0,
  "tokensUsed": {
    "total": 0
  },
  "durationMs": 0,
  "error": {},
  "steps": []
}
```

When `crossReference` is true, the endpoint also permits `clinical_library_search`.

---

### `POST /api/cron/agent-health-check`

**Auth:** Required cron bearer secret (`CRON_SECRET`)

**Request body:** None

**Success `data`**

```json
{
  "checkedAt": "2026-01-01T00:00:00.000Z",
  "totalDurationMs": 0,
  "checksRun": 3,
  "ok": 3,
  "warnings": 0,
  "errors": 0,
  "details": [
    {
      "check": "database_integrity",
      "status": "ok",
      "finalText": "string",
      "tokensUsed": 0,
      "durationMs": 0,
      "error": "optional-error"
    }
  ]
}
```

Runs database integrity, FSRS calibration, and content health checks sequentially. A fatal cron failure returns `500` with `Agent health check failed`.

---

### `POST /api/drills/submit-reviews`

**Auth:** Required (`authenticatedEndpoint`, 60 requests/minute)

**Request body**

An array of singular drill-review payloads matching `DrillSubmitReviewSchema`.

```json
[
  {
    "questionId": "string",
    "canonicalQuestionId": "optional-string",
    "sourceQuestionId": "optional-string",
    "questionSource": "optional-string",
    "medicalContentId": "optional-string",
    "selectedAnswer": "A",
    "timeSpentMs": 12000,
    "timeToFirstClick": 2500,
    "answerSwitches": 1,
    "totalDwellTime": 11500,
    "timezone": "America/New_York",
    "wakeTimeHHMM": "07:00",
    "telemetry": {
      "session_id": "optional-reservoir-session-id",
      "urgency_multiplier": 1
    },
    "sessionType": "main",
    "idempotencyKey": "string"
  }
]
```

**Success `data`**

```json
[
  {
    "questionId": "string",
    "success": true,
    "data": {
      "isCorrect": true,
      "fsrsSchedule": {}
    },
    "source": "question"
  },
  {
    "questionId": "string",
    "success": false,
    "error": "Question not found",
    "source": "missing"
  }
]
```

Per-item idempotency outcomes:

- Completed duplicate: `{ "success": true, "source": "idempotent-store", "data": {} }`
- In-progress duplicate: `{ "success": false, "source": "idempotent-in-progress", "retryAfterSeconds": 5 }`

If `telemetry.session_id` is present on a successful item, the reservoir item is marked consumed. Reservoir consumption and KV idempotency cache writes are non-fatal.

---

### `POST /api/osce/complete`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "optional-string",
    "treatmentPlan": "optional-string",
    "osceTelemetry": {
      "totalTimeMs": 0,
      "clinicalConfidenceIndex": 3,
      "redFlagsMissed": 0,
      "unnecessaryOrders": 0,
      "implicitRating": {
        "rating": 1,
        "confidence": 0.8,
        "components": {
          "efficiency": 0.7
        }
      },
      "efficiencyScore": 0.9,
      "speechMetrics": {},
      "diagnosticEfficiency": {},
      "rapportMetrics": {},
      "actionCount": 12
    }
  }
}
```

**Success `data`**

```json
{
  "success": true
}
```

`alreadyCompleted` is only present on idempotent repeats. This endpoint updates `PatientEncounterSession` (`status`, diagnosis, treatment plan, `completedAt`, optional `osceTelemetry`) and does not create `CaseFile`, `ReviewLog`, cards, or FSRS state.

**Error responses**

- `404` when the authenticated user or owned session cannot be found.
- `500` for unexpected completion failures.

---

### `POST /api/osce/evaluate`

**Auth:** Required (`authenticatedEndpoint`)

**Feature flag:** `ENABLE_OSCE_BETA` must be enabled.

**Request body**

```json
{
  "body": {
    "sessionId": "string"
  }
}
```

**Success `data`**

```json
{
  "success": true,
  "cached": false,
  "scores": {
    "QC": 0,
    "CC": 0,
    "CD": 0,
    "RC": 0,
    "LC": 0,
    "LN": 0,
    "CS": 0,
    "PD": 0,
    "overall": 0
  },
  "justification": "string"
}
```

Returns `cached: true` when an existing `SpbenchScore` is found. Gateway failures can return `429`, `422`, or `502`; missing user/session returns `404`.

---

### `GET /api/study-plan/current`

**Auth:** Required (`authenticatedEndpoint`, query validation)

**Query params**

| Param | Type | Notes |
|---|---|---|
| `days` | integer, 1-14 | Optional plan window length. Defaults to 7. |

**Success `data`**

```json
{
  "state": "ready",
  "target": {
    "kind": "pance",
    "label": "PANCE",
    "examDate": "2026-01-01T00:00:00.000Z",
    "currentRotation": null
  },
  "settings": {
    "dailyMinutesLimit": 60,
    "dailyQuestionGoal": 30,
    "preferredDays": [1, 2, 3, 4, 5],
    "focusAreas": [],
    "excludeAreas": [],
    "targetRetention": 0.9,
    "maxSessionsPerDay": 2,
    "planRefreshHours": 12
  },
  "days": [],
  "today": null,
  "overview": {
    "totalDays": 0,
    "completedDays": 0,
    "inProgressDays": 0,
    "pendingDays": 0,
    "completionPercent": 0,
    "totalTargetQuestions": 0,
    "totalCompletedQuestions": 0
  },
  "generatedAt": "2026-01-01T00:00:00.000Z"
}
```

`state` is `ready`, `needs-target`, or `empty`.

---

### `PUT /api/study-plan/current`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "days": 7,
    "forceRegenerate": true,
    "settings": {
      "dailyMinutesLimit": 60,
      "dailyQuestionGoal": 30,
      "preferredDays": [1, 2, 3, 4, 5],
      "focusAreas": ["Cardiovascular"],
      "excludeAreas": [],
      "targetRetention": 0.9,
      "maxSessionsPerDay": 2
    }
  }
}
```

**Success `data`:** Same shape as `GET /api/study-plan/current`.

Supplying `settings` persists them under `UserPreferences.customSettings.studyPlanning` and forces regeneration.

---

### `POST /api/study-plan/progress`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "planDate": "2026-01-01",
    "taskId": "2026-01-01:main:cardiovascular",
    "action": "start | complete | skip",
    "actualQuestionsAnswered": 20,
    "actualDurationMinutes": 25,
    "actualAccuracy": 0.85,
    "linkedSessionId": "optional-session-id"
  }
}
```

**Success `data`**

A single updated `StudyPlanDay`:

```json
{
  "id": "string",
  "planDate": "2026-01-01",
  "status": "in_progress",
  "title": "Plan for 2026-01-01",
  "summary": "Focus on Cardiovascular.",
  "recommendedModes": ["core_adaptive"],
  "targetSystemFocus": ["Cardiovascular"],
  "targetQuestionsCount": 30,
  "estimatedTimeMinutes": 45,
  "progress": {
    "questionsAnswered": 20,
    "questionsTarget": 30,
    "percentComplete": 67,
    "durationMinutes": 25,
    "estimatedDurationMinutes": 45,
    "accuracy": 85
  },
  "tasks": [],
  "completedAt": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Throws a structured error if the plan day or task does not exist.

---

### `GET /api/study-plan/today`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success `data`**

Returns `DailyStudyAllocation` plus persisted plan metadata:

```json
{
  "mainMinutes": 36,
  "targetedMinutes": 24,
  "mainQuestions": 18,
  "targetedQuestions": 12,
  "mainSystems": ["Cardiovascular"],
  "targetedConditions": ["condition-id"],
  "planId": "string",
  "planDate": "2026-01-01",
  "status": "pending",
  "progress": {
    "questionsAnswered": 0,
    "questionsTarget": 30,
    "percentComplete": 0
  },
  "tasks": []
}
```

This compatibility endpoint still combines the daily allocator with the persisted `DailyStudyPlan` row.

---

### `POST /api/questions/generate`

**Auth:** Required (`aiEndpoint`, default AI rate limit)

**Request body**

```json
{
  "queryText": "heart failure",
  "questionType": "mcq",
  "system": "Cardiovascular",
  "difficulty": "medium"
}
```

**Success `data`**

```json
{
  "success": true,
  "question": {
    "id": "string",
    "type": "mcq",
    "system": "Cardiovascular",
    "difficulty": "medium",
    "metadata": {
      "submissionReady": false,
      "requiresApproval": true,
      "cached": false
    }
  },
  "cached": false,
  "similarity": 0.92
}
```

`similarity` is present only for cache hits. Generated and staging-returned items are preview-only/non-submittable until approval.

**Error responses**

- `404` when no approved clinical source content can be resolved.
- `502` when generation fails or a generated item cannot be staged.

---

### `POST /api/library/answer`

**Auth:** Required (`aiEndpoint`)

**Request body**

```json
{
  "query": "What is first-line treatment for community-acquired pneumonia?",
  "topK": 3
}
```

**Success `data`**

```json
{
  "answer": "string or null",
  "results": [
    {
      "id": "string",
      "condition": "string",
      "conditionId": "string",
      "system": "string",
      "subcategory": "string",
      "overview": "string",
      "first_line_rx": "string",
      "gold_standard_dx": "string",
      "symptoms": "string",
      "treatment": "string",
      "best_initial_test": "string",
      "similarity": 0.78
    }
  ],
  "count": 1,
  "message": "optional-message"
}
```

No-match responses return `answer: null`, `results: []`, and a message. Cache-hit responses return the cached data payload with `Cache-Control: private, max-age=300`; generated responses use `private, max-age=60`.

---

### `POST /api/ai/generate-mnemonic`

**Auth:** Required (`aiEndpoint`, 30 requests/minute)

**Request body**

```json
{
  "concept": "Wolff-Parkinson-White",
  "context": "Cardiology",
  "existingMnemonics": ["optional previous mnemonic"]
}
```

**Success `data`**

```json
{
  "mnemonic": "string",
  "explanation": "string",
  "type": "acronym | story | visual | rhyme"
}
```

Semantic-cache hits return the same shape. Gateway failures can return `429`, `400` for safety blocks, or `502`.
