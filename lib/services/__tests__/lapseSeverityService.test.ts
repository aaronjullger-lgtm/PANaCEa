import { describe, it, expect } from 'vitest';
import { computeLapseSeverity } from '../lapseSeverityService';

describe('computeLapseSeverity', () => {
  it('returns multiplier 1.0 for new cards (state 0)', () => {
    const result = computeLapseSeverity(5, 10, 0);
    expect(result.difficultyMultiplier).toBe(1.0);
    expect(result.severity).toBe(0);
  });

  it('returns multiplier 1.0 for learning cards (state 1)', () => {
    const result = computeLapseSeverity(3, 5, 1);
    expect(result.difficultyMultiplier).toBe(1.0);
    expect(result.severity).toBe(0);
  });

  it('returns multiplier 1.0 when reps < 1', () => {
    const result = computeLapseSeverity(0, 10, 2);
    expect(result.difficultyMultiplier).toBe(1.0);
    expect(result.severity).toBe(0);
  });

  it('computes moderate severity for reps=2, stability=5', () => {
    const result = computeLapseSeverity(2, 5, 2);
    // severity = log2(3) × log2(6) ≈ 1.585 × 2.585 ≈ 4.098
    // multiplier = 1 + 0.15 × 4.098 ≈ 1.615 → capped at 1.6
    expect(result.severity).toBeGreaterThan(0);
    expect(result.difficultyMultiplier).toBeGreaterThan(1.0);
    expect(result.difficultyMultiplier).toBeLessThanOrEqual(1.6);
  });

  it('computes higher severity for long-streak lapse (reps=8, stability=30)', () => {
    const result = computeLapseSeverity(8, 30, 2);
    // severity = log2(9) × log2(31) ≈ 3.17 × 4.95 ≈ 15.7
    // multiplier = 1 + 0.15 × 15.7 ≈ 3.36 → capped at 1.6
    expect(result.difficultyMultiplier).toBe(1.6);
  });

  it('caps at MAX_SEVERITY_MULTIPLIER (1.6) for extreme streaks', () => {
    const result = computeLapseSeverity(15, 100, 2);
    expect(result.difficultyMultiplier).toBe(1.6);
  });

  it('handles relearning state (state 3)', () => {
    // State 3 is also ≥ 2, so lapse severity should apply
    const result = computeLapseSeverity(4, 10, 3);
    expect(result.difficultyMultiplier).toBeGreaterThan(1.0);
  });

  it('returns correct preLapseReps and preLapseStability in result', () => {
    const result = computeLapseSeverity(5, 20, 2);
    expect(result.preLapseReps).toBe(5);
    expect(result.preLapseStability).toBe(20);
  });

  it('handles zero stability gracefully', () => {
    const result = computeLapseSeverity(3, 0, 2);
    // severity = log2(4) × log2(1) = 2.0 × 0 = 0
    expect(result.severity).toBe(0);
    expect(result.difficultyMultiplier).toBe(1.0);
  });

  it('handles negative stability gracefully', () => {
    const result = computeLapseSeverity(3, -5, 2);
    // Math.max(0, -5) = 0 → log2(1) = 0 → severity = 0
    expect(result.severity).toBe(0);
    expect(result.difficultyMultiplier).toBe(1.0);
  });

  it('rounds severity to 3 decimal places', () => {
    const result = computeLapseSeverity(1, 2, 2);
    const decimalPlaces = result.severity.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(3);
  });
});
