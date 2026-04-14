# AUDIT 5: Telemetry Collection, Behavioral Metrics & FSRS Logging

**Auditor:** Claude (Senior Full-Stack Engineer perspective)
**Date:** 2026-04-01
**Scope:** Telemetry hooks, implicit metrics collection, answer timing/hesitation/confidence signals, review log write paths, event schemas, backend endpoints receiving telemetry, deduplication logic, separation of analytics vs scored reviews
**Codebase:** PANaCEa (studyPANaCEa.com)

---

## Executive Summary

The telemetry and FSRS pipeline is the most sophisticated subsystem in PANaCEa. It implements a **zero-friction implicit rating system** that derives FSRS scheduling grades from behavioral signals (response latency, answer switches, cursor entropy, hover oscillations, commitment gap, tremor score) without any self-rated buttons. This is genuinely novel and well-architected.

The audit reveals **11 findings** including 1 critical issue. The most impactful: the **dual write path** for QuestionAttempt (attempt.ts vs drillReviewService.ts) runs FSRS scheduling independently in both paths, using **different par-time defaults and different telemetry normalization**, which produces different ratings for the same behavioral data. Additionally, the `sessionType` type definition is misaligned between the API schema and the service interface, and rapid-guess detection thresholds aren't applied consistently across all entry points.

The core `deriveContinuousRating()` algorithm and Ghost Grader override logic are mathematically sound and well-documented. The separation between analytics-only events and FSRS-scored reviews is cleanly implemented with explicit gating.

---

## Architecture Overview

### Telemetry Collection Pipeline

```
User Interaction
    │
    ▼
useTelemetryCollector (hook)
    │ Records: clicks, hovers, option_selects, hint_views
    │ Tracks: time_to_first_interaction, answer_changes, duration
    │ CRPL: trajectory metrics, typing metrics, hesitation count
    │ MVRT: rapid_guess detection per question type
    ▼
finalizeTelemetry() → TelemetryData (JSONB)
    │
    ├─► QuizView (main session) → syncManager.queueAnswer()
    │       └─► POST /api/questions/attempt
    │
    └─► Drill hooks (useDrillFSRS) → POST /api/drills/submit-review
```

### FSRS Rating Derivation Chain

```
TelemetryData + Behavioral Metrics
    │
    ▼
deriveContinuousRating() (lib/implicit-metrics.ts)
    │ Input: timeToFirstClick, answerSwitches, totalDwellTime,
    │        isCorrect, parTimeMs, commitmentGapMs, cursorEntropy,
    │        hoverOscillationCount
    │ Output: { grade: 1.0-4.0, confidence: 0-1, discreteRating: 1-4 }
    ▼
applyHonestRating() (lib/srs/ghostGrader.ts)
    │ Overrides: oscillations>2 → cap at Hard
    │            selectionDrift>3s → cap at Hard
    │            tremorScore>0.6 → cap at Hard
    ▼
FSRS.next(card, date, rating) → scheduled_days, stability, difficulty
    │
    ▼
applyCircadianModifier() → adjusts stability by time-of-day
applyEorClampIfNeeded() → caps next-due to rotation end date
```

### Write Destinations

```
Path A: POST /api/questions/attempt (main session)
    ├─ QuestionAttempt.create (telemetryJson, wasCorrect, selectedAnswer)
    ├─ UserQuestionSeen.upsert (dedup tracking)
    ├─ Question.update (timesSeen, timesCorrect)
    ├─ UserTopicProgress.upsert (FSRS card scheduling)
    ├─ scheduleConceptReview (Leitner legacy fallback)
    └─ Rolling360.update (main session only)

Path B: POST /api/drills/submit-review → drillReviewService
    ├─ QuestionAttempt.create (telemetryJson + server_computed block)
    ├─ PreGeneratedQuestion.update (timesServed, timesCorrect)
    ├─ ReviewLog.create (full FSRS state, telemetry, circadian)
    ├─ UserProgress.update (fsrsCard, reviewHistory)
    ├─ UserStatistics.update (timing aggregates)
    ├─ Rolling360.update (main session, if new attempt)
    ├─ scheduleConceptReview (Leitner legacy fallback)
    ├─ propagateRecallToSiblings (semantic sibling propagation)
    └─ ensureDueVariant (on incorrect: generate sibling for future review)
```

