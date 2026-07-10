# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for a case. |
| GET | `/api/drills/lab-cases` | Returns transformed lab cases for the Mini Lab Drill. |
| POST | `/api/drills/lab-cases` | Returns unique diagnoses for lab-case autocomplete/validation. |
| POST | `/api/feedback/submit` | Submits authenticated question feedback as a `QuestionFlag`. |
| POST | `/api/push/subscribe` | Stores or updates a Web Push subscription for SRS reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription and disables push when none remain. |
| POST | `/api/questions/custom-session` | Fetches filtered, ephemeral study questions (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card/UserTopicProgress/UserProgress. |

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (authenticated endpoint)

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

`totalScore` must be finite and in `[0, 100000]`. `breakdown` is a string-keyed object. Unknown fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "success": true
}
```

**Error responses**

- `400` → validation failure (invalid/malformed body)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and still returns success.
- `userId` is resolved from the Clerk token.

---

### `GET /api/drills/lab-cases`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by inferred category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or `random`) |
| `limit` | int | `20` | Max cases to return (`1–100`) |
| `shuffle` | boolean | `true` | Randomize order (`shuffle=false` disables) |

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
  "total": 0
}
```

**Error responses**

- `500` → `{ "success": false, "error": "Failed to fetch lab cases. Please try again." }` (generic; no internal error detail leaked)

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
  "success": true,
  "diagnoses": ["string"]
}
```

**Error responses**

- `400` → `{ "error": "Invalid action" }`
- `500` → `{ "success": false, "error": "Request failed. Please try again." }`

---

### `POST /api/feedback/submit`

**Auth:** Required (authenticated endpoint)

**Request body**

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

Unknown fields are rejected (`.strict()`). `incorrect_fact` flags are stored with `priority: high`; others use `medium`.

**Success response (`201 Created`)**

```json
{
  "success": true,
  "feedbackId": "flag-..."
}
```

**Error responses**

- `400` → validation failure
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/... (URL, max 2048 chars)",
  "keys": {
    "p256dh": "string (1–512 chars)",
    "auth": "string (1–512 chars)"
  }
}
```

Unknown fields are rejected (`.strict()` on top-level and `keys`).

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": { "message": "Subscription stored" },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Notes**

- Upserts `PushSubscription` and sets `UserPreferences.pushNotifications = true`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

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
  "data": { "message": "Subscription removed" },
  "traceId": "string",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Notes**

- Deletes the matching subscription; disables `pushNotifications` when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required (authenticated endpoint)

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

Filter arrays are capped at 50 entries; each entry is `1–100` chars. `count` defaults to `10`, max `50`. Unknown fields are rejected (`.strict()` on body and config).

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
      "condition": "Unknown",
      "pearls": [],
      "focusArea": null,
      "difficulty": 50
    }
  ],
  "totalAvailable": 0,
  "warning": "Only N questions available matching your filters..."
}
```

**Error responses**

- `400` → validation failure
- `500` → `{ "error": "Failed to fetch custom session questions" }`

**Notes**

- No FSRS tracking; questions are filtered through production question safety predicates.
- Questions with missing/invalid options or unresolvable `correctAnswer` are skipped.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "count": 10,
  "examType": "PANCE | PANRE | EOR",
  "scopeFilter": {
    "system": "string (max 100, optional)",
    "conditionId": "string (max 200, optional)"
  }
}
```

Defaults: `count = 10` (range `1–25`), `examType = "PANCE"`. Unknown fields are rejected (`.strict()`).

**Success response (`200 OK`)**

```json
{
  "selections": [
    {
      "questionId": "string",
      "learningTarget": {},
      "isVariant": false,
      "isSecondChance": false,
      "recognitionRisk": 0,
      "selectionMethod": "unused_variant",
      "question": {
        "source": "pre_generated | main_question",
        "id": "string",
        "conditionId": "string",
        "system": "string",
        "difficulty": 50,
        "questionType": "mcq",
        "questionData": {}
      }
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

**Empty due queue (`200 OK`)**

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

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `100` | Max items (`1–200`) |
| `progressContext` | `READINESS` \| `TARGETED` | — | Filter by FSRS partition |
| `context` | `READINESS` \| `TARGETED` | — | Alias for `progressContext` |

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
      "progressContext": "READINESS",
      "dueDate": "2026-01-01T00:00:00.000Z",
      "overdueDays": 0,
      "priority": 0
    }
  ],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "source": "canonical_fsrs_progress",
  "progressContext": null,
  "suppressedDuplicates": 0
}
```

**Resilient error shape (`200 OK`)**

On unexpected failures the endpoint returns an empty queue instead of HTTP 500:

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (legacy `SRSItem` deprecated).
- Card rows require linked `Question.lifecycleStatus = ACTIVE` and `qaStatus = APPROVED`.
- Duplicate suppression: broader condition-level due rows are dropped when a more specific Card or topic row covers the same condition/context.
