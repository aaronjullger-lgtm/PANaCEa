import { describe, it, expect } from 'vitest';
import {
  tokenizeForCache,
  jaccardSimilarity,
  normalizeMedicalTerms,
} from './tokenMatchCache';

describe('tokenizeForCache', () => {
  it('splits on whitespace and lowercases', () => {
    expect(tokenizeForCache('Heart Attack Treatment')).toEqual([
      'heart',
      'attack',
      'treatment',
    ]);
  });

  it('strips punctuation', () => {
    expect(tokenizeForCache('MI: diagnosis, treatment!')).toEqual([
      'mi',
      'diagnosis',
      'treatment',
    ]);
  });

  it('filters empty tokens', () => {
    expect(tokenizeForCache('  a   b  ')).toEqual(['a', 'b']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenizeForCache('')).toEqual([]);
  });
});

describe('jaccardSimilarity', () => {
  it('returns 1 for identical sets', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('returns 0.5 for half-overlap', () => {
    // intersection = {b,c}, union = {a,b,c,d} → 2/4 = 0.5
    expect(jaccardSimilarity(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(0.5);
  });

  it('returns 0 when both sets are empty', () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  it('returns 0 when one set is empty', () => {
    expect(jaccardSimilarity(['a', 'b'], [])).toBe(0);
  });

  it('ignores duplicate tokens (set semantics)', () => {
    // intersection = {a}, union = {a} → 1/1 = 1
    expect(jaccardSimilarity(['a', 'a', 'a'], ['a'])).toBe(1);
  });
});

describe('normalizeMedicalTerms', () => {
  it('normalizes myocardial infarction synonyms', () => {
    expect(normalizeMedicalTerms('heart attack treatment')).toContain('mi');
    expect(normalizeMedicalTerms('myocardial infarction treatment')).toContain('mi');
    expect(normalizeMedicalTerms('STEMI management')).toContain('mi');
  });

  it('normalizes diabetes variants', () => {
    const result = normalizeMedicalTerms('type 2 diabetes complications');
    expect(result).toContain('diabetes');
    expect(result).not.toContain('type 2 diabetes');
  });

  it('normalizes heart failure synonyms', () => {
    expect(normalizeMedicalTerms('congestive heart failure')).toContain('chf');
    expect(normalizeMedicalTerms('heart failure management')).toContain('chf');
  });

  it('normalizes COPD synonyms', () => {
    expect(normalizeMedicalTerms('chronic obstructive pulmonary disease')).toContain(
      'copd'
    );
  });

  it('normalizes pneumonia synonyms', () => {
    expect(normalizeMedicalTerms('community acquired pneumonia')).toContain('pneumonia');
  });

  it('lowercases output even without normalizations', () => {
    expect(normalizeMedicalTerms('Aspirin Allergy')).toBe('aspirin allergy');
  });
});