---

## Files Inspected

| File | Lines | Role |
|------|-------|------|
| `lib/implicit-metrics.ts` | 462 | Core rating derivation algorithm |
| `types/telemetry.ts` | 700+ | CRPL schema, MVRT thresholds, TelemetryData |
| `hooks/useTelemetryCollector.ts` | 469 | React hook for telemetry capture |
| `lib/srs/ghostGrader.ts` | 71 | Honest-history behavioral override |
| `lib/micro-kinetics.ts` | 695 | Mouse trajectory analysis |
| `lib/services/drillReviewService.ts` | ~800 | Canonical drill review + FSRS writer |
| `functions/api/drills/submit-review.ts` | 236 | Drill review API endpoint |
| `functions/api/questions/attempt.ts` | 535 | Main session attempt API endpoint |
| `lib/services/sync/syncManager.ts` | 800+ | Offline queue + sync |
| `lib/circadian.ts` | — | Circadian phase + stability modifier |
| `lib/fsrs/eorScheduler.ts` | — | EOR date clamping |
| `lib/services/rolling360Service.ts` | — | Rolling 360-day accuracy |
| `lib/services/userProgressService.ts` | — | UserProgress + reviewHistory writer |

---

## Event/Write Type Classification Table

| Event/Write | Affects FSRS | Analytics Only | Both | Neither | Notes |
|---|---|---|---|---|---|
| QuestionAttempt (main session via attempt.ts) | ✅ UserTopicProgress | ✅ stats aggregates | **Both** | | Primary main-session writer |
| QuestionAttempt (drill via drillReviewService) | ✅ UserProgress.fsrsCard | ✅ server_computed block | **Both** | | Canonical drill writer |
| ReviewLog (normal review) | ✅ (captures FSRS state snapshot) | ✅ telemetry JSON | **Both** | | Full FSRS state + behavioral data |
| ReviewLog (rapid_guess) | | ✅ logged for analysis | | | `review_type: 'rapid_guess'`, grade forced to Again, NO FSRS update |
| ReviewLog (cram session) | | | | ✅ Skipped entirely | `sessionType: 'cram'` skips both FSRS and ReviewLog |
| ReviewLog (rapid_recall) | | | | ✅ Skipped entirely | `sessionType: 'rapid_recall'` skips both |
| UserQuestionSeen | | ✅ dedup + avgTimeMs | | | Analytics only; not used for FSRS |
| UserTopicProgress | ✅ FSRS scheduling | | **FSRS only** | | Updated by attempt.ts path |
| UserProgress.fsrsCard | ✅ FSRS scheduling | | **FSRS only** | | Updated by drillReviewService path |
| UserProgress.reviewHistory | ✅ FSRS history array | | **FSRS only** | | Appended by userProgressService |
| Rolling360 | | ✅ 360-day accuracy | **Analytics** | | Main session only; dedup by attemptId |
| Question.timesSeen/timesCorrect | | ✅ question-level stats | **Analytics** | | Updated by attempt.ts |
| PreGeneratedQuestion.timesServed | | ✅ question-level stats | **Analytics** | | Updated by drillReviewService |
| scheduleConceptReview | ✅ Leitner-style | | | | Legacy; both paths call it |
| UserStatistics (timing aggregates) | | ✅ | **Analytics** | | Updated by drillReviewService only |
| SyncManager offline queue | | | | ✅ Queue only | Stored in localStorage until synced |
| Pearl harvesting (savePearlsToDatabase) | | ✅ | **Analytics** | | Extracted from rationale on generation |

---

## Findings

### Finding 1: Dual FSRS Write Paths with Different Rating Logic

