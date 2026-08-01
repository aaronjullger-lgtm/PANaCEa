// SAFE-OVERRIDE: no shell commands; safety guard false-positive on function/variable names
/**
 * Unit tests for lib/services/gradeModulationCoordinator.ts
 *
 * Pure functions tested:
 *   classifyRtZone      — fast (<0.5×median), normal, slow (>1.5×median)
 *   computeFatigueScore — both RT ratio >1.3 AND accuracy ratio <0.7 required
 *   mapConfidenceCategory — raw rating → category
 *   calculateRtDelta    — zone × correctness 2×2 table
 *   calculateConfidenceDelta — confidence × correctness 2×2 table
 *   calculateStreakDelta — 0/2-3/4+ tiers
 *   calculateFatigueDelta — linear dampening (max −0.2 at score=1.0)
 *   modulateGrade       — full pipeline integration
 */

import { describe, it, expect } from 'vitest';
import {
  classifyRtZone,
  computeFatigueScore,
  mapConfidenceCategory,
  calculateRtDelta,
  calculateConfidenceDelta,
  calculateStreakDelta,
  calculateFatigueDelta,
  modulateGrade,
  BEHAVIORAL_CONSTANTS,
  type BehavioralContext,
} from './gradeModulationCoordinator';

// ─── classifyRtZone ───────────────────────────────────────────────────────────

describe('classifyRtZone', () => {
  it('fast zone when RT < 0.5× median', () => {
    const { zone, rtRatio } = classifyRtZone(5000, 15000);
    expect(zone).toBe('fast');
    expect(rtRatio).toBeCloseTo(5000 / 15000, 9);
  });

  it('slow zone when RT > 1.5× median', () => {
    const { zone, rtRatio } = classifyRtZone(30000, 15000);
    expect(zone).toBe('slow');
    expect(rtRatio).toBeCloseTo(2.0, 9);
  });

  it('normal zone when RT equals median', () => {
    const { zone, rtRatio } = classifyRtZone(15000, 15000);
    expect(zone).toBe('normal');
    expect(rtRatio).toBeCloseTo(1.0, 9);
  });

  it('normal zone exactly at 0.5× boundary (not strictly less than)', () => {
    // 0.5 < 0.5 is false → normal
    const { zone } = classifyRtZone(7500, 15000); // ratio = 0.5
    expect(zone).toBe('normal');
  });

  it('normal zone exactly at 1.5× boundary (not strictly greater than)', () => {
    const { zone } = classifyRtZone(22500, 15000); // ratio = 1.5
    expect(zone).toBe('normal');
  });

  it('falls back to SESSION_DEFAULT_MEDIAN_RT_MS when userMedianRtMs is null', () => {
    const fallback = BEHAVIORAL_CONSTANTS.SESSION_DEFAULT_MEDIAN_RT_MS;
    // Half of fallback → fast
    const { zone } = classifyRtZone(fallback * 0.4, null);
    expect(zone).toBe('fast');
  });

  it('returns rtRatio=1.0 when median is 0 (guard)', () => {
    const { zone, rtRatio } = classifyRtZone(5000, 0);
    expect(rtRatio).toBe(1.0);
    expect(zone).toBe('normal');
  });
});

// ─── computeFatigueScore ──────────────────────────────────────────────────────

describe('computeFatigueScore', () => {
  it('returns 0 when sessionQuestionIndex < FATIGUE_WINDOW_MIN_QUESTIONS', () => {
    expect(computeFatigueScore(9, 20000, 15000, 0.3, 0.8)).toBe(0.0);
  });

  it('returns 0 when any rolling stat is null', () => {
    expect(computeFatigueScore(15, null, 15000, 0.4, 0.8)).toBe(0.0);
    expect(computeFatigueScore(15, 22000, 15000, null, 0.8)).toBe(0.0);
    expect(computeFatigueScore(15, 22000, 15000, 0.4, null)).toBe(0.0);
  });

  it('returns 0 when only RT threshold is met (accuracy still good)', () => {
    // rtRatio = 1.5 > 1.3 ✓ but accuracyRatio = 0.8/0.9 ≈ 0.89 >= 0.7 ✗
    expect(computeFatigueScore(15, 22500, 15000, 0.8, 0.9)).toBe(0.0);
  });

  it('returns 0 when only accuracy threshold is met (RT still normal)', () => {
    // rtRatio = 1.1 ≤ 1.3 ✗, accuracyRatio = 0.4/0.8 = 0.5 < 0.7 ✓
    expect(computeFatigueScore(15, 16500, 15000, 0.4, 0.8)).toBe(0.0);
  });

  it('returns positive score when both thresholds met', () => {
    // rtRatio = 22500/15000 = 1.5, accuracyRatio = 0.4/0.8 = 0.5
    // fatigueScore = min(1.0, (1.5-1.3)*2.0) = 0.4
    const score = computeFatigueScore(15, 22500, 15000, 0.4, 0.8);
    expect(score).toBeCloseTo(0.4, 9);
  });

  it('is capped at 1.0 for extreme RT degradation', () => {
    // rtRatio = 60000/15000 = 4.0 >> threshold
    const score = computeFatigueScore(15, 60000, 15000, 0.1, 0.8);
    expect(score).toBe(1.0);
  });

  it('uses SESSION_DEFAULT_MEDIAN_RT_MS as fallback when userMedianRtMs is null', () => {
    const fallback = BEHAVIORAL_CONSTANTS.SESSION_DEFAULT_MEDIAN_RT_MS;
    // rollingRt = fallback * 1.5 → rtRatio = 1.5 > 1.3
    const score = computeFatigueScore(15, fallback * 1.5, null, 0.3, 0.8);
    expect(score).toBeGreaterThan(0);
  });
});

