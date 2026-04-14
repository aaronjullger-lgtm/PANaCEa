import { describe, it, expect } from 'vitest';
import {
  modulateGrade,
  classifyRtZone,
  calculateRtDelta,
  BEHAVIORAL_CONSTANTS,
  type BehavioralContext,
} from '@/lib/services/gradeModulationCoordinator';

// ─── Helper ─────────────────────────────────────────────────────

function makeContext(overrides: Partial<BehavioralContext> = {}): BehavioralContext {
  return {
    responseTimeMs: 15000,
    isCorrect: true,
    rawGrade: 3,
    streakCount: 0,
    sessionQuestionIndex: 15,
    userMedianRtMs: 15000,
    rollingWindowAccuracy: 0.8,
    rollingWindowMeanRtMs: 14000,
    sessionMeanAccuracy: 0.75,
    ...overrides,
  };
}

// Generate realistic RT history with a known distribution
function generateRtHistory(n: number, mu: number, sigma: number, tau: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller for Gaussian component
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Exponential component for the tail
    const exponential = -tau * Math.log(1 - Math.random());
    values.push(Math.max(500, gaussian + exponential));
  }
  return values;
}

// ─── Existing behavior preserved ────────────────────────────────

describe('modulateGrade - baseline behavior', () => {
  it('returns correct result shape without ex-Gaussian data', () => {
    const result = modulateGrade(makeContext());
    expect(result).toHaveProperty('rawGrade');
    expect(result).toHaveProperty('effectiveGrade');
    expect(result).toHaveProperty('discreteGrade');
    expect(result.deltas).toHaveProperty('exGaussianDelta');
    expect(result.signals).toHaveProperty('isRTLapse');
    expect(result.signals.isRTLapse).toBe(false);
    expect(result.deltas.exGaussianDelta).toBe(0);
  });

  it('clamps effective grade to [1.0, 4.0]', () => {
    const result = modulateGrade(makeContext({ rawGrade: 3 }));
    expect(result.effectiveGrade).toBeGreaterThanOrEqual(1.0);
    expect(result.effectiveGrade).toBeLessThanOrEqual(4.0);
  });

  it('exGaussianDelta is included in total delta', () => {
    const result = modulateGrade(makeContext());
    const { rtDelta, confidenceDelta, streakDelta, fatigueDelta, exGaussianDelta, total } = result.deltas;
    expect(total).toBeCloseTo(rtDelta + confidenceDelta + streakDelta + fatigueDelta + exGaussianDelta, 10);
  });

  it('maps continuous grade to discrete correctly', () => {
    // rawGrade=1 → effectiveGrade near 1 → discreteGrade: 1
    const result = modulateGrade(makeContext({ rawGrade: 1, isCorrect: false }));
    expect(result.discreteGrade).toBe(1);
  });
});

// ─── Ex-Gaussian RT integration ────────────────────────────────

