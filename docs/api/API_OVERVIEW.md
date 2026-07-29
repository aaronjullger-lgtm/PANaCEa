# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

**Last updated:** 2026-07-29 — AI Gateway migration for Socratic remediation and OSCE SPBench evaluation.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/learning/socratic` | Returns one ZPD-calibrated Socratic guiding question for Review Mode “Tutor Me” (no answer reveal). |
| POST | `/api/osce/evaluate` | Post-hoc SPBench 8-dimension rubric scoring for a completed OSCE session; persists and caches `SpbenchScore`. |

Both routes route model calls through `lib/ai/aiGateway.ts` (`gateway.tutor()` and `gateway.grade()` respectively) instead of direct `callAIMultiProvider` / ad-hoc Gemini calls.

## Endpoint Contracts

### `POST /api/ai/learning/socratic`

**Auth:** Required (`aiEndpoint` — Clerk JWT, default **25 req/min** per user via `keyPrefix: 'ai'`)

**Handler:** `functions/api/ai/learning/socratic.ts`

**Request body**

```json
{
  "body": {
    "questionId": "string (optional, max 160)",
    "conditionId": "string (optional, max 160)",
    "vignette": "string (optional, max 5000, default \"\")",
    "question": "string (required)",
    "correctAnswer": "string (required)",
    "userWrongAnswer": "string (required)",
    "options": ["string"] ,
    "history": [
      { "role": "user" | "tutor", "text": "string" }
    ],
    "fsrsState": {
      "retrievability": 0.0,
      "difficulty": 1,
      "stability": 0,
      "reviewCount": 0,
      "lapseCount": 0
    },
    "turnNumber": 0
  }
}
```

When `fsrsState` is omitted but `questionId` or `conditionId` is present, the handler may infer learner state from read-only `Card`, `UserProgress`, and `ReviewLog` rows. FSRS scheduling writes remain owned by `drillReviewService`.

**Success response (`200 OK`)**

```json
{
  "data": {
    "guidingQuestion": "string"
  }
}
```

**Error responses**

- `429` → `{ "error": "Rate limit exceeded" }` (gateway `RATE_LIMITED`)

**Resilience notes**

- Gateway failures (except rate limit) return `200` with a generic `guidingQuestion` fallback so Review Mode never blocks on AI errors.
- Content-policy blocks (`result.blocked`) also return the fallback question.
- `maxOutputTokens` increases to 512 when `turnNumber >= 3`.

**Client:** `components/quiz/SocraticTutorChat.tsx` (`getApiEndpoint('/api/ai/learning/socratic')`).

**Legacy telemetry path:** Gateway metadata still tags `endpoint: '/api/intelligence/socratic-remediation'` for trace continuity; the deployed URL is `/api/ai/learning/socratic`.

---

### `POST /api/osce/evaluate`

**Auth:** Required (`authenticatedEndpoint`)

**Feature gate:** `ENABLE_OSCE_BETA` — when disabled, returns the standard feature-disabled response (see `functions/api/_shared/feature-flags.ts`).

**Handler:** `functions/api/osce/evaluate.ts`

**Request body**

```json
{
  "body": {
    "sessionId": "string (required)"
  }
}
```

**Success response (`200 OK`) — new evaluation**

```json
{
  "data": {
    "success": true,
    "scores": {
      "QC": 0,
      "CC": 0,
      "CD": 0,
      "RC": 0,
      "LC": 0,
      "LN": 0,
      "CS": 0,
      "PD": 0,
      "overall": 0
    },
    "justification": "string"
  }
}
```

Dimension keys map to SPBench rubric: Query Competence (QC), Case Coverage (CC), Clinical Depth (CD), Relevance Check (RC), Logical Consistency (LC), Language Naturality (LN), Clinical Safety (CS), Professional Demeanor (PD). Each dimension is 0–100; `overall` is the weighted average persisted as `overallScore`.

**Success response (`200 OK`) — cached (idempotent)**

```json
{
  "data": {
    "success": true,
    "cached": true,
    "scores": { "...": 0, "overall": 0 },
    "justification": "string"
  }
}
```

**Error responses**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `429` → `{ "error": "Rate limit exceeded" }`
- `422` → `{ "error": "Invalid evaluation response format" }` (schema repair exhausted)
- `502` → `{ "error": "Evaluation service failed" }`
- `500` → `{ "error": "Failed to evaluate session" }`

**Notes**

- Model tier: `gateway.grade()` with `tier: 'powerful'` (Gemini 2.5 Pro class).
- Prompt builders live in `lib/ai/prompts/osce.ts` (shared with LangGraph OSCE graph).
- Zod contract: `SpbenchScoreSchema` in `lib/ai/schemas/grading.ts`.
- Persists to `SpbenchScore` via upsert; duplicate requests return cached scores.
- Session ownership enforced: `PatientEncounterSession` must belong to the authenticated user.

---

## Shared infrastructure (this change set)

| Area | Location | Notes |
|---|---|---|
| AI Gateway | `lib/ai/aiGateway.ts` | Unified `gateway.tutor()`, `gateway.grade()`, telemetry, schema repair |
| AI service layer | `functions/api/_shared/ai-service.ts` | Underlying Gemini / multi-provider calls wrapped by the gateway |
| Env types | `functions/api/_shared/types.ts` | `CloudflareEnv` includes `LANGSMITH_*`, `LANGFUSE_*` (legacy compat), KV bindings |
| Langfuse traces | `lib/observability/langfuse.ts` | Gateway trace emission on success and failure |
