/**
 * Tests for canonical answer letter↔index conversion.
 * Proves:
 * 1. A–E letters are handled correctly (including "E" = 4)
 * 2. Malformed answers fail explicitly (return null), not silently (return 0)
 * 3. Strict variants throw with context
 * 4. resolveCorrectAnswerIndex handles all known DB formats
 */

import { describe, it, expect } from 'vitest';
import {
  letterToIndex,
  indexToLetter,
  letterToIndexStrict,
  indexToLetterStrict,
  isValidAnswerLetter,
  resolveCorrectAnswerIndex,
  ANSWER_LETTERS,
  MAX_OPTION_INDEX,
} from '../lib/answerLetterMap';

// ── letterToIndex ──────────────────────────────────────────────────────────────

describe('letterToIndex', () => {
  it('maps A→0, B→1, C→2, D→3, E→4', () => {
    expect(letterToIndex('A')).toBe(0);
    expect(letterToIndex('B')).toBe(1);
    expect(letterToIndex('C')).toBe(2);
    expect(letterToIndex('D')).toBe(3);
    expect(letterToIndex('E')).toBe(4);
  });

  it('is case-insensitive', () => {
    expect(letterToIndex('a')).toBe(0);
    expect(letterToIndex('e')).toBe(4);
  });

  it('returns null for F and beyond (not 0)', () => {
    expect(letterToIndex('F')).toBeNull();
    expect(letterToIndex('Z')).toBeNull();
  });

  it('returns null for empty string (not 0)', () => {
    expect(letterToIndex('')).toBeNull();
  });

  it('returns null for multi-character strings', () => {
    expect(letterToIndex('AB')).toBeNull();
    expect(letterToIndex('Metformin')).toBeNull();
  });

  it('returns null for numeric strings', () => {
    expect(letterToIndex('0')).toBeNull();
    expect(letterToIndex('1')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(letterToIndex(42 as unknown as string)).toBeNull();
    expect(letterToIndex(null as unknown as string)).toBeNull();
    expect(letterToIndex(undefined as unknown as string)).toBeNull();
  });
});

// ── indexToLetter ──────────────────────────────────────────────────────────────

describe('indexToLetter', () => {
  it('maps 0→A, 1→B, 2→C, 3→D, 4→E', () => {
    expect(indexToLetter(0)).toBe('A');
    expect(indexToLetter(1)).toBe('B');
    expect(indexToLetter(2)).toBe('C');
    expect(indexToLetter(3)).toBe('D');
    expect(indexToLetter(4)).toBe('E');
  });

  it('returns null for index 5+ (not silent fallback)', () => {
    expect(indexToLetter(5)).toBeNull();
    expect(indexToLetter(100)).toBeNull();
  });

  it('returns null for negative indices', () => {
    expect(indexToLetter(-1)).toBeNull();
  });

  it('returns null for non-integer values', () => {
    expect(indexToLetter(1.5)).toBeNull();
    expect(indexToLetter(NaN)).toBeNull();
  });

  it('returns null for non-number input', () => {
    expect(indexToLetter('A' as unknown as number)).toBeNull();
  });
});

// ── Strict variants ────────────────────────────────────────────────────────────

describe('letterToIndexStrict', () => {
  it('returns index for valid letters', () => {
    expect(letterToIndexStrict('D')).toBe(3);
    expect(letterToIndexStrict('E')).toBe(4);
  });

  it('throws for invalid letter with context', () => {
    expect(() => letterToIndexStrict('F', 'question-123')).toThrow(
      /Invalid answer letter "F".*question-123/
    );
  });

  it('throws for empty string', () => {
    expect(() => letterToIndexStrict('')).toThrow(/Invalid answer letter/);
  });
});

describe('indexToLetterStrict', () => {
  it('returns letter for valid index', () => {
    expect(indexToLetterStrict(4)).toBe('E');
  });

  it('throws for out-of-range index with context', () => {
    expect(() => indexToLetterStrict(5, 'quiz-456')).toThrow(
      /Invalid answer index 5.*quiz-456/
    );
  });
});

// ── isValidAnswerLetter ────────────────────────────────────────────────────────

describe('isValidAnswerLetter', () => {
  it('returns true for A–E', () => {
    for (const letter of ANSWER_LETTERS) {
      expect(isValidAnswerLetter(letter)).toBe(true);
    }
  });

  it('returns true for lowercase', () => {
    expect(isValidAnswerLetter('e')).toBe(true);
  });

  it('returns false for F and beyond', () => {
    expect(isValidAnswerLetter('F')).toBe(false);
    expect(isValidAnswerLetter('')).toBe(false);
    expect(isValidAnswerLetter('AB')).toBe(false);
  });
});

// ── resolveCorrectAnswerIndex ──────────────────────────────────────────────────

describe('resolveCorrectAnswerIndex', () => {
  const fiveOptions = ['Aspirin', 'Metformin', 'Lisinopril', 'Amoxicillin', 'Warfarin'];
  const fourOptions = fiveOptions.slice(0, 4);

  describe('letter format', () => {
    it('resolves A–D for 4-option questions', () => {
      expect(resolveCorrectAnswerIndex('A', fourOptions)).toBe(0);
      expect(resolveCorrectAnswerIndex('D', fourOptions)).toBe(3);
    });

    it('resolves E for 5-option questions', () => {
      expect(resolveCorrectAnswerIndex('E', fiveOptions)).toBe(4);
    });

    it('returns null when letter exceeds option count', () => {
      // E with only 4 options — the corruption bug this fix targets
      expect(resolveCorrectAnswerIndex('E', fourOptions)).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(resolveCorrectAnswerIndex('c', fourOptions)).toBe(2);
    });
  });

  describe('numeric string format', () => {
    it('resolves "0"–"3" for 4-option questions', () => {
      expect(resolveCorrectAnswerIndex('0', fourOptions)).toBe(0);
      expect(resolveCorrectAnswerIndex('3', fourOptions)).toBe(3);
    });

    it('resolves "4" for 5-option questions', () => {
      expect(resolveCorrectAnswerIndex('4', fiveOptions)).toBe(4);
    });

    it('returns null for out-of-range numeric', () => {
      expect(resolveCorrectAnswerIndex('4', fourOptions)).toBeNull();
      expect(resolveCorrectAnswerIndex('10', fourOptions)).toBeNull();
    });
  });

  describe('full-text match format', () => {
    it('matches exact option text', () => {
      expect(resolveCorrectAnswerIndex('Metformin', fourOptions)).toBe(1);
      expect(resolveCorrectAnswerIndex('Warfarin', fiveOptions)).toBe(4);
    });

    it('returns null when text does not match any option', () => {
      expect(resolveCorrectAnswerIndex('Ibuprofen', fourOptions)).toBeNull();
    });
  });

  describe('malformed input (must return null, never 0)', () => {
    it('returns null for empty string', () => {
      expect(resolveCorrectAnswerIndex('', fourOptions)).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(resolveCorrectAnswerIndex('   ', fourOptions)).toBeNull();
    });

    it('returns null for F and beyond', () => {
      expect(resolveCorrectAnswerIndex('F', fiveOptions)).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(resolveCorrectAnswerIndex(null as unknown as string, fourOptions)).toBeNull();
      expect(resolveCorrectAnswerIndex(undefined as unknown as string, fourOptions)).toBeNull();
    });
  });
});

// ── Constants ──────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('ANSWER_LETTERS has exactly 5 entries A–E', () => {
    expect(ANSWER_LETTERS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(ANSWER_LETTERS).toHaveLength(5);
  });

  it('MAX_OPTION_INDEX is 4', () => {
    expect(MAX_OPTION_INDEX).toBe(4);
  });
});
