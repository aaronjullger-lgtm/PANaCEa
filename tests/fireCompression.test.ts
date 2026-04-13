/**
 * Tests for fireCompressionService
 * Sprint 25 — FIRe implicit review compression
 */

import { describe, it, expect } from 'vitest';
import {
  computeCredits,
  batchComputeCredits,
  estimateCompression,
  DEFAULT_FIRE_CONFIG,
  type PrerequisiteEdge,
  type ReviewResult,
} from '../lib/services/fireCompressionService';

// ─── Fixtures ────────────────────────────────────────────────────────

const EDGES: PrerequisiteEdge[] = [
  // CHF Treatment depends on Cardiac Physiology
  { sourceId: 'cardiac-physiology', targetId: 'chf-treatment', weight: 0.8, type: 'SEMANTIC' },
  // CHF Treatment depends on Diuretic Pharmacology
  { sourceId: 'diuretic-pharm', targetId: 'chf-treatment', weight: 0.6, type: 'SEMANTIC' },
  // Cardiac Physiology depends on Hemodynamics
  { sourceId: 'hemodynamics', targetId: 'cardiac-physiology', weight: 0.7, type: 'SEMANTIC' },
  // Cross-system edge (should be skipped by default config)
  { sourceId: 'renal-physiology', targetId: 'chf-treatment', weight: 0.5, type: 'CROSS_SYSTEM' },
  // Temporal edge (should be skipped)
  { sourceId: 'temporal-node', targetId: 'chf-treatment', weight: 0.9, type: 'TEMPORAL' },
];

// ─── computeCredits ──────────────────────────────────────────────────

