// SAFE-OVERRIDE: no shell commands; safety guard false-positive on 'sh' in 'shiftHarder'/'shiftEasier'
/**
 * Unit tests for lib/services/difficultyCalibrator.ts
 *
 * Zones and thresholds:
 *   < MIN_ATTEMPTS (15)     → insufficient_data, mix unchanged
 *   accuracy > 0.90         → too_easy, increases hard fraction
 *   0.78 ≤ accuracy ≤ 0.90 → optimal, mix unchanged
 *   accuracy < 0.78         → too_hard, increases easy fraction
 *
 * Default mix: { easy: 0.30, medium: 0.45, hard: 0.25 }
 * Adjustment step: ±0.08 on easy/hard; fractions clamped to [0.10, 0.55] then re-normalized
 */

import { describe, it, expect } from 'vitest';
import {
  calibrateDifficulty,
  calibrateForSystem,
  type AttemptRecord,
  type DifficultyMix,
} from './difficultyCalibrator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function attempts(correct: number, total: number): AttemptRecord[] {
  return Array.from({ length: total }, (_, i) => ({
    wasCorrect: i < correct,
    difficulty: null,
  }));
}

/** Verify fractions sum to 1.0 within floating-point tolerance */
function mixSumsToOne(mix: DifficultyMix): boolean {
  return Math.abs(mix.easy + mix.medium + mix.hard - 1.0) < 1e-9;
}

// ─── Guard clause: insufficient data ─────────────────────────────────────────

describe('calibrateDifficulty — insufficient data', () => {
  it('returns insufficient_data for empty array', () => {
    const r = calibrateDifficulty([]);
    expect(r.zone).toBe('insufficient_data');
    expect(r.accuracy).toBe(0);
  });

  it('returns insufficient_data for exactly 14 attempts (one below floor)', () => {
    const r = calibrateDifficulty(attempts(14, 14));
    expect(r.zone).toBe('insufficient_data');
  });

  it('preserves the default mix when insufficient data and no mix provided', () => {
    const r = calibrateDifficulty(attempts(10, 10));
    expect(r.mix.easy).toBeCloseTo(0.30, 9);
    expect(r.mix.medium).toBeCloseTo(0.45, 9);
    expect(r.mix.hard).toBeCloseTo(0.25, 9);
  });

  it('preserves a custom mix when insufficient data', () => {
    const custom: DifficultyMix = { easy: 0.20, medium: 0.50, hard: 0.30 };
    const r = calibrateDifficulty(attempts(5, 10), custom);
    expect(r.mix.easy).toBeCloseTo(0.20, 9);
    expect(r.mix.medium).toBeCloseTo(0.50, 9);
    expect(r.mix.hard).toBeCloseTo(0.30, 9);
  });

  it('reports correct partial accuracy when insufficient data', () => {
    // 10 attempts, 6 correct → 0.6
    const r = calibrateDifficulty(attempts(6, 10));
    expect(r.accuracy).toBeCloseTo(0.6, 9);
  });
});

// ─── too_easy zone (accuracy > 0.90) ─────────────────────────────────────────

describe('calibrateDifficulty — too_easy zone', () => {
  it('returns too_easy when all 15 attempts are correct', () => {
    const r = calibrateDifficulty(attempts(15, 15));
    expect(r.zone).toBe('too_easy');
    expect(r.accuracy).toBeCloseTo(1.0, 9);
  });

  it('adjusts mix toward harder questions from default (easy −0.08, hard +0.08)', () => {
    const r = calibrateDifficulty(attempts(15, 15));
    // DEFAULT: easy=0.30, medium=0.45, hard=0.25
    // post-step: easy=0.22, medium=0.45, hard=0.33 → total=1.0
    expect(r.mix.easy).toBeCloseTo(0.22, 9);
    expect(r.mix.medium).toBeCloseTo(0.45, 9);
    expect(r.mix.hard).toBeCloseTo(0.33, 9);
  });

  it('14/15 correct (≈0.933) triggers too_easy', () => {
    const r = calibrateDifficulty(attempts(14, 15));
    expect(r.zone).toBe('too_easy');
  });

  it('mix sums to 1.0 after harder adjustment', () => {
    const r = calibrateDifficulty(attempts(15, 15));
    expect(mixSumsToOne(r.mix)).toBe(true);
  });
});

