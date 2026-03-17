# API Overview

This document is the current API surface reference for recently changed OSCE endpoints.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| POST | `/api/osce/analysis/grade` | Grades a completed OSCE transcript against rubric/fallback checklist and persists `OsceResult` (+ optional `ConceptGap`). |

## Endpoint Contracts

### `POST /api/osce/complete`

**Auth:** Required (Bearer token via Clerk middleware)

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

### `POST /api/osce/analysis/grade`

**Auth:** Required (Bearer token via Clerk middleware)

**Request body**

```json
{
  "body": {
    "sessionId": "string"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "resultId": "string",
  "score": 0,
  "checklist": [
    {
      "item": "string",
      "status": "PASS",
      "feedback": "string"
    }
  ],
  "redFlagsMissed": ["string"],
  "clinicalReasoningScore": 0,
  "billingCodeSuggestion": "string",
  "softSkillsReport": {
    "empathy": { "score": 1, "feedback": "string" },
    "professionalism": { "score": 1, "feedback": "string" },
    "pacing": { "score": 1, "feedback": "string" }
  },
  "conceptGapCreated": false
}
```

**Error responses**

- `400` → `{ "error": "Session must be completed before grading" }`
- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }` or `{ "error": "Case record not found" }`
- `429` → `{ "error": "Rate limit exceeded" }` (Gemini limiter)
- `502` → `{ "error": "Grading service failed" }` or `{ "error": "Invalid grading response format" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- If no `CaseRubric` exists, the endpoint builds a fallback checklist from case `essentialQuestions` and `idealWorkup`.
- Persists/updates `OsceResult` and may create `ConceptGap` when clinical reasoning fails or red flags are missed.
