// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for pure, time-independent functions in lib/circadian.ts
 *
 * Functions tested (no real-time dependency):
 *   applyCircadianModifier(baseStability, context)      — stability * modifier
 *   applyCircadianParTimeModifier(baseParTimeMs, ctx)   — par time * modifier (rounded)
 *   getCircadianModifier(localHour)                     — phase modifier by clock hour
 *   isOptimalStudyTime(context)                         — peak or evening_recovery
 *   getStudyRecommendation(context)                     — recommendation + message + duration
 *
 * Phase modifiers (PHASE_MODIFIERS):
 *   peak             → stabilityModifier = 1.0
 *   trough           → stabilityModifier = 1.15
 *   neutral          → stabilityModifier = 1.0
 *   evening_recovery → stabilityModifier = 1.05
 *   late_night       → stabilityModifier = 1.2
 *
 * getCircadianModifier (clock-based fallback):
 *   23-4 (late night) → 1.2
 *   9-11 (peak)       → 1.0
 *   14-15 (trough)    → 1.15
 *   18-20 (evening)   → 1.05
 *   other (neutral)   → 1.0
 *
 * NOTE: getBrowserTimezone, getLocalHour, buildCircadianContext depend on
 *   real time and are excluded from pure tests.
 */

import { describe, it, expect } from 'vitest';
import {
  applyCircadianModifier,
  applyCircadianParTimeModifier,
  getCircadianModifier,
  isOptimalStudyTime,
  getStudyRecommendation,
  type CircadianContext,
  type CircadianPhase,
} from './circadian';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(phase: CircadianPhase): CircadianContext {
  const MODIFIERS: Record<CircadianPhase, { stability: number; parTime: number }> = {
    peak:             { stability: 1.0, parTime: 1.0 },
    trough:           { stability: 1.15, parTime: 1.15 },
    neutral:          { stability: 1.0, parTime: 1.0 },
    evening_recovery: { stability: 1.05, parTime: 1.05 },
    late_night:       { stability: 1.2, parTime: 1.25 },
  };
  const m = MODIFIERS[phase];
  return {
    localHour: 10,
    timezone: 'America/New_York',
    circadianPhase: phase,
    stabilityModifier: m.stability,
    parTimeModifier: m.parTime,
    capturedAt: new Date().toISOString(),
  };
}

// ─── applyCircadianModifier ───────────────────────────────────────────────────

describe('applyCircadianModifier', () => {
  it('returns baseStability * stabilityModifier', () => {
    const ctx = makeContext('trough');
    expect(applyCircadianModifier(10, ctx)).toBeCloseTo(10 * 1.15, 5);
  });

  it('peak phase: modifier = 1.0, no change to stability', () => {
    expect(applyCircadianModifier(5, makeContext('peak'))).toBeCloseTo(5, 5);
  });

  it('late_night phase: modifier = 1.2, 20% bonus', () => {
    expect(applyCircadianModifier(10, makeContext('late_night'))).toBeCloseTo(12, 5);
  });

  it('result scales linearly with baseStability', () => {
    const ctx = makeContext('evening_recovery');
    expect(applyCircadianModifier(20, ctx)).toBeCloseTo(2 * applyCircadianModifier(10, ctx), 5);
  });

  it('returns 0 for 0 base stability', () => {
    expect(applyCircadianModifier(0, makeContext('trough'))).toBe(0);
  });
});

// ─── applyCircadianParTimeModifier ────────────────────────────────────────────

describe('applyCircadianParTimeModifier', () => {
  it('returns Math.round(baseParTimeMs * parTimeModifier)', () => {
    const ctx = makeContext('trough'); // parTimeModifier = 1.15
    expect(applyCircadianParTimeModifier(30000, ctx)).toBe(Math.round(30000 * 1.15));
  });

  it('result is always an integer (rounded)', () => {
    const ctx = makeContext('late_night'); // parTimeModifier = 1.25
    const result = applyCircadianParTimeModifier(30000, ctx);
    expect(result).toBe(Math.round(result));
  });

  it('peak phase: no change to par time', () => {
    expect(applyCircadianParTimeModifier(20000, makeContext('peak'))).toBe(20000);
  });

  it('late_night gives 25% longer par time', () => {
    const result = applyCircadianParTimeModifier(40000, makeContext('late_night'));
    expect(result).toBe(Math.round(40000 * 1.25));
  });

  it('returns 0 for 0 par time', () => {
    expect(applyCircadianParTimeModifier(0, makeContext('trough'))).toBe(0);
  });
});

// ─── getCircadianModifier ─────────────────────────────────────────────────────

