# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/learning/socratic` | Returns one ZPD-calibrated Socratic guiding question for Review Mode "Tutor Me" (via AI Gateway `gateway.tutor()`). |
| POST | `/api/osce/evaluate` | Post-hoc SPBench 8-dimension rubric scoring for a completed OSCE session (via AI Gateway `gateway.grade()`). |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `POST /api/ai/learning/socratic`

**Auth:** Required (`aiEndpoint` — Clerk bearer token)

**Rate limit:** 25 requests/minute per user (shared `ai` bucket with other AI endpoints)

**Request body**

```json
{
  "body": {
    "questionId": "string (optional)",
    "conditionId": "string (optional)",
    "vignette": "string (optional, max 5000 chars; defaults to empty)",
    "question": "string (required)",
    "correctAnswer": "string (required)",
    "userWrongAnswer": "string (required)",
    "options": ["string"] ,
    "history": [
      { "role": "user | tutor", "text": "string" }
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

**Success response (`200 OK`)**

```json
{
  "data": {
    "guidingQuestion": "What detail in the vignette suggests your answer might not fit this patient?"
  }
}
```

**Error responses**

- `401` → `{ "error": "Authentication required" }`
- `429` → `{ "error": "Rate limit exceeded" }` (gateway `RATE_LIMITED`)

**Notes**

- Routed through `lib/ai/aiGateway.ts` → `gateway.tutor()` with task tier `balanced` (Gemini 2.5 Flash) and same-provider tier-bump fallback.
- When `questionId` and/or `conditionId` are provided without `fsrsState`, the handler performs a read-only learner-history lookup (`Card`, `UserProgress`, `ReviewLog`) to calibrate ZPD hint depth. Scheduling writes are never performed here.
- Content-safety blocks and most gateway failures still return `200` with a generic `guidingQuestion` fallback so Review Mode is never blocked.
- Legacy telemetry endpoint tag `/api/intelligence/socratic-remediation` is still emitted in gateway metadata for trace continuity; the canonical route is `/api/ai/learning/socratic`.
- Langfuse traces are emitted per gateway call when `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are configured (no-op otherwise).

---

### `POST /api/osce/evaluate`

**Auth:** Required (`authenticatedEndpoint` — Clerk bearer token)

**Feature flag:** `ENABLE_OSCE_BETA` must be enabled; otherwise returns feature-disabled response.

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
    "justification": "2-4 sentence SPBench summary"
  }
}
```

**Success response (`200 OK`) — cached (idempotent)**

```json
{
  "data": {
    "success": true,
    "cached": true,
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

**SPBench dimension keys**

| Key | Dimension |
|---|---|
| `QC` | Query Competence |
| `CC` | Case Coverage |
| `CD` | Clinical Depth |
| `RC` | Relevance Check |
| `LC` | Logical Consistency |
| `LN` | Language Naturality |
| `CS` | Clinical Safety |
| `PD` | Professional Demeanor |

`overall` is the weighted average: QC×0.15 + CC×0.15 + CD×0.15 + RC×0.10 + LC×0.15 + LN×0.10 + CS×0.10 + PD×0.10.

**Error responses**

- `404` → `{ "error": "User not found" }`, `{ "error": "Session not found" }`, or feature-disabled envelope when `ENABLE_OSCE_BETA` is off
- `429` → `{ "error": "Rate limit exceeded" }`
- `422` → `{ "error": "Invalid evaluation response format" }` (schema repair exhausted)
- `502` → `{ "error": "Evaluation service failed" }`
- `500` → `{ "error": "Failed to evaluate session" }`

**Notes**

- Routed through `lib/ai/aiGateway.ts` → `gateway.grade()` with tier `powerful` (Gemini 2.5 Pro) and `SpbenchScoreSchema` Zod validation.
- Session ownership is enforced (`PatientEncounterSession.userId` must match the authenticated user).
- Existing `SpbenchScore` rows are returned immediately (`cached: true`) without re-invoking the model.
- Prompt builders live in `lib/ai/prompts/osce.ts` (shared with the LangGraph OSCE encounter graph).
- Langfuse traces are emitted per gateway call when keys are configured.

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
