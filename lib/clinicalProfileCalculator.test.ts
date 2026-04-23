// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/clinicalProfileCalculator.ts
 *
 * Pure functions tested:
 *   updateSystemStats(current, system, isCorrect, timeSpentMs) — incremental stats update
 *   calculateProfile(userStats)                                 — profile derivation (rushed/overthinking/strong/weak)
 *   computeUpdatedAverages(total, avg, time)                    — running average update
 *   updateDiagnosisBias(bias, selected, correct, isCorrect)     — bias map increment
 *   derivePeakHoursFromSessions(hours)                          — top-3 peak hours by frequency
 */

import { describe, it, expect } from 'vitest';
import {
  updateSystemStats,
  calculateProfile,
  computeUpdatedAverages,
  updateDiagnosisBias,
  derivePeakHoursFromSessions,
} from './clinicalProfileCalculator';
import type { UserStatisticsShape, SystemStats } from './clinicalProfileCalculator';

// ─── updateSystemStats ────────────────────────────────────────────────────────

describe('updateSystemStats', () => {
  it('initializes a new system entry with first correct attempt', () => {
    const result = updateSystemStats(null, 'Cardiovascular', true, 5000);
    expect(result['Cardiovascular']).toBeDefined();
    expect(result['Cardiovascular']!.total).toBe(1);
    expect(result['Cardiovascular']!.correct).toBe(1);
    expect(result['Cardiovascular']!.accuracy).toBe(1.0);
    expect(result['Cardiovascular']!.avgTimeMs).toBe(5000);
  });

  it('initializes a new system entry with first incorrect attempt', () => {
    const result = updateSystemStats(null, 'Pulmonary', false, 8000);
    expect(result['Pulmonary']!.correct).toBe(0);
    expect(result['Pulmonary']!.total).toBe(1);
    expect(result['Pulmonary']!.accuracy).toBe(0);
  });

  it('increments total and correct on subsequent correct attempts', () => {
    const after1 = updateSystemStats(null, 'Cardiovascular', true, 5000);
    const after2 = updateSystemStats(after1, 'Cardiovascular', true, 3000);
    expect(after2['Cardiovascular']!.total).toBe(2);
    expect(after2['Cardiovascular']!.correct).toBe(2);
    expect(after2['Cardiovascular']!.accuracy).toBe(1.0);
  });

  it('accuracy = correct/total after mixed attempts', () => {
    const after1 = updateSystemStats(null, 'Cardiovascular', true, 5000);
    const after2 = updateSystemStats(after1, 'Cardiovascular', false, 5000);
    expect(after2['Cardiovascular']!.accuracy).toBeCloseTo(0.5, 5);
  });

  it('rolling average of avgTimeMs is correct', () => {
    // First attempt: 4000ms. Second: 6000ms. Running avg = (4000+6000)/2 = 5000
    const after1 = updateSystemStats(null, 'Cardiovascular', true, 4000);
    const after2 = updateSystemStats(after1, 'Cardiovascular', true, 6000);
    expect(after2['Cardiovascular']!.avgTimeMs).toBeCloseTo(5000, 5);
  });

  it('ignores invalid timeSpentMs (null, 0, negative)', () => {
    const after1 = updateSystemStats(null, 'Cardiovascular', true, 4000);
    const afterNull = updateSystemStats(after1, 'Cardiovascular', true, null);
    const afterZero = updateSystemStats(after1, 'Cardiovascular', true, 0);
    const afterNeg = updateSystemStats(after1, 'Cardiovascular', true, -100);
    // avgTimeMs should stay at 4000 when time is invalid
    expect(afterNull['Cardiovascular']!.avgTimeMs).toBe(4000);
    expect(afterZero['Cardiovascular']!.avgTimeMs).toBe(4000);
    expect(afterNeg['Cardiovascular']!.avgTimeMs).toBe(4000);
  });

  it('does not mutate the original stats object', () => {
    const original = { Cardiovascular: { correct: 5, total: 10, avgTimeMs: 3000, accuracy: 0.5 } };
    updateSystemStats(original, 'Cardiovascular', true, 5000);
    expect(original['Cardiovascular']!.total).toBe(10); // unchanged
  });

  it('preserves existing systems when updating a different system', () => {
    const existing = { Cardiovascular: { correct: 3, total: 5, avgTimeMs: 5000, accuracy: 0.6 } };
    const result = updateSystemStats(existing, 'Pulmonary', true, 4000);
    expect(result['Cardiovascular']).toBeDefined();
    expect(result['Cardiovascular']!.total).toBe(5);
    expect(result['Pulmonary']!.total).toBe(1);
  });
});