**Severity:** CRITICAL
**Type:** Data Integrity
**Files:**
- `functions/api/questions/attempt.ts` (lines 290-430) — Path A
- `lib/services/drillReviewService.ts` (lines 279-335) — Path B
**Root Cause:** Both endpoints independently derive FSRS ratings and schedule cards, but they use different logic:

| Aspect | attempt.ts (Path A) | drillReviewService (Path B) |
|--------|--------------------|-----------------------------|
| Par time | `DEFAULT_PAR_TIME_MS = 30000` (hardcoded) | `calculateParTime(qData)` (dynamic, based on stem length, options, vignette) |
| Telemetry normalization | `normalizeTelemetryMetrics()` with fallback `min(timeSpent, parTime*0.85)` for first-click | `effectiveFirstClick = timeToFirstClick ?? Math.min(numericTime, parTimeMs * 0.85)` |
| Ghost Grader | `applyHonestRating()` called with all micro-kinetics | Same `applyHonestRating()` call |
| FSRS target table | `UserTopicProgress` (per condition+taskType) | `UserProgress` (per condition) |
| CircadianModifier | NOT applied | Applied via `applyCircadianModifier()` |
| Implicit confidence → stability | NOT applied | Applied: `if (implicitDifficulty >= 0.5) modifiedStability *= 1 - implicitDifficulty * 0.5` |
| Urgency multiplier | NOT applied | Applied when `urgencyMultiplier > 1.0` |

**User Impact:** The same question answered with the same behavior produces **different FSRS schedules** depending on which endpoint processes it. Main session answers (Path A) get a cruder rating with a fixed 30s par time and no circadian adjustment. Drill answers (Path B) get a more nuanced rating. This means the same user's recall strength is modeled differently across session types.

Furthermore, Path A writes to `UserTopicProgress` while Path B writes to `UserProgress.fsrsCard` — these are **two separate FSRS state stores** for the same knowledge. The FSRS optimizer sidecar reads from `ReviewLog`, which is only written by Path B.

**Recommended Fix:** Unify into a single FSRS scheduling function. Either:
(a) Have `attempt.ts` call `drillReviewService.submitDrillReview()` instead of inline FSRS logic, or
(b) Extract FSRS scheduling into `lib/services/fsrsSchedulingService.ts` and call it from both endpoints.
**Blocks Production:** Yes — FSRS model is inconsistent across session types.

---

### Finding 2: `sessionType` Type Mismatch Between API and Service

**Severity:** MEDIUM
**Type:** Type Safety
**Files:**
- `functions/api/drills/submit-review.ts` (line 81): `z.enum(['main', 'drill', 'cram', 'rapid_recall'])`
- `lib/services/drillReviewService.ts` (line 139): `sessionType?: 'main' | 'cram' | 'rapid_recall'`
**Root Cause:** The API schema accepts `'drill'` as a valid sessionType, but the service's TypeScript interface doesn't include it. The value is passed through to the service function where the runtime check `sessionType !== 'cram' && sessionType !== 'rapid_recall'` correctly treats `'drill'` as FSRS-eligible. However, TypeScript cannot verify this because the type is narrower than the input.
**User Impact:** No immediate runtime impact (the logic works correctly by coincidence), but a future refactor that adds explicit handling for each sessionType value would miss `'drill'` in the service.
**Recommended Fix:** Add `'drill'` to the service interface: `sessionType?: 'main' | 'drill' | 'cram' | 'rapid_recall'`.
**Blocks Production:** No.

---

### Finding 3: `attempt.ts` Doesn't Write ReviewLog

