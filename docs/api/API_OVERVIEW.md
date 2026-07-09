# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All endpoints below use the unified API envelope unless noted:

- **Success:** `{ "ok": true, "success": true, "data": <payload>, "traceId": "...", "timestamp": "..." }`
- **Error:** `{ "ok": false, "error": { "code": "...", "message": "..." }, "traceId": "...", "timestamp": "..." }`

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/diagnostic-puzzle/daily` | Returns today's diagnostic puzzle and the caller's in-progress state. |
| GET | `/api/diagnostic-puzzle/stats` | Returns aggregate win/loss, streak, and guess-distribution stats for the caller. |
| POST | `/api/diagnostic-puzzle/submit` | Submits a diagnosis guess for today's puzzle (or an optional `date` override). |
| GET | `/api/games/wordle/daily` | Returns today's Medical Wordle buzzword challenge and the caller's game state. |
| POST | `/api/games/wordle/guess` | Submits a Wordle guess for today's challenge. |

## Endpoint Contracts

### `GET /api/diagnostic-puzzle/daily`

**Auth:** Required (Clerk bearer token)

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | No | ISO date override (`YYYY-MM-DD`). Defaults to today (UTC). |

**Success response (`200 OK`)**

`data` shape:

```json
{
  "id": "daily-row-id",
  "date": "2026-07-09",
  "puzzle": {
    "id": "puzzle-id",
    "conditionId": "condition-id",
    "conditionName": "Pneumonia",
    "system": "Pulmonary",
    "title": "Pulmonary challenge",
    "difficulty": 3,
    "clues": ["Fever, productive cough, pleuritic chest pain"],
    "totalClues": 6
  },
  "userState": {
    "guesses": [],
    "status": "playing",
    "cluesRevealed": 1,
    "attemptsLeft": 6,
    "maxAttempts": 6
  }
}
```

- `clues` contains only clues revealed so far (clue 1 on load; each incorrect guess reveals the next clue).
- `status` is one of `playing`, `won`, or `lost`.
- `maxAttempts` / `totalClues` are fixed at **6**.

**Error responses**

- `400` → validation or service error (e.g. invalid date, no puzzles configured)
- `404` → `{ "error": "User not found" }` (Clerk user not yet provisioned in DB)
- `500` → internal server error

**Notes**

- Resolves Clerk `userId` to internal `User.id` before reading/writing `UserDiagnosticPuzzleState`.
- Daily puzzle selection is deterministic per UTC date (seeded offset into `DiagnosticPuzzle` catalog).

---

### `GET /api/diagnostic-puzzle/stats`

**Auth:** Required (Clerk bearer token)

**Query parameters:** None

**Success response (`200 OK`)**

`data` shape:

```json
{
  "total": 8,
  "wins": 5,
  "losses": 3,
  "winRate": 62.5,
  "streak": 2,
  "guessDistribution": {
    "1": 1,
    "2": 2,
    "3": 1,
    "4": 1,
    "5": 0,
    "6": 0
  }
}
```

- `winRate` is a percentage (`0–100`).
- `streak` counts consecutive wins up to today with no day gaps.
- `guessDistribution` keys `1–6` count wins by number of guesses used.

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → internal server error

---

### `POST /api/diagnostic-puzzle/submit`

**Auth:** Required (Clerk bearer token)

**Request body**

```json
{
  "guess": "pneumonia",
  "date": "2026-07-09"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `guess` | `string` | Yes | Diagnosis guess (trimmed, case-insensitive; fuzzy-matched against condition name and aliases). |
| `date` | `string` | No | ISO date override (`YYYY-MM-DD`). Defaults to today (UTC). |

**Success response (`200 OK`)**

Same `data` shape as `GET /api/diagnostic-puzzle/daily`, with updated `userState` after the guess is recorded.

**Error responses**

- `400` → guess validation, puzzle already completed, or service error
- `404` → `{ "error": "User not found" }`
- `500` → internal server error

**Notes**

- Correct guesses set `userState.status` to `won`.
- After 6 incorrect guesses, `userState.status` becomes `lost`.
- Re-submitting after `won` or `lost` returns `400`.

---

### `GET /api/games/wordle/daily`

**Auth:** Required (Clerk bearer token)

**Query parameters:** None (today's challenge is always UTC date).

**Success response (`200 OK`)**

`data` shape:

```json
{
  "id": "daily-wordle-id",
  "date": "2026-07-09",
  "word": {
    "id": "buzzword-id",
    "buzzword": "CURRANTJELLY",
    "condition": "Klebsiella pneumonia",
    "system": "Pulmonary",
    "subcategory": "Sputum appearance",
    "explanation": "Classic descriptor for thick, blood-tinged sputum."
  },
  "userState": {
    "guesses": [],
    "status": "playing",
    "attemptsLeft": 6,
    "maxAttempts": 6
  }
}
```

- `buzzword` length varies by the selected buzzword; guesses must match that length exactly.
- `status` is one of `playing`, `won`, or `lost`.

**Error responses**

- `400` / `422` → validation or service error (e.g. no buzzwords configured) via unified error envelope
- `500` → `{ "error": { "code": "INTERNAL_ERROR", "message": "Failed to load Wordle challenge" } }`

**Notes**

- Daily word selection is deterministic per UTC date (seeded offset into `Buzzword` catalog).
- Implemented in `services/core/wordleService.ts`; edge handlers at `functions/api/games/wordle/daily.ts`.

---

### `POST /api/games/wordle/guess`

**Auth:** Required (Clerk bearer token)

**Request body**

```json
{
  "guess": "CURRANT"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `guess` | `string` | Yes | Uppercase A–Z only; must match the target buzzword length. |

**Success response (`200 OK`)**

Same `data` shape as `GET /api/games/wordle/daily`, with updated `userState` after the guess is recorded.

**Error responses**

- `400` / `422` → invalid guess format, wrong length, puzzle already completed, or other validation error
- `500` → `{ "error": { "code": "INTERNAL_ERROR", "message": "Failed to submit Wordle guess" } }`

**Notes**

- Guesses are normalized to uppercase before comparison.
- Correct match sets `userState.status` to `won`; six misses set `lost`.
- `maxAttempts` is fixed at **6**.

---

## Client integration

| Feature | Hook / config | Envelope handling |
|---|---|---|
| Diagnostic Puzzle | `hooks/useDiagnosticPuzzle.ts`, `lib/utils/apiConfig.ts` | Uses `unwrapApiEnvelope` / `getApiEnvelopeError` |
| Medical Wordle | `hooks/useWordleGame.ts`, `lib/utils/apiConfig.ts` | Reads `data` from success envelope (or unwrap before mapping) |

**Routes:** `/modes/diagnostic-puzzle`, `/modes/medical-wordle` (see `config/training-modes.ts`).
