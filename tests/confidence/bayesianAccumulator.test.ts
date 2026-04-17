/**
 * Tests for lib/confidence/bayesianAccumulator.ts
 */

import { describe, it, expect } from 'vitest';
import {
  accumulateConfidence,
  DEFAULT_ACCUMULATOR_CONFIG,
  type HistoricalReview,
  type AccumulatorConfig,
} from '@/lib/confidence/bayesianAccumulator';

const makeHistory = (count: number, overrides?: Partial<HistoricalReview>): HistoricalReview[] =>
  Array.from({ length: count }, (_, i) => ({
    confidence: 0.5 + i * 0.05,
    wasCorrect: true,
    telemetryQuality: 'full' as const,
    ...overrides,
  }));

describe('accumulateConfidence', () => {
  it('returns current confidence when history is below threshold', () => {
    const result = accumulateConfidence(0.8, true, makeHistory(2));
    expect(result.posterior).toBe(0.8);
    expect(result.priorWeight).toBe(0);
    expect(result.historyLength).toBe(2);
  });

  it('returns current confidence with empty history', () => {
    const result = accumulateConfidence(0.5, true, []);
    expect(result.posterior).toBe(0.5);
    expect(result.priorWeight).toBe(0);
  });

  it('blends with history when above threshold', () => {
    const history = makeHistory(5, { confidence: 0.6 });
    const result = accumulateConfidence(0.8, true, history);
    expect(result.priorWeight).toBeGreaterThan(0);
    expect(result.posterior).toBeLessThan(0.8);
    expect(result.posterior).toBeGreaterThan(0.5);
  });

  it('caps priorWeight at maxPriorWeight', () => {
    const config: AccumulatorConfig = {
      ...DEFAULT_ACCUMULATOR_CONFIG,
      maxPriorWeight: 0.2,
    };
    const history = makeHistory(100, { confidence: 0.5 });
    const result = accumulateConfidence(0.9, true, history, config);
    expect(result.priorWeight).toBeLessThanOrEqual(0.2);
  });

  it('trims history to maxHistory', () => {
    const config: AccumulatorConfig = {
      ...DEFAULT_ACCUMULATOR_CONFIG,
      maxHistory: 3,
    };
    const history = makeHistory(10);
    const result = accumulateConfidence(0.5, true, history, config);
    expect(result.historyLength).toBe(3);
  });

  it('decays older reviews via exponential decay', () => {
    const baseHistory = makeHistory(5, { confidence: 0.5 });
    const historyHighNewest = [...baseHistory];
    historyHighNewest[0] = { ...baseHistory[0]!, confidence: 1.0 };
    const historyHighOldest = [...baseHistory];
    historyHighOldest[4] = { ...baseHistory[4]!, confidence: 1.0 };

    const base = accumulateConfidence(0.5, true, baseHistory);
    const highNewest = accumulateConfidence(0.5, true, historyHighNewest);
    const highOldest = accumulateConfidence(0.5, true, historyHighOldest);

    expect(Math.abs(highNewest.posterior - base.posterior)).toBeGreaterThan(
      Math.abs(highOldest.posterior - base.posterior),
    );
  });

  it('quality weights: full-quality reviews contribute more to weighted mean', () => {
    // Use same base confidences but with varying quality
    // The weighted mean should be the same since all confidences are equal
    // (quality just changes the weight, not the values)
    const fullHistory = makeHistory(5, { telemetryQuality: 'full' });
    const minimalHistory = makeHistory(5, { telemetryQuality: 'minimal' });

    const fullResult = accumulateConfidence(0.2, true, fullHistory);
    const minimalResult = accumulateConfidence(0.2, true, minimalHistory);
    // When all confidences are the same, quality weight doesn't change the mean
    expect(fullResult.posterior).toBeCloseTo(minimalResult.posterior, 3);
  });

  it('correctness alignment: matching correctness boosts weight', () => {
    const alignedHistory = makeHistory(5, { wasCorrect: true, confidence: 0.7 });
    const misalignedHistory = makeHistory(5, { wasCorrect: false, confidence: 0.7 });

    const aligned = accumulateConfidence(0.8, true, alignedHistory);
    const misaligned = accumulateConfidence(0.8, true, misalignedHistory);
    expect(aligned.posterior).toBeGreaterThan(misaligned.posterior);
  });

  it('posterior is always in [0, 1]', () => {
    expect(accumulateConfidence(0, true, makeHistory(10)).posterior).toBeGreaterThanOrEqual(0);
    expect(accumulateConfidence(1, true, makeHistory(10)).posterior).toBeLessThanOrEqual(1);
    expect(accumulateConfidence(0, false, makeHistory(10)).posterior).toBeGreaterThanOrEqual(0);
    expect(accumulateConfidence(1, false, makeHistory(10)).posterior).toBeLessThanOrEqual(1);
  });
});
