# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/questions/generate` | Authenticated single-question generation (cache → staging lake → AI); preview-only output staged for review. |
| POST | `/api/questions/generate-deep` | Admin-only deep-context generation via cached PANCE blueprint; returns non-persisted preview questions. |

## Cross-cutting: Clinical Quality Gate

Both generation routes and the `autoAuthor` batch pipeline optionally run generated artifacts through the shared quality gate (`lib/agents/quality/qualityGate.ts` + `createClinicalContentValidator`).

| Setting | Behavior |
|---|---|
| `ENABLE_QUALITY_GATE` unset / `false` | Gate skipped — existing production behavior. |
| `ENABLE_QUALITY_GATE=true` | LLM verifier runs before delivery; failures are quarantined. |

**Per-route behavior when enabled:**

- **`POST /api/questions/generate`** — Quarantine returns `502` with `code: GEMINI_ERROR` and `details.gate: "clinical-content"`. No question is cached or returned.
- **`POST /api/questions/generate-deep`** — Quarantined items are dropped from the `questions` array; the request still succeeds if any items pass. Validator feedback is logged server-side.
- **`autoAuthor` (script, not HTTP)** — Quarantined content is treated as validation failure; nothing is saved to `MedicalContent`.

Gate uses gateway task `grading` (balanced tier), structured `{ passed, feedback, score? }` verdicts, and `maxRetries: 1` on generate / `maxRetries: 0` on generate-deep.

---

## Endpoint Contracts

### `POST /api/questions/generate`

**Auth:** Required (`aiEndpoint` — authenticated user)

**Rate limit:** 60 requests/minute per user

**Request body**

```json
{
  "queryText": "Pulmonary embolism",
  "questionType": "mcq",
  "system": "Pulmonary",
  "difficulty": "medium"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `queryText` | string | yes | Condition/topic used to resolve `MedicalContent` |
| `questionType` | string | yes | e.g. `mcq` |
| `system` | string | no | Blueprint system override |
| `difficulty` | string | no | e.g. `medium` |

**Success response (`200 OK`)**

```json
{
  "success": true,
  "question": {
    "id": "string",
    "text": "string",
    "options": ["string"],
    "correctAnswer": "string",
    "system": "string",
    "difficulty": "medium",
    "submissionReady": false,
    "requiresApproval": true,
    "metadata": {
      "stagingQuestionId": "string",
      "persistence": "staged_for_review",
      "medicalContentId": "string",
      "conditionId": "string",
      "cached": false,
      "fromCache": false,
      "fromStaging": false
    },
    "drugValidation": {
      "checked": true,
      "allValid": true,
      "drugCount": 2,
      "invalidDrugs": [],
      "hasInteractions": false
    }
  },
  "cached": false,
  "similarity": 0.94
}
```

`similarity` is present only when `cached: true`. `drugValidation` is advisory (RxNorm) and may be omitted. All generated/cached items are preview-only (`submissionReady: false`, `requiresApproval: true`).

**Error responses**

| Status | `code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | No approved clinical source for `queryText` |
| `502` | `GEMINI_ERROR` | AI generation failed, quality gate quarantine, or no learner-facing item produced |
| `502` | `DB_ERROR` | Generated question could not be staged for review |

Quality-gate failure example:

```json
{
  "error": "The generated question did not pass the clinical quality gate and will not be delivered.",
  "code": "GEMINI_ERROR",
  "details": {
    "gate": "clinical-content",
    "feedback": ["specific defect 1", "specific defect 2"]
  }
}
```

**Notes**

- Resolution order: semantic cache → graded `StagingQuestion` → AI generation.
- New AI output is always staged via `stageGeneratedQuestionPreview` before return.
- Pearl harvesting runs after successful generation (non-blocking).
- Requires `GEMINI_API_KEY` and `DATABASE_URL` (validated via `validateFunctionEnv`).

---

### `POST /api/questions/generate-deep`

**Auth:** Required — **admin only** (`adminAuthenticatedEndpoint`)

**Rate limit:** 25 requests/minute per user

**Request body**

```json
{
  "body": {
    "condition": "Heart Failure",
    "category": "Cardiology",
    "implicitDifficulty": 0.65,
    "cachedContent": "cache_pance_master_v1",
    "count": 1
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `body.condition` | string | yes | Condition or topic |
| `body.category` | string | no | PANCE system for blueprint cross-reference |
| `body.implicitDifficulty` | number (0–1) | no | Influences vignette difficulty hint |
| `body.cachedContent` | string | no | Cached content name; defaults to `CACHE_PANCE_MASTER_NAME` env |
| `body.count` | integer (1–5) | no | Default `1` |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "data": {
    "questions": [
      {
        "id": "deep-preview-1730000000000-0",
        "question": "stem text",
        "options": ["A text", "B text", "C text", "D text"],
        "correctAnswerIndex": 0,
        "explanation": "brief rationale",
        "system": "Cardiovascular",
        "conditionId": "optional-id",
        "submissionReady": false,
        "requiresApproval": true,
        "metadata": {
          "source": "generate-deep-preview",
          "persistence": "admin_preview_only",
          "adminPreviewOnly": true,
          "submissionReady": false,
          "requiresApproval": true,
          "condition": "Heart Failure",
          "category": "Cardiology"
        }
      }
    ]
  }
}
```

Malformed model output (missing required fields, fewer than four options, invalid `correctAnswerIndex`) is filtered before mapping. With `ENABLE_QUALITY_GATE=true`, failed items are dropped rather than returned.

**Error responses**

| Status | `code` / shape | When |
|---|---|---|
| `400` / validation | `VALIDATION_FAILED` | Missing cached content config, safety filter block, bad gateway request |
| `429` | `RATE_LIMITED` | Gateway rate limit |
| `500` | `ENV_MISCONFIGURED` | Missing `GEMINI_API_KEY` or gateway auth failure |
| `502` | `GEMINI_ERROR` | Gateway generation failure |

**Notes**

- Uses AI gateway `callText` with `task: generation`, `tier: balanced` (gemini-2.5-flash), and `cachedContent` for 1M+ token blueprint context.
- **Does not persist** questions — admin preview only (`persistence: "admin_preview_only"`).
- Requires `GEMINI_API_KEY` and either `body.cachedContent` or `CACHE_PANCE_MASTER_NAME`.
