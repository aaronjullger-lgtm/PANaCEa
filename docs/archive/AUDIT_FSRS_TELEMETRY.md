# FSRS v6 & Telemetry Audit Report

**Audit Date:** 2026-03-01  
**Audited Files:** `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`  
**Auditor:** Code Reviewer Expert  

## 1. Summary of Mathematical Deviations

The following table lists discrepancies between the intended dual‑output logic (continuous `implicit_confidence` + discrete FSRS rating) and the actual implementation.

| Deviation ID | Description | Location | Severity | Impact |
|--------------|-------------|----------|----------|--------|
| **DEV‑001**  | Rapid‑guess attempts are **not** written to the `ReviewLog` table. The guard clause `!isRapidGuess` (line 427) prevents `prisma.reviewLog.create` from being executed for rapid guesses. Rapid guesses are recorded only in `QuestionAttempt` (line 355). | `drillReviewService.ts:427` | Medium | Violates the requirement that rapid guesses be logged in `ReviewLog` with `telemetry.rapid_guess = true`. FSRS optimizer will lack these records for analytics. |
| **DEV‑002**  | The `ReviewLog.telemetry` field does **not** contain the complete, unaltered telemetry object received from the client. Instead, a curated subset of fields is stored (lines 519‑531). Original fields such as `duration_ms`, `question_type`, `mvrt_threshold_ms`, `hint_viewed`, etc. are omitted. | `drillReviewService.ts:519‑531` | Low | Telemetry integrity is partially compromised; the stored telemetry is not a faithful copy of the incoming data. However, the omitted fields are not required for FSRS optimization. |
| **DEV‑003**  | The `deriveImplicitRating` function (deprecated) returns a `confidence` value that is **not** independent of the derived `rating`. For incorrect answers, `confidence` is hard‑coded to 0.95 regardless of behavioral metrics (line 198). This coupling is intentional but may affect analytics if the deprecated function is used. | `implicit‑metrics.ts:198` | Low | Only relevant for legacy code; the production flow uses `deriveContinuousRating`. |

## 2. Audit Findings

### Objective 1: Dual‑Output Logic Verification  
**Status:** ✅ **PASS**  

**Evidence:**  
- The production‑grade function `deriveContinuousRating` (line 318) correctly produces two independent outputs: a continuous floating‑point `grade` (1.0–4.0) and a discrete `discreteRating` (1–4) via `gradeToRating` (line 372).  
- The continuous `grade` is used for analytics (stored as `grade_continuous` in `ReviewLog`), while the discrete `rating` is passed to `FSRS.next()`.  
- No contamination between the two outputs: the discrete rating is derived solely from the grade thresholds (`<1.5` → Again, `<2.5` → Hard, `<3.5` → Good, else Easy). Confidence is calculated separately and does not influence the rating.  
- The deprecated `deriveImplicitRating` also separates rating and confidence, albeit with a hard‑coded confidence for incorrect answers (expected behavior).  

**Line References:**  
- `implicit‑metrics.ts:318‑377` (`deriveContinuousRating`)  
- `implicit‑metrics.ts:372‑377` (`gradeToRating`)  
- `drillReviewService.ts:281` (call to `deriveContinuousRating`)  
- `drillReviewService.ts:317` (`rating = continuousResult.discreteRating`)  

### Objective 2: Data Purity Enforcement  
**Status:** ⚠️ **PARTIAL FAIL**  

**Evidence:**  
- **Rapid‑guess guard clause works correctly:** When `effectiveDurationMs < MVRT` (default 500 ms) or `telemetry.rapid_guess` is true, `isRapidGuess` becomes true (line 351). The condition `!isRapidGuess` (line 427) prevents FSRS state updates (`UserProgress` and `FSRS.next`). **PASS**.  
- **Rapid guesses are recorded in `QuestionAttempt`:** The `telemetryJson` includes `server_computed.is_rapid_guess = true` (lines 379, 400). **PASS**.  
- **Rapid guesses are NOT recorded in `ReviewLog`:** The `prisma.reviewLog.create` call is inside the `if (question.conditionId && countForFSRS && !isRapidGuess)` block (line 427). Consequently, rapid‑guess attempts are absent from the `ReviewLog` table. This violates the requirement that such attempts “are still recorded in the ReviewLog table with the field `telemetry.rapid_guess` set to `true`.” **FAIL**.  

