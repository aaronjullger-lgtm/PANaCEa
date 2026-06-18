# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/study/session/generate` | Generates a study session (reservoir-first, concept FSRS selection, pre-generated fallback). |
| POST | `/api/questions/fetch` | Fetches production-safe, progress-linked pre-generated questions for the authenticated user. |
| GET | `/api/drills/smart-review` | Returns FSRS due items with hydrated question payloads for Quick Review / smart review UIs. |
| POST | `/api/drills/submit-review` | Canonical review writer: implicit FSRS rating, QuestionAttempt, ReviewLog, and scheduling. |

## Shared Serving Rules

Learner-facing question delivery on the routes above applies three production gates from `lib/services/questionServingSafety.ts`:

- **`withProductionQuestionSafety`** — canonical `Question` rows must have `lifecycleStatus: ACTIVE` and `qaStatus: APPROVED`.
- **`withProductionPregeneratedSafety`** — `PreGeneratedQuestion` rows must have `validationStatus: approved`.
- **`withProgressLinkage`** — served rows must have a non-null `conditionId` so `drillReviewService` can persist FSRS state. Unlinked questions are excluded from serving but may still be resolved on submit for legacy/offline payloads.

Session questions include explicit identity fields (`questionSource`, `sourceQuestionId`, `canonicalQuestionId`, `questionIdentityId`) so submit-review can resolve the correct backing row.

---

## Endpoint Contracts

### `POST /api/study/session/generate`

**Auth:** Required (`authenticatedEndpoint`)

**Rate limit:** 30 requests/minute per user

**Request body** (flat JSON or `{ "body": { ... } }` — middleware accepts both)

