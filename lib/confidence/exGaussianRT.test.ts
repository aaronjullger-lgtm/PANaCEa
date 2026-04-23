// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/confidence/exGaussianRT.ts
 *
 * Pure functions tested:
 *   fitExGaussian(rtValues)        — method-of-moments ex-Gaussian fit
 *   classifyRT(rt, params)         — automatic/normal/effortful/lapse classification
 *   exGaussianRTSignal(rt, params) — signal + quality + classification
 *
 * Constant verified:
 *   MIN_SAMPLES_FOR_FIT = 30
 *
 * Classification boundaries (for tau >= 100, uses ex-Gaussian thresholds):
 *   automatic:  rt < mu
 *   normal:     mu <= rt <= mu + sigma
 *   effortful:  mu + sigma < rt <= mu + sigma + 2*tau
 *   lapse:      rt > mu + sigma + 2*tau
 *
 * For tau < 100 (near-Gaussian), uses Gaussian thresholds:
 *   automatic:  rt < mu - sigma
 *   normal:     mu - sigma <= rt <= mu + sigma
 *   effortful:  mu + sigma < rt <= mu + 2*sigma
 *   lapse:      rt > mu + 2*sigma
 */

import { describe, it, expect } from 'vitest';
import {
  fitExGaussian,
  classifyRT,
  exGaussianRTSignal,
  MIN_SAMPLES_FOR_FIT,
  type ExGaussianParams,
} from './exGaussianRT';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate right-skewed RT data simulating a real PA student.
 * Base: ~30s with a 10s std dev and a long tail (lapse events).
 */
function generateRightSkewedRTs(n: number): number[] {
  const rts: number[] = [];
  for (let i = 0; i < n; i++) {
    const base = 30000 + (Math.random() - 0.5) * 20000; // 20-40s range
    const lapseProbability = Math.random();
    const rt = lapseProbability < 0.15 ? base + Math.random() * 60000 : base; // 15% lapse
    rts.push(Math.max(1000, rt)); // min 1s
  }
  return rts;
}

/** Simple params for deterministic classification tests */
const SIMPLE_PARAMS: ExGaussianParams = {
  mu: 20000,   // 20s base
  sigma: 5000, // 5s std dev
  tau: 10000,  // 10s exponential tail
  n: 50,
};

// ─── MIN_SAMPLES_FOR_FIT ─────────────────────────────────────────────────────

describe('MIN_SAMPLES_FOR_FIT', () => {
  it('is 30', () => {
    expect(MIN_SAMPLES_FOR_FIT).toBe(30);
  });
});

// ─── fitExGaussian ────────────────────────────────────────────────────────────

describe('fitExGaussian', () => {
  it('returns null for fewer than 30 samples', () => {
    expect(fitExGaussian([])).toBeNull();
    expect(fitExGaussian([30000, 25000, 35000])).toBeNull();
    expect(fitExGaussian(Array(29).fill(30000))).toBeNull();
  });

  it('returns params object with n = rtValues.length for sufficient data', () => {
    const rts = generateRightSkewedRTs(50);
    const params = fitExGaussian(rts);
    expect(params).not.toBeNull();
    expect(params!.n).toBe(50);
  });

  it('returns null for degenerate data (all same value)', () => {
    const rts = Array(50).fill(30000);
    // stdDev = 0 → degenerate
    expect(fitExGaussian(rts)).toBeNull();
  });

  it('mu, sigma are positive for valid data', () => {
    const rts = generateRightSkewedRTs(50);
    const params = fitExGaussian(rts);
    if (params) {
      expect(params.mu).toBeGreaterThan(0);
      expect(params.sigma).toBeGreaterThan(0);
      expect(params.tau).toBeGreaterThanOrEqual(0);
    }
  });

  it('n in params matches input length', () => {
    const rts = generateRightSkewedRTs(100);
    const params = fitExGaussian(rts);
    expect(params?.n).toBe(100);
  });

  it('for symmetric data (skewness ≈ 0), falls back to Gaussian (tau ≈ 0)', () => {
    // Generate roughly symmetric data centered at 30s
    const rts: number[] = [];
    for (let i = 0; i < 60; i++) {
      rts.push(30000 + (i % 2 === 0 ? 1 : -1) * i * 200);
    }
    const params = fitExGaussian(rts);
    if (params) {
      expect(params.tau).toBe(0);
    }
  });
});

// ─── classifyRT ───────────────────────────────────────────────────────────────

