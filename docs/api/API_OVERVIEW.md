# API Overview

This document tracks the request/response contracts for the most recently changed API routes. All authenticated endpoints require a valid Clerk session token (`Authorization: Bearer <token>`).

**Response envelope:** Successful handler results are wrapped as `{ ok: true, success: true, data: <payload>, traceId, timestamp }`. Errors use `{ success: false, code, message, traceId, timestamp }` with an appropriate HTTP status.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP-note grading analytics for the authenticated user. |
| GET | `/api/drills/lab-cases` | Returns lab cases from the database for Mini Lab Drill (transformed to frontend `LabCase` shape). |
| POST | `/api/drills/lab-cases` | Returns all unique diagnoses for lab-case autocomplete/validation. |
| POST | `/api/feedback/submit` | Submits authenticated question feedback; creates a `QuestionFlag` record. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push notifications in user preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when none remain. |
| POST | `/api/questions/custom-session` | Fetches filtered questions for an ephemeral custom study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a subdomain-level, blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 82,
    "breakdown": { "subjective": 20 }
  }
}
```

- `totalScore`: finite number, `0`–`100_000`
- `breakdown`: keyed map (`z.record`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "success": true },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Error responses**

- `500` → handler throws; envelope with internal error message

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- `userId` is resolved from the Clerk token, not from the request body.

---

### `GET /api/drills/lab-cases`

**Auth:** Required

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by inferred category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or `random`) |
| `limit` | integer | `20` | Max cases to return (`1`–`100`) |
| `shuffle` | boolean | `true` | Randomize order (`shuffle=false` to disable) |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
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
    "total": 1
  }
}
```

**Error responses**

- `500` → `{ "success": false, "error": "Failed to fetch lab cases. Please try again." }` (generic; no stack traces)

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
  "ok": true,
  "success": true,
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

**Auth:** Required

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "body": {
    "questionId": "string (1–200 chars)",
    "flagType": "incorrect_fact | unclear_question | typo | outdated | other",
    "description": "string (1–2000 chars)",
    "questionText": "string (max 5000, optional)",
    "topic": "string (max 200, optional)",
    "system": "string (max 100, optional)"
  }
}
```

**Success response (`201 Created`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "success": true,
    "feedbackId": "flag-1234567890-abc123"
  }
}
```

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- `incorrect_fact` flags are stored with `priority: high`; others use `medium`.
- All free-text fields are length-bounded before persistence to `QuestionFlag`.

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "ISO-8601"
}
```

**Notes**

- Upserts on `(userId, endpoint)`; sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription removed" }
}
```

**Notes**

- When no subscriptions remain, sets `UserPreferences.pushNotifications = false`.

---

### `POST /api/questions/custom-session`

**Auth:** Required

**Request body** (`.strict()` on `body` and `config`)

```json
{
  "body": {
    "config": {
      "systems": ["CV", "PULM"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

- Filter arrays: max 50 entries, each string `1`–`100` chars
- `count`: integer `1`–`50` (default `10`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
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
        "difficulty": 50
      }
    ],
    "totalAvailable": 120,
    "warning": "Only 5 questions available matching your filters..."
  }
}
```

**Notes**

- No FSRS tracking — questions are returned without modifying user progress.
- Questions with missing options or unresolvable `correctAnswer` are skipped.
- `warning` is present when fewer questions match than requested.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

**Request body** (`.strict()` — unknown fields rejected)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "string"
  }
}
```

- `count`: integer `1`–`25` (default `10`)
- `examType`: `PANCE` | `PANRE` | `EOR` (default `PANCE`)
- `scopeFilter.system`: max 100 chars; `scopeFilter.conditionId`: max 200 chars

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {
          "conditionId": "string",
          "taskType": "diagnosis",
          "system": "CV",
          "stability": 10,
          "difficulty": 6,
          "lapses": 1,
          "isOverdue": true,
          "priorityScore": 0.85
        },
        "isVariant": true,
        "isSecondChance": false,
        "recognitionRisk": 0.3,
        "selectionMethod": "different_question",
        "question": {
          "source": "pre_generated",
          "id": "string",
          "conditionId": "string",
          "system": "CV",
          "difficulty": 50,
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

**Empty due queue (`200 OK`)**

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

---

### `GET /api/srs/due`

**Auth:** Required

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | `100` | Max items (`1`–`200`) |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS progress partition |
| `context` | alias for `progressContext` | — | Accepted synonym |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "source": "card | user_topic_progress | user_progress",
        "questionId": "string | null",
        "questionIdentityId": "string | null",
        "conditionId": "string | null",
        "taskType": "string | null",
        "progressContext": "TARGETED",
        "dueDate": "2026-04-01T00:00:00.000Z",
        "overdueDays": 3,
        "priority": 1.8,
        "stability": 10,
        "difficulty": 6,
        "state": 2,
        "system": "CV"
      }
    ],
    "totalDue": 1,
    "timestamp": "2026-04-04T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "TARGETED",
    "suppressedDuplicates": 2
  }
}
```

**Resilient empty state (on DB error — never `500`)**

```json
{
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "ISO-8601",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Legacy `SRSItem` is deprecated; reads from Card, UserTopicProgress, and UserProgress.
- Card items require linked `Question` with `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- Duplicate suppression: broader condition-level rows are dropped when a more specific Card or UserTopicProgress row covers the same condition/context.

---

### `GET /api/admin/check-access`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

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

**Error responses**

- `403` → `{ "success": false, "hasAccess": false, "message": "Forbidden - Admin access required" }`
- `500` → `{ "error": "Internal server error", "hasAccess": false }`

**Notes**

- Access is resolved in this order: `SUPERADMIN_USER_IDS`/`ADMIN_USER_IDS` env values first, then database role lookup.

---

### `GET /api/admin/stats`

**Auth:** Required (admin-authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "data": {
    "totalUsers": 0,
    "activeUsersToday": 0,
    "totalStudySessions": 0,
    "averageAccuracy": 0,
    "popularSystems": [
      {
        "system": "string",
        "count": 0
      }
    ],
    "pendingFlags": 0
  }
}
```

**Error responses**

- `403` → `{ "error": "Admin access required" }`
- `500` → `{ "error": "Failed to fetch admin stats" }`

**Notes**

- If `DATABASE_URL` is missing, returns zeroed stats with `note: "Database not configured"`.

---

### `POST /api/osce/complete`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "string (optional)",
    "treatmentPlan": "string (optional)",
    "soapComparison": {},
    "timingAnalytics": {},
    "infographics": ["string"]
  }
}
```

**Success responses**

- `200 OK` → `{ "success": true }`
- `200 OK` (idempotent repeat) → `{ "success": true, "alreadyCompleted": true }`

**Error responses**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- Creates `CaseFile` on a best-effort basis when `soapComparison` or `timingAnalytics` is provided.
- `CaseFile` creation failure is logged but does not fail completion.

---

### `GET /api/osce/stats`

**Auth:** Required (authenticated endpoint)

**Request body:** None

**Success response (`200 OK`)**

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

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to load OSCE stats" }`

**Notes**

- Metrics are computed from completed `PatientEncounterSession` rows that have an `OsceResult`.
- Pass threshold is score `>= 70`.
