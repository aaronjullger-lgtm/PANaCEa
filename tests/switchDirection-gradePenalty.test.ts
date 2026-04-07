/**
 * Switch Direction Grade Penalty Tests
 *
 * Validates research-backed answer-change behavior:
 * - Only first change is informative (subsequent → guessing probability)
 * - Wrong→right (WR) = positive metacognitive signal (+0.10 grade bonus)
 * - Right→wrong (RW) = strong negative signal (-0.25 grade penalty)
 * - Wrong→wrong (WW) = no anchor (-0.10 penalty)
 * - Subsequent switches beyond first: -0.05 each (diminishing signal)
 *
 * Research: ScienceDirect (2022), Bauer et al. BMC Medical Education (2007)
 */

import { describe, it, expect } from 'vitest';
import { analyzeSwitchDirections, type SwitchDirectionResult } from '../lib/services/switchDirectionService';

describe('Switch Direction Grade Penalty (Research-Backed)', () => {
  const CORRECT_ID = 'option_a';

  describe('firstSwitchDirection classification', () => {
    it('should detect WR first switch (wrong → right)', () => {
      const interactions = [
        { option_id: 'option_b' }, // wrong
        { option_id: CORRECT_ID }, // right (first switch: WR)
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.firstSwitchDirection).toBe('WR');
      expect(result.totalSwitches).toBe(1);
    });

    it('should detect RW first switch (right → wrong)', () => {
      const interactions = [
        { option_id: CORRECT_ID }, // right
        { option_id: 'option_b' }, // wrong (first switch: RW)
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.firstSwitchDirection).toBe('RW');
      expect(result.totalSwitches).toBe(1);
    });

    it('should detect WW first switch (wrong → wrong)', () => {
      const interactions = [
        { option_id: 'option_b' }, // wrong
        { option_id: 'option_c' }, // wrong (first switch: WW)
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.firstSwitchDirection).toBe('WW');
      expect(result.totalSwitches).toBe(1);
    });

    it('should return null when no switches', () => {
      const interactions = [{ option_id: CORRECT_ID }]; // single selection
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.firstSwitchDirection).toBeNull();
      expect(result.totalSwitches).toBe(0);
    });

    it('should return null for empty interactions', () => {
      const result = analyzeSwitchDirections([], CORRECT_ID);
      expect(result.firstSwitchDirection).toBeNull();
      expect(result.totalSwitches).toBe(0);
      expect(result.gradePenaltyRecommendation).toBe(0);
    });
  });

  describe('gradePenaltyRecommendation values', () => {
    it('should give +0.10 bonus for clean WR first switch (good metacognition)', () => {
      const interactions = [
        { option_id: 'option_b' }, // wrong
        { option_id: CORRECT_ID }, // right
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.gradePenaltyRecommendation).toBeCloseTo(0.10, 2);
    });

    it('should give -0.25 penalty for RW first switch (knowledge fragility)', () => {
      const interactions = [
        { option_id: CORRECT_ID }, // right
        { option_id: 'option_b' }, // wrong
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.gradePenaltyRecommendation).toBeCloseTo(-0.25, 2);
    });

    it('should give -0.10 penalty for WW first switch (no retrieval anchor)', () => {
      const interactions = [
        { option_id: 'option_b' }, // wrong
        { option_id: 'option_c' }, // wrong
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.gradePenaltyRecommendation).toBeCloseTo(-0.10, 2);
    });

    it('should give 0 for no switches', () => {
      const result = analyzeSwitchDirections([{ option_id: CORRECT_ID }], CORRECT_ID);
      expect(result.gradePenaltyRecommendation).toBe(0);
    });
  });

  describe('subsequent switch penalty (first-only weighting)', () => {
    it('should apply -0.05 per additional switch beyond first', () => {
      // WR first switch (+0.10) then 2 more switches (-0.05 each = -0.10)
      // Net: +0.10 - 0.10 = 0.00
      const interactions = [
        { option_id: 'option_b' }, // wrong
        { option_id: CORRECT_ID }, // right (first switch: WR)
        { option_id: 'option_c' }, // wrong (2nd switch)
        { option_id: CORRECT_ID }, // right (3rd switch)
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.firstSwitchDirection).toBe('WR');
      expect(result.totalSwitches).toBe(3); // WR + RW + WR
      // +0.10 (WR first) + 2 * -0.05 (subsequent) = 0.0
      expect(result.gradePenaltyRecommendation).toBeCloseTo(0.0, 2);
    });

    it('should compound RW first penalty with subsequent penalties', () => {
      // RW first switch (-0.25) then 1 more switch (-0.05)
      // Net: -0.25 - 0.05 = -0.30
      const interactions = [
        { option_id: CORRECT_ID }, // right
        { option_id: 'option_b' }, // wrong (first switch: RW)
        { option_id: 'option_c' }, // wrong (2nd switch: WW)
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.firstSwitchDirection).toBe('RW');
      expect(result.totalSwitches).toBe(2);
      expect(result.gradePenaltyRecommendation).toBeCloseTo(-0.30, 2);
    });
  });

  describe('research validation: 3:1 WR:RW signal ratio', () => {
    it('WR switch should give net positive grade adjustment', () => {
      const wr = analyzeSwitchDirections(
        [{ option_id: 'option_b' }, { option_id: CORRECT_ID }],
        CORRECT_ID
      );
      expect(wr.gradePenaltyRecommendation).toBeGreaterThan(0);
    });

    it('RW switch should give much larger negative than WR positive', () => {
      const wr = analyzeSwitchDirections(
        [{ option_id: 'option_b' }, { option_id: CORRECT_ID }],
        CORRECT_ID
      );
      const rw = analyzeSwitchDirections(
        [{ option_id: CORRECT_ID }, { option_id: 'option_b' }],
        CORRECT_ID
      );
      // RW penalty magnitude should be >2x the WR bonus (research: 3:1 signal ratio)
      expect(Math.abs(rw.gradePenaltyRecommendation)).toBeGreaterThan(
        Math.abs(wr.gradePenaltyRecommendation) * 2
      );
    });
  });

  describe('backward compatibility: confidenceMultiplier still works', () => {
    it('should still compute confidenceMultiplier alongside gradePenalty', () => {
      const interactions = [
        { option_id: CORRECT_ID },
        { option_id: 'option_b' }, // RW
      ];
      const result = analyzeSwitchDirections(interactions, CORRECT_ID);
      expect(result.confidenceMultiplier).toBeLessThan(1.0); // RW penalty
      expect(result.gradePenaltyRecommendation).toBeLessThan(0); // also penalized
    });
  });
});
