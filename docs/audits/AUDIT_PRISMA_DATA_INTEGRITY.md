# Audit 9 — Prisma Schema, DB Write/Read Integrity, and Medical Content Data Quality

**Date:** 2026-04-01
**Auditor:** Claude (Senior Full-Stack Engineer perspective)
**Scope:** Prisma schema (4145 lines, ~120 models), core write paths for FSRS/progress/review/session/content data, seed scripts, structured medical content models, referential integrity.
**Files Inspected:** `prisma/schema.prisma`, `lib/services/drillReviewService.ts`, `lib/services/userProgressService.ts`, `functions/api/srs/submit.ts`, `functions/api/user/fsrs-params.ts`, `functions/api/drills/_shared/reviewQuestionResolver.ts`, `functions/api/content/condition/[conditionId]/details.ts`, `scripts/seedDatabaseFromRegistry.ts`, `lib/utils/normalization.ts`, `lib/medicalContentFields.ts`, `types/medical-content.ts`

---

## Executive Summary

The Prisma schema is enormous (120 models) and carries significant structural debt from multiple evolution phases. The most critical discovery is a **fundamental FK mismatch** in the FSRS pipeline: `UserProgress.conditionId` has a foreign key reference to `MedicalContent.id`, but every write path passes a `Condition.id` (a different ID namespace). The service silently catches the resulting FK violation, meaning **condition-level FSRS progress is never persisted**. A second critical finding is that the FSRS optimizer endpoint (`fsrs-params.ts`) queries three non-existent Prisma fields (`review_date`, `rating`, `duration`) — it will crash at runtime. The medical content data model has matured well (dedicated columns + canonical normalizer), but the legacy `content` JSON blob creates dual-source ambiguity, and `MedicalContentStructured` is dead code.

---

## Section A: User Progress / FSRS Data

### Finding 1 — UserProgress.conditionId FK Points to Wrong Table
- **Severity:** CRITICAL
- **Type:** Data Integrity (confirmed defect)
- **File:** `prisma/schema.prisma:3397`
- **Root Cause:** `UserProgress.conditionId` declares `MedicalContent @relation(fields: [conditionId], references: [id])`. This means the field must contain a `MedicalContent.id` value. However:
  - `MedicalContent.id` is a random UUID (`uuidv4()` in seed scripts, line 131 of `seedDatabaseFromRegistry.ts`)
  - `MedicalContent.conditionId` (a separate field) stores the Condition registry ID and has `@unique`
  - All FSRS write paths (`drillReviewService.ts:694`, `srs/submit.ts:259`, `questions/attempt.ts`) pass `question.conditionId` which is a `Condition.id` — **not** a `MedicalContent.id`
  - `userProgressService.ts:151` catches the resulting P2003 FK violation and returns silently
- **User Impact:** **Condition-level FSRS progress is never written.** Every drill review, SRS submit, and main session attempt that tries to update `UserProgress` fails silently. The retrievability badges in the Clinical Library, which read from `UserProgress`, show no data. The FSRS optimizer has no condition-level progress to optimize against.
- **Evidence:** `userProgressService.ts` lines 149-162 explicitly catch P2003 (FK violation) errors and return without throwing — this catch exists because the FK mismatch causes violations in production.
- **Recommended Fix:** Change `prisma/schema.prisma` line 3397 from:
  ```
  MedicalContent MedicalContent @relation(fields: [conditionId], references: [id], ...)
  ```
  to:
  ```
  MedicalContent MedicalContent @relation(fields: [conditionId], references: [conditionId], ...)
  ```
  This makes `UserProgress.conditionId` reference `MedicalContent.conditionId` (the condition registry ID), which is what all write paths actually provide. Requires a migration that does NOT drop data — just changes the FK reference column.
- **Blocks Production:** YES — the core FSRS pipeline is silently broken for condition-level tracking.

### Finding 2 — FSRS Optimizer Queries Non-Existent Prisma Fields
- **Severity:** CRITICAL
- **Type:** Correctness (confirmed defect)
- **File:** `functions/api/user/fsrs-params.ts:246-253`
- **Root Cause:** The `ReviewLog.findMany()` call uses three field names that don't exist in the Prisma schema:
  - `review_date` (line 246, 250) → should be `reviewedAt`
  - `rating` (line 251) → should be `grade`
  - `duration` (line 253) → should be `responseTimeMs`
  No `@map` directives exist to alias these. The generated Prisma client will not have these fields.
