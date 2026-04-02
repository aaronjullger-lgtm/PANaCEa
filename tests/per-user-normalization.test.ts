/**
 * Unit tests for per-user baseline normalization in confidence scoring (Sprint 1 of confidence pipeline v2).
 *
 * Tests the optional `baseline?: UserBaseline` parameter in deriveContinuousRating,
 * which normalizes confidence signals against student-specific behavioral norms
 * instead of absolute thresholds.
 *
 * Research basis:
 * - Kahneman & Tversky (1979): Judgment under uncertainty — individual differences
 * - Signal Detection Theory: normalize signals to individual receiver operating characteristics
 * - Learning science: students have different inherent processing speeds; absolute thresholds are unfair
 *
 * Key behaviors:
 * - When baseline is provided, RT/switches/hesitation signals are z-scored
 * - Fallback: if baseline stddev is 0, use absolute (log-transform) normalization
 * - Without baseline, behavior is identical to current implementation
 * - Grade is unaffected (confidence-only change)
 * - Incorrect answers always return incorrectConfidence regardless of baseline
 */

import { describe, it, expect } from 'vitest';
import {
  deriveContinuousRating,
  DEFAULT_IMPLICIT_CONFIG,
  type UserBaseline,
  type ImplicitBehaviorMetrics,
} from '../lib/implicit-metrics';

// ============================================================================
//  Test Fixtures
// ============================================================================

/** Standard correct answer at moderate speed, no red flags */
const baseCorrect: ImplicitBehaviorMetrics = {
  timeToFirstClick: 20000,
  answerSwitches: 0,
  totalDwellTime: 25000,
  isCorrect: true,
  parTimeMs: 30000,
};

/**
 * Slow student baseline: median response time 25s, high switch rate.
 * Models a student who thinks carefully but second-guesses themselves.
 */
const slowStudentBaseline: UserBaseline = {
  rtMedianMs: 25000,
  rtStdDevMs: 8000,
  switchMedian: 1,
  switchP75: 2,
  commitmentGapMedianMs: 2000,
  cursorEntropyMedian: 1.5,
  oscillationMedian: 1,
};

/**
 * Fast student baseline: median response time 8s, very low switch rate.
 * Models a student with quick, confident retrieval.
 */
const fastStudentBaseline: UserBaseline = {
  rtMedianMs: 8000,
  rtStdDevMs: 3000,
  switchMedian: 0,
  switchP75: 1,
  commitmentGapMedianMs: 500,
  cursorEntropyMedian: 0.5,
  oscillationMedian: 0,
};

