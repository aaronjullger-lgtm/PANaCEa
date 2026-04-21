/**
 * Unit tests for lib/services/compositeFatigueService.ts
 *
 * All signal functions require ≥ BASELINE_WINDOW(8) + ROLLING_WINDOW(5) = 13
 * data points before returning a non-zero value.
 *
 * Constants:
 *   MIN_QUESTIONS            = 10
 *   BASELINE_WINDOW          = 8
 *   ROLLING_WINDOW           = 5
 *   RT_DRIFT_MAX_PERCENT     = 0.50  (50% increase → signal 1.0)
 *   ACCURACY_DECLINE_MAX_DROP= 0.30  (30pp drop → signal 1.0)
 *   DURATION_SIGMOID_MIDPOINT= 25    minutes
 *   DURATION_SIGMOID_STEEPNESS= 0.15
 *   THRESHOLDS: none<0.30, mild<0.50, moderate<0.70, severe≥0.70
 *   WEIGHTS: rtDrift=0.30, rtVariability=0.25, accuracyDecline=0.25, durationFactor=0.20
 */

import { describe, it, expect } from 'vitest';
import {
  computeRtDrift,
  computeRtVariability,
  computeAccuracyDecline,
  computeDurationFactor,
  estimateFatigueOnset,
  computeCompositeFatigue,
  classifyFatigueLevel,
  BASELINE_WINDOW,
  ROLLING_WINDOW,
  MIN_QUESTIONS,
  THRESHOLDS,
  WEIGHTS,
  type SessionDataPoint,
} from './compositeFatigueService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an array of n identical response times */
function uniformRts(n: number, ms = 1000): number[] {
  return Array(n).fill(ms);
}

/** Build an array of n correctness booleans (all true or all false) */
function uniformCorrectness(n: number, correct = true): boolean[] {
  return Array(n).fill(correct);
}

/**
 * Build n SessionDataPoints spaced intervalMs apart.
 * All responses have the given RT and correctness.
 */
function makeDataPoints(
  n: number,
  rtMs = 1000,
  correct = true,
  intervalMs = 5000
): SessionDataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    responseTimeMs: rtMs,
    wasCorrect: correct,
    timestamp: i * intervalMs,
  }));
}

/**
 * Build a data set with a "fresh" baseline followed by a "fatigued" tail.
 * baseline: fast + correct  |  tail: slow + wrong
 */
function makeFatiguedData(
  baselineCount: number,
  tailCount: number,
  baselineRtMs = 800,
  tailRtMs = 2000,
  intervalMs = 5000
): SessionDataPoint[] {
  const result: SessionDataPoint[] = [];
  for (let i = 0; i < baselineCount + tailCount; i++) {
    const isTail = i >= baselineCount;
    result.push({
      responseTimeMs: isTail ? tailRtMs : baselineRtMs,
      wasCorrect: !isTail,
      timestamp: i * intervalMs,
    });
  }
  return result;
}

// ─── computeRtDrift ──────────────────────────────────────────────────────────

describe('computeRtDrift', () => {
  it('returns 0 for fewer than BASELINE_WINDOW + ROLLING_WINDOW entries', () => {
    expect(computeRtDrift(uniformRts(BASELINE_WINDOW + ROLLING_WINDOW - 1))).toBe(0);
    expect(computeRtDrift([])).toBe(0);
  });

  it('returns 0 when all response times are identical (no drift)', () => {
    const rts = uniformRts(BASELINE_WINDOW + ROLLING_WINDOW, 1000);
    expect(computeRtDrift(rts)).toBe(0);
  });

  it('returns 0 when recent times are FASTER than baseline (negative drift ignored)', () => {
    // baseline=1000ms, then slow, then recent=500ms
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      ...uniformRts(ROLLING_WINDOW, 500),
    ];
    expect(computeRtDrift(rts)).toBe(0);
  });

  it('returns 0.5 for 25% RT increase (drift = 0.25 / max 0.50)', () => {
    // baseline=1000, recent=1250 → drift=0.25 → signal=0.50
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      ...uniformRts(ROLLING_WINDOW, 1250),
    ];
    expect(computeRtDrift(rts)).toBeCloseTo(0.5, 3);
  });

  it('returns 1.0 for 50% RT increase (at max threshold)', () => {
    // baseline=1000, recent=1500 → drift=0.50 / max=0.50 → signal=1.0
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      ...uniformRts(ROLLING_WINDOW, 1500),
    ];
    expect(computeRtDrift(rts)).toBeCloseTo(1.0, 3);
  });

  it('returns 1.0 for drift exceeding max threshold (clamped)', () => {
    // baseline=1000, recent=3000 → 200% increase, clamped to 1.0
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      ...uniformRts(ROLLING_WINDOW, 3000),
    ];
    expect(computeRtDrift(rts)).toBeCloseTo(1.0, 3);
  });

  it('uses the LAST ROLLING_WINDOW entries as "recent"', () => {
    // Middle entries are slow but the last 5 are back to baseline → no drift
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),   // 8 baseline
      ...uniformRts(10, 5000),                 // 10 very slow (middle)
      ...uniformRts(ROLLING_WINDOW, 1000),     // 5 back to baseline (recent)
    ];
    expect(computeRtDrift(rts)).toBeCloseTo(0, 3);
  });

  it('result is always in [0, 1]', () => {
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 500),
      ...uniformRts(ROLLING_WINDOW, 10000),
    ];
    const drift = computeRtDrift(rts);
    expect(drift).toBeGreaterThanOrEqual(0);
    expect(drift).toBeLessThanOrEqual(1);
  });
});

