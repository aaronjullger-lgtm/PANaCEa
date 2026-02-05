/**
 * Unit tests for Grand Rounds grading: correctAnswer (String) to 0-based index.
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
    it('clamps out-of-range letter to 0', () => {
      expect(correctAnswerToIndex('E', optionsLength)).toBe(0);
      expect(correctAnswerToIndex('Z', optionsLength)).toBe(0);
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
    it('returns 0 for out-of-range numeric', () => {
      expect(correctAnswerToIndex('4', optionsLength)).toBe(0);
      expect(correctAnswerToIndex('10', optionsLength)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles optionsLength 5', () => {
      expect(correctAnswerToIndex('E', 5)).toBe(4);
      expect(correctAnswerToIndex('4', 5)).toBe(4);
    });
    it('handles empty or invalid string', () => {
      expect(correctAnswerToIndex('', optionsLength)).toBe(0);
      expect(correctAnswerToIndex('x', optionsLength)).toBe(0);
      expect(correctAnswerToIndex('abc', optionsLength)).toBe(0);
    });
  });
});
