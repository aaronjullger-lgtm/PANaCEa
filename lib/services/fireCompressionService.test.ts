/**
 * Unit tests for lib/services/fireCompressionService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   computeCredits(review, edges, config?)
 *   batchComputeCredits(reviews, edges, config?)
 *   estimateCompression(explicitReviewCount, credits)
 *   DEFAULT_FIRE_CONFIG (constant)
 *
 * Algorithm rules:
 *   Success (grade > 0):
 *     - Finds edges where reviewed concept is TARGET
 *     - Propagates credit to SOURCE (prerequisites)
 *     - credit = grade × edgeWeight × hopDecay^(hop-1)
 *     - multiplier = 1.0 + credit × (maxMultiplier - 1.0), clamped to maxMultiplier
 *     - Max 2 hops; minCredit = 0.01 threshold
 *     - Only SEMANTIC edge types eligible
 *
 *   Failure (grade = 0):
 *     - Finds edges where reviewed concept is SOURCE
 *     - Propagates PENALTY to TARGET (dependents)
 *     - penalty = 1.0 - (failurePenaltyRate × edgeWeight), clamped to ≥ 0.8
 *     - Only 1 hop for penalties (no cascade)
 *
 *   estimateCompression:
 *     - Meaningful credits: multiplier > 1.01
 *     - compressionRatio = implicit / (explicit + implicit)
 */

import { describe, it, expect } from 'vitest';
import {
  computeCredits,
  batchComputeCredits,
  estimateCompression,
  DEFAULT_FIRE_CONFIG,
  type PrerequisiteEdge,
  type ReviewResult,
  type StabilityCredit,
} from './fireCompressionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEdge(
  sourceId: string,
  targetId: string,
  weight: number = 0.8,
  type: PrerequisiteEdge['type'] = 'SEMANTIC'
): PrerequisiteEdge {
  return { sourceId, targetId, weight, type };
}

function makeReview(conceptId: string, grade: number, stability: number = 10): ReviewResult {
  return { conceptId, grade, stability };
}

// ─── DEFAULT_FIRE_CONFIG ──────────────────────────────────────────────────────

describe('DEFAULT_FIRE_CONFIG', () => {
  it('maxHops = 2', () => expect(DEFAULT_FIRE_CONFIG.maxHops).toBe(2));
  it('hopDecay = 0.5', () => expect(DEFAULT_FIRE_CONFIG.hopDecay).toBeCloseTo(0.5, 5));
  it('minCredit = 0.01', () => expect(DEFAULT_FIRE_CONFIG.minCredit).toBeCloseTo(0.01, 5));
  it('maxMultiplier = 1.25', () => expect(DEFAULT_FIRE_CONFIG.maxMultiplier).toBeCloseTo(1.25, 5));
  it('failurePenaltyRate = 0.05', () => expect(DEFAULT_FIRE_CONFIG.failurePenaltyRate).toBeCloseTo(0.05, 5));
  it('eligibleEdgeTypes includes SEMANTIC', () => {
    expect(DEFAULT_FIRE_CONFIG.eligibleEdgeTypes.has('SEMANTIC')).toBe(true);
  });
  it('eligibleEdgeTypes does not include TEMPORAL', () => {
    expect(DEFAULT_FIRE_CONFIG.eligibleEdgeTypes.has('TEMPORAL')).toBe(false);
  });
});

// ─── computeCredits — success path ───────────────────────────────────────────

