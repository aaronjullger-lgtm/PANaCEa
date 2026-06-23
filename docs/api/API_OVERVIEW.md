# API Overview

This document tracks the request/response contracts for the latest changed API handlers under `functions/api/`.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/blueprint-coverage` | Returns available exam types that have blueprint targets. |
| GET | `/api/admin/blueprint-coverage/{examType}` | Returns blueprint coverage analysis for an exam type. |
| POST | `/api/admin/blueprint-coverage/{examType}/targets` | Sets blueprint target percentages for systems for an exam type. |
| GET | `/api/admin/health-report/latest` | Returns the latest content health snapshot for admins. |
| GET | `/api/admin/health-report/history?days=7` | Returns recent health-report trend data for admins. |
| GET | `/api/authors/me/dashboard` | Returns author profile metrics, submission stats, and gap suggestions. |
| POST | `/api/authors/submit-question` | Submits an authored question into review workflow. |
| POST (cron) | `/api/cron/analyze-exam-outcomes` | Computes system predictiveness from recent exam outcomes. |
| POST (cron) | `/api/cron/compute-content-health` | Recomputes content health scores and persists snapshot summary. |
| POST (cron) | `/api/cron/generate-daily-plans` | Generates/updates next-day study plans for active users. |
| POST (cron) | `/api/cron/nightly-health-check` | Builds comprehensive nightly health report with alerts. |
| GET | `/api/questions/{questionId}/context` | Returns condition/system context and learner-specific guidance for a question. |
| GET | `/api/sync` | Returns authenticated user cloud sync state. |
| POST | `/api/sync` | Merges local sync payload into cloud state with timestamp conflict resolution. |
| GET | `/api/users/me/daily-plan` | Returns (or generates) the user's daily study plan for a date. |
| POST | `/api/users/me/daily-plan` | Marks today's plan complete and stores outcome metrics. |
| POST | `/api/users/me/exam-outcome` | Records exam outcome for optimization/correlation analysis. |
| GET | `/api/users/me/exam-readiness?examType=PANCE` | Returns readiness by system, gaps, and exam-timeline metadata. |

## Endpoint Contracts

## 1) Admin endpoints

### `GET /api/admin/blueprint-coverage`

**Auth:** Required  
**Request body:** None

**200**
```json
{
  "examTypes": ["PANCE", "PANRE"]
}
```

### `GET /api/admin/blueprint-coverage/{examType}`

**Auth:** Required  
**Request body:** None

**200**
```json
{
  "examType": "PANCE",
  "totalQuestions": 1200,
  "totalApproved": 930,
  "systemCoverage": [
    {
      "system": "Cardiology",
      "targetPercent": 15,
      "actualPercent": 12.6,
      "gap": 2.4,
      "priority": "high"
    }
  ],
  "gapsByPriority": {
    "critical": 1,
    "high": 3,
    "medium": 6,
    "low": 8
  }
}
```

### `POST /api/admin/blueprint-coverage/{examType}/targets`

**Auth:** Required (`ADMIN`)  
**Body**
```json
{
  "targets": {
    "Cardiology": 0.15,
    "Pulmonology": 0.1
  }
}
```

**200**
```json
{
  "success": true,
  "examType": "PANCE",
  "targetCount": 2
}
```

### `GET /api/admin/health-report/latest`

**Auth:** Required (`ADMIN`)  
**Request body:** None

**200** returns a `contentHealthReport` row (latest snapshot).  
**404**
```json
{ "message": "No health reports available yet" }
```

### `GET /api/admin/health-report/history?days=7`

**Auth:** Required (`ADMIN`)  
**Request body:** None

**200**
```json
{
  "days": 7,
  "reportCount": 4,
  "trends": [
    {
      "timestamp": "2026-03-17T02:00:00.000Z",
      "totalContent": 3120,
      "invalidFields": 28,
      "reportData": {}
    }
  ]
}
```

## 2) Author endpoints

### `GET /api/authors/me/dashboard`

**Auth:** Required  
**Request body:** None

**200** includes:
- `author` profile block
- `statistics` (questions created/approved/active, approval rate, health score)
- `submissions` (recent + status breakdown)
- `impact` (engagement placeholders + metrics)
- `suggestedGaps` (priority systems)
- `metadata`

### `POST /api/authors/submit-question`

**Auth:** Required  
**Body**
```json
{
  "question": "string",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 1,
  "explanation": "string",
  "system": "Cardiovascular",
  "conditionId": "cond_123",
  "vignette": "optional",
  "difficulty": "easy"
}
```

**201**
```json
{
  "submissionId": "sub_123",
  "status": "submitted",
  "validationResults": {
    "isDuplicate": false,
    "duplicateOf": null,
    "coversGap": true,
    "estimatedDifficulty": "medium",
    "estimatedHealthScore": 0.81
  },
  "message": "Submission created and queued for reviewer approval."
}
```

Common errors: `400` (validation/field mismatch), `404` (condition missing).

## 3) Cron endpoints

All cron handlers require `Authorization: Bearer ...`. Missing/invalid auth returns:
```json
{ "error": "Unauthorized" }
```

### `POST /api/cron/analyze-exam-outcomes`

**200** returns:
- `success`
- `summary` (`examTypesAnalyzed`, `systemsAnalyzed`, `alertsGenerated`, `durationMs`)
- `results` keyed by exam type
- `alerts` array (`severity`, `examType`, `message`)

### `POST /api/cron/compute-content-health`

**200** returns:
- `success`
- `questionsProcessed`
- `averageHealthScore`
- `criticalIssues`
- `demoted`
- `duration_ms`
- `systemHealthSnapshot`

### `POST /api/cron/generate-daily-plans`

**200**
```json
{
  "success": true,
  "summary": {
    "timestamp": "2026-03-18T02:00:00.000Z",
    "usersProcessed": 340,
    "plansCreated": 280,
    "plansUpdated": 50,
    "planErrors": 10,
    "durationMs": 16942
  }
}
```

### `POST /api/cron/nightly-health-check`

**200** includes:
- `success`
- `reportId`
- `summary` (`systemsAnalyzed`, `unhealthyQuestions`, `alertsGenerated`, `criticalAlerts`)
- `duration_ms`

## 4) Question context endpoint

### `GET /api/questions/{questionId}/context`

**Auth:** Required  
**Request body:** None

**200** includes:
- `questionId`
- `condition` metadata (id/name/displayName/system/relatedSystems/hasContent)
- `performance` (`onCondition`, `onRelatedConditions`)
- `availableQuestions` (`forCondition`, `forSystem`)
- `relatedConditions`
- `actions.suggestedActions`

**404**
```json
{ "error": "Question not found" }
```

## 5) Sync endpoint (`/api/sync`)

### `GET /api/sync`

**Auth:** Required  
**Body:** none

**200**
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "performanceRecords": [],
    "srsItems": [],
    "savedQuestions": []
  }
}
```

