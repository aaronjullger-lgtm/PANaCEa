/**
 * Tests for lib/utils/questionDataNormalizer.ts
 *
 * Verifies option normalization across all supported formats:
 * - String arrays
 * - Object arrays (Anki/structured imports)
 * - Key-value objects
 * - JSON strings
 * - Edge cases (null, undefined, empty, invalid)
 */

import { describe, it, expect } from 'vitest';
import { normalizeOptionsToArray, hasValidOptions } from '@/lib/utils/questionDataNormalizer';

describe('normalizeOptionsToArray', () => {
  describe('string arrays', () => {
    it('returns strings as-is', () => {
      const result = normalizeOptionsToArray(['Option A', 'Option B', 'Option C', 'Option D']);
      expect(result).toEqual(['Option A', 'Option B', 'Option C', 'Option D']);
    });

    it('filters out empty strings', () => {
      const result = normalizeOptionsToArray(['A', '', '  ', 'B']);
      expect(result).toEqual(['A', 'B']);
    });

    it('handles single-element arrays', () => {
      const result = normalizeOptionsToArray(['Only option']);
      expect(result).toEqual(['Only option']);
    });

    it('returns empty array for all-empty array', () => {
      const result = normalizeOptionsToArray(['', '  ', '\t']);
      expect(result).toEqual([]);
    });
  });

  describe('object arrays (Anki/structured imports)', () => {
    it('extracts value field', () => {
      const result = normalizeOptionsToArray([
        { value: 'A' },
        { value: 'B' },
        { value: 'C' },
        { value: 'D' },
      ]);
      expect(result).toEqual(['A', 'B', 'C', 'D']);
    });

    it('falls back to text field when value is missing', () => {
      const result = normalizeOptionsToArray([
        { text: 'First' },
        { text: 'Second' },
      ]);
      expect(result).toEqual(['First', 'Second']);
    });

    it('falls back to label field when value and text are missing', () => {
      const result = normalizeOptionsToArray([
        { label: 'Label A' },
        { label: 'Label B' },
      ]);
      expect(result).toEqual(['Label A', 'Label B']);
    });

    it('prioritizes value over text over label', () => {
      const result = normalizeOptionsToArray([
        { value: 'V', text: 'T', label: 'L' },
      ]);
      expect(result).toEqual(['V']);
    });

    it('prioritizes text over label when value is missing', () => {
      const result = normalizeOptionsToArray([
        { text: 'T', label: 'L' },
      ]);
      expect(result).toEqual(['T']);
    });

    it('handles mixed string and object elements', () => {
      const result = normalizeOptionsToArray(['A', { value: 'B' }, 'C']);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('converts non-string extracted values to string', () => {
      const result = normalizeOptionsToArray([{ value: 42 }]);
      expect(result).toEqual(['42']);
    });

    it('falls through to String() for objects with no extractable text', () => {
      const result = normalizeOptionsToArray([{ foo: 'bar' }, { value: 'kept' }]);
      // Object without value/text/label falls to String(opt) = "[object Object]"
      expect(result).toContain('[object Object]');
      expect(result).toContain('kept');
    });

    it('handles null elements in array', () => {
      const result = normalizeOptionsToArray([null, 'A', undefined, 'B']);
      // null and undefined get String() called, resulting in 'null' and 'undefined'
      // Actually: null is object, checks value/text/label — all undefined, falls to String(null) = 'null'
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result).toContain('A');
      expect(result).toContain('B');
    });
  });

  describe('key-value objects', () => {
    it('sorts by key and returns values', () => {
      const result = normalizeOptionsToArray({ D: 'Delta', B: 'Bravo', A: 'Alpha', C: 'Charlie' });
      expect(result).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    });

    it('filters non-string values', () => {
      const result = normalizeOptionsToArray({ A: 'text', B: 42, C: 'more text' });
      expect(result).toEqual(['text', 'more text']);
    });

    it('handles empty object', () => {
      const result = normalizeOptionsToArray({});
      expect(result).toEqual([]);
    });
  });

  describe('JSON strings', () => {
    it('parses valid JSON string array', () => {
      const result = normalizeOptionsToArray('["A","B","C"]');
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('parses valid JSON object', () => {
      const result = normalizeOptionsToArray('{"B":"Beta","A":"Alpha"}');
      expect(result).toEqual(['Alpha', 'Beta']);
    });

    it('returns empty array for invalid JSON string', () => {
      const result = normalizeOptionsToArray('not valid json');
      expect(result).toEqual([]);
    });

    it('returns empty array for plain text string', () => {
      const result = normalizeOptionsToArray('just some text');
      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for null', () => {
      const result = normalizeOptionsToArray(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      const result = normalizeOptionsToArray(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for number', () => {
      const result = normalizeOptionsToArray(42);
      expect(result).toEqual([]);
    });

    it('returns empty array for boolean', () => {
      const result = normalizeOptionsToArray(true);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      const result = normalizeOptionsToArray([]);
      expect(result).toEqual([]);
    });
  });
});

describe('hasValidOptions', () => {
  it('returns true for 2+ options', () => {
    expect(hasValidOptions(['A', 'B'])).toBe(true);
    expect(hasValidOptions(['A', 'B', 'C', 'D'])).toBe(true);
    expect(hasValidOptions({ A: 'a', B: 'b' })).toBe(true);
  });

  it('returns false for less than 2 options', () => {
    expect(hasValidOptions(['A'])).toBe(false);
    expect(hasValidOptions([])).toBe(false);
    expect(hasValidOptions(null)).toBe(false);
    expect(hasValidOptions(undefined)).toBe(false);
    expect(hasValidOptions({})).toBe(false);
  });

  it('returns true when raw options have 2+ valid items after filtering', () => {
    expect(hasValidOptions(['A', '', 'B'])).toBe(true);
    expect(hasValidOptions(['A', '  ', 'B'])).toBe(true);
  });

  it('returns false when filtered options drop below 2', () => {
    expect(hasValidOptions(['A', ''])).toBe(false);
    expect(hasValidOptions(['', '  '])).toBe(false);
  });

  it('handles object-array format', () => {
    expect(hasValidOptions([{ value: 'A' }, { value: 'B' }])).toBe(true);
    expect(hasValidOptions([{ value: 'A' }])).toBe(false);
  });
});
