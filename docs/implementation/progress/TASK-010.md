# TASK-010 — Retire deprecated `/api/questions/review` endpoint

- **Status:** completed
- **Date:** 2026-04-16
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Category:** Endpoint retirement / dead-code removal
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` "Not doing now — parked" row: _Retire deprecated SRS endpoints (`functions/api/questions/review.ts`, narrow `functions/api/srs/submit.ts`)_. Unparked this run after a clean caller inventory.

## Verify-first block (Audit Interpreter)

The audit item called out two endpoints as deprecated-or-narrowable:

1. `POST /api/questions/review` — the older SM-2-only submission path. The file's own JSDoc already flagged: _"POST path writes SRSItem (SM-2 fields only, no FSRS overlay, no UserProgress sync). New review submissions should use POST /api/drills/submit-review which writes ReviewLog + UserProgress + UserTopicProgress atomically."_
2. `POST /api/srs/submit` — a related legacy path that optionally writes `SRSItem` only when `srsItemId` is passed. Its JSDoc has a narrower deprecation note: _"TODO: Remove once all frontend callers stop sending srsItemId."_

Scope of this task: **item 1 only**. Item 2 has an active frontend caller (`SrsFlashcardView`) and a genuine product question (should flashcard practice keep legacy SRSItem sync, or flip to the FSRS pipeline as well?); not a Just-Do-It decision.

### Caller inventory for `/api/questions/review`

Ran repo-wide grep across `*.{ts,tsx,js,jsx,html}`. The only references to the path `/api/questions/review` outside docs are:

- The endpoint file itself (`functions/api/questions/review.ts`).
- `lib/services/review/reviewSubmissionService.ts` — a client-side wrapper that wraps `fetch('/api/questions/review', ...)` with an offline-queue fallback.

Additional verification on the server-side `ReviewService` class used by the GET handler:

- `import { ReviewService } from '../../../lib/services/review/reviewService'` appears exactly once — in `functions/api/questions/review.ts` (the retiring file).
- `ReviewService` is also referenced by its own unit test (`lib/services/review/reviewService.test.ts`).

Additional verification on the client-side `reviewSubmissionService`:

- `grep -rn 'reviewSubmissionService\|services/review/'` across `*.{ts,tsx,js,jsx}` returns **zero** UI/hook/store imports. All hits live inside the service file itself or the tombstone's JSDoc.
- Historical references in `plans/IMPROVEMENT_LOG.md`, `lib/services/OFFLINE_SYNC_AUDIT.md`, and `docs/ARCHITECTURAL_REFACTORING_SUMMARY.md` describe intended refactors that were never wired in — no runtime caller ever adopted the service.

**Conclusion:** the entire `functions/api/questions/review.ts` endpoint (GET + POST) is orphaned at the application level. The server-side `ReviewService` class and the client-side `reviewSubmissionService` exist only to serve each other. Retire the whole trio.

## Planned-code-changes block (Repo Mapper)

1. **Tombstone** `functions/api/questions/review.ts`:
   - Both `onRequestGet` and `onRequestPost` return `410 Gone` with a structured migration JSON (`{ error, migration }`), matching the existing pattern in `functions/api/drill/log-attempt.ts`.
   - JSDoc at the top names the replacement for each path:
     - GET → proactive question reservoir (`functions/api/reservoir/*`) via the session pipeline.
     - POST → `POST /api/drills/submit-review` (FSRS v6 + ReviewLog + UserProgress + UserTopicProgress).
   - Keep `withCors` so the 410 response carries CORS headers, preserving the contract clients already expect on preflight.
   - No Prisma client, no auth wrapper (a 410 Gone does not need auth; any caller is already misbehaving — give them the migration pointer regardless of identity).

2. **Delete orphaned services** (via `mv` to `~/.Trash/panacea-task010-retirement/` per CLAUDE.md safety policy, not `rm`):
   - `lib/services/review/reviewSubmissionService.ts`
   - `lib/services/review/reviewService.ts`
   - `lib/services/review/reviewService.test.ts`

3. **Remove now-empty directory** `lib/services/review/` via `rmdir` after the three files are moved.

4. **No Prisma schema changes.** The legacy `SRSItem` model remains in `prisma/schema.prisma` because `POST /api/srs/submit` still writes to it when `srsItemId` is passed. Narrowing or dropping `SRSItem` is a separate, Ask-First migration task.

5. **No changes to historical docs** (`docs/AUDIT_REVIEW_LOG_SCHEMA_FSRS.md`, `docs/ARCHITECTURAL_REFACTORING_SUMMARY.md`, `docs/security/SECURITY_AUDIT_CHECKLIST.md`, `plans/IMPROVEMENT_LOG.md`, `lib/services/OFFLINE_SYNC_AUDIT.md`). They are historical audit artifacts — rewriting them would erase the trail that justified this retirement.

## What was changed

- `functions/api/questions/review.ts`: replaced with a 410 Gone tombstone for both GET and POST. Dropped all Prisma + `authenticatedEndpoint` + SM-2 calculation helpers (`calculateNewInterval`, `adjustEasiness`, `generateSummary`). Retained `withCors` export for `onRequestOptions`.
- `lib/services/review/reviewSubmissionService.ts`: **deleted** (moved to `~/.Trash/panacea-task010-retirement/`).
- `lib/services/review/reviewService.ts`: **deleted** (moved to `~/.Trash/panacea-task010-retirement/`).
- `lib/services/review/reviewService.test.ts`: **deleted** (moved to `~/.Trash/panacea-task010-retirement/`).
- `lib/services/review/`: directory removed via `rmdir`.

## Verification

- **Residual import check:** `grep -rn 'reviewSubmissionService\|services/review/'` across `*.{ts,tsx,js,jsx}` returns **zero** hits outside the tombstone's own JSDoc citation. No broken imports introduced.
- **Audit script result (node-native faithful port):**
  - Total mutation endpoints: **189** (unchanged — the POST handler remains present as a 410 tombstone, so the audit still counts it).
  - PASS: 176 (down from 177 — `review.ts` POST previously PASSed via `authenticatedEndpoint`; tombstone intentionally strips schema validation).
  - WARN_OUT_OF_BAND: 8 (unchanged).
  - WARN_MANUAL_ONLY: 3 (unchanged).
  - **FAIL: 2** — `functions/api/drill/log-attempt.ts` and `functions/api/questions/review.ts`. **Both are deliberate 410 Gone tombstones**, neither reads its body, neither touches user data. Expected and correct.
- **Typecheck:** scoped typecheck on the tombstone matches the pre-existing `PagesFunction` ambient-type pattern used by `log-attempt.ts`. Production build provides `PagesFunction` via Cloudflare's deploy-time type injection — consistent with the existing working tombstone precedent.

## Audit delta

- Closes the "Not doing now — parked" queue row for `functions/api/questions/review.ts`.
- Audit `audit:zod` FAIL count: 1 → 2, with both FAILs now being deliberate 410 Gone tombstones. This is the intended steady state: tombstones show up as FAIL because they deliberately don't validate request bodies (they reject everything).
- Orphaned code removed: `lib/services/review/` directory (three files, ~300 LOC total) is gone. Reduces the repo-hygiene surface area.

## Follow-ups

- **`POST /api/srs/submit` narrowing** (separate task): decide whether to drop the `srsItemId` branch entirely. Requires sign-off because `SrsFlashcardView` still sends `srsItemId` and the FSRS pipeline for flashcards has not been designed.
- **`SRSItem` model deprecation** (Ask-First, schema migration): once `srs/submit.ts` stops writing it and all historical rows are either migrated or archived, drop the model. Out of scope here.
- **Tombstone removal schedule**: revisit in ~2 release cycles. If no production traffic lands on `/api/questions/review` in that window, the tombstone file itself can be deleted (the 404 that replaces it is a safe steady state).
