# User Lifecycle & "Cold Start" Parameters Audit

**Date:** 2025-02-02  
**Scope:** Difficulty shift (Didactic vs Clinical), Global vs per-deck weights, Reschedule operation

---

## 1. The "Difficulty" Shift

### Scenario

> A user learns "Cardio" in Didactic year. They rate a Heart Failure question as "Hard." 1 year later, in Clinicals, that question is "Easy." The card carries the "baggage" of the user being a novice.

### How FSRS Handles Difficulty (D)

| Mechanism | Implementation | Location |
|-----------|----------------|----------|
| **Per-card D** | Each condition has its own `fsrsCard.difficulty` in UserProgress | `UserProgress.fsrsCard` |
| **Mean reversion** | D is pulled toward `init_difficulty(Easy)` after each review: `w[7] * init + (1 - w[7]) * current` | `lib/fsrs.ts` line 372-374 |
| **Linear damping** | Difficulty changes damped: `delta_d * (10 - old_d) / 9` | `lib/fsrs.ts` line 358-360 |
| **Rating sensitivity** | `delta_d = -w[6] * (rating - 3)` — Good=3 is neutral; Easy (4) decreases D | `lib/fsrs.ts` line 340 |

With frequent reviews, D normalizes toward the "Easy" initial difficulty. If the user later rates the same card "Easy" repeatedly, D will trend down. The algorithm supports normalization over time.

### Finding

**FSRS naturally normalizes Difficulty** when the user reviews frequently and rates Good/Easy. The mean reversion and rating-based delta will gradually reduce D for cards that have become easier. A 1-year gap with no reviews would leave D unchanged until the next review.

---

## 2. Global vs Per-Deck/Tag Weights

### Audit Question

> Should FSRS weights be Global or Per-Deck/Tag?

### Current Implementation

| Level | Storage | Scope | Status |
|-------|---------|-------|--------|
| **Global weights (w[])** | `PersonalizedFSRSParams` (userId unique) | Per user | ✅ Implemented |
| **Per-system modifiers** | `systemModifiers` JSON in PersonalizedFSRSParams | CV, PULM, etc. | ✅ Implemented |
| **Per-deck/tag** | None | N/A | ❌ Not implemented |
| **Per-card difficulty** | `UserProgress.fsrsCard.difficulty` | Per condition | ✅ Per FSRS design |

### Finding

- Weights are **global per user**, with optional per-system adjustments (`stabilityMultiplier`, `difficultyOffset`).
- Per-deck or per-tag weights are not used; the app uses organ systems, not decks/tags, for FSRS grouping.

**Recommendation:** Continue using global weights per user, with per-system modifiers. This aligns with the audit guidance. Per-card D is already per-condition and will normalize with reviews.

---

## 3. Personalized Params Usage Gap

### Finding

The **scheduling path does not use personalized parameters**:

| Path | FSRS instantiation | Params source |
|------|--------------------|---------------|
| `submitDrillReview` (drillReviewService) | `new FSRS()` | Default only |
| `functions/api/srs/submit.ts` | `new FSRS()` | Default only |
| `srsService.updateReviewOutcome` | `createUserFSRS()` | Deprecated `userSRSConfig.wWeights` (fallback to defaults) |
| `adaptiveFSRSService` | `new FSRS(personalizedParams)` | Personalized when available |

Optimized parameters are stored in `PersonalizedFSRSParams` and exposed via `/api/user/fsrs-params`, but the main review submission flow (`submitDrillReview`) always uses default parameters. This undercuts the value of optimization.

---

## 4. Didactic → Clinical Transition & Reschedule

### Audit Recommendation

> If a user transitions from "Didactic" to "Clinical" (a hard status change), consider running a "Reschedule" operation to recalculate all future intervals based on the current optimal weights.

### Current State

| Feature | Status | Notes |
|---------|--------|-------|
| **yearInProgram** | ✅ Stored | `User.yearInProgram` (Didactic Year 1/2, Clinical Year, etc.) |
| **Profile update** | ✅ Implemented | `/api/user/profile` updates yearInProgram |
| **FSRS integration** | ❌ None | yearInProgram not used for FSRS |
| **Reschedule on transition** | ❌ Not implemented | No trigger on Didactic→Clinical |
| **Reschedule script** | ❌ Not implemented | Documented in `.cline/prompts` but not in codebase |

### Finding

- `yearInProgram` is used for UI (curriculum filter, rotation selector, system presets) but not for FSRS or scheduling.
- There is no Reschedule operation that recomputes due dates for all cards using updated weights.
- The optimization prompt mentions: "Recalculate the due_date for all Card entries based on the new weights" — this is not implemented.

---

## 5. Summary

| Check | Status | Action |
|-------|--------|--------|
| D normalizes over time | ✅ By design | Mean reversion + rating-based updates |
| Global weights per user | ✅ Implemented | PersonalizedFSRSParams, system modifiers |
| Per-card D | ✅ Per condition | UserProgress.fsrsCard.difficulty |
| Scheduling uses optimized params | ❌ No | drillReviewService uses `new FSRS()` defaults |
| yearInProgram → FSRS | ❌ None | No connection |
| Reschedule on lifecycle change | ❌ Not implemented | No Didactic→Clinical trigger |
| Reschedule after optimization | ❌ Not implemented | Documented but not built |

---

## 6. Recommendations

1. **Use personalized params in submit flow**
   - In `submitDrillReview`, load `PersonalizedFSRSParams` for the user and pass them to `new FSRS(params)` when available.
   - Fall back to defaults if none exist.

2. **Reschedule operation (post-optimization)**
   - After optimization updates `PersonalizedFSRSParams`, optionally run a Reschedule job that:
     - Iterates over `UserProgress` for the user.
     - Recomputes `nextReviewAt` (and any stored interval) using the new weights and current card state.
     - Persists updated due dates.

3. **Reschedule on Didactic → Clinical (optional)**
   - On profile update where `yearInProgram` changes to "Clinical Year" (from Didactic), optionally:
     - Trigger optimization if enough reviews exist.
     - Run the same Reschedule operation to align intervals with the new phase.

4. **Document D normalization**
   - Add a short note in docs that per-card difficulty will normalize toward "Easy" over time with frequent Good/Easy ratings, and that this supports the Didactic→Clinical transition without manual intervention.

---

## 7. References

- FSRS difficulty update: `lib/fsrs.ts` (next_ds, mean_reversion, linear_damping)
- PersonalizedFSRSParams: `prisma/schema.prisma`, `lib/fsrs-optimizer.ts`
- submitDrillReview: `lib/services/drillReviewService.ts` line 334
- yearInProgram: `src/types/index.ts`, `prisma/schema.prisma` (User model)
- Reschedule prompt: `.cline/prompts/fsrs-parameter-optimization.md`, `.cline/prompts/fsrs-optimization-loop.md`