**Line References:**  
- `drillReviewService.ts:350‑351` (`isRapidGuess` definition)  
- `drillReviewService.ts:427` (guard condition)  
- `drillReviewService.ts:355‑404` (`QuestionAttempt` creation with `is_rapid_guess`)  
- `drillReviewService.ts:490‑533` (`ReviewLog` creation – only reached when `!isRapidGuess`)  

### Objective 3: Telemetry Integrity Validation  
**Status:** ⚠️ **PARTIAL PASS**  

**Evidence:**  
- **Required fields are present:** `ReviewLog.telemetry` includes `par_time_ms`, `latency_ratio`, `answer_changes`, and `circadian_phase` with correct data types (lines 520‑531). **PASS**.  
- **Non‑truncated values:** The stored values are the exact numbers/strings computed on the server (no rounding or truncation). **PASS**.  
- **Complete serialization is NOT achieved:** The `telemetry` field does **not** contain the full, unaltered telemetry object from the request. It omits client‑reported fields such as `duration_ms`, `question_type`, `mvrt_threshold_ms`, `hint_viewed`, etc. While this is acceptable for the FSRS optimizer, it contradicts the requirement of “complete, unaltered serialization.” **FAIL**.  

**Line References:**  
- `drillReviewService.ts:519‑531` (`ReviewLog.telemetry` object)  
- `drillReviewService.ts:138‑150` (`SubmitDrillReviewInput.telemetry` type)  

## 3. Prescriptive Unit Test Specification

To formally prove the dual‑output logic operates as designed, the following Vitest test suite should be implemented. Each test validates a specific aspect of the `deriveContinuousRating` function.

### Test File: `lib/implicit‑metrics.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { deriveContinuousRating, DEFAULT_IMPLICIT_CONFIG } from './implicit‑metrics';
import { Rating } from './fsrs';

