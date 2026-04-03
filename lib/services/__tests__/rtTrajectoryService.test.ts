import { describe, it, expect } from 'vitest';
import { computeRtTrajectory } from '../rtTrajectoryService';

describe('computeRtTrajectory', () => {
  it('returns neutral when no previous RT', () => {
    const result = computeRtTrajectory(5000, null, 3);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.hasHistory).toBe(false);
    expect(result.rtChangeRatio).toBeNull();
  });

  it('returns neutral when previous RT is 0', () => {
    const result = computeRtTrajectory(5000, 0, 3);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.hasHistory).toBe(false);
  });

  it('returns neutral when current RT is 0', () => {
    const result = computeRtTrajectory(0, 5000, 3);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.hasHistory).toBe(false);
  });

  it('returns neutral for same-day reviews (elapsed < 0.5)', () => {
    const result = computeRtTrajectory(3000, 5000, 0.3);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.hasHistory).toBe(false);
  });

  it('returns neutral when RT is stable (ratio ~1.0)', () => {
    const result = computeRtTrajectory(5000, 5000, 3);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.hasHistory).toBe(true);
    expect(result.rtChangeRatio).toBe(1.0);
  });

  it('gives bonus when RT decreased significantly (consolidation)', () => {
    // ratio = 3500 / 5000 = 0.7 < 0.8 threshold
    const result = computeRtTrajectory(3500, 5000, 5);
    expect(result.stabilityMultiplier).toBeGreaterThan(1.0);
    expect(result.stabilityMultiplier).toBeLessThanOrEqual(1.10);
    expect(result.hasHistory).toBe(true);
  });

  it('gives penalty when RT increased significantly (decay)', () => {
    // ratio = 7500 / 5000 = 1.5 > 1.3 threshold
    const result = computeRtTrajectory(7500, 5000, 5);
    expect(result.stabilityMultiplier).toBeLessThan(1.0);
    expect(result.stabilityMultiplier).toBeGreaterThanOrEqual(0.90);
    expect(result.hasHistory).toBe(true);
  });

  it('caps bonus at MAX_BONUS (1.10)', () => {
    // ratio = 2500 / 5000 = 0.5 (exactly at floor)
    const result = computeRtTrajectory(2500, 5000, 10);
    expect(result.stabilityMultiplier).toBe(1.1);
  });

  it('caps penalty at MAX_PENALTY (0.90)', () => {
    // ratio = 10000 / 5000 = 2.0 (at ceiling)
    const result = computeRtTrajectory(10000, 5000, 10);
    expect(result.stabilityMultiplier).toBe(0.9);
  });

  it('does not go below 0.9 even for extreme slowdown', () => {
    const result = computeRtTrajectory(20000, 5000, 10);
    expect(result.stabilityMultiplier).toBe(0.9);
  });

  it('returns correct ratio and metadata', () => {
    const result = computeRtTrajectory(4000, 5000, 7);
    expect(result.rtChangeRatio).toBe(0.8);
    expect(result.previousRtMs).toBe(5000);
    expect(result.currentRtMs).toBe(4000);
    expect(result.hasHistory).toBe(true);
  });

  it('handles edge case at elapsed_days exactly 0.5', () => {
    const result = computeRtTrajectory(3000, 5000, 0.5);
    expect(result.hasHistory).toBe(true);
    expect(result.stabilityMultiplier).toBeGreaterThan(1.0);
  });
});