```json
{
  "mode": "adaptive",
  "size": 20,
  "blueprintWeights": { "CV": 0.12, "PULM": 0.1 },
  "system": "CV",
  "subcategory": "optional-string",
  "conditionId": "optional-string",
  "boostSystems": ["CV"],
  "suppressSystems": [],
  "perSystemCaps": { "CV": 5 },
  "blueprintStage": "general",
  "blueprintExamTypes": ["PANCE"],
  "blueprintLabel": "optional-string",
  "urgencyMultiplier": 1,
  "gatedSystems": [],
  "systems": ["CV", "PULM"],
  "initialDifficulty": "adaptive",
  "sessionLane": "main",
  "eorDeadline": "2026-06-01T00:00:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `mode` | `'adaptive' \| 'system' \| 'subcategory' \| 'condition' \| 'review' \| 'focused'` | Default `adaptive`. `system` requires `system`; `subcategory` requires `system` + `subcategory`; `condition` requires `conditionId`. |
| `size` | `number` | Integer 5–50 at runtime (`MIN_SESSION_SIZE`–`MAX_SESSION_SIZE`). Schema allows up to 100. Default `20`. |
| `sessionLane` | `'main' \| 'eor' \| 'drill'` | Blueprint enforcement lane. |
| `blueprintWeights` | `Record<string, number>` | NCCPA system weights for adaptive distribution. |

**Success response (`200 OK`)** — envelope `{ success, data, timestamp }`; inner `data`:

```json
{
  "sessionId": "ses_1710000000000_abc123",
  "questions": [
    {
      "id": "preq-uuid",
      "questionId": "preq-uuid",
      "canonicalQuestionId": "canonical-uuid-or-null",
      "sourceQuestionId": "preq-uuid",
      "questionSource": "pre_generated",
      "questionIdentityId": "identity-uuid-or-null",
      "question": "Stem text",
      "vignette": null,
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "correctAnswerIndex": 1,
      "explanation": "Rationale text",
      "system": "CV",
      "conditionId": "condition-uuid",
      "medicalContentId": "content-uuid-or-null",
      "difficulty": "medium",
      "source": "due_review"
    }
  ],
  "metadata": {
    "dueReviewCount": 3,
    "newCardCount": 17,
    "systemDistribution": { "CV": 8, "PULM": 4 },
    "estimatedMinutes": 30,
    "mode": "adaptive",
    "blueprintStage": "general",
    "learnerPhase": "didactic",
    "source": "reservoir"
  },
  "questionIds": ["preq-uuid"],
  "priorityBreakdown": { "A": 3, "B": 0, "C": 17 }
}
```

`metadata.source` is one of `reservoir`, `on_demand`, `mixed`, or `pregenerated_fallback`.

**Error responses**

- `400` → validation failure (`system is required for system mode`, etc.)
- `500` → `{ "success": false, "error": { "code": "INTERNAL_ERROR", "message": "Unable to generate a study session right now. Please try again." } }`

**Notes**

- Tries the proactive question reservoir first; falls back to on-demand concept selection plus production-safe pre-generated fallback.
- Unusable reserved reservoir rows are marked `failed` and released before fallback.
- Best-effort persists `StudySession` and `StudySessionQuestion` link rows; generation succeeds even when the link table is unavailable.
- Approved pre-generated questions may be mirrored to canonical `Question` rows before return.
- `correctAnswerIndex` is never silently defaulted to `0`; unresolved keys emit `-1` for client surfacing.

---

### `POST /api/questions/fetch`

**Auth:** Required (`authenticatedEndpoint`)

**Request body** (flat JSON)

```json
{
  "system": "CV",
  "conditionId": "optional-string",
  "difficulty": "medium",
  "questionType": "optional-string",
  "limit": 10
}
```

`userId` is **not** accepted. The internal user ID is resolved from the Clerk JWT via `resolveUserByClerkId`.

**Success response (`200 OK`)**

```json
{
  "success": true,
  "questions": [],
  "source": "database",
  "count": 0,
  "needsGeneration": true,
  "generationNeeded": 10
}
```

Each `questions[]` entry is a `PreGeneratedQuestion` row (full Prisma shape) excluding the caller's `UserQuestionSeen` history and rows failing production/linkage filters.

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → `{ "error": "Failed to fetch questions" }`

**Notes**

- Serves **only** `PreGeneratedQuestion` rows (`validationStatus: approved`, `conditionId` not null).
- Increments `timesServed` fire-and-forget for kill-switch flag-rate tracking.
- Admin/authoring surfaces use separate routes for pending or rejected drafts.

---

### `GET /api/drills/smart-review`

**Auth:** Required (`authenticatedEndpoint`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "success": true,
  "items": [
    {
      "id": "topic-progress-uuid",
      "questionId": "preq-uuid",
      "dueDate": "2026-04-01T00:00:00.000Z",
      "overdueDays": 1,
      "difficulty": 7,
      "interval": 4,
      "stability": 4,
      "srsReason": "WEAK_SPOT",
      "question": {
        "id": "preq-uuid",
        "stem": "Question stem",
        "choices": ["Option A", "Option B"],
        "correctAnswer": "Option B",
        "explanation": "Rationale",
        "system": "PULM",
        "difficulty": "medium"
      }
    }
  ],
  "stats": {
    "totalDue": 1,
    "hardCount": 1,
    "overdueCount": 0,
    "newCount": 0
  }
}
```

`srsReason` is one of `OVERDUE`, `WEAK_SPOT`, `NEW`, or `DUE`.

**Error responses**

- `500` → `{ "error": "Failed to fetch review items" }`

**Notes**

- Merges due rows from `UserTopicProgress` and `UserProgress`, capped at 20 items.
- Hydrates from production-safe `PreGeneratedQuestion` first, then canonical `Question`.
- Skips items whose correct answer cannot be resolved against served options.
- `success: true` with an empty `items` array means the queue is genuinely empty (not a silent failure).

---

### `POST /api/drills/submit-review`

**Auth:** Required (`authenticatedEndpoint`)

**Request body** (flat JSON or `{ "body": { ... } }`)

