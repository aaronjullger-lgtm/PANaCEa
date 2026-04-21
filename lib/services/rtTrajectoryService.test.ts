/**
 * Unit tests for lib/services/rtTrajectoryService.ts
 *
 * Constants:
 *   MIN_ELAPSED_DAYS      = 0.5   (same-day reviews skipped)
 *   CONSOLIDATION_THRESHOLD = 0.8 (ratio < 0.8 → consolidating)
 *   DECAY_THRESHOLD         = 1.3 (ratio > 1.3 → decaying)
 *   MAX_BONUS               = 1.10
 *   MAX_PENALTY             = 0.90
 *
 * Consolidation multiplier (ratio in [0.5, 0.8)):
 *   scale = (0.8 - max(ratio, 0.5)) / (0.8 - 0.5) = (0.8 - max(ratio, 0.5)) / 0.3
 *   multiplier = 1.0 + 0.10 * scale
 *
 * Decay multiplier (ratio in (1.3, 2.0]):
 *   scale = min((ratio - 1.3) / 0.7, 1.0)
 *   multiplier = 1.0 - 0.10 * scale
 */

import { describe, it, expect } from 'vitest';
import { computeRtTrajectory } from './rtTrajectoryService';

// ─── Guard clauses ────────────────────────────────────────────────────────────

describe('computeRtTrajectory — guard clauses', () => {
  it('returns neutral when previousRtMs is null', () => {
    const r = computeRtTrajectory(5000, null, 1);
    expect(r.stabilityMultiplier).toBe(1.0);
    expect(r.rtChangeRatio).toBeNull();
    expect(r.hasHistory).toBe(false);
  });

  it('returns neutral when previousRtMs is 0', () => {
    const r = computeRtTrajectory(5000, 0, 1);
    expect(r.stabilityMultiplier).toBe(1.0);
    expect(r.hasHistory).toBe(false);
  });

  it('returns neutral when previousRtMs is negative', () => {
    const r = computeRtTrajectory(5000, -100, 1);
    expect(r.stabilityMultiplier).toBe(1.0);
    expect(r.hasHistory).toBe(false);
  });

  it('returns neutral when currentRtMs is 0 or negative', () => {
    const zero = computeRtTrajectory(0, 5000, 1);
    expect(zero.hasHistory).toBe(false);
    expect(zero.stabilityMultiplier).toBe(1.0);

    const neg = computeRtTrajectory(-1, 5000, 1);
    expect(neg.hasHistory).toBe(false);
  });

  it('returns neutral when elapsedDays < MIN_ELAPSED_DAYS (same-day review)', () => {
    const r = computeRtTrajectory(5000, 5000, 0.3);
    expect(r.hasHistory).toBe(false);
    expect(r.stabilityMultiplier).toBe(1.0);
  });

  it('allows computation at exactly MIN_ELAPSED_DAYS', () => {
    const r = computeRtTrajectory(5000, 5000, 0.5);
    expect(r.hasHistory).toBe(true);
  });

  it('passes through currentRtMs and previousRtMs in guard result', () => {
    const r = computeRtTrajectory(7000, null, 1);
    expect(r.currentRtMs).toBe(7000);
    expect(r.previousRtMs).toBeNull();
  });
});

// ─── Stable (no change) ───────────────────────────────────────────────────────

describe('computeRtTrajectory — stable', () => {
  it('returns multiplier=1.0 for identical RT (ratio=1.0)', () => {
    const r = computeRtTrajectory(5000, 5000, 7);
    expect(r.rtChangeRatio).toBeCloseTo(1.0, 3);
    expect(r.stabilityMultiplier).toBe(1.0);
    expect(r.hasHistory).toBe(true);
  });

  it('returns multiplier=1.0 at the consolidation boundary (ratio=0.8)', () => {
    // ratio = 0.8 is not strictly < threshold (it's ==), so no bonus
    const r = computeRtTrajectory(8000, 10000, 7);
    expect(r.rtChangeRatio).toBeCloseTo(0.8, 3);
    expect(r.stabilityMultiplier).toBe(1.0);
  });

  it('returns multiplier=1.0 at the decay boundary (ratio=1.3)', () => {
    // ratio = 1.3 is not strictly > threshold, so no penalty
    const r = computeRtTrajectory(13000, 10000, 7);
    expect(r.rtChangeRatio).toBeCloseTo(1.3, 3);
    expect(r.stabilityMultiplier).toBe(1.0);
  });

  it('returns multiplier=1.0 for ratio just inside stable zone', () => {
    const r = computeRtTrajectory(12000, 10000, 7); // ratio=1.2 < 1.3
    expect(r.stabilityMultiplier).toBe(1.0);
  });
});

// ─── Consolidation (ratio < 0.8) ─────────────────────────────────────────────

