/**
 * Unit tests for Grand Rounds grading: correctAnswer (String) to 0-based index.
 * Updated: invalid inputs now return null instead of silently falling back to 0.
 */

import { describe, it, expect } from 'vitest';
import { correctAnswerToIndex } from '../lib/grandRoundsGrading';

describe('correctAnswerToIndex', () => {
  const optionsLength = 4;

  describe('letter answers (A/B/C/D)', () => {
    it('maps A to 0', () => {
      expect(correctAnswerToIndex('A', optionsLength)).toBe(0);
      expect(correctAnswerToIndex('a', optionsLength)).toBe(0);
    });
    it('maps B to 1', () => {
      expect(correctAnswerToIndex('B', optionsLength)).toBe(1);
      expect(correctAnswerToIndex('b', optionsLength)).toBe(1);
    });
    it('maps C to 2', () => {
      expect(correctAnswerToIndex('C', optionsLength)).toBe(2);
    });
    it('maps D to 3', () => {
      expect(correctAnswerToIndex('D', optionsLength)).toBe(3);
    });
    it('trims and uppercases', () => {
      expect(correctAnswerToIndex('  c  ', optionsLength)).toBe(2);
    });
    it('returns null for out-of-range letter (not silent fallback to 0)', () => {
      expect(correctAnswerToIndex('E', optionsLength)).toBeNull();
      expect(correctAnswerToIndex('Z', optionsLength)).toBeNull();
    });
  });

  describe('numeric string answers (0/1/2/3)', () => {
    it('maps "0" to 0', () => {
      expect(correctAnswerToIndex('0', optionsLength)).toBe(0);
    });
    it('maps "1" to 1', () => {
      expect(correctAnswerToIndex('1', optionsLength)).toBe(1);
    });
    it('maps "2" to 2', () => {
      expect(correctAnswerToIndex('2', optionsLength)).toBe(2);
    });
    it('maps "3" to 3', () => {
      expect(correctAnswerToIndex('3', optionsLength)).toBe(3);
    });
    it('returns null for out-of-range numeric (not silent fallback to 0)', () => {
      expect(correctAnswerToIndex('4', optionsLength)).toBeNull();
      expect(correctAnswerToIndex('10', optionsLength)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles optionsLength 5 — E maps to 4', () => {
      expect(correctAnswerToIndex('E', 5)).toBe(4);
      expect(correctAnswerToIndex('4', 5)).toBe(4);
    });
    it('returns null for empty or invalid string (not silent fallback to 0)', () => {
      expect(correctAnswerToIndex('', optionsLength)).toBeNull();
      expect(correctAnswerToIndex('x', optionsLength)).toBeNull();
      expect(correctAnswerToIndex('abc', optionsLength)).toBeNull();
    });
  });
});