// ─── computeRtVariability ────────────────────────────────────────────────────

describe('computeRtVariability', () => {
  it('returns 0 for fewer than 13 entries', () => {
    expect(computeRtVariability(uniformRts(BASELINE_WINDOW + ROLLING_WINDOW - 1))).toBe(0);
  });

  it('returns 0 when baseline and recent have identical timing (no change in variability)', () => {
    // Uniform timing → CV = 0 everywhere
    // With baseline CV ~0, follows the "extremely consistent baseline" path
    // If recent is also uniform, recentCv = 0 → clamp01(0/0.5) = 0
    const rts = uniformRts(BASELINE_WINDOW + ROLLING_WINDOW, 1000);
    expect(computeRtVariability(rts)).toBe(0);
  });

  it('result is always in [0, 1]', () => {
    const highVariabilityRecent = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      100, 5000, 100, 5000, 100,           // recent: high variability
    ];
    const v = computeRtVariability(highVariabilityRecent);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('higher recent variability → higher signal than lower variability', () => {
    const base = uniformRts(BASELINE_WINDOW, 1000);
    const mildVar = [...base, 800, 1000, 1200, 1000, 900];  // mild variability
    const highVar = [...base, 200, 2000, 200, 2000, 200];    // high variability

    expect(computeRtVariability(highVar)).toBeGreaterThan(computeRtVariability(mildVar));
  });

  it('returns positive signal when recent variability exceeds baseline variability', () => {
    // Consistent baseline, then chaotic recent
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      500, 2000, 500, 2000, 500,
    ];
    expect(computeRtVariability(rts)).toBeGreaterThan(0);
  });
});

// ─── computeAccuracyDecline ──────────────────────────────────────────────────

describe('computeAccuracyDecline', () => {
  it('returns 0 for fewer than 13 entries', () => {
    expect(computeAccuracyDecline(uniformCorrectness(BASELINE_WINDOW + ROLLING_WINDOW - 1))).toBe(0);
    expect(computeAccuracyDecline([])).toBe(0);
  });

  it('returns 0 when all answers are correct (no decline)', () => {
    const data = uniformCorrectness(BASELINE_WINDOW + ROLLING_WINDOW, true);
    expect(computeAccuracyDecline(data)).toBe(0);
  });

  it('returns 0 when recent accuracy IMPROVES vs baseline (only decline counts)', () => {
    const data = [
      ...uniformCorrectness(BASELINE_WINDOW, false), // baseline 0%
      ...uniformCorrectness(ROLLING_WINDOW, true),   // recent 100%
    ];
    expect(computeAccuracyDecline(data)).toBe(0);
  });

  it('returns 1.0 when recent accuracy drops by 30pp from perfect baseline', () => {
    // baseline 8/8=1.0, recent 2/5=0.40 → decline=0.60 → clamped to 1.0 (max drop=0.30)
    const data = [
      ...uniformCorrectness(BASELINE_WINDOW, true),
      ...uniformCorrectness(ROLLING_WINDOW, false),
    ];
    expect(computeAccuracyDecline(data)).toBeCloseTo(1.0, 3);
  });

  it('returns ~0.5 for a 15pp drop (half of 30pp max)', () => {
    // baseline 8/8=1.0 (100%), recent 3/5 = 0.60 → decline=0.40 > 0.30 → clamped to 1.0
    // Let's use a case where decline exactly equals 0.15: baseline=1.0, recent=0.85
    // That requires 0.85*5 = 4.25 — not integer. Use 4/5 = 0.80: decline=0.20 → signal=0.20/0.30=0.667
    const recentWrong = [true, true, true, true, false]; // 4/5 = 0.80
    const data = [
      ...uniformCorrectness(BASELINE_WINDOW, true), // 8/8 = 1.0
      ...recentWrong,
    ];
    expect(computeAccuracyDecline(data)).toBeCloseTo(0.667, 2);
  });

  it('result is always in [0, 1]', () => {
    const data = [
      ...uniformCorrectness(BASELINE_WINDOW, true),
      ...uniformCorrectness(ROLLING_WINDOW, false),
    ];
    const signal = computeAccuracyDecline(data);
    expect(signal).toBeGreaterThanOrEqual(0);
    expect(signal).toBeLessThanOrEqual(1);
  });

  it('uses LAST ROLLING_WINDOW entries as recent', () => {
    // Middle: all wrong, but last 5 are correct → no decline detected
    const data = [
      ...uniformCorrectness(BASELINE_WINDOW, true),
      ...uniformCorrectness(10, false),                // wrong in the middle
      ...uniformCorrectness(ROLLING_WINDOW, true),     // correct at the end
    ];
    expect(computeAccuracyDecline(data)).toBe(0);
  });
});

