# API Overview

This document tracks the request/response contracts for the most recently changed API routes (validation hardening pass, July 2026).

All successful responses use the unified envelope from `functions/api/_shared/api-response.ts`:

```json
{
  "ok": true,
  "success": true,
  "data": {},
  "traceId": "string",
  "timestamp": "2026-07-10T00:00:00.000Z"
}
```

Errors use `{ "ok": false, "error": { "code", "message", "details?" }, "traceId", "timestamp" }`.

---

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/analytics/soap-note` | Persists OSCE SOAP note grading analytics for a case. |
| GET | `/api/drills/lab-cases` | Returns transformed lab cases for the Mini Lab drill. |
| POST | `/api/drills/lab-cases` | Returns unique diagnoses for lab-case autocomplete (`getDiagnoses`). |
| POST | `/api/feedback/submit` | Submits authenticated question feedback as a `QuestionFlag`. |
| POST | `/api/push/subscribe` | Stores a Web Push subscription and enables push preferences. |
| DELETE | `/api/push/subscribe` | Removes a Web Push subscription; disables push when none remain. |
| POST | `/api/questions/custom-session` | Fetches filtered practice questions for ephemeral custom study (no FSRS writes). |
| POST | `/api/reviews/second-chance` | Builds a blueprint-weighted second-chance review session from due concepts. |
| GET | `/api/srs/due` | Returns canonical FSRS due items from Card / UserTopicProgress / UserProgress. |

---

## Endpoint Contracts

### `POST /api/analytics/soap-note`

**Auth:** Required (`authenticatedEndpoint`)

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

- `totalScore`: finite number, `0`–`100000`
- `breakdown`: keyed map (`z.record(z.string(), z.unknown())`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": { "success": true }
}
```

**Error responses**

- `400` — validation failure (empty/oversized `caseId`, non-finite `totalScore`, unknown fields)
- `500` — `{ "error": "Failed to store SOAP grading analytics" }`

**Notes**

- Persists to `SoapNoteGradingEvent` when the model exists; otherwise logs and returns success (graceful degradation).
- `userId` is resolved from the Clerk token via `resolveUserId`.

---

### `GET /api/drills/lab-cases`

**Auth:** Required

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string (max 50) | — | Filter by inferred category (`hematology`, `metabolic`, `endocrine`, `renal`, `hepatic`, `cardiac`, or omit for all) |
| `limit` | int | `20` | `1`–`100` |
| `shuffle` | string | `true` | Pass `shuffle=false` to preserve DB order |

**Success response (`200 OK`)**

```json
{
  "ok": true,
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

- `500` — `{ "success": false, "error": "Failed to fetch lab cases. Please try again." }` (generic; no stack traces)

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
  "data": {
    "success": true,
    "diagnoses": ["Anemia of chronic disease", "Iron deficiency anemia"]
  }
}
```

**Error responses**

- `400` — `{ "error": "Invalid action" }` when `action` is not `getDiagnoses`
- `500` — `{ "success": false, "error": "Request failed. Please try again." }`

---

### `POST /api/feedback/submit`

**Auth:** Required

**Request body** (`.strict()` — all free-text fields length-bounded)

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
  "data": {
    "success": true,
    "feedbackId": "flag-1234567890-abc1234"
  }
}
```

**Error responses**

- `400` — validation failure
- `404` — `{ "error": "User not found" }`
- `500` — `{ "error": "Feedback submission failed" }`

**Notes**

- Creates a `QuestionFlag` with `status: "pending"`.
- `incorrect_fact` flags get `priority: "high"`; others default to `"medium"`.

---

### `POST /api/push/subscribe`

**Auth:** Required

**Request body** (`.strict()`)

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
  "data": { "message": "Subscription stored" }
}
```

**Notes**

