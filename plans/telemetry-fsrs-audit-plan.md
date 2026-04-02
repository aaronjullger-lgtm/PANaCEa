# Telemetry, Behavioral Analysis & FSRS Logging — Architectural Plan

**Date:** 2026-04-01
**Author:** Staff Data Engineer / Learning Science Architect
**Status:** AWAITING APPROVAL
**Scope:** Telemetry pipeline from client collection → `drillReviewService` → `ReviewLog` → FSRS optimizer

---

## Phase 1 Findings: Current State Audit

### Architecture Overview

```
Client Hooks                    Server Pipeline                    Optimizer
─────────────                   ───────────────                    ─────────
useDrillFSRS()          →  POST /api/drills/submit-review
useImplicitMetrics()    →       ↓
                            drillReviewService.ts
                            ├─ resolveCorrectAnswer()
                            ├─ deriveContinuousRating()  ← implicit-metrics.ts
                            ├─ applyHonestRating()       ← ghostGrader.ts
                            ├─ FSRS.next()               ← fsrs.ts
                            ├─ QuestionAttempt.create()
                            ├─ ReviewLog.create()         →  fsrsOptimization.ts (weekly)
                            └─ UserProgress.update()           ↓
                                                           fsrs-optimizer.ts (L-BFGS)
                                                               ↓
                                                           PersonalizedFSRSParams
```

### Data Flow: Behavioral Metrics → Binary Rating

1. **Client collects**: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, plus optional CRPL fields (`selection_drift_ms`, `cursor_entropy`, `hover_oscillations`, `tremor_score`, `vignette_regressions`)
2. **`deriveContinuousRating()`** produces `grade` (1.0–4.0) from:
   - Base: correct=3.0, incorrect=1.0
   - Penalties: answer switches, latency excess, commitment gap, cursor entropy, hover oscillations
   - Bonuses: speed tiers, clean-answer bonus
3. **`applyHonestRating()`** (Ghost Grader) caps at Hard if: oscillations>2, drift>3s, or tremor≥0.6
4. **Effective binary output**: Again(1) or Good(3). Hard(2) and Easy(4) exist in code but are deprecated/near-unreachable.

### Identified Gaps (Severity-Ranked)

#### GAP-1: Rapid Guess Uses Wrong Threshold [HIGH — Silent FSRS Pollution]
**File:** `drillReviewService.ts:367`
**Issue:** `isRapidGuess = telemetry?.rapid_guess ?? numericTime < 500`
The 500ms fallback ignores question-type-specific MVRT thresholds (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms). A vignette answered in 600ms passes through to FSRS as a legitimate review.
**Impact:** Rapid guesses on complex questions pollute the optimizer with fake "Again" or "Good" signals.

#### GAP-2: `hint_viewed` Captured but Never Penalized [MEDIUM — Rating Accuracy]
**File:** `implicit-metrics.ts` (entire file)
**Issue:** `TelemetryData.hint_viewed` and `hint_view_duration_ms` are collected client-side and stored in `QuestionAttempt.telemetryJson`, but `deriveContinuousRating()` never reads them.
**Impact:** A student who views a hint before answering correctly gets the same Good(3) rating as one who recalls independently. This inflates stability, scheduling the card too far out.

#### GAP-3: `isTelemetryData()` Type Guard Defined but Never Used [MEDIUM — Data Integrity]
**File:** `types/telemetry.ts:551-566`
**Issue:** The validator exists but is never called in the submission pipeline. Missing required telemetry fields silently fall through to scattered `?? 0` / `?? null` fallbacks.
**Impact:** Inconsistent telemetry shapes in the database; impossible to distinguish "field was 0" from "field was missing."

#### GAP-4: Inconsistent `telemetryJson` Structures [MEDIUM — Optimizer Training Quality]
**File:** `drillReviewService.ts:400-437`
**Issue:** Two code paths produce different JSON shapes:
- Path A (client telemetry present): `{ ...clientFields, server_computed: {...} }`
- Path B (no client telemetry): `{ duration_ms, rapid_guess, question_type, ..., server_computed: {...} }`
**Impact:** Downstream consumers (DataExport, analyze-behavior API) must handle both shapes.