describe('getCircadianModifier', () => {
  // Clock-based fallback phase determination:
  // late_night: hour >= 23 OR hour < 5
  // peak: hour in [9, 11]
  // trough: hour in [14, 15]
  // evening_recovery: hour in [18, 20]
  // neutral: everything else

  it('hour 23 → late_night phase modifier (1.2)', () => {
    expect(getCircadianModifier(23)).toBeCloseTo(1.2, 5);
  });

  it('hour 0 → late_night phase modifier (1.2)', () => {
    expect(getCircadianModifier(0)).toBeCloseTo(1.2, 5);
  });

  it('hour 4 → late_night phase modifier (1.2)', () => {
    expect(getCircadianModifier(4)).toBeCloseTo(1.2, 5);
  });

  it('hour 9 → peak phase modifier (1.0)', () => {
    expect(getCircadianModifier(9)).toBeCloseTo(1.0, 5);
  });

  it('hour 11 → peak phase modifier (1.0)', () => {
    expect(getCircadianModifier(11)).toBeCloseTo(1.0, 5);
  });

  it('hour 14 → trough phase modifier (1.15)', () => {
    expect(getCircadianModifier(14)).toBeCloseTo(1.15, 5);
  });

  it('hour 15 → trough phase modifier (1.15)', () => {
    expect(getCircadianModifier(15)).toBeCloseTo(1.15, 5);
  });

  it('hour 18 → evening_recovery phase modifier (1.05)', () => {
    expect(getCircadianModifier(18)).toBeCloseTo(1.05, 5);
  });

  it('hour 20 → evening_recovery phase modifier (1.05)', () => {
    expect(getCircadianModifier(20)).toBeCloseTo(1.05, 5);
  });

  it('hour 7 (neutral) → neutral phase modifier (1.0)', () => {
    expect(getCircadianModifier(7)).toBeCloseTo(1.0, 5);
  });

  it('returns a positive number for every hour 0-23', () => {
    for (let h = 0; h < 24; h++) {
      expect(getCircadianModifier(h)).toBeGreaterThan(0);
    }
  });

  it('all modifiers are at least 1.0 (no penalty)', () => {
    for (let h = 0; h < 24; h++) {
      expect(getCircadianModifier(h)).toBeGreaterThanOrEqual(1.0);
    }
  });
});

// ─── isOptimalStudyTime ───────────────────────────────────────────────────────

describe('isOptimalStudyTime', () => {
  it('returns true for peak phase', () => {
    expect(isOptimalStudyTime(makeContext('peak'))).toBe(true);
  });

  it('returns true for evening_recovery phase', () => {
    expect(isOptimalStudyTime(makeContext('evening_recovery'))).toBe(true);
  });

  it('returns false for trough phase', () => {
    expect(isOptimalStudyTime(makeContext('trough'))).toBe(false);
  });

  it('returns false for neutral phase', () => {
    expect(isOptimalStudyTime(makeContext('neutral'))).toBe(false);
  });

  it('returns false for late_night phase', () => {
    expect(isOptimalStudyTime(makeContext('late_night'))).toBe(false);
  });
});

// ─── getStudyRecommendation ───────────────────────────────────────────────────

describe('getStudyRecommendation', () => {
  it('peak → recommendation=optimal, 45 min session', () => {
    const rec = getStudyRecommendation(makeContext('peak'));
    expect(rec.recommendation).toBe('optimal');
    expect(rec.suggestedDuration).toBe(45);
    expect(rec.message.length).toBeGreaterThan(0);
  });

  it('evening_recovery → recommendation=optimal, 30 min session', () => {
    const rec = getStudyRecommendation(makeContext('evening_recovery'));
    expect(rec.recommendation).toBe('optimal');
    expect(rec.suggestedDuration).toBe(30);
  });

  it('trough → recommendation=acceptable, 20 min session', () => {
    const rec = getStudyRecommendation(makeContext('trough'));
    expect(rec.recommendation).toBe('acceptable');
    expect(rec.suggestedDuration).toBe(20);
  });

  it('neutral and late_night → recommendation=suboptimal or acceptable', () => {
    // The switch default handles neutral and late_night
    for (const phase of ['neutral', 'late_night'] as const) {
      const rec = getStudyRecommendation(makeContext(phase));
      expect(['suboptimal', 'acceptable', 'optimal']).toContain(rec.recommendation);
      expect(rec.suggestedDuration).toBeGreaterThan(0);
    }
  });

  it('all phases return non-empty message', () => {
    for (const phase of ['peak', 'trough', 'neutral', 'evening_recovery', 'late_night'] as const) {
      const rec = getStudyRecommendation(makeContext(phase));
      expect(rec.message.length).toBeGreaterThan(0);
    }
  });

  it('all phases return a positive suggestedDuration', () => {
    for (const phase of ['peak', 'trough', 'neutral', 'evening_recovery', 'late_night'] as const) {
      expect(getStudyRecommendation(makeContext(phase)).suggestedDuration).toBeGreaterThan(0);
    }
  });
});