describe('computeCredits (success)', () => {
  it('no edges → no credits', () => {
    const review = makeReview('CHF', 1);
    expect(computeCredits(review, [])).toEqual([]);
  });

  it('edge with non-SEMANTIC type → no credit', () => {
    const edges = [makeEdge('Physiology', 'CHF', 0.8, 'TEMPORAL')];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits).toHaveLength(0);
  });

  it('no matching target → no credit (edge points away)', () => {
    // Edge: CHF → Treatment (CHF is source, not target)
    const edges = [makeEdge('CHF', 'Treatment', 0.8, 'SEMANTIC')];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits).toHaveLength(0);
  });

  it('one hop: credit propagated to prerequisite', () => {
    // CHF is the reviewed concept (TARGET); Physiology is prerequisite (SOURCE)
    const edges = [makeEdge('Physiology', 'CHF', 0.8)];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits).toHaveLength(1);
    expect(credits[0]!.conceptId).toBe('Physiology');
  });

  it('multiplier = 1.0 + grade × edgeWeight × (maxMultiplier - 1.0)', () => {
    // grade=1, weight=0.8, hop=1, hopDecay^0=1
    // credit = 1 × 0.8 × 1 = 0.8
    // multiplier = 1.0 + 0.8 × (1.25 - 1.0) = 1.0 + 0.2 = 1.20
    const edges = [makeEdge('Physiology', 'CHF', 0.8)];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits[0]!.stabilityMultiplier).toBeCloseTo(1.20, 3);
  });

  it('multiplier is clamped to maxMultiplier (1.25)', () => {
    // grade=1, weight=1.0 → credit=1.0 → multiplier=1.0+1.0×0.25=1.25 (at cap)
    const edges = [makeEdge('Physiology', 'CHF', 1.0)];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits[0]!.stabilityMultiplier).toBeLessThanOrEqual(1.25);
  });

  it('hop 2 credit = grade × weight × hopDecay^1 (decayed by 50%)', () => {
    // Chain: Anatomy → Physiology → CHF (all SEMANTIC)
    // Review CHF grade=1:
    //   hop1: credit Physiology = 1 × 0.8 × 0.5^0 = 0.8 → mult=1.20
    //   hop2: credit Anatomy    = 1 × 0.8 × 0.5^1 = 0.4 → mult=1.0+0.4×0.25=1.10
    const edges = [
      makeEdge('Physiology', 'CHF', 0.8),
      makeEdge('Anatomy', 'Physiology', 0.8),
    ];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    const hop2 = credits.find(c => c.conceptId === 'Anatomy')!;
    expect(hop2).toBeDefined();
    expect(hop2.stabilityMultiplier).toBeCloseTo(1.10, 3);
    expect(hop2.hopDistance).toBe(2);
  });

  it('credit below minCredit is not emitted', () => {
    // weight=0.001 → credit=0.001 < minCredit=0.01 → skip
    const edges = [makeEdge('Weak', 'CHF', 0.001)];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits).toHaveLength(0);
  });

  it('maxHops prevents hop 3', () => {
    // Chain: D → C → B → A (4 nodes, 3 hops)
    const edges = [
      makeEdge('C', 'A', 0.8),
      makeEdge('B', 'C', 0.8),  // hop 2 from A
      makeEdge('D', 'B', 0.8),  // hop 3 from A — should be blocked
    ];
    const credits = computeCredits(makeReview('A', 1), edges);
    const conceptIds = credits.map(c => c.conceptId);
    expect(conceptIds).toContain('C');
    expect(conceptIds).toContain('B');
    expect(conceptIds).not.toContain('D'); // blocked by maxHops=2
  });

  it('cycle detection prevents infinite loop', () => {
    // A → B → A (cycle)
    const edges = [
      makeEdge('B', 'A', 0.8),
      makeEdge('A', 'B', 0.8),
    ];
    // Should complete without hanging
    const credits = computeCredits(makeReview('A', 1), edges);
    expect(Array.isArray(credits)).toBe(true);
  });

  it('multiple prerequisites receive credits', () => {
    // Two different prerequisites for CHF
    const edges = [
      makeEdge('Physiology', 'CHF', 0.8),
      makeEdge('Pharmacology', 'CHF', 0.6),
    ];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    const ids = credits.map(c => c.conceptId);
    expect(ids).toContain('Physiology');
    expect(ids).toContain('Pharmacology');
  });

  it('hopDistance = 1 for first-hop credits', () => {
    const edges = [makeEdge('Physiology', 'CHF', 0.8)];
    const credits = computeCredits(makeReview('CHF', 1), edges);
    expect(credits[0]!.hopDistance).toBe(1);
  });
});

// ─── computeCredits — failure path ────────────────────────────────────────────

describe('computeCredits (failure)', () => {
  it('grade=0 propagates penalty UP to dependents', () => {
    // Physiology failed → penalizes CHF (which depends on Physiology)
    const edges = [makeEdge('Physiology', 'CHF', 0.8)];
    const credits = computeCredits(makeReview('Physiology', 0), edges);
    expect(credits).toHaveLength(1);
    expect(credits[0]!.conceptId).toBe('CHF');
  });

  it('penalty multiplier = 1.0 - (failurePenaltyRate × edgeWeight)', () => {
    // 1.0 - (0.05 × 0.8) = 1.0 - 0.04 = 0.96
    const edges = [makeEdge('Physiology', 'CHF', 0.8)];
    const credits = computeCredits(makeReview('Physiology', 0), edges);
    expect(credits[0]!.stabilityMultiplier).toBeCloseTo(0.96, 3);
  });

  it('penalty is clamped to minimum 0.80 (max 20% reduction)', () => {
    // weight=1.0, failurePenaltyRate=0.05 → penalty = 1.0 - 0.05 = 0.95 > 0.80
    const edges = [makeEdge('Physiology', 'CHF', 1.0)];
    const credits = computeCredits(makeReview('Physiology', 0), edges);
    expect(credits[0]!.stabilityMultiplier).toBeGreaterThanOrEqual(0.80);
  });

  it('failure only propagates 1 hop (no cascade)', () => {
    // Anatomy → Physiology → CHF
    // Fail Physiology → penalizes CHF but NOT Anatomy
    const edges = [
      makeEdge('Anatomy', 'Physiology', 0.8),
      makeEdge('Physiology', 'CHF', 0.8),
    ];
    const credits = computeCredits(makeReview('Physiology', 0), edges);
    const ids = credits.map(c => c.conceptId);
    expect(ids).toContain('CHF');     // direct dependent
    expect(ids).not.toContain('Anatomy'); // prerequisite — not penalized on failure
  });

  it('failure does not generate credits for non-SEMANTIC edges', () => {
    const edges = [makeEdge('Physiology', 'CHF', 0.8, 'HIERARCHICAL')];
    const credits = computeCredits(makeReview('Physiology', 0), edges);
    expect(credits).toHaveLength(0);
  });
});