#### GAP-5: `cursorEntropy` Has No Fallback Default [LOW — Edge Case]
**File:** `drillReviewService.ts:270`
**Issue:** `cursorEntropy = telemetry?.cursor_entropy as number | undefined` — no `?? 0` fallback.
**Impact:** In `deriveContinuousRating()`, the entropy penalty uses `?? 0`, so this is safe at runtime. But the inconsistency with other fields is a maintenance trap.

#### GAP-6: Trajectory Metrics Captured but Unused in Rating [LOW — Deferred Value]
**File:** `implicit-metrics.ts`
**Issue:** `interpretTrajectoryForRating()` exists in `micro-kinetics.ts` but is never called in the rating pipeline.
**Impact:** Low — trajectory is Phase 3A experimental data. Premature to integrate without calibration data. **No action recommended now.**

---

## Phase 2: Proposed Changes

### CHANGE-1: Question-Type-Aware Rapid Guess Detection [HIGH PRIORITY]

**Rationale:** The hardcoded 500ms threshold misses rapid guesses on vignettes (should be 3000ms). This is the single highest-impact data quality fix.

**Implementation:**
- In `drillReviewService.ts`, replace the fallback rapid-guess detection with MVRT-aware logic
- Import `getMVRTThreshold` from `types/telemetry.ts`
- Use `telemetry?.question_type` (already sent by client) to select the correct threshold
- When telemetry is absent, use `'unknown'` type (2000ms default — 4x safer than 500ms)

```typescript
// BEFORE (line 367):
const isRapidGuess = telemetry?.rapid_guess ?? numericTime < 500;

// AFTER:
import { getMVRTThreshold, type QuestionType } from '../../types/telemetry';
const mvrtThreshold = telemetry?.mvrt_threshold_ms
  ?? getMVRTThreshold((telemetry?.question_type as QuestionType) ?? 'unknown');
const isRapidGuess = telemetry?.rapid_guess ?? numericTime < mvrtThreshold;
```

**Risk:** Some previously-passing reviews may now be flagged as rapid guesses. This is correct behavior — they were silently polluting FSRS.

### CHANGE-2: Hint-Viewed Penalty in `deriveContinuousRating()` [MEDIUM PRIORITY]

**Rationale:** Viewing a hint before answering is a strong signal of weak retrieval. Research on the testing effect (Roediger & Karpicke, 2006) shows that aided recall produces weaker long-term retention than unaided recall. The rating should reflect this.

**Implementation:**
- Add `hintViewed` and `hintViewDurationMs` to `ImplicitBehaviorMetrics`
- In `deriveContinuousRating()`, apply a penalty when `hintViewed === true`
- Penalty: 0.4 grade points (configurable via `ImplicitRatingConfig.penalties.hintViewed`)
- Additional time-proportional penalty: `min(hintViewDurationMs / 10000, 0.3)` — longer hint viewing = weaker recall signal

```typescript
// New fields in ImplicitBehaviorMetrics:
hintViewed?: boolean;
hintViewDurationMs?: number | null;

// New penalty config:
penalties: {
  ...existing,
  hintViewed: 0.4,
  hintViewDurationPerSec: 0.03,  // per second of hint viewing, max 0.3
}

// New penalty in deriveContinuousRating():
const penaltyHint = metrics.hintViewed
  ? p.hintViewed + Math.min((metrics.hintViewDurationMs ?? 0) / 10000 * 3, 0.3)
  : 0;
```

**Effect on ratings:** A correct answer with hint viewed: grade drops from ~3.0 to ~2.6 (still Good) or lower with long viewing (potentially Hard/Again). This correctly schedules the card for sooner review.

### CHANGE-3: Telemetry Quality Assessment [MEDIUM PRIORITY]

