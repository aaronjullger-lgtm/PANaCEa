# Main Session / Implicit FSRS Pipeline — Production Audit

**Date:** 2026-04-01
**Scope:** End-to-end main study session: entry → question render → answer → implicit rating → FSRS scheduling → review logs → session recovery → workload projection
**Auditor:** Claude (Senior Full-Stack Engineer)

---

## Flow Integrity Map

Each step in the pipeline and where it can break:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. SESSION ENTRY                                                        │
│    QuizView receives initialQueue from useSessionGenerator              │
│    → useQuizSessionRecovery checks localStorage for saved state         │
│    → implicitMetrics.startQuestion() + behavioralTracker.start()        │
│    ⚠ BREAK POINT: Recovery can restore stale isAnswered=true state      │
│    ⚠ BREAK POINT: implicitMetrics.startQuestion in useEffect dep array  │
│      causes re-init on every currentQuestion reference change           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. QUESTION DISPLAY                                                     │
│    QuestionDisplay component renders stem + options                      │
│    → Text highlighting via mouseup handler                              │
│    → OptionHoverTracker tracks cursor micro-kinetics                    │
│    ✓ Stable — no data integrity issues here                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. ANSWER SELECTION (handleOptionClick)                                 │
│    → Records firstSelectedAnswer, increments answerChangeCount          │
│    → implicitMetrics.recordAnswerSelection(index)                       │
│    → behavioralTracker.recordFirstInteraction() / recordAnswerChange()  │
│    → microKinetics.recordSelection()                                    │
│    ✓ Stable — metrics collection works correctly                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. ANSWER SUBMISSION (handleSubmitAnswer)                               │
│    → Correctness: selectedAnswerIndex === correctAnswerIndex             │
│    → behavioralTracker.finalize() → telemetryForApi                     │
│    → deriveFsrsRatingFromBehavior() → client-side FSRS rating (1-4)    │
│    ⚠ BREAK POINT: DUAL WRITE — both queueAnswer AND queueReview        │
│    ⚠ BREAK POINT: implicitMetrics.submitAnswer() POSTs to              │
│      /api/user/behavior-metrics (3rd write, separate from FSRS)         │
│    → Client-side streak update, performance record, session analytics   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌──────────────────────────────┐  ┌──────────────────────────────────────┐
│ 5A. syncManager.queueAnswer  │  │ 5B. syncManager.queueReview          │
│   → /api/questions/attempt   │  │   → /api/drills/submit-reviews       │
│   → QuestionAttempt CREATE   │  │   → (batch, syncs to submit-review)  │
│   → UserQuestionSeen UPSERT  │  │   → resolveReviewQuestion            │
│   → Question stats UPDATE    │  │   → submitDrillReview()              │
│   → UserTopicProgress FSRS   │  │   → QuestionAttempt (5-min dedup)    │
│   → Rolling 360 UPDATE       │  │   → UserProgress FSRS (different!)   │
│   ⚠ NO dedup on attempt      │  │   → ReviewLog CREATE                 │
│   ⚠ FSRS → UserTopicProgress │  │   → Card dual-write UPSERT          │
│                              │  │   → Rolling 360 (skipped if reused)  │
│                              │  │   → ConfusionPair (if incorrect)     │
│                              │  │   → Sibling propagation              │
│                              │  │   ⚠ FSRS → UserProgress              │
└──────────────────────────────┘  └──────────────────────────────────────┘
                        │                       │
                        └───────────┬───────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. DATA INTEGRITY RESULT                                                │