- **User Impact:** The FSRS parameter optimization endpoint (`POST /api/user/fsrs-params`) will throw a Prisma validation error at runtime. Users cannot trigger personalized FSRS optimization.
- **Evidence:** Schema lines 2527 (`grade Float`), 2532 (`reviewedAt DateTime`), 2535 (`responseTimeMs Int?`). Code line 262: `r.review_date.toISOString()` would also fail since the property doesn't exist on the typed result.
- **Recommended Fix:**
  ```typescript
  orderBy: { reviewedAt: 'asc' },
  select: {
    id: true,
    questionFkId: true,
    reviewedAt: true,   // was: review_date
    grade: true,        // was: rating
    responseTimeMs: true, // was: duration
    ...
  }
  ```
  Then update the snapshot mapping: `date: r.reviewedAt.toISOString()`, `rating: r.grade as ...`.
- **Blocks Production:** YES — optimizer is non-functional.

### Finding 3 — UserTopicProgress.conditionId Has No Foreign Key
- **Severity:** HIGH
- **Type:** Data Integrity (architectural risk)
- **File:** `prisma/schema.prisma:3532-3553`
- **Root Cause:** `UserTopicProgress` stores `conditionId: String` but has no `@relation` to any table. It only has a `User` relation. If a Condition or MedicalContent is deleted, UserTopicProgress rows become orphaned with dangling `conditionId` references.
- **User Impact:** Over time, the variant queue and SRS scheduling may reference non-existent conditions, causing silent errors or stale scheduling.
- **Recommended Fix:** Add a `Condition` relation with `onDelete: Cascade`. Requires migration.
- **Blocks Production:** No, but creates data quality degradation over time.

### Finding 4 — Dual FSRS State: UserProgress vs UserTopicProgress vs Card
- **Severity:** HIGH
- **Type:** Architecture (architectural risk)
- **File:** `drillReviewService.ts:692-730`, `srs/submit.ts:184-338`
- **Root Cause:** Three separate tables store FSRS state:
  1. `UserProgress` — condition-level, `fsrsCard` as JSON blob (currently broken due to Finding 1)
  2. `UserTopicProgress` — condition+taskType level, dedicated columns (`stability`, `difficulty`, `state`, etc.)
  3. `Card` — per-question level, dedicated columns

  `drillReviewService` writes to `UserProgress` and `Card`. `srs/submit` writes to `UserTopicProgress`, `UserProgress`, AND `SRSItem`. There is no single source of truth.
- **User Impact:** Different surfaces read different tables. The library reads `UserProgress`. Smart review reads `UserTopicProgress`. SRS due reads `SRSItem`. They can diverge.
- **Recommended Fix:** Designate `UserTopicProgress` as the primary FSRS source. `UserProgress` becomes a rollup view. `Card` becomes optional per-question granularity. `SRSItem` is deprecated (already annotated as such in schema).
- **Blocks Production:** Not immediately, but creates inconsistent scheduling across surfaces.

### Finding 5 — UserProgress.correctCount Uses accuracy >= 0.7 Threshold, Not wasCorrect
- **Severity:** MEDIUM
- **Type:** Correctness (likely defect)
- **File:** `lib/services/userProgressService.ts:58, 100`
- **Root Cause:** `correctCount` increments when `accuracy >= 0.7`, but the caller (`drillReviewService.ts:697`) passes `accuracy: isCorrect ? 1.0 : 0.0`. So the threshold check is `1.0 >= 0.7` (true) or `0.0 >= 0.7` (false) — which happens to match `wasCorrect`. However, the semantic mismatch means if any future caller passes a partial accuracy (e.g., 0.8 for a "mostly correct" answer), `correctCount` would increment even though the answer wasn't fully correct.
- **User Impact:** No current impact (all callers pass 0 or 1), but fragile against future callers.
- **Recommended Fix:** Change to `isCorrect ? 1 : 0` and accept a boolean `isCorrect` parameter.
- **Blocks Production:** No.

---

## Section B: Session / Question Data

