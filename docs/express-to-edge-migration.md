# Express → Cloudflare Edge Function Migration Checklist

*Generated: April 6, 2026*

## Overview

Production runs on **Cloudflare Pages Functions** (`functions/api/`). The Express `routes/` directory is legacy, used only for local dev via `npm run dev:all`. This checklist tracks which Express routes have been ported and which still need migration before `routes/` can be removed.

**Current coverage: ~32% of Express endpoints have Edge equivalents.**

## Status Key

- ✅ **PORTED** — Edge Function exists and is production-ready
- ⚠️ **PARTIAL** — Some endpoints ported, others missing
- ❌ **MISSING** — No Edge equivalent yet
- 💤 **DORMANT** — Not called by frontend; low priority

---

## Route Migration Status

### Core Data Routes

| Express Route | Edge Equivalent | Status |
|---|---|---|
| `GET /api/conditions` | `functions/api/conditions/index.ts` | ✅ PORTED |
| `GET /api/conditions/:id/extended` | `functions/api/conditions/index.ts` | ✅ PORTED |
| `GET /api/content/all` | `functions/api/content/all.ts` | ✅ PORTED |
| `GET /api/content/condition/:id` | `functions/api/content/condition/[conditionId].ts` | ✅ PORTED |
| `GET /api/content/:conditionId` | `functions/api/content/[conditionId].ts` | ✅ PORTED |
| `GET /api/content/search` | `functions/api/content/search.ts` | ✅ PORTED |
| `GET /api/reference/anatomy` | `functions/api/reference/anatomy/` | ✅ PORTED |
| `GET /api/reference/special-tests` | — | ❌ MISSING |
| `GET /api/reference/physiology` | — | ❌ MISSING |
| `GET /api/reference/treatments` | — | ❌ MISSING |
| `GET /api/reference/differentials` | `functions/api/reference/differentials/` | ✅ PORTED |
| `GET /api/reference/imaging` | — | ❌ MISSING |
| `GET /api/reference/findings` | — | ❌ MISSING |
| `GET /api/reference/guidelines` | `functions/api/guidelines/index.ts` | ✅ PORTED |
| `GET /api/reference/labs` | `functions/api/reference/labs/index.ts` | ✅ PORTED |

### Study Material Routes

| Express Route | Edge Equivalent | Status |
|---|---|---|
| `GET /api/drugs` | `functions/api/drugs/index.ts` | ✅ PORTED |
| `GET /api/drugs/random` | `functions/api/drugs/index.ts` | ✅ PORTED |
| `GET /api/drugs/search` | `functions/api/drugs/index.ts` | ✅ PORTED |
| `GET /api/buzzwords` | `functions/api/buzzwords/index.ts` | ✅ PORTED |
| `GET /api/buzzwords/random` | `functions/api/buzzwords/index.ts` | ✅ PORTED |
| `GET /api/labs/tests` | — | ❌ MISSING |
| `GET /api/labs/cases` | — | ❌ MISSING |
| `GET /api/labs/cases/random` | — | ❌ MISSING |
| `GET /api/drills/lab-cases` | — | ❌ MISSING |
| `POST /api/drills/lab-cases` | — | ❌ MISSING |

### Questions & Sessions

| Express Route | Edge Equivalent | Status |
|---|---|---|
| `GET /api/questions` | — | ❌ MISSING |
| `POST /api/questions/fetch` | — | ❌ MISSING |
| `POST /api/questions/query` | — | ❌ MISSING |
| `POST /api/questions/batch` | — | ❌ MISSING |
| `POST /api/questions/no-repeat` | — | ❌ MISSING |
| `POST /api/questions/history` | — | ❌ MISSING |
| `GET /api/questions/repository/stats` | — | ❌ MISSING |
| `GET /api/questions/stats` | — | ❌ MISSING |
| `POST /api/questions/flag` | `functions/api/questions/flag/index.ts` | ✅ PORTED |
| `POST /api/questions/flag/:id/resolve` | `functions/api/questions/flag/index.ts` | ✅ PORTED |
| `GET /api/questions/flags` | `functions/api/questions/flag/index.ts` | ✅ PORTED |
| `POST /api/questions/custom-session` | — | ❌ MISSING |
| `GET /api/questions/pool` | — | ❌ MISSING |
| `POST /api/questions/generate` | — | ❌ MISSING |
| `POST /api/questions/seeds` | `functions/api/questions/seeds/index.ts` | ✅ PORTED |
| `GET /api/questions/seeds/:id/assemble` | `functions/api/questions/seeds/index.ts` | ✅ PORTED |
| `GET /api/questions/seeds/stats` | `functions/api/questions/seeds/index.ts` | ✅ PORTED |

