import { describe, it, expect } from 'vitest';
import {
  SAFETY_CRITICAL_FIELDS,
  isSafetyCriticalField,
  scoreSafetyCompleteness,
} from './safety-critical-fields';

describe('safety-critical-fields', () => {
  describe('isSafetyCriticalField', () => {
    it('returns true for every listed safety key', () => {
      for (const k of SAFETY_CRITICAL_FIELDS) {
        expect(isSafetyCriticalField(k)).toBe(true);
      }
    });

    it('returns false for non-safety fields', () => {
      expect(isSafetyCriticalField('overview')).toBe(false);
      expect(isSafetyCriticalField('pathophysiology')).toBe(false);
      expect(isSafetyCriticalField('mnemonic')).toBe(false);
      expect(isSafetyCriticalField('buzzwords')).toBe(false);
    });

    it('handles null / undefined / non-string input safely', () => {
      expect(isSafetyCriticalField(null)).toBe(false);
      expect(isSafetyCriticalField(undefined)).toBe(false);
      expect(isSafetyCriticalField(123 as unknown as string)).toBe(false);
    });
  });

  describe('scoreSafetyCompleteness', () => {
    it('counts all seven safety fields as missing when content is empty', () => {
      const result = scoreSafetyCompleteness({});
      expect(result.total).toBe(SAFETY_CRITICAL_FIELDS.length);
      expect(result.filled).toBe(0);
      expect(result.missing).toEqual([...SAFETY_CRITICAL_FIELDS]);
    });

    it('treats empty string and empty array as missing (no silent clips)', () => {
      const result = scoreSafetyCompleteness({
        complications: '',
        first_line_rx: '   ',
        best_initial_test: [],
        gold_standard_dx: 'Coronary angiography',
        rx_side_effects: 'Bleeding, bradycardia',
        differentialDiagnosis: ['MI', 'Aortic dissection'],
        riskFactors: 'HTN, DM',
      });
      expect(result.filled).toBe(4);
      expect(result.missing).toEqual(['complications', 'first_line_rx', 'best_initial_test']);
    });

    it('treats a fully populated record as complete', () => {
      const full: Record<string, unknown> = {};
      for (const k of SAFETY_CRITICAL_FIELDS) full[k] = 'present';
      const result = scoreSafetyCompleteness(full);
      expect(result.filled).toBe(result.total);
      expect(result.missing).toEqual([]);
    });
  });
});
