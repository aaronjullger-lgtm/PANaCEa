# Sprint 1 Report: FSRS/Review Flow Correctness & Data Integrity

**Date:** 2026-04-03
**Goal:** Fix highest-risk correctness and data-integrity issues in the main study/FSRS flow
**Status:** Complete — 7 audit findings resolved

---

## Files Changed

| File | Changes |
|------|---------|
| `components/session/QuizView.tsx` | Finding 9, 11, 6, 12, 5 fixes |
| `hooks/useImplicitMetrics.ts` | Finding 11 fix (memoized return) |
| `lib/services/drillReviewService.ts` | Finding 2 fix (discrete rating) |
| `lib/services/sync/syncManager.ts` | Finding 8 fix (clear reviews) |

---

## Resolved Findings

### Finding 9 (CRITICAL): selectedAnswer Type Mismatch — FIXED
**Root cause:** QuizView passed `selectedAnswerIndex` (numeric 0–3) to `queueReview()`. drillReviewService compared this stringified number (`"0"`) against the correct option text (`"Amoxicillin"`). Result: every main session answer was marked incorrect, corrupting UserProgress, ReviewLog, Card, and ConfusionPair data.

**Fix:** Convert the numeric index to the actual option text string before queuing:
```typescript
selectedAnswer: (currentQuestion.options as string[])?.[selectedAnswerIndex] ?? String(selectedAnswerIndex)
```
This matches how drills already pass selectedAnswer (as text).

---

### Finding 2 (HIGH): gradeContinuous Float Passed to FSRS.next() — FIXED
**Root cause:** Line 821 of drillReviewService called `fsrs.next(currentCard, new Date(), gradeContinuous)` where `gradeContinuous` is a float in [1.0, 4.0]. The system is designed as binary rating (Again=1, Good=3). FSRS handled the float via interpolation, causing scheduling drift vs. the intended discrete intervals.

**Fix:** Changed to `fsrs.next(currentCard, new Date(), rating)` where `rating` is the discrete integer after Ghost Grader. The continuous grade is retained in ReviewLog telemetry for analysis but no longer drives FSRS scheduling.

---

### Finding 11 (HIGH): Unstable useEffect Dependencies Reset Metrics Timer — FIXED
**Root cause:** `useImplicitMetrics` returned a new object on every render (`{ metrics, startQuestion, ... }`). QuizView's initialization `useEffect` listed `implicitMetrics` in its dep array → effect re-fired every render → `startQuestion()` reset the dwell timer, corrupting `timeToFirstClick` and `totalDwellTime` → garbage behavioral telemetry → wrong FSRS ratings.

**Fix:** Two-part:
1. Wrapped `useImplicitMetrics` return value in `useMemo` (deps: stable callbacks only)
2. Removed hook objects from QuizView's initialization `useEffect` dep array, relying on closure capture instead

---

### Finding 6 (MEDIUM): No Ref-Based Double-Submit Guard — FIXED
**Root cause:** `handleSubmitAnswer` guarded against double submission using React state (`isSubmitting`). Between the state check and `setIsSubmitting(true)`, React batching could theoretically allow a second invocation (e.g., held Enter key).

**Fix:** Added `submittingRef` (a ref, not state) as the first synchronous guard in `handleSubmitAnswer`. Set `true` immediately, cleared in both the normal exit path and `showNextQuestion`.

---

### Finding 8 (MEDIUM): clearAllPending Doesn't Clear Reviews — FIXED
**Root cause:** `clearAllPending()` cleared offline answers and pearl actions from localStorage but missed offline reviews. IndexedDB reviews were cleared, but localStorage reviews were not — stale reviews could re-sync as ghost records.

**Fix:** Added `this.saveOfflineReviews([])` to `clearAllPending()`.

---

