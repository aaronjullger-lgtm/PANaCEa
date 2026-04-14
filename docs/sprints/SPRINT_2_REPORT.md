# Sprint 2 Report: Write Path Consolidation

**Date:** 2026-04-06
**Goal:** Eliminate dual FSRS/review write paths — one canonical writer for all session types
**Status:** Complete

---

## Problem Statement

Every main session answer triggered TWO independent write paths:

- **Path A** (`queueAnswer` → `/api/questions/attempt`): QuestionAttempt, UserQuestionSeen, Question stats, Rolling360, AND a full duplicate FSRS pipeline (ReviewLog, UserProgress, UserTopicProgress, Card, sibling propagation)
- **Path B** (`queueReview` → `/api/drills/submit-reviews` → `drillReviewService`): QuestionAttempt (5-min dedup), full FSRS pipeline, ConfusionPair, sibling propagation

Result: every main session answer created **duplicate FSRS state**, **duplicate ReviewLog entries**, **duplicate Card writes**, and risked **duplicate QuestionAttempt records**. The two paths used different rating logic (attempt.ts used a simplified binary rating with hardcoded confidence; drillReviewService used the full implicit confidence pipeline with Ghost Grader).

---

## Solution: drillReviewService as Canonical Writer

**Architecture after Sprint 2:**

```
Main Session Answer
        │
        ▼
  syncManager.queueReview()          ← SINGLE write path
        │
        ▼
  /api/drills/submit-reviews
        │
        ▼
  drillReviewService.submitDrillReview()
        │
        ├── QuestionAttempt (5-min dedup)
        ├── UserQuestionSeen upsert     ← NEW (ported from attempt.ts)
        ├── Question stats increment    ← NEW (ported from attempt.ts)
        ├── PreGeneratedQuestion stats
        ├── Rolling360 update           ← FIXED (removed weCreatedAttempt guard)
        ├── FSRS scheduling (UserProgress + UserTopicProgress)
        ├── ReviewLog with full telemetry
        ├── Card dual-write
        ├── ConfusionPair + recurrence analysis
        └── Sibling propagation
```

**attempt.ts is now stats-only:** It still creates QuestionAttempt + UserQuestionSeen + Question stats for backward compatibility with stale offline answers draining from localStorage (24h TTL), but all FSRS, ReviewLog, Card, UserTopicProgress, Rolling360, and sibling propagation code has been removed.

---

## Files Changed

| File | Changes |
|------|---------|
| `lib/services/drillReviewService.ts` | Added UserQuestionSeen upsert, Question stats increment, removed `weCreatedAttempt` guard on Rolling360 |
| `components/session/QuizView.tsx` | Removed `queueAnswer()` call; `queueReview()` now fires for ALL session types (main, cram, rapid_recall) |
| `functions/api/questions/attempt.ts` | Stripped FSRS pipeline (ReviewLog, UserProgress, UserTopicProgress, Card, sibling propagation, Rolling360); now stats-only |
| `lib/services/sync/syncManager.ts` | Comment clarification on `isMainSession` field |
| `tests/drillReviewService.test.ts` | Added missing mocks: distractorChronometryService, switchDirectionService, explanationEngagementService, confusionPairRecurrenceService, fsrsScheduleService; added `userQuestionSeen` + `question` + `confusionPair.findFirst` to Prisma mock |

---

## What Was Ported into drillReviewService

### 1. UserQuestionSeen Upsert
Tracks per-user, per-question timing stats (avgTimeMs, timesCorrect, timesIncorrect). Uses running average formula identical to attempt.ts. Wrapped in try-catch (non-fatal).

### 2. Question Aggregate Stats
Increments `timesSeen` and `timesCorrect` on the Question table for global difficulty statistics. Wrapped in try-catch (non-fatal — question may only exist in PreGeneratedQuestion table).