describe('classifyRT', () => {
  // Using SIMPLE_PARAMS: mu=20000, sigma=5000, tau=10000 (tau >= 100 → ex-Gaussian thresholds)
  // automatic:  rt < 20000
  // normal:     20000 <= rt <= 25000
  // effortful:  25000 < rt <= 45000  (25000 + 2*10000)
  // lapse:      rt > 45000

  it('rt < mu → automatic', () => {
    const result = classifyRT(15000, SIMPLE_PARAMS);
    expect(result.classification).toBe('automatic');
  });

  it('rt == mu → normal', () => {
    const result = classifyRT(20000, SIMPLE_PARAMS);
    expect(result.classification).toBe('normal');
  });

  it('rt == mu + sigma → normal', () => {
    const result = classifyRT(25000, SIMPLE_PARAMS);
    expect(result.classification).toBe('normal');
  });

  it('rt just above mu + sigma → effortful', () => {
    const result = classifyRT(25001, SIMPLE_PARAMS);
    expect(result.classification).toBe('effortful');
  });

  it('rt == mu + sigma + 2*tau → effortful', () => {
    // 20000 + 5000 + 2*10000 = 45000
    const result = classifyRT(45000, SIMPLE_PARAMS);
    expect(result.classification).toBe('effortful');
  });

  it('rt > mu + sigma + 2*tau → lapse', () => {
    const result = classifyRT(50000, SIMPLE_PARAMS);
    expect(result.classification).toBe('lapse');
  });

  it('returns signalQuality=1.0 for automatic', () => {
    const result = classifyRT(10000, SIMPLE_PARAMS);
    expect(result.signalQuality).toBe(1.0);
  });

  it('returns signalQuality=1.0 for normal', () => {
    const result = classifyRT(22000, SIMPLE_PARAMS);
    expect(result.signalQuality).toBe(1.0);
  });

  it('returns signalQuality=0.9 for effortful', () => {
    const result = classifyRT(35000, SIMPLE_PARAMS);
    expect(result.signalQuality).toBe(0.9);
  });

  it('returns signalQuality=0.6 for lapse', () => {
    const result = classifyRT(60000, SIMPLE_PARAMS);
    expect(result.signalQuality).toBe(0.6);
  });

  it('rtSignal is in [0, 1]', () => {
    const rts = [1000, 10000, 20000, 30000, 50000, 100000];
    for (const rt of rts) {
      const result = classifyRT(rt, SIMPLE_PARAMS);
      expect(result.rtSignal).toBeGreaterThanOrEqual(0);
      expect(result.rtSignal).toBeLessThanOrEqual(1);
    }
  });

  it('faster RT → higher rtSignal (inverse relationship)', () => {
    const fast = classifyRT(10000, SIMPLE_PARAMS);
    const slow = classifyRT(50000, SIMPLE_PARAMS);
    expect(fast.rtSignal).toBeGreaterThan(slow.rtSignal);
  });

  it('returns exGaussianZScore and rtSignal as numbers', () => {
    const result = classifyRT(25000, SIMPLE_PARAMS);
    expect(typeof result.exGaussianZScore).toBe('number');
    expect(typeof result.rtSignal).toBe('number');
  });

  it('near-Gaussian params (tau < 100) use simpler classification', () => {
    const gaussianParams: ExGaussianParams = { mu: 20000, sigma: 5000, tau: 0, n: 50 };
    // automatic: rt < mu - sigma = 15000
    expect(classifyRT(12000, gaussianParams).classification).toBe('automatic');
    // normal: rt in [15000, 25000]
    expect(classifyRT(20000, gaussianParams).classification).toBe('normal');
    // effortful: rt in (25000, 30000] (mu + 2*sigma = 30000)
    expect(classifyRT(27000, gaussianParams).classification).toBe('effortful');
    // lapse: rt > 30000
    expect(classifyRT(35000, gaussianParams).classification).toBe('lapse');
  });
});

// ─── exGaussianRTSignal ───────────────────────────────────────────────────────

describe('exGaussianRTSignal', () => {
  it('returns signal, quality, and classification', () => {
    const result = exGaussianRTSignal(25000, SIMPLE_PARAMS);
    expect(typeof result.signal).toBe('number');
    expect(typeof result.quality).toBe('number');
    expect(typeof result.classification).toBe('string');
  });

  it('signal matches rtSignal from classifyRT', () => {
    const classify = classifyRT(22000, SIMPLE_PARAMS);
    const signal = exGaussianRTSignal(22000, SIMPLE_PARAMS);
    expect(signal.signal).toBe(classify.rtSignal);
  });

  it('quality matches signalQuality from classifyRT', () => {
    const classify = classifyRT(60000, SIMPLE_PARAMS);
    const signal = exGaussianRTSignal(60000, SIMPLE_PARAMS);
    expect(signal.quality).toBe(classify.signalQuality);
  });

  it('classification matches classifyRT output', () => {
    const rt = 12000;
    expect(exGaussianRTSignal(rt, SIMPLE_PARAMS).classification).toBe(
      classifyRT(rt, SIMPLE_PARAMS).classification
    );
  });

  it('lapse RT returns quality < 1', () => {
    const result = exGaussianRTSignal(100000, SIMPLE_PARAMS);
    expect(result.quality).toBeLessThan(1.0);
    expect(result.classification).toBe('lapse');
  });

  it('fast RT returns signal close to 1', () => {
    const result = exGaussianRTSignal(5000, SIMPLE_PARAMS);
    expect(result.signal).toBeGreaterThan(0.8);
  });
});
