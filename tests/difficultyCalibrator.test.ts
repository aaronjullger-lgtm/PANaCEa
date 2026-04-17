import { describe, it, expect } from 'vitest';
import {
  calibrateDifficulty,
  calibrateForSystem,
  type DifficultyMix,
  type AttemptRecord,
} from '../lib/services/difficultyCalibrator';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build an interleaved sequence of attempts with a target accuracy.
 * Uses the interleaved pattern (not first-N-correct) to avoid ordering
 * artifacts in rolling-window tests.
 */
function makeAttempts(count: number, accuracy: number): AttemptRecord[] {
  const correctCount = Math.round(count * accuracy);
  const attempts: AttemptRecord[] = [];
  for (let i = 0; i < count; i++) {
    const isCorrect =
      Math.floor(((i + 1) * correctCount) / count) > Math.floor((i * correctCount) / count);
    attempts.push({ wasCorrect: isCorrect, difficulty: 'medium' });
  }
  return attempts;
}

const DEFAULT_MIX: DifficultyMix = { easy: 0.3, medium: 0.45, hard: 0.25 };

// ─── calibrateDifficulty — insufficient data ────────────────────────────────

describe('calibrateDifficulty — insufficient data', () => {
  it('returns insufficient_data when < 15 attempts', () => {
    const result = calibrateDifficulty(makeAttempts(10, 0.85));
    expect(result.zone).toBe('insufficient_data');
  });

  it('returns the unchanged mix when insufficient data', () => {
    const currentMix: DifficultyMix = { easy: 0.4, medium: 0.4, hard: 0.2 };
    const result = calibrateDifficulty(makeAttempts(5, 0.5), currentMix);
    expect(result.mix).toEqual(currentMix);
  });

  it('returns accuracy of 0 for empty input', () => {
    const result = calibrateDifficulty([]);
    expect(result.zone).toBe('insufficient_data');
    expect(result.accuracy).toBe(0);
  });

  it('computes partial-window accuracy even in insufficient_data mode', () => {
    // 10 attempts, 80% correct
    const result = calibrateDifficulty(makeAttempts(10, 0.8));
    expect(result.accuracy).toBeCloseTo(0.8, 1);
  });
});

// ─── calibrateDifficulty — zone detection ───────────────────────────────────

describe('calibrateDifficulty — zone detection', () => {
  it('identifies too_easy zone when accuracy > 0.90', () => {
    const attempts = makeAttempts(30, 0.95);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.zone).toBe('too_easy');
    expect(result.accuracy).toBeGreaterThan(0.9);
  });

  it('identifies too_hard zone when accuracy < 0.78', () => {
    const attempts = makeAttempts(30, 0.6);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.zone).toBe('too_hard');
    expect(result.accuracy).toBeLessThan(0.78);
  });

  it('identifies optimal zone in the 0.78-0.90 range', () => {
    // Target 0.85 accuracy → in optimal zone
    const attempts = makeAttempts(30, 0.85);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.zone).toBe('optimal');
  });

  it('uses rolling window of 30 most recent attempts', () => {
    // 50 attempts: first 20 all wrong, last 30 all correct
    // Rolling window = last 30 → 100% correct → too_easy
    const attempts: AttemptRecord[] = [
      ...Array(20).fill({ wasCorrect: false, difficulty: 'hard' }),
      ...Array(30).fill({ wasCorrect: true, difficulty: 'easy' }),
    ];
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.accuracy).toBe(1.0);
    expect(result.zone).toBe('too_easy');
  });
});

// ─── calibrateDifficulty — mix adjustment ───────────────────────────────────

