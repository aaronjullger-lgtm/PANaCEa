/**
 * Tests for Confidence-Weighted Difficulty Modulator
 * Sprint 6 of Confidence Pipeline v3
 */
import { describe, it, expect } from 'vitest';
import {
  modulateDifficultyDelta,
  DEFAULT_DIFFICULTY_CONFIG,
  type DifficultyModulationConfig,
} from '../lib/confidence/difficultyModulator';

describe('Difficulty Modulator', () => {
  describe('neutral cases', () => {
    it('returns unchanged delta when confidence equals neutral point', () => {
      const result = modulateDifficultyDelta(-0.5, 0.6, true);
      expect(result.modulationFactor).toBeCloseTo(1.0, 1);
      expect(result.modulatedDelta).toBeCloseTo(-0.5, 1);
    });

    it('returns unchanged delta when delta is zero', () => {
      const result = modulateDifficultyDelta(0, 0.3, true);
      expect(result.modulatedDelta).toBe(0);
      expect(result.modulationFactor).toBe(1.0);
    });

    it('returns unchanged delta when delta is near-zero', () => {
      const result = modulateDifficultyDelta(0.0005, 0.3, true);
      expect(result.modulationFactor).toBe(1.0);
    });
  });

  describe('correct answers — difficulty decrease modulation', () => {
    it('amplifies difficulty decrease for high-confidence correct', () => {
      // High confidence = easy recall → should decrease difficulty MORE
      const result = modulateDifficultyDelta(-1.0, 0.9, true);
      expect(result.modulationFactor).toBeGreaterThan(1.0);
      expect(Math.abs(result.modulatedDelta)).toBeGreaterThan(1.0);
    });

    it('dampens difficulty decrease for low-confidence correct', () => {
      // Low confidence = effortful recall → should decrease difficulty LESS
      const result = modulateDifficultyDelta(-1.0, 0.35, true);
      expect(result.modulationFactor).toBeLessThan(1.0);
      expect(Math.abs(result.modulatedDelta)).toBeLessThan(1.0);
    });

    it('amplification is proportional to confidence above neutral', () => {
      const med = modulateDifficultyDelta(-1.0, 0.7, true);
      const high = modulateDifficultyDelta(-1.0, 0.9, true);
      expect(high.modulationFactor).toBeGreaterThan(med.modulationFactor);
    });

    it('dampening is proportional to confidence below neutral', () => {
      const low = modulateDifficultyDelta(-1.0, 0.35, true);
      const veryLow = modulateDifficultyDelta(-1.0, 0.3, true);
      expect(veryLow.modulationFactor).toBeLessThanOrEqual(low.modulationFactor);
    });
  });

  describe('incorrect answers — difficulty increase modulation', () => {
    it('amplifies difficulty increase for high-confidence incorrect (surprise)', () => {
      // Got it wrong unexpectedly → card is harder than thought → increase difficulty MORE
      const result = modulateDifficultyDelta(1.0, 0.9, false);
      expect(result.modulationFactor).toBeGreaterThan(1.0);
      expect(result.modulatedDelta).toBeGreaterThan(1.0);
    });

    it('dampens difficulty increase for low-confidence incorrect (expected)', () => {
      // Expected to get it wrong → difficulty increase should be modest
      const result = modulateDifficultyDelta(1.0, 0.35, false);
      expect(result.modulationFactor).toBeLessThan(1.0);
      expect(result.modulatedDelta).toBeLessThan(1.0);
    });

    it('can disable incorrect modulation via config', () => {
      const config: DifficultyModulationConfig = {
        ...DEFAULT_DIFFICULTY_CONFIG,
        modulateIncorrect: false,
      };
      const result = modulateDifficultyDelta(1.0, 0.9, false, config);
      expect(result.modulationFactor).toBe(1.0);
    });
  });

  describe('bounds and clamping', () => {
    it('modulation factor never exceeds maxAmplification', () => {
      const result = modulateDifficultyDelta(-1.0, 0.95, true);
      expect(result.modulationFactor).toBeLessThanOrEqual(DEFAULT_DIFFICULTY_CONFIG.maxAmplification);
    });

    it('modulation factor never goes below maxDampening', () => {
      const result = modulateDifficultyDelta(-1.0, 0.3, true);
      expect(result.modulationFactor).toBeGreaterThanOrEqual(DEFAULT_DIFFICULTY_CONFIG.maxDampening);
    });

    it('never inverts the sign of the delta', () => {
      // Difficulty decrease stays a decrease
      const neg = modulateDifficultyDelta(-0.5, 0.3, true);
      expect(neg.modulatedDelta).toBeLessThan(0);

      // Difficulty increase stays an increase
      const pos = modulateDifficultyDelta(0.5, 0.3, false);
      expect(pos.modulatedDelta).toBeGreaterThan(0);
    });
  });

  describe('custom config', () => {
    it('respects custom neutral confidence', () => {
      const config: DifficultyModulationConfig = {
        ...DEFAULT_DIFFICULTY_CONFIG,
        neutralConfidence: 0.5,
      };
      // 0.6 is above custom neutral → should amplify
      const result = modulateDifficultyDelta(-1.0, 0.6, true, config);
      expect(result.modulationFactor).toBeGreaterThan(1.0);
    });

    it('respects custom amplification/dampening limits', () => {
      const config: DifficultyModulationConfig = {
        ...DEFAULT_DIFFICULTY_CONFIG,
        maxAmplification: 2.0,
        maxDampening: 0.3,
      };
      const high = modulateDifficultyDelta(-1.0, 0.95, true, config);
      expect(high.modulationFactor).toBeLessThanOrEqual(2.0);

      const low = modulateDifficultyDelta(-1.0, 0.3, true, config);
      expect(low.modulationFactor).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('result metadata', () => {
    it('preserves original delta', () => {
      const result = modulateDifficultyDelta(-0.75, 0.8, true);
      expect(result.originalDelta).toBe(-0.75);
    });

    it('modulation factor is rounded to 3 decimal places', () => {
      const result = modulateDifficultyDelta(-1.0, 0.73, true);
      const decimals = result.modulationFactor.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });
  });
});
