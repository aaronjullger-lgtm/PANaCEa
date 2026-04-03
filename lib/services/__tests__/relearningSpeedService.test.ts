import { describe, it, expect } from 'vitest';
import { computeRelearningSpeed } from '../relearningSpeedService';

describe('computeRelearningSpeed', () => {
  // ── Not applicable cases ──

  it('returns neutral when original RT is null', () => {
    const result = computeRelearningSpeed(5000, null, 2);
    expect(result.savingsRatio).toBeNull();
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(false);
  });

  it('returns neutral when original RT is 0', () => {
    const result = computeRelearningSpeed(5000, 0, 2);
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(false);
  });

  it('returns neutral when card has no lapses', () => {
    const result = computeRelearningSpeed(5000, 10000, 0);
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(false);
  });

  it('returns neutral when current RT is 0', () => {
    const result = computeRelearningSpeed(0, 10000, 1);
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(false);
  });

  // ── Savings detection ──

  it('detects no savings when relearning takes as long as original', () => {
    // savings = 1 - (10000 / 10000) = 0 → no bonus
    const result = computeRelearningSpeed(10000, 10000, 1);
    expect(result.savingsRatio).toBe(0);
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(true);
  });

  it('detects small savings below threshold (no bonus)', () => {
    // savings = 1 - (8000/10000) = 0.2 → below 0.3 threshold
    const result = computeRelearningSpeed(8000, 10000, 1);
    expect(result.savingsRatio).toBe(0.2);
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(true);
  });

  it('applies bonus for moderate savings (>0.3)', () => {
    // savings = 1 - (6000/10000) = 0.4 → bonus = 1.0 + 0.4*0.5 = 1.2
    const result = computeRelearningSpeed(6000, 10000, 1);
    expect(result.savingsRatio).toBe(0.4);
    expect(result.postLapseStabilityBonus).toBe(1.2);
  });

  it('caps bonus at 1.25 for very high savings', () => {
    // savings = 1 - (2000/10000) = 0.8 → capped at 0.5 → bonus = 1.0 + 0.5*0.5 = 1.25
    const result = computeRelearningSpeed(2000, 10000, 1);
    expect(result.savingsRatio).toBe(0.8);
    expect(result.postLapseStabilityBonus).toBe(1.25);
  });

  it('handles negative savings (slower relearning)', () => {
    // savings = 1 - (15000/10000) = -0.5 → no bonus
    const result = computeRelearningSpeed(15000, 10000, 1);
    expect(result.savingsRatio).toBe(-0.5);
    expect(result.postLapseStabilityBonus).toBe(1.0);
    expect(result.hasSavings).toBe(true);
  });

  it('works with multiple lapses', () => {
    const result = computeRelearningSpeed(4000, 10000, 5);
    expect(result.savingsRatio).toBe(0.6);
    expect(result.postLapseStabilityBonus).toBeGreaterThan(1.0);
    expect(result.hasSavings).toBe(true);
  });
});
