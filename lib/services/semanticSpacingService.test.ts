/**
 * Unit tests for lib/services/semanticSpacingService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   normalizePairKey(idA, idB)
 *   lookupSimilarity(matrix, cardA, cardB)
 *   buildSimilarityMatrix(cards)
 *   domainDiversityScore(order, domainMap)
 *   findCloseHighSimilarityPairs(order, matrix, maxSeparation?)
 *   greedySimilaritySpacing(cards, config?)
 *   composeWithIrtOrdering(irtOrderedIds, embeddings, config?)
 *
 * Constants:
 *   DEFAULT_LOOKBACK = 5
 *   DEFAULT_PRIORITY_WEIGHT = 0.3
 *   HIGH_SIMILARITY_THRESHOLD = 0.85
 *
 * Similarity math:
 *   cosineSimilarity(a, b) — same-direction unit vectors → 1.0
 *   Orthogonal vectors → 0.0
 *   Identical vectors → 1.0
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePairKey,
  lookupSimilarity,
  buildSimilarityMatrix,
  domainDiversityScore,
  findCloseHighSimilarityPairs,
  greedySimilaritySpacing,
  composeWithIrtOrdering,
  DEFAULT_LOOKBACK,
  DEFAULT_PRIORITY_WEIGHT,
  HIGH_SIMILARITY_THRESHOLD,
  type EmbeddedCard,
  type SpacedCard,
} from './semanticSpacingService';

// ─── Test vectors ──────────────────────────────────────────────────────────────

// Orthogonal unit vectors in R³
const VEC_A = [1, 0, 0];
const VEC_B = [0, 1, 0];
const VEC_C = [0, 0, 1];

// Very similar vectors (near-parallel)
const VEC_SIM1 = [0.9, 0.1, 0.0];
const VEC_SIM2 = [0.95, 0.05, 0.0];

function makeCard(
  cardId: string,
  embedding: number[] = VEC_A,
  overrides: Partial<EmbeddedCard> = {}
): EmbeddedCard {
  return { cardId, embedding, ...overrides };
}

function makeSpaced(
  cardId: string,
  position: number,
  minSimilarityToPreceding: number = 0
): SpacedCard {
  return { cardId, position, minSimilarityToPreceding };
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('DEFAULT_LOOKBACK = 5', () => expect(DEFAULT_LOOKBACK).toBe(5));
  it('DEFAULT_PRIORITY_WEIGHT = 0.3', () => expect(DEFAULT_PRIORITY_WEIGHT).toBeCloseTo(0.3, 5));
  it('HIGH_SIMILARITY_THRESHOLD = 0.85', () => expect(HIGH_SIMILARITY_THRESHOLD).toBeCloseTo(0.85, 5));
});

// ─── normalizePairKey ──────────────────────────────────────────────────────────

describe('normalizePairKey', () => {
  it('returns same key regardless of argument order', () => {
    expect(normalizePairKey('alpha', 'beta')).toBe(normalizePairKey('beta', 'alpha'));
  });

  it('uses ||| separator', () => {
    const key = normalizePairKey('a', 'b');
    expect(key).toContain('|||');
  });

  it('lexicographically smaller ID comes first', () => {
    // 'a' < 'b' → 'a|||b'
    expect(normalizePairKey('a', 'b')).toBe('a|||b');
    expect(normalizePairKey('b', 'a')).toBe('a|||b');
  });

  it('same ID → normalized form contains it twice', () => {
    const key = normalizePairKey('x', 'x');
    expect(key).toBe('x|||x');
  });
});

// ─── lookupSimilarity ─────────────────────────────────────────────────────────

describe('lookupSimilarity', () => {
  it('returns 1.0 when cardA === cardB (self-similarity)', () => {
    const matrix = new Map<string, number>();
    expect(lookupSimilarity(matrix, 'q1', 'q1')).toBe(1.0);
  });

  it('returns 0 for unknown pair (not in matrix)', () => {
    const matrix = new Map<string, number>();
    expect(lookupSimilarity(matrix, 'q1', 'q2')).toBe(0);
  });

  it('returns stored value for known pair', () => {
    const matrix = new Map<string, number>([['a|||b', 0.72]]);
    expect(lookupSimilarity(matrix, 'a', 'b')).toBeCloseTo(0.72, 5);
    expect(lookupSimilarity(matrix, 'b', 'a')).toBeCloseTo(0.72, 5); // bidirectional
  });
});

// ─── buildSimilarityMatrix ────────────────────────────────────────────────────

describe('buildSimilarityMatrix', () => {
  it('empty input → empty matrix', () => {
    expect(buildSimilarityMatrix([])).toEqual(new Map());
  });

  it('single card → empty matrix (no pairs)', () => {
    const matrix = buildSimilarityMatrix([makeCard('q1', VEC_A)]);
    expect(matrix.size).toBe(0);
  });

  it('n cards → n*(n-1)/2 entries', () => {
    const cards = ['q1', 'q2', 'q3', 'q4'].map((id, i) =>
      makeCard(id, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, i === 3 ? 1 : 0])
    );
    const matrix = buildSimilarityMatrix(cards);
    expect(matrix.size).toBe(6); // 4*3/2
  });

  it('identical embeddings → similarity = 1.0', () => {
    const cards = [makeCard('q1', VEC_A), makeCard('q2', VEC_A)];
    const matrix = buildSimilarityMatrix(cards);
    const key = normalizePairKey('q1', 'q2');
    expect(matrix.get(key)).toBeCloseTo(1.0, 5);
  });

  it('orthogonal embeddings → similarity = 0', () => {
    const cards = [makeCard('q1', VEC_A), makeCard('q2', VEC_B)];
    const matrix = buildSimilarityMatrix(cards);
    const key = normalizePairKey('q1', 'q2');
    expect(matrix.get(key)).toBeCloseTo(0, 5);
  });

  it('similarity is symmetric (A↔B same as B↔A)', () => {
    const cards = [makeCard('q1', VEC_SIM1), makeCard('q2', VEC_SIM2)];
    const matrix = buildSimilarityMatrix(cards);
    const fwd = lookupSimilarity(matrix, 'q1', 'q2');
    const rev = lookupSimilarity(matrix, 'q2', 'q1');
    expect(fwd).toBeCloseTo(rev, 8);
  });

  it('similar vectors produce high similarity (> 0.9)', () => {
    const cards = [makeCard('q1', VEC_SIM1), makeCard('q2', VEC_SIM2)];
    const matrix = buildSimilarityMatrix(cards);
    expect(lookupSimilarity(matrix, 'q1', 'q2')).toBeGreaterThan(0.9);
  });
});

// ─── domainDiversityScore ─────────────────────────────────────────────────────

describe('domainDiversityScore', () => {
  it('empty order → 1.0', () => {
    expect(domainDiversityScore([], new Map())).toBe(1.0);
  });

  it('single card → 1.0', () => {
    expect(domainDiversityScore(['q1'], new Map([['q1', 'Cardiology']]))).toBe(1.0);
  });

  it('alternating domains → 1.0 (every pair switches)', () => {
    const order = ['q1', 'q2', 'q3', 'q4'];
    const domainMap = new Map([
      ['q1', 'Cardiology'],
      ['q2', 'Neurology'],
      ['q3', 'Cardiology'],
      ['q4', 'Neurology'],
    ]);
    expect(domainDiversityScore(order, domainMap)).toBeCloseTo(1.0, 5);
  });

  it('all same domain → 0.0', () => {
    const order = ['q1', 'q2', 'q3'];
    const domainMap = new Map([['q1', 'Cardiology'], ['q2', 'Cardiology'], ['q3', 'Cardiology']]);
    expect(domainDiversityScore(order, domainMap)).toBeCloseTo(0.0, 5);
  });

  it('mixed: 2 switches out of 3 pairs → 2/3', () => {
    // [Cardiology, Neurology, GI, GI] → switches at positions 0-1, 1-2 → 2/3
    const order = ['q1', 'q2', 'q3', 'q4'];
    const domainMap = new Map([
      ['q1', 'Cardiology'],
      ['q2', 'Neurology'],
      ['q3', 'GI'],
      ['q4', 'GI'],
    ]);
    expect(domainDiversityScore(order, domainMap)).toBeCloseTo(2 / 3, 5);
  });

  it('score is always in [0, 1]', () => {
    const order = ['q1', 'q2'];
    const domainMap = new Map([['q1', 'A'], ['q2', 'A']]);
    const score = domainDiversityScore(order, domainMap);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── findCloseHighSimilarityPairs ──────────────────────────────────────────────

describe('findCloseHighSimilarityPairs', () => {
  it('empty order → no warnings', () => {
    expect(findCloseHighSimilarityPairs([], new Map())).toEqual([]);
  });

  it('no high-similarity pairs within separation → no warnings', () => {
    const order = [makeSpaced('q1', 0), makeSpaced('q2', 1)];
    // Low similarity in matrix
    const matrix = new Map([['q1|||q2', 0.50]]);
    expect(findCloseHighSimilarityPairs(order, matrix)).toHaveLength(0);
  });

  it('high similarity pair within maxSeparation → warning emitted', () => {
    const order = [makeSpaced('q1', 0), makeSpaced('q2', 1)];
    const matrix = new Map([['q1|||q2', 0.90]]); // above 0.85 threshold
    const warnings = findCloseHighSimilarityPairs(order, matrix, 3);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.cardA).toBe('q1');
    expect(warnings[0]!.cardB).toBe('q2');
    expect(warnings[0]!.similarity).toBeCloseTo(0.90, 5);
    expect(warnings[0]!.separation).toBe(1);
  });

  it('high similarity pair BEYOND maxSeparation → no warning', () => {
    const order = [
      makeSpaced('q1', 0),
      makeSpaced('q2', 1),
      makeSpaced('q3', 2),
      makeSpaced('q4', 3),
      makeSpaced('q5', 4),
    ];
    // q1 and q5 are highly similar but 4 positions apart
    const matrix = new Map([['q1|||q5', 0.95]]);
    const warnings = findCloseHighSimilarityPairs(order, matrix, 3);
    // Separation = 4 > maxSeparation = 3 → not included
    expect(warnings.filter(w => w.cardA === 'q1' && w.cardB === 'q5')).toHaveLength(0);
  });

  it('multiple warnings for multiple high-similarity pairs', () => {
    const order = [
      makeSpaced('q1', 0),
      makeSpaced('q2', 1),
      makeSpaced('q3', 2),
    ];
    const matrix = new Map([
      ['q1|||q2', 0.92],
      ['q1|||q3', 0.88],
      ['q2|||q3', 0.86],
    ]);
    const warnings = findCloseHighSimilarityPairs(order, matrix, 3);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('separation in warning equals distance between positions', () => {
    const order = [makeSpaced('q1', 0), makeSpaced('q2', 1), makeSpaced('q3', 2)];
    const matrix = new Map([
      ['q1|||q2', 0.90],
      ['q1|||q3', 0.90],
      ['q2|||q3', 0.90],
    ]);
    const warnings = findCloseHighSimilarityPairs(order, matrix);
    const q1q3Warning = warnings.find(w => w.cardA === 'q1' && w.cardB === 'q3');
    expect(q1q3Warning?.separation).toBe(2);
  });
});

// ─── greedySimilaritySpacing ──────────────────────────────────────────────────

describe('greedySimilaritySpacing', () => {
  it('empty input → empty output', () => {
    expect(greedySimilaritySpacing([])).toEqual([]);
  });

  it('single card → position 0, minSimilarity 0', () => {
    const result = greedySimilaritySpacing([makeCard('q1', VEC_A)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardId).toBe('q1');
    expect(result[0]!.position).toBe(0);
    expect(result[0]!.minSimilarityToPreceding).toBe(0);
  });

  it('output contains all input cards', () => {
    const cards = ['q1', 'q2', 'q3'].map((id, i) =>
      makeCard(id, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0])
    );
    const result = greedySimilaritySpacing(cards);
    expect(result).toHaveLength(3);
    const ids = result.map(r => r.cardId).sort();
    expect(ids).toEqual(['q1', 'q2', 'q3']);
  });

  it('positions are sequential 0, 1, 2, ...', () => {
    const cards = ['q1', 'q2', 'q3'].map((id, i) =>
      makeCard(id, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0])
    );
    const result = greedySimilaritySpacing(cards);
    result.forEach((card, i) => expect(card.position).toBe(i));
  });

  it('domain is passed through to output', () => {
    const cards = [
      makeCard('q1', VEC_A, { domain: 'Cardiology' }),
      makeCard('q2', VEC_B, { domain: 'Neurology' }),
    ];
    const result = greedySimilaritySpacing(cards);
    const domains = new Set(result.map(r => r.domain));
    expect(domains).toContain('Cardiology');
    expect(domains).toContain('Neurology');
  });

  it('separates highly similar cards (they appear far apart)', () => {
    // q1 and q2 are nearly identical; q3, q4, q5 are orthogonal to each other
    const cards = [
      makeCard('q1', [1, 0, 0, 0, 0]),
      makeCard('q2', [0.99, 0.01, 0, 0, 0]),  // nearly same as q1
      makeCard('q3', [0, 1, 0, 0, 0]),
      makeCard('q4', [0, 0, 1, 0, 0]),
      makeCard('q5', [0, 0, 0, 1, 0]),
    ];
    const result = greedySimilaritySpacing(cards, { lookbackWindow: 5, priorityWeight: 0 });
    const pos1 = result.find(r => r.cardId === 'q1')!.position;
    const pos2 = result.find(r => r.cardId === 'q2')!.position;
    // q1 and q2 should NOT be adjacent (separation > 1)
    expect(Math.abs(pos1 - pos2)).toBeGreaterThan(1);
  });

  it('minSimilarityToPreceding for first card is 0', () => {
    const cards = [makeCard('q1', VEC_A), makeCard('q2', VEC_B)];
    const result = greedySimilaritySpacing(cards);
    // First placed card always has minSimilarityToPreceding = 0
    const firstCard = result.find(r => r.position === 0)!;
    expect(firstCard.minSimilarityToPreceding).toBe(0);
  });

  it('respects custom lookbackWindow config', () => {
    const cards = ['q1', 'q2', 'q3'].map((id, i) =>
      makeCard(id, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0])
    );
    // Should not throw with lookbackWindow=1
    const result = greedySimilaritySpacing(cards, { lookbackWindow: 1 });
    expect(result).toHaveLength(3);
  });
});

// ─── composeWithIrtOrdering ───────────────────────────────────────────────────

describe('composeWithIrtOrdering', () => {
  it('empty IRT order → empty output', () => {
    expect(composeWithIrtOrdering([], new Map())).toEqual([]);
  });

  it('skips cards missing embeddings', () => {
    const embeddings = new Map([['q1', VEC_A]]); // q2 not in map
    const result = composeWithIrtOrdering(['q1', 'q2'], embeddings);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardId).toBe('q1');
  });

  it('output contains all cards that have embeddings', () => {
    const embeddings = new Map([
      ['q1', [1, 0, 0]],
      ['q2', [0, 1, 0]],
      ['q3', [0, 0, 1]],
    ]);
    const result = composeWithIrtOrdering(['q1', 'q2', 'q3'], embeddings);
    expect(result).toHaveLength(3);
    const ids = result.map(r => r.cardId).sort();
    expect(ids).toEqual(['q1', 'q2', 'q3']);
  });

  it('first card in IRT gets highest priorityScore (1.0) mapped internally', () => {
    // First IRT card gets priorityScore = 1 - (0 / (n-1)) = 1.0
    // Last IRT card gets priorityScore = 1 - (n-1)/(n-1) = 0.0
    // composeWithIrtOrdering uses priorityWeight=0.4 to mix IRT with spacing
    // High-priority card should tend to appear first (but may vary by spacing)
    const embeddings = new Map([
      ['high', [1, 0, 0]],
      ['low', [0, 1, 0]],
    ]);
    const result = composeWithIrtOrdering(['high', 'low'], embeddings, { priorityWeight: 0.99 });
    // With near-pure priority weighting, the top IRT card should be placed first
    expect(result[0]!.cardId).toBe('high');
  });

  it('positions are sequential 0, 1, ...', () => {
    const embeddings = new Map([
      ['q1', [1, 0]],
      ['q2', [0, 1]],
    ]);
    const result = composeWithIrtOrdering(['q1', 'q2'], embeddings);
    result.forEach((card, i) => expect(card.position).toBe(i));
  });
});
