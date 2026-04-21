/**
 * Unit tests for lib/services/semanticSiblingService.ts
 *
 * Pure exports tested:
 *   findSemanticSiblings(conditionId, config?)
 *   calculateSiblingBoost(sibling, sourceRating)
 *   applyRetrievabilityBoost(currentR, boostFactor)
 *   calculateBoostDecay(boostFactor, daysSinceBoost, decayRate?)
 *   explainRelationship(sibling)
 *   serializeBoostRecords(records)
 *   deserializeBoostRecords(json)
 */

import { describe, it, expect } from 'vitest';
import { Rating } from '../fsrs';
import {
  findSemanticSiblings,
  calculateSiblingBoost,
  applyRetrievabilityBoost,
  calculateBoostDecay,
  explainRelationship,
  serializeBoostRecords,
  deserializeBoostRecords,
  type SemanticSibling,
  type SiblingBoostRecord,
} from './semanticSiblingService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSibling(
  conditionId: string,
  conditionName: string,
  similarityScore: number,
  relationshipType: SemanticSibling['relationshipType'] = 'differential'
): SemanticSibling {
  return { conditionId, conditionName, similarityScore, relationshipType };
}

function makeBoostRecord(
  targetConditionId: string,
  boostFactor: number,
  timestamp = new Date().toISOString()
): SiblingBoostRecord {
  return {
    targetConditionId,
    sourceConditionId: 'source',
    boostFactor,
    sourceRating: Rating.Good,
    timestamp,
  };
}

// ─── findSemanticSiblings ─────────────────────────────────────────────────────