describe('computeCredits', () => {
  it('propagates success credit to prerequisites', () => {
    const review: ReviewResult = {
      conceptId: 'chf-treatment',
      grade: 1,
      stability: 30,
    };

    const credits = computeCredits(review, EDGES);

    // Should credit cardiac-physiology and diuretic-pharm (hop 1)
    const cardiacCredit = credits.find((c) => c.conceptId === 'cardiac-physiology');
    const diureticCredit = credits.find((c) => c.conceptId === 'diuretic-pharm');

    expect(cardiacCredit).toBeDefined();
    expect(cardiacCredit!.stabilityMultiplier).toBeGreaterThan(1);
    expect(cardiacCredit!.hopDistance).toBe(1);

    expect(diureticCredit).toBeDefined();
    expect(diureticCredit!.stabilityMultiplier).toBeGreaterThan(1);
  });

  it('propagates to second hop with decay', () => {
    const review: ReviewResult = {
      conceptId: 'chf-treatment',
      grade: 1,
      stability: 30,
    };

    const credits = computeCredits(review, EDGES);

    // hemodynamics is 2 hops from chf-treatment (via cardiac-physiology)
    const hemoCredit = credits.find((c) => c.conceptId === 'hemodynamics');
    expect(hemoCredit).toBeDefined();
    expect(hemoCredit!.hopDistance).toBe(2);

    // Second hop credit should be less than first hop
    const cardiacCredit = credits.find((c) => c.conceptId === 'cardiac-physiology');
    expect(hemoCredit!.stabilityMultiplier).toBeLessThan(cardiacCredit!.stabilityMultiplier);
  });

  it('does not propagate along non-SEMANTIC edges', () => {
    const review: ReviewResult = {
      conceptId: 'chf-treatment',
      grade: 1,
      stability: 30,
    };

    const credits = computeCredits(review, EDGES);

    // renal-physiology has CROSS_SYSTEM edge → should be skipped
    expect(credits.find((c) => c.conceptId === 'renal-physiology')).toBeUndefined();
    // temporal-node has TEMPORAL edge → should be skipped
    expect(credits.find((c) => c.conceptId === 'temporal-node')).toBeUndefined();
  });

  it('propagates failure penalty to dependents', () => {
    const review: ReviewResult = {
      conceptId: 'cardiac-physiology',
      grade: 0,
      stability: 10,
    };

    const credits = computeCredits(review, EDGES);

    // Failing cardiac-physiology should penalize chf-treatment
    const chfPenalty = credits.find((c) => c.conceptId === 'chf-treatment');
    expect(chfPenalty).toBeDefined();
    expect(chfPenalty!.stabilityMultiplier).toBeLessThan(1);
    expect(chfPenalty!.stabilityMultiplier).toBeGreaterThanOrEqual(0.8); // capped at 20% penalty
  });

  it('does not penalize more than 20%', () => {
    const review: ReviewResult = {
      conceptId: 'cardiac-physiology',
      grade: 0,
      stability: 5,
    };

    const credits = computeCredits(review, EDGES);
    for (const c of credits) {
      expect(c.stabilityMultiplier).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('respects maxHops config', () => {
    const review: ReviewResult = {
      conceptId: 'chf-treatment',
      grade: 1,
      stability: 30,
    };

    const credits1Hop = computeCredits(review, EDGES, {
      ...DEFAULT_FIRE_CONFIG,
      maxHops: 1,
    });

    // With maxHops=1, hemodynamics (2 hops) should not appear
    expect(credits1Hop.find((c) => c.conceptId === 'hemodynamics')).toBeUndefined();
    // But cardiac-physiology (1 hop) should
    expect(credits1Hop.find((c) => c.conceptId === 'cardiac-physiology')).toBeDefined();
  });

  it('caps multiplier at maxMultiplier', () => {
    const review: ReviewResult = {
      conceptId: 'chf-treatment',
      grade: 1,
      stability: 30,
    };

    const credits = computeCredits(review, EDGES);
    for (const c of credits) {
      expect(c.stabilityMultiplier).toBeLessThanOrEqual(DEFAULT_FIRE_CONFIG.maxMultiplier);
    }
  });

  it('handles no matching edges', () => {
    const review: ReviewResult = {
      conceptId: 'isolated-concept',
      grade: 1,
      stability: 30,
    };

    const credits = computeCredits(review, EDGES);
    expect(credits).toHaveLength(0);
  });

  it('prevents cycles', () => {
    const cyclicEdges: PrerequisiteEdge[] = [
      { sourceId: 'A', targetId: 'B', weight: 0.5, type: 'SEMANTIC' },
      { sourceId: 'B', targetId: 'A', weight: 0.5, type: 'SEMANTIC' },
    ];

    const credits = computeCredits(
      { conceptId: 'B', grade: 1, stability: 20 },
      cyclicEdges
    );

    // Should not infinite loop; A gets credit but B doesn't credit itself
    const conceptIds = credits.map((c) => c.conceptId);
    expect(conceptIds).toContain('A');
    expect(new Set(conceptIds).size).toBe(conceptIds.length); // no duplicates
  });
});

// ─── batchComputeCredits ─────────────────────────────────────────────

describe('batchComputeCredits', () => {
  it('merges credits to the same concept', () => {
    const reviews: ReviewResult[] = [
      { conceptId: 'chf-treatment', grade: 1, stability: 30 },
      { conceptId: 'chf-treatment', grade: 1, stability: 30 }, // reviewing same concept twice
    ];

    const credits = batchComputeCredits(reviews, EDGES);
    const cardiacCredits = credits.filter((c) => c.conceptId === 'cardiac-physiology');
    // Should be merged into one entry
    expect(cardiacCredits).toHaveLength(1);
    // Merged multiplier should be higher than single
    const single = computeCredits(reviews[0]!, EDGES);
    const singleCardiac = single.find((c) => c.conceptId === 'cardiac-physiology');
    expect(cardiacCredits[0]!.stabilityMultiplier).toBeGreaterThanOrEqual(singleCardiac!.stabilityMultiplier);
  });

  it('handles empty reviews', () => {
    expect(batchComputeCredits([], EDGES)).toHaveLength(0);
  });
});

// ─── estimateCompression ─────────────────────────────────────────────

describe('estimateCompression', () => {
  it('computes compression ratio', () => {
    const credits = computeCredits(
      { conceptId: 'chf-treatment', grade: 1, stability: 30 },
      EDGES
    );
    const result = estimateCompression(10, credits);
    expect(result.implicitReviews).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeLessThanOrEqual(1);
  });

  it('returns 0 for no credits', () => {
    const result = estimateCompression(10, []);
    expect(result.implicitReviews).toBe(0);
    expect(result.compressionRatio).toBe(0);
  });

  it('returns 0 for zero explicit reviews and no credits', () => {
    const result = estimateCompression(0, []);
    expect(result.compressionRatio).toBe(0);
  });
});