// ─── calculateProfile ─────────────────────────────────────────────────────────

describe('calculateProfile', () => {
  it('returns empty arrays for empty systemStats', () => {
    const profile = calculateProfile({ totalQuestions: 0, correctAnswers: 0, systemStats: {} });
    expect(profile.strongestSystems).toHaveLength(0);
    expect(profile.weakestSystems).toHaveLength(0);
    expect(profile.rushedSystems).toHaveLength(0);
    expect(profile.overthinkingSystems).toHaveLength(0);
  });

  it('identifies rushed systems (avgTimeMs < mean - stddev)', () => {
    // 3 systems: fast=1000, avg=5000, slow=9000 → mean=5000, stddev≈3266
    // Rushed: below mean-stddev ≈ 5000-3266=1734 → fast(1000)
    const stats: Record<string, SystemStats> = {
      Fast: { correct: 4, total: 5, avgTimeMs: 1000, accuracy: 0.8 },
      Avg: { correct: 4, total: 5, avgTimeMs: 5000, accuracy: 0.8 },
      Slow: { correct: 4, total: 5, avgTimeMs: 9000, accuracy: 0.8 },
    };
    const profile = calculateProfile({ totalQuestions: 15, correctAnswers: 12, systemStats: stats });
    expect(profile.rushedSystems).toContain('Fast');
  });

  it('identifies overthinking systems (avgTimeMs > mean + stddev)', () => {
    const stats: Record<string, SystemStats> = {
      Fast: { correct: 4, total: 5, avgTimeMs: 1000, accuracy: 0.8 },
      Avg: { correct: 4, total: 5, avgTimeMs: 5000, accuracy: 0.8 },
      Slow: { correct: 4, total: 5, avgTimeMs: 9000, accuracy: 0.8 },
    };
    const profile = calculateProfile({ totalQuestions: 15, correctAnswers: 12, systemStats: stats });
    expect(profile.overthinkingSystems).toContain('Slow');
  });

  it('identifies strongest systems by accuracy (top 3, min 5 attempts)', () => {
    const stats: Record<string, SystemStats> = {
      S1: { correct: 10, total: 10, avgTimeMs: 5000, accuracy: 1.0 },
      S2: { correct: 8, total: 10, avgTimeMs: 5000, accuracy: 0.8 },
      S3: { correct: 6, total: 10, avgTimeMs: 5000, accuracy: 0.6 },
      S4: { correct: 3, total: 10, avgTimeMs: 5000, accuracy: 0.3 },
    };
    const profile = calculateProfile({ totalQuestions: 40, correctAnswers: 27, systemStats: stats });
    expect(profile.strongestSystems[0]).toBe('S1');
    expect(profile.strongestSystems).toContain('S2');
    expect(profile.strongestSystems.length).toBeLessThanOrEqual(3);
  });

  it('identifies weakest systems by accuracy (bottom 3, min 5 attempts)', () => {
    const stats: Record<string, SystemStats> = {
      S1: { correct: 10, total: 10, avgTimeMs: 5000, accuracy: 1.0 },
      S2: { correct: 8, total: 10, avgTimeMs: 5000, accuracy: 0.8 },
      S3: { correct: 6, total: 10, avgTimeMs: 5000, accuracy: 0.6 },
      S4: { correct: 3, total: 10, avgTimeMs: 5000, accuracy: 0.3 },
    };
    const profile = calculateProfile({ totalQuestions: 40, correctAnswers: 27, systemStats: stats });
    // Weakest = bottom of sorted-by-accuracy
    expect(profile.weakestSystems).toContain('S4');
  });

  it('excludes systems with < 5 total attempts from strongest/weakest', () => {
    const stats: Record<string, SystemStats> = {
      Good: { correct: 4, total: 10, avgTimeMs: 5000, accuracy: 0.9 },
      InsufficientData: { correct: 4, total: 4, avgTimeMs: 5000, accuracy: 1.0 }, // < 5
    };
    const profile = calculateProfile({ totalQuestions: 14, correctAnswers: 8, systemStats: stats });
    expect(profile.strongestSystems).not.toContain('InsufficientData');
    expect(profile.weakestSystems).not.toContain('InsufficientData');
  });
});

// ─── computeUpdatedAverages ───────────────────────────────────────────────────