// ─── mapConfidenceCategory ────────────────────────────────────────────────────

describe('mapConfidenceCategory', () => {
  it('returns unknown when rating is 0', () => {
    expect(mapConfidenceCategory(0)).toBe('unknown');
  });

  it('returns unknown when rating is undefined', () => {
    expect(mapConfidenceCategory(undefined)).toBe('unknown');
  });

  it('returns low for rating=1', () => {
    expect(mapConfidenceCategory(1)).toBe('low');
  });

  it('returns medium for rating=2', () => {
    expect(mapConfidenceCategory(2)).toBe('medium');
  });

  it('returns high for rating=3', () => {
    expect(mapConfidenceCategory(3)).toBe('high');
  });
});

// ─── calculateRtDelta ─────────────────────────────────────────────────────────

describe('calculateRtDelta', () => {
  it('fast + correct → +0.4', () => {
    expect(calculateRtDelta('fast', true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.RT_FAST_CORRECT);
  });

  it('fast + incorrect → +0.3 (impulsive error dampener)', () => {
    expect(calculateRtDelta('fast', false)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.RT_FAST_INCORRECT);
  });

  it('slow + correct → -0.3 (effortful retrieval dampener)', () => {
    expect(calculateRtDelta('slow', true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.RT_SLOW_CORRECT);
  });

  it('slow + incorrect → 0.0 (no additional penalty)', () => {
    expect(calculateRtDelta('slow', false)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.RT_SLOW_INCORRECT);
    expect(calculateRtDelta('slow', false)).toBe(0.0);
  });

  it('normal + correct → 0.0', () => {
    expect(calculateRtDelta('normal', true)).toBe(0.0);
  });

  it('normal + incorrect → 0.0', () => {
    expect(calculateRtDelta('normal', false)).toBe(0.0);
  });
});

// ─── calculateConfidenceDelta ─────────────────────────────────────────────────

describe('calculateConfidenceDelta', () => {
  it('high + correct → +0.3', () => {
    expect(calculateConfidenceDelta('high', true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.CONF_HIGH_CORRECT);
  });

  it('high + incorrect → -0.3 (overconfidence penalty)', () => {
    expect(calculateConfidenceDelta('high', false)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.CONF_HIGH_INCORRECT);
  });

  it('low + correct → -0.15 (lucky guess dampener)', () => {
    expect(calculateConfidenceDelta('low', true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.CONF_LOW_CORRECT);
  });

  it('low + incorrect → +0.15 (expected error, soften blow)', () => {
    expect(calculateConfidenceDelta('low', false)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.CONF_LOW_INCORRECT);
  });

  it('medium produces zero delta', () => {
    expect(calculateConfidenceDelta('medium', true)).toBe(0.0);
    expect(calculateConfidenceDelta('medium', false)).toBe(0.0);
  });

  it('unknown produces zero delta', () => {
    expect(calculateConfidenceDelta('unknown', true)).toBe(0.0);
    expect(calculateConfidenceDelta('unknown', false)).toBe(0.0);
  });
});

// ─── calculateStreakDelta ─────────────────────────────────────────────────────

describe('calculateStreakDelta', () => {
  it('returns 0 on incorrect answer regardless of streak', () => {
    expect(calculateStreakDelta(5, false)).toBe(0.0);
    expect(calculateStreakDelta(1, false)).toBe(0.0);
  });

  it('returns 0 for streak ≤ 1 on correct answer', () => {
    expect(calculateStreakDelta(0, true)).toBe(0.0);
    expect(calculateStreakDelta(1, true)).toBe(0.0);
  });

  it('returns +0.05 for streak 2 (STREAK_2_3 tier)', () => {
    expect(calculateStreakDelta(2, true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.STREAK_2_3);
  });

  it('returns +0.05 for streak 3 (still STREAK_2_3 tier)', () => {
    expect(calculateStreakDelta(3, true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.STREAK_2_3);
  });

  it('returns +0.08 for streak 4 (STREAK_4_PLUS cap)', () => {
    expect(calculateStreakDelta(4, true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.STREAK_4_PLUS);
  });

  it('returns +0.08 for streak 100 (hard-capped, no escalation)', () => {
    expect(calculateStreakDelta(100, true)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.STREAK_4_PLUS);
  });
});

// ─── calculateFatigueDelta ────────────────────────────────────────────────────

describe('calculateFatigueDelta', () => {
  it('returns 0.0 when fatigueScore is 0', () => {
    expect(calculateFatigueDelta(0)).toBeCloseTo(0.0, 9);
  });

  it('returns FATIGUE_MAX when fatigueScore is 1.0', () => {
    expect(calculateFatigueDelta(1.0)).toBe(BEHAVIORAL_CONSTANTS.DELTAS.FATIGUE_MAX);
    expect(calculateFatigueDelta(1.0)).toBe(-0.2);
  });

  it('is linear: 0.5 fatigue → −0.1', () => {
    expect(calculateFatigueDelta(0.5)).toBeCloseTo(-0.1, 9);
  });

  it('is always non-positive (never amplifies)', () => {
    for (const score of [0, 0.25, 0.5, 0.75, 1.0]) {
      expect(calculateFatigueDelta(score)).toBeLessThanOrEqual(0);
    }
  });
});

// ─── modulateGrade — integration ─────────────────────────────────────────────

describe('modulateGrade', () => {
  const baseContext: BehavioralContext = {
    responseTimeMs: 15000,
    isCorrect: true,
    rawGrade: 3,
    streakCount: 1,
    sessionQuestionIndex: 5,
    userMedianRtMs: 15000,
    rollingWindowAccuracy: null,
    rollingWindowMeanRtMs: null,
    sessionMeanAccuracy: null,
  };

  it('returns rawGrade in result', () => {
    const r = modulateGrade(baseContext);
    expect(r.rawGrade).toBe(3);
  });

  it('normal RT + correct + no confidence → effectiveGrade = rawGrade (no deltas)', () => {
    // RT=15000, median=15000 → normal, no confidence, streak=1
    const r = modulateGrade(baseContext);
    expect(r.effectiveGrade).toBeCloseTo(3.0, 9);
    expect(r.discreteGrade).toBe(3);
  });

  it('fast RT + correct + reliable baseline adds RT delta +0.4', () => {
    const ctx: BehavioralContext = {
      ...baseContext,
      responseTimeMs: 5000, // 5000/15000 = 0.333 < 0.5 → fast
    };
    const r = modulateGrade(ctx);
    expect(r.effectiveGrade).toBeCloseTo(3.4, 9);
    expect(r.deltas.rtDelta).toBeCloseTo(0.4, 9);
  });

  it('null userMedianRtMs zeros out RT delta (cold-start grace period)', () => {
    const ctx: BehavioralContext = {
      ...baseContext,
      responseTimeMs: 5000,
      userMedianRtMs: null,
    };
    const r = modulateGrade(ctx);
    expect(r.deltas.rtDelta).toBe(0.0);
    expect(r.effectiveGrade).toBeCloseTo(3.0, 9);
  });

  it('effectiveGrade is clamped to 4.0 maximum', () => {
    // rawGrade=4 + fast_correct(+0.4) + streak_4(+0.08) = 4.48 → clamped to 4.0
    const ctx: BehavioralContext = {
      ...baseContext,
      responseTimeMs: 1000,
      rawGrade: 4,
      streakCount: 10,
    };
    const r = modulateGrade(ctx);
    expect(r.effectiveGrade).toBeLessThanOrEqual(4.0);
  });

  it('effectiveGrade is clamped to 1.0 minimum', () => {
    // rawGrade=1 + many penalties → still ≥ 1.0
    const ctx: BehavioralContext = {
      ...baseContext,
      responseTimeMs: 30000,  // slow
      isCorrect: false,
      rawGrade: 1,
    };
    const r = modulateGrade(ctx);
    expect(r.effectiveGrade).toBeGreaterThanOrEqual(1.0);
  });

  it('discreteGrade=1 when effectiveGrade < 1.5', () => {
    // rawGrade=1, slow+incorrect (0.0) → 1.0 → discrete Grade 1 (Again)
    const ctx: BehavioralContext = {
      ...baseContext,
      responseTimeMs: 30000,
      isCorrect: false,
      rawGrade: 1,
    };
    const r = modulateGrade(ctx);
    expect(r.discreteGrade).toBe(1);
  });

  it('discreteGrade=4 when effectiveGrade ≥ 3.5', () => {
    // rawGrade=4 → effectiveGrade=4 (neutral context)
    const ctx: BehavioralContext = {
      ...baseContext,
      rawGrade: 4,
    };
    const r = modulateGrade(ctx);
    expect(r.discreteGrade).toBe(4);
  });

  it('signals include rtZone, fatigueScore, confidenceCategory', () => {
    const r = modulateGrade(baseContext);
    expect(r.signals.rtZone).toBeDefined();
    expect(typeof r.signals.fatigueScore).toBe('number');
    expect(r.signals.confidenceCategory).toBe('unknown');
  });

  it('deltas total matches sum of individual deltas', () => {
    const r = modulateGrade({
      ...baseContext,
      responseTimeMs: 5000,
      streakCount: 3,
    });
    const expectedTotal = r.deltas.rtDelta + r.deltas.confidenceDelta +
      r.deltas.streakDelta + r.deltas.fatigueDelta + r.deltas.exGaussianDelta;
    expect(r.deltas.total).toBeCloseTo(expectedTotal, 9);
  });
});
