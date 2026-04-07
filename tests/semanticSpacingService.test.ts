/**
 * Semantic Spacing Service — Unit Tests (Tier 2, Feature 1)
 *
 * Tests the KARL-inspired greedy maximum-minimum similarity spacing
 * algorithm, similarity matrix construction, domain interleaving,
 * and IRT/Elo composition.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSimilarityMatrix,
  lookupSimilarity,
  normalizePairKey,
  greedySimilaritySpacing,
  domainDiversityScore,
  findCloseHighSimilarityPairs,
  composeWithIrtOrdering,
  DEFAULT_LOOKBACK,
  DEFAULT_PRIORITY_WEIGHT,
  HIGH_SIMILARITY_THRESHOLD,
  type EmbeddedCard,
} from '../lib/services/semanticSpacingService';

// ─── Helpers ────────────────────────────────────────────────────

/** Generate a random unit vector of given dimension */
function randomEmbedding(dim: number = 768): number[] {
  const vec = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map(v => v / norm);
}

/** Generate a vector similar to a base vector (perturbed) */
function similarEmbedding(base: number[], noise: number = 0.1): number[] {
  const perturbed = base.map(v => v + (Math.random() - 0.5) * noise);
  const norm = Math.sqrt(perturbed.reduce((s, v) => s + v * v, 0));
  return perturbed.map(v => v / norm);
}

/** Create an EmbeddedCard with a specific embedding */
function makeCard(id: string, embedding: number[], domain?: string, priority?: number): EmbeddedCard {
  return { cardId: id, embedding, domain, priorityScore: priority };
}

// ─── normalizePairKey ───────────────────────────────────────────

describe('normalizePairKey', () => {
  it('produces consistent key regardless of order', () => {
    expect(normalizePairKey('a', 'b')).toBe(normalizePairKey('b', 'a'));
  });

  it('sorts alphabetically', () => {
    expect(normalizePairKey('zebra', 'apple')).toBe('apple|||zebra');
  });

  it('handles identical IDs', () => {
    expect(normalizePairKey('same', 'same')).toBe('same|||same');
  });
});

// ─── buildSimilarityMatrix ──────────────────────────────────────

describe('buildSimilarityMatrix', () => {
  it('returns empty map for empty input', () => {
    expect(buildSimilarityMatrix([]).size).toBe(0);
  });

  it('returns empty map for single card', () => {
    const card = makeCard('a', randomEmbedding());
    expect(buildSimilarityMatrix([card]).size).toBe(0);
  });

  it('computes correct number of pairs', () => {
    const cards = ['a', 'b', 'c', 'd'].map(id => makeCard(id, randomEmbedding()));
    const matrix = buildSimilarityMatrix(cards);
    // C(4,2) = 6 pairs
    expect(matrix.size).toBe(6);
  });

  it('identical vectors have similarity ~1.0', () => {
    const emb = randomEmbedding();
    const cards = [makeCard('a', emb), makeCard('b', [...emb])];
    const matrix = buildSimilarityMatrix(cards);
    const sim = lookupSimilarity(matrix, 'a', 'b');
    expect(sim).toBeCloseTo(1.0, 4);
  });

  it('similar vectors have high similarity', () => {
    const base = randomEmbedding();
    const cards = [
      makeCard('a', base),
      makeCard('b', similarEmbedding(base, 0.05)),
    ];
    const matrix = buildSimilarityMatrix(cards);
    expect(lookupSimilarity(matrix, 'a', 'b')).toBeGreaterThan(0.9);
  });
});

// ─── lookupSimilarity ───────────────────────────────────────────

describe('lookupSimilarity', () => {
  it('returns 1.0 for same card', () => {
    expect(lookupSimilarity(new Map(), 'a', 'a')).toBe(1.0);
  });

  it('returns 0 for unknown pair', () => {
    expect(lookupSimilarity(new Map(), 'a', 'b')).toBe(0);
  });

  it('is symmetric', () => {
    const matrix = new Map([['a|||b', 0.75]]);
    expect(lookupSimilarity(matrix, 'a', 'b')).toBe(0.75);
    expect(lookupSimilarity(matrix, 'b', 'a')).toBe(0.75);
  });
});

// ─── greedySimilaritySpacing ────────────────────────────────────

