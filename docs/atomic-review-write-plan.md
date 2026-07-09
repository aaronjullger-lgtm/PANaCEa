# Atomic Durable Review Write Plan

**Date:** 2026-07-09
**Blocker (deep-research 2026-05-22):** "Durable writes are not yet atomic." — FSRS/Scheduling 81/100.
**Scope:** `lib/services/drillReviewService.ts` (core FSRS submission pipeline).

## 1. Verified current state

The review submission performs a **sequence of independent writes** with no transaction boundary:

| Write | Line (approx) |
|---|---|
| `prisma.questionAttempt.create(...)` | 1364 |
| `prisma.reviewLog.create(...)` | 1618, 2119 |
| `prisma.userTopicProgress.upsert(...)` | 2349 |
| `prisma.card.upsert(...)` | 2398 |
| `prisma.confusionPair.upsert(...)` | 2506 |
| `prisma.userSRSConfig.update(...)` | 2705 |

`grep "$transaction"` in `drillReviewService.ts` = **0**. If any write after the first fails (edge
timeout, connection blip), the record set is left **partially written** — e.g. a `QuestionAttempt`
without its `ReviewLog`, or a `Card` FSRS state updated without the matching `ReviewLog`. This is the
root of the "durable writes not atomic" blocker.

## 2. Why this is delicate (why it's approval-gated)

- It is the **core FSRS write path** — the competitive moat, covered by extensive tests
  (`drillReviewService.test.ts` 1,417 lines). Any change must keep those green.
- Edge runtime + Prisma over pgbouncer has **transaction constraints** (interactive transactions need a
  direct connection / bounded time). Wrapping too much in `$transaction` can break under the pooled
  connection or exceed time limits.
- Some writes are intentionally **fire-and-forget** side-effects (e.g. `confusionPair`) that should NOT
  block or roll back the primary review record.

## 3. Proposed design (for approval)

1. **Define the atomic core:** the invariant set that must commit together is
   `QuestionAttempt` + `ReviewLog` + the `Card`/`UserProgress` FSRS-state update. Wrap **only** these in
   a single `prisma.$transaction([...])` (or interactive transaction on a direct connection).
2. **Keep side-effects outside** the transaction: `confusionPair`, `userTopicProgress`,
   `userSRSConfig` telemetry — fire-and-forget after the core commits (already resilient today).
3. **Idempotency:** derive a deterministic key (userId + questionId/cardId + attempt timestamp bucket)
   so a client retry after a partial failure does not double-count. `syncManager` already de-dupes at
   the queue level; add a DB-level guard for defense-in-depth.
4. **Failure semantics:** on transaction failure, return a structured error so the client re-queues;
   never leave a `Card` advanced without its `ReviewLog`.

## 4. Safe preparatory work (no approval)

- **Characterization tests**: add tests asserting the *current* write set and ordering, so the
  transaction refactor can prove behavioral parity (do not weaken existing FSRS tests).
- **Instrumentation doc**: enumerate exactly which writes are invariant-core vs. side-effect (done in §3).
- **Connection audit**: confirm whether `createEdgePrismaClient` uses a pooled or direct URL and whether
  interactive transactions are viable on the Edge path (needed before choosing `$transaction` array vs.
  interactive form).

## 5. Approval gate

Wrapping the core writes changes durable-write and scheduling behavior on the hot path →
**Ask First**, and land only with the full `drillReviewService` test suite green plus new
partial-failure/rollback tests. **Do not** change scheduling semantics.