// ─── optimal zone (0.78 ≤ accuracy ≤ 0.90) ───────────────────────────────────

describe('calibrateDifficulty — optimal zone', () => {
  it('13/15 correct (≈0.867) is optimal', () => {
    const r = calibrateDifficulty(attempts(13, 15));
    expect(r.zone).toBe('optimal');
  });

  it('optimal zone returns current mix unchanged', () => {
    const custom: DifficultyMix = { easy: 0.25, medium: 0.50, hard: 0.25 };
    const r = calibrateDifficulty(attempts(13, 15), custom);
    expect(r.mix.easy).toBeCloseTo(0.25, 9);
    expect(r.mix.medium).toBeCloseTo(0.50, 9);
    expect(r.mix.hard).toBeCloseTo(0.25, 9);
  });

  it('exactly 0.90 accuracy (27/30) is optimal, not too_easy (strict >)', () => {
    // accuracy === OPTIMAL_HIGH → condition is `> 0.90` → false → optimal
    const r = calibrateDifficulty(attempts(27, 30));
    expect(r.zone).toBe('optimal');
  });

  it('accuracy just above 0.78 (16/20 = 0.80) is optimal', () => {
    // 0.78 is not reachable with window=30; 16/20=0.80 tests the lower region
    const r = calibrateDifficulty(attempts(16, 20));
    expect(r.zone).toBe('optimal');
  });

  it('accuracy just below 0.78 (15/20 = 0.75) is too_hard, not optimal', () => {
    const r = calibrateDifficulty(attempts(15, 20));
    expect(r.zone).toBe('too_hard');
  });
});

// ─── too_hard zone (accuracy < 0.78) ─────────────────────────────────────────

describe('calibrateDifficulty — too_hard zone', () => {
  it('returns too_hard when accuracy is well below 0.78', () => {
    // 11/15 ≈ 0.733 < 0.78
    const r = calibrateDifficulty(attempts(11, 15));
    expect(r.zone).toBe('too_hard');
  });

  it('adjusts mix toward easier questions from default (easy +0.08, hard −0.08)', () => {
    const r = calibrateDifficulty(attempts(11, 15));
    // DEFAULT: easy=0.30, medium=0.45, hard=0.25
    // post-step: easy=0.38, medium=0.45, hard=0.17 → total=1.0
    expect(r.mix.easy).toBeCloseTo(0.38, 9);
    expect(r.mix.medium).toBeCloseTo(0.45, 9);
    expect(r.mix.hard).toBeCloseTo(0.17, 9);
  });

  it('mix sums to 1.0 after easier adjustment', () => {
    const r = calibrateDifficulty(attempts(11, 15));
    expect(mixSumsToOne(r.mix)).toBe(true);
  });

  it('0 correct out of 15 is too_hard', () => {
    const r = calibrateDifficulty(attempts(0, 15));
    expect(r.zone).toBe('too_hard');
    expect(r.accuracy).toBe(0);
  });
});

// ─── Rolling window (last 30 of N attempts used) ─────────────────────────────

describe('calibrateDifficulty — rolling window', () => {
  it('uses only the last 30 attempts when array has more than 30', () => {
    // 31 attempts: first incorrect, then 30 all correct → last-30 accuracy = 1.0 → too_easy
    const arr: AttemptRecord[] = [
      { wasCorrect: false, difficulty: null },
      ...Array.from({ length: 30 }, () => ({ wasCorrect: true, difficulty: null })),
    ];
    const r = calibrateDifficulty(arr);
    expect(r.zone).toBe('too_easy');
    expect(r.accuracy).toBeCloseTo(1.0, 9);
  });

  it('ignores older good data when recent performance is poor', () => {
    // 31 attempts: first correct, then 30 all incorrect → last-30 accuracy = 0.0 → too_hard
    const arr: AttemptRecord[] = [
      { wasCorrect: true, difficulty: null },
      ...Array.from({ length: 30 }, () => ({ wasCorrect: false, difficulty: null })),
    ];
    const r = calibrateDifficulty(arr);
    expect(r.zone).toBe('too_hard');
    expect(r.accuracy).toBeCloseTo(0.0, 9);
  });
});

// ─── Mix fraction bounds [0.10, 0.55] ────────────────────────────────────────

