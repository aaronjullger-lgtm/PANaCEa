import { describe, expect, it } from 'vitest';
import {
  JACCARD_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
  normalizeMedicalTerms,
  tokenizeForCache,
} from './tokenMatchCache';

describe('tokenMatchCache', () => {
  it('tokenizes and strips punctuation', () => {
    expect(tokenizeForCache('Heart-Attack!')).toEqual(['heart', 'attack']);
  });

  it('returns 1 for identical token sets', () => {
    expect(jaccardSimilarity(['mi', 'chest'], ['mi', 'chest'])).toBe(1);
  });

  it('returns 0 for disjoint token sets', () => {
    expect(jaccardSimilarity(['mi'], ['copd'])).toBe(0);
  });

  it('normalizes synonymous medical terms', () => {
    expect(normalizeMedicalTerms('heart attack')).toBe('mi');
    expect(normalizeMedicalTerms('myocardial infarction')).toBe('mi');
  });

  it('uses the documented similarity threshold', () => {
    expect(JACCARD_SIMILARITY_THRESHOLD).toBe(0.85);
  });
});