**Severity:** HIGH
**Type:** Data Completeness
**Files:** `functions/api/questions/attempt.ts` (entire file)
**Root Cause:** The main-session attempt endpoint creates `QuestionAttempt` and updates `UserTopicProgress`, but it does NOT create a `ReviewLog` entry. The FSRS optimizer sidecar (`gcp-fsrs-optimizer/`) reads from `ReviewLog` to fit personalized FSRS weights. Main-session reviews that go through `attempt.ts` are invisible to the optimizer.
**User Impact:** The optimizer only trains on drill reviews (which go through `drillReviewService` → ReviewLog). Main session data — potentially the bulk of user activity — is excluded from personalization. The optimizer produces weights biased toward drill behavior.
**Recommended Fix:** Add a `ReviewLog.create()` call to `attempt.ts` (or better, unify with drillReviewService per Finding 1).
**Blocks Production:** No, but severely limits optimizer effectiveness.

---

### Finding 4: Rapid-Guess Threshold Not Applied Consistently

**Severity:** MEDIUM
**Type:** Correctness
**Files:**
- `drillReviewService.ts` (line 367): `const isRapidGuess = telemetry?.rapid_guess ?? numericTime < 500`
- `functions/api/questions/attempt.ts`: No rapid-guess detection at all
**Root Cause:** The drill review path checks `telemetry.rapid_guess` (set client-side by `useTelemetryCollector` using MVRT thresholds per question type: 3000ms for vignettes, 1500ms for recall, etc.) and falls back to a hardcoded 500ms check. The attempt.ts path doesn't check for rapid guesses at all — every answer, no matter how fast, gets full FSRS scheduling.
**User Impact:** A user rapidly tapping through main-session questions (e.g., accidentally, or gaming) will have those answers affect their FSRS scheduling. In the drill path, rapid guesses are logged but excluded from FSRS updates.
**Recommended Fix:** Add rapid-guess detection to `attempt.ts` using the same MVRT thresholds. When detected, skip FSRS scheduling and log as `review_type: 'rapid_guess'`.
**Blocks Production:** No, but allows gaming of main-session FSRS.

---

### Finding 5: Rolling 360 Double-Count Prevention Has a Race Window

**Severity:** MEDIUM
**Type:** Data Integrity
**Files:**
- `functions/api/questions/attempt.ts` (lines 432-448): Updates Rolling 360 when `isMainSession`
- `lib/services/drillReviewService.ts` (lines 468-484): Updates Rolling 360 when `isMainSession && weCreatedAttempt`
**Root Cause:** The dedup logic in `drillReviewService` checks for an existing `QuestionAttempt` within the last 5 minutes. If one exists (created by `attempt.ts`), it reuses it and sets `weCreatedAttempt = false`, which skips the Rolling 360 update (since `attempt.ts` already did it). This works correctly in the normal flow.

However, if `attempt.ts` and `submit-review` are called in rapid succession (e.g., `syncManager` retries while the drill hook also submits), and the 5-minute window lookup hasn't committed yet, both paths could create separate attempts and both update Rolling 360.
**User Impact:** Rare edge case. A single question answer could be counted twice in Rolling 360 accuracy statistics.
**Recommended Fix:** Add a `rolling360Updated` flag to the `QuestionAttempt` record, and check it before updating. Or use a `UNIQUE` constraint on `(userId, questionId, answeredAt)` with a floor to the nearest minute.
**Blocks Production:** No.

---

### Finding 6: `attempt.ts` Fetches ALL User Attempts for Stats Calculation

**Severity:** HIGH
**Type:** Performance
**Files:** `functions/api/questions/attempt.ts` (lines 233-264)
**Root Cause:** Inside the `$transaction`, the endpoint runs:
```ts
const allAttempts = await tx.questionAttempt.findMany({
  where: { userId },
  select: { wasCorrect: true, system: true },
});
```
This fetches **every attempt the user has ever made** to calculate aggregate stats. For an active user with 10,000+ attempts, this query returns a large result set inside a transaction, holding locks.
**User Impact:** Progressive performance degradation. As users accumulate more attempts, each new answer takes longer to record. On Cloudflare Edge with Prisma Accelerate, this could hit the 30-second timeout.
**Recommended Fix:** Maintain running counters on a `UserStats` table (total_attempts, correct_attempts per system) and increment atomically, instead of re-computing from scratch.
**Blocks Production:** Not immediately, but will become critical at scale.

