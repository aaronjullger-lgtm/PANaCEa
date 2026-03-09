# API Overview

This document is the current API surface reference for recently changed OSCE endpoints.

## OSCE request body convention (production)

All OSCE POST endpoints (Cloudflare Pages Functions) expect a **wrapped** body shape. The client must send:

```json
{ "body": { ... } }
```

Inner fields (e.g. `sessionId`, `caseId`, `messages`, `diagnosis`, `treatmentPlan`) go inside `body`. The client in `services/domain/osceService.ts` sends this shape for session, chat, complete, and grade.

## OSCE grade flow

1. Session must be **completed** before grading: `session.status === 'completed'`.
2. Client must call **in order**: `POST /api/osce/complete` with diagnosis/treatmentPlan, then `POST /api/osce/analysis/grade` with the same `sessionId`.
3. **Re-grading**: Calling the grade endpoint again for the same session **updates** the existing `OsceResult`; it does **not** create duplicate `ConceptGap` records (deduplication in `persistGradeAndConceptGap` by `userId`, `system`, `sourceType: 'osce'`, `sourceId`).

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/osce/session` | Create or get active OSCE session for a case. Request body: `{ "body": { "caseId": "string" } }`. |
| POST | `/api/osce/chat` | Save chat messages for a session. Request body: `{ "body": { "sessionId": "string", "messages": [{ "role": "user" \| "assistant" \| "system", "content": "string" }] } }`. |
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
- Checklist items are validated with Zod (`GRADE_CHECKLIST_ITEM`) before persistence; malformed Gemini output is dropped or rejected.

---

## OSCE tables: API-layer security

The following tables are used by the OSCE module and are **protected at the API layer** (ownership enforced in each handler), not by Supabase RLS:

- `PatientEncounterSession` — session ownership enforced in session, chat, complete, history, and grade handlers (e.g. `where: { id: sessionId, userId: user.id }`).
- `OsceResult` — created/updated only after session ownership is verified; linked to session by `sessionId`.
- `ConceptGap` — created with `userId` from the authenticated user when grading indicates a gap.

RLS is not currently applied to these tables. If you enable RLS for OSCE later, add policies that constrain `userId` (or equivalent) by `auth.uid()` / Clerk mapping so that API and RLS are aligned.