- Upserts `PushSubscription` on `(userId, endpoint)`.
- Sets `UserPreferences.pushNotifications = true`.

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
  "data": { "message": "Subscription removed" }
}
```

**Notes**

- Deletes matching `PushSubscription` rows for the authenticated user.
- Sets `UserPreferences.pushNotifications = false` when no subscriptions remain.

---

### `POST /api/questions/custom-session`

**Auth:** Required

**Request body** (`.strict()` on both `config` and `body`)

```json
{
  "body": {
    "config": {
      "systems": ["CV", "PULM"],
      "subcategories": ["string (max 50 entries, each 1–100 chars)"],
      "conditions": ["conditionId"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

- Filter arrays: max 50 entries, each string `1`–`100` chars
- `count`: optional int `1`–`50` (defaults to `10`)

**Success response (`200 OK`)**

```json
{
  "ok": true,
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

- `400` — validation failure
- `500` — `{ "error": "Failed to fetch custom session questions" }`

**Notes**

- No FSRS or progress writes — ephemeral practice only.
- Questions pass `withProductionQuestionSafety` filters.
- Invalid questions (missing options, unresolvable `correctAnswer`) are skipped server-side.

---

### `POST /api/reviews/second-chance`

**Auth:** Required

**Request body** (`.strict()` at top level and inside `scopeFilter`)

```json
{
  "count": 10,
  "examType": "PANCE",
  "scopeFilter": {
    "system": "CV",
    "conditionId": "condition-uuid"
  }
}
```

| Field | Type | Default | Constraints |
|---|---|---|---|
| `count` | int | `10` | `1`–`25` |
| `examType` | enum | `PANCE` | `PANCE`, `PANRE`, `EOR` |
| `scopeFilter.system` | string | — | max 100 chars |
| `scopeFilter.conditionId` | string | — | max 200 chars |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [
      {
        "questionId": "string",
        "learningTarget": {},
        "isVariant": true,
        "isSecondChance": true,
        "recognitionRisk": 0.72,
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
      "withSecondChance": 4,
      "examType": "PANCE"
    }
  }
}
```

**Empty due queue (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "selections": [],
    "message": "No items due for second-chance review."
  }
}
```

**Error responses**

- `400` — validation failure
- `404` — `{ "error": "User not found" }`
- `500` — `{ "error": "Failed to build second-chance session", "message": "Please try again." }`

**Notes**

- `selectionMethod`: `unused_variant`, `different_question`, `cross_task_fallback`, or `canonical_fallback`.
- Hydrates from `PreGeneratedQuestion` first, then `Question`.
- Increments `timesServed` on served pre-generated questions (fire-and-forget).

---

### `GET /api/srs/due`

**Auth:** Required

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | string (coerced int) | `100` | Clamped to `1`–`200` |
| `progressContext` | enum | — | `READINESS` or `TARGETED` |
| `context` | enum | — | Alias for `progressContext` |

**Success response (`200 OK`)**

```json
{
  "ok": true,
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
        "dueDate": "2026-07-01T00:00:00.000Z",
        "overdueDays": 9,
        "priority": 54
      }
    ],
    "totalDue": 1,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "source": "canonical_fsrs_progress",
    "progressContext": "TARGETED",
    "suppressedDuplicates": 2
  }
}
```

**Resilient empty state (`200 OK` on internal error)**

```json
{
  "ok": true,
  "data": {
    "items": [],
    "totalDue": 0,
    "timestamp": "2026-07-10T00:00:00.000Z",
    "error": "Unable to load due items. Please try again."
  }
}
```

**Notes**

- Compatibility read model over `Card`, `UserTopicProgress`, and `UserProgress` (not legacy `SRSItem`).
- Card rows require `Question.lifecycleStatus === ACTIVE` and `qaStatus === APPROVED`.
- Duplicate suppression: broader condition-level rows are dropped when a more specific Card or topic row covers the same condition/context.
- Never returns HTTP 500 to the client — errors degrade to an empty list with an `error` message in `data`.

---

## Validation Hardening (shared pattern)

The routes above use Zod `.strict()` schemas that reject unknown fields and bound string/array lengths. Exported schemas for direct testing:

| Route | Schema export |
|---|---|
| `/api/push/subscribe` | `subscribeSchema`, `unsubscribeSchema` |
| `/api/analytics/soap-note` | `SoapNoteSchema` |
| `/api/reviews/second-chance` | `SecondChanceRequestSchema` |
| `/api/feedback/submit` | `FeedbackSubmitSchema` |
| `/api/questions/custom-session` | `CustomSessionSchema` |
| `/api/drills/lab-cases` | `labCasesQuerySchema`, `labCasesActionSchema` (in `_shared/zodSchemas.ts`) |
| `/api/srs/due` | `SRSDueSchema` (inline in `due.ts`) |

Regression tests: `functions/api/__tests__/validation-hardening.test.ts`, per-route `*.test.ts` files.