describe('findSemanticSiblings', () => {
  it('returns empty array for unknown condition', () => {
    const r = findSemanticSiblings('completely-unknown-condition-xyz');
    expect(r).toEqual([]);
  });

  it('returns siblings for a known condition (atrial-fibrillation)', () => {
    const r = findSemanticSiblings('atrial-fibrillation');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toHaveProperty('conditionId');
    expect(r[0]).toHaveProperty('similarityScore');
  });

  it('normalizes conditionId to lowercase and hyphenated', () => {
    // "Atrial Fibrillation" → "atrial-fibrillation"
    const normalized = findSemanticSiblings('Atrial Fibrillation');
    const direct = findSemanticSiblings('atrial-fibrillation');
    expect(normalized).toEqual(direct);
  });

  it('returns siblings sorted by similarity descending', () => {
    const siblings = findSemanticSiblings('stemi');
    for (let i = 1; i < siblings.length; i++) {
      expect(siblings[i - 1]!.similarityScore).toBeGreaterThanOrEqual(
        siblings[i]!.similarityScore
      );
    }
  });

  it('respects minSimilarity config: excludes siblings below threshold', () => {
    const allSiblings = findSemanticSiblings('rheumatoid-arthritis');
    const highOnly = findSemanticSiblings('rheumatoid-arthritis', { minSimilarity: 0.75 });
    expect(highOnly.length).toBeLessThanOrEqual(allSiblings.length);
    for (const s of highOnly) {
      expect(s.similarityScore).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('respects maxSiblings config: returns at most maxSiblings entries', () => {
    const r = findSemanticSiblings('atrial-fibrillation', { maxSiblings: 1 });
    expect(r.length).toBeLessThanOrEqual(1);
  });

  it('returns siblings for IBD conditions (crohns-disease)', () => {
    const r = findSemanticSiblings('crohns-disease');
    expect(r.length).toBeGreaterThan(0);
    const ids = r.map(s => s.conditionId);
    expect(ids).toContain('ulcerative-colitis');
  });
});

// ─── calculateSiblingBoost ────────────────────────────────────────────────────

describe('calculateSiblingBoost', () => {
  const highSimilarity = makeSibling('b', 'B', 0.80);
  const lowSimilarity = makeSibling('c', 'C', 0.50);

  it('returns positive boost for Rating.Good (correct recall)', () => {
    expect(calculateSiblingBoost(highSimilarity, Rating.Good)).toBeGreaterThan(0);
  });

  it('returns negative boost for Rating.Again (failed recall)', () => {
    expect(calculateSiblingBoost(highSimilarity, Rating.Again)).toBeLessThan(0);
  });

  it('boost magnitude scales with similarityScore', () => {
    const highBoost = Math.abs(calculateSiblingBoost(highSimilarity, Rating.Good));
    const lowBoost = Math.abs(calculateSiblingBoost(lowSimilarity, Rating.Good));
    expect(highBoost).toBeGreaterThan(lowBoost);
  });

  it('formula: boost = similarityScore × ratingMultiplier', () => {
    // Rating.Good multiplier = 0.1
    const expected = 0.80 * 0.1;
    expect(calculateSiblingBoost(highSimilarity, Rating.Good)).toBeCloseTo(expected, 5);
  });

  it('Rating.Easy is treated like Rating.Good (positive boost)', () => {
    const goodBoost = calculateSiblingBoost(highSimilarity, Rating.Good);
    const easyBoost = calculateSiblingBoost(highSimilarity, Rating.Easy);
    expect(easyBoost).toBeCloseTo(goodBoost, 5);
  });

  it('Rating.Hard is treated like Rating.Again (negative boost)', () => {
    const againBoost = calculateSiblingBoost(highSimilarity, Rating.Again);
    const hardBoost = calculateSiblingBoost(highSimilarity, Rating.Hard);
    expect(hardBoost).toBeCloseTo(againBoost, 5);
  });
});

// ─── applyRetrievabilityBoost ─────────────────────────────────────────────────

describe('applyRetrievabilityBoost', () => {
  it('applies positive boost to retrievability', () => {
    const r = applyRetrievabilityBoost(0.60, 0.10);
    expect(r).toBeCloseTo(0.70, 5);
  });

  it('applies negative boost (penalty) to retrievability', () => {
    const r = applyRetrievabilityBoost(0.60, -0.10);
    expect(r).toBeCloseTo(0.50, 5);
  });

  it('clamps result to 1.0 (cannot exceed maximum retrievability)', () => {
    const r = applyRetrievabilityBoost(0.95, 0.10);
    expect(r).toBeLessThanOrEqual(1.0);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it('clamps result to 0.0 (cannot go below minimum)', () => {
    const r = applyRetrievabilityBoost(0.05, -0.10);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeCloseTo(0.0, 5);
  });

  it('zero boost leaves retrievability unchanged', () => {
    expect(applyRetrievabilityBoost(0.75, 0)).toBeCloseTo(0.75, 5);
  });

  it('result is always in [0, 1]', () => {
    const cases = [
      [0, 0.5], [0.5, 0.5], [1.0, 0.5], [0.5, -0.5], [0.5, 1.0],
    ] as [number, number][];
    for (const [r, boost] of cases) {
      const result = applyRetrievabilityBoost(r, boost);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

// ─── calculateBoostDecay ──────────────────────────────────────────────────────

describe('calculateBoostDecay', () => {
  it('returns original boost at day 0 (no decay)', () => {
    expect(calculateBoostDecay(0.10, 0)).toBeCloseTo(0.10, 5);
  });

  it('applies exponential decay over time', () => {
    const day1 = calculateBoostDecay(0.10, 1);
    const day5 = calculateBoostDecay(0.10, 5);
    expect(day1).toBeLessThan(0.10);
    expect(day5).toBeLessThan(day1);
  });

  it('with default rate (0.10), boost at day 10 ≈ boost × e^(-1.0)', () => {
    // decay = 0.10 * exp(-0.10 * 10) = 0.10 * exp(-1) ≈ 0.0368
    expect(calculateBoostDecay(0.10, 10)).toBeCloseTo(0.10 * Math.exp(-1), 5);
  });

  it('higher decayRate → faster decay', () => {
    const slow = calculateBoostDecay(0.10, 5, 0.05);
    const fast = calculateBoostDecay(0.10, 5, 0.20);
    expect(fast).toBeLessThan(slow);
  });

  it('preserves sign of boost factor (negative boost decays back toward 0)', () => {
    const decayed = calculateBoostDecay(-0.05, 5);
    expect(decayed).toBeLessThan(0); // still negative
    expect(Math.abs(decayed)).toBeLessThan(0.05); // magnitude decreased
  });

  it('approaches 0 for large daysSinceBoost', () => {
    expect(calculateBoostDecay(0.10, 1000)).toBeCloseTo(0, 5);
  });
});

// ─── explainRelationship ──────────────────────────────────────────────────────

describe('explainRelationship', () => {
  it('returns expected message for "differential" type', () => {
    const sibling = makeSibling('b', 'NSTEMI', 0.80, 'differential');
    expect(explainRelationship(sibling)).toContain('confused');
    expect(explainRelationship(sibling)).toContain('NSTEMI');
  });

  it('returns expected message for "same_subcategory" type', () => {
    const sibling = makeSibling('b', 'SVT', 0.70, 'same_subcategory');
    expect(explainRelationship(sibling)).toContain('Same category');
    expect(explainRelationship(sibling)).toContain('SVT');
  });

  it('returns expected message for "complication" type', () => {
    const sibling = makeSibling('b', 'Thyroid Storm', 0.70, 'complication');
    expect(explainRelationship(sibling)).toContain('lead to');
    expect(explainRelationship(sibling)).toContain('Thyroid Storm');
  });

  it('returns expected message for "treatment_similar" type', () => {
    const sibling = makeSibling('b', 'Condition B', 0.60, 'treatment_similar');
    expect(explainRelationship(sibling)).toContain('treatment');
  });

  it('returns expected message for "presentation_similar" type', () => {
    const sibling = makeSibling('b', 'Condition C', 0.55, 'presentation_similar');
    expect(explainRelationship(sibling)).toContain('presentation');
  });

  it('always includes the conditionName in the message', () => {
    const types: SemanticSibling['relationshipType'][] = [
      'differential', 'same_subcategory', 'complication',
      'treatment_similar', 'presentation_similar',
    ];
    for (const type of types) {
      const sibling = makeSibling('x', 'UniqueConditionName', 0.60, type);
      expect(explainRelationship(sibling)).toContain('UniqueConditionName');
    }
  });
});

// ─── serializeBoostRecords / deserializeBoostRecords ─────────────────────────

describe('serializeBoostRecords / deserializeBoostRecords', () => {
  it('serializes to a JSON string', () => {
    const records = [makeBoostRecord('target-1', 0.05)];
    const json = serializeBoostRecords(records);
    expect(typeof json).toBe('string');
    expect(json).toContain('target-1');
  });

  it('round-trips correctly', () => {
    const records = [
      makeBoostRecord('target-1', 0.05),
      makeBoostRecord('target-2', -0.03),
    ];
    const json = serializeBoostRecords(records);
    const deserialized = deserializeBoostRecords(json);
    expect(deserialized).toHaveLength(2);
    expect(deserialized[0]?.targetConditionId).toBe('target-1');
    expect(deserialized[1]?.boostFactor).toBe(-0.03);
  });

  it('returns empty array for invalid JSON', () => {
    const result = deserializeBoostRecords('not valid json {{{{');
    expect(result).toEqual([]);
  });

  it('serializes an empty array to "[]"', () => {
    expect(serializeBoostRecords([])).toBe('[]');
  });

  it('deserializes "[]" to empty array', () => {
    expect(deserializeBoostRecords('[]')).toEqual([]);
  });
});
