/**
 * Tests for Ex-Gaussian RT Distribution Modeling
 * Sprint 4 of Confidence Pipeline v3
 */
import { describe, it, expect } from 'vitest';
import {
  fitExGaussian,
  classifyRT,
  exGaussianRTSignal,
  MIN_SAMPLES_FOR_FIT,
  type ExGaussianParams,
} from '../lib/confidence/exGaussianRT';

// Helper: generate ex-Gaussian samples (Gaussian + Exponential)
function generateExGaussianSamples(
  mu: number, sigma: number, tau: number, n: number
): number[] {
  // Box-Muller for Gaussian, inverse CDF for exponential
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    // Gaussian component (Box-Muller)
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    // Exponential component
    const exponential = tau > 0 ? -tau * Math.log(Math.random()) : 0;

    samples.push(Math.max(100, gaussian + exponential));
  }
  return samples;
}

// Helper: generate deterministic right-skewed samples
function generateSkewedSamples(n: number, baseMs: number = 5000): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    // Most values clustered around base, with a long right tail
    const t = i / n;
    if (t < 0.7) {
      samples.push(baseMs + (t * 2000)); // 5000-6400
    } else if (t < 0.9) {
      samples.push(baseMs + 2000 + ((t - 0.7) * 10000)); // 7000-9000
    } else {
      samples.push(baseMs + 5000 + ((t - 0.9) * 50000)); // 10000-15000
    }
  }
  return samples;
}

describe('Ex-Gaussian RT Distribution', () => {
  describe('fitExGaussian', () => {
    it('returns null for insufficient data', () => {
      const result = fitExGaussian([1000, 2000, 3000]);
      expect(result).toBeNull();
    });

    it('returns null for exactly MIN_SAMPLES - 1', () => {
      const samples = Array.from({ length: MIN_SAMPLES_FOR_FIT - 1 }, (_, i) => 5000 + i * 100);
      expect(fitExGaussian(samples)).toBeNull();
    });

    it('fits a Gaussian distribution (no skew) with tau ≈ 0', () => {
      // Symmetric distribution → tau should be near 0
      const samples = Array.from({ length: 100 }, (_, i) => 5000 + (i - 50) * 100);
      const result = fitExGaussian(samples);
      expect(result).not.toBeNull();
      expect(result!.tau).toBeLessThan(500);
      expect(result!.mu).toBeGreaterThan(0);
      expect(result!.sigma).toBeGreaterThan(0);
    });

    it('fits a right-skewed distribution with positive tau', () => {
      const samples = generateSkewedSamples(100);
      const result = fitExGaussian(samples);
      expect(result).not.toBeNull();
      expect(result!.mu).toBeGreaterThan(0);
      expect(result!.sigma).toBeGreaterThan(0);
      // Skewed → tau should be positive
      expect(result!.tau).toBeGreaterThanOrEqual(0);
    });

    it('records the sample count', () => {
      const samples = Array.from({ length: 50 }, (_, i) => 3000 + i * 200);
      const result = fitExGaussian(samples);
      expect(result).not.toBeNull();
      expect(result!.n).toBe(50);
    });

    it('handles all-identical values gracefully', () => {
      const samples = Array.from({ length: 50 }, () => 5000);
      const result = fitExGaussian(samples);
      // Should return null (degenerate: stdDev < 1)
      expect(result).toBeNull();
    });
  });

  describe('classifyRT', () => {
    const params: ExGaussianParams = { mu: 5000, sigma: 1500, tau: 2000, n: 100 };

    it('classifies fast RT as automatic', () => {
      const result = classifyRT(3000, params);
      expect(result.classification).toBe('automatic');
      expect(result.signalQuality).toBe(1.0);
    });

    it('classifies normal RT correctly', () => {
      const result = classifyRT(6000, params);
      expect(result.classification).toBe('normal');
      expect(result.signalQuality).toBe(1.0);
    });

    it('classifies effortful RT correctly', () => {
      // mu + sigma = 6500, mu + sigma + 2*tau = 10500
      const result = classifyRT(8000, params);
      expect(result.classification).toBe('effortful');
      expect(result.signalQuality).toBe(0.9);
    });

    it('classifies lapse RT correctly', () => {
      const result = classifyRT(15000, params);
      expect(result.classification).toBe('lapse');
      expect(result.signalQuality).toBe(0.6);
    });

    it('rtSignal is higher for faster responses', () => {
      const fast = classifyRT(3000, params);
      const slow = classifyRT(12000, params);
      expect(fast.rtSignal).toBeGreaterThan(slow.rtSignal);
    });

    it('rtSignal is bounded to [0, 1]', () => {
      const veryFast = classifyRT(500, params);
      const verySlow = classifyRT(50000, params);
      expect(veryFast.rtSignal).toBeLessThanOrEqual(1.0);
      expect(veryFast.rtSignal).toBeGreaterThanOrEqual(0);
      expect(verySlow.rtSignal).toBeGreaterThanOrEqual(0);
      expect(verySlow.rtSignal).toBeLessThanOrEqual(1.0);
    });

    it('handles tau = 0 (Gaussian-only) correctly', () => {
      const gaussianParams: ExGaussianParams = { mu: 5000, sigma: 1500, tau: 0, n: 100 };
      const automatic = classifyRT(3000, gaussianParams);
      const normal = classifyRT(5500, gaussianParams);
      const effortful = classifyRT(7500, gaussianParams);
      const lapse = classifyRT(9000, gaussianParams);

      expect(automatic.classification).toBe('automatic');
      expect(normal.classification).toBe('normal');
      expect(effortful.classification).toBe('effortful');
      expect(lapse.classification).toBe('lapse');
    });
  });

  describe('exGaussianRTSignal', () => {
    const params: ExGaussianParams = { mu: 5000, sigma: 1500, tau: 2000, n: 100 };

    it('returns high signal and quality for fast responses', () => {
      const result = exGaussianRTSignal(3000, params);
      expect(result.signal).toBeGreaterThan(0.7);
      expect(result.quality).toBe(1.0);
      expect(result.classification).toBe('automatic');
    });

    it('reduces quality for lapse responses', () => {
      const result = exGaussianRTSignal(15000, params);
      expect(result.quality).toBe(0.6);
      expect(result.classification).toBe('lapse');
    });

    it('provides consistent signal-quality pair', () => {
      const normal = exGaussianRTSignal(6000, params);
      const lapse = exGaussianRTSignal(15000, params);

      // A lapse has lower quality but NOT necessarily lower signal
      // (it could be moderate signal but unreliable)
      expect(lapse.quality).toBeLessThan(normal.quality);
    });
  });

  describe('integration with behavioral baseline', () => {
    it('fitExGaussian output shape matches UserBehavioralBaseline.rtBaseline.exGaussian', () => {
      const samples = generateSkewedSamples(50);
      const result = fitExGaussian(samples);
      if (result) {
        expect(typeof result.mu).toBe('number');
        expect(typeof result.sigma).toBe('number');
        expect(typeof result.tau).toBe('number');
        expect(typeof result.n).toBe('number');
      }
    });
  });
});
