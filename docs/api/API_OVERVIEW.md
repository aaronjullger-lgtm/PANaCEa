# API Overview

This document tracks request/response contracts for the most recently changed API surface.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/authors/submit-question` | Authenticated content-author submission endpoint with condition validation and AI-assisted quality metadata. |

## Endpoint Contracts

### `POST /api/authors/submit-question`

**Auth:** Required (authenticated user via `requireAuth`)

**Request body**

```json
{
  "question": "What is the gold standard diagnostic test for acute myocardial infarction?",
  "options": [
    "ECG only",
    "Troponin only",
    "ECG and serial troponin",
    "Coronary angiography"
  ],
  "correctAnswer": 2,
  "explanation": "Serial troponin with ECG changes confirms AMI diagnosis.",
  "system": "Cardiovascular",
  "conditionId": "cond_cardio_001",
  "vignette": "A 65-year-old male with chest pain...",
  "difficulty": "medium"
}
```

**Validation rules**

- Required fields: `question`, `options`, `correctAnswer`, `explanation`, `system`, `conditionId`
- `options` must contain **4-5** choices
- `correctAnswer` is a **0-based index** and must be within the `options` bounds
- `conditionId` must exist
- `system` must match the referenced condition's system

**Success response (`201 Created`)**

```json
{
  "submissionId": "sub_test_001",
  "message": "Question submitted and queued for reviewer approval.",
  "validationResults": {
    "isDuplicate": false,
    "coversGap": true,
    "estimatedDifficulty": 0.65,
    "estimatedHealthScore": 0.75
  }
}
```

`validationResults` may also include:

```json
{
  "duplicateOf": {
    "id": "existing_q_123",
    "question": "Similar question"
  }
}
```

**Error responses**

- `401` → unauthorized user
- `400` → input validation failure (missing fields, invalid options length, invalid `correctAnswer`, or system mismatch)
- `404` → `{ "error": "Condition not found" }`
- `500` → server-side failure (including AI validation timeout/failure paths)

**Notes**

- If the authenticated user has no `ContentAuthor` row, one is created automatically.
- The endpoint accepts submissions even when flagged as a potential duplicate; duplicate status is returned in `validationResults`.
- `questionsCreated` is incremented atomically with Prisma's `increment: 1` to avoid race conditions.
- Response messaging varies by AI validation outcome:
  - potential duplicate → includes "flagged as potential duplicate"
  - blueprint-gap match → includes "Expedited review recommended"
  - otherwise → includes "queued for reviewer approval"
