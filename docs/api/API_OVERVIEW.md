# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics/learner-analysis` | Returns learner cluster assignment, early warnings, and composite risk score. |
| GET | `/api/analytics/readiness-projection` | Returns FSRS-based exam readiness projection with per-system breakdown and confidence intervals. |
| POST | `/api/analytics/soap-note` | Persists SOAP note grading analytics for OSCE sessions. |
| GET | `/api/drills/lab-cases` | Returns lab cases from the database for Mini Lab Drill mode. |
| POST | `/api/drills/lab-cases` | Returns unique diagnoses list for lab-case autocomplete/validation. |
| POST | `/api/feedback/submit` | Submits authenticated user feedback about a question (creates `QuestionFlag`). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription. |
| POST | `/api/questions/custom-session` | Fetches filtered questions for ephemeral custom study sessions (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |

## Endpoint Contracts

### `GET /api/analytics/learner-analysis`

**Auth:** Required (authenticated endpoint)

**Query params:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "cluster": {
      "archetype": "CONSISTENT_REVIEWER",
      "confidence": 0.82,
      "distances": {
        "CONSISTENT_REVIEWER": 0.12,
        "CRAMMER": 0.45,
        "PERFECTIONIST": 0.38,
        "DISENGAGING": 0.91,
        "SPRINTER": 0.55,
        "EXPLORER": 0.67
      }
    },
    "warnings": [
      {
        "type": "accuracy_decline",
        "message": "string",
        "severity": "warning",
        "value": 0.08,
        "threshold": 0.05,
        "recommendation": "string"
      }
    ],
    "riskScore": 0.35,
    "features": {
      "dailyVolume": 0.4,
      "volumeVariability": 0.2,
      "accuracy": 0.72,
      "relativeSpeed": 0.5,
      "spacingRegularity": 0.6,
      "systemBreadth": 0.45,
      "systemDepth": 0.3,
      "engagementTrend": 0.55,
      "calibrationScore": 0.6,
      "sessionCompletionRate": 0.8
    },
    "metadata": {
      "attemptsSampled": 150,
      "sessionsSampled": 12,
      "systemsCovered": 8,
      "totalSystems": 12
    }
  }
}
```

`archetype` is one of: `CONSISTENT_REVIEWER`, `CRAMMER`, `PERFECTIONIST`, `DISENGAGING`, `SPRINTER`, `EXPLORER`.

`warnings[].type` is one of: `accuracy_decline`, `session_frequency_drop`, `burnout_trajectory`, `exam_readiness_gap`, `system_neglect`, `speed_regression`, `engagement_cliff`.

`warnings[].severity` is one of: `info`, `warning`, `critical`.

**Error responses**

- `404` → `{ "error": "User not found — account may not be synced yet" }`
- `500` → `{ "error": "Learner analysis failed. Please try again." }`

**Notes**

- Clerk user ID is resolved to internal `User.id` before querying attempts, sessions, and progress.
- Samples up to 200 recent `QuestionAttempt` rows and 30 days of `DrillSessionRecord` data.

---

### `GET /api/analytics/readiness-projection`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `examDate` | `YYYY-MM-DD` | No | Target exam date for forward projection |

**Success response (`200 OK`)**

```json
{
  "data": {
    "overallReadiness": 0.68,
    "projectedAtExam": 0.72,
    "confidenceInterval": [0.61, 0.75],
    "estimatedScoreRange": [610, 660],
    "systems": [],
    "riskLevel": "moderate",
    "criticalSystems": [],
    "daysUntilExam": 45,
    "projectedAt": "2026-07-10T00:00:00.000Z",
    "earlyWarnings": [],
    "decliningSystems": [],
    "plateauingSystems": [],
    "acceleratingSystems": []
  }
}
```

`riskLevel` is one of: `low`, `moderate`, `high`, `critical`.

**Empty-state response (`200 OK`)**

When the user has no `READINESS` progress records:

```json
{
  "data": {
    "message": "No study data found. Start studying to see readiness projections.",
    "overallReadiness": 0,
    "projectedAtExam": 0,
    "systems": [],
    "riskLevel": "critical"
  }
}
```

**Error responses**

- `404` → user not synced yet (returns zeroed projection with `meta.status: "user_not_synced"`)
- `500` → `{ "error": "Readiness projection failed. Please try again." }`

**Notes**

- Reads `UserProgress` rows with `progressContext: 'READINESS'`.
- Response is cached with `Cache-Control: private, max-age=300`.
- Requires `DATABASE_URL`.

---

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 82,
    "breakdown": {
      "subjective": 20,
      "objective": 22
    }
  }
}
```

`totalScore` must be a finite number in `[0, 100000]`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true
  }
}
```

**Error responses**

- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- Validation rejects `NaN`/`Infinity` scores and oversized `caseId` values.

---

### `GET /api/drills/lab-cases`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or omit for all) |
| `limit` | integer 1–100 | `20` | Max cases to return |
| `shuffle` | boolean string | `true` | Set to `false` to preserve DB order |

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "cases": [
      {
        "id": "string",
        "clinicalContext": "string",
        "patientAge": 54,
        "patientSex": "F",
        "panels": [
          {
            "name": "Complete Blood Count",
            "values": [
              {
                "name": "Hemoglobin",
                "value": "9.5",
                "unit": "g/dL",
                "referenceRange": "12.0-16.0",
                "isAbnormal": true,
                "isCritical": false,
                "abnormalDirection": "low"
              }
            ]
          }
        ],
        "correctDiagnosis": "string",
        "keyFindings": ["string"],
        "explanation": "string",
        "category": "hematology"
      }
    ],
    "total": 10
  }
}
```

