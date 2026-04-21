/**
 * Unit tests for lib/evaluation/embeddingBenchmark.ts
 *
 * Only the pure metric functions are tested here — runBenchmark requires
 * live embedding providers and belongs in integration tests.
 *
 * Math under test:
 *   cosineSimilarity:   dot(a,b) / (|a| * |b|)
 *   hitAtK:             fraction of queries with ≥1 relevant doc in top K
 *   meanReciprocalRank: mean of 1/(first relevant rank)
 *   ndcg:               DCG/IDCG with binary relevance, log2(i+2) discount
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  hitAtK,
  meanReciprocalRank,
  ndcg,
  type BenchmarkQuery,
} from './embeddingBenchmark';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeQuery(id: string, relevantDocIds: string[], domain?: string): BenchmarkQuery {
  return { id, query: `query for ${id}`, relevantDocIds, domain };
}

// ─── cosineSimilarity ─────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical non-zero vectors', () => {
    const v = [0.3, 0.4, 0.5, 0.6];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('returns -1.0 for exactly opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
  });

  it('is commutative: sim(a,b) === sim(b,a)', () => {
    const a = [0.1, 0.9, 0.4, 0.2];
    const b = [0.5, 0.3, 0.7, 0.1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('returns 0 for zero vectors (avoids division by zero)', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('throws for mismatched dimensions', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/i);
  });

  it('result is in [-1, 1] for arbitrary unit vectors', () => {
    const a = [0.6, 0.8, 0.0]; // already unit
    const b = [0.0, 0.6, 0.8];
    const result = cosineSimilarity(a, b);
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('correctly scales with magnitude (cosine is scale-invariant)', () => {
    const a = [1, 0];
    const b = [100, 0]; // same direction, different magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  it('computes a known value: [1,1] vs [1,0] = 1/√2 ≈ 0.7071', () => {
    const result = cosineSimilarity([1, 1], [1, 0]);
    expect(result).toBeCloseTo(1 / Math.sqrt(2), 5);
  });
});

// ─── hitAtK ──────────────────────────────────────────────────────────────────

describe('hitAtK', () => {
  it('returns 0 for empty rankings', () => {
    const queries = [makeQuery('q1', ['doc1'])];
    expect(hitAtK([], queries, 5)).toBe(0);
  });

  it('returns 1.0 when every query hits at rank 1', () => {
    const queries = [
      makeQuery('q1', ['a']),
      makeQuery('q2', ['b']),
    ];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a', 'x', 'y'] },
      { queryId: 'q2', rankedDocIds: ['b', 'x', 'y'] },
    ];
    expect(hitAtK(rankings, queries, 1)).toBe(1.0);
  });

  it('returns 0.5 when half the queries hit within top K', () => {
    const queries = [
      makeQuery('q1', ['a']),
      makeQuery('q2', ['z']),
    ];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a', 'b', 'c'] },
      { queryId: 'q2', rankedDocIds: ['x', 'y', 'w'] }, // 'z' not in top 3
    ];
    expect(hitAtK(rankings, queries, 3)).toBeCloseTo(0.5, 5);
  });

  it('miss when relevant doc is outside top K', () => {
    const queries = [makeQuery('q1', ['target'])];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a', 'b', 'c', 'd', 'target'] }, // rank 5
    ];
    expect(hitAtK(rankings, queries, 3)).toBe(0); // top-3 miss
    expect(hitAtK(rankings, queries, 5)).toBe(1); // top-5 hit
  });

  it('hit when any of multiple relevant docs appears in top K', () => {
    const queries = [makeQuery('q1', ['a', 'b', 'c'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['x', 'y', 'b'] }];
    expect(hitAtK(rankings, queries, 3)).toBe(1); // 'b' is rank 3
  });

  it('skips queries with no matching entry in rankings', () => {
    const queries = [makeQuery('q1', ['a']), makeQuery('q-missing', ['z'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a'] }];
    // Only q1 is in rankings; q-missing skipped
    expect(hitAtK(rankings, queries, 1)).toBe(1.0); // 1/1 hit
  });

  it('result is in [0, 1] for any K', () => {
    const queries = [makeQuery('q1', ['a']), makeQuery('q2', ['b'])];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a'] },
      { queryId: 'q2', rankedDocIds: ['x'] },
    ];
    for (const k of [1, 5, 10]) {
      const result = hitAtK(rankings, queries, k);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

// ─── meanReciprocalRank ───────────────────────────────────────────────────────

describe('meanReciprocalRank', () => {
  it('returns 0 for empty rankings', () => {
    expect(meanReciprocalRank([], [makeQuery('q1', ['a'])])).toBe(0);
  });

  it('returns 1.0 when all relevant docs are at rank 1', () => {
    const queries = [makeQuery('q1', ['a']), makeQuery('q2', ['b'])];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a', 'x'] },
      { queryId: 'q2', rankedDocIds: ['b', 'y'] },
    ];
    expect(meanReciprocalRank(rankings, queries)).toBe(1.0);
  });

  it('returns 0.5 when the only relevant doc is at rank 2', () => {
    const queries = [makeQuery('q1', ['b'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c'] }];
    expect(meanReciprocalRank(rankings, queries)).toBeCloseTo(0.5, 5);
  });

  it('returns 1/3 when the only relevant doc is at rank 3', () => {
    const queries = [makeQuery('q1', ['c'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c'] }];
    expect(meanReciprocalRank(rankings, queries)).toBeCloseTo(1 / 3, 5);
  });

  it('averages RR across multiple queries correctly', () => {
    // q1: rank 1 → RR=1; q2: rank 2 → RR=0.5; q3: miss → RR=0
    const queries = [
      makeQuery('q1', ['a']),
      makeQuery('q2', ['b']),
      makeQuery('q3', ['z']),
    ];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a', 'x'] },
      { queryId: 'q2', rankedDocIds: ['x', 'b'] },
      { queryId: 'q3', rankedDocIds: ['x', 'y'] },
    ];
    const expected = (1 + 0.5 + 0) / 3;
    expect(meanReciprocalRank(rankings, queries)).toBeCloseTo(expected, 5);
  });

  it('uses first relevant rank (not best)', () => {
    // Relevant docs are [a, c]; 'a' is at rank 2, 'c' is at rank 1 → first match is 'c' at rank 1
    const queries = [makeQuery('q1', ['a', 'c'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['c', 'a', 'b'] }];
    // First relevant is rank 1 → RR=1
    expect(meanReciprocalRank(rankings, queries)).toBe(1.0);
  });

  it('returns value in [0, 1]', () => {
    const queries = [makeQuery('q1', ['a'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['x', 'y', 'a'] }];
    const result = meanReciprocalRank(rankings, queries);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ─── ndcg ─────────────────────────────────────────────────────────────────────

describe('ndcg', () => {
  it('returns 0 for empty rankings', () => {
    expect(ndcg([], [makeQuery('q1', ['a'])])).toBe(0);
  });

  it('returns 1.0 for perfect ranking (all relevant at top)', () => {
    const queries = [makeQuery('q1', ['a', 'b'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c', 'd'] }];
    expect(ndcg(rankings, queries)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 when no relevant docs in ranking', () => {
    const queries = [makeQuery('q1', ['z'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c'] }];
    expect(ndcg(rankings, queries)).toBe(0);
  });

  it('score degrades when relevant doc is pushed further down', () => {
    const queries = [makeQuery('q1', ['target'])];
    const perfectRankings = [{ queryId: 'q1', rankedDocIds: ['target', 'b', 'c', 'd'] }]; // rank 1
    const degradedRankings = [{ queryId: 'q1', rankedDocIds: ['b', 'c', 'target', 'd'] }]; // rank 3

    expect(ndcg(perfectRankings, queries)).toBeGreaterThan(ndcg(degradedRankings, queries));
  });

  it('single relevant doc at rank 1: NDCG = 1.0 (DCG = IDCG = 1/log2(2) = 1)', () => {
    const queries = [makeQuery('q1', ['a'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c'] }];
    expect(ndcg(rankings, queries)).toBeCloseTo(1.0, 5);
  });

  it('single relevant doc at rank 2: NDCG = DCG/IDCG = (1/log2(3))/(1/log2(2))', () => {
    const queries = [makeQuery('q1', ['b'])];
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c'] }];
    // DCG@3 = 0/log2(2) + 1/log2(3) = 1/log2(3)
    // IDCG@1 = 1/log2(2) = 1
    const expected = (1 / Math.log2(3)) / 1;
    expect(ndcg(rankings, queries)).toBeCloseTo(expected, 5);
  });

  it('averages NDCG across multiple queries', () => {
    const queries = [makeQuery('q1', ['a']), makeQuery('q2', ['z'])];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['a', 'b'] }, // NDCG=1.0
      { queryId: 'q2', rankedDocIds: ['x', 'y'] }, // NDCG=0.0 (miss)
    ];
    // Average = (1.0 + 0) / 2 = 0.5
    expect(ndcg(rankings, queries)).toBeCloseTo(0.5, 5);
  });

  it('respects K cutoff — docs after K are not counted', () => {
    const queries = [makeQuery('q1', ['target'])];
    // target is at rank 5; with K=3 it should be excluded → NDCG=0
    const rankings = [{ queryId: 'q1', rankedDocIds: ['a', 'b', 'c', 'd', 'target'] }];
    expect(ndcg(rankings, queries, 3)).toBe(0);
    // But within K=5 it contributes
    expect(ndcg(rankings, queries, 5)).toBeGreaterThan(0);
  });

  it('result is in [0, 1]', () => {
    const queries = [makeQuery('q1', ['a', 'b']), makeQuery('q2', ['c'])];
    const rankings = [
      { queryId: 'q1', rankedDocIds: ['b', 'x', 'a'] },
      { queryId: 'q2', rankedDocIds: ['x', 'y', 'c'] },
    ];
    const result = ndcg(rankings, queries);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});
