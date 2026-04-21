/**
 * Unit tests for lib/services/relearningSpeedService.ts (computeRelearningSpeed)
 *
 * SAVINGS_THRESHOLD = 0.3   (savings must exceed this to earn a bonus)
 * MAX_SAVINGS_RATIO = 0.5   (savings capped at 0.5 for bonus calc)
 * SAVINGS_BONUS_SCALE = 0.5
 *
 * savings = 1 - (currentRtMs / originalRtMs)
 * bonus   = savings > 0.3 ? 1.0 + min(savings, 0.5) * 0.5  : 1.0
 *         → max bonus = 1.0 + 0.5 * 0.5 = 1.25
 */

import { describe, it, expect } from 'vitest';
import { computeRelearningSpeed } from './relearningSpeedService';

// ─── Guard clauses ────────────────────────────────────────────────────────────

describe('computeRelearningSpeed — guard clauses', () => {
  it('returns no-savings when originalLearningRtMs is null', () => {
    const r = computeRelearningSpeed(5000, null, 2);
    expect(r.savingsRatio).toBeNull();
    expect(r.postLapseStabilityBonus).toBe(1.0);
    expect(r.hasSavings).toBe(false);
  });

  it('returns no-savings when originalLearningRtMs is 0', () => {
    const r = computeRelearningSpeed(5000, 0, 2);
    expect(r.savingsRatio).toBeNull();
    expect(r.postLapseStabilityBonus).toBe(1.0);
    expect(r.hasSavings).toBe(false);
  });

  it('returns no-savings when originalLearningRtMs is negative', () => {
    const r = computeRelearningSpeed(5000, -100, 2);
    expect(r.savingsRatio).toBeNull();
    expect(r.hasSavings).toBe(false);
  });

  it('returns no-savings when cardLapses is 0 (first attempt, not a relapse)', () => {
    const r = computeRelearningSpeed(5000, 10000, 0);
    expect(r.savingsRatio).toBeNull();
    expect(r.postLapseStabilityBonus).toBe(1.0);
    expect(r.hasSavings).toBe(false);
  });

  it('returns no-savings when currentRtMs is 0 or negative', () => {
    const zero = computeRelearningSpeed(0, 10000, 1);
    expect(zero.savingsRatio).toBeNull();
    expect(zero.hasSavings).toBe(false);

    const neg = computeRelearningSpeed(-1, 10000, 1);
    expect(neg.savingsRatio).toBeNull();
  });
});

// ─── Savings below threshold — no bonus ──────────────────────────────────────

describe('computeRelearningSpeed — savings below threshold', () => {
  it('returns hasSavings=true but bonus=1.0 when savings < 0.3', () => {
    // savings = 1 - 9000/10000 = 0.1 < 0.3
    const r = computeRelearningSpeed(9000, 10000, 1);
    expect(r.hasSavings).toBe(true);
    expect(r.savingsRatio).toBeCloseTo(0.1, 3);
    expect(r.postLapseStabilityBonus).toBe(1.0);
  });

  it('returns bonus=1.0 when relearning takes exactly as long as original', () => {
    // savings = 1 - 10000/10000 = 0
    const r = computeRelearningSpeed(10000, 10000, 1);
    expect(r.savingsRatio).toBeCloseTo(0.0, 3);
    expect(r.postLapseStabilityBonus).toBe(1.0);
  });

  it('returns negative savings when relearning is slower than original', () => {
    // savings = 1 - 15000/10000 = -0.5 (took longer second time)
    const r = computeRelearningSpeed(15000, 10000, 1);
    expect(r.savingsRatio).toBeCloseTo(-0.5, 3);
    expect(r.postLapseStabilityBonus).toBe(1.0);
  });
});

// ─── Savings above threshold — bonus earned ──────────────────────────────────

describe('computeRelearningSpeed — savings above threshold', () => {
  it('returns bonus > 1.0 when savings > 0.3', () => {
    // savings = 1 - 6000/10000 = 0.4; bonus = 1 + min(0.4, 0.5)*0.5 = 1.2
    const r = computeRelearningSpeed(6000, 10000, 1);
    expect(r.hasSavings).toBe(true);
    expect(r.savingsRatio).toBeCloseTo(0.4, 3);
    expect(r.postLapseStabilityBonus).toBeCloseTo(1.2, 3);
  });

  it('caps bonus at 1.25 when savings exceed MAX_SAVINGS_RATIO', () => {
    // savings = 1 - 2000/10000 = 0.8; capped at 0.5: bonus = 1 + 0.5*0.5 = 1.25
    const r = computeRelearningSpeed(2000, 10000, 1);
    expect(r.postLapseStabilityBonus).toBeCloseTo(1.25, 3);
  });

  it('caps bonus at 1.25 even for very fast relearning', () => {
    // savings = 1 - 100/10000 = 0.99 → capped at 0.5 → bonus = 1.25
    const r = computeRelearningSpeed(100, 10000, 2);
    expect(r.postLapseStabilityBonus).toBe(1.25);
  });

  it('bonus at exactly savings=0.5 is 1.25 (upper boundary)', () => {
    // savings = 1 - 5000/10000 = 0.5; bonus = 1 + min(0.5, 0.5)*0.5 = 1.25
    const r = computeRelearningSpeed(5000, 10000, 1);
    expect(r.postLapseStabilityBonus).toBeCloseTo(1.25, 3);
  });

  it('works across multiple lapse counts (cardLapses ≥ 1)', () => {
    for (const lapses of [1, 2, 5, 10]) {
      const r = computeRelearningSpeed(3000, 10000, lapses);
      expect(r.postLapseStabilityBonus).toBeGreaterThan(1.0);
    }
  });
});

// ─── Precision ───────────────────────────────────────────────────────────────

describe('computeRelearningSpeed — precision', () => {
  it('savingsRatio is rounded to 3 decimal places', () => {
    const r = computeRelearningSpeed(7777, 10000, 1);
    const rounded = Math.round(r.savingsRatio! * 1000) / 1000;
    expect(r.savingsRatio).toBe(rounded);
  });

  it('postLapseStabilityBonus is rounded to 3 decimal places', () => {
    const r = computeRelearningSpeed(6000, 10000, 1);
    const rounded = Math.round(r.postLapseStabilityBonus * 1000) / 1000;
    expect(r.postLapseStabilityBonus).toBe(rounded);
  });

  it('bonus is always in [1.0, 1.25]', () => {
    const cases = [
      [10000, 10000], [9000, 10000], [6000, 10000], [3000, 10000], [500, 10000],
    ];
    for (const [current, original] of cases) {
      const r = computeRelearningSpeed(current!, original!, 1);
      expect(r.postLapseStabilityBonus).toBeGreaterThanOrEqual(1.0);
      expect(r.postLapseStabilityBonus).toBeLessThanOrEqual(1.25);
    }
  });
});