**Error responses**

- `500` → `{ "success": false, "error": "Failed to fetch lab cases. Please try again." }` (no internal error detail leaked)

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
    "diagnoses": ["Anemia of chronic disease", "Iron deficiency anemia"]
  }
}
```

**Error responses**

- `400` → `{ "error": "Invalid action" }`
- `500` → `{ "success": false, "error": "Request failed. Please try again." }`

---

### `POST /api/feedback/submit`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "questionId": "string (1–200 chars)",
    "flagType": "incorrect_fact",
    "description": "string (1–2000 chars)",
    "questionText": "string (max 5000, optional)",
    "topic": "string (max 200, optional)",
    "system": "string (max 100, optional)"
  }
}
```

`flagType` is one of: `incorrect_fact`, `unclear_question`, `typo`, `outdated`, `other`.

**Success response (`201 Created`)**

```json
{
  "data": {
    "success": true,
    "feedbackId": "flag-1710000000000-abc123"
  }
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- Creates a `QuestionFlag` row with `status: 'pending'`.
- `incorrect_fact` flags receive `priority: 'high'`; others default to `medium`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "message": "Subscription stored"
  }
}
```

**Notes**

- Upserts `PushSubscription` and sets `UserPreferences.pushNotifications: true`.
- `endpoint` must be a valid URL (max 2048 chars).

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Success response (`200 OK`)**

```json
{
  "data": {
    "message": "Subscription removed"
  }
}
```

**Notes**

- Removes the matching subscription; disables `pushNotifications` when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` on both `body` and `config`)

```json
{
  "body": {
    "config": {
      "systems": ["CV", "PULM"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "harder"
    },
    "count": 10
  }
}
```

| Field | Constraints |
|---|---|
| Filter arrays (`systems`, `subcategories`, `conditions`, `focusAreas`) | Max 50 entries; each string 1–100 chars |
| `difficulty` | `same`, `easier`, or `harder` (optional) |
| `count` | Integer 1–50 (default 10) |

**Success response (`200 OK`)**

```json
{
  "data": {
    "questions": [
      {
        "id": "string",
        "question": "string",
        "options": ["A", "B", "C", "D"],
        "correctAnswerIndex": 2,
        "rationale": "string",
        "topic": "string",
        "system": "CV",
        "subcategory": "string",
        "conditionId": "string",
        "condition": "Unknown",
        "pearls": [],
        "focusArea": null,
        "difficulty": 55
      }
    ],
    "totalAvailable": 142,
    "warning": "Only 3 questions available matching your filters. Consider broadening your selection."
  }
}
```

**Error responses**

- `500` → `{ "error": "Failed to fetch custom session questions" }`

**Notes**

- Does **not** modify FSRS or user progress.
- Questions without valid options or unresolvable `correctAnswer` are skipped.
- `subcategories` maps to the `Question.category` column.
- Only production-safe questions are returned (`withProductionQuestionSafety`).

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body** (`.strict()` — unknown fields rejected; defaults applied when omitted)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "cond-123"
  }
}
```

| Field | Constraints |
|---|---|
| `count` | Integer 1–25 (default 10) |
| `examType` | `PANCE`, `PANRE`, or `EOR` (default `PANCE`) |
| `scopeFilter.system` | Max 100 chars (optional) |
| `scopeFilter.conditionId` | Max 200 chars (optional) |

**Success response (`200 OK`)**

```json
{
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {
          "conditionId": "string",
          "taskType": "diagnosis",
          "system": "CV",
          "stability": 2.5,
          "difficulty": 5.0,
          "lapses": 1,
          "isOverdue": true,
          "priorityScore": 0.82
        },
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0.15,
        "selectionMethod": "unused_variant",
        "question": {
          "source": "pre_generated",
          "id": "string",
          "conditionId": "string",
          "system": "CV",
          "difficulty": 55,
          "questionType": "mcq",
          "questionData": {}
        }
      }
    ],
    "meta": {
      "total": 10,
      "withVariants": 7,
      "withSecondChance": 2,
      "examType": "PANCE"
    }
  }
}
```

`selectionMethod` is one of: `unused_variant`, `different_question`, `cross_task_fallback`, `canonical_fallback`.

**Empty-state response (`200 OK`)**

```json
{
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Hydrates question content from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer string | `100` | Max items to return (clamped 1–200) |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS partition |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext` |

**Success response (`200 OK`)**

```json
{
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card",
        "questionId": "string",
        "questionIdentityId": "string",
        "conditionId": "string",
        "taskType": "diagnosis",
        "progressContext": "READINESS",
        "dueDate": "2026-04-01T12:00:00.000Z",
        "overdueDays": 6,
        "priority": 1.8,
        "stability": 2.5,
        "difficulty": 5.0,
        "state": "Review",
        "system": "CV"
      }
    ],
    "totalDue": 12,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": null,
    "suppressedDuplicates": 3
  }
}
```

`source` per item is one of: `card`, `user_topic_progress`, `user_progress`.

**Degraded response (`200 OK`, never `500`)**

On internal errors, returns an empty queue instead of throwing:

```json
{
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Legacy `SRSItem` is deprecated; this compatibility endpoint reads canonical `Card`, `UserTopicProgress`, and `UserProgress` stores.
- Card-linked questions must have `lifecycleStatus: 'ACTIVE'` and `qaStatus: 'APPROVED'`.
- Duplicate suppression prefers Card rows over topic/condition progress for the same condition/task.
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`.
