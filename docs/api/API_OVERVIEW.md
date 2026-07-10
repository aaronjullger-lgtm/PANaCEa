# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Stores SOAP note grading analytics for OSCE sessions. |
| GET | `/api/drills/lab-cases` | Returns lab cases from the database for Mini Lab Drill mode. |
| POST | `/api/drills/lab-cases` | Returns unique diagnoses for lab-case autocomplete/validation. |
| POST | `/api/feedback/submit` | Submits authenticated user feedback about a question (creates `QuestionFlag`). |
| POST | `/api/push/subscribe` | Stores a Web Push subscription for SRS review reminders. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription. |
| POST | `/api/questions/custom-session` | Fetches questions matching custom filters for ephemeral study sessions (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session for due concepts. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card, UserTopicProgress, and UserProgress stores. |

## Validation Hardening (shared)

All endpoints in this batch use Zod `.strict()` schemas that reject unknown fields. Oversized or malformed payloads are rejected with `400` before handler logic runs. Error responses never include stack traces or internal DB details.

---

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

- `totalScore` must be finite, `0`–`100000`.
- `breakdown` is a string-keyed map of arbitrary JSON values.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "data": { "success": true }
}
```

**Error responses**

- `400` → validation failure (empty/oversized `caseId`, `NaN`/`Infinity` score, unknown fields)
- `500` → `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- `userId` is resolved from the Clerk token, not from the request body.

---

### `GET /api/drills/lab-cases`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by inferred category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or `random`) |
| `limit` | integer (1–100) | `20` | Max cases to return |
| `shuffle` | string | `true` | Set to `false` to preserve DB order |

**Success response (`200 OK`)**

```json
{
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
    "total": 0
  }
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
  "data": {
    "success": true,
    "diagnoses": ["Anemia of chronic disease", "Iron deficiency anemia"]
  }
}
```

**Error responses**

- `400` → `{ "error": "Invalid action" }` (only `getDiagnoses` is supported)
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

**Success response (`201 Created`)**

```json
{
  "success": true,
  "data": { "success": true, "feedbackId": "flag-1234567890-abc123" }
}
```

**Error responses**

- `400` → validation failure (invalid `flagType`, empty/oversized fields, unknown keys)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Feedback submission failed" }`

**Notes**

- Creates a `QuestionFlag` row with `status: "pending"`.
- `incorrect_fact` flags receive `priority: "high"`; all others get `"medium"`.

---

### `POST /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

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

**Error responses**

- `400` → validation failure (non-URL endpoint, oversized keys, unknown fields)

**Notes**

- Upserts `PushSubscription` by `(userId, endpoint)`.
- Enables `pushNotifications` in `UserPreferences`.

---

### `DELETE /api/push/subscribe`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "endpoint": "https://push.example.com/abc (URL, max 2048 chars)"
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

- Deletes the matching subscription for the authenticated user.
- Disables `pushNotifications` in preferences when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "body": {
    "config": {
      "systems": ["CV", "PULM"],
      "subcategories": ["string (max 50 entries, each 1–100 chars)"],
      "conditions": ["condition-id"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

- Filter arrays are capped at 50 entries; each string is 1–100 chars.
- `count` is optional, integer `1`–`50` (defaults to `10`).

**Success response (`200 OK`)**

```json
{
  "success": true,
  "data": {
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
}
```

**Error responses**

- `400` → validation failure (count out of range, oversized filter arrays, invalid difficulty, unknown fields)
- `500` → `{ "error": "Failed to fetch custom session questions" }`

**Notes**

- Does **not** modify FSRS state or user progress.
- Questions without valid options or resolvable `correctAnswer` are skipped.
- `subcategories` maps to the `Question.category` column.
- `warning` is present only when fewer questions are returned than requested.

---

### `POST /api/reviews/second-chance`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "Cardiovascular",
    "conditionId": "condition-uuid"
  }
}
```

- `count` — optional integer `1`–`25` (default `10`).
- `examType` — optional `PANCE | PANRE | EOR` (default `PANCE`).
- `scopeFilter` — optional; `system` max 100 chars, `conditionId` max 200 chars.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {
          "conditionId": "string",
          "taskType": "diagnosis",
          "stability": 1.2,
          "difficulty": 5.0,
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
          "system": "Cardiovascular",
          "difficulty": 50,
          "questionType": "mcq",
          "questionData": {}
        }
      }
    ],
    "meta": {
      "total": 1,
      "withVariants": 1,
      "withSecondChance": 0,
      "examType": "PANCE"
    }
  }
}
```

**Empty-state response (`200 OK`)**

```json
{
  "selections": [],
  "message": "No items due for second-chance review."
}
```

**Error responses**

- `400` → validation failure (count out of range, invalid `examType`, unknown fields)
- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- Powered by `lib/services/secondChanceEngine.ts`.
- Hydrates question content from `PreGeneratedQuestion` first, then falls back to `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required (authenticated endpoint)

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer (1–200) | `100` | Max due items to return |
| `progressContext` | `READINESS \| TARGETED` | — | Filter by FSRS partition |
| `context` | `READINESS \| TARGETED` | — | Alias for `progressContext` |

**Success response (`200 OK`)**

```json
{
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
        "progressContext": "READINESS",
        "dueDate": "2026-04-01T12:00:00.000Z",
        "overdueDays": 6,
        "priority": 1.8,
        "stability": 2.5,
        "difficulty": 5.0,
        "state": "Review",
        "system": "Cardiovascular"
      }
    ],
    "totalDue": 1,
    "timestamp": "2026-04-07T12:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": null,
    "suppressedDuplicates": 0
  }
}
```

**Degraded response (`200 OK`, never `500`)**

When the database is unavailable, the endpoint returns an empty payload instead of throwing:

```json
{
  "items": [],
  "totalDue": 0,
  "timestamp": "2026-04-07T12:00:00.000Z",
  "error": "Unable to load due items. Please try again."
}
```

**Notes**

- Reads from canonical `Card`, `UserTopicProgress`, and `UserProgress` stores (legacy `SRSItem` is deprecated).
- Card rows are filtered to `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED` linked questions only.
- Duplicate suppression: Card rows take priority over topic-level and condition-level rows for the same `(progressContext, conditionId, taskType)` key.
- Dashboard consumers depend on stable top-level keys: `items`, `totalDue`, `timestamp`.
