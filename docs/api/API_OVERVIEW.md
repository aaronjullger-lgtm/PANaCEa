# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

All endpoints below use the unified API envelope (`functions/api/_shared/api-response.ts`):

- **Success:** `{ ok: true, success: true, data, traceId, timestamp, message? }`
- **Error:** `{ ok: false, error: { code, message, details? }, traceId, timestamp }`

Clients should read payloads from `data` (see `lib/utils/apiEnvelope.ts` → `unwrapApiEnvelope`).

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/diagnostic-puzzle/daily` | Returns today's diagnostic puzzle and the caller's in-progress state. |
| GET | `/api/diagnostic-puzzle/stats` | Returns lifetime diagnostic puzzle stats (wins, streak, guess distribution). |
| POST | `/api/diagnostic-puzzle/submit` | Submits a condition guess for today's diagnostic puzzle. |
| GET | `/api/games/wordle/daily` | Returns today's Medical Wordle buzzword challenge and user progress. |
| POST | `/api/games/wordle/guess` | Submits a letter guess for today's Medical Wordle. |

**Implementation:** Edge handlers in `functions/api/diagnostic-puzzle/*` and `functions/api/games/wordle/*`. Business logic in `services/core/diagnosticPuzzleService.ts` and `services/core/wordleService.ts`.

---

## Endpoint Contracts

### `GET /api/diagnostic-puzzle/daily`

**Auth:** Required (`Authorization: Bearer <clerk_jwt>`)

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | No | ISO date override (`YYYY-MM-DD`). Defaults to today (UTC). |

**Success response (`200 OK`)**

`data` shape (`DiagnosticPuzzleDailyPayload`):

```json
{
  "id": "daily-row-uuid",
  "date": "2026-07-09",
  "puzzle": {
    "id": "puzzle-uuid",
    "conditionId": "condition-uuid",
    "conditionName": "Pneumonia",
    "system": "Pulmonary",
    "title": "Daily case title",
    "difficulty": 3,
    "clues": ["Clue revealed so far"],
    "totalClues": 6
  },
  "userState": {
    "guesses": ["prior guess"],
    "status": "playing",
    "cluesRevealed": 2,
    "attemptsLeft": 5,
    "maxAttempts": 6
  }
}
```

`userState.status` is `playing` | `won` | `lost`. Clues unlock progressively: clue 1 is always shown; each incorrect guess reveals the next clue (up to 6).

**Error responses**

- `400` → validation or `DiagnosticPuzzleServiceError` (e.g. invalid date, no puzzles configured)
- `404` → `{ "error": "User not found" }`
- `500` → internal server error

**Notes**

- Daily puzzle selection is deterministic per UTC date (seeded from `DailyDiagnosticPuzzle.date`).
- Condition matching on submit uses exact name/alias match plus fuzzy Levenshtein matching (≥ 75% similarity).

---

### `GET /api/diagnostic-puzzle/stats`

**Auth:** Required

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "total": 12,
  "wins": 8,
  "losses": 4,
  "winRate": 66.67,
  "streak": 3,
  "guessDistribution": {
    "1": 1,
    "2": 3,
    "3": 2,
    "4": 1,
    "5": 1,
    "6": 0
  }
}
```

`guessDistribution` keys are guess counts (1–6) for winning games only.

**Error responses**

- `404` → `{ "error": "User not found" }`
- `500` → internal server error

---

### `POST /api/diagnostic-puzzle/submit`

**Auth:** Required

**Request body**

```json
{
  "guess": "pneumonia",
  "date": "2026-07-09"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `guess` | `string` | Yes | Condition name guess (trimmed, lowercased server-side). |
| `date` | `string` | No | ISO date override; defaults to today (UTC). |

**Success response (`200 OK`)**

Same `data` shape as `GET /api/diagnostic-puzzle/daily` with updated `userState` (new guess appended, status may change to `won` or `lost`).

**Error responses**

- `400` → validation failure or service error (e.g. puzzle already completed, empty guess)
- `404` → `{ "error": "User not found" }`
- `500` → internal server error

**Notes**

- Max 6 guesses per daily puzzle. Winning on guess N reveals N clues; losing after 6 guesses sets `status: "lost"`.
- Re-submitting after `won` or `lost` returns `400`.

---

### `GET /api/games/wordle/daily`

**Auth:** Required

**Request body:** None

**Success response (`200 OK`)**

`data` shape (`WordleDailyPayload`):

```json
{
  "id": "daily-wordle-uuid",
  "date": "2026-07-09",
  "word": {
    "id": "buzzword-uuid",
    "buzzword": "PERICARDITIS",
    "condition": "Pericarditis",
    "system": "Cardiovascular",
    "subcategory": "Inflammatory",
    "explanation": "Chest pain relieved by leaning forward"
  },
  "userState": {
    "guesses": ["STENOSIS"],
    "status": "playing",
    "attemptsLeft": 5,
    "maxAttempts": 6
  }
}
```

**Error responses**

- `400` / `422` → `WordleServiceError` via `fail(ErrorCode.VALIDATION_FAILED, …)` (e.g. no buzzwords configured)
- `500` → `fail(ErrorCode.INTERNAL_ERROR, …)`

**Notes**

- Daily word selection is deterministic per UTC date (seeded from `DailyWordle.date`).
- `buzzword` is the target answer; client UI typically uppercases for display.
- `subcategory` and `explanation` may be `null`.

---

### `POST /api/games/wordle/guess`

**Auth:** Required

**Request body**

```json
{
  "guess": "STENOSIS"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `guess` | `string` | Yes | Alphabetic guess, trimmed and uppercased server-side. Must match target `buzzword` length. |

**Success response (`200 OK`)**

Same `data` shape as `GET /api/games/wordle/daily` with updated `userState`.

**Error responses**

- `400` / `422` → validation or `WordleServiceError` (wrong length, non-alpha characters, puzzle already completed)
- `500` → internal server error

**Notes**

- Max 6 attempts. Exact match (case-insensitive after normalization) sets `status: "won"`.
- Guesses are stored uppercased in `userState.guesses`.

---

## Frontend integration

| Hook | Endpoints |
|---|---|
| `hooks/useDiagnosticPuzzle.ts` | `/api/diagnostic-puzzle/daily`, `/submit`, `/stats` |
| `hooks/useWordleGame.ts` | `/api/games/wordle/daily`, `/api/games/wordle/guess` |

Routes: `/modes/diagnostic-puzzle`, `/modes/medical-wordle` (see `docs/plans/plan_02.md`).