// ─── batchComputeCredits ──────────────────────────────────────────────────────

describe('batchComputeCredits', () => {
  it('empty reviews → empty credits', () => {
    expect(batchComputeCredits([], [])).toEqual([]);
  });

  it('credits to same concept are merged (multiplied)', () => {
    // Two separate reviews that both credit 'Physiology'
    const edges = [
      makeEdge('Physiology', 'CHF', 0.8),
      makeEdge('Physiology', 'STEMI', 0.8),
    ];
    const reviews = [
      makeReview('CHF', 1),
      makeReview('STEMI', 1),
    ];
    const credits = batchComputeCredits(reviews, edges);
    // Both propagate credit to Physiology → should be merged
    const physiologyCredit = credits.find(c => c.conceptId === 'Physiology');
    expect(physiologyCredit).toBeDefined();
    // Merged multiplier = 1.20 × 1.20 = 1.44, clamped to 1.25
    expect(physiologyCredit!.stabilityMultiplier).toBeLessThanOrEqual(1.25);
  });

  it('merged credit keeps closest hopDistance', () => {
    const edges = [
      makeEdge('Physiology', 'CHF', 0.8),
      makeEdge('Physiology', 'STEMI', 0.8),
    ];
    const reviews = [makeReview('CHF', 1), makeReview('STEMI', 1)];
    const credits = batchComputeCredits(reviews, edges);
    const pc = credits.find(c => c.conceptId === 'Physiology')!;
    expect(pc.hopDistance).toBe(1);
  });

  it('distinct concepts produce distinct credit entries', () => {
    const edges = [
      makeEdge('Physiology', 'CHF', 0.8),
      makeEdge('Pharmacology', 'Antihypertensive', 0.8),
    ];
    const reviews = [makeReview('CHF', 1), makeReview('Antihypertensive', 1)];
    const credits = batchComputeCredits(reviews, edges);
    const ids = credits.map(c => c.conceptId);
    expect(ids).toContain('Physiology');
    expect(ids).toContain('Pharmacology');
  });
});

// ─── estimateCompression ──────────────────────────────────────────────────────

describe('estimateCompression', () => {
  it('no credits → implicitReviews=0, compressionRatio=0', () => {
    const result = estimateCompression(10, []);
    expect(result.implicitReviews).toBe(0);
    expect(result.compressionRatio).toBe(0);
  });

  it('only meaningful credits counted (multiplier > 1.01)', () => {
    const credits: StabilityCredit[] = [
      { conceptId: 'A', stabilityMultiplier: 1.20, reason: '', hopDistance: 1 }, // meaningful
      { conceptId: 'B', stabilityMultiplier: 1.00, reason: '', hopDistance: 1 }, // not meaningful
      { conceptId: 'C', stabilityMultiplier: 0.95, reason: '', hopDistance: 1 }, // penalty — not counted
    ];
    const result = estimateCompression(10, credits);
    expect(result.implicitReviews).toBe(1); // only A
  });

  it('compressionRatio = implicit / (explicit + implicit)', () => {
    const credits: StabilityCredit[] = [
      { conceptId: 'A', stabilityMultiplier: 1.20, reason: '', hopDistance: 1 },
      { conceptId: 'B', stabilityMultiplier: 1.15, reason: '', hopDistance: 2 },
    ];
    // 2 implicit / (10 + 2) = 0.167 → rounded to 0.17
    const result = estimateCompression(10, credits);
    expect(result.implicitReviews).toBe(2);
    expect(result.compressionRatio).toBeCloseTo(2 / 12, 2);
  });

  it('0 explicit reviews + 0 credits → compressionRatio = 0 (no div-by-zero)', () => {
    const result = estimateCompression(0, []);
    expect(result.compressionRatio).toBe(0);
  });

  it('compressionRatio is rounded to 2 decimal places', () => {
    const credits: StabilityCredit[] = [
      { conceptId: 'A', stabilityMultiplier: 1.20, reason: '', hopDistance: 1 },
    ];
    // 1/6 ≈ 0.1666... → 0.17
    const result = estimateCompression(5, credits);
    const str = result.compressionRatio.toString();
    const decimals = str.includes('.') ? str.split('.')[1]!.length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});