│    ⚠ CRITICAL: Two FSRS systems updated for same answer:                │
│       - UserTopicProgress (from /api/questions/attempt)                  │
│       - UserProgress (from drillReviewService)                          │
│    ⚠ QuestionAttempt may be created TWICE if timing unlucky             │
│    ⚠ Rolling 360 protected by weCreatedAttempt guard (mostly safe)      │
│    ⚠ ReviewLog only created by drillReviewService path                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. UI UPDATE (post-answer)                                              │
│    → isAnswered=true, streak update, haptic feedback                    │
│    → Peer stats fetched (500ms delay)                                   │
│    → Pearls loaded if conditionId present                               │
│    → ExplanationPanel / SocraticTutor available                         │
│    → "Next" advances queue, resets all state                            │
│    ✓ Stable — UI state transitions are clean                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Findings

### Finding 1: DUAL FSRS WRITE — Two Different Tables Updated for Same Answer

- **Severity:** CRITICAL
- **Type:** Data Integrity
- **Files:** `components/session/QuizView.tsx` (lines 995-1007, 1215-1236), `functions/api/questions/attempt.ts`, `lib/services/drillReviewService.ts`
- **Root cause:** `handleSubmitAnswer` in QuizView fires BOTH `syncManager.queueAnswer()` (→ `/api/questions/attempt` → updates **UserTopicProgress** via FSRS) AND `syncManager.queueReview()` (→ `/api/drills/submit-review` → updates **UserProgress** via FSRS). These are two completely different FSRS state stores for the same concept.
- **User impact:** The same answer updates two separate scheduling tables with different algorithms, different card states, and potentially different next-review dates. Whichever table is queried for "what's due" will show inconsistent data. If one fails and the other succeeds, the user's SRS state diverges silently. The FSRS optimizer sidecar reads from ReviewLog, which is only written by the drillReviewService path — meaning the optimizer never sees data from the attempt.ts path, and vice versa.
- **Recommended fix:** The main session should use ONE canonical write path. Since drillReviewService is more complete (ReviewLog, confusion pairs, sibling propagation, Card dual-write), remove the FSRS scheduling from `/api/questions/attempt` for main sessions, OR stop calling `queueReview` from QuizView for main sessions. The simplest fix: remove the `queueReview` call from QuizView's `handleSubmitAnswer` entirely, and add the missing ReviewLog/UserProgress writes to `/api/questions/attempt`.
- **Blocks production:** YES — this is the single most important fix.

---

### Finding 2: `gradeContinuous` Passed as Rating to `fsrs.next()` in drillReviewService

- **Severity:** HIGH
- **Type:** Correctness
- **File:** `lib/services/drillReviewService.ts` (line 608)
- **Root cause:** Line 608 calls `fsrs.next(currentCard, new Date(), gradeContinuous)` where `gradeContinuous` is a float in [1.0, 4.0]. Meanwhile, `/api/questions/attempt` calls `fsrs.next(card, now, fsrsRating)` where `fsrsRating` is a discrete integer (1 or 3, after Ghost Grader). The FSRS `next()` method accepts `Rating | number` and handles floats via interpolation — so this isn't a crash, but it means the two paths produce **different scheduling** for the same behavioral signals. drillReviewService uses continuous interpolation (e.g., 2.7 → interpolated interval), while attempt.ts uses discrete (1 or 3 → fixed intervals).
- **User impact:** Even if you fix Finding 1 by choosing one path, the scheduling divergence means historical data from one path won't match the other. Cards that went through drillReviewService have different stability/difficulty than those through attempt.ts.
- **Recommended fix:** Decide on one approach. Since the system is "binary rating" (Again=1, Good=3), the drillReviewService should pass `rating` (the discrete value after Ghost Grader), not `gradeContinuous`. The continuous grade is useful for ReviewLog telemetry but should NOT be the FSRS scheduling input.
- **Blocks production:** YES — causes systematic scheduling drift.

---

### Finding 3: `useImplicitMetrics` Returns Stale Ref Values