**Rationale:** Prevent incomplete telemetry from producing misleading ratings. Tag each review with data quality for future optimizer filtering.

**Implementation:**
- Create `assessTelemetryQuality()` in `lib/implicit-metrics.ts`
- Add `telemetry_quality` field to `server_computed` in ReviewLog JSONB
- Log warnings for `minimal` quality reviews

```typescript
export type TelemetryQuality = 'full' | 'partial' | 'minimal';

export function assessTelemetryQuality(
  raw?: Record<string, unknown>
): TelemetryQuality {
  const hasFirstClick = raw?.time_to_first_interaction_ms != null;
  const hasSwitches = (raw?.answer_changes as number | undefined) != null;
  const hasCRPL = raw?.hover_oscillations != null || raw?.selection_drift_ms != null;

  if (hasFirstClick && hasSwitches && hasCRPL) return 'full';
  if (hasFirstClick || hasSwitches) return 'partial';
  return 'minimal';
}
```

### CHANGE-4: Normalize Telemetry Defaults at Entry [LOW PRIORITY]

**Rationale:** Replace scattered `?? 0` / `?? null` fallbacks with a single normalization step at the top of `submitDrillReview()`.

**Implementation:**
- Create `normalizeTelemetryFields()` helper in `drillReviewService.ts`
- Apply once at entry, then pass the normalized object downstream
- Fixes cursorEntropy missing-default inconsistency (GAP-5)

### CHANGE-5: Add `telemetry_quality` to ReviewLog server_computed [LOW PRIORITY]

**Rationale:** The optimizer sidecar currently treats all `review_type: 'real'` reviews equally. Reviews with `minimal` telemetry quality have less reliable grades. Tagging them enables future optimizer filtering.

**Implementation:**
- Add `telemetry_quality` field to the `server_computed` block in `buildReviewLogTelemetry()`
- No schema migration needed — it's a JSON field addition inside existing JSONB

---

## What We Are NOT Changing

1. **FSRS core equations** — `FSRS.next()`, stability/difficulty/retrievability math untouched
2. **Trajectory metrics integration** — Premature without calibration data
3. **Ghost Grader thresholds** — Current oscillation (>2), drift (>3s), and tremor (>=0.6) thresholds are well-calibrated
4. **Binary rating model** — Again(1)/Good(3) remains the effective output
5. **Optimizer data format** — The `grade`, `state`, `stability`, `difficulty`, `elapsedDays`, `wasCorrect` fields consumed by the optimizer are unchanged

---

## Implementation Order

| Step | Change | Files Modified | Risk |
|------|--------|---------------|------|
| 1 | CHANGE-4: Normalize telemetry | `drillReviewService.ts` | Low — refactor, no behavioral change |
| 2 | CHANGE-1: MVRT-aware rapid guess | `drillReviewService.ts` | Medium — may flag more rapid guesses (correct) |
| 3 | CHANGE-2: Hint penalty | `implicit-metrics.ts`, `drillReviewService.ts` | Medium — changes ratings for hint users |
| 4 | CHANGE-3 + CHANGE-5: Telemetry quality | `implicit-metrics.ts`, `drillReviewService.ts` | Low — diagnostic only |

---

## Test Plan

1. **MVRT rapid-guess tests**: Submit attempts at 600ms for vignette type → must flag as rapid guess
2. **Hint penalty tests**: Correct answer with `hintViewed: true` → grade must be lower than without hint
3. **Hint penalty bounds**: Hint penalty must not push grade below 1.0 (clamp still applies)
4. **Hint penalty backwards-compat**: `hintViewed: undefined` → no penalty applied (grade unchanged)
5. **Telemetry quality assessment**: Full/partial/minimal classification for various field combinations
6. **Rapid-guess FSRS exclusion**: Rapid guess flagged → no FSRS state update, no UserProgress change
7. **Normalized telemetry defaults**: All fields present in normalized object regardless of client input