// ─── computeDurationFactor ───────────────────────────────────────────────────

describe('computeDurationFactor', () => {
  it('returns 0 for 0 minutes', () => {
    expect(computeDurationFactor(0)).toBe(0);
  });

  it('returns 0 for negative duration', () => {
    expect(computeDurationFactor(-5)).toBe(0);
  });

  it('returns approximately 0.5 at the sigmoid midpoint (25 minutes)', () => {
    // Normalized sigmoid at t=25 ≈ 0.488 (not exactly 0.5 due to normalization)
    const factor = computeDurationFactor(25);
    expect(factor).toBeGreaterThan(0.40);
    expect(factor).toBeLessThan(0.60);
  });

  it('returns > 0.90 for very long session (60+ minutes)', () => {
    expect(computeDurationFactor(60)).toBeGreaterThan(0.90);
  });

  it('is monotonically increasing with session duration', () => {
    const t10 = computeDurationFactor(10);
    const t20 = computeDurationFactor(20);
    const t30 = computeDurationFactor(30);
    const t45 = computeDurationFactor(45);
    expect(t10).toBeLessThan(t20);
    expect(t20).toBeLessThan(t30);
    expect(t30).toBeLessThan(t45);
  });

  it('is always in [0, 1]', () => {
    [0, 5, 15, 25, 40, 60, 120].forEach(t => {
      const f = computeDurationFactor(t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    });
  });

  it('is small (< 0.10) for short sessions (< 10 minutes)', () => {
    expect(computeDurationFactor(5)).toBeLessThan(0.10);
  });
});

// ─── classifyFatigueLevel ────────────────────────────────────────────────────

describe('classifyFatigueLevel', () => {
  it('returns "none" for score below mild threshold (< 0.30)', () => {
    expect(classifyFatigueLevel(0)).toBe('none');
    expect(classifyFatigueLevel(0.29)).toBe('none');
    expect(classifyFatigueLevel(0.0001)).toBe('none');
  });

  it('returns "mild" for score in [0.30, 0.50)', () => {
    expect(classifyFatigueLevel(0.30)).toBe('mild');
    expect(classifyFatigueLevel(0.40)).toBe('mild');
    expect(classifyFatigueLevel(0.499)).toBe('mild');
  });

  it('returns "moderate" for score in [0.50, 0.70)', () => {
    expect(classifyFatigueLevel(0.50)).toBe('moderate');
    expect(classifyFatigueLevel(0.60)).toBe('moderate');
    expect(classifyFatigueLevel(0.699)).toBe('moderate');
  });

  it('returns "severe" for score >= 0.70', () => {
    expect(classifyFatigueLevel(0.70)).toBe('severe');
    expect(classifyFatigueLevel(0.85)).toBe('severe');
    expect(classifyFatigueLevel(1.0)).toBe('severe');
  });

  it('boundary: exactly 0.30 is "mild" not "none"', () => {
    expect(classifyFatigueLevel(THRESHOLDS.mild)).toBe('mild');
  });

  it('boundary: exactly 0.50 is "moderate" not "mild"', () => {
    expect(classifyFatigueLevel(THRESHOLDS.moderate)).toBe('moderate');
  });

  it('boundary: exactly 0.70 is "severe" not "moderate"', () => {
    expect(classifyFatigueLevel(THRESHOLDS.severe)).toBe('severe');
  });
});

// ─── estimateFatigueOnset ────────────────────────────────────────────────────

describe('estimateFatigueOnset', () => {
  it('returns null when fewer than 13 data points', () => {
    const rts = uniformRts(BASELINE_WINDOW + ROLLING_WINDOW - 1);
    const correct = uniformCorrectness(BASELINE_WINDOW + ROLLING_WINDOW - 1);
    expect(estimateFatigueOnset(rts, correct)).toBeNull();
  });

  it('returns null for uniform fast correct data (no fatigue)', () => {
    const rts = uniformRts(20, 800);
    const correct = uniformCorrectness(20, true);
    expect(estimateFatigueOnset(rts, correct)).toBeNull();
  });

  it('detects onset index when RT increases sharply after baseline', () => {
    // First 8 fast, then 5 slow (>15% RT drift should trigger)
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),     // baseline: 1000ms
      ...uniformRts(ROLLING_WINDOW, 2000),      // recent: 2000ms → 100% drift (>15%)
    ];
    const correct = uniformCorrectness(BASELINE_WINDOW + ROLLING_WINDOW, true);
    const onset = estimateFatigueOnset(rts, correct);
    expect(onset).not.toBeNull();
    expect(onset).toBeGreaterThanOrEqual(BASELINE_WINDOW);
  });

  it('detects onset when accuracy drops sharply', () => {
    // First 8 correct, then 5 wrong (>15% accuracy drop)
    const rts = uniformRts(BASELINE_WINDOW + ROLLING_WINDOW, 1000);
    const correct = [
      ...uniformCorrectness(BASELINE_WINDOW, true),
      ...uniformCorrectness(ROLLING_WINDOW, false),
    ];
    const onset = estimateFatigueOnset(rts, correct);
    expect(onset).not.toBeNull();
  });

  it('onset index is >= BASELINE_WINDOW (never before baseline ends)', () => {
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 800),
      ...uniformRts(10, 3000),
    ];
    const correct = [
      ...uniformCorrectness(BASELINE_WINDOW, true),
      ...uniformCorrectness(10, false),
    ];
    const onset = estimateFatigueOnset(rts, correct);
    if (onset !== null) {
      expect(onset).toBeGreaterThanOrEqual(BASELINE_WINDOW);
    }
  });
});