### `POST /api/sync`

**Auth:** Required  
**Body**
```json
{
  "userId": "clerk_user_id",
  "performanceRecords": [],
  "srsItems": [],
  "savedQuestions": [],
  "localDeletions": {
    "q123": "2026-03-18T00:00:00.000Z",
    "q456:saved": "2026-03-18T00:05:00.000Z"
  }
}
```

`localDeletions` is optional and stores deletion timestamps used by 3-way merge logic:
- SRS key format: `{questionId}`
- saved/flagged/missed key format: `{questionId}:{type}`

**200**
```json
{
  "success": true,
  "message": "Data synced successfully",
  "data": {
    "performanceRecords": [],
    "srsItems": [],
    "savedQuestions": []
  }
}
```

Common errors: `400` validation failure, `401` auth required, `403` userId mismatch.

## 6) User outcome/planning endpoints

### `GET /api/users/me/daily-plan?date=YYYY-MM-DD`

**Auth:** Required  
Returns a normalized plan payload:
- recommendation fields (`recommendedModes`, `recommendedSessions`, targets)
- progress (`questionsAnswered`, `percentComplete`, `accuracy`, duration)
- metadata (`completedAt`, `wasEffective`, `feedbackReason`, timestamps)

If no plan exists for `date`, server generates one on demand and returns it.

### `POST /api/users/me/daily-plan`

**Auth:** Required  
**Body**
```json
{
  "accuracy": 0.86,
  "durationMinutes": 42
}
```

Marks today's plan complete (`status = completed`) and updates actual outcome metrics.

### `POST /api/users/me/exam-outcome`

**Auth:** Required  
**Body**
```json
{
  "examType": "PANCE",
  "examDate": "2026-03-17",
  "score": 82,
  "passed": true,
  "percentile": 74,
  "timeLimit": 10800,
  "timeUsed": 9800
}
```

**201**
```json
{
  "success": true,
  "outcomId": "outcome_123",
  "examType": "PANCE",
  "score": 82,
  "passed": true,
  "message": "Exam outcome recorded. System predictiveness will be updated in the next analysis run."
}
```

### `GET /api/users/me/exam-readiness?examType=PANCE`

**Auth:** Required  
**200** includes:
- `overallReadiness`, `readinessPercentage`, `daysUntilExam`
- `systemCoverage[]` (`system`, `readiness`, `targetCoverage`, `questionCount`, `status`)
- `gaps.critical[]`
- `summary`
- `metadata`

**404**
```json
{
  "error": "No phenotype available",
  "message": "User study profile has not been computed yet"
}
```