describe('deriveContinuousRating', () => {
  // --- Test Set 1: Correctness & Grade Boundaries ---
  describe('grade boundaries and discrete rating mapping', () => {
    it('maps grade < 1.5 to Rating.Again', () => {
      const metrics = {
        timeToFirstClick: 30000,
        answerSwitches: 0,
        totalDwellTime: 35000,
        isCorrect: false,  // base = 1.0
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metrics);
      expect(result.grade).toBeLessThan(1.5);
      expect(result.discreteRating).toBe(Rating.Again);
    });

    it('maps grade ∈ [1.5, 2.5) to Rating.Hard', () => {
      const metrics = {
        timeToFirstClick: 28000,  // latencyRatio ≈ 0.93
        answerSwitches: 2,
        totalDwellTime: 30000,
        isCorrect: true,           // base = 3.0
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metrics);
      expect(result.grade).toBeGreaterThanOrEqual(1.5);
      expect(result.grade).toBeLessThan(2.5);
      expect(result.discreteRating).toBe(Rating.Hard);
    });

    it('maps grade ∈ [2.5, 3.5) to Rating.Good', () => {
      const metrics = {
        timeToFirstClick: 15000,  // latencyRatio = 0.5 → bonusFast = 0.3
        answerSwitches: 0,
        totalDwellTime: 20000,
        isCorrect: true,
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metrics);
      expect(result.grade).toBeGreaterThanOrEqual(2.5);
      expect(result.grade).toBeLessThan(3.5);
      expect(result.discreteRating).toBe(Rating.Good);
    });

    it('maps grade ≥ 3.5 to Rating.Easy', () => {
      const metrics = {
        timeToFirstClick: 5000,   // latencyRatio ≈ 0.167 → bonusFast = 0.3
        answerSwitches: 0,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metrics);
      expect(result.grade).toBeGreaterThanOrEqual(3.5);
      expect(result.discreteRating).toBe(Rating.Easy);
    });
  });

  // --- Test Set 2: Confidence Independence ---
  describe('confidence calculation independence', () => {
    it('confidence does not affect discrete rating', () => {
      // Two scenarios with same latency/switch profile but different commitment gaps
      const baseMetrics = {
        timeToFirstClick: 20000,
        answerSwitches: 1,
        totalDwellTime: 25000,
        isCorrect: true,
        parTimeMs: 30000,
      };
      const lowConfidence = deriveContinuousRating({
        ...baseMetrics,
        commitmentGapMs: 5000,  // lowers confidence
      });
      const highConfidence = deriveContinuousRating({
        ...baseMetrics,
        commitmentGapMs: 0,
      });
      // Confidence should differ
      expect(lowConfidence.confidence).toBeLessThan(highConfidence.confidence);
      // Discrete rating must stay the same
      expect(lowConfidence.discreteRating).toBe(highConfidence.discreteRating);
    });

    it('confidence is clamped between 0.5 and 0.95', () => {
      const metrics = {
        timeToFirstClick: 20000,
        answerSwitches: 10,      // large penalty
        totalDwellTime: 25000,
        isCorrect: true,
        parTimeMs: 30000,
        commitmentGapMs: 10000,
        cursorEntropy: 2.5,
      };
      const result = deriveContinuousRating(metrics);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  // --- Test Set 3: Rapid‑Guess Guard Integration ---
  describe('integration with rapid‑guess guard', () => {
    it('returns valid rating even when duration < 500ms', () => {
      const metrics = {
        timeToFirstClick: 200,
        answerSwitches: 0,
        totalDwellTime: 200,
        isCorrect: true,
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metrics);
      // Should still produce a rating (the guard is applied upstream)
      expect([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]).toContain(result.discreteRating);
      expect(result.grade).toBeGreaterThanOrEqual(1.0);
      expect(result.grade).toBeLessThanOrEqual(4.0);
    });
  });

  // --- Test Set 4: Edge Cases ---
  describe('edge cases', () => {
    it('handles missing parTimeMs (defaults to 30 s)', () => {
      const metrics = {
        timeToFirstClick: 15000,
        answerSwitches: 0,
        totalDwellTime: 20000,
        isCorrect: true,
        // parTimeMs omitted
      };
      const result = deriveContinuousRating(metrics);
      expect(result.grade).toBeCloseTo(3.0, 1); // baseline correct ≈ 3.0
    });

    it('clamps grade to [1.0, 4.0]', () => {
      const metrics = {
        timeToFirstClick: 60000,  // very slow
        answerSwitches: 5,
        totalDwellTime: 70000,
        isCorrect: true,
        parTimeMs: 10000,
      };
      const result = deriveContinuousRating(metrics);
      expect(result.grade).toBeGreaterThanOrEqual(1.0);
      expect(result.grade).toBeLessThanOrEqual(4.0);
    });
  });
});
```

### Test File: `lib/services/drillReviewService.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { submitDrillReview } from './drillReviewService';
import { PrismaClient } from '@prisma/client';
import { Rating } from '../fsrs';

// Mock external dependencies as needed.
describe('drillReviewService rapid‑guess handling', () => {
  it('creates QuestionAttempt but skips ReviewLog when rapid‑guess detected', async () => {
    // … implement integration test that verifies DEV‑001.
  });

  it('stores full telemetry in QuestionAttempt.telemetryJson', async () => {
    // … verify that the complete telemetry object is preserved in QuestionAttempt.
  });

  it('stores curated telemetry subset in ReviewLog.telemetry', async () => {
    // … verify that ReviewLog.telemetry contains the required fields.
  });
});
```

## 4. Recommendations

1. **Fix DEV‑001:** Move the `prisma.reviewLog.create` call outside the rapid‑guess guard (or add a separate branch) so that rapid‑guess attempts are still logged with `telemetry.rapid_guess = true`. Ensure the `sessionType` is set to a value that excludes them from FSRS optimization (e.g., `'RAPID_GUESS'`).

2. **Fix DEV‑002:** Either update the requirement to accept a curated telemetry subset, or store the full incoming telemetry object in `ReviewLog.telemetry` (e.g., by spreading `...telemetry` into the object). Consider storing raw telemetry in a separate JSON column if the optimizer does not need it.

3. **Address DEV‑003:** No action required; the deprecated `deriveImplicitRating` is not used in production. The active `deriveContinuousRating` already satisfies the dual‑output requirement.

4. **Implement the prescribed unit tests** to provide formal proof of correctness and prevent regressions.

---

*Audit completed. The core FSRS scheduling logic is sound; the identified deviations are limited to logging and telemetry storage.*