describe('computeRtTrajectory — consolidation', () => {
  it('returns multiplier > 1.0 for ratio < 0.8', () => {
    const r = computeRtTrajectory(7000, 10000, 7); // ratio=0.7
    expect(r.stabilityMultiplier).toBeGreaterThan(1.0);
  });

  it('computes correct multiplier at ratio=0.7', () => {
    // scale = (0.8 - 0.7) / 0.3 = 0.333; multiplier = 1 + 0.10*0.333 = 1.0333
    const expected = 1.0 + 0.10 * ((0.8 - 0.7) / 0.3);
    const r = computeRtTrajectory(7000, 10000, 7);
    expect(r.stabilityMultiplier).toBeCloseTo(expected, 3);
  });

  it('computes correct multiplier at ratio=0.5 (full bonus)', () => {
    // scale = (0.8 - 0.5) / 0.3 = 1.0; multiplier = 1.10
    const r = computeRtTrajectory(5000, 10000, 7);
    expect(r.stabilityMultiplier).toBeCloseTo(1.10, 3);
  });

  it('caps at MAX_BONUS (1.10) for ratio < 0.5', () => {
    // ratio = 0.2 < 0.5 → clamped to 0.5, scale = 1.0, multiplier = 1.10
    const r = computeRtTrajectory(2000, 10000, 7);
    expect(r.stabilityMultiplier).toBeCloseTo(1.10, 3);
  });

  it('never exceeds 1.10 for any consolidation ratio', () => {
    for (const rt of [100, 500, 1000, 2000, 4000]) {
      const r = computeRtTrajectory(rt, 10000, 7);
      expect(r.stabilityMultiplier).toBeLessThanOrEqual(1.10 + 1e-6);
    }
  });

  it('multiplier increases as ratio decreases (faster = more bonus)', () => {
    const r07 = computeRtTrajectory(7000, 10000, 7); // ratio=0.7
    const r06 = computeRtTrajectory(6000, 10000, 7); // ratio=0.6
    expect(r06.stabilityMultiplier).toBeGreaterThan(r07.stabilityMultiplier);
  });
});

// ─── Decay (ratio > 1.3) ─────────────────────────────────────────────────────

describe('computeRtTrajectory — decay', () => {
  it('returns multiplier < 1.0 for ratio > 1.3', () => {
    const r = computeRtTrajectory(15000, 10000, 7); // ratio=1.5
    expect(r.stabilityMultiplier).toBeLessThan(1.0);
  });

  it('computes correct multiplier at ratio=1.65', () => {
    // scale = (1.65-1.3)/0.7 = 0.5; multiplier = 1.0 - 0.10*0.5 = 0.95
    const r = computeRtTrajectory(16500, 10000, 7);
    expect(r.stabilityMultiplier).toBeCloseTo(0.95, 3);
  });

  it('computes correct multiplier at ratio=2.0 (full penalty)', () => {
    // scale = (2.0-1.3)/0.7 = 1.0; multiplier = 0.90
    const r = computeRtTrajectory(20000, 10000, 7);
    expect(r.stabilityMultiplier).toBeCloseTo(0.90, 3);
  });

  it('caps at MAX_PENALTY (0.90) for ratio > 2.0', () => {
    const r = computeRtTrajectory(50000, 10000, 7);
    expect(r.stabilityMultiplier).toBeCloseTo(0.90, 3);
  });

  it('never goes below 0.90 for any decay ratio', () => {
    for (const rt of [20000, 30000, 50000, 100000]) {
      const r = computeRtTrajectory(rt, 10000, 7);
      expect(r.stabilityMultiplier).toBeGreaterThanOrEqual(0.90 - 1e-6);
    }
  });

  it('multiplier decreases as ratio increases (slower = more penalty)', () => {
    const r14 = computeRtTrajectory(14000, 10000, 7); // ratio=1.4
    const r18 = computeRtTrajectory(18000, 10000, 7); // ratio=1.8
    expect(r18.stabilityMultiplier).toBeLessThan(r14.stabilityMultiplier);
  });
});

// ─── Output precision & fields ────────────────────────────────────────────────

describe('computeRtTrajectory — output fields', () => {
  it('rtChangeRatio is rounded to 3 decimal places', () => {
    const r = computeRtTrajectory(7777, 10000, 7);
    const rounded = Math.round(r.rtChangeRatio! * 1000) / 1000;
    expect(r.rtChangeRatio).toBe(rounded);
  });

  it('stabilityMultiplier is rounded to 3 decimal places', () => {
    const r = computeRtTrajectory(7000, 10000, 7);
    const rounded = Math.round(r.stabilityMultiplier * 1000) / 1000;
    expect(r.stabilityMultiplier).toBe(rounded);
  });

  it('hasHistory=true when all inputs are valid', () => {
    const r = computeRtTrajectory(5000, 5000, 7);
    expect(r.hasHistory).toBe(true);
  });

  it('currentRtMs echoed correctly', () => {
    const r = computeRtTrajectory(8765, 10000, 7);
    expect(r.currentRtMs).toBe(8765);
  });

  it('previousRtMs echoed correctly', () => {
    const r = computeRtTrajectory(8000, 12345, 7);
    expect(r.previousRtMs).toBe(12345);
  });
});