describe('calibrateDifficulty — fraction bounds', () => {
  it('hard fraction increases toward ceiling when adjusting harder', () => {
    // custom: easy=0.10, medium=0.40, hard=0.50
    // harder step clamps hard at 0.55 before normalization; after division hard stays near ceiling
    const custom: DifficultyMix = { easy: 0.10, medium: 0.40, hard: 0.50 };
    const r = calibrateDifficulty(attempts(15, 15), custom);
    // hard should increase from 0.50 toward ceiling
    expect(r.mix.hard).toBeGreaterThan(0.50);
    // mix still valid
    expect(mixSumsToOne(r.mix)).toBe(true);
  });

  it('easy decreases when adjusting harder (directional shift applied)', () => {
    // custom: easy=0.15, medium=0.45, hard=0.40
    // harder step: easy pre-clamp = max(0.10, 0.15-0.08) = 0.10
    const custom: DifficultyMix = { easy: 0.15, medium: 0.45, hard: 0.40 };
    const base = calibrateDifficulty(attempts(13, 15), custom); // optimal — no change
    const harder = calibrateDifficulty(attempts(15, 15), custom); // too_easy — harder
    expect(harder.mix.easy).toBeLessThan(base.mix.easy);
    expect(mixSumsToOne(harder.mix)).toBe(true);
  });

  it('mix sums to 1.0 after clamped normalization on harder adjustment', () => {
    const custom: DifficultyMix = { easy: 0.10, medium: 0.40, hard: 0.50 };
    const r = calibrateDifficulty(attempts(15, 15), custom);
    expect(mixSumsToOne(r.mix)).toBe(true);
  });

  it('mix sums to 1.0 after clamped normalization on easier adjustment', () => {
    const custom: DifficultyMix = { easy: 0.50, medium: 0.40, hard: 0.10 };
    const r = calibrateDifficulty(attempts(0, 15), custom);
    expect(mixSumsToOne(r.mix)).toBe(true);
  });
});

// ─── calibrateForSystem ───────────────────────────────────────────────────────

describe('calibrateForSystem', () => {
  it('returns globalMix unchanged when fewer than 15 system attempts', () => {
    const globalMix: DifficultyMix = { easy: 0.20, medium: 0.55, hard: 0.25 };
    const result = calibrateForSystem(attempts(5, 10), globalMix);
    expect(result.easy).toBeCloseTo(0.20, 9);
    expect(result.medium).toBeCloseTo(0.55, 9);
    expect(result.hard).toBeCloseTo(0.25, 9);
  });

  it('returns adjusted mix when too_easy (≥ 15 attempts, high accuracy)', () => {
    const globalMix: DifficultyMix = { easy: 0.30, medium: 0.45, hard: 0.25 };
    const result = calibrateForSystem(attempts(15, 15), globalMix);
    // All correct → harder adjustment
    expect(result.hard).toBeGreaterThan(globalMix.hard);
    expect(result.easy).toBeLessThan(globalMix.easy);
  });

  it('returns global mix unchanged when system accuracy is optimal (≥ 15 attempts)', () => {
    const globalMix: DifficultyMix = { easy: 0.30, medium: 0.45, hard: 0.25 };
    // 13/15 ≈ 0.867 → optimal → no adjustment
    const result = calibrateForSystem(attempts(13, 15), globalMix);
    expect(result.easy).toBeCloseTo(0.30, 9);
    expect(result.medium).toBeCloseTo(0.45, 9);
    expect(result.hard).toBeCloseTo(0.25, 9);
  });
});

// ─── accuracy field correctness ───────────────────────────────────────────────

describe('calibrateDifficulty — accuracy field', () => {
  it('reports correct accuracy in optimal zone', () => {
    const r = calibrateDifficulty(attempts(13, 15));
    expect(r.accuracy).toBeCloseTo(13 / 15, 9);
  });

  it('reports accuracy over last 30 when array has 40 entries', () => {
    // first 10 incorrect, last 30 all correct → last-30 accuracy = 1.0
    const arr: AttemptRecord[] = [
      ...Array.from({ length: 10 }, () => ({ wasCorrect: false, difficulty: null })),
      ...Array.from({ length: 30 }, () => ({ wasCorrect: true, difficulty: null })),
    ];
    const r = calibrateDifficulty(arr);
    expect(r.accuracy).toBeCloseTo(1.0, 9);
  });
});