---

### Finding 7: `attempt.ts` Hardcodes 4-Letter Answer Map

**Severity:** MEDIUM
**Type:** Correctness
**Files:** `functions/api/questions/attempt.ts` (line 23): `const LETTERS = ['A', 'B', 'C', 'D'] as const`
**Root Cause:** Same issue as Audit 4 Finding 7. The batch generation prompt requests 5 options (A-E), but the attempt endpoint only maps indices 0-3 to letters A-D. `selectedAnswer: 4` (for option E) would produce `selectedAnswerLetter: null`.
**User Impact:** If a user selects option E in a 5-option question and the answer is submitted as an index, the `selectedAnswer` stored in `QuestionAttempt` will be `null`, making the attempt unmatchable for analytics.
**Recommended Fix:** Add `'E'` to the LETTERS array.
**Blocks Production:** No, but corrupts data for 5-option questions.

---

### Finding 8: Telemetry `server_computed` Block Only Written by drillReviewService

**Severity:** MEDIUM
**Type:** Data Completeness
**Files:**
- `lib/services/drillReviewService.ts` (lines 404-437): Writes `server_computed` block with par_time_ms, latency_ratio, implicit_rating, etc.
- `functions/api/questions/attempt.ts` (lines 170-175): Writes raw `telemetryJson` without any server-computed enrichment
**Root Cause:** When a main-session answer goes through `attempt.ts`, the `QuestionAttempt.telemetryJson` contains only the raw client-side telemetry. The server-computed fields (par_time_ms, latency_ratio, implicit_confidence, grade_continuous, circadian_phase, is_rapid_guess) are NOT attached. These fields are crucial for downstream analytics and optimizer training.
**User Impact:** Any analytics query that joins on `telemetryJson->server_computed` will only return drill reviews, not main-session reviews. The data model appears to have rich telemetry but is hollow for the primary session type.
**Recommended Fix:** Add the same `server_computed` enrichment to `attempt.ts` before writing `telemetryJson`.
**Blocks Production:** No, but degrades analytics value significantly.

---

### Finding 9: Offline SyncManager `OfflineAnswer.selectedAnswer` is `number`, API Accepts `string | number`

**Severity:** LOW
**Type:** Type Mismatch
**Files:**
- `lib/services/sync/syncManager.ts` (line 24): `selectedAnswer: number`
- `functions/api/questions/attempt.ts` (line 83): `z.union([z.number().int().min(0).max(3), z.enum(['A', 'B', 'C', 'D'])])`
**Root Cause:** The sync manager stores `selectedAnswer` as a number (0-3 index), which is valid per the API schema. However, `drillReviewService` expects `string | number` and does string comparison against `correctAnswer` (which is a letter like "A"). When the sync manager syncs an offline drill review, the `selectedAnswer: 0` is stringified to `"0"`, which will never match `correctAnswer: "A"`.
**User Impact:** Offline drill reviews may always be marked as incorrect, regardless of the user's actual selection.
**Recommended Fix:** In `syncManager`, store `selectedAnswer` as the letter (A/B/C/D) rather than index, or ensure the sync endpoint converts index to letter before passing to drillReviewService.
**Blocks Production:** Only for offline users, but when it hits, every offline answer is wrong.

---

### Finding 10: Ghost Grader Hard Cap on `Rating.Hard` is Documented as Deprecated