- **Severity:** MEDIUM
- **Type:** Correctness / UX
- **File:** `hooks/useImplicitMetrics.ts` (lines 276-285)
- **Root cause:** The hook returns `isSubmitting: isSubmittingRef.current` and `submissionError: submissionErrorRef.current` directly from refs. These values are captured at render time and never trigger re-renders. Any component reading `isSubmitting` will always see `false` because the ref update happens asynchronously after render.
- **User impact:** Low — these values aren't currently used for UI gating. But if anyone tries to show a "submitting..." indicator based on this hook, it won't work.
- **Recommended fix:** If these values need to be reactive, convert to `useState`. If not, remove them from the return type to avoid confusion.
- **Blocks production:** No.

---

### Finding 4: Session Recovery Restores `isAnswered=true` Without Restoring Correctness State

- **Severity:** MEDIUM
- **Type:** UX / Data Integrity
- **File:** `hooks/useQuizSessionRecovery.ts` (via QuizView lines 476-500)
- **Root cause:** The `onRestore` callback restores `isAnswered`, `selectedAnswerIndex`, `eliminatedAnswers`, `localNote`, etc. But it does NOT restore the correctness result, `srsResult`, `currentStreak`, `showRationale`, or `alternateRationale`. If a user refreshes while viewing the explanation panel, they come back to an "answered" state but the explanation panel is collapsed, streak is reset to 0, and no SRS result is shown.
- **User impact:** After a page refresh mid-explanation, the user sees the answered state (correct answer highlighted) but loses context. The streak counter resets. The SRS feedback card is blank. Worse, if the user clicks "Next" from this state, the answer was already submitted via syncManager before the refresh, so no duplicate submission occurs — but the session experience is degraded.
- **Recommended fix:** Either (a) save and restore correctness + srsResult in the recovery state, or (b) don't restore `isAnswered=true` at all — force the user to re-answer (since the previous answer was already synced, the duplicate will be caught by the 5-minute dedup in drillReviewService, but not in attempt.ts — see Finding 1).
- **Blocks production:** No, but causes UX confusion.

---

### Finding 5: `answerChangeCountRef.current` in `useEffect` Dependency Array

