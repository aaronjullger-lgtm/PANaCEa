import { describe, it, expect } from 'vitest';
import { computeRtTrajectory } from '../lib/services/rtTrajectoryService';

describe('computeRtTrajectory', () => {
  it('returns no history when previousRtMs is null', () => {
    const result = computeRtTrajectory(5000, null, 3);
    expect(result.hasHistory).toBe(false);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.rtChangeRatio).toBeNull();
  });

  it('returns no history when elapsedDays < 0.5', () => {
    const result = computeRtTrajectory(5000, 6000, 0.3);
    expect(result.hasHistory).toBe(false);
    expect(result.stabilityMultiplier).toBe(1.0);
  });

  it('returns no history for zero/negative RT', () => {
    expect(computeRtTrajectory(0, 5000, 3).hasHistory).toBe(false);
    expect(computeRtTrajectory(5000, 0, 3).hasHistory).toBe(false);
    expect(computeRtTrajectory(-100, 5000, 3).hasHistory).toBe(false);
  });

  it('detects consolidation when RT decreases > 20%', () => {
    // 3000/5000 = 0.6, which is < 0.8 threshold
    const result = computeRtTrajectory(3000, 5000, 3);
    expect(result.hasHistory).toBe(true);
    expect(result.rtChangeRatio).toBe(0.6);
    expect(result.stabilityMultiplier).toBeGreaterThan(1.0);
    expect(result.stabilityMultiplier).toBeLessThanOrEqual(1.1);
  });

  it('detects decay when RT increases > 30%', () => {
    // 7000/5000 = 1.4, which is > 1.3 threshold
    const result = computeRtTrajectory(7000, 5000, 3);
    expect(result.hasHistory).toBe(true);
    expect(result.rtChangeRatio).toBe(1.4);
    expect(result.stabilityMultiplier).toBeLessThan(1.0);
    expect(result.stabilityMultiplier).toBeGreaterThanOrEqual(0.9);
  });

  it('returns neutral multiplier for stable RT', () => {
    // 5000/5000 = 1.0, between thresholds
    const result = computeRtTrajectory(5000, 5000, 3);
    expect(result.stabilityMultiplier).toBe(1.0);
    expect(result.rtChangeRatio).toBe(1.0);
  });

  it('caps bonus at 1.10 for extreme consolidation', () => {
    // 500/5000 = 0.1, very fast
    const result = computeRtTrajectory(500, 5000, 10);
    expect(result.stabilityMultiplier).toBeLessThanOrEqual(1.1);
  });

  it('caps penalty at 0.90 for extreme decay', () => {
    // 15000/5000 = 3.0, very slow
    const result = computeRtTrajectory(15000, 5000, 10);
    expect(result.stabilityMultiplier).toBeGreaterThanOrEqual(0.9);
  });

  it('preserves current and previous RT in result', () => {
    const result = computeRtTrajectory(4000, 6000, 2);
    expect(result.currentRtMs).toBe(4000);
    expect(result.previousRtMs).toBe(6000);
  });
});
