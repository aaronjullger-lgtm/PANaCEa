/**
 * Tests for Session Fatigue Confidence Dampener
 * Sprint 1 of Confidence Pipeline v3
 */
import { describe, it, expect } from 'vitest';
import {
  computeFatigueFactor,
  computeFatigueConfidenceDampener,
  applyFatigueCorrection,
  FATIGUE_THRESHOLD,
  FATIGUE_RATE,
  MAX_FATIGUE_FACTOR,
} from '../lib/services/sessionFatigueService';

describe('Session Fatigue Confidence Dampener', () => {
  describe('computeFatigueConfidenceDampener', () => {
    it('returns 1.0 for questions at or below threshold', () => {
      expect(computeFatigueConfidenceDampener(1)).toBe(1.0);
      expect(computeFatigueConfidenceDampener(10)).toBe(1.0);
      expect(computeFatigueConfidenceDampener(15)).toBe(1.0);
    });

    it('returns < 1.0 for questions above threshold', () => {
      const dampener = computeFatigueConfidenceDampener(20);
      expect(dampener).toBeLessThan(1.0);
      expect(dampener).toBeGreaterThan(0.85);
    });

    it('decreases monotonically with question number', () => {
      const d20 = computeFatigueConfidenceDampener(20);
      const d30 = computeFatigueConfidenceDampener(30);
      const d40 = computeFatigueConfidenceDampener(40);
      expect(d30).toBeLessThan(d20);
      expect(d40).toBeLessThan(d30);
    });

    it('never goes below 0.85 floor', () => {
      expect(computeFatigueConfidenceDampener(100)).toBeGreaterThanOrEqual(0.85);
      expect(computeFatigueConfidenceDampener(500)).toBeGreaterThanOrEqual(0.85);
    });

    it('handles NaN/Infinity gracefully', () => {
      expect(computeFatigueConfidenceDampener(NaN)).toBe(1.0);
      // Infinity fails the isFinite check → returns 1.0 (same guard as NaN)
      expect(computeFatigueConfidenceDampener(Infinity)).toBe(1.0);
    });

    it('handles negative question numbers', () => {
      expect(computeFatigueConfidenceDampener(-1)).toBe(1.0);
      expect(computeFatigueConfidenceDampener(0)).toBe(1.0);
    });

    it('mirrors par time fatigue curve in inverse', () => {
      // At the same question number, fatigue factor (par time) and confidence dampener
      // should move in opposite directions from 1.0
      const q25 = 25;
      const parFactor = computeFatigueFactor(q25);
      const confDampener = computeFatigueConfidenceDampener(q25);

      // Par factor > 1.0, confidence dampener < 1.0
      expect(parFactor).toBeGreaterThan(1.0);
      expect(confDampener).toBeLessThan(1.0);

      // The magnitudes of deviation should be similar (both use FATIGUE_RATE)
      const parDeviation = parFactor - 1.0;
      const confDeviation = 1.0 - confDampener;
      expect(Math.abs(parDeviation - confDeviation)).toBeLessThan(0.01);
    });
  });

  describe('integration with existing fatigue system', () => {
    it('FATIGUE_THRESHOLD is 15', () => {
      expect(FATIGUE_THRESHOLD).toBe(15);
    });

    it('par time correction and confidence dampener use same rate', () => {
      // Both functions share FATIGUE_RATE constant
      expect(FATIGUE_RATE).toBe(0.035);
    });

    it('applyFatigueCorrection still works correctly', () => {
      expect(applyFatigueCorrection(30000, 10)).toBe(30000); // Below threshold
      const adjusted = applyFatigueCorrection(30000, 25);
      expect(adjusted).toBeGreaterThan(30000); // Above threshold → longer par time
    });
  });
});