### Finding 6 — QuestionAttempt Has No Foreign Keys at All
- **Severity:** HIGH
- **Type:** Data Integrity (architectural risk)
- **File:** `prisma/schema.prisma:2368-2404`
- **Root Cause:** `QuestionAttempt` stores `userId`, `questionId`, `conditionId`, `medicalContentId` — all as plain `String` fields with no `@relation` declarations. No FK constraints are enforced at the DB level. This is the table scanned by the O(N) aggregate query in `questions/attempt.ts`.
- **User Impact:**
  - No cascade delete: if a User is deleted, QuestionAttempts persist as orphans (unlike every other user-owned table that cascades)
  - No referential integrity on questionId: attempts can reference deleted or non-existent questions
  - The O(N) scan already has no FK index benefit
- **Recommended Fix:** Add `User @relation(fields: [userId], references: [id], onDelete: Cascade)` and ideally `Question @relation(fields: [questionId], references: [id], onDelete: SetNull)`. Requires migration.
- **Blocks Production:** No, but growing orphan data and missing cascade on user delete.

### Finding 7 — ReviewLog.questionId vs questionFkId Dual-Field Confusion
- **Severity:** MEDIUM
- **Type:** Architecture / Maintainability
- **File:** `prisma/schema.prisma:2525, 2544`
- **Root Cause:** `ReviewLog` has two question reference fields:
  - `questionId: String?` — no FK, used by `drillReviewService` for all writes (stores PreGeneratedQuestion IDs)
  - `questionFkId: String?` — FK to `Question.id`, rarely populated

  The write paths always set `questionId` (which may contain a `PreGeneratedQuestion.id`, not a `Question.id`). The `questionFkId` is only populated by legacy main-session attempts. The FSRS optimizer (`fsrs-params.ts`) selects `questionFkId` for grouping.