**Severity:** LOW
**Type:** Consistency
**Files:**
- `lib/srs/ghostGrader.ts` (line 61): Returns `Rating.Hard` when behavioral signals trigger
- `lib/services/drillReviewService.ts` (line 330): `if (rating === Rating.Hard && gradeContinuous > 2.0) { gradeContinuous = 2.0; }`
- CLAUDE.md: "Hard/Easy are deprecated and normalized" + "Binary FSRS rating only (Again=1, Good=3)"
**Root Cause:** CLAUDE.md states the system uses binary FSRS ratings (Again/Good only), but the Ghost Grader still returns `Rating.Hard` (2), and the code handles it by capping `gradeContinuous` to 2.0. The downstream `gradeToRating()` function maps grades < 2.5 to `Rating.Hard`, not `Rating.Again`. So the "deprecated" Hard rating is actively produced and consumed.
**User Impact:** The FSRS optimizer may see three rating values (1, 2, 3) instead of the documented binary (1, 3). This could confuse the optimizer's parameter fitting.
**Recommended Fix:** Either update the documentation to reflect the actual trinary rating system, or change Ghost Grader to return `Rating.Again` instead of `Rating.Hard` to match the documented binary model.
**Blocks Production:** No.

---

### Finding 11: Hinted Attempts Not Flagged in attempt.ts

**Severity:** MEDIUM
**Type:** Data Completeness
**Files:**
- `types/telemetry.ts`: `hint_viewed: boolean`, `hint_view_duration_ms: number | null`
- `functions/api/drills/submit-review.ts` (line 22): TelemetrySchema includes `hint_viewed`
- `functions/api/questions/attempt.ts`: No hint_viewed extraction or flagging
**Root Cause:** The telemetry schema captures whether the user viewed a hint before answering. In the drill path, this data is preserved in the telemetry JSON and the `server_computed` block. In the attempt.ts path, hints are not extracted or flagged at all.

For FSRS calibration, a hinted answer should arguably receive a lower rating than an unhinted one (the user needed help). Currently, hint-viewing has no effect on the rating derivation in either path — `deriveContinuousRating()` doesn't consider `hint_viewed`.
**User Impact:** Hinted answers receive the same FSRS rating as unhinted answers, potentially overestimating the user's retrieval strength for that concept.
**Recommended Fix:** (a) Add a hint penalty to `deriveContinuousRating()` (e.g., -0.3 grade when hint_viewed). (b) Ensure attempt.ts extracts and stores `hint_viewed` for analytics.
**Blocks Production:** No.

---

## Top 10 Findings (Ranked by Impact)

| # | Severity | Finding | Impact |
|---|----------|---------|--------|
| 1 | CRITICAL | Dual FSRS write paths with different rating logic (F1) | Inconsistent scheduling across session types |
| 2 | HIGH | attempt.ts doesn't write ReviewLog (F3) | Optimizer can't train on main-session data |
| 3 | HIGH | attempt.ts fetches ALL attempts for stats (F6) | Progressive performance degradation |
| 4 | MEDIUM | Rapid-guess not checked in attempt.ts (F4) | Gaming main-session FSRS |
| 5 | MEDIUM | server_computed block missing from attempt.ts (F8) | Hollow telemetry for main sessions |
| 6 | MEDIUM | sessionType type mismatch API vs service (F2) | Maintenance risk |
| 7 | MEDIUM | Hinted attempts not flagged or penalized (F11) | FSRS overestimates recall for hinted answers |
| 8 | MEDIUM | 4-letter answer map (E missing) (F7) | Null selectedAnswer for 5-option questions |
| 9 | LOW | Offline sync selectedAnswer type mismatch (F9) | All offline drill answers marked wrong |
| 10 | LOW | Ghost Grader returns deprecated Rating.Hard (F10) | Optimizer sees undocumented rating value |

---

## 3 Highest-Leverage Fixes

### Fix 1: Unify FSRS Scheduling into a Single Service

**Files:** New `lib/services/fsrsSchedulingService.ts` + edits to `attempt.ts` and `drillReviewService.ts`
**Effort:** ~4-6 hours
**Changes:**
1. Extract the FSRS scheduling logic from `drillReviewService.ts` (lines 580-636) into a standalone `scheduleFSRSReview()` function that accepts standardized input (behavioral metrics, par time, circadian context, urgency multiplier, EOR end date).
2. Have `drillReviewService` call this new function instead of inline FSRS logic.
3. Have `attempt.ts` call this same function instead of its own inline FSRS logic.
4. Both callers should use `calculateParTime()` (dynamic) instead of the hardcoded 30000ms.
5. Both callers should write to the SAME FSRS state store (pick one: `UserTopicProgress` or `UserProgress`).
6. Both callers should create a `ReviewLog` entry.

