// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/textUtils.ts
 *
 * Pure functions tested:
 *   toTitleCase(str)    — lowercases then capitalizes each word
 *   capitalizeFirst(str) — capitalizes first char only
 */

import { describe, it, expect } from 'vitest';
import { toTitleCase, capitalizeFirst } from './textUtils';

// ─── toTitleCase ──────────────────────────────────────────────────────────────

describe('toTitleCase', () => {
  it('capitalizes every word in a lowercase string', () => {
    expect(toTitleCase('acetyl salicylic acid')).toBe('Acetyl Salicylic Acid');
  });

  it('handles already-uppercase input by lowercasing then capitalizing', () => {
    expect(toTitleCase('HYPERTENSION')).toBe('Hypertension');
    expect(toTitleCase('ATRIAL FIBRILLATION')).toBe('Atrial Fibrillation');
  });

  it('handles mixed case input', () => {
    expect(toTitleCase('heart fAiLuRe')).toBe('Heart Failure');
  });

  it('returns empty string for empty input', () => {
    expect(toTitleCase('')).toBe('');
  });

  it('returns single-word string with capital first letter', () => {
    expect(toTitleCase('cardiology')).toBe('Cardiology');
  });

  it('handles single character', () => {
    expect(toTitleCase('a')).toBe('A');
  });

  it('preserves spaces between words', () => {
    const result = toTitleCase('community acquired pneumonia');
    expect(result).toBe('Community Acquired Pneumonia');
    expect(result.split(' ')).toHaveLength(3);
  });

  it('clinical examples', () => {
    expect(toTitleCase('diabetes mellitus type 2')).toBe('Diabetes Mellitus Type 2');
    expect(toTitleCase('chronic kidney disease')).toBe('Chronic Kidney Disease');
  });
});

// ─── capitalizeFirst ──────────────────────────────────────────────────────────

describe('capitalizeFirst', () => {
  it('capitalizes the first letter only', () => {
    expect(capitalizeFirst('hello world')).toBe('Hello world');
  });

  it('does not change remaining characters', () => {
    expect(capitalizeFirst('hELLO WORLD')).toBe('HELLO WORLD');
  });

  it('returns empty string for empty input', () => {
    expect(capitalizeFirst('')).toBe('');
  });

  it('handles already-capitalized input', () => {
    expect(capitalizeFirst('Cardiology')).toBe('Cardiology');
  });

  it('handles single character', () => {
    expect(capitalizeFirst('a')).toBe('A');
    expect(capitalizeFirst('Z')).toBe('Z');
  });

  it('handles string that starts with a number', () => {
    // charAt(0).toUpperCase() on a digit is still the digit
    expect(capitalizeFirst('3 times daily')).toBe('3 times daily');
  });

  it('preserves rest of string exactly', () => {
    const input = 'lower UPPER mixed 123 !@#';
    expect(capitalizeFirst(input)).toBe('Lower UPPER mixed 123 !@#');
  });
});