describe('greedySimilaritySpacing', () => {
  it('returns empty array for empty input', () => {
    expect(greedySimilaritySpacing([])).toEqual([]);
  });

  it('returns single card unchanged', () => {
    const card = makeCard('only', randomEmbedding());
    const result = greedySimilaritySpacing([card]);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardId).toBe('only');
    expect(result[0]!.position).toBe(0);
  });

  it('produces an ordering of all input cards', () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      makeCard(`c${i}`, randomEmbedding())
    );
    const result = greedySimilaritySpacing(cards);
    expect(result).toHaveLength(10);
    const ids = new Set(result.map(r => r.cardId));
    expect(ids.size).toBe(10);
  });

  it('separates similar cards', () => {
    // Create 2 clusters: A-group (similar) and B-group (similar)
    const baseA = randomEmbedding(64);
    const baseB = randomEmbedding(64);

    const cards = [
      makeCard('a1', similarEmbedding(baseA, 0.02)),
      makeCard('a2', similarEmbedding(baseA, 0.02)),
      makeCard('a3', similarEmbedding(baseA, 0.02)),
      makeCard('b1', similarEmbedding(baseB, 0.02)),
      makeCard('b2', similarEmbedding(baseB, 0.02)),
      makeCard('b3', similarEmbedding(baseB, 0.02)),
    ];

    const result = greedySimilaritySpacing(cards);
    const ids = result.map(r => r.cardId);

    // With 3 A-cards and 3 B-cards, a good spacing should interleave them
    // Check that no two consecutive cards are from the same cluster
    let consecutiveSame = 0;
    for (let i = 1; i < ids.length; i++) {
      const prevCluster = ids[i - 1]![0]; // 'a' or 'b'
      const currCluster = ids[i]![0];
      if (prevCluster === currCluster) consecutiveSame++;
    }

    // With greedy spacing, we expect at most 1-2 consecutive same-cluster cards
    // (due to the limited pool size). Strict interleaving isn't guaranteed but
    // should be much better than random.
    expect(consecutiveSame).toBeLessThanOrEqual(3);
  });

  it('respects priority weights', () => {
    const emb = randomEmbedding(64);
    const cards = [
      makeCard('low', emb, undefined, 0.1),
      makeCard('high', similarEmbedding(emb, 0.5), undefined, 1.0),
      makeCard('mid', similarEmbedding(emb, 0.5), undefined, 0.5),
    ];

    // With high priority weight, highest-priority card should be first
    const result = greedySimilaritySpacing(cards, { priorityWeight: 0.9 });
    expect(result[0]!.cardId).toBe('high');
  });

  it('assigns sequential positions', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard(`c${i}`, randomEmbedding())
    );
    const result = greedySimilaritySpacing(cards);
    const positions = result.map(r => r.position);
    expect(positions).toEqual([0, 1, 2, 3, 4]);
  });

  it('sets minSimilarityToPreceding to 0 for first card', () => {
    const cards = Array.from({ length: 3 }, (_, i) =>
      makeCard(`c${i}`, randomEmbedding())
    );
    const result = greedySimilaritySpacing(cards);
    expect(result[0]!.minSimilarityToPreceding).toBe(0);
  });
});

// ─── domainDiversityScore ───────────────────────────────────────

describe('domainDiversityScore', () => {
  it('returns 1.0 for single card', () => {
    expect(domainDiversityScore(['a'], new Map([['a', 'CV']]))).toBe(1.0);
  });

  it('returns 1.0 for perfectly interleaved domains', () => {
    const order = ['a', 'b', 'c', 'd'];
    const domains = new Map([
      ['a', 'CV'], ['b', 'PULM'], ['c', 'CV'], ['d', 'PULM'],
    ]);
    expect(domainDiversityScore(order, domains)).toBe(1.0);
  });

  it('returns 0.0 for all-same domain', () => {
    const order = ['a', 'b', 'c'];
    const domains = new Map([
      ['a', 'CV'], ['b', 'CV'], ['c', 'CV'],
    ]);
    expect(domainDiversityScore(order, domains)).toBe(0.0);
  });

  it('returns intermediate score for partial interleaving', () => {
    // CV, CV, PULM, PULM → 1 switch out of 3 pairs = 0.333
    const order = ['a', 'b', 'c', 'd'];
    const domains = new Map([
      ['a', 'CV'], ['b', 'CV'], ['c', 'PULM'], ['d', 'PULM'],
    ]);
    const score = domainDiversityScore(order, domains);
    expect(score).toBeCloseTo(1 / 3, 2);
  });
});

// ─── findCloseHighSimilarityPairs ───────────────────────────────