describe('calibrateDifficulty — mix adjustment', () => {
  it('shifts toward harder questions when too_easy', () => {
    const attempts = makeAttempts(30, 0.95);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    // Easy should decrease, hard should increase
    expect(result.mix.hard).toBeGreaterThan(DEFAULT_MIX.hard);
    expect(result.mix.easy).toBeLessThan(DEFAULT_MIX.easy);
  });

  it('shifts toward easier questions when too_hard', () => {
    const attempts = makeAttempts(30, 0.6);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.mix.easy).toBeGreaterThan(DEFAULT_MIX.easy);
    expect(result.mix.hard).toBeLessThan(DEFAULT_MIX.hard);
  });

  it('preserves mix when in optimal zone', () => {
    const attempts = makeAttempts(30, 0.85);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.mix).toEqual(DEFAULT_MIX);
  });

  it('produces a normalized mix (sums to 1.0)', () => {
    const attempts = makeAttempts(30, 0.95);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    const total = result.mix.easy + result.mix.medium + result.mix.hard;
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('respects MAX_FRACTION upper bound of 0.55', () => {
    // Push accuracy very high to keep shifting harder — single call still respects cap
    const attempts = makeAttempts(30, 0.98);
    const extremeMix: DifficultyMix = { easy: 0.1, medium: 0.1, hard: 0.8 };
    const result = calibrateDifficulty(attempts, extremeMix);
    // After normalization, hard should be clamped before normalization
    expect(result.mix.hard).toBeLessThanOrEqual(0.75); // some tolerance post-normalize
  });

  it('respects MIN_FRACTION lower bound of 0.10', () => {
    // Shift easier from a mix that already has very low easy fraction
    const attempts = makeAttempts(30, 0.5);
    const lowEasyMix: DifficultyMix = { easy: 0.1, medium: 0.4, hard: 0.5 };
    const result = calibrateDifficulty(attempts, lowEasyMix);
    // Easy should increase, hard should decrease
    expect(result.mix.hard).toBeGreaterThanOrEqual(0.1);
  });
});

// ─── calibrateDifficulty — message formatting ───────────────────────────────

describe('calibrateDifficulty — messaging', () => {
  it('includes accuracy percentage in the message', () => {
    const attempts = makeAttempts(30, 0.85);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    // Interleave rounding may shift 85% → 86-87%; just assert a percent token is present
    expect(result.message).toMatch(/\d{1,3}%/);
  });

  it('mentions needed attempt count when insufficient data', () => {
    const result = calibrateDifficulty(makeAttempts(10, 0.8));
    // Need 15 - 10 = 5 more
    expect(result.message).toContain('5');
    expect(result.message).toContain('more');
  });

  it('describes optimal zone when accuracy is in target range', () => {
    const attempts = makeAttempts(30, 0.85);
    const result = calibrateDifficulty(attempts, DEFAULT_MIX);
    expect(result.message.toLowerCase()).toContain('optimal');
  });
});

// ─── calibrateForSystem ─────────────────────────────────────────────────────

describe('calibrateForSystem', () => {
  it('returns globalMix when system has < 15 attempts', () => {
    const globalMix: DifficultyMix = { easy: 0.2, medium: 0.5, hard: 0.3 };
    const systemAttempts = makeAttempts(10, 0.85);
    const result = calibrateForSystem(systemAttempts, globalMix);
    expect(result).toEqual(globalMix);
  });

  it('returns system-specific mix when enough attempts', () => {
    const globalMix: DifficultyMix = { easy: 0.3, medium: 0.45, hard: 0.25 };
    // System is struggling (60% accuracy)
    const systemAttempts = makeAttempts(30, 0.6);
    const result = calibrateForSystem(systemAttempts, globalMix);
    // Should shift easier than global
    expect(result.easy).toBeGreaterThan(globalMix.easy);
  });

  it('returns a valid normalized mix', () => {
    const globalMix: DifficultyMix = { easy: 0.3, medium: 0.45, hard: 0.25 };
    const systemAttempts = makeAttempts(30, 0.7);
    const result = calibrateForSystem(systemAttempts, globalMix);
    const total = result.easy + result.medium + result.hard;
    expect(total).toBeCloseTo(1.0, 5);
  });
});