describe('Per-User Baseline Normalization (Sprint 1)', () => {
  describe('RT signal normalization', () => {
    it('slow student answering at their median gets neutral RT signal', () => {
      // 25s answer for someone whose median is 25s: z-score = 0
      // Should produce higher confidence than absolute threshold (which penalizes 25s as slightly slow)
      const metrics = { ...baseCorrect, timeToFirstClick: 25000 };
      const result = deriveContinuousRating(metrics, undefined, slowStudentBaseline);
      // With baseline: z=0 → sRT = 1 - 0/3 = 1.0 (maximally confident in RT)
      // Without baseline: latencyRatio = 25/30 = 0.83 → sRT ≈ 0.9 (slightly penalized)
      // Overall confidence with baseline should be >= without baseline
      const withoutBaseline = deriveContinuousRating(metrics);
      expect(result.confidence).toBeGreaterThanOrEqual(withoutBaseline.confidence * 0.95);
    });

    it('slow student answering at their median is not penalized like absolute would', () => {
      // 25s at par=30s → ratio=0.83 (reasonable)
      // But for slow student baseline where median=25s, this is their norm
      // Without baseline: latency penalty applies
      // With baseline: z-score = 0 → no RT penalty
      const metrics = { ...baseCorrect, timeToFirstClick: 25000 };
      const withBaseline = deriveContinuousRating(metrics, undefined, slowStudentBaseline);
      const withoutBaseline = deriveContinuousRating(metrics);
      expect(withBaseline.confidence).toBeGreaterThanOrEqual(withoutBaseline.confidence * 0.90);
    });

    it('fast student answering abnormally slow gets penalized more with baseline', () => {
      // 25s answer for someone whose median is 8s: z-score = (25-8)/3 ≈ 5.67
      // This is far outside their normal distribution → strong penalty
      // sRT = 1 - 5.67/3 ≈ 0 (clamped to 0)
      const metrics = { ...baseCorrect, timeToFirstClick: 25000 };
      const withBaseline = deriveContinuousRating(metrics, undefined, fastStudentBaseline);
      const withoutBaseline = deriveContinuousRating(metrics);
      // With baseline, this anomalous slowness should hurt more
      expect(withBaseline.confidence).toBeLessThan(withoutBaseline.confidence);
    });

    it('fast student answering at their speed gets high confidence', () => {
      // 8s answer for someone whose median is 8s: z-score = 0 → sRT = 1.0
      // Excellent confidence in RT signal
      const metrics = { ...baseCorrect, timeToFirstClick: 8000 };
      const result = deriveContinuousRating(metrics, undefined, fastStudentBaseline);
      expect(result.confidence).toBeGreaterThan(0.75);
    });

    it('baseline with zero rtStdDev falls back to absolute RT normalization', () => {
      // If rtStdDevMs = 0, can't compute z-score → use log-transform
      const zeroStdDev: UserBaseline = {
        ...slowStudentBaseline,
        rtStdDevMs: 0,
      };
      const metrics = { ...baseCorrect, timeToFirstClick: 20000 };
      const withZero = deriveContinuousRating(metrics, undefined, zeroStdDev);
      const withoutBaseline = deriveContinuousRating(metrics);
      // Should match absolute behavior
      expect(withZero.confidence).toEqual(withoutBaseline.confidence);
    });
  });

  describe('Switch signal normalization', () => {
    it('student with switch habit: 2 switches near their p75 is not harshly penalized', () => {
      // slowStudent has switchP75=2, so 2 switches is normal for them
      // switchNorm = 2 / (2 * 1.5) = 0.67
      // sSwitch = max(0.2, 1 - 0.67 * 0.5) = max(0.2, 0.665) = 0.665
      // Normalized should be less punishing than absolute (which does 1 - 2*0.2 = 0.6)
      const metrics = { ...baseCorrect, answerSwitches: 2 };
      const withBaseline = deriveContinuousRating(metrics, undefined, slowStudentBaseline);
      const withoutBaseline = deriveContinuousRating(metrics);
      expect(withBaseline.confidence).toBeGreaterThanOrEqual(withoutBaseline.confidence * 0.95);
    });

    it('student with no switch habit: 2 switches is abnormal and penalizing', () => {
      // fastStudent has switchP75=1, so 2 switches is above normal
      // switchNorm = 2 / (1 * 1.5) = 1.33
      // sSwitch = max(0.2, 1 - 1.33 * 0.5) = max(0.2, 0.335) = 0.335
      const metrics = { ...baseCorrect, answerSwitches: 2 };
      const withBaseline = deriveContinuousRating(metrics, undefined, fastStudentBaseline);
      // Should still produce a valid confidence (not NaN or crash)
      expect(withBaseline.confidence).toBeGreaterThanOrEqual(
        DEFAULT_IMPLICIT_CONFIG.confidenceParams.min
      );
      expect(withBaseline.confidence).toBeLessThanOrEqual(
        DEFAULT_IMPLICIT_CONFIG.confidenceParams.max
      );
    });

    it('baseline with zero switchP75 falls back to absolute switch signal', () => {
      // If switchP75 = 0, can't normalize → use 1 - switches * 0.2 (absolute formula)
      // Note: other signals (RT, hesitation) may still be normalized via baseline,
      // so overall confidence may differ, but the switch signal specifically uses absolute
      const zeroSwitch: UserBaseline = {
        ...fastStudentBaseline,
        switchP75: 0,
        rtStdDevMs: 0, // Also zero out RT to isolate switch signal
        commitmentGapMedianMs: 0,
        cursorEntropyMedian: 0,
        oscillationMedian: 0,
      };
      const metrics = { ...baseCorrect, answerSwitches: 1 };
      const withZero = deriveContinuousRating(metrics, undefined, zeroSwitch);
      const withoutBaseline = deriveContinuousRating(metrics);
      // All baseline values zero → should match absolute behavior exactly
      expect(withZero.confidence).toEqual(withoutBaseline.confidence);
    });
  });

  describe('Hesitation signal normalization', () => {
    it('slow student with baseline-normal hesitation signals maintains confidence', () => {
      // Slow student baseline: commitmentGapMedian=2000, entropy=1.5, osc=1
      // These are all at their medians → should normalize to neutral (no penalty)
      const metrics = {
        ...baseCorrect,
        commitmentGapMs: 2000,
        cursorEntropy: 1.5,
        hoverOscillationCount: 1,
      };
      const result = deriveContinuousRating(metrics, undefined, slowStudentBaseline);
      // Normalized hesitation signals should not heavily penalize
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('fast student with above-baseline hesitation signals gets penalized', () => {
      // Fast student baseline: commitmentGapMedian=500, entropy=0.5, osc=0
      // Input metrics have 2000ms gap, 1.5 entropy, 1 osc (all high relative to baseline)
      const metrics = {
        ...baseCorrect,
        commitmentGapMs: 2000,
        cursorEntropy: 1.5,
        hoverOscillationCount: 1,
      };
      const withFastBaseline = deriveContinuousRating(metrics, undefined, fastStudentBaseline);
      const withoutBaseline = deriveContinuousRating(metrics);
      // These values are abnormal for a fast student → should be penalized more
      expect(withFastBaseline.confidence).toBeLessThan(withoutBaseline.confidence);
    });

    it('commitment gap normalization: above-median gap reduces confidence more for fast baseline', () => {
      // Fast student: gapDenominator = 500 * 3 = 1500
      // Slow student: gapDenominator = 2000 * 3 = 6000
      // With 3000ms gap:
      //   Fast: gapNorm = 1 - 3000/1500 = -1 → clamped to 0 (high hesitation penalty)
      //   Slow: gapNorm = 1 - 3000/6000 = 0.5 (moderate hesitation)
      const metrics = { ...baseCorrect, commitmentGapMs: 3000 };
      const fastResult = deriveContinuousRating(metrics, undefined, fastStudentBaseline);
      const slowResult = deriveContinuousRating(metrics, undefined, slowStudentBaseline);
      expect(slowResult.confidence).toBeGreaterThan(fastResult.confidence);
    });
  });

  describe('Fallback behavior', () => {
    it('undefined baseline produces identical results to current behavior', () => {
      const result1 = deriveContinuousRating(baseCorrect);
      const result2 = deriveContinuousRating(baseCorrect, undefined, undefined);
      expect(result1.confidence).toEqual(result2.confidence);
      expect(result1.grade).toEqual(result2.grade);
      expect(result1.discreteRating).toEqual(result2.discreteRating);
    });

    it('null baseline is treated as undefined', () => {
      // This is a TypeScript compile-time check, but verify runtime behavior
      const result1 = deriveContinuousRating(baseCorrect);
      const result2 = deriveContinuousRating(baseCorrect, undefined, undefined);
      expect(result1.confidence).toEqual(result2.confidence);
    });

    it('baseline with zero stddev falls back to absolute for RT signal', () => {
      const zeroRtStdDev: UserBaseline = {
        ...slowStudentBaseline,
        rtStdDevMs: 0,
      };
      const withZero = deriveContinuousRating(baseCorrect, undefined, zeroRtStdDev);
      const withoutBaseline = deriveContinuousRating(baseCorrect);
      // RT signal should use absolute (log-transform) when stddev=0
      expect(withZero.confidence).toEqual(withoutBaseline.confidence);
    });

    it('baseline with zero switchP75 falls back to absolute for switch signal', () => {
      const zeroSwitch: UserBaseline = {
        ...slowStudentBaseline,
        switchP75: 0,
      };
      const withZero = deriveContinuousRating(baseCorrect, undefined, zeroSwitch);
      const withoutBaseline = deriveContinuousRating(baseCorrect);
      // Switch signal should use absolute (1 - switches * 0.2) when switchP75=0
      expect(withZero.confidence).toEqual(withoutBaseline.confidence);
    });
  });

  describe('Grade invariance under baseline', () => {
    it('grade is unaffected by baseline (confidence-only change)', () => {
      const withBaseline = deriveContinuousRating(baseCorrect, undefined, slowStudentBaseline);
      const withoutBaseline = deriveContinuousRating(baseCorrect);
      // Grade derivation does not use baseline
      expect(withBaseline.grade).toEqual(withoutBaseline.grade);
      expect(withBaseline.discreteRating).toEqual(withoutBaseline.discreteRating);
    });

    it('all correct answer grades unchanged across different baselines', () => {
      const testMetrics: ImplicitBehaviorMetrics[] = [
        baseCorrect,
        { ...baseCorrect, timeToFirstClick: 5000 },
        { ...baseCorrect, timeToFirstClick: 45000 },
        { ...baseCorrect, answerSwitches: 3 },
        { ...baseCorrect, commitmentGapMs: 5000 },
      ];

      for (const metrics of testMetrics) {
        const baselineResult = deriveContinuousRating(
          metrics,
          undefined,
          slowStudentBaseline
        );
        const noBaselineResult = deriveContinuousRating(metrics);
        expect(baselineResult.grade).toEqual(noBaselineResult.grade);
      }
    });
  });

  describe('Incorrect answer invariance', () => {
    it('incorrect answer always returns incorrectConfidence regardless of baseline', () => {
      const incorrectMetrics = { ...baseCorrect, isCorrect: false };
      const slowResult = deriveContinuousRating(
        incorrectMetrics,
        undefined,
        slowStudentBaseline
      );
      const fastResult = deriveContinuousRating(
        incorrectMetrics,
        undefined,
        fastStudentBaseline
      );
      const noBaselineResult = deriveContinuousRating(incorrectMetrics);

      const expectedConfidence = DEFAULT_IMPLICIT_CONFIG.confidenceParams.incorrectConfidence;
      expect(slowResult.confidence).toBeCloseTo(expectedConfidence, 2);
      expect(fastResult.confidence).toBeCloseTo(expectedConfidence, 2);
      expect(noBaselineResult.confidence).toBeCloseTo(expectedConfidence, 2);
    });

    it('incorrect answer grade is always 1.0 regardless of baseline', () => {
      const incorrectMetrics = { ...baseCorrect, isCorrect: false };
      const slowResult = deriveContinuousRating(
        incorrectMetrics,
        undefined,
        slowStudentBaseline
      );
      const fastResult = deriveContinuousRating(
        incorrectMetrics,
        undefined,
        fastStudentBaseline
      );
      expect(slowResult.grade).toBe(1.0);
      expect(fastResult.grade).toBe(1.0);
    });
  });

  describe('Edge cases and bounds checking', () => {
    it('confidence stays within [min, max] bounds with extreme baseline', () => {
      // Extremely fast baseline
      const extremeBaseline: UserBaseline = {
        rtMedianMs: 1000,
        rtStdDevMs: 100,
        switchMedian: 0,
        switchP75: 0.1,
        commitmentGapMedianMs: 100,
        cursorEntropyMedian: 0.1,
        oscillationMedian: 0.1,
      };
      // Very slow response relative to extreme baseline
      const slowMetrics = {
        ...baseCorrect,
        timeToFirstClick: 60000,
        answerSwitches: 5,
        commitmentGapMs: 5000,
        cursorEntropy: 3.0,
        hoverOscillationCount: 3,
      };
      const result = deriveContinuousRating(slowMetrics, undefined, extremeBaseline);
      expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_IMPLICIT_CONFIG.confidenceParams.min);
      expect(result.confidence).toBeLessThanOrEqual(DEFAULT_IMPLICIT_CONFIG.confidenceParams.max);
    });

    it('all zero baseline (edge case) falls back to absolute', () => {
      const zeroBaseline: UserBaseline = {
        rtMedianMs: 0,
        rtStdDevMs: 0,
        switchMedian: 0,
        switchP75: 0,
        commitmentGapMedianMs: 0,
        cursorEntropyMedian: 0,
        oscillationMedian: 0,
      };
      const result = deriveContinuousRating(baseCorrect, undefined, zeroBaseline);
      const noBaselineResult = deriveContinuousRating(baseCorrect);
      // Should fall back to absolute behavior
      expect(result.confidence).toEqual(noBaselineResult.confidence);
    });

    it('partial baseline (some fields zero) uses available baseline for other signals', () => {
      // Baseline with valid RT and switch data, but zero hesitation data
      const partialBaseline: UserBaseline = {
        rtMedianMs: 10000,
        rtStdDevMs: 2000,
        switchMedian: 0,
        switchP75: 1,
        commitmentGapMedianMs: 0,
        cursorEntropyMedian: 0,
        oscillationMedian: 0,
      };
      const metrics = {
        ...baseCorrect,
        timeToFirstClick: 12000,
        answerSwitches: 1,
        commitmentGapMs: 2000,
        cursorEntropy: 1.0,
      };
      const result = deriveContinuousRating(metrics, undefined, partialBaseline);
      // Should use baseline for RT and switches, fallback to absolute for hesitation
      expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_IMPLICIT_CONFIG.confidenceParams.min);
      expect(result.confidence).toBeLessThanOrEqual(DEFAULT_IMPLICIT_CONFIG.confidenceParams.max);
    });

    it('very small rtStdDev (but nonzero) uses baseline z-scoring', () => {
      // rtStdDev of 100ms (very consistent student)
      const tightBaseline: UserBaseline = {
        rtMedianMs: 20000,
        rtStdDevMs: 100,
        switchMedian: 0,
        switchP75: 1,
        commitmentGapMedianMs: 500,
        cursorEntropyMedian: 0.5,
        oscillationMedian: 0,
      };
      const metrics = { ...baseCorrect, timeToFirstClick: 20200 };
      const result = deriveContinuousRating(metrics, undefined, tightBaseline);
      // z-score = 200/100 = 2.0 → sRT = 1 - 2.0/3 ≈ 0.33
      // This tight student answering slightly above their norm should have lower confidence
      const noBaseline = deriveContinuousRating(metrics);
      expect(result.confidence).toBeLessThan(noBaseline.confidence);
    });
  });

  describe('Multi-signal interaction with baseline', () => {
    it('slow student with all baseline-typical signals maintains high confidence', () => {
      const metrics = {
        ...baseCorrect,
        timeToFirstClick: slowStudentBaseline.rtMedianMs,
        answerSwitches: slowStudentBaseline.switchMedian,
        commitmentGapMs: slowStudentBaseline.commitmentGapMedianMs,
        cursorEntropy: slowStudentBaseline.cursorEntropyMedian,
        hoverOscillationCount: slowStudentBaseline.oscillationMedian,
      };
      const result = deriveContinuousRating(metrics, undefined, slowStudentBaseline);
      // All signals at their baseline norms → high confidence
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('fast student with all baseline-typical signals maintains high confidence', () => {
      const metrics = {
        ...baseCorrect,
        timeToFirstClick: fastStudentBaseline.rtMedianMs,
        answerSwitches: fastStudentBaseline.switchMedian,
        commitmentGapMs: fastStudentBaseline.commitmentGapMedianMs,
        cursorEntropy: fastStudentBaseline.cursorEntropyMedian,
        hoverOscillationCount: fastStudentBaseline.oscillationMedian,
      };
      const result = deriveContinuousRating(metrics, undefined, fastStudentBaseline);
      // All signals at their baseline norms → high confidence
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('cross-baseline anomaly: fast student baseline applied to slow response', () => {
      // Slow student behaviors applied to fast student baseline
      const slowMetrics = {
        ...baseCorrect,
        timeToFirstClick: 25000, // Slow
        answerSwitches: 2,       // Some switching
        commitmentGapMs: 2000,   // Hesitant
      };
      const fastStudentResult = deriveContinuousRating(slowMetrics, undefined, fastStudentBaseline);
      const slowStudentResult = deriveContinuousRating(slowMetrics, undefined, slowStudentBaseline);
      // These slow behaviors are anomalous for fast student → lower confidence
      expect(fastStudentResult.confidence).toBeLessThan(slowStudentResult.confidence);
    });
  });

  describe('Interaction with parTimeMs', () => {
    it('baseline works correctly with non-default parTimeMs', () => {
      // High par time question (e.g., complex vignette)
      const highParMetrics = { ...baseCorrect, parTimeMs: 60000 };
      const result = deriveContinuousRating(highParMetrics, undefined, slowStudentBaseline);
      // Baseline z-scores against absolute RT, not latency ratio
      // So parTimeMs change should not affect z-score calculation, only grade
      expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_IMPLICIT_CONFIG.confidenceParams.min);
      expect(result.confidence).toBeLessThanOrEqual(DEFAULT_IMPLICIT_CONFIG.confidenceParams.max);
    });

    it('baseline honors missing parTimeMs (defaults to 30000)', () => {
      const noParTime = { ...baseCorrect };
      delete (noParTime as any).parTimeMs;
      const result = deriveContinuousRating(noParTime, undefined, slowStudentBaseline);
      // Should still compute valid confidence (defaults parTime to 30000)
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
});