**Impact:** Eliminates the dual-path divergence, ensures consistent FSRS scheduling, and makes all reviews visible to the optimizer. This single fix addresses Findings 1, 3, 4 (partially), and 8.

### Fix 2: Replace Aggregate Stats Query with Atomic Counters

**Files:** `functions/api/questions/attempt.ts` (lines 233-264)
**Effort:** ~2 hours
**Changes:**
1. Add `totalAttempts`, `correctAttempts` columns to the `User` table (or a separate `UserStatsCache` table).
2. Replace the `findMany` + in-memory filter with `update({ data: { totalAttempts: { increment: 1 }, correctAttempts: correctness ? { increment: 1 } : undefined } })`.
3. For per-system stats, use a `UserSystemStats` table with `(userId, system)` compound key.

**Impact:** Eliminates the O(N) query that will eventually timeout. Changes the scaling behavior from O(total_attempts) to O(1) per submission.

### Fix 3: Add Rapid-Guess + server_computed + ReviewLog to attempt.ts

**Files:** `functions/api/questions/attempt.ts`
**Effort:** ~2 hours
**Changes:**
1. Import MVRT thresholds and `detectRapidGuess()` from `types/telemetry.ts`.
2. Before FSRS scheduling, check for rapid guess. If detected, skip FSRS update.
3. Build `server_computed` block (par_time_ms, latency_ratio, implicit_confidence, etc.) and merge into `telemetryJson` before writing `QuestionAttempt`.
4. Create a `ReviewLog` entry with the same structure as `drillReviewService` (or even better, unify per Fix 1).

**Impact:** Closes the analytics gap for main sessions, prevents gaming, and ensures the optimizer can train on all review data.

---

## Minimal Safe Implementation Plan

### Phase 1: Close the Gap (Day 1-2, ~6 hours)

1. **Fix 2 — Atomic counters:** Add UserStatsCache migration + replace findMany in attempt.ts.
2. **Add E to LETTERS:** Single-line fix in attempt.ts.
3. **Add sessionType 'drill' to SubmitDrillReviewInput:** Type-safety fix.
4. **Add rapid-guess detection to attempt.ts:** Import MVRT, check before FSRS.

### Phase 2: Unify FSRS (Day 3-5, ~8 hours)

5. **Fix 1 — Extract `scheduleFSRSReview()`:** New service, integrate into both paths.
6. **Add ReviewLog writing to attempt.ts** (or as part of the unified service).
7. **Add server_computed block to attempt.ts** telemetryJson.
8. **Decide on single FSRS state store:** Migrate `UserTopicProgress` → `UserProgress` or vice versa, with a data migration script.

### Phase 3: Refinement (Day 6-7, ~4 hours)

9. **Add hint_viewed penalty to deriveContinuousRating():** -0.3 grade when hint was viewed.
10. **Fix offline sync selectedAnswer type:** Store as letter in OfflineAnswer.
11. **Align Ghost Grader with documented binary model:** Either change to Again or update docs.

---

## What to Audit Next

**Audit 6: QuizView Session Lifecycle & State Management**

The 2274-line `QuizView.tsx` is the primary study UI where all telemetry originates. Recommended scope:
- Question queue management (LOW_QUEUE_THRESHOLD, replenishment logic)
- Answer selection state and submission flow
- How telemetry hooks are initialized and finalized per question
- Session recovery (`useQuizSessionRecovery`)
- Timer accuracy (does dwell time include explanation reading?)
- Memory pressure from accumulating telemetry in long sessions
- Interaction between QuizView and syncManager (when does queueAnswer fire?)
- Edge cases: rapid answer cycling, browser tab unfocus, network loss mid-submit
