# FSRS / Legacy SRS Retirement Plan

**Date:** 2026-07-09
**Scope:** deprecated SRS compatibility endpoints and the legacy `SRSItem` / `UserProgress.reviewHistory`
storage vs. the FSRS-first mainline (`drillReviewService` → `ReviewLog` + `QuestionAttempt` + `UserProgress`).

## 1. Current state (verified)

| Endpoint / path | State | Evidence |
|---|---|---|
| `functions/api/questions/review.ts` | **Already retired** (410 Gone tombstone) | TASK-010 (`fbad2689`); orphaned client services deleted; clean caller inventory. |
| `functions/api/srs/submit.ts` | **Live, active callers** | Wrapper-validated; callers below. |
| `functions/api/srs/sync.ts` | **Live, active callers** | Wrapper-validated; used by offline sync. |
| Mainline review persistence | ✅ `lib/services/drillReviewService.ts` → `ReviewLog` | Canonical FSRS write path. |
| `SRSItem` model / `UserProgress.reviewHistory` | Legacy storage still present | `prisma/schema.prisma`. |

## 2. Active caller inventory (why `srs/submit` and `srs/sync` cannot be removed unilaterally)

Non-test, non-doc callers referencing `api/srs/submit`, `/srs/sync`, or `srsItemId`:

- `components/session/SrsFlashcardView.tsx` — sends `srsItemId` to `/api/srs/submit` (flashcard practice path).
- `lib/services/srsReviewClient.ts` — client wrapper for the SRS submit/sync endpoints.
- `lib/sdk/srsClient.ts` — SDK surface for SRS submit/sync.
- `functions/api/sync.ts` — server-side sync aggregator that touches the SRS sync path.

Because `SrsFlashcardView` is a live, user-facing surface still using the `srsItemId` contract,
narrowing `srs/submit` (dropping the `srsItemId` branch) or dropping the `SRSItem` model would be a
**breaking product + data change**.

## 3. Classification & recommendation

| Item | Classification | Action |
|---|---|---|
| `questions/review.ts` retirement | Done | None. |
| `srs/submit.ts` `srsItemId` branch | **APPROVAL-GATED (product)** | Requires a decision: migrate flashcard practice onto the FSRS/`drillReviewService` pipeline, then narrow. |
| `srs/sync.ts` | **APPROVAL-GATED** | Keep as compatibility until offline-sync clients are confirmed migrated; then narrow. |
| `SRSItem` model drop | **APPROVAL-GATED (migration)** | Prisma migration + data backfill → Ask First. Only after `srs/submit` narrowing ships and a backfill from `SRSItem` → `ReviewLog`/`Card` is proven on a copy. |
| `UserProgress.reviewHistory` → `ReviewLog` migration | **APPROVAL-GATED** | Documented in `prisma/README.md`; needs backfill script + verification. |

## 4. Safe next steps (no approval needed)

- Keep the compatibility endpoints; do **not** change review-scheduling semantics.
- If touched, add regression tests around `srs/submit` and `drillReviewService` to lock current behavior
  before any future narrowing (the FSRS write path already has extensive tests — do not weaken them).

## 5. Sequenced retirement (each step Ask First)

1. Product decision: does flashcard practice adopt the FSRS pipeline? If yes →
2. Migrate `SrsFlashcardView` to `POST /api/drills/submit-review` (or a Card-backed FSRS path).
3. Narrow `srs/submit.ts` to drop the `srsItemId` branch; keep a thin compatibility 410 if needed.
4. Backfill `SRSItem` → `ReviewLog`/`Card` on a database copy; verify counts; then drop `SRSItem` via migration.
5. Complete the `UserProgress.reviewHistory` → `ReviewLog` migration per `prisma/README.md`.

**Do not** perform data migrations or change scheduling semantics without human approval and test proof.
