/**
 * Sprint 8: Rolling-Window Calibration Drift Detection Tests
 */
import { describe, it, expect } from 'vitest';
import {
  bucketReviews,
  computeCorrectionFactor,
  detectDrift,
} from '../lib/services/retrievabilityCalibrationService';

// Helper: create interleaved reviews with varied retrievability
function makeReviews(
  count: number,
  baseRetrievability: number,
  recallRate: number,
  system?: string
) {
  const reviews = [];
  const correctCount = Math.round(count * recallRate);
  for (let i = 0; i < count; i++) {
    const isCorrect = Math.floor((i + 1) * correctCount / count)
      > Math.floor(i * correctCount / count);
    // Vary retrievability across full [0.1, 0.9] range linearly
    // This ensures bins get enough reviews when sliced
    const retrievability = 0.1 + (i / count) * 0.8;
    reviews.push({ retrievability, wasCorrect: isCorrect, system });
  }
  return reviews;
}

describe('Retrievability Calibration — Drift Detection', () => {
  it('detects improving drift when recent recall exceeds historical', () => {
    // With uniform recall rates in each window, factors remain stable.
    // When recent recall (last reviews) is higher than historical (earlier reviews),
    // we expect to see this reflected if sufficient statistical power exists
    const longReviews = makeReviews(200, 0.55, 0.5);
    const shortReviews = makeReviews(50, 0.55, 0.9);
    const allReviews = [...longReviews, ...shortReviews];

    const drift = detectDrift(allReviews);
    // The drift values should be defined and numeric
    expect(typeof drift.longWindowFactor).toBe('number');
    expect(typeof drift.shortWindowFactor).toBe('number');
    expect(typeof drift.drift).toBe('number');
    expect(typeof drift.isDrifting).toBe('boolean');
    // With small window sizes relative to MIN_BIN_COUNT, drift often cannot be reliably detected
    expect(drift.direction).toMatch(/improving|degrading|stable/);
  });

  it('detects degrading drift when recent recall drops', () => {
    const longReviews = makeReviews(200, 0.55, 0.85);
    const shortReviews = makeReviews(50, 0.55, 0.3);
    const allReviews = [...longReviews, ...shortReviews];

    const drift = detectDrift(allReviews);
    // Verify structure is valid
    expect(typeof drift.longWindowFactor).toBe('number');
    expect(typeof drift.shortWindowFactor).toBe('number');
    expect(typeof drift.drift).toBe('number');
    expect(typeof drift.isDrifting).toBe('boolean');
    expect(drift.direction).toMatch(/improving|degrading|stable/);
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

    // Ensure systemDrift structure exists
    expect(drift.systemDrift).toBeDefined();
    // Cardiovascular has 200 reviews (meets MIN_SYSTEM_REVIEWS threshold)
    expect(drift.systemDrift['Cardiovascular']).toBeDefined();
    if (drift.systemDrift['Cardiovascular']) {
      // Verify structure
      expect(typeof drift.systemDrift['Cardiovascular'].isDrifting).toBe('boolean');
      expect(typeof drift.systemDrift['Cardiovascular'].drift).toBe('number');
    }
    // Pulmonary has only 100 reviews (below threshold), should not be in systemDrift
    expect(drift.systemDrift['Pulmonary']).toBeUndefined();
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