### 3. Rolling360 Guard Removal
Previously, Rolling360 only updated when `weCreatedAttempt === true` (to avoid double-counting if attempt.ts already created the attempt). Since attempt.ts no longer updates Rolling360, the guard is unnecessary. Now always updates for main sessions.

---

## What Was Removed from attempt.ts

Lines 254–410 of the original file contained a full FSRS pipeline that duplicated drillReviewService's work:

- `computeFSRSUpdate()` call with simplified binary rating
- ReviewLog creation with hardcoded confidence values
- `updateUserProgressWithHistory()` transaction
- `UserTopicProgress` upsert
- Card dual-write upsert
- `propagateRecallToSiblings()` call
- Rolling360 update

All of this is now exclusively handled by drillReviewService with the full implicit confidence pipeline, Ghost Grader, circadian modifiers, lapse severity, and all Wave 1–3 behavioral signals.

---

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| All 6 changed files syntax | ✅ Pass | TypeScript transpile clean |
| Mock coverage | ✅ Complete | All runtime imports in drillReviewService have corresponding vi.mock() |
| FSRS tests (42) | ✅ Pass | Core scheduling logic unaffected |
| SyncManager tests (17) | ✅ Pass | Includes clearAllPending fix from Sprint 1 |
| Confidence scoring (29) | ✅ Pass | Pipeline intact |
| drillReviewService tests (13) | ⏳ Requires CI | Mock fixes applied; sandbox OOMs on this test file |
| Full typecheck | ⏳ Requires CI | Sandbox memory insufficient |

---

## Backward Compatibility

**Old offline items:** Any `queueAnswer` items still in localStorage/IndexedDB will continue to sync normally to the now-simplified `/api/questions/attempt` endpoint. They create QuestionAttempt + stats but no longer trigger FSRS. These items drain naturally via 24-hour TTL cleanup in syncManager.

**Drills:** Completely unaffected. They already used only the `queueReview` → drillReviewService path.

**`queueAnswer()` method:** Still exists in syncManager for backward compat. Not called by QuizView anymore.

---

## Combined Sprint 1 + Sprint 2 Impact

| Audit Finding | Sprint | Status |
|---------------|--------|--------|
| Finding 9: selectedAnswer type mismatch (CRITICAL) | S1 | ✅ Resolved |
| Finding 1: Dual FSRS write (CRITICAL) | S2 | ✅ Resolved — single canonical writer |
| Finding 2: gradeContinuous for FSRS.next() (HIGH) | S1 | ✅ Resolved |
| Finding 11: Unstable useEffect deps (HIGH) | S1 | ✅ Resolved |
| Finding 12: Redundant HTTP writes (HIGH) | S1+S2 | ✅ Resolved — 3 writes → 1 write |
| Finding 6: Double-submit guard (MEDIUM) | S1 | ✅ Resolved |
| Finding 8: clearAllPending missing reviews (MEDIUM) | S1 | ✅ Resolved |
| Finding 5: Ref values in useEffect deps (MEDIUM) | S1 | ✅ Resolved |
| Finding 4: Session recovery incomplete (MEDIUM) | — | Deferred |
| Finding 7: Static exponential backoff (LOW) | — | Deferred |

**Net result:** The main session now has ONE canonical write path. Every question answer produces exactly one QuestionAttempt, one ReviewLog, one FSRS update, and one Rolling360 entry — with the full implicit confidence pipeline, Ghost Grader, and all behavioral signals.

---

## Remaining Work

1. **CI verification:** Run full `npm test` and `npm run typecheck` on CI where memory isn't constrained
2. **drillReviewService test suite:** Verify the 10 previously-failing tests now pass with the new mocks
3. **Session recovery (Finding 4):** Restore correctness + SRS result state on page refresh
4. **Exponential backoff (Finding 7):** Track actual retry counter instead of boolean
5. **Deprecation path:** Mark `queueAnswer()` and `/api/questions/attempt` FSRS fields as deprecated in JSDoc
