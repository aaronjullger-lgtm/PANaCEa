# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/games/wordle/daily` | Returns today's Medical Wordle challenge and the caller's in-progress state. |
| POST | `/api/games/wordle/guess` | Submits a guess for today's Wordle and returns updated game state. |
| GET | `/api/admin/check-access` | Verifies whether the authenticated user currently has admin access. |
| GET | `/api/admin/stats` | Returns admin dashboard platform metrics (users, activity, flags, top systems). |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| GET | `/api/osce/stats` | Returns OSCE-only performance metrics and trend data from completed sessions with scores. |

## Endpoint Contracts

### `GET /api/games/wordle/daily`

**Auth:** Required (`Authorization: Bearer <clerk_token>`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "id": "string",
    "date": "2026-07-09",
    "word": {
      "id": "string",
      "buzzword": "string",
      "condition": "string",
      "system": "string",
      "subcategory": "string | null",
      "explanation": "string | null"
    },
    "userState": {
      "guesses": ["string"],
      "status": "playing",
      "attemptsLeft": 6,
      "maxAttempts": 6
    }
  },
  "traceId": "string",
  "timestamp": "2026-07-09T00:00:00.000Z"
}
```

`userState.status` is one of `playing`, `won`, or `lost`. `maxAttempts` is always `6`.

**Error responses**

- `400` → `{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "..." }, "success": false }` (e.g. no buzzwords configured)
- `401` → unauthenticated
- `500` → `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Failed to load Wordle challenge" }, "success": false }`

**Notes**

- Edge handler: `functions/api/games/wordle/daily.ts`
- Business logic: `services/core/wordleService.ts` (`getDailyWordForUser`)
- Creates `DailyWordle` and `UserWordleState` rows on first access for the UTC calendar day.
- Uses `createEdgePrismaClient` + `safePrismaDisconnect` in a `finally` block.

---

### `POST /api/games/wordle/guess`

**Auth:** Required (`Authorization: Bearer <clerk_token>`)

**Request body**

```json
{
  "guess": "ASPIRIN"
}
```

`guess` must be alphabetic only and match the target buzzword length (case-insensitive; stored uppercase).

**Success response (`200 OK`)**

Same envelope and `data` shape as `GET /api/games/wordle/daily` (updated `userState` after the guess is recorded).

**Error responses**

- `400` → `{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "..." }, "success": false }`
  - Common messages: `Guess is required`, `Guesses must only contain alphabetic characters`, `Guess must be N letters long`, `You have already completed today's Wordle`
- `401` → unauthenticated
- `500` → `{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Failed to submit Wordle guess" }, "success": false }`

**Notes**

- Edge handler: `functions/api/games/wordle/guess.ts`
- Business logic: `services/core/wordleService.ts` (`submitWordleGuess`)
- Frontend hook: `hooks/useWordleGame.ts`

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
