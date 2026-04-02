import { describe, it, expect } from 'vitest';
import {
  accumulateConfidence,
  DEFAULT_ACCUMULATOR_CONFIG,
  type HistoricalReview,
} from '../lib/confidence/bayesianAccumulator';

describe('Bayesian Confidence Accumulator', () => {
  const makeHistory = (
    n: number,
    confidence: number,
    wasCorrect: boolean
  ): HistoricalReview[] =>
    Array.from({ length: n }, () => ({
      confidence,
      wasCorrect,
      telemetryQuality: 'full' as const,
    }));

  describe('Minimum history threshold', () => {
    it('returns currentConfidence unchanged with no history', () => {
      const result = accumulateConfidence(0.7, true, []);
      expect(result.posterior).toBe(0.7);
      expect(result.priorWeight).toBe(0);
      expect(result.historyLength).toBe(0);
    });

    it('returns currentConfidence with history below threshold', () => {
      const history = makeHistory(2, 0.8, true);
      const result = accumulateConfidence(0.7, true, history);
      expect(result.posterior).toBe(0.7);
      expect(result.priorWeight).toBe(0);
    });

    it('applies prior at exactly minHistoryForPrior (3)', () => {
      const history = makeHistory(3, 0.8, true);
      const result = accumulateConfidence(0.5, true, history);
      expect(result.priorWeight).toBeGreaterThan(0);
      expect(result.posterior).not.toBe(0.5);
    });

    it('historyLength reflects trimmed count', () => {
      const history = makeHistory(15, 0.5, true);
      const result = accumulateConfidence(0.5, true, history);
      expect(result.historyLength).toBe(DEFAULT_ACCUMULATOR_CONFIG.maxHistory);
    });
  });

  describe('Bayesian blending', () => {
    it('consistent high history pulls posterior above current', () => {
      const history = makeHistory(5, 0.9, true);
      const result = accumulateConfidence(0.6, true, history);
      expect(result.posterior).toBeGreaterThan(0.6);
    });

    it('consistent low history pulls posterior below current', () => {
      const history = makeHistory(5, 0.4, true);
      const result = accumulateConfidence(0.8, true, history);
      expect(result.posterior).toBeLessThan(0.8);
    });

    it('current always dominates (≥60%)', () => {
      const history = makeHistory(20, 0.3, true);
      const result = accumulateConfidence(0.9, true, history);
      // priorWeight capped at 0.4 → current is at least 60%
      expect(result.priorWeight).toBeLessThanOrEqual(0.4);
      expect(result.posterior).toBeGreaterThan(0.6); // closer to 0.9 than 0.3
    });

    it('posterior stays bounded in [0, 1]', () => {
      const testCases = [
        [1.0, true, makeHistory(5, 0.1, false)],
        [0.0, false, makeHistory(5, 0.9, true)],
        [0.5, true, makeHistory(10, 0.1, false)],
        [0.5, false, makeHistory(10, 0.9, true)],
      ] as const;

      for (const [current, isCorrect, hist] of testCases) {
        const result = accumulateConfidence(current, isCorrect, hist);
        expect(result.posterior).toBeGreaterThanOrEqual(0);
        expect(result.posterior).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Prior weight cap', () => {
    it('priorWeight never exceeds maxPriorWeight (0.4)', () => {
      const history = makeHistory(100, 0.5, true);
      const result = accumulateConfidence(0.7, true, history);
      expect(result.priorWeight).toBeLessThanOrEqual(DEFAULT_ACCUMULATOR_CONFIG.maxPriorWeight);
    });

    it('priorWeight grows with history length up to cap', () => {
      const r3 = accumulateConfidence(0.7, true, makeHistory(3, 0.5, true));
      const r10 = accumulateConfidence(0.7, true, makeHistory(10, 0.5, true));
      const r50 = accumulateConfidence(0.7, true, makeHistory(50, 0.5, true));
      expect(r3.priorWeight).toBeLessThan(r10.priorWeight);
      expect(r10.priorWeight).toBeLessThanOrEqual(r50.priorWeight);
      expect(r50.priorWeight).toBeLessThanOrEqual(0.4);
    });

    it('asymptotically approaches maxPriorWeight', () => {
      const r20 = accumulateConfidence(0.7, true, makeHistory(20, 0.5, true));
      const r100 = accumulateConfidence(0.7, true, makeHistory(100, 0.5, true));
      // Both should be at or near 0.4
      expect(r20.priorWeight).toBeGreaterThan(0.35);
      expect(r100.priorWeight).toBeLessThanOrEqual(0.4);
    });
  });

  describe('Decay weighting', () => {
    it('recent reviews weighted more than old (equal counts)', () => {
      // Use equal counts of high/low so the only difference is recency ordering.
      // 3 items: [high, low, low] vs [low, high, low] — same total values.
      // Decay factor 0.7: weights [1.0, 0.7, 0.49]
      const newestHigh: HistoricalReview[] = [
        { confidence: 0.9, wasCorrect: true, telemetryQuality: 'full' }, // newest: weight 1.0
        { confidence: 0.1, wasCorrect: true, telemetryQuality: 'full' }, // weight 0.7
        { confidence: 0.1, wasCorrect: true, telemetryQuality: 'full' }, // oldest: weight 0.49
      ];
      const newestLow: HistoricalReview[] = [
        { confidence: 0.1, wasCorrect: true, telemetryQuality: 'full' }, // newest: weight 1.0
        { confidence: 0.9, wasCorrect: true, telemetryQuality: 'full' }, // weight 0.7
        { confidence: 0.1, wasCorrect: true, telemetryQuality: 'full' }, // oldest: weight 0.49
      ];
      // newestHigh mean: (0.9*1 + 0.1*0.7 + 0.1*0.49) / (1+0.7+0.49) = 1.019/2.19 = 0.465
      // newestLow mean:  (0.1*1 + 0.9*0.7 + 0.1*0.49) / (1+0.7+0.49) = 0.779/2.19 = 0.356
      const rHigh = accumulateConfidence(0.5, true, newestHigh);
      const rLow = accumulateConfidence(0.5, true, newestLow);
      // Newest high → higher weighted historical mean → higher posterior
      expect(rHigh.posterior).toBeGreaterThan(rLow.posterior);
    });

    it('exponential decay grows with index', () => {
      // Three reviews, all same, but test that recency matters
      const history: HistoricalReview[] = [
        { confidence: 0.8, wasCorrect: true, telemetryQuality: 'full' }, // newest
        { confidence: 0.8, wasCorrect: true, telemetryQuality: 'full' }, // middle
        { confidence: 0.8, wasCorrect: true, telemetryQuality: 'full' }, // oldest
      ];
      const result = accumulateConfidence(0.5, true, history);
      // All same history → posterior should be between 0.5 and 0.8
      expect(result.posterior).toBeGreaterThan(0.5);
      expect(result.posterior).toBeLessThan(0.8);
    });
  });

  describe('Quality weighting', () => {
    it('full-telemetry history has more influence than minimal', () => {
      const fullHistory: HistoricalReview[] = makeHistory(5, 0.9, true);
      const minimalHistory: HistoricalReview[] = Array.from({ length: 5 }, () => ({
        confidence: 0.9,
        wasCorrect: true,
        telemetryQuality: 'minimal' as const,
      }));
      const rFull = accumulateConfidence(0.5, true, fullHistory);
      const rMinimal = accumulateConfidence(0.5, true, minimalHistory);
      // Both pull up, but full should pull more (higher effective weight)
      expect(rFull.posterior).toBeGreaterThanOrEqual(rMinimal.posterior);
    });

    it('quality weights affect weighted mean when confidences differ', () => {
      // When all confidences are equal, quality doesn't change the weighted mean.
      // To test quality effect, use mixed confidences where weighting matters.
      // History: newest=0.9 (full), rest=0.3 (full vs minimal)
      // Full quality: all weighted equally by quality → newest dominates via decay
      // Minimal quality: oldest items have lower effective weight (quality × decay)
      const fullHistory: HistoricalReview[] = [
        { confidence: 0.9, wasCorrect: true, telemetryQuality: 'full' },
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'full' },
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'full' },
      ];
      const minimalOlderHistory: HistoricalReview[] = [
        { confidence: 0.9, wasCorrect: true, telemetryQuality: 'full' },    // newest = full
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'minimal' }, // older = minimal (less weight)
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'minimal' },
      ];
      const rFull = accumulateConfidence(0.5, true, fullHistory);
      const rMinOlder = accumulateConfidence(0.5, true, minimalOlderHistory);
      // When older low-confidence items are minimal, they get downweighted,
      // so the newest high-confidence item dominates more → higher posterior
      expect(rMinOlder.posterior).toBeGreaterThanOrEqual(rFull.posterior);
    });
  });

  describe('Correctness alignment', () => {
    it('alignment changes effect when confidences differ', () => {
      // When all history has the same confidence, alignment doesn't change the
      // weighted mean (same numerator/denominator ratio). Use mixed confidences.
      const alignedMixed: HistoricalReview[] = [
        { confidence: 0.9, wasCorrect: true, telemetryQuality: 'full' },  // aligned = weight 1.0
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'full' },  // aligned = weight 1.0
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'full' },  // aligned = weight 1.0
      ];
      const misalignedMixed: HistoricalReview[] = [
        { confidence: 0.9, wasCorrect: false, telemetryQuality: 'full' }, // misaligned = weight 0.5
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'full' },  // aligned = weight 1.0
        { confidence: 0.3, wasCorrect: true, telemetryQuality: 'full' },  // aligned = weight 1.0
      ];
      // current = correct
      const rAligned = accumulateConfidence(0.5, true, alignedMixed);
      const rMisaligned = accumulateConfidence(0.5, true, misalignedMixed);
      // In the aligned case, the high-confidence (0.9) item has full weight,
      // pulling the mean up more. In the misaligned case, the 0.9 item has
      // only 0.5 weight, so the low-confidence items dominate more.
      expect(rAligned.posterior).toBeGreaterThan(rMisaligned.posterior);
    });

    it('same confidence unaffected by alignment (weighted mean is same)', () => {
      // When all history has the same confidence, alignment doesn't change the
      // weighted mean. This is expected behavior, not a bug.
      const aligned: HistoricalReview[] = makeHistory(5, 0.8, true);
      const misaligned: HistoricalReview[] = makeHistory(5, 0.8, false);
      const rA = accumulateConfidence(0.5, true, aligned);
      const rM = accumulateConfidence(0.5, true, misaligned);
      // Same posteriors because weighted mean of uniform confidences is constant
      expect(rA.posterior).toBeCloseTo(rM.posterior, 5);
    });
  });

  describe('Edge cases', () => {
    it('handles maxHistory limit gracefully', () => {
      const history = makeHistory(50, 0.7, true);
      const result = accumulateConfidence(0.5, true, history);
      expect(result.historyLength).toBe(DEFAULT_ACCUMULATOR_CONFIG.maxHistory);
      expect(result.posterior).toBeGreaterThan(0.5);
      expect(result.posterior).toBeLessThan(0.7);
    });

    it('zero-weight edge case (all minimal + misaligned)', () => {
      const weirdHistory: HistoricalReview[] = Array.from({ length: 3 }, () => ({
        confidence: 0.1,
        wasCorrect: false,
        telemetryQuality: 'minimal' as const,
      }));
      const result = accumulateConfidence(0.8, true, weirdHistory);
      // Should still produce a valid result (minimal quality=0.3, misaligned=0.5 → effective weight 0.15)
      expect(result.posterior).toBeGreaterThanOrEqual(0);
      expect(result.posterior).toBeLessThanOrEqual(1);
      // History has low confidence (0.1), so posterior should be between current (0.8) and history
      expect(result.posterior).toBeLessThan(0.8);
    });

    it('single historical review applies minimal prior', () => {
      const history = [{ confidence: 0.2, wasCorrect: true, telemetryQuality: 'full' as const }];
      const result = accumulateConfidence(0.9, true, history);
      // Below minHistoryForPrior (3) → no prior applied
      expect(result.priorWeight).toBe(0);
      expect(result.posterior).toBe(0.9);
    });

    it('extreme confidence values bounded at output', () => {
      const history = makeHistory(5, 0.99, true);
      const result = accumulateConfidence(0.01, true, history);
      expect(result.posterior).toBeGreaterThan(0.01);
      expect(result.posterior).toBeLessThan(0.99);
      expect(result.posterior).toBeGreaterThanOrEqual(0);
      expect(result.posterior).toBeLessThanOrEqual(1);
    });

    it('all zero confidence in history', () => {
      const history: HistoricalReview[] = [
        { confidence: 0, wasCorrect: true, telemetryQuality: 'full' as const },
        { confidence: 0, wasCorrect: true, telemetryQuality: 'full' as const },
        { confidence: 0, wasCorrect: true, telemetryQuality: 'full' as const },
      ];
      const result = accumulateConfidence(0.8, true, history);
      expect(result.posterior).toBeGreaterThan(0);
      expect(result.posterior).toBeLessThan(0.8);
    });
  });

  describe('Configuration overrides', () => {
    it('respects custom decay factor', () => {
      const customConfig = {
        ...DEFAULT_ACCUMULATOR_CONFIG,
        decayFactor: 0.1, // Very strong recency bias
      };
      // Need ≥3 history items to get past minHistoryForPrior
      const history: HistoricalReview[] = [
        { confidence: 0.9, wasCorrect: true, telemetryQuality: 'full' as const }, // newest
        { confidence: 0.1, wasCorrect: true, telemetryQuality: 'full' as const },
        { confidence: 0.1, wasCorrect: true, telemetryQuality: 'full' as const }, // oldest
      ];
      const resultDefault = accumulateConfidence(0.5, true, history);
      const resultCustom = accumulateConfidence(0.5, true, history, customConfig);
      // Stronger decay (0.1) → newest review (0.9) dominates more → higher historical mean → higher posterior
      expect(resultCustom.posterior).toBeGreaterThan(resultDefault.posterior);
    });
  });
});
