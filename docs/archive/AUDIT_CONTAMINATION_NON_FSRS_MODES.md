# Contamination from Non-FSRS Modes Audit

**Date:** 2025-02-02  
**Scope:** Cramming exclusion + Implicit rating hazard for FSRS integrity

---

## 1. The "Cramming" Exclusion — FAIL ❌

### Rule

> Only "Core PANCE Simulation" (and potentially "Due" cards in Grand Rounds) should write to FSRS Card weights.  
> All other modes ("Rapid Recall," "Cram," "Custom Drill") must log to ReviewLog with `review_type: 'cram'`.  
> The FSRS optimizer must explicitly IGNORE any log where `review_type == 'cram'`.

### Current State

| Mode | Writes to FSRS (UserProgress)? | Passes sessionType/review_type? | Correct? |
|------|--------------------------------|----------------------------------|----------|
| **Core PANCE / QuizView** | ✅ Yes (via submit-review) | ❌ No | ⚠️ Intended |
| **Condition Drill** (use-condition-drill) | ✅ Yes | ❌ No | ❌ Contamination |
| **SmartReviewMode** | ✅ Yes | ❌ No | ⚠️ Unclear (review due?) |
| **Rapid Recall** | ❌ No | N/A (no submit-review) | ✅ OK |
| **Grand Rounds** | ❌ No | N/A (separate API) | ✅ OK |
| **Photo/Contrastive/Other drills** | Depends on path | N/A | Mixed |

### Findings

1. **No mode discrimination in submit-review**

   `DrillSubmitReviewSchema` and `submitDrillReview` do **not** accept `sessionType` or `review_type`. There is no way for the server to distinguish Core PANCE from Condition Drill or other modes.

2. **Unconditional FSRS update**

   When `question.conditionId` exists, `submitDrillReview` always calls `updateUserProgressWithHistory`, which updates `UserProgress.fsrsCard` and `UserProgress.reviewHistory`. There is no branch for cram vs main.

3. **ReviewLog not populated**

   `submitDrillReview` does not write to ReviewLog at all. When it is added (per prior audit), it would need `review_type` and `sessionType` based on the calling mode.

4. **Optimizer uses unfiltered data**

   `fsrsOptimization.ts` uses `UserProgress.reviewHistory`, which aggregates all reviews regardless of mode. It does **not** filter by `review_type` or `sessionType`. If ReviewLog is later used, the documented filter is `review_type: 'real' OR sessionType: 'MAIN'`, but that is not wired in today.

5. **QuestionAttempt.isMainSession**

   `submitDrillReview` creates `QuestionAttempt` but does **not** set `isMainSession`. It therefore defaults to `false`. As a result, all submit-review attempts are treated as non-main, including Core PANCE. The separation between MAIN and drill attempts is inconsistent.

### Recommendation

1. **Add `sessionType` / `review_type` to submit-review**

   - Extend `DrillSubmitReviewSchema` with optional `sessionType: z.enum(['MAIN', 'CRAM', 'RAPID_RECALL']).optional()`.
   - Default to `'MAIN'` only when the request clearly comes from Core PANCE; otherwise default to `'CRAM'`.
   - Pass this through to `submitDrillReview`.

2. **Mode-specific behavior in `submitDrillReview`**

   - When `sessionType === 'MAIN'` or `review_type === 'real'`: update UserProgress (FSRS) and write ReviewLog with `review_type: 'real'`.
   - When `sessionType` is `'CRAM'` or `'RAPID_RECALL'`:  
     - Do **not** update UserProgress (no FSRS card update).  
     - Still create QuestionAttempt (with `isMainSession: false`).  
     - When ReviewLog is implemented, write entries with `review_type: 'cram'` for analytics only.

3. **Client changes**

   - **QuizView (Core PANCE):** Send `sessionType: 'MAIN'`.
   - **use-condition-drill, SmartReviewMode, other drills:** Send `sessionType: 'CRAM'` (or appropriate non-MAIN value).
   - **Rapid Recall:** No submit-review; no change.

4. **Optimizer**

   When switching to ReviewLog as the data source, filter with:

   ```ts
   where: { review_type: 'real' }  // or sessionType: 'MAIN'
   ```

   and explicitly exclude `review_type === 'cram'`.

---

## 2. The "Implicit" Rating Hazard — OK ✅ (with caveats)

### Risk

> In "Rapid Recall," you might not ask for a grade (Again/Hard/Good/Easy). You might just mark it "Correct/Incorrect."  
> If you map Correct → Good and Incorrect → Again automatically, you lose nuance.  
> Do not update FSRS Stability based on binary (Pass/Fail) modes. Treat them as "Rehearsals" (do not update interval).

### Current State

| Mode | Rating source | Updates FSRS? | Verdict |
|------|---------------|---------------|---------|
| **Rapid Recall** | Binary (correct/incorrect) | ❌ No (no submit-review) | ✅ No contamination |
| **Grand Rounds** | Binary (correct/incorrect per question) | ❌ No | ✅ No contamination |
| **Condition Drill** | Implicit (deriveImplicitRating from behavior) | ✅ Yes | ⚠️ Uses 1–4, not binary |
| **SmartReviewMode** | Implicit (deriveImplicitRating) | ✅ Yes | ⚠️ Uses 1–4, not binary |
| **QuizView** | Implicit (deriveImplicitRating) | ✅ Yes | ✅ Intended |

### Finding

- **Rapid Recall** and **Grand Rounds** do not call submit-review and do not update FSRS, so there is no binary→FSRS mapping for them.
- Modes that do call submit-review (**Condition Drill**, **SmartReviewMode**, **QuizView**) use `deriveImplicitRating`, which produces a full 1–4 rating from latency and behavior, not a simple Correct→Good / Incorrect→Again mapping.

The main risk is therefore contamination from cram-like modes updating FSRS at all, not from binary→Good/Again mapping.

### Recommendation

- If any future mode only has binary correctness and calls submit-review:
  - Either do **not** update UserProgress (treat as rehearsal), or
  - Use a conservative mapping (e.g. Correct→Good, Incorrect→Again) with documentation, and prefer excluding such modes from FSRS.

---

## 3. Summary

| Check | Status | Action |
|-------|--------|--------|
| Only Core PANCE updates FSRS | ❌ Fail | Add sessionType; skip FSRS update for CRAM/RAPID_RECALL |
| Cram modes log with review_type: 'cram' | ❌ N/A | ReviewLog not written; add when implementing |
| Optimizer ignores review_type == 'cram' | ❌ N/A | Optimizer uses UserProgress; add filter when using ReviewLog |
| Binary modes do not update FSRS | ✅ Pass | Rapid Recall, Grand Rounds do not update FSRS |
| Binary→Good/Again mapping | ✅ N/A | All submit-review modes use implicit 1–4 rating |

---

## 4. References

- submit-review: `functions/api/drills/submit-review.ts`
- drillReviewService: `lib/services/drillReviewService.ts` (submitDrillReview)
- FSRS optimizer: `scripts/automation/jobs/fsrsOptimization.ts`, `lib/fsrs-optimizer.ts`
- drillSessionManager: `services/drill/drillSessionManager.ts` (sessionType: CRAM for drill sessions)
- ReviewLog schema: `prisma/schema.prisma` (review_type, sessionType)
- RANKED_MODES: `config/training-modes.ts` (GRAND_ROUNDS, SMART_REVIEW, PANCE_SIMULATOR)
