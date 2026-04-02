import { describe, it, expect } from 'vitest';
import { computeLapseSeverity, type LapseSeverityResult } from '../lib/services/lapseSeverityService';

describe('computeLapseSeverity', () => {
  it('returns zero severity for new cards (state < 2)', () => {
    const result = computeLapseSeverity(5, 10, 1);
    expect(result.severity).toBe(0);
    expect(result.difficultyMultiplier).toBe(1.0);
  });

  it('returns zero severity for cards with no reps', () => {
    const result = computeLapseSeverity(0, 10, 2);
    expect(result.severity).toBe(0);
    expect(result.difficultyMultiplier).toBe(1.0);
  });

  it('computes severity for review cards with history', () => {
    // reps=8, stability=30, state=2 (review)
    const result = computeLapseSeverity(8, 30, 2);
    expect(result.severity).toBeGreaterThan(0);
    expect(result.difficultyMultiplier).toBeGreaterThan(1.0);
  });

  it('higher reps produce higher severity', () => {
    const low = computeLapseSeverity(2, 5, 2);
    const high = computeLapseSeverity(10, 5, 2);
    expect(high.severity).toBeGreaterThan(low.severity);
    // Both may hit cap, so compare severity instead of multiplier
    expect(high.difficultyMultiplier).toBeGreaterThanOrEqual(low.difficultyMultiplier);
  });

  it('higher stability produces higher severity', () => {
    const lowStab = computeLapseSeverity(5, 5, 2);
    const highStab = computeLapseSeverity(5, 50, 2);
    expect(highStab.severity).toBeGreaterThan(lowStab.severity);
  });

  it('caps difficultyMultiplier at 1.6', () => {
    // Extreme values: 100 reps, stability 1000
    const result = computeLapseSeverity(100, 1000, 2);
    expect(result.difficultyMultiplier).toBeLessThanOrEqual(1.6);
  });

  it('preserves preLapseReps and preLapseStability in result', () => {
    const result = computeLapseSeverity(7, 25, 2);
    expect(result.preLapseReps).toBe(7);
    expect(result.preLapseStability).toBe(25);
  });

  it('handles relearning state (state=3) same as review', () => {
    const review = computeLapseSeverity(5, 10, 2);
    const relearning = computeLapseSeverity(5, 10, 3);
    expect(relearning.severity).toBe(review.severity);
  });

  it('handles negative stability gracefully', () => {
    const result = computeLapseSeverity(5, -10, 2);
    // log2(1 + max(0, -10)) = log2(1) = 0
    expect(result.severity).toBe(0);
    expect(result.difficultyMultiplier).toBe(1.0);
  });
});