describe('computeUpdatedAverages', () => {
  it('returns timeSpentMs when totalQuestions = 0 (first attempt)', () => {
    expect(computeUpdatedAverages(0, null, 5000)).toBe(5000);
    expect(computeUpdatedAverages(0, 0, 8000)).toBe(8000);
  });

  it('returns existing average when timeSpentMs is null', () => {
    expect(computeUpdatedAverages(10, 4000, null)).toBe(4000);
    expect(computeUpdatedAverages(10, 4000, undefined)).toBe(4000);
  });

  it('returns null when both timeSpentMs and existing average are null/missing', () => {
    expect(computeUpdatedAverages(10, null, null)).toBeNull();
    expect(computeUpdatedAverages(10, undefined, null)).toBeNull();
  });

  it('computes running average correctly', () => {
    // Previous: 10 questions at avg 4000ms = total 40000ms
    // New attempt: 6000ms → new avg = 46000/11 ≈ 4181.8
    const result = computeUpdatedAverages(10, 4000, 6000);
    expect(result).toBeCloseTo((4000 * 10 + 6000) / 11, 5);
  });

  it('treats missing avgTimePerQuestion as 0 when computing running average', () => {
    // 5 previous questions at avg=null (treated as 0), new = 5000
    // sum = 0*5 + 5000 = 5000, avg = 5000/6
    const result = computeUpdatedAverages(5, null, 5000);
    expect(result).toBeCloseTo(5000 / 6, 5);
  });
});

// ─── updateDiagnosisBias ──────────────────────────────────────────────────────

describe('updateDiagnosisBias', () => {
  it('returns empty map for null input with no arguments', () => {
    expect(updateDiagnosisBias(null)).toEqual({});
  });

  it('does not increment bias when isCorrect = true', () => {
    const bias = { COPD: 2 };
    const result = updateDiagnosisBias(bias, 'COPD', 'HF', true);
    expect(result['COPD']).toBe(2); // unchanged
  });

  it('does not increment bias when selectedCondition is null', () => {
    const result = updateDiagnosisBias(null, null, 'HF', false);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('increments bias count for selected condition on incorrect answer', () => {
    const result = updateDiagnosisBias({}, 'COPD', 'HF', false);
    expect(result['COPD']).toBe(1);
  });

  it('accumulates bias count for repeated wrong selection of same condition', () => {
    const after1 = updateDiagnosisBias({}, 'COPD', 'HF', false);
    const after2 = updateDiagnosisBias(after1, 'COPD', 'HF', false);
    expect(after2['COPD']).toBe(2);
  });

  it('does not increment if selected === correct (degenerate case)', () => {
    const result = updateDiagnosisBias({}, 'HF', 'HF', false);
    // selectedCondition === correctCondition → no bias counted
    expect(result['HF']).toBeUndefined();
  });

  it('does not mutate the original bias map', () => {
    const original = { COPD: 3 };
    updateDiagnosisBias(original, 'Asthma', 'HF', false);
    expect(original['Asthma']).toBeUndefined();
  });
});

// ─── derivePeakHoursFromSessions ──────────────────────────────────────────────

describe('derivePeakHoursFromSessions', () => {
  it('returns empty array for empty input', () => {
    expect(derivePeakHoursFromSessions([])).toHaveLength(0);
  });

  it('returns top-3 hours by frequency', () => {
    // Hour 9 appears 5 times, 14 appears 3 times, 20 appears 2 times, 8 appears 1 time
    const hours = [9, 9, 9, 9, 9, 14, 14, 14, 20, 20, 8];
    const result = derivePeakHoursFromSessions(hours);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(9);   // most frequent
    expect(result[1]).toBe(14);  // second
    expect(result[2]).toBe(20);  // third
  });

  it('returns at most 3 hours even with many different hours', () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const result = derivePeakHoursFromSessions(hours);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('normalizes hours using % 24 (hour 25 → 1)', () => {
    const hours = [25, 25, 25]; // all → 1
    const result = derivePeakHoursFromSessions(hours);
    expect(result[0]).toBe(1);
  });

  it('returns 1 hour when only 1 unique hour in data', () => {
    const hours = [10, 10, 10, 10];
    const result = derivePeakHoursFromSessions(hours);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(10);
  });

  it('returns hours in descending frequency order', () => {
    const hours = [7, 14, 14, 14, 7, 7, 7]; // 7 appears 4x, 14 appears 3x
    const result = derivePeakHoursFromSessions(hours);
    expect(result[0]).toBe(7);
    expect(result[1]).toBe(14);
  });
});