```json
{
  "questionId": "preq-uuid",
  "canonicalQuestionId": "canonical-uuid-or-null",
  "sourceQuestionId": "preq-uuid",
  "questionSource": "pre_generated",
  "medicalContentId": "content-uuid-or-null",
  "selectedAnswer": "Option B",
  "timeSpentMs": 45000,
  "timeToFirstClick": 3200,
  "answerSwitches": 1,
  "totalDwellTime": 42000,
  "sessionType": "main",
  "idempotencyKey": "review-1710000000000-abc",
  "telemetry": {
    "duration_ms": 45000,
    "rapid_guess": false,
    "question_type": "vignette",
    "mvrt_threshold_ms": 3000,
    "question_displayed_at": "2026-06-01T12:00:00.000Z",
    "answer_submitted_at": "2026-06-01T12:00:45.000Z",
    "answer_changes": 1,
    "hint_viewed": false,
    "session_id": "ses_1710000000000_abc123"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `questionSource` | `'question' \| 'pre_generated' \| 'staging' \| 'seed' \| 'generated'` | Required for correct resolver priority when IDs overlap across tables. |
| `sourceQuestionId` | `string` | Backing row ID in the source table; defaults to `questionId` when omitted. |
| `canonicalQuestionId` | `string \| null` | Canonical `Question.id` when known. |
| `sessionType` | `'main' \| 'drill' \| 'cram' \| 'rapid_recall' \| 'targeted'` | Gates FSRS updates. `cram` and `rapid_recall` skip scheduling. |
| `idempotencyKey` | `string` | Optional 8–128 char key; cached 24h in KV to prevent duplicate writes on retry. |

**Success response (`200 OK`)** — inner `data`:

```json
{
  "success": true,
  "isCorrect": true,
  "quality": 1,
  "parTimeMs": 90000,
  "timeSpentMs": 45000,
  "implicitMetrics": {
    "rating": 1,
    "gradeContinuous": 0.82,
    "confidence": 0.75,
    "latencyRatio": 0.5,
    "answerSwitches": 1
  },
  "circadian": {
    "phase": "peak",
    "stabilityModifier": 1.0,
    "localHour": 14
  },
  "fsrsSchedule": {
    "intervalDays": 4,
    "nextDueDate": "2026-06-05T12:00:00.000Z",
    "stability": 3.2,
    "difficulty": 5.1
  },
  "isRapidGuess": false,
  "nextReview": {
    "intervalDays": 4,
    "nextDueDate": "2026-06-05T12:00:00.000Z",
    "stability": 3.2,
    "difficulty": 5.1
  }
}
```

When FSRS scheduling is skipped, `fsrsSchedule` and `nextReview` are absent/null and `fsrsSkippedReason` is set:

| `fsrsSkippedReason` | Meaning |
|---|---|
| `session_type_excluded` | `sessionType` is `cram` or `rapid_recall`. |
| `rapid_guess` | Answer below MVRT threshold; attempt logged, no schedule change. |
| `missing_condition_linkage` | Question has no `conditionId`; attempt logged, no durable schedule. |
| `fsrs_update_failed` | Schedule computed but `UserProgress` write failed; card stays due. |

**Error responses**

- `400` → validation failure
- `404` → question not found after resolver chain
- `500` → pipeline failure

**Notes**

- Canonical writer for FSRS, `QuestionAttempt`, `ReviewLog`, and `UserProgress`.
- Resolver order: `PreGeneratedQuestion` → canonical `Question` → latest `QuestionAttempt` fallback.
- Binary implicit rating only (Again/Good); no self-reported confidence fields.
- Consumes reservoir reservations when `telemetry.session_id` is present.

---

## Related Documentation

- Shared Zod schemas: `lib/api/schemas/sessions.ts`, `lib/api/schemas/drills.ts`
- Study mode repair rollout: `reports/STUDY_MODE_REPAIR_ROLLOUT.md`
- Serving safety implementation: `lib/services/questionServingSafety.ts`