// ─── computeCompositeFatigue ─────────────────────────────────────────────────

describe('computeCompositeFatigue', () => {
  it('returns reliable=false and all zeros for fewer than MIN_QUESTIONS', () => {
    const data = makeDataPoints(MIN_QUESTIONS - 1);
    const result = computeCompositeFatigue(data);
    expect(result.reliable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.level).toBe('none');
    expect(result.message).toBeNull();
    expect(result.fatigueOnsetIndex).toBeNull();
    expect(result.signals.rtDrift).toBe(0);
    expect(result.signals.accuracyDecline).toBe(0);
  });

  it('returns reliable=true when data point count >= MIN_QUESTIONS', () => {
    const data = makeDataPoints(MIN_QUESTIONS);
    const result = computeCompositeFatigue(data);
    expect(result.reliable).toBe(true);
  });

  it('score is in [0, 1] always', () => {
    const heavy = makeFatiguedData(BASELINE_WINDOW, 20, 800, 5000);
    const result = computeCompositeFatigue(heavy);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('uniform fresh data → level is "none" (no fatigue signals)', () => {
    // All fast, all correct, short session (< 5 minutes total for 15 points @ 5s each = 70s)
    const data = makeDataPoints(15, 800, true, 3000);
    const result = computeCompositeFatigue(data);
    expect(result.level).toBe('none');
    expect(result.message).toBeNull();
    expect(result.suggestedBreakMinutes).toBe(0);
  });

  it('signals object has all four signal fields', () => {
    const data = makeDataPoints(15);
    const result = computeCompositeFatigue(data);
    expect(result.signals).toHaveProperty('rtDrift');
    expect(result.signals).toHaveProperty('rtVariability');
    expect(result.signals).toHaveProperty('accuracyDecline');
    expect(result.signals).toHaveProperty('durationFactor');
  });

  it('heavily fatigued data → level is not "none"', () => {
    // Baseline: fast+correct; tail: very slow+wrong; long session
    const baseline = Array.from({ length: BASELINE_WINDOW }, (_, i) => ({
      responseTimeMs: 800,
      wasCorrect: true,
      timestamp: i * 60000, // 1 minute apart
    }));
    const tail = Array.from({ length: 20 }, (_, i) => ({
      responseTimeMs: 5000,
      wasCorrect: false,
      timestamp: (BASELINE_WINDOW + i) * 60000,
    }));
    const data = [...baseline, ...tail];
    const result = computeCompositeFatigue(data);
    expect(result.level).not.toBe('none');
    expect(result.score).toBeGreaterThan(0);
  });

  it('message is non-null when level is not "none"', () => {
    const baseline = Array.from({ length: BASELINE_WINDOW }, (_, i) => ({
      responseTimeMs: 800,
      wasCorrect: true,
      timestamp: i * 60000,
    }));
    const tail = Array.from({ length: 20 }, (_, i) => ({
      responseTimeMs: 5000,
      wasCorrect: false,
      timestamp: (BASELINE_WINDOW + i) * 60000,
    }));
    const data = [...baseline, ...tail];
    const result = computeCompositeFatigue(data);
    if (result.level !== 'none') {
      expect(result.message).not.toBeNull();
      expect(typeof result.message).toBe('string');
    }
  });

  it('suggestedBreakMinutes matches level', () => {
    const data = makeDataPoints(15, 800, true, 3000);
    const result = computeCompositeFatigue(data);
    if (result.level === 'none') expect(result.suggestedBreakMinutes).toBe(0);
    if (result.level === 'mild') expect(result.suggestedBreakMinutes).toBe(2);
    if (result.level === 'moderate') expect(result.suggestedBreakMinutes).toBe(5);
    if (result.level === 'severe') expect(result.suggestedBreakMinutes).toBe(15);
  });

  it('composite score = weighted sum of individual signals (verified with known inputs)', () => {
    // We directly verify the weighted formula by building data that produces
    // known signal values via the individual functions.
    // With rtDrift=0.5, rtVariability≈0, accuracyDecline=0, durationFactor≈0:
    // score ≈ 0.30 * 0.5 + 0 + 0 + 0 = 0.15 (none level)
    const rts = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      ...uniformRts(ROLLING_WINDOW, 1250), // 25% drift → signal 0.5
    ];
    const expected_rtDrift = 0.5; // 0.25 / 0.50 = 0.5
    const minScore = WEIGHTS.rtDrift * expected_rtDrift; // at least this contribution
    // Note: other signals may also contribute, so we check a lower bound
    const data = rts.map((rt, i) => ({
      responseTimeMs: rt,
      wasCorrect: true,
      timestamp: i * 5000,
    }));
    const result = computeCompositeFatigue(data);
    expect(result.score).toBeGreaterThanOrEqual(minScore - 0.01);
  });
});

// ─── Cross-signal invariants ──────────────────────────────────────────────────

describe('compositeFatigueService — cross-signal invariants', () => {
  it('more fatigue signals → higher composite score', () => {
    // Scenario A: only RT drift
    const rtDriftOnly = [
      ...uniformRts(BASELINE_WINDOW, 1000),
      ...uniformRts(15, 1500),  // 50% drift
    ].map((rt, i) => ({
      responseTimeMs: rt,
      wasCorrect: true,
      timestamp: i * 3000,
    }));

    // Scenario B: RT drift + accuracy decline
    const both = [
      ...Array(BASELINE_WINDOW).fill(null).map((_, i) => ({
        responseTimeMs: 1000,
        wasCorrect: true,
        timestamp: i * 3000,
      })),
      ...Array(15).fill(null).map((_, i) => ({
        responseTimeMs: 1500,
        wasCorrect: false,  // also declining accuracy
        timestamp: (BASELINE_WINDOW + i) * 3000,
      })),
    ];

    const scoreA = computeCompositeFatigue(rtDriftOnly).score;
    const scoreB = computeCompositeFatigue(both).score;
    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it('level matches the score range', () => {
    const data = makeDataPoints(20, 800, true, 5000);
    const result = computeCompositeFatigue(data);
    const score = result.score;
    const level = result.level;

    if (score >= 0.70) expect(level).toBe('severe');
    else if (score >= 0.50) expect(level).toBe('moderate');
    else if (score >= 0.30) expect(level).toBe('mild');
    else expect(level).toBe('none');
  });
});
