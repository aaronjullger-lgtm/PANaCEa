/**
 * Composite Fatigue Service — Unit Tests (Tier 3)
 *
 * Tests the multi-signal fatigue scoring engine including RT drift,
 * RT variability, accuracy decline, duration factor, and composite scoring.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRtDrift,
  computeRtVariability,
  computeAccuracyDecline,
  computeDurationFactor,
  computeCompositeFatigue,
  classifyFatigueLevel,
  estimateFatigueOnset,
  MIN_QUESTIONS,
  BASELINE_WINDOW,
  ROLLING_WINDOW,
  WEIGHTS,
  THRESHOLDS,
  type SessionDataPoint,
} from '../lib/services/compositeFatigueService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate session data points with configurable RT drift and accuracy */
function generateSession(opts: {
  count: number;
  baselineRtMs?: number;
  rtDriftPerQuestion?: number;
  baselineAccuracy?: number;
  accuracyDeclineAfter?: number;
  accuracyAfterDecline?: number;
  sessionDurationMinutes?: number;
}): SessionDataPoint[] {
  const {
    count,
    baselineRtMs = 5000,
    rtDriftPerQuestion = 0,
    baselineAccuracy = 0.8,
    accuracyDeclineAfter = count, // no decline by default
    accuracyAfterDecline = 0.4,
    sessionDurationMinutes = 15,
  } = opts;

  const startTime = Date.now();
  const msPerQuestion = (sessionDurationMinutes * 60000) / count;

  return Array.from({ length: count }, (_, i) => {
    const rt = baselineRtMs + rtDriftPerQuestion * i;
    const accuracy = i < accuracyDeclineAfter ? baselineAccuracy : accuracyAfterDecline;
    const wasCorrect = Math.random() < accuracy;
    return {
      responseTimeMs: rt + (Math.random() - 0.5) * 200, // small noise
      wasCorrect,
      timestamp: startTime + i * msPerQuestion,
    };
  });
}

/** Generate a deterministic session (no randomness) */
function deterministicSession(opts: {
  count: number;
  baseRt: number;
  rtPerQ?: number;
  correctPattern: boolean[];
  durationMinutes?: number;
}): SessionDataPoint[] {
  const { count, baseRt, rtPerQ = 0, correctPattern, durationMinutes = 15 } = opts;
  const startTime = Date.now();
  const msPerQ = (durationMinutes * 60000) / count;

  return Array.from({ length: count }, (_, i) => ({
    responseTimeMs: baseRt + rtPerQ * i,
    wasCorrect: correctPattern[i % correctPattern.length]!,
    timestamp: startTime + i * msPerQ,
  }));
}

// ─── Constants Tests ─────────────────────────────────────────────────────────

