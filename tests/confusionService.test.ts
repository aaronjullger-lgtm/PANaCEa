/**
 * Tests for confusionService — localStorage-backed confusion tracking.
 * Runs in jsdom environment (default for Vitest in this project).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordConfusion,
  getTopConfusionsForCondition,
  buildConfusionGraph,
  getConfusionEdges,
  getConfusionPairs,
  isConfusionPair,
  clearConfusionData,
  getConfusionStats,
} from '../lib/services/confusionService';

const U = 'user-1';
const U2 = 'user-2';
const MI = 'myocardial-infarction';
const UA = 'unstable-angina';
const PE = 'pulmonary-embolism';
const HF = 'heart-failure';

beforeEach(() => {
  localStorage.clear();
});

// ─── recordConfusion ──────────────────────────────────────────────────────────

describe('recordConfusion', () => {
  it('creates a new record on first confusion', () => {
    recordConfusion(U, MI, UA);
    const confusions = getTopConfusionsForCondition(U, MI);
    expect(confusions).toHaveLength(1);
    expect(confusions[0]!.conditionId).toBe(UA);
    expect(confusions[0]!.times).toBe(1);
  });

  it('increments times on repeated confusion', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    const confusions = getTopConfusionsForCondition(U, MI);
    expect(confusions[0]!.times).toBe(3);
  });

  it('is a no-op when realConditionId === mistakenConditionId', () => {
    recordConfusion(U, MI, MI);
    expect(getTopConfusionsForCondition(U, MI)).toHaveLength(0);
  });

  it('tracks different condition pairs independently', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, PE);
    const confusions = getTopConfusionsForCondition(U, MI);
    expect(confusions).toHaveLength(2);
  });

  it('isolates data between users', () => {
    recordConfusion(U, MI, UA);
    expect(getTopConfusionsForCondition(U2, MI)).toHaveLength(0);
  });

  it('persists across separate function calls (localStorage round-trip)', () => {
    recordConfusion(U, MI, UA);
    // Simulate fresh load by calling another function that reloads from storage
    recordConfusion(U, MI, UA);
    const result = getTopConfusionsForCondition(U, MI);
    expect(result[0]!.times).toBe(2);
  });
});

// ─── getTopConfusionsForCondition ─────────────────────────────────────────────

describe('getTopConfusionsForCondition', () => {
  it('returns empty array when no confusions recorded', () => {
    expect(getTopConfusionsForCondition(U, MI)).toHaveLength(0);
  });

  it('returns results sorted by times descending', () => {
    recordConfusion(U, MI, PE);           // PE: 1
    recordConfusion(U, MI, UA);           // UA: 2
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, HF);           // HF: 3
    recordConfusion(U, MI, HF);
    recordConfusion(U, MI, HF);
    const result = getTopConfusionsForCondition(U, MI);
    expect(result[0]!.conditionId).toBe(HF);
    expect(result[1]!.conditionId).toBe(UA);
    expect(result[2]!.conditionId).toBe(PE);
  });

  it('respects the limit parameter', () => {
    for (const cond of [UA, PE, HF, 'pneumonia', 'pericarditis']) {
      recordConfusion(U, MI, cond);
    }
    expect(getTopConfusionsForCondition(U, MI, 3)).toHaveLength(3);
  });

  it('includes both directions (real→mistaken AND mistaken→real)', () => {
    recordConfusion(U, MI, UA);   // user confused MI for UA
    recordConfusion(U, UA, MI);   // user confused UA for MI
    // When querying MI, UA should appear with times=2 (both directions count)
    const result = getTopConfusionsForCondition(U, MI);
    const uaEntry = result.find(c => c.conditionId === UA);
    expect(uaEntry).toBeDefined();
    expect(uaEntry!.times).toBe(2);
  });

  it('normalizedScore is 1.0 for the top confusion', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, PE);
    const result = getTopConfusionsForCondition(U, MI);
    expect(result[0]!.normalizedScore).toBe(1.0);
  });

  it('conditionName is formatted from conditionId', () => {
    recordConfusion(U, MI, 'unstable_angina');
    const result = getTopConfusionsForCondition(U, MI);
    expect(result[0]!.conditionName).toBe('Unstable Angina');
  });
});

// ─── buildConfusionGraph ──────────────────────────────────────────────────────

describe('buildConfusionGraph', () => {
  it('returns empty map when no data', () => {
    expect(buildConfusionGraph(U).size).toBe(0);
  });

  it('creates directed edges from real → mistaken', () => {
    recordConfusion(U, MI, UA);
    const graph = buildConfusionGraph(U);
    expect(graph.has(MI)).toBe(true);
    expect(graph.get(MI)!.get(UA)).toBe(1);
  });

  it('accumulates edge weight with repeated confusions', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    const graph = buildConfusionGraph(U);
    expect(graph.get(MI)!.get(UA)).toBe(2);
  });

  it('isolates graph by userId', () => {
    recordConfusion(U, MI, UA);
    expect(buildConfusionGraph(U2).size).toBe(0);
  });
});

// ─── getConfusionEdges ────────────────────────────────────────────────────────

describe('getConfusionEdges', () => {
  it('returns empty array when no data', () => {
    expect(getConfusionEdges(U)).toHaveLength(0);
  });

  it('filters edges below 0.2 normalised weight threshold', () => {
    // MI→UA: 5 (normalised 1.0), MI→PE: 1 (normalised 0.2), MI→HF: 0 not recorded
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA); // 5
    recordConfusion(U, MI, PE); // 1 → normalised = 1/5 = 0.2 (exactly at threshold — passes)
    const edges = getConfusionEdges(U);
    expect(edges.every(e => e.normalizedWeight >= 0.2)).toBe(true);
  });

  it('sorts edges by weight descending', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, PE);  // PE: 1, UA: 2
    const edges = getConfusionEdges(U);
    expect(edges[0]!.from).toBe(MI);
    expect(edges[0]!.to).toBe(UA);
    expect(edges[0]!.weight).toBe(2);
  });

  it('excludes user-2 edges when querying user-1', () => {
    recordConfusion(U2, MI, UA);
    expect(getConfusionEdges(U)).toHaveLength(0);
  });
});

// ─── getConfusionPairs ────────────────────────────────────────────────────────

describe('getConfusionPairs', () => {
  it('returns empty array when no data', () => {
    expect(getConfusionPairs(U)).toHaveLength(0);
  });

  it('combines both directions into a canonical pair', () => {
    recordConfusion(U, MI, UA);  // MI→UA: 1
    recordConfusion(U, UA, MI);  // UA→MI: 1 → pair total = 2
    const pairs = getConfusionPairs(U);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.totalConfusions).toBe(2);
  });

  it('pair key is canonical (alphabetically sorted)', () => {
    recordConfusion(U, UA, MI);  // UA>MI alphabetically — sorted to [MI, UA]
    const pairs = getConfusionPairs(U);
    const [a, b] = [pairs[0]!.conditionA, pairs[0]!.conditionB];
    expect(a! <= b!).toBe(true); // conditionA ≤ conditionB alphabetically
  });

  it('sorts pairs by totalConfusions descending', () => {
    recordConfusion(U, MI, UA);  // pair1: 1
    recordConfusion(U, MI, PE);  // pair2: 2
    recordConfusion(U, MI, PE);
    const pairs = getConfusionPairs(U);
    expect(pairs[0]!.totalConfusions).toBeGreaterThanOrEqual(pairs[1]!.totalConfusions);
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 15; i++) {
      recordConfusion(U, MI, `condition-${i}`);
    }
    expect(getConfusionPairs(U, 5)).toHaveLength(5);
  });
});

// ─── isConfusionPair ──────────────────────────────────────────────────────────

describe('isConfusionPair', () => {
  it('returns false when no confusions recorded', () => {
    expect(isConfusionPair(U, MI, UA)).toBe(false);
  });

  it('returns false when total confusions < threshold', () => {
    recordConfusion(U, MI, UA);  // total = 1, default threshold = 2
    expect(isConfusionPair(U, MI, UA)).toBe(false);
  });

  it('returns true when total confusions >= threshold', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    expect(isConfusionPair(U, MI, UA)).toBe(true);
  });

  it('counts both A→B and B→A directions', () => {
    recordConfusion(U, MI, UA);  // direction 1: 1
    recordConfusion(U, UA, MI);  // direction 2: 1 → total = 2
    expect(isConfusionPair(U, MI, UA)).toBe(true);
  });

  it('respects custom threshold', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA); // 3
    expect(isConfusionPair(U, MI, UA, 5)).toBe(false);
    expect(isConfusionPair(U, MI, UA, 3)).toBe(true);
  });

  it('is directionally symmetric (A,B same as B,A)', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, UA);
    expect(isConfusionPair(U, MI, UA)).toBe(true);
    expect(isConfusionPair(U, UA, MI)).toBe(true);
  });
});

// ─── clearConfusionData ───────────────────────────────────────────────────────

describe('clearConfusionData', () => {
  it('removes all records for a specific user', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, MI, PE);
    clearConfusionData(U);
    expect(getTopConfusionsForCondition(U, MI)).toHaveLength(0);
  });

  it('does not remove records for other users', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U2, MI, UA);
    clearConfusionData(U);
    expect(getTopConfusionsForCondition(U2, MI)).toHaveLength(1);
  });

  it('is idempotent (clearing twice does not throw)', () => {
    recordConfusion(U, MI, UA);
    clearConfusionData(U);
    expect(() => clearConfusionData(U)).not.toThrow();
    expect(getTopConfusionsForCondition(U, MI)).toHaveLength(0);
  });
});

// ─── getConfusionStats ────────────────────────────────────────────────────────

describe('getConfusionStats', () => {
  it('returns zeros for user with no data', () => {
    const stats = getConfusionStats(U);
    expect(stats.totalConfusions).toBe(0);
    expect(stats.uniquePairs).toBe(0);
    expect(stats.mostConfusedCondition).toBeNull();
    expect(stats.mostConfusedCount).toBe(0);
  });

  it('counts total confusions correctly', () => {
    recordConfusion(U, MI, UA);   // 1
    recordConfusion(U, MI, UA);   // 2
    recordConfusion(U, MI, PE);   // 1 → total = 3
    const stats = getConfusionStats(U);
    expect(stats.totalConfusions).toBe(3);
  });

  it('counts unique pairs (bidirectional)', () => {
    recordConfusion(U, MI, UA);
    recordConfusion(U, UA, MI); // same pair as above
    recordConfusion(U, MI, PE); // new pair
    const stats = getConfusionStats(U);
    // MI↔UA is 1 pair, MI↔PE is another pair
    expect(stats.uniquePairs).toBe(2);
  });

  it('identifies the most confused condition (realConditionId with highest total times)', () => {
    // mostConfusedCondition tracks realConditionId appearances (the condition
    // the student was wrong about), not the mistaken condition chosen.
    recordConfusion(U, MI, UA);   // MI as realCond: times=1
    recordConfusion(U, MI, PE);   // MI as realCond: times=+1 → total 2
    recordConfusion(U, HF, PE);   // HF as realCond: times=1
    const stats = getConfusionStats(U);
    expect(stats.mostConfusedCondition).toBe(MI); // MI appears as realCond 2 times
    expect(stats.mostConfusedCount).toBe(2);
  });
});
