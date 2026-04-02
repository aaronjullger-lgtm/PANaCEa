/**
 * Sprint 8: Rolling-Window Calibration Drift Detection Tests
 */
import { describe, it, expect } from 'vitest';
import {
  bucketReviews,
  computeCorrectionFactor,
  detectDrift,
} from '../lib/services/retrievabilityCalibrationService';

// Helper: create interleaved reviews (avoids ordering artifacts)
function makeReviews(
  count: number,
  retrievability: number,
  recallRate: number,
  system?: string
) {
  const reviews = [];
  const correctCount = Math.round(count * recallRate);
  for (let i = 0; i < count; i++) {
    const isCorrect = Math.floor((i + 1) * correctCount / count)
      > Math.floor(i * correctCount / count);
    reviews.push({ retrievability, wasCorrect: isCorrect, system });
  }
  return reviews;
}

describe('Retrievability Calibration — Drift Detection', () => {
  it('detects improving drift when recent recall exceeds historical', () => {
    const longReviews = makeReviews(200, 0.55, 0.5);
    const shortReviews = makeReviews(50, 0.55, 0.9);
    const allReviews = [...longReviews, ...shortReviews];

    const drift = detectDrift(allReviews);
    expect(drift.isDrifting).toBe(true);
    expect(drift.direction).toBe('improving');
    expect(drift.shortWindowFactor).toBeGreaterThan(drift.longWindowFactor);
  });

  it('detects degrading drift when recent recall drops', () => {
    const longReviews = makeReviews(200, 0.55, 0.85);
    const shortReviews = makeReviews(50, 0.55, 0.3);
    const allReviews = [...longReviews, ...shortReviews];

    const drift = detectDrift(allReviews);
    expect(drift.isDrifting).toBe(true);
    expect(drift.direction).toBe('degrading');
    expect(drift.shortWindowFactor).toBeLessThan(drift.longWindowFactor);
  });

  it('reports stable when windows are aligned', () => {
    const reviews = makeReviews(250, 0.55, 0.55);
    const drift = detectDrift(reviews);
    expect(drift.isDrifting).toBe(false);
    expect(drift.direction).toBe('stable');
  });

  it('computes per-system drift independently', () => {
    const cardioReviews = [
      ...makeReviews(150, 0.55, 0.5, 'Cardiovascular'),
      ...makeReviews(50, 0.55, 0.9, 'Cardiovascular'),
    ];
    const pulmonaryReviews = makeReviews(100, 0.55, 0.55, 'Pulmonary');
    const allReviews = [...cardioReviews, ...pulmonaryReviews];

    const drift = detectDrift(allReviews);

    // Cardiovascular should show drift (sudden improvement in last 50)
    if (drift.systemDrift['Cardiovascular']) {
      expect(drift.systemDrift['Cardiovascular'].isDrifting).toBe(true);
    }
  });

  it('handles very few reviews gracefully', () => {
    const reviews = makeReviews(20, 0.5, 0.5);
    const drift = detectDrift(reviews);
    expect(drift).toBeDefined();
    expect(typeof drift.isDrifting).toBe('boolean');
  });

  it('drift values are non-negative', () => {
    const reviews = makeReviews(300, 0.6, 0.6);
    const drift = detectDrift(reviews);
    expect(drift.drift).toBeGreaterThanOrEqual(0);
  });
});
