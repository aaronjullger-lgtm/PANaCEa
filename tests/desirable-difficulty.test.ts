/**
 * Tests for Desirable Difficulty Bonus
 * Sprint 2 of Confidence Pipeline v3
 */
import { describe, it, expect } from 'vitest';
import {
  computeDesirableDifficultyBonus,
  DEFAULT_DD_CONFIG,
  type DesirableDifficultyConfig,
} from '../lib/confidence/desirableDifficultyBonus';

describe('Desirable Difficulty Bonus', () => {
  describe('activation conditions', () => {
    it('does NOT activate for incorrect answers', () => {
      const result = computeDesirableDifficultyBonus(0.3, false, 5);
      expect(result.activated).toBe(false);
      expect(result.multiplier).toBe(1.0);
    });

    it('does NOT activate for high-confidence correct answers', () => {
      const result = computeDesirableDifficultyBonus(0.8, true, 5);
      expect(result.activated).toBe(false);
      expect(result.multiplier).toBe(1.0);
    });

    it('does NOT activate at exactly the threshold', () => {
      const result = computeDesirableDifficultyBonus(0.55, true, 5);
      expect(result.activated).toBe(false);
    });

    it('activates for correct answers below confidence threshold', () => {
      const result = computeDesirableDifficultyBonus(0.4, true, 5);
      expect(result.activated).toBe(true);
      expect(result.multiplier).toBeGreaterThan(1.0);
    });

    it('activates for barely-below-threshold confidence', () => {
      const result = computeDesirableDifficultyBonus(0.54, true, 5);
      expect(result.activated).toBe(true);
      expect(result.multiplier).toBeGreaterThan(1.0);
    });
  });

  describe('bonus magnitude', () => {
    it('returns higher bonus for lower confidence (more effort)', () => {
      const lowConf = computeDesirableDifficultyBonus(0.35, true, 3);
      const midConf = computeDesirableDifficultyBonus(0.50, true, 3);
      expect(lowConf.multiplier).toBeGreaterThan(midConf.multiplier);
    });

    it('returns higher bonus for longer spacing', () => {
      const short = computeDesirableDifficultyBonus(0.4, true, 0.5);
      const long = computeDesirableDifficultyBonus(0.4, true, 5);
      expect(long.multiplier).toBeGreaterThan(short.multiplier);
    });

    it('caps bonus at maxBonus', () => {
      const result = computeDesirableDifficultyBonus(0.3, true, 100);
      expect(result.multiplier).toBeLessThanOrEqual(DEFAULT_DD_CONFIG.maxBonus);
    });

    it('never returns below 1.0 for activated bonuses', () => {
      const result = computeDesirableDifficultyBonus(0.54, true, 0);
      expect(result.multiplier).toBeGreaterThanOrEqual(1.0);
    });

    it('minimum bonus is baseBonus when activated', () => {
      // Highest confidence that still activates, lowest spacing → minimum bonus
      const result = computeDesirableDifficultyBonus(0.54, true, 0);
      expect(result.multiplier).toBeGreaterThanOrEqual(DEFAULT_DD_CONFIG.baseBonus);
    });
  });

  describe('effort and spacing signals', () => {
    it('effort signal is 0 at threshold', () => {
      const result = computeDesirableDifficultyBonus(0.54, true, 3);
      expect(result.components.effortSignal).toBeLessThan(0.1);
    });

    it('effort signal is ~1.0 at minimum confidence', () => {
      const result = computeDesirableDifficultyBonus(0.3, true, 3);
      expect(result.components.effortSignal).toBeCloseTo(1.0, 1);
    });

    it('spacing signal is 0 for same-day reviews', () => {
      const result = computeDesirableDifficultyBonus(0.4, true, 0);
      expect(result.components.spacingSignal).toBe(0);
    });

    it('spacing signal is 1.0 at or above threshold days', () => {
      const result = computeDesirableDifficultyBonus(0.4, true, 5);
      expect(result.components.spacingSignal).toBe(1);
    });
  });

  describe('custom config', () => {
    it('respects custom confidence threshold', () => {
      const config: DesirableDifficultyConfig = { ...DEFAULT_DD_CONFIG, confidenceThreshold: 0.7 };
      const result = computeDesirableDifficultyBonus(0.6, true, 3, config);
      expect(result.activated).toBe(true);
    });

    it('respects custom maxBonus', () => {
      const config: DesirableDifficultyConfig = { ...DEFAULT_DD_CONFIG, maxBonus: 1.1 };
      const result = computeDesirableDifficultyBonus(0.3, true, 10, config);
      expect(result.multiplier).toBeLessThanOrEqual(1.1);
    });
  });

  describe('interaction with stability multiplier', () => {
    it('partially offsets the graduated stability penalty for effortful retrieval', () => {
      // Scenario: correct answer, confidence 0.4, 5 days elapsed
      // Graduated stability multiplier at 0.4 → ~0.78 (penalty)
      // Desirable difficulty bonus at 0.4 → ~1.15 (bonus)
      // Net: 0.78 × 1.15 ≈ 0.90 (much less penalty than without bonus)
      const dd = computeDesirableDifficultyBonus(0.4, true, 5);
      expect(dd.multiplier).toBeGreaterThan(1.1);
    });
  });
});
