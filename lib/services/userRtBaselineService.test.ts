/**
 * Unit tests for lib/services/userRtBaselineService.ts
 *
 * Constants:
 *   MIN_RT_SAMPLES    = 5      (fewer valid samples → return null)
 *   MAX_RT_SAMPLE_WINDOW = 50
 *   MIN_VALID_RT_MS   = 1000   (below → rapid-guess artifact, excluded)
 *   MAX_VALID_RT_MS   = 180_000 (above → AFK, excluded)
 */

import { describe, it, expect } from 'vitest';
import {
  computeMedianRt,
  computeRollingWindowStats,
  MIN_RT_SAMPLES,
  MIN_VALID_RT_MS,
  MAX_VALID_RT_MS,
} from './userRtBaselineService';

function sample(ms: number) {
  return { responseTimeMs: ms };
}

// ─── computeMedianRt — guard clauses ─────────────────────────────────────────

describe('computeMedianRt — guard clauses', () => {
  it('returns null for empty array', () => {
    expect(computeMedianRt([])).toBeNull();
  });

  it('returns null when fewer than MIN_RT_SAMPLES valid samples', () => {
    // 4 valid samples → null
    expect(computeMedianRt([
      sample(5000), sample(8000), sample(10000), sample(12000),
    ])).toBeNull();
  });

  it('returns null when all samples are below MIN_VALID_RT_MS', () => {
    expect(computeMedianRt([
      sample(100), sample(200), sample(300), sample(400), sample(500),
    ])).toBeNull();
  });

  it('returns null when all samples are above MAX_VALID_RT_MS', () => {
    expect(computeMedianRt([
      sample(200000), sample(250000), sample(300000), sample(350000), sample(400000),
    ])).toBeNull();
  });

  it('returns null when fewer than MIN_RT_SAMPLES remain after filtering', () => {
    // 5 entries but only 4 valid after excluding outlier
    expect(computeMedianRt([
      sample(500),    // excluded: below min
      sample(5000),
      sample(8000),
      sample(10000),
      sample(12000),
    ])).toBeNull();
  });
});

// ─── computeMedianRt — filtering ─────────────────────────────────────────────

describe('computeMedianRt — outlier filtering', () => {
  it('excludes exactly MIN_VALID_RT_MS - 1 (just below floor)', () => {
    // MIN_VALID_RT_MS = 1000 → 999 is excluded
    const result = computeMedianRt([
      sample(999),    // excluded
      sample(5000),
      sample(8000),
      sample(10000),
      sample(12000),
      sample(15000),
    ]);
    // 5 valid samples: [5000, 8000, 10000, 12000, 15000]
    expect(result).not.toBeNull();
    expect(result!.sampleCount).toBe(5);
  });

  it('includes exactly MIN_VALID_RT_MS (at floor, not excluded)', () => {
    const result = computeMedianRt([
      sample(MIN_VALID_RT_MS),
      sample(5000), sample(8000), sample(10000), sample(12000),
    ]);
    expect(result).not.toBeNull();
    expect(result!.sampleCount).toBe(5);
  });

  it('includes exactly MAX_VALID_RT_MS (at ceiling, not excluded)', () => {
    const result = computeMedianRt([
      sample(MAX_VALID_RT_MS),
      sample(5000), sample(8000), sample(10000), sample(12000),
    ]);
    expect(result).not.toBeNull();
    expect(result!.sampleCount).toBe(5);
  });

  it('excludes exactly MAX_VALID_RT_MS + 1 (just above ceiling)', () => {
    // Only 4 valid remain → null
    expect(computeMedianRt([
      sample(MAX_VALID_RT_MS + 1), // excluded
      sample(5000), sample(8000), sample(10000), sample(12000),
    ])).toBeNull();
  });
});

// ─── computeMedianRt — odd sample count ──────────────────────────────────────

describe('computeMedianRt — odd sample count', () => {
  it('returns the middle value for 5 sorted samples', () => {
    // sorted: [5000, 8000, 10000, 12000, 15000], mid=2 → 10000
    const result = computeMedianRt([
      sample(12000), sample(5000), sample(15000), sample(8000), sample(10000),
    ]);
    expect(result).not.toBeNull();
    expect(result!.medianMs).toBe(10000);
    expect(result!.sampleCount).toBe(5);
  });

  it('returns the middle value for 7 samples', () => {
    // sorted: [1000, 2000, 3000, 4000, 5000, 6000, 7000], mid=3 → 4000
    const result = computeMedianRt([
      sample(1000), sample(7000), sample(3000), sample(5000),
      sample(2000), sample(6000), sample(4000),
    ]);
    expect(result!.medianMs).toBe(4000);
    expect(result!.sampleCount).toBe(7);
  });
});