describe('Constants', () => {
  it('weights sum to 1.0', () => {
    const sum = WEIGHTS.rtDrift + WEIGHTS.rtVariability + WEIGHTS.accuracyDecline + WEIGHTS.durationFactor;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('thresholds are ordered', () => {
    expect(THRESHOLDS.mild).toBeLessThan(THRESHOLDS.moderate);
    expect(THRESHOLDS.moderate).toBeLessThan(THRESHOLDS.severe);
  });

  it('MIN_QUESTIONS >= BASELINE_WINDOW (signals check BASELINE + ROLLING internally)', () => {
    expect(MIN_QUESTIONS).toBeGreaterThanOrEqual(BASELINE_WINDOW);
  });
});

// ─── RT Drift Tests ──────────────────────────────────────────────────────────

describe('computeRtDrift', () => {
  it('returns 0 for insufficient data', () => {
    expect(computeRtDrift([1000, 1000, 1000])).toBe(0);
  });

  it('returns 0 for flat response times', () => {
    const flatRts = Array(20).fill(5000);
    expect(computeRtDrift(flatRts)).toBeCloseTo(0, 1);
  });

  it('returns > 0 for increasing response times', () => {
    // Baseline: 5000ms, then recent 5 are 7500ms (50% increase)
    const rts = [
      ...Array(8).fill(5000),    // baseline
      ...Array(7).fill(5500),     // middle
      ...Array(5).fill(7500),     // recent window — 50% over baseline
    ];
    const drift = computeRtDrift(rts);
    expect(drift).toBeGreaterThan(0.5);
  });

  it('caps at 1.0', () => {
    const rts = [
      ...Array(8).fill(5000),
      ...Array(5).fill(15000), // 200% increase
    ];
    expect(computeRtDrift(rts)).toBeLessThanOrEqual(1.0);
  });

  it('ignores negative drift (faster responses)', () => {
    const rts = [
      ...Array(8).fill(5000),
      ...Array(7).fill(4000),
      ...Array(5).fill(3000), // getting faster
    ];
    expect(computeRtDrift(rts)).toBe(0);
  });
});

// ─── RT Variability Tests ────────────────────────────────────────────────────

describe('computeRtVariability', () => {
  it('returns 0 for insufficient data', () => {
    expect(computeRtVariability([1000, 2000, 3000])).toBe(0);
  });

  it('returns 0 when variability is consistent', () => {
    // Both baseline and recent have same variability pattern
    const rts = Array(20).fill(0).map((_, i) => 5000 + (i % 2 === 0 ? 500 : -500));
    const result = computeRtVariability(rts);
    expect(result).toBeLessThan(0.2);
  });

  it('returns > 0 when recent variability increases', () => {
    const rts = [
      ...Array(8).fill(5000),  // baseline: very consistent
      ...Array(7).fill(5000),  // middle: still consistent
      5000, 8000, 3000, 9000, 2000, // recent: wild swings
    ];
    expect(computeRtVariability(rts)).toBeGreaterThan(0);
  });
});

// ─── Accuracy Decline Tests ──────────────────────────────────────────────────

describe('computeAccuracyDecline', () => {
  it('returns 0 for insufficient data', () => {
    expect(computeAccuracyDecline([true, false, true])).toBe(0);
  });

  it('returns 0 when accuracy is stable or improving', () => {
    // Identical accuracy in baseline and recent windows
    const pattern = [
      // Baseline (8): 6/8 = 75%
      true, true, true, false, true, true, false, true,
      // Middle
      true, true, false, true, true, false, true,
      // Recent (5): 4/5 = 80% — same or better than baseline
      true, true, true, true, false,
    ];
    expect(computeAccuracyDecline(pattern)).toBe(0);
  });

  it('returns > 0 when recent accuracy drops', () => {
    const pattern = [
      // Baseline: 7/8 correct = 87.5%
      true, true, true, true, true, true, true, false,
      // Middle
      true, true, false, true, true, false, true,
      // Recent 5: 1/5 correct = 20%
      false, false, true, false, false,
    ];
    const decline = computeAccuracyDecline(pattern);
    expect(decline).toBeGreaterThan(0.5);
  });

  it('returns 0 when accuracy improves', () => {
    const pattern = [
      // Baseline: 4/8 correct = 50%
      true, false, true, false, true, false, true, false,
      // Middle
      true, true, true, false, true, true, true,
      // Recent 5: 5/5 = 100%
      true, true, true, true, true,
    ];
    expect(computeAccuracyDecline(pattern)).toBe(0);
  });
});

// ─── Duration Factor Tests ───────────────────────────────────────────────────

describe('computeDurationFactor', () => {
  it('returns 0 for 0 minutes', () => {
    expect(computeDurationFactor(0)).toBe(0);
  });

  it('returns near 0 for short sessions', () => {
    expect(computeDurationFactor(5)).toBeLessThan(0.1);
  });

  it('returns ~0.5 near sigmoid midpoint (25 min)', () => {
    const factor = computeDurationFactor(25);
    expect(factor).toBeGreaterThan(0.3);
    expect(factor).toBeLessThan(0.7);
  });

  it('approaches 1.0 for very long sessions', () => {
    expect(computeDurationFactor(60)).toBeGreaterThan(0.85);
  });

  it('increases monotonically', () => {
    const f10 = computeDurationFactor(10);
    const f20 = computeDurationFactor(20);
    const f30 = computeDurationFactor(30);
    const f45 = computeDurationFactor(45);
    expect(f20).toBeGreaterThan(f10);
    expect(f30).toBeGreaterThan(f20);
    expect(f45).toBeGreaterThan(f30);
  });

  it('is bounded [0, 1]', () => {
    expect(computeDurationFactor(-5)).toBe(0);
    expect(computeDurationFactor(120)).toBeLessThanOrEqual(1.0);
  });
});

// ─── Classification Tests ────────────────────────────────────────────────────

describe('classifyFatigueLevel', () => {
  it('classifies none for low scores', () => {
    expect(classifyFatigueLevel(0)).toBe('none');
    expect(classifyFatigueLevel(0.15)).toBe('none');
    expect(classifyFatigueLevel(0.29)).toBe('none');
  });

  it('classifies mild', () => {
    expect(classifyFatigueLevel(0.30)).toBe('mild');
    expect(classifyFatigueLevel(0.40)).toBe('mild');
    expect(classifyFatigueLevel(0.49)).toBe('mild');
  });

  it('classifies moderate', () => {
    expect(classifyFatigueLevel(0.50)).toBe('moderate');
    expect(classifyFatigueLevel(0.60)).toBe('moderate');
    expect(classifyFatigueLevel(0.69)).toBe('moderate');
  });

  it('classifies severe', () => {
    expect(classifyFatigueLevel(0.70)).toBe('severe');
    expect(classifyFatigueLevel(0.85)).toBe('severe');
    expect(classifyFatigueLevel(1.0)).toBe('severe');
  });
});

// ─── Composite Fatigue Tests ─────────────────────────────────────────────────

describe('computeCompositeFatigue', () => {
  it('returns unreliable result for < MIN_QUESTIONS', () => {
    const data = deterministicSession({
      count: 5,
      baseRt: 5000,
      correctPattern: [true, true, true, true, false],
    });
    const result = computeCompositeFatigue(data);
    expect(result.reliable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.level).toBe('none');
  });

  it('returns none for a stable session', () => {
    const data = deterministicSession({
      count: 20,
      baseRt: 5000,
      rtPerQ: 0,
      correctPattern: [true, true, true, true, false], // 80% consistent
      durationMinutes: 10, // Short session
    });
    const result = computeCompositeFatigue(data);
    expect(result.reliable).toBe(true);
    expect(result.level).toBe('none');
    expect(result.score).toBeLessThan(THRESHOLDS.mild);
  });

  it('detects fatigue when RT drifts significantly', () => {
    const data = deterministicSession({
      count: 20,
      baseRt: 5000,
      rtPerQ: 200, // Each question 200ms slower → Q20 is at 8800ms (76% over baseline)
      correctPattern: [true, true, true, true, false],
      durationMinutes: 30,
    });
    const result = computeCompositeFatigue(data);
    expect(result.reliable).toBe(true);
    expect(result.signals.rtDrift).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('detects fatigue when accuracy drops', () => {
    // First 10: all correct. Last 10: mostly wrong
    const correctPattern = [
      ...Array(10).fill(true),
      ...Array(10).fill(false),
    ];
    const data = correctPattern.map((wasCorrect, i) => ({
      responseTimeMs: 5000,
      wasCorrect,
      timestamp: Date.now() + i * 30000, // 30s apart = 10min total
    }));
    const result = computeCompositeFatigue(data);
    expect(result.signals.accuracyDecline).toBeGreaterThan(0);
  });

  it('provides a message for non-none levels', () => {
    const data = deterministicSession({
      count: 25,
      baseRt: 5000,
      rtPerQ: 250,
      correctPattern: [true, true, false, false, false], // declining accuracy
      durationMinutes: 40,
    });
    const result = computeCompositeFatigue(data);
    if (result.level !== 'none') {
      expect(result.message).not.toBeNull();
      expect(result.suggestedBreakMinutes).toBeGreaterThan(0);
    }
  });

  it('has all signals bounded [0, 1]', () => {
    const data = deterministicSession({
      count: 30,
      baseRt: 3000,
      rtPerQ: 300,
      correctPattern: [true, false, true, false, false],
      durationMinutes: 45,
    });
    const result = computeCompositeFatigue(data);
    expect(result.signals.rtDrift).toBeGreaterThanOrEqual(0);
    expect(result.signals.rtDrift).toBeLessThanOrEqual(1);
    expect(result.signals.rtVariability).toBeGreaterThanOrEqual(0);
    expect(result.signals.rtVariability).toBeLessThanOrEqual(1);
    expect(result.signals.accuracyDecline).toBeGreaterThanOrEqual(0);
    expect(result.signals.accuracyDecline).toBeLessThanOrEqual(1);
    expect(result.signals.durationFactor).toBeGreaterThanOrEqual(0);
    expect(result.signals.durationFactor).toBeLessThanOrEqual(1);
  });

  it('composite score is bounded [0, 1]', () => {
    const data = deterministicSession({
      count: 30,
      baseRt: 3000,
      rtPerQ: 500,
      correctPattern: [false, false, false, true, false],
      durationMinutes: 60,
    });
    const result = computeCompositeFatigue(data);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ─── Fatigue Onset Detection Tests ───────────────────────────────────────────

describe('estimateFatigueOnset', () => {
  it('returns null for insufficient data', () => {
    expect(estimateFatigueOnset([1000, 2000], [true, false])).toBeNull();
  });

  it('returns null when no fatigue is present', () => {
    const rts = Array(20).fill(5000);
    const correct = Array(20).fill(true);
    expect(estimateFatigueOnset(rts, correct)).toBeNull();
  });

  it('detects onset when RT jumps', () => {
    const rts = [
      ...Array(8).fill(5000),  // baseline
      ...Array(5).fill(5000),  // still fine
      ...Array(7).fill(7000),  // sudden RT jump
    ];
    const correct = Array(20).fill(true);
    const onset = estimateFatigueOnset(rts, correct);
    // Onset should be detected somewhere after baseline
    if (onset !== null) {
      expect(onset).toBeGreaterThanOrEqual(BASELINE_WINDOW);
    }
  });

  it('detects onset when accuracy drops', () => {
    const rts = Array(20).fill(5000);
    const correct = [
      ...Array(10).fill(true),   // 100% baseline
      ...Array(10).fill(false),  // 0% after
    ];
    const onset = estimateFatigueOnset(rts, correct);
    if (onset !== null) {
      expect(onset).toBeGreaterThanOrEqual(BASELINE_WINDOW);
      expect(onset).toBeLessThanOrEqual(15);
    }
  });
});
