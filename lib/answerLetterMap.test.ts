// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/answerLetterMap.ts
 *
 * Pure functions tested:
 *   letterToIndex(letter)                                — A→0 … E→4, null on invalid
 *   indexToLetter(index)                                — 0→A … 4→E, null on invalid
 *   letterToIndexStrict(letter, context?)               — throws on invalid
 *   indexToLetterStrict(index, context?)                — throws on invalid
 *   isValidAnswerLetter(value)                          — type guard A–E
 *   resolveCorrectAnswerIndex(correctAnswer, options)   — letter|numeric|full-text|null
 *
 * Constants verified:
 *   ANSWER_LETTERS = ['A','B','C','D','E']
 *   MAX_OPTION_INDEX = 4
 */

import { describe, it, expect } from 'vitest';
import {
  ANSWER_LETTERS,
  MAX_OPTION_INDEX,
  letterToIndex,
  indexToLetter,
  letterToIndexStrict,
  indexToLetterStrict,
  isValidAnswerLetter,
  resolveCorrectAnswerIndex,
} from './answerLetterMap';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('ANSWER_LETTERS and MAX_OPTION_INDEX', () => {
  it('ANSWER_LETTERS is ["A","B","C","D","E"]', () => {
    expect(Array.from(ANSWER_LETTERS)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('MAX_OPTION_INDEX is 4 (length - 1)', () => {
    expect(MAX_OPTION_INDEX).toBe(4);
    expect(MAX_OPTION_INDEX).toBe(ANSWER_LETTERS.length - 1);
  });
});

// ─── letterToIndex ────────────────────────────────────────────────────────────

describe('letterToIndex', () => {
  it('converts A→0, B→1, C→2, D→3, E→4', () => {
    expect(letterToIndex('A')).toBe(0);
    expect(letterToIndex('B')).toBe(1);
    expect(letterToIndex('C')).toBe(2);
    expect(letterToIndex('D')).toBe(3);
    expect(letterToIndex('E')).toBe(4);
  });

  it('is case-insensitive (a→0, e→4)', () => {
    expect(letterToIndex('a')).toBe(0);
    expect(letterToIndex('b')).toBe(1);
    expect(letterToIndex('c')).toBe(2);
    expect(letterToIndex('d')).toBe(3);
    expect(letterToIndex('e')).toBe(4);
  });

  it('returns null for F and beyond', () => {
    expect(letterToIndex('F')).toBeNull();
    expect(letterToIndex('Z')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(letterToIndex('')).toBeNull();
  });

  it('returns null for multi-character input', () => {
    expect(letterToIndex('AB')).toBeNull();
    expect(letterToIndex('AA')).toBeNull();
  });

  it('returns null for non-string input types', () => {
    // @ts-expect-error testing runtime behavior with invalid type
    expect(letterToIndex(0)).toBeNull();
    // @ts-expect-error testing runtime behavior with invalid type
    expect(letterToIndex(null)).toBeNull();
  });
});

// ─── indexToLetter ────────────────────────────────────────────────────────────

describe('indexToLetter', () => {
  it('converts 0→A, 1→B, 2→C, 3→D, 4→E', () => {
    expect(indexToLetter(0)).toBe('A');
    expect(indexToLetter(1)).toBe('B');
    expect(indexToLetter(2)).toBe('C');
    expect(indexToLetter(3)).toBe('D');
    expect(indexToLetter(4)).toBe('E');
  });

  it('returns null for negative indices', () => {
    expect(indexToLetter(-1)).toBeNull();
    expect(indexToLetter(-100)).toBeNull();
  });

  it('returns null for index >= 5', () => {
    expect(indexToLetter(5)).toBeNull();
    expect(indexToLetter(100)).toBeNull();
  });

  it('returns null for non-integer numbers', () => {
    expect(indexToLetter(1.5)).toBeNull();
    expect(indexToLetter(0.1)).toBeNull();
  });

  it('returns null for non-number types', () => {
    // @ts-expect-error testing runtime behavior
    expect(indexToLetter('A')).toBeNull();
    // @ts-expect-error testing runtime behavior
    expect(indexToLetter(null)).toBeNull();
  });
});

// ─── letterToIndex ↔ indexToLetter round-trip ─────────────────────────────────

describe('letterToIndex ↔ indexToLetter round-trip', () => {
  it('letterToIndex(indexToLetter(i)) === i for 0–4', () => {
    for (let i = 0; i <= 4; i++) {
      const letter = indexToLetter(i);
      expect(letter).not.toBeNull();
      expect(letterToIndex(letter!)).toBe(i);
    }
  });

  it('indexToLetter(letterToIndex(L)) === L.toUpperCase() for A–E', () => {
    for (const L of ['A', 'B', 'C', 'D', 'E'] as const) {
      const idx = letterToIndex(L);
      expect(idx).not.toBeNull();
      expect(indexToLetter(idx!)).toBe(L);
    }
  });
});

// ─── letterToIndexStrict ──────────────────────────────────────────────────────

describe('letterToIndexStrict', () => {
  it('returns the index for valid letters', () => {
    expect(letterToIndexStrict('A')).toBe(0);
    expect(letterToIndexStrict('E')).toBe(4);
    expect(letterToIndexStrict('c')).toBe(2);
  });

  it('throws for invalid letters', () => {
    expect(() => letterToIndexStrict('F')).toThrow();
    expect(() => letterToIndexStrict('')).toThrow();
    expect(() => letterToIndexStrict('AB')).toThrow();
  });

  it('error message includes the invalid letter', () => {
    expect(() => letterToIndexStrict('F')).toThrow('F');
  });

  it('error message includes optional context when provided', () => {
    expect(() => letterToIndexStrict('G', 'q-123')).toThrow('q-123');
  });
});

// ─── indexToLetterStrict ──────────────────────────────────────────────────────

describe('indexToLetterStrict', () => {
  it('returns the letter for valid indices', () => {
    expect(indexToLetterStrict(0)).toBe('A');
    expect(indexToLetterStrict(4)).toBe('E');
  });

  it('throws for out-of-range indices', () => {
    expect(() => indexToLetterStrict(-1)).toThrow();
    expect(() => indexToLetterStrict(5)).toThrow();
  });

  it('error message includes the invalid index', () => {
    expect(() => indexToLetterStrict(5)).toThrow('5');
  });

  it('error message includes optional context when provided', () => {
    expect(() => indexToLetterStrict(9, 'q-456')).toThrow('q-456');
  });
});

// ─── isValidAnswerLetter ──────────────────────────────────────────────────────

describe('isValidAnswerLetter', () => {
  it('returns true for A–E (uppercase)', () => {
    for (const L of ['A', 'B', 'C', 'D', 'E']) {
      expect(isValidAnswerLetter(L)).toBe(true);
    }
  });

  it('returns true for a–e (lowercase, case-insensitive)', () => {
    for (const l of ['a', 'b', 'c', 'd', 'e']) {
      expect(isValidAnswerLetter(l)).toBe(true);
    }
  });

  it('returns false for letters beyond E', () => {
    expect(isValidAnswerLetter('F')).toBe(false);
    expect(isValidAnswerLetter('Z')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidAnswerLetter('')).toBe(false);
  });

  it('returns false for multi-character strings', () => {
    expect(isValidAnswerLetter('AB')).toBe(false);
  });

  it('returns false for numeric strings', () => {
    expect(isValidAnswerLetter('1')).toBe(false);
    expect(isValidAnswerLetter('0')).toBe(false);
  });
});

// ─── resolveCorrectAnswerIndex ────────────────────────────────────────────────

const OPTIONS = ['Opt A text', 'Opt B text', 'Opt C text', 'Opt D text', 'Opt E text'];

describe('resolveCorrectAnswerIndex', () => {
  // ── Letter input ──

  it('resolves single letter A → 0 (within options range)', () => {
    expect(resolveCorrectAnswerIndex('A', OPTIONS)).toBe(0);
  });

  it('resolves single letter E → 4', () => {
    expect(resolveCorrectAnswerIndex('E', OPTIONS)).toBe(4);
  });

  it('resolves lowercase letter (case-insensitive)', () => {
    expect(resolveCorrectAnswerIndex('b', OPTIONS)).toBe(1);
  });

  it('returns null for letter F (out of alphabet range)', () => {
    expect(resolveCorrectAnswerIndex('F', OPTIONS)).toBeNull();
  });

  it('returns null for letter A when options is empty (index out of bounds)', () => {
    expect(resolveCorrectAnswerIndex('A', [])).toBeNull();
  });

  // ── Numeric string input ──

  it('resolves numeric string "0" → 0', () => {
    expect(resolveCorrectAnswerIndex('0', OPTIONS)).toBe(0);
  });

  it('resolves numeric string "4" → 4', () => {
    expect(resolveCorrectAnswerIndex('4', OPTIONS)).toBe(4);
  });

  it('returns null for numeric string "5" when there are only 5 options (0–4)', () => {
    expect(resolveCorrectAnswerIndex('5', OPTIONS)).toBeNull();
  });

  // ── Full-text fallback ──

  it('resolves full option text via indexOf match', () => {
    expect(resolveCorrectAnswerIndex('Opt B text', OPTIONS)).toBe(1);
    expect(resolveCorrectAnswerIndex('Opt E text', OPTIONS)).toBe(4);
  });

  it('returns null for full text not present in options', () => {
    expect(resolveCorrectAnswerIndex('Unknown option', OPTIONS)).toBeNull();
  });

  // ── Edge cases ──

  it('returns null for empty string', () => {
    expect(resolveCorrectAnswerIndex('', OPTIONS)).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(resolveCorrectAnswerIndex('   ', OPTIONS)).toBeNull();
  });

  it('returns null for null input', () => {
    // @ts-expect-error testing runtime behavior
    expect(resolveCorrectAnswerIndex(null, OPTIONS)).toBeNull();
  });

  it('returns null for undefined input', () => {
    // @ts-expect-error testing runtime behavior
    expect(resolveCorrectAnswerIndex(undefined, OPTIONS)).toBeNull();
  });
});