// ─── computeMedianRt — even sample count ─────────────────────────────────────

describe('computeMedianRt — even sample count', () => {
  it('docstring example (adapted): 6 valid samples → even-count median', () => {
    // 6 valid samples: [5000, 8000, 10000, 12000, 15000, 18000]
    // even (n=6): mid=3; (sorted[2]+sorted[3])/2 = (10000+12000)/2 = 11000
    const result = computeMedianRt([
      sample(500),     // excluded: below min
      sample(5000),
      sample(8000),
      sample(12000),
      sample(15000),
      sample(10000),
      sample(18000),
      sample(200001),  // excluded: above max
    ]);
    expect(result).not.toBeNull();
    expect(result!.medianMs).toBe(11000);
    expect(result!.sampleCount).toBe(6);
  });

  it('returns integer (rounded) for fractional mean', () => {
    // 6 valid, even: median = avg of 2 middle
    // sorted: [2000, 4000, 5000, 7000, 9000, 11000], mid=3,4: (5000+7000)/2=6000
    const result = computeMedianRt([
      sample(9000), sample(2000), sample(7000),
      sample(5000), sample(4000), sample(11000),
    ]);
    expect(result!.medianMs).toBe(6000);
    expect(Number.isInteger(result!.medianMs)).toBe(true);
  });
});

// ─── computeRollingWindowStats ────────────────────────────────────────────────

describe('computeRollingWindowStats', () => {
  it('returns all-zeros for empty window', () => {
    const r = computeRollingWindowStats([]);
    expect(r.rollingAccuracy).toBe(0);
    expect(r.rollingMeanRtMs).toBe(0);
    expect(r.windowSize).toBe(0);
  });

  it('computes correct accuracy for all-correct window', () => {
    const window = Array.from({ length: 5 }, () => ({ isCorrect: true, responseTimeMs: 10000 }));
    const r = computeRollingWindowStats(window);
    expect(r.rollingAccuracy).toBe(1.0);
    expect(r.windowSize).toBe(5);
  });

  it('computes correct accuracy for mixed window', () => {
    // 3 correct, 2 incorrect → 0.6
    const window = [
      { isCorrect: true, responseTimeMs: 10000 },
      { isCorrect: false, responseTimeMs: 15000 },
      { isCorrect: true, responseTimeMs: 12000 },
      { isCorrect: false, responseTimeMs: 8000 },
      { isCorrect: true, responseTimeMs: 11000 },
    ];
    const r = computeRollingWindowStats(window);
    expect(r.rollingAccuracy).toBeCloseTo(0.6, 5);
  });

  it('computes correct mean RT', () => {
    // (10000 + 15000 + 12000) / 3 = 12333
    const window = [
      { isCorrect: true, responseTimeMs: 10000 },
      { isCorrect: false, responseTimeMs: 15000 },
      { isCorrect: true, responseTimeMs: 12000 },
    ];
    const r = computeRollingWindowStats(window);
    expect(r.rollingMeanRtMs).toBe(Math.round((10000 + 15000 + 12000) / 3));
    expect(r.windowSize).toBe(3);
  });

  it('slices to last windowSize entries when array is longer', () => {
    // 12 items, windowSize=10 → last 10 used
    const older = Array.from({ length: 2 }, () => ({ isCorrect: true, responseTimeMs: 99999 }));
    const recent = Array.from({ length: 10 }, () => ({ isCorrect: false, responseTimeMs: 5000 }));
    const r = computeRollingWindowStats([...older, ...recent], 10);
    expect(r.windowSize).toBe(10);
    expect(r.rollingAccuracy).toBe(0); // all 10 recent are incorrect
  });

  it('respects custom windowSize parameter', () => {
    const window = Array.from({ length: 7 }, (_, i) => ({
      isCorrect: i % 2 === 0,
      responseTimeMs: 5000,
    }));
    const r = computeRollingWindowStats(window, 5);
    expect(r.windowSize).toBe(5);
  });

  it('rollingMeanRtMs is an integer (Math.round applied)', () => {
    const window = [
      { isCorrect: true, responseTimeMs: 10001 },
      { isCorrect: true, responseTimeMs: 10002 },
    ];
    const r = computeRollingWindowStats(window, 10);
    expect(Number.isInteger(r.rollingMeanRtMs)).toBe(true);
  });
});
