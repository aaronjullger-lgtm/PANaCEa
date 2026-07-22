# Metacognition Engine — Implementation Audit

**Date:** 2025-02-01  
**Scope:** `functions/api/intelligence/profile.ts`, dashboard endpoints, SRS integration, student-context wiring

**Audit fixes applied:** 2025-02-01 — All three critical fixes implemented.

---

## Critical Fixes (✅ FIXED)

### 1. **student-context.ts: Invalid Prisma `question` Relation** ✅ FIXED

**Location:** `functions/api/knowledge/cache/student-context.ts` (lines 91–105)

**Issue:** The query used `question: { select: {...} }` on `QuestionAttempt`, but **QuestionAttempt has no `question` relation**. Prisma would throw.

**Fix applied:** Removed invalid `question` include. Now selects only `selectedAnswer`, `system`, `conditionId`, `questionType` from attempts. Builds `weakSpotText` from `tutorContext` + compact list of "System: X | Condition: Y | You chose: Z" per attempt. Runs `generateTutorContext` and attempt fetch in parallel.

---

### 2. **concept-gaps.ts: Wrong userId for QuestionAttempt** ✅ FIXED

**Location:** `functions/api/intelligence/concept-gaps.ts` (line 160)

**Issue:** Used Clerk ID where internal `User.id` was required; concept gaps returned no data.

**Fix applied:** Added `resolveUserId(prisma, auth.userId)` and early return 404 if user not found. Response still uses `auth.userId` for the `analysis.userId` field (API contract).

---

### 3. **Profile.ts: Question Lookup Skips PreGeneratedQuestion** ✅ FIXED

**Location:** `functions/api/intelligence/profile.ts` (lines 178–200)

**Issue:** Only queried `Question`; drill attempts (PreGeneratedQuestion) had no enrichment.

**Fix applied:** Now queries both `Question` and `PreGeneratedQuestion` in parallel. Builds unified `questionMap` from both; for PreGeneratedQuestion uses `conditionId` as topic fallback. Deduplicates `questionIds` before query.

---

## Logical Omissions

### 1. **Plan vs. Implementation: “StudyQueue” vs. StudyRecommendation**

**Plan:** Schedule review items in the “StudyQueue” table.

**Implementation:** Uses `StudyRecommendation` with `type: 'review'` and `data.scheduledFor`. This matches the intent but differs in naming. No separate `StudyQueue` model exists.

**Recommendation:** Document that `StudyRecommendation` (type=review, source=metacognition_srs) is the canonical “StudyQueue” for this feature.

---

### 2. **“Pharmaceutical Therapeutics” Task Mapping**

**Plan:** Group failures by `task` (e.g., “Pharmaceutical Therapeutics”).

**Implementation:** `mapTask()` maps “pharm” to “Clinical Intervention,” not “Pharmaceutical Therapeutics.” PANCE Blueprint tasks are: History Taking, Physical Exam, Differential Diagnosis, Clinical Intervention.

**Recommendation:** If “Pharmaceutical Therapeutics” is a required content area, add an explicit mapping or a separate `contentArea` dimension.

---

### 3. **Review Queue Completion**

**Missing:** No endpoint to mark review items as completed. Users can see due items via `GET /api/dashboard/review-queue` but cannot complete them in the UI.

**Recommendation:** Add `PATCH /api/dashboard/review-queue/[id]` to set `status: 'completed'` and `completedAt`.

---

### 4. **OSCE SRS Scheduling**

**Plan:** SRS scheduling for concept failures.

**Implementation:** SRS is wired into `questions/attempt` and `drills/submit-review` only. OSCE grading creates `ConceptGap` records but does **not** call `scheduleConceptReview`.

**Recommendation:** In `functions/api/osce/analysis/grade.ts`, after `persistGradeAndConceptGap`, call `scheduleConceptReview` when `differentialFailed` (or when red flags are missed) for the inferred system.

---

## Technical Debt

### 1. **calculateConceptGaps Cognitive Complexity**

**Location:** `functions/api/intelligence/profile.ts` (lines 84–235)

**Issue:** SonarQube reports complexity ~51 (target ≤15). The function handles OSCE and QuestionAttempt aggregation in one place.

**Recommendation:** Extract helpers such as `aggregateOsceFailures()`, `aggregateQuestionFailures()`, and `mergeIntoBySystemAndTask()` to reduce complexity.

---

### 2. **DRY: Duplicate Streak Logic**

**Locations:** `functions/api/dashboard/stats.ts`, `functions/api/streaks/[userId].ts`

**Issue:** Both implement streak computation. `stats` uses a simplified version; `streaks/[userId]` includes “active yesterday” continuation.