- **Severity:** MEDIUM
- **Type:** Correctness / React Anti-pattern
- **File:** `components/session/QuizView.tsx` (lines 522-533)
- **Root cause:** The session-save `useEffect` includes `answerChangeCountRef.current` and `firstSelectedAnswerRef.current` in its dependency array. Refs do not trigger re-renders, so changes to these values will NOT cause the effect to re-run. The session state will be saved with stale answer-change data until some other dependency (like `selectedAnswerIndex`) changes.
- **User impact:** If a user changes answers multiple times but doesn't change any other state, the debounced save won't capture the intermediate answer changes. On crash recovery, `answerChangeCount` may be 0 when it should be 2.
- **Recommended fix:** Read ref values inside the effect body (they'll be current at execution time) rather than listing them as dependencies. Remove them from the dep array.
- **Blocks production:** No.

---

### Finding 6: No Guard Against Double Submission in `handleSubmitAnswer`

- **Severity:** MEDIUM
- **Type:** Data Integrity / Race Condition
- **File:** `components/session/QuizView.tsx` (line 897)
- **Root cause:** The guard `if (selectedAnswerIndex === null || !currentQuestion || isAnswered || isSubmitting) return;` uses state values. `isSubmitting` is set to `true` immediately (line 899), but `isAnswered` is set to `true` on line 927. Between lines 899-927, a second rapid click/Enter press could pass the guard if React hasn't batched the state update yet. In practice, React 18's automatic batching mitigates this in most cases, but keyboard shortcuts (Enter key held down) can bypass this since the `handleKeyDown` handler calls `handleSubmitAnswer()` directly.
- **User impact:** Extremely unlikely double submission. The `isSubmitting` flag at line 899 should prevent it, but there's a theoretical window.
- **Recommended fix:** Add a `submittingRef.current` boolean (ref, not state) as the first guard, set it synchronously at the top of `handleSubmitAnswer`.
- **Blocks production:** No, but worth hardening.

---

### Finding 7: Exponential Backoff in `scheduleRetry` Is Effectively Static

- **Severity:** LOW
- **Type:** Architecture
- **File:** `lib/services/sync/syncManager.ts` (lines 653-669)
- **Root cause:** `Math.min(30000 * Math.pow(2, this.getStatus().pendingAnswers > 0 ? 1 : 0), 300000)` — this evaluates to either `30000 * 2^0 = 30000` or `30000 * 2^1 = 60000`. The backoff doesn't actually increase with successive failures because it's based on `pendingAnswers > 0` (a boolean), not a retry counter.
- **User impact:** Failed syncs retry every 30-60 seconds regardless of how many times they've failed, rather than backing off to 5 minutes. This could cause unnecessary network traffic on persistent failures.
- **Recommended fix:** Track a `retryCount` instance variable that increments on each `scheduleRetry` call and resets on successful sync.
- **Blocks production:** No.

---

### Finding 8: `clearAllPending` Doesn't Clear Reviews

- **Severity:** MEDIUM
- **Type:** Correctness
- **File:** `lib/services/sync/syncManager.ts` (lines 705-709)
- **Root cause:** `clearAllPending()` clears offline answers and pearl actions but does NOT clear offline reviews: `this.saveOfflineAnswers([]); this.saveOfflinePearlActions([]);` — missing `this.saveOfflineReviews([]);`.
- **User impact:** If a user or debug workflow calls `clearAllPending()`, stale reviews remain in localStorage and will be synced on next online event, potentially creating ghost review records.
- **Recommended fix:** Add `this.saveOfflineReviews([]);` to `clearAllPending()`.
- **Blocks production:** No, but is a correctness bug.

---

### Finding 9: `selectedAnswer` Type Mismatch Between Paths

- **Severity:** MEDIUM
- **Type:** Data Integrity
- **Files:** `components/session/QuizView.tsx` (line 997), `lib/services/sync/syncManager.ts` (line 438), `lib/services/drillReviewService.ts` (line 227)
- **Root cause:** QuizView passes `selectedAnswer: selectedAnswerIndex` (a number 0-3) to `queueAnswer`. The syncManager then maps it to a letter via `['A', 'B', 'C', 'D'][answer.selectedAnswer]` (line 438). But `queueReview` also passes `selectedAnswer: selectedAnswerIndex` (the same number). The `syncReviews` method sends this number directly to `/api/drills/submit-reviews` → `submit-review.ts` → `drillReviewService`. In drillReviewService, `normalizedSelectedAnswer = String(selectedAnswer)` converts the number to `"0"`, `"1"`, `"2"`, or `"3"`. This is then compared against `correctAnswer` which is the full text of the correct option (e.g., "Amoxicillin"). The comparison `normalizedSelectedAnswer === correctAnswer` will ALWAYS be false.
- **User impact:** Every main session answer processed through the drillReviewService path is incorrectly marked as **wrong**, regardless of what the user actually selected. This corrupts UserProgress, ReviewLog, Card, confusion pairs, and sibling propagation — all with `isCorrect: false`.
- **Recommended fix:** Either (a) convert the numeric index to a letter or option text before queuing the review, or (b) have drillReviewService handle numeric indices by looking up the option from questionData.
- **Blocks production:** YES — this is a critical data corruption bug.

---

### Finding 10: `implicitMetrics.metrics` Returns Snapshot, Not Live Data

- **Severity:** LOW
- **Type:** Correctness
- **File:** `hooks/useImplicitMetrics.ts` (line 277), `components/session/QuizView.tsx` (line 1221)
- **Root cause:** `useImplicitMetrics` returns `metrics: metricsRef.current` — this is the ref value at render time. When QuizView reads `implicitMetrics.metrics.timeToFirstClick` on line 1221 to build the review queue payload, it gets whatever value was in the ref at the last render, not necessarily the final submitted metrics. However, since `submitAnswer` is called on line 1009 which updates the ref, and line 1221 runs later in the same synchronous function, the ref should be current. This is fragile but works.
- **User impact:** None currently, but a refactor could break it.
- **Blocks production:** No.

---

### Finding 11: `useEffect` for `implicitMetrics.startQuestion` Has Unstable Dependencies

- **Severity:** LOW
- **Type:** Performance / Correctness
- **File:** `components/session/QuizView.tsx` (lines 858-874)
- **Root cause:** The initialization `useEffect` includes `implicitMetrics`, `behavioralTracker`, and `microKinetics` in its dependency array. If any of these hook return values change reference identity across renders (which hooks returning objects typically do), this effect re-runs and calls `startQuestion()` again, resetting the dwell timer. The `useImplicitMetrics` hook returns a new object on every render (line 276-285), so this effect fires on every render.
- **User impact:** The implicit metrics timer keeps resetting, making `timeToFirstClick` and `totalDwellTime` unreliable.
- **Recommended fix:** Memoize the return value of `useImplicitMetrics` with `useMemo`, or restructure the initialization effect to not depend on the hook objects.
- **Blocks production:** Likely yes — telemetry is corrupted, which means FSRS ratings are derived from wrong data.

---

### Finding 12: Three Concurrent Writes for Every Main Session Answer

- **Severity:** HIGH
- **Type:** Architecture / Performance
- **Files:** `components/session/QuizView.tsx`
- **Root cause:** Every answer triggers: (1) `syncManager.queueAnswer()` → `/api/questions/attempt`, (2) `implicitMetrics.submitAnswer()` → `/api/user/behavior-metrics`, (3) `syncManager.queueReview()` → `/api/drills/submit-reviews`. This is 3 HTTP requests per question, with overlapping data.
- **User impact:** On slow/metered connections, 3 requests per question compound latency. The behavior-metrics endpoint (path 2) stores data that's already captured in the telemetryJson of paths 1 and 3 — it's purely redundant.
- **Recommended fix:** Consolidate to a single canonical write. Remove the `implicitMetrics.submitAnswer()` POST (it's a telemetry sidecar that duplicates data already in the main paths). Then resolve Finding 1 to eliminate the dual FSRS write.
- **Blocks production:** No, but wastes bandwidth and creates confusion.

---

## Production Blockers Only

| # | Finding | Why It Blocks |
|---|---------|---------------|
| 9 | selectedAnswer type mismatch | Every main session review via drillReviewService is marked incorrect — corrupts UserProgress, ReviewLog, Card, confusion pairs |
| 1 | Dual FSRS write | Two different FSRS tables updated with different algorithms for same answer |
| 2 | gradeContinuous vs discrete rating | drillReviewService uses float grade for FSRS.next(), attempt.ts uses discrete — scheduling diverges |
| 11 | Unstable useEffect deps reset metrics | Implicit metrics timer resets on re-render, corrupting behavioral telemetry → wrong FSRS ratings |

---

## Top 10 Findings (Priority Order)

1. **Finding 9** — selectedAnswer numeric index compared against option text → always incorrect (CRITICAL)
2. **Finding 1** — Dual FSRS write to UserTopicProgress AND UserProgress (CRITICAL)
3. **Finding 2** — gradeContinuous float passed to FSRS.next() instead of discrete rating (HIGH)
4. **Finding 11** — useEffect deps reset implicitMetrics on every render (HIGH)
5. **Finding 12** — Three redundant HTTP writes per answer (HIGH)
6. **Finding 4** — Session recovery doesn't restore correctness/SRS state (MEDIUM)
7. **Finding 9** — selectedAnswer type mismatch in review sync path (MEDIUM — same as #1 but separate manifestation)
8. **Finding 8** — clearAllPending doesn't clear reviews (MEDIUM)
9. **Finding 5** — Ref values in useEffect dependency array (MEDIUM)
10. **Finding 6** — Theoretical double-submit race condition (MEDIUM)

---

## Three Highest-Leverage Fixes

### Fix A: Eliminate Dual Write — Single Canonical FSRS Path

**What:** Remove `queueReview()` from QuizView's `handleSubmitAnswer` for main sessions. Make `/api/questions/attempt` the sole writer for main session data. Port missing functionality (ReviewLog, confusion pairs, sibling propagation) from drillReviewService into attempt.ts, or refactor attempt.ts to call drillReviewService internally.

**Why highest leverage:** Eliminates Findings 1, 9, and 12 in one structural change. The selectedAnswer type mismatch (Finding 9) goes away because the review path is removed. The dual FSRS write (Finding 1) is resolved. The redundant HTTP request (Finding 12) is eliminated.

**Estimated effort:** 4-6 hours.

### Fix B: Fix `gradeContinuous` → Discrete Rating in drillReviewService

**What:** Change line 608 of `drillReviewService.ts` from `fsrs.next(currentCard, new Date(), gradeContinuous)` to `fsrs.next(currentCard, new Date(), rating)` where `rating` is the discrete integer after Ghost Grader.

**Why highest leverage:** One-line fix that ensures FSRS scheduling uses the intended binary rating system. Without this, all drillReviewService-path reviews get interpolated scheduling that doesn't match the system design.

**Estimated effort:** 15 minutes + regression testing.

### Fix C: Stabilize implicitMetrics useEffect

**What:** Memoize the return value of `useImplicitMetrics` or restructure the QuizView initialization effect to use refs for the hook instances. The simplest fix: wrap the startQuestion/reset/start calls in a separate `useEffect` that depends only on `currentQuestion?.id`.

**Why highest leverage:** Without correct telemetry, the entire implicit rating pipeline is garbage-in-garbage-out. Fixing this ensures behavioral signals are accurate, which makes FSRS ratings meaningful.

**Estimated effort:** 30 minutes.

---

## Minimal Safe Implementation Plan

**Phase 1 (Day 1 — Critical Fixes):**
1. Fix B: Change `gradeContinuous` → `rating` in drillReviewService line 608
2. Fix C: Stabilize implicitMetrics useEffect dependencies in QuizView
3. Fix Finding 8: Add `this.saveOfflineReviews([])` to `clearAllPending()`

**Phase 2 (Day 2-3 — Structural Fix):**
4. Fix A: Remove `queueReview()` from QuizView's `handleSubmitAnswer` (eliminates Findings 1, 9, 12)
5. Port ReviewLog creation, confusion pairs, and sibling propagation into `/api/questions/attempt`
6. Add a `submittingRef` guard to prevent double submission (Finding 6)

**Phase 3 (Day 4 — Polish):**
7. Clean up ref values in useEffect dependency array (Finding 5)
8. Enhance session recovery to store/restore correctness state (Finding 4)
9. Fix exponential backoff to use actual retry counter (Finding 7)
10. Remove `implicitMetrics.submitAnswer()` POST to `/api/user/behavior-metrics` (redundant with telemetryJson in main path)

---

## What Should Be Audited Next

1. **Drill session FSRS path** — The 11 drill hooks all use `useDrillFSRS` which submits to `/api/drills/submit-review` with `sessionType: 'drill'`. Verify that the selectedAnswer type mismatch (Finding 9) doesn't also affect drills (drills likely pass text, not index).
2. **Due queue / session generator** — How does the session generator decide what's "due"? Does it read from UserTopicProgress, UserProgress, or Card? If different tables, the dual-write creates due-count inconsistencies.
3. **FSRS optimizer sidecar** — Verify it reads ReviewLog correctly and that the telemetry schema matches what's actually written.
4. **OSCE mode** — Next priority per project roadmap.
5. **Rolling 360 accuracy** — Verify the circular buffer logic doesn't double-count when both sync paths succeed.