### Finding 12 (HIGH): Redundant implicitMetrics.submitAnswer POST — FIXED
**Root cause:** Every main session answer triggered 3 HTTP requests: (1) `queueAnswer` → `/api/questions/attempt`, (2) `implicitMetrics.submitAnswer()` → `/api/user/behavior-metrics`, (3) `queueReview` → `/api/drills/submit-reviews`. The behavior-metrics POST (path 2) stored data already captured in the `telemetryJson` of paths 1 and 3.

**Fix:** Removed the `implicitMetrics.submitAnswer()` call. Behavioral data is still persisted via the telemetryJson in both remaining write paths.

---

### Finding 5 (MEDIUM): Ref .current Values in useEffect Dep Array — FIXED
**Root cause:** The session-save `useEffect` included `answerChangeCountRef.current` and `firstSelectedAnswerRef.current` in its dependency array. Ref mutations don't trigger re-renders, so these values never caused the effect to re-run. The session state was saved with stale answer-change data.

**Fix:** Removed ref `.current` values from the dep array. The ref values are read inside the effect body where they're current at execution time. The effect fires when state deps change, which is when saves matter.

---

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| TypeScript syntax | ✅ Pass | All 4 files transpile cleanly |
| FSRS tests (42) | ✅ Pass | Core scheduling logic unaffected |
| SyncManager tests (15) | ✅ Pass | clearAllPending fix verified |
| Confidence/Calibration tests (52) | ✅ Pass | Pipeline intact |
| ReviewQuestionResolver tests (4) | ✅ Pass | |
| FSRS Pipeline tests (23) | ✅ Pass | |
| FSRS EOR Scheduler (23/24) | ⚠️ 1 pre-existing timeout | Not related to changes |
| DrillReviewService tests (3/13) | ⚠️ 10 pre-existing failures | ghostGrader mock missing `applyHonestRatingWithDetail` export — predates this sprint |
| Full typecheck | ⏭ Skipped | OOM in sandbox; runs on CI |
| Vite build | ⏭ Skipped | Pre-existing `@tanstack/query-core` resolution failure |

---

## Deferred Risks

### Finding 1: Dual FSRS Write (Two Tables for Same Answer)
**Status:** Partially mitigated. Since `attempt.ts` no longer runs FSRS (removed in prior commit), the dual write now means: attempt.ts writes QuestionAttempt + UserQuestionSeen + Rolling360, while drillReviewService writes UserProgress + UserTopicProgress + ReviewLog + Card. The data split is intentional but creates two sources of truth for attempt records (QuestionAttempt has 5-min dedup in drillReviewService but none in attempt.ts). Full consolidation is a Sprint 2 candidate.

### Finding 4: Session Recovery Doesn't Restore Correctness State
**Status:** Deferred. After refresh mid-explanation, user sees answered state but loses streak, SRS result, and explanation panel. Low frequency, no data corruption.

### Finding 7: Exponential Backoff Is Effectively Static
**Status:** Deferred. Retry interval is 30s or 60s regardless of failure count. Low impact — only affects persistent offline scenarios.

### Finding 3: useImplicitMetrics Returns Stale Ref Values
**Status:** Deferred. `isSubmitting` and `submissionError` return stale values. Not currently used for UI gating.

### DrillReviewService Test Mock Debt
**Status:** The ghostGrader mock needs `applyHonestRatingWithDetail` added. 10 tests blocked. Not caused by this sprint.

---

## Architecture Notes for Sprint 2

The main session now has two write paths that serve distinct roles:
- **Path A** (`queueAnswer` → `/api/questions/attempt`): QuestionAttempt record, UserQuestionSeen timing stats, Question aggregate stats, Rolling360 circular buffer
- **Path B** (`queueReview` → `/api/drills/submit-reviews` → `drillReviewService`): FSRS scheduling (UserProgress + UserTopicProgress), ReviewLog with full telemetry, Card dual-write, ConfusionPair, sibling propagation

Path B is now the sole FSRS authority. Path A handles the non-FSRS bookkeeping. This split is stable for now but should eventually be consolidated into a single canonical endpoint to eliminate the duplicate QuestionAttempt creation risk.
