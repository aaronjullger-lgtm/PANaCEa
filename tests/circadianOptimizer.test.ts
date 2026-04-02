/**
 * Sprint 9: Circadian-Aware FSRS Optimizer Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getCircadianPhase,
  splitByCircadianPhase,
  optimizeWithCircadian,
  getParametersForHour,
} from '../lib/services/fsrsOptimizerService';

// Helper: create review data with hourOfDay
function makeReviewData(
  count: number,
  retrievability: number,
  recallRate: number,
  hourOfDay: number
) {
  const data = [];
  const correctCount = Math.round(count * recallRate);
  for (let i = 0; i < count; i++) {
    const isCorrect = Math.floor((i + 1) * correctCount / count)
      > Math.floor(i * correctCount / count);
    data.push({
      stability: 10,
      difficulty: 5,
      elapsedDays: 3,
      gradeContinuous: isCorrect ? 3.0 : 1.0,
      wasCorrect: isCorrect,
      retrievability,
      hourOfDay,
    });
  }
  return data;
}

describe('FSRS Optimizer — Circadian Phases', () => {
  it('classifies hours correctly', () => {
    expect(getCircadianPhase(7)).toBe('morning');
    expect(getCircadianPhase(11)).toBe('morning');
    expect(getCircadianPhase(12)).toBe('afternoon');
    expect(getCircadianPhase(16)).toBe('afternoon');
    expect(getCircadianPhase(17)).toBe('evening');
    expect(getCircadianPhase(21)).toBe('evening');
    expect(getCircadianPhase(22)).toBe('night');
    expect(getCircadianPhase(3)).toBe('night');
    expect(getCircadianPhase(0)).toBe('night');
    expect(getCircadianPhase(5)).toBe('night');
  });

  it('splits data by phase', () => {
    const data = [
      ...makeReviewData(10, 0.5, 0.5, 8),
      ...makeReviewData(10, 0.5, 0.5, 14),
      ...makeReviewData(10, 0.5, 0.5, 19),
      ...makeReviewData(10, 0.5, 0.5, 23),
    ];
    const split = splitByCircadianPhase(data);
    expect(split.morning).toHaveLength(10);
    expect(split.afternoon).toHaveLength(10);
    expect(split.evening).toHaveLength(10);
    expect(split.night).toHaveLength(10);
  });

  it('only optimizes phases with sufficient data (>=50)', () => {
    const data = [
      ...makeReviewData(100, 0.6, 0.7, 9),
      ...makeReviewData(100, 0.6, 0.5, 14),
      ...makeReviewData(20, 0.6, 0.5, 20),
      ...makeReviewData(10, 0.6, 0.5, 1),
    ];
    const result = optimizeWithCircadian(data);
    expect(result.availablePhases).toContain('morning');
    expect(result.availablePhases).toContain('afternoon');
    expect(result.availablePhases).not.toContain('evening');
    expect(result.availablePhases).not.toContain('night');
  });

  it('getParametersForHour returns phase params when available', () => {
    const data = [
      ...makeReviewData(100, 0.6, 0.9, 9),
      ...makeReviewData(100, 0.6, 0.3, 14),
    ];
    const result = optimizeWithCircadian(data);
    const morningParams = getParametersForHour(result, 9);
    const afternoonParams = getParametersForHour(result, 14);
    expect(morningParams.w).toHaveLength(21);
    expect(afternoonParams.w).toHaveLength(21);
  });

  it('falls back to global params for sparse phases', () => {
    const data = [
      ...makeReviewData(100, 0.6, 0.7, 9),
      ...makeReviewData(10, 0.6, 0.5, 23),
    ];
    const result = optimizeWithCircadian(data);
    const nightParams = getParametersForHour(result, 23);
    // Night doesn't have enough data, should fall back to global
    expect(nightParams).toEqual(result.global.parameters);
  });

  it('produces global result even when no phase has enough data', () => {
    const data = makeReviewData(120, 0.6, 0.7, -1);
    // hourOfDay = -1 won't match any phase properly, all go to night
    const result = optimizeWithCircadian(data);
    expect(result.global.reviewCount).toBe(120);
    // Only night phase should have data
    expect(result.availablePhases.length).toBeLessThanOrEqual(1);
  });

  it('global optimization always produces valid parameters', () => {
    const data = [
      ...makeReviewData(80, 0.6, 0.7, 9),
      ...makeReviewData(80, 0.6, 0.5, 14),
    ];
    const result = optimizeWithCircadian(data);
    expect(result.global.parameters.w).toHaveLength(21);
    expect(result.global.initialLoss).toBeGreaterThan(0);
    expect(result.global.finalLoss).toBeGreaterThan(0);
  });
});
