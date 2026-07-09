import { describe, expect, it } from 'vitest';

import {
  JACCARD_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
  normalizeMedicalTerms,
  tokenizeForCache,
} from './tokenMatchCache';

describe('tokenMatchCache', () => {
  it('normalizes common medical synonyms before token matching', () => {
    const queryTokens = tokenizeForCache(
      normalizeMedicalTerms('Which ECG findings suggest myocardial infarction?')
    );
    const cacheTokens = tokenizeForCache(normalizeMedicalTerms('Which ECG findings suggest heart attack?'));

    expect(queryTokens).toContain('mi');
    expect(cacheTokens).toContain('mi');
    expect(jaccardSimilarity(queryTokens, cacheTokens)).toBe(1);
  });

  it('computes Jaccard similarity with duplicate tokens ignored', () => {
    const similarity = jaccardSimilarity(
      ['copd', 'copd', 'exacerbation'],
      ['copd', 'exacerbation', 'treatment']
    );

    // intersection={copd, exacerbation}; union={copd, exacerbation, treatment}
    expect(similarity).toBeCloseTo(2 / 3, 6);
  });

  it('keeps the production cache hit threshold aligned with the Edge wrapper', () => {
    expect(JACCARD_SIMILARITY_THRESHOLD).toBe(0.85);
  });
});