describe('findCloseHighSimilarityPairs', () => {
  it('returns empty array when no high-similarity pairs exist', () => {
    const order = [
      { cardId: 'a', position: 0, minSimilarityToPreceding: 0 },
      { cardId: 'b', position: 1, minSimilarityToPreceding: 0.3 },
    ];
    const matrix = new Map([['a|||b', 0.5]]); // Below threshold
    expect(findCloseHighSimilarityPairs(order, matrix)).toEqual([]);
  });

  it('detects adjacent high-similarity pair', () => {
    const order = [
      { cardId: 'a', position: 0, minSimilarityToPreceding: 0 },
      { cardId: 'b', position: 1, minSimilarityToPreceding: 0.9 },
    ];
    const matrix = new Map([['a|||b', 0.92]]);
    const warnings = findCloseHighSimilarityPairs(order, matrix);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.similarity).toBe(0.92);
    expect(warnings[0]!.separation).toBe(1);
  });

  it('ignores pairs beyond maxSeparation', () => {
    const order = Array.from({ length: 6 }, (_, i) => ({
      cardId: `c${i}`,
      position: i,
      minSimilarityToPreceding: 0,
    }));
    // c0 and c5 are very similar but 5 apart (beyond default max of 3)
    const matrix = new Map([['c0|||c5', 0.95]]);
    expect(findCloseHighSimilarityPairs(order, matrix, 3)).toEqual([]);
  });
});

// ─── composeWithIrtOrdering ─────────────────────────────────────

describe('composeWithIrtOrdering', () => {
  it('returns empty for empty input', () => {
    expect(composeWithIrtOrdering([], new Map())).toEqual([]);
  });

  it('skips cards without embeddings', () => {
    const embeddings = new Map([
      ['a', randomEmbedding(64)],
      // 'b' has no embedding
    ]);
    const result = composeWithIrtOrdering(['a', 'b'], embeddings);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardId).toBe('a');
  });

  it('preserves all cards with embeddings', () => {
    const embeddings = new Map([
      ['a', randomEmbedding(64)],
      ['b', randomEmbedding(64)],
      ['c', randomEmbedding(64)],
    ]);
    const result = composeWithIrtOrdering(['a', 'b', 'c'], embeddings);
    expect(result).toHaveLength(3);
    const ids = new Set(result.map(r => r.cardId));
    expect(ids).toEqual(new Set(['a', 'b', 'c']));
  });

  it('gives higher priority to IRT-first cards', () => {
    // Create 3 very different embeddings so spacing doesn't dominate
    const embeddings = new Map([
      ['first', randomEmbedding(64)],
      ['second', randomEmbedding(64)],
      ['third', randomEmbedding(64)],
    ]);
    // With high priority weight, IRT order should be roughly preserved
    const result = composeWithIrtOrdering(
      ['first', 'second', 'third'],
      embeddings,
      { priorityWeight: 0.9 }
    );
    expect(result[0]!.cardId).toBe('first');
  });
});

// ─── Integration: spacing quality ───────────────────────────────

describe('spacing quality', () => {
  it('spaced ordering has better similarity separation than naive', () => {
    // Create clustered cards that naive ordering would group together
    const baseA = randomEmbedding(128);
    const baseB = randomEmbedding(128);
    const baseC = randomEmbedding(128);

    const cards: EmbeddedCard[] = [
      makeCard('a1', similarEmbedding(baseA, 0.03)),
      makeCard('a2', similarEmbedding(baseA, 0.03)),
      makeCard('b1', similarEmbedding(baseB, 0.03)),
      makeCard('b2', similarEmbedding(baseB, 0.03)),
      makeCard('c1', similarEmbedding(baseC, 0.03)),
      makeCard('c2', similarEmbedding(baseC, 0.03)),
    ];

    const spaced = greedySimilaritySpacing(cards, { priorityWeight: 0 });

    // Compute average consecutive similarity for spaced vs naive
    const matrix = buildSimilarityMatrix(cards);

    function avgConsecutiveSim(order: string[]): number {
      let total = 0;
      for (let i = 1; i < order.length; i++) {
        total += lookupSimilarity(matrix, order[i - 1]!, order[i]!);
      }
      return total / (order.length - 1);
    }

    const spacedAvg = avgConsecutiveSim(spaced.map(s => s.cardId));
    const naiveAvg = avgConsecutiveSim(cards.map(c => c.cardId));

    // Spaced ordering should have LOWER average consecutive similarity
    // (i.e., more spacing between similar items)
    expect(spacedAvg).toBeLessThan(naiveAvg);
  });
});