- **User Impact:** The optimizer can't group reviews by question when they come from drills (because `questionFkId` is null). Only main-session reviews are groupable.
- **Recommended Fix:** Either unify into one field (rename `questionId` to `questionSourceId` to clarify it's polymorphic) or add FK resolution logic in the optimizer.
- **Blocks Production:** No.

### Finding 8 — PreGeneratedQuestion.questionData JSON Has No Schema Enforcement
- **Severity:** MEDIUM
- **Type:** Data Integrity / Correctness
- **File:** `prisma/schema.prisma:2212`, `lib/services/drillReviewService.ts:37-49`
- **Root Cause:** `PreGeneratedQuestion.questionData` is `Json` — completely untyped at the DB level. The `QuestionData` interface in `drillReviewService.ts` shows 8+ possible field names for the same concept:
  - Correct answer: `correctAnswer`, `answer`, `correct_option`, `correctChoice`, `correctIndex`
  - Stem: `stem`, `question`, `vignette`, `text`
  - Options: `options`, `choices`

  The `resolveCorrectAnswer()` function handles these aliases, but any new AI-generated question that uses a slightly different key name silently loses correctness resolution (falls through to option matching).
- **User Impact:** If a generated question uses an unexpected key name (e.g., `correct_answer` with underscore), correctness detection fails silently. The answer would always be marked incorrect.
- **Recommended Fix:** Add a Zod schema for `questionData` that validates at insertion time. Normalize all field names to canonical forms when saving to the database. The `QuestionData` interface should be the single schema.
- **Blocks Production:** Not blocking, but creates a fragile correctness pipeline.

---

## Section C: Medical Content / Library Data

### Finding 9 — Condition.id vs MedicalContent.id vs MedicalContent.conditionId — Triple Identity Crisis
- **Severity:** HIGH
- **Type:** Architecture (confirmed)
- **Files:** `prisma/schema.prisma` (models Condition:431, MedicalContent:1577), `scripts/seedDatabaseFromRegistry.ts:131-134`
- **Root Cause:** Three different IDs exist for the "same" medical concept:
  1. `Condition.id` — the condition registry ID (e.g., `cond-chest-pain` or similar slug)
  2. `MedicalContent.id` — a random UUID (assigned via `uuidv4()` in seed scripts)
  3. `MedicalContent.conditionId` — equals `Condition.id`, stored as `@unique` on MedicalContent

  Different tables reference different IDs:
  - `PreGeneratedQuestion.conditionId` → FK to `Condition.id`
  - `UserProgress.conditionId` → FK to `MedicalContent.id` (the random UUID)
  - `ReviewLog.conditionId` — no FK, stores whatever the write path provides (usually `Condition.id`)
  - `QuestionAttempt.conditionId` — no FK, stores whatever is available

  This creates a fundamental join problem: you can't reliably aggregate a user's progress across questions and reviews without mapping between ID namespaces.
- **User Impact:** Data is fragmented across ID namespaces. The library's progress-map reads `UserProgress` by `conditionId` expecting MedicalContent UUIDs, but ReviewLog stores Condition IDs. Cross-referencing is broken.
- **Recommended Fix:** Long-term: unify `Condition.id == MedicalContent.conditionId` as the canonical ID. Short-term: fix the `UserProgress` FK to reference `MedicalContent.conditionId` (Finding 1).
- **Blocks Production:** Partially — see Finding 1.

### Finding 10 — MedicalContent Has Dual Storage: Columns AND content JSON Blob
- **Severity:** MEDIUM
- **Type:** Architecture / Maintainability
- **File:** `prisma/schema.prisma:1577-1681`
- **Root Cause:** `MedicalContent` has ~30 dedicated columns (`symptoms`, `treatment`, `diagnostics`, `overview`, etc.) AND a `content Json?` blob that can contain the same fields. The `normalizeMedicalContent()` function handles column-level fields, but the `content` blob is only processed via `universalParser` when explicitly accessed.

  The details endpoint (`content/condition/[conditionId]/details.ts`) reads column-level fields. The library endpoint reads different fields. Some seed scripts write to columns, others write to the `content` blob.
- **User Impact:** Inconsistent content display between library and detail views. Some conditions may show data in one view but not another.
- **Recommended Fix:** Migrate all `content` JSON blob data into dedicated columns (one-time migration script). Then make `content` column read-only/deprecated. The canonical normalizer already handles column-level fields correctly.
- **Blocks Production:** No, but creates unpredictable content display.

### Finding 11 — MedicalContentStructured Model is Dead Code
- **Severity:** LOW
- **Type:** Maintainability (cleanup)
- **File:** `prisma/schema.prisma:1683-1702`
- **Root Cause:** `MedicalContentStructured` (with parsed clinical_pearls, history_key_features, diagnostic_labs, etc.) is only referenced from a single migration script (`scripts/data-migration/v2-backfill.ts`). No production code reads or writes to it.
- **User Impact:** None. But it occupies schema space and generates unused Prisma client types.
- **Recommended Fix:** Remove from schema or mark as deprecated with a comment.
- **Blocks Production:** No.

### Finding 12 — Duplicate Field Names in medicalContentFields.ts
- **Severity:** LOW
- **Type:** Maintainability
- **File:** `lib/medicalContentFields.ts:49-54`
- **Root Cause:** Both `physicalExam` and `physical_exam` appear in `MEDICAL_CONTENT_TEXT_FIELDS`. Both `riskFactors` and `risk_factors` appear. The `normalizeMedicalContent()` function runs `parseTextField` on both, potentially processing the same data twice if both exist on a record.
- **User Impact:** No visible impact — at worst, a field is parsed twice.
- **Recommended Fix:** Canonicalize to one name per field. Use `legacyNames` mapping to handle the alias.
- **Blocks Production:** No.

---

## Section D: Platform / Admin / Supporting Tables

### Finding 13 — Universal Cascade Delete on User Makes Deletion Catastrophic
- **Severity:** HIGH
- **Type:** Data Integrity (confirmed)
- **File:** `prisma/schema.prisma` (all User relations)
- **Root Cause:** 40+ models have `onDelete: Cascade` on their `User` relation. If a user is deleted (via Clerk webhook `user.deleted` event which calls `prisma.user.delete()`), ALL of the following are permanently destroyed:
  - All ReviewLogs (FSRS training data)
  - All SRSItems (scheduling state)
  - All UserProgress records
  - All UserTopicProgress records
  - All Cards (per-question FSRS state)
  - All StudySessions (performance history)
  - All SavedQuestions
  - All DailyStreaks
  - All ConceptGaps, ConfusionPairs, Achievements
  - The PersonalizedFSRSParams (optimizer results)

  But `QuestionAttempt` (Finding 6) does NOT cascade — it becomes an orphan.
- **User Impact:** Accidental account deletion (or admin action) permanently destroys all study data with no recovery path.
- **Recommended Fix:** Implement soft-delete on User model (`deletedAt DateTime?`). Change webhook from `prisma.user.delete()` to `prisma.user.update({ data: { deletedAt: new Date(), status: 'deleted' } })`. Add a 30-day retention cron for permanent deletion.
- **Blocks Production:** Not blocking daily use, but one Clerk webhook event away from catastrophic data loss.

### Finding 14 — 111 Models Without @updatedAt Auto-Update
- **Severity:** LOW
- **Type:** Maintainability (architectural risk)
- **File:** `prisma/schema.prisma` (widespread)
- **Root Cause:** Only 9 of ~120 models use `@updatedAt` for automatic timestamp management. The rest have `updatedAt DateTime` requiring manual `updatedAt: new Date()` in every write. If any write path omits this, the timestamp goes stale.
- **User Impact:** Stale `updatedAt` timestamps affect cache invalidation logic, "last modified" displays, and sync conflict resolution (which is timestamp-based in `sync.ts`).
- **Recommended Fix:** Add `@updatedAt` to the critical models: `UserProgress`, `UserTopicProgress`, `SRSItem`, `ReviewLog`, `MedicalContent`, `Condition`, `StudySession`. This is additive — Prisma handles it automatically on update.
- **Blocks Production:** No.

### Finding 15 — SRSItem Marked @deprecated but Still Written To
- **Severity:** MEDIUM
- **Type:** Architecture (cleanup)
- **File:** `prisma/schema.prisma:2594` (deprecated comment), `functions/api/srs/submit.ts:309-339`, `functions/api/sync.ts`
- **Root Cause:** The schema comment says "Do not add new writes" but `srs/submit.ts` still writes to `SRSItem` on every SRS review. `sync.ts` does a full delete-then-insert of SRS items.
- **User Impact:** Wasted writes and potential confusion between SRSItem scheduling and FSRS scheduling.
- **Recommended Fix:** If `SRSItem` is deprecated, remove writes from `srs/submit.ts` (guard with `if (srsItemId)` already exists but executes). Or formally un-deprecate it if it's still needed.
- **Blocks Production:** No.

---

## Top 10 Findings in Priority Order

| # | Finding | Severity | Type | Blocks Prod? |
|---|---------|----------|------|--------------|
| 1 | **UserProgress.conditionId FK → MedicalContent.id mismatch** — all FSRS progress writes fail silently | CRITICAL | Data Integrity | YES |
| 2 | **fsrs-params.ts queries 3 non-existent fields** (review_date, rating, duration) | CRITICAL | Correctness | YES |
| 3 | **Triple identity crisis** (Condition.id vs MedicalContent.id vs .conditionId) | HIGH | Architecture | Partial |
| 4 | **Dual FSRS state** across UserProgress/UserTopicProgress/Card with no single source of truth | HIGH | Architecture | No |
| 5 | **QuestionAttempt has zero FK constraints** — no cascade on User delete, orphan data | HIGH | Data Integrity | No |
| 6 | **Universal cascade delete on User** — 40+ tables wiped on account deletion | HIGH | Data Integrity | No |
| 7 | **UserTopicProgress.conditionId has no FK** — orphan-able on condition delete | HIGH | Data Integrity | No |
| 8 | **PreGeneratedQuestion.questionData has no schema enforcement** — fragile correctness | MEDIUM | Correctness | No |
| 9 | **MedicalContent dual storage** (columns + content JSON blob) | MEDIUM | Architecture | No |
| 10 | **SRSItem deprecated but still written to** | MEDIUM | Architecture | No |

---

## 3 Highest-Leverage Fixes

### Fix 1: Change UserProgress FK to Reference MedicalContent.conditionId (45 min)

**Why:** Unblocks the entire FSRS progress pipeline. Every drill review, SRS submit, and session attempt currently silently fails to persist condition-level progress.

**Steps:**
1. Create migration:
   ```sql
   -- Drop existing FK constraint
   ALTER TABLE "UserProgress" DROP CONSTRAINT IF EXISTS "UserProgress_conditionId_fkey";
   -- Add new FK referencing conditionId column instead of id
   ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_conditionId_fkey"
     FOREIGN KEY ("conditionId") REFERENCES "MedicalContent"("conditionId") ON DELETE CASCADE;
   ```
2. Update `prisma/schema.prisma` line 3397:
   ```prisma
   MedicalContent MedicalContent @relation(fields: [conditionId], references: [conditionId], onDelete: Cascade)
   ```
3. Run `prisma generate` to update the client.
4. Remove the P2003 catch in `userProgressService.ts` (lines 149-162) — it should now throw on real errors.
5. Verify with a drill review that `UserProgress` rows are actually created.

### Fix 2: Fix fsrs-params.ts Field Name Mismatches (15 min)

**Why:** Unblocks FSRS parameter optimization — currently crashes at runtime.

**Steps:**
1. In `functions/api/user/fsrs-params.ts`, line 246-257:
   ```typescript
   orderBy: { reviewedAt: 'asc' },
   select: {
     id: true,
     questionFkId: true,
     reviewedAt: true,
     grade: true,
     responseTimeMs: true,
     stability: true,
     difficulty: true,
     system: true,
   },
   ```
2. Update snapshot mapping (line 261-267):
   ```typescript
   const allSnapshots: ReviewSnapshot[] = reviewRows.map((r) => ({
     date: r.reviewedAt.toISOString(),
     stability: r.stability,
     difficulty: r.difficulty,
     rating: r.grade as ReviewSnapshot['rating'],
     state: r.state as ReviewSnapshot['state'],
   }));
   ```
3. Fix line 370 (in-process optimizer): `auth.userId` → `userId` (from Audit 8 Finding 3).

### Fix 3: Add User Relation + Cascade to QuestionAttempt (20 min)

**Why:** Prevents orphan data on user deletion and enables future FK-based query optimization.

**Steps:**
1. Add to `QuestionAttempt` in schema:
   ```prisma
   User User @relation(fields: [userId], references: [id], onDelete: Cascade)
   ```
2. Add inverse relation in `User` model:
   ```prisma
   QuestionAttempt QuestionAttempt[]
   ```
3. Create migration and run `prisma generate`.
4. Verify the existing data satisfies the FK constraint (all `userId` values exist in `User`).

---

## Minimal Safe Implementation Plan

### Day 1 (Critical — Unblock FSRS Pipeline)
1. **Fix UserProgress FK** (Fix 1) — This is the #1 production blocker. FSRS progress is silently not being saved.
2. **Fix fsrs-params field names** (Fix 2) — Unblocks FSRS optimizer.
3. **Test**: Run a drill review end-to-end. Verify UserProgress row is created. Run FSRS optimizer. Verify it returns params.

### Day 2 (Integrity Hardening)
4. **Add QuestionAttempt FK** (Fix 3)
5. **Add UserTopicProgress → Condition FK** (Finding 7)
6. **Implement soft-delete on User** (Finding 13) — change webhook handler
7. **Add `@updatedAt` to critical models** — UserProgress, UserTopicProgress, MedicalContent

### Day 3 (Data Model Cleanup)
8. **Standardize questionData schema** — Add Zod validation on PreGeneratedQuestion insertion
9. **Remove MedicalContentStructured** (dead code) or begin populating it
10. **Guard or remove SRSItem writes** in `srs/submit.ts`
11. **Migrate content JSON blob data** into dedicated MedicalContent columns (one-time script)

---

## What to Audit Next

**Audit 10 — Frontend Data Contracts and API Response Handling**

The schema audit revealed that the backend writes data in multiple formats and ID namespaces. The next audit should verify that frontend components correctly handle:
- The `toResponse` serialization (`result.data ?? result`) ambiguity flagged in Audit 8
- Response shape variations across authenticated/public/error paths
- Null handling for all the `?`-optional fields that the schema allows
- Client-side FSRS computations (retrievability badges) against the fixed UserProgress data
- Offline sync conflict resolution with the corrected data model

Key files: `services/core/attemptService.ts`, `hooks/useDrillFSRS.ts`, `lib/services/sync/syncManager.ts`, `components/library/ClinicalReferenceLibrary.tsx` (progress-map consumer).