**Recommendation:** Move streak logic to `lib/services/streakService.ts` (which already exists) and have both endpoints call it.

---

### 3. **DRY: inferSystemFromCase Duplication**

**Locations:** `functions/api/intelligence/profile.ts`, `functions/api/osce/analysis/grade.ts`

**Issue:** `inferSystemFromCase` is duplicated with slight differences (e.g., grade.ts returns “Cardiology,” profile returns “Cardiovascular”).

**Recommendation:** Export a shared `inferSystemFromCase` from `lib/` or `functions/api/_shared/` and use it in both files.

---

### 4. **DailyStreak userId Semantics**

**Issue:** `DailyStreak.userId` is a FK to `User`, but `streaks/record.ts` stores `auth.userId` (Clerk ID). If `User.id` ≠ Clerk ID, this breaks referential integrity.

**Recommendation:** Audit whether `DailyStreak` should use internal `User.id` or Clerk ID consistently. If Clerk ID is intentional, the schema FK may need to be relaxed or documented as non-standard.

---

## Repo Consistency

| Aspect | Status | Notes |
|--------|--------|-------|
| Naming | ✅ | `calculateConceptGaps`, `generateTutorContext`, `scheduleConceptReview` follow existing style |
| Folder structure | ✅ | `functions/api/intelligence/`, `functions/api/dashboard/` match conventions |
| Auth | ✅ | Uses `authenticatedEndpoint`, `resolveUserId` where needed |
| Prisma | ✅ | Uses `createEdgePrismaClient`, `safePrismaDisconnect` |
| CORS | ✅ | `onRequestOptions = withCors()` where applicable |
| Logging | ✅ | Uses `createEndpointLogger` |
| Zod validation | ✅ | Schemas used for request validation |
| Edge runtime | ✅ | No Node APIs; `lib/constants/blueprint` is Edge-safe |

---

## Scalability and Brittleness

1. **Large wrongAttempts set:** `take: 2000` on wrong attempts + fetching questions can be heavy for active users. Consider pagination or limiting to the last N days.

2. **No index for SRS dedupe:** `scheduleConceptReview` filters by `userId`, `type`, `topic`, `status`, `createdAt`. An index on `(userId, type, topic, status, createdAt)` would help.

3. **Concept key format:** `system|conditionId` and `system|questionType` are string-based. If `conditionId` contains `|`, parsing breaks. Consider a structured format (e.g., JSON) or escaping.

4. **Quiz accuracy groupBy:** `questionAttempt.groupBy({ by: ['wasCorrect'] })` scans all attempts. For users with millions of attempts, consider materialized stats or a bounded window.

---

## Verification Steps

1. **Profile endpoint:**  
   `GET /api/intelligence/profile` (authenticated)  
   - Returns `conceptGaps` and `tutorContext`.  
   - Run with a user who has OSCE results and question attempts.

2. **Dashboard stats:**  
   `GET /api/dashboard/stats`  
   - Returns `currentStreak`, `weakestSystem`, `predictedPassChance`.  
   - With no OSCE: `predictedPassChance` should use quiz accuracy.  
   - `currentStreak` should match `streaks/[userId]` when the same user/date logic applies.

3. **Review queue:**  
   `GET /api/dashboard/review-queue`  
   - Returns `dueToday` for metacognition SRS items.  
   - Record attempts, then check that items appear when `scheduledFor` is today.

4. **Student context:**  
   `POST /api/knowledge/cache/student-context`  
   - Will likely fail until the invalid `question` relation is fixed.  
   - After fix, verify Gemini cache creation and that `generateTutorContext` is included.

5. **SRS integration:**  
   - `POST /api/questions/attempt` with `wasCorrect: false`, `system`, `conditionId`.  
   - Confirm a `StudyRecommendation` is created with `type: 'review'` and `data.source: 'metacognition_srs'`.  
   - Submit a second attempt for the same concept on the same day; should not create a duplicate (dedupe check).

6. **Concept gaps with PreGeneratedQuestion:**  
   - Create wrong attempts from a drill (PreGeneratedQuestion).  
   - Verify `calculateConceptGaps` still produces meaningful gaps using `attempt.system` / `attempt.conditionId`.

---

## Summary

| Category | Count |
|----------|-------|
| Critical Fixes | 3 |
| Logical Omissions | 4 |
| Technical Debt Items | 4 |
| Verification Steps | 6 |

**Highest priority:** Fix the invalid `question` relation in `student-context.ts` and the `userId` mismatch in `concept-gaps.ts`, as both directly affect user-facing behavior.