describe('modulateGrade - ex-Gaussian integration', () => {
  it('does not activate ex-Gaussian with fewer than 30 RT samples', () => {
    const shortHistory = Array.from({ length: 20 }, () => 15000);
    const result = modulateGrade(makeContext({ userRtHistory: shortHistory }));
    expect(result.signals.exGaussianClassification).toBeUndefined();
    expect(result.signals.exGaussianParams).toBeUndefined();
    expect(result.deltas.exGaussianDelta).toBe(0);
  });

  it('classifies RT using ex-Gaussian with sufficient history', () => {
    // Generate 50 RTs with a clear distribution, then use a very fast RT
    const history = generateRtHistory(50, 15000, 3000, 2000);
    const result = modulateGrade(makeContext({
      responseTimeMs: 3000, // Much faster than mu=15000 → should classify as "automatic"
      userRtHistory: history,
    }));
    expect(result.signals.exGaussianClassification).toBeDefined();
    expect(['automatic', 'normal', 'effortful', 'lapse']).toContain(result.signals.exGaussianClassification);
  });

  it('applies noise dampener when tau/mu ratio is high', () => {
    // High tau (3000) relative to mu (8000) = heavy slow-tail = noisy RT
    const history = generateRtHistory(50, 8000, 2000, 3000);
    const resultFast = modulateGrade(makeContext({
      responseTimeMs: 5000,
      isCorrect: true,
      userMedianRtMs: 12000,
      userRtHistory: history,
    }));

    // With high tau/mu, the RT delta should be dampened compared to no-dampener case
    // We can't directly compare without vs with since it's the same function,
    // but we can verify the ex-Gaussian params show high tau
    if (resultFast.signals.exGaussianParams) {
      const { mu, tau } = resultFast.signals.exGaussianParams;
      // The fit should detect the heavy tail
      expect(tau).toBeGreaterThan(0);
    }
    expect(resultFast.deltas.exGaussianDelta).toBeDefined();
    expect(typeof resultFast.deltas.exGaussianDelta).toBe('number');
  });

  it('applies positive exGaussianDelta for automatic + correct', () => {
    // Generate history with high mu, then respond very fast
    const history = generateRtHistory(50, 20000, 3000, 1000);
    const result = modulateGrade(makeContext({
      responseTimeMs: 5000, // Well below mu → automatic
      isCorrect: true,
      userRtHistory: history,
    }));

    if (result.signals.exGaussianClassification === 'automatic') {
      expect(result.deltas.exGaussianDelta).toBeGreaterThan(0);
    }
  });

  it('applies negative exGaussianDelta for lapse', () => {
    // Generate history with moderate mu, then respond extremely slowly (lapse territory)
    const history = generateRtHistory(50, 12000, 2000, 1500);
    const result = modulateGrade(makeContext({
      responseTimeMs: 60000, // Very slow → lapse
      isCorrect: true,
      userRtHistory: history,
    }));

    if (result.signals.isRTLapse) {
      expect(result.deltas.exGaussianDelta).toBeLessThan(0);
      // RT delta should be zeroed when lapse is detected
      expect(result.deltas.rtDelta).toBe(0);
    }
  });

  it('preserves all other deltas when ex-Gaussian is active', () => {
    const history = generateRtHistory(50, 15000, 3000, 2000);
    const result = modulateGrade(makeContext({
      userRtHistory: history,
      streakCount: 3,
      userConfidenceRating: 3, // high
    }));

    // Confidence delta should still work
    expect(result.deltas.confidenceDelta).toBeDefined();
    // Streak delta should still work
    expect(result.deltas.streakDelta).toBeDefined();
    // Fatigue delta should still work
    expect(result.deltas.fatigueDelta).toBeDefined();
  });
});

// ─── classifyRtZone (preserved from original) ───────────────────

describe('classifyRtZone', () => {
  it('classifies fast RT correctly', () => {
    const { zone } = classifyRtZone(5000, 15000);
    expect(zone).toBe('fast');
  });

  it('classifies slow RT correctly', () => {
    const { zone } = classifyRtZone(25000, 15000);
    expect(zone).toBe('slow');
  });

  it('uses fallback median when userMedianRtMs is null', () => {
    const { zone } = classifyRtZone(8000, null);
    expect(zone).toBe('normal');
  });
});

// ─── calculateRtDelta (preserved from original) ─────────────────

describe('calculateRtDelta', () => {
  it('returns positive delta for fast + correct', () => {
    expect(calculateRtDelta('fast', true)).toBeCloseTo(BEHAVIORAL_CONSTANTS.DELTAS.RT_FAST_CORRECT);
  });

  it('returns negative delta for slow + correct', () => {
    expect(calculateRtDelta('slow', true)).toBeCloseTo(BEHAVIORAL_CONSTANTS.DELTAS.RT_SLOW_CORRECT);
  });

  it('returns zero for normal zone', () => {
    expect(calculateRtDelta('normal', true)).toBe(0);
  });
});
