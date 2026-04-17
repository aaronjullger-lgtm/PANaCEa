/**
 * Tests for lib/confidence/exGaussianRT.ts
 */

import { describe, it, expect } from 'vitest';
import {
  fitExGaussian,
  classifyRT,
  exGaussianRTSignal,
  MIN_SAMPLES_FOR_FIT,
  type ExGaussianParams,
} from '@/lib/confidence/exGaussianRT';

// Generate right-skewed RT data with known parameters
function generateExGaussianData(
  n: number,
  mu: number,
  sigma: number,
  tau: number,
): number[] {
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const gaussian = mu + sigma * randn();
    const exponential = tau * (-Math.log(1 - Math.random()));
    values.push(Math.max(100, gaussian + exponential));
  }
  return values;
}

// Box-Muller transform for normal random numbers
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

describe('fitExGaussian', () => {
  it('returns null for fewer than MIN_SAMPLES_FOR_FIT', () => {
    expect(fitExGaussian(Array.from({ length: 10 }, () => 2000))).toBeNull();
    expect(fitExGaussian([])).toBeNull();
  });

  it('returns null for degenerate data (all same value)', () => {
    expect(fitExGaussian(Array.from({ length: 50 }, () => 2000))).toBeNull();
  });

  it('returns params for valid right-skewed data', () => {
    const data = generateExGaussianData(100, 2000, 300, 500);
    const result = fitExGaussian(data);
    expect(result).not.toBeNull();
    expect(result!.mu).toBeGreaterThan(0);
    expect(result!.sigma).toBeGreaterThan(0);
    expect(result!.n).toBe(100);
  });

  it('returns small tau for symmetric (Gaussian) data', () => {
    // Use a seeded-like approach: sum of uniform approaches Gaussian
    const data = Array.from({ length: 100 }, () => {
      // Central limit: 6 uniform draws → approximately Gaussian
      let sum = 0;
      for (let i = 0; i < 6; i++) sum += Math.random();
      return 2000 + (sum / 6 - 0.5) * 400;
    });
    const result = fitExGaussian(data);
    expect(result).not.toBeNull();
    // Symmetric data → tau should be 0 or very small (near-Gaussian fallback)
    expect(result!.tau).toBeLessThanOrEqual(50);
  });

  it('returns fallback params for near-degenerate fit', () => {
    const data = Array.from({ length: 50 }, () => 2000 + Math.random() * 0.1);
    const result = fitExGaussian(data);
    // Should be null (stdDev < 1 after trimming) or fallback
    expect(result === null || result.mu > 0).toBe(true);
  });
});

describe('classifyRT', () => {
  const params: ExGaussianParams = { mu: 2000, sigma: 300, tau: 500, n: 100 };

  it('classifies fast RT as automatic', () => {
    const result = classifyRT(1500, params);
    expect(result.classification).toBe('automatic');
    expect(result.signalQuality).toBe(1.0);
  });

  it('classifies normal-range RT as normal', () => {
    const result = classifyRT(2200, params);
    expect(result.classification).toBe('normal');
    expect(result.signalQuality).toBe(1.0);
  });

  it('classifies slow RT as effortful', () => {
    const result = classifyRT(3000, params);
    expect(result.classification).toBe('effortful');
    expect(result.signalQuality).toBe(0.9);
  });

  it('classifies very slow RT as lapse', () => {
    const result = classifyRT(5000, params);
    expect(result.classification).toBe('lapse');
    expect(result.signalQuality).toBe(0.6);
  });

  it('rtSignal is in [0, 1]', () => {
    const testRTs = [500, 1500, 2000, 2500, 3000, 5000, 10000];
    for (const rt of testRTs) {
      const result = classifyRT(rt, params);
      expect(result.rtSignal).toBeGreaterThanOrEqual(0);
      expect(result.rtSignal).toBeLessThanOrEqual(1);
    }
  });

  it('faster RTs produce higher rtSignal', () => {
    const fast = classifyRT(1000, params);
    const slow = classifyRT(5000, params);
    expect(fast.rtSignal).toBeGreaterThan(slow.rtSignal);
  });

  it('uses simplified classification when tau < 100', () => {
    const noTailParams: ExGaussianParams = { mu: 2000, sigma: 300, tau: 0, n: 100 };
    const below = classifyRT(1600, noTailParams);
    expect(below.classification).toBe('automatic');

    const normal = classifyRT(2100, noTailParams);
    expect(normal.classification).toBe('normal');

    const lapse = classifyRT(3000, noTailParams);
    expect(lapse.classification).toBe('lapse');
  });
});

describe('exGaussianRTSignal', () => {
  it('returns signal, quality, and classification', () => {
    const params: ExGaussianParams = { mu: 2000, sigma: 300, tau: 500, n: 100 };
    const result = exGaussianRTSignal(2500, params);
    expect(result.signal).toBeGreaterThanOrEqual(0);
    expect(result.signal).toBeLessThanOrEqual(1);
    expect(result.quality).toBeGreaterThanOrEqual(0);
    expect(result.quality).toBeLessThanOrEqual(1);
    expect(['automatic', 'normal', 'effortful', 'lapse']).toContain(result.classification);
  });

  it('lapse classification has reduced quality', () => {
    const params: ExGaussianParams = { mu: 2000, sigma: 300, tau: 500, n: 100 };
    const normal = exGaussianRTSignal(2000, params);
    const lapse = exGaussianRTSignal(6000, params);
    expect(lapse.quality).toBeLessThan(normal.quality);
  });
});