### Analytics & User

| Express Route | Edge Equivalent | Status |
|---|---|---|
| `POST /api/analytics/reactions` | `functions/api/analytics/reactions.ts` | ✅ PORTED |
| `POST /api/analytics/weakness` | `functions/api/analytics/weakness.ts` | ✅ PORTED |
| `POST /api/analytics/confusion` | `functions/api/analytics/confusion.ts` | ✅ PORTED |
| `POST /api/analytics/soap-note` | `functions/api/analytics/soap-note.ts` | ✅ PORTED (Zod `.strict()` hardened) |
| `GET /api/analytics/performance-deltas` | `functions/api/analytics/performance-deltas.ts` | ✅ PORTED |
| `GET /api/achievements` | — | ❌ MISSING |
| `GET /api/performance` | — | ❌ MISSING |
| `POST /api/performance` | — | ❌ MISSING |
| `GET /api/sync` | — | ❌ MISSING |
| `POST /api/sync` | `functions/api/sync.ts` | ✅ PORTED |
| `GET /api/recommendations` | `functions/api/recommendations/index.ts` | ✅ PORTED |
| `POST /api/recommendations/generate` | `functions/api/recommendations/index.ts` | ✅ PORTED |
| `PATCH /api/recommendations/:id/dismiss` | `functions/api/recommendations/index.ts` | ✅ PORTED |

### Push & Review (Edge-only)

| Edge Route | Edge Equivalent | Status |
|---|---|---|
| `POST /api/push/subscribe` | `functions/api/push/subscribe.ts` | ✅ PORTED (Zod `.strict()` hardened) |
| `DELETE /api/push/subscribe` | `functions/api/push/subscribe.ts` | ✅ PORTED (Zod `.strict()` hardened) |
| `POST /api/reviews/second-chance` | `functions/api/reviews/second-chance.ts` | ✅ PORTED (Zod `.strict()` hardened) |

### OSCE & AI

| Express Route | Edge Equivalent | Status |
|---|---|---|
| `GET /api/osce/cases/random` | — | ❌ MISSING |
| `POST /api/osce/session` | — | ❌ MISSING |
| `GET /api/osce/session/:sessionId` | — | ❌ MISSING |
| `POST /api/osce/chat` | — | ❌ MISSING |
| `POST /api/osce/complete` | — | ❌ MISSING |
| AI Router (Gemini proxy) | `functions/api/gemini/index.ts` | ⚠️ PARTIAL |

### Dormant Routes (Low Priority)

| Express Route | Status | Notes |
|---|---|---|
| `/api/games/*` (Wordle, Grand Rounds) | 💤 DORMANT | Not in App.tsx routing |
| `/api/pearls/*` | 💤 DORMANT | Not called by frontend |
| `/api/adaptive/*` | 💤 DORMANT | Not called by frontend |
| `/api/audit/content-audit` | 💤 DORMANT | Admin-only |

---

## Migration Priority

### P0 — Block Express removal
1. `/api/content/*` (4 endpoints) — Used by clinical library
2. `/api/questions/*` (8 missing endpoints) — Core question flow
3. `/api/analytics/*` (5 endpoints) — Analytics pipeline
4. `/api/osce/*` (5 endpoints) — OSCE simulation

### P1 — Important but workarounds exist
5. `/api/labs/*` (3 endpoints) — Lab case drills
6. `/api/reference/*` missing subroutes — Reference library
7. `/api/achievements`, `/api/performance` — Dashboard widgets

### P2 — Can defer
8. Dormant routes (games, pearls, adaptive) — Port only if re-activated

---

## How to Remove Express

Once all P0 routes are ported:

1. Switch `npm run dev` to use `npm run dev:wrangler` exclusively for 1 week
2. Verify all frontend features work against wrangler dev server
3. Remove `routes/` directory, `server.ts`, and Express dependencies
4. Update `CLAUDE.md` dev commands
5. Remove `npm run dev:all` script from `package.json`
