# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** 2026-07-10 — validation-hardening pass on study-loop, drill, feedback, push, and analytics mutation endpoints. All listed mutation routes use Zod `.strict()` schemas (unknown fields rejected) with bounded string/array lengths.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP-note grading analytics for a case. |
| GET | `/api/drills/lab-cases` | Returns lab-interpretation cases for Mini Lab Drill. |
| POST | `/api/drills/lab-cases` | Returns the sorted list of unique lab-case diagnoses. |
| POST | `/api/feedback/submit` | Submits authenticated question feedback / flag records. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription. |
| POST | `/api/questions/custom-session` | Builds an ephemeral custom-filter study session (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review set. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card / UserTopicProgress / UserProgress. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "body": {
    "caseId": "string (1–200 chars)",
    "totalScore": 0,
    "breakdown": { "subjective": 20 }
  }
}
```

`totalScore` must be a finite number in `[0, 100000]`. `breakdown` is a string-keyed object. Unknown fields inside `body` are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation failure (`Validation failed: …`)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.
- Schema export: `SoapNoteSchema` in `functions/api/analytics/soap-note.ts`.

---

### `GET /api/drills/lab-cases`

**Auth:** Required (`authenticatedEndpoint`)

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `category` | string | — | Optional; max 50 chars. Filter by inferred category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or `random`). |
| `limit` | integer | `20` | Clamped to `1–100`. |
| `shuffle` | boolean | `true` | Pass `shuffle=false` to preserve DB order. |

**Success response (`200 OK`)**

```json
{
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
```

**Error responses**

- `400` → validation failure
- `500` → `{ "success": false, "error": "Failed to fetch lab cases. Please try again." }` (generic; raw DB errors are never leaked)

**Notes**

- Transforms `LabCase` DB rows into the frontend `LabCase` interface.
- Schema: `labCasesQuerySchema` in `functions/api/_shared/zodSchemas.ts`.

---

### `POST /api/drills/lab-cases`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "action": "getDiagnoses"
}
```

**Success response (`200 OK`)**

```json
{
  "success": true,
  "diagnoses": ["Acute kidney injury", "Iron deficiency anemia"]
}
```

**Error responses**

- `400` → `{ "error": "Invalid action" }` for unsupported actions
- `500` → `{ "success": false, "error": "Request failed. Please try again." }`

**Notes**

- Schema: `labCasesActionSchema` (`action: "getDiagnoses"` only).

---

### `POST /api/feedback/submit`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

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

Unknown fields inside `body` are rejected (`.strict()`).

**Success response (`201 Created`)**

```json
{
  "success": true,
  "feedbackId": "flag-1234567890-abc123"
}
```

**Error responses**

- `400` → validation failure
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- Creates a `QuestionFlag` with `status: "pending"`. `incorrect_fact` flags get `priority: "high"`.
- Schema export: `FeedbackSubmitSchema` in `functions/api/feedback/submit.ts`.

---

### `POST /api/push/subscribe`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

Unknown top-level or nested fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "message": "Subscription stored"
}
```

**Notes**

- Upserts `PushSubscription` and sets `UserPreferences.pushNotifications = true`.
- Schema export: `subscribeSchema` in `functions/api/push/subscribe.ts`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc (URL, max 2048 chars)"
}
```

**Success response (`200 OK`)**

```json
{
  "message": "Subscription removed"
}
```

**Notes**

- Deletes the matching subscription; disables `pushNotifications` when no subscriptions remain.
- Schema export: `unsubscribeSchema` in `functions/api/push/subscribe.ts`.

---

### `POST /api/questions/custom-session`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

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

Filter arrays are capped at 50 entries; each entry is `1–100` chars. `count` is an integer `1–50` (defaults to 10). Unknown fields on `config` or `body` are rejected (`.strict()`).

**Success response (`200 OK`)**

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
      "system": "string",
      "subcategory": "string",
      "conditionId": "string",
      "condition": "Unknown",
      "pearls": [],
      "focusArea": null,
      "difficulty": 50
    }
  ],
  "totalAvailable": 120,
  "warning": "Only 3 questions available matching your filters. Consider broadening your selection."
}
```

`warning` is omitted when enough questions are returned.

**Error responses**

- `400` → validation failure
- `500` → `{ "error": "Failed to fetch custom session questions" }`

**Notes**

- Applies `withProductionQuestionSafety` — only approved, active questions are served.
- No FSRS / progress writes; ephemeral session only.
- Schema export: `CustomSessionSchema` in `functions/api/questions/custom-session.ts`.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (`authenticatedEndpoint`)

**Request body**

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

All fields optional. Defaults: `count = 10` (range `1–25`), `examType = "PANCE"`. `scopeFilter.system` max 100 chars; `scopeFilter.conditionId` max 200 chars. Unknown fields at any level are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {
        "conditionId": "string",
        "weakestTaskType": "diagnosis",
        "allSubdomains": []
      },
      "isVariant": true,
      "isSecondChance": false,
      "recognitionRisk": 0.42,
      "selectionMethod": "unused_variant",
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
    "withVariants": 6,
    "withSecondChance": 2,
    "examType": "PANCE"
  }
}
```

When nothing is due:

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

**Error responses**

- `400` → validation failure
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Schema export: `SecondChanceRequestSchema` in `functions/api/reviews/second-chance.ts`.

---

### `GET /api/srs/due`

**Auth:** Required (`authenticatedEndpoint`)

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `100` | Parsed from string; clamped to `1–200`. |
| `progressContext` | enum | — | `READINESS` or `TARGETED` (case-insensitive). |
| `context` | enum | — | Alias for `progressContext`. |

**Success response (`200 OK`)**

```json
{
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
  "timestamp": "2026-07-10T00:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": "TARGETED",
  "suppressedDuplicates": 2
}
```

**Resilient empty response (`200 OK` on internal error)**

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-07-10T00:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Reads canonical `Card`, `UserTopicProgress`, and `UserProgress` stores (legacy `SRSItem` is deprecated).
- Card rows require linked `Question` with `lifecycleStatus = ACTIVE` and `qaStatus = APPROVED`.
- Duplicate condition/task rows are suppressed across stores.
- Never returns HTTP 500 — failures degrade to an empty payload with `error` message.
