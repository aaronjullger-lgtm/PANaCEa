# Review Log Schema Audit for FSRS Optimization

**Date:** 2025-02-02  
**Scope:** "Snapshot" trap verification + Timezone bug check for FSRS optimization

---

## 1. The "Snapshot" Trap — FAIL ❌

### Requirement

> You must append a new row to a ReviewLog table for **every single interaction**.

### Finding: **No production code writes to ReviewLog**

The `ReviewLog` table exists in the schema with the correct FSRS-facing fields, but **no production review flow populates it**.

| Review Flow | Writes to ReviewLog? | What it writes instead |
|-------------|----------------------|-------------------------|
| `/api/drills/submit-review` → `submitDrillReview()` | ❌ **NO** | `UserProgress` (fsrsCard + reviewHistory JSON), `QuestionAttempt` |
| `/api/questions/review` POST | ❌ **NO** | `SRSItem`, `QuestionAttempt`, `UserQuestionSeen` |
| `updateUserProgressWithHistory()` | ❌ **NO** | `UserProgress.fsrsCard`, `UserProgress.reviewHistory` (JSON array) |
| `updateReviewOutcome()` (srsService) | ❌ **NO** | In-memory SRS items only (localStorage/cloud sync) |

### Where ReviewLog *is* used

- **READ only:** `drillSessionManager.ts` (counts MAIN vs CRAM sessions), `fsrsOptimization.ts` (eligibility via `reviewLog.groupBy`)
- **Test script:** `scripts/test-drill-mode.ts` creates fake ReviewLog entries for testing
- **Docs:** `FSRS_V6_QUICK_REFERENCE.md` shows example `reviewLog.create` usage, but this is not wired into the app

### FSRS optimizer data source

The `optimizeUserFSRS()` job in `scripts/automation/jobs/fsrsOptimization.ts` uses **`UserProgress.reviewHistory`** (JSON snapshots), **not** ReviewLog:

```typescript
// fsrsOptimization.ts:336–346
const userProgress = await prisma.userProgress.findMany({
  where: { userId },
  select: { reviewHistory: true, medicalContent: { select: { systemCode: true } } },
});
// ... aggregates from reviewHistory
```

`findEligibleUsers()` uses `reviewLog.groupBy` for counts, but if ReviewLog is empty, those counts are 0. Eligibility also falls back to `userProgress.groupBy`, so optimization can still run using UserProgress data—but the design expects ReviewLog to be the primary source.

### Required fields (schema check)

| Required Field | ReviewLog Schema | Status |
|----------------|------------------|--------|
| `card_id`      | `conditionId` / `medicalContentId` / `questionFkId` | ✅ Equivalent identifiers present |
| `rating`       | `rating` (Int, grade)                               | ✅ 1=Again, 2=Hard, 3=Good, 4=Easy |
| `state`        | `state` (Int)                                      | ✅ 0=New, 1=Learning, 2=Review, 3=Relearning |
| `due_date`     | `due_date` (`scheduledAt`)                          | ✅ DateTime |
| `review_date`  | `review_date` (`reviewedAt`)                        | ✅ DateTime @default(now()) |
| `duration`     | `duration` (`responseTimeMs`)                       | ✅ Int (ms) |

**Conclusion:** Schema is correct; the gap is that **nothing writes to it** in the main review flows.

---

## 2. The Timezone Bug — PARTIAL ⚠️

### Requirement

- Store `review_date` and `due_date` in **UTC**
- Compute `delta_t` as `(review_date_utc - last_review_date_utc) / 86400`

### elapsed_days / delta_t calculation

`lib/fsrs.ts`:

```typescript
newCard.elapsed_days = (now.getTime() - lastReviewDate.getTime()) / 86400000;
```

- `getTime()` returns UTC epoch milliseconds.
- Formula: `(ms diff) / 86400000` = days.
- Numerically equivalent to `(s diff) / 86400`.
- **Verdict:** ✅ Correct and timezone-safe.

`lib/fsrs-optimizer.ts` (convertSnapshots):

```typescript
const elapsedDays = (currDate.getTime() - prevDate.getTime()) / 86400000;
```

- Same UTC-epoch logic. ✅ Correct.

### Storage of timestamps

| Location | How stored | UTC? |
|----------|------------|------|
| `UserProgress.fsrsCard.last_review` | `fsrsCard.last_review.toISOString()` | ✅ ISO 8601 UTC |
| `ReviewSnapshot.date` | `reviewDate.toISOString()` | ✅ ISO 8601 UTC |
| `ReviewLog.review_date`, `due_date` | Prisma `DateTime` | ⚠️ See below |

Prisma `DateTime` without `@db.Timestamptz` typically maps to PostgreSQL `timestamp without time zone`. That does **not** guarantee UTC storage; interpretation depends on the application and driver.

**Recommendation:** Use `@db.Timestamptz` for `ReviewLog.review_date` and `due_date` so Postgres stores and returns UTC. Also ensure call sites pass `new Date()` (or equivalent UTC) when writing, which Prisma will send as a timestamp string.

### Risk scenario

If a user reviews in NY (EST) and again in CA (PST) on the same calendar day:

- With correct UTC handling: `delta_t` is based on actual elapsed wall-clock time.
- With naive local-time handling: `delta_t` can be wrong (e.g., negative or too small).

Because `elapsed_days` is computed from `getTime()` (UTC epoch ms), the **calculation** is safe. The remaining risk is how `review_date` / `due_date` are stored and later used for analytics or backfills.

---

## 3. Summary & Recommendations

### Critical: Add ReviewLog writes to production flows

1. In `lib/services/drillReviewService.ts` → `submitDrillReview()`  
   After the FSRS update and `updateUserProgressWithHistory()`, add a `prisma.reviewLog.create()` with:
   - `userId`, `conditionId`, `medicalContentId`, `questionId`, `questionFkId` (when available)
   - `rating`, `state`, `duration` (responseTimeMs)
   - `due_date` = scheduled date before this review
   - `review_date` = `new Date()` (or server timestamp)
   - `stability`, `difficulty`, `elapsedDays`, `wasCorrect`
   - `sessionType` / `review_type` = MAIN for regular drills

2. In `lib/services/userProgressService.ts` → `updateUserProgressWithHistory()`  
   Add an optional `prisma.reviewLog.create()` (or a shared helper) for condition-based reviews that go through this path.

3. For `/api/questions/review` and any other SRS flows  
   Add ReviewLog writes where FSRS state is updated.

### Timezone hardening

1. In `prisma/schema.prisma`:
   - Use `@db.Timestamptz` for `ReviewLog.review_date` and `ReviewLog.due_date` (if supported by your Prisma/Postgres setup).

2. When computing `elapsedDays` for ReviewLog inserts:
   - Use `(reviewDate.getTime() - lastReviewDate.getTime()) / 86400000` with UTC-based `Date` objects.

3. Document that all review timestamps are stored and interpreted in UTC.

### References

- Schema: `prisma/schema.prisma` lines 1435–1488 (`model ReviewLog`)
- Main review flow: `lib/services/drillReviewService.ts` → `submitDrillReview`
- UserProgress updates: `lib/services/userProgressService.ts` → `updateUserProgressWithHistory`
- FSRS elapsed_days: `lib/fsrs.ts` line 191
- Optimizer: `lib/fsrs-optimizer.ts` (convertSnapshots, convertReviewLogRows)
