// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/nccpa-blueprint.ts — deterministic pure functions only
 *
 * Functions tested:
 *   validateInterleaving(questions, blockSize?, minSystems?)
 *     - counts distinct systems in first blockSize questions
 *     - flags insufficient system diversity (< minSystems)
 *     - flags excessive consecutive repetition (same system 4+ times in a row;
 *       repeatCount increments AFTER the first occurrence, so >= 3 fires = 4 in a row)
 *
 *   getWeakSystemRecommendations(performanceBySystem)
 *     - skips systems with total < 5
 *     - score = (1 - accuracy) * blueprint_weight (0.05 for unknown systems)
 *     - returns top 3 sorted by score descending
 *
 * Excluded (Math.random()):
 *   applyInterleaving, selectWeightedSystem, shuffleArray
 */

import { describe, it, expect } from 'vitest';
import { validateInterleaving, getWeakSystemRecommendations } from './nccpa-blueprint';
import type { QuestionWithSystem } from './nccpa-blueprint';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQ(system: string, id?: string): QuestionWithSystem {
  return { id: id ?? system, system };
}

// ─── validateInterleaving ─────────────────────────────────────────────────────

describe('validateInterleaving', () => {
  // ── Empty input ──

  it('returns isValid=true with no issues for empty questions array (minSystems=0)', () => {
    // Empty slice → 0 distinct systems; valid only when minSystems=0
    const result = validateInterleaving([], 20, 0);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.systemDistribution).toEqual({});
  });

  it('returns isValid=false for empty questions when minSystems > 0', () => {
    const result = validateInterleaving([], 20, 3);
    expect(result.isValid).toBe(false);
    expect(result.issues.some(i => i.includes('distinct systems'))).toBe(true);
  });

  // ── System diversity ──

  it('flags too few distinct systems', () => {
    // All same system → distinctSystems=1 < minSystems=3
    const questions = [makeQ('Cardiology', 'c1'), makeQ('Cardiology', 'c2'), makeQ('Cardiology', 'c3')];
    const result = validateInterleaving(questions, 20, 3);
    expect(result.isValid).toBe(false);
    const distIssue = result.issues.find(i => i.includes('distinct systems'));
    expect(distIssue).toBeDefined();
    expect(distIssue).toContain('1');
    expect(distIssue).toContain('3');
  });

  it('is valid when distinct systems exactly meets minimum', () => {
    // Use canonical names to avoid alias normalization surprises
    const questions = [makeQ('Cardiovascular'), makeQ('Neurological'), makeQ('Pulmonary')];
    const result = validateInterleaving(questions, 20, 3);
    const distIssue = result.issues.find(i => i.includes('distinct systems'));
    expect(distIssue).toBeUndefined();
    expect(result.systemDistribution).toMatchObject({
      Cardiovascular: 1,
      Neurological: 1,
      Pulmonary: 1,
    });
  });

  it('normalizes aliases to canonical names (Cardiology → Cardiovascular)', () => {
    // 'Cardiology' is aliased to 'Cardiovascular' in SYSTEM_ALIASES
    const questions = [makeQ('Cardiology'), makeQ('Pulmonary'), makeQ('Neurological')];
    const result = validateInterleaving(questions, 20, 3);
    // After normalization, 'Cardiology' becomes 'Cardiovascular'
    expect(result.systemDistribution['Cardiovascular']).toBe(1);
    expect(result.systemDistribution['Cardiology']).toBeUndefined();
  });

  it('is valid when distinct systems exceeds minimum', () => {
    const questions = [makeQ('A', 'a1'), makeQ('B', 'b1'), makeQ('C', 'c1'), makeQ('D', 'd1')];
    const result = validateInterleaving(questions, 20, 3);
    const distIssue = result.issues.find(i => i.includes('distinct systems'));
    expect(distIssue).toBeUndefined();
  });

  // ── Consecutive repetition ──

  it('does NOT flag 3 consecutive same system (repeatCount reaches 2, below threshold)', () => {
    // A,A,A,B,B,B → 2 systems (minSystems=2), 3 consecutive A (ok), 3 consecutive B (ok)
    const questions = [
      makeQ('A', 'a1'), makeQ('A', 'a2'), makeQ('A', 'a3'),
      makeQ('B', 'b1'), makeQ('B', 'b2'), makeQ('B', 'b3'),
    ];
    const result = validateInterleaving(questions, 20, 2);
    const repeatIssue = result.issues.find(i => i.includes('consecutively'));
    expect(repeatIssue).toBeUndefined();
  });

  it('flags 4 consecutive same system (repeatCount reaches 3)', () => {
    // A,A,A,A,B,C → 3 distinct (ok), but 4 consecutive A
    const questions = [
      makeQ('A', 'a1'), makeQ('A', 'a2'), makeQ('A', 'a3'), makeQ('A', 'a4'),
      makeQ('B', 'b1'), makeQ('C', 'c1'),
    ];
    const result = validateInterleaving(questions, 20, 3);
    expect(result.isValid).toBe(false);
    const repeatIssue = result.issues.find(i => i.includes('consecutively'));
    expect(repeatIssue).toBeDefined();
    expect(repeatIssue).toContain('A');
    expect(repeatIssue).toContain('4');
  });

  it('well-interleaved questions with no repeats passes', () => {
    const questions = [
      makeQ('Cardiology'), makeQ('Neurology'), makeQ('Pulmonary'), makeQ('GI'),
      makeQ('Cardiology', 'c2'), makeQ('Neurology', 'n2'),
    ];
    const result = validateInterleaving(questions, 20, 3);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  // ── blockSize slicing ──

  it('only examines the first blockSize questions', () => {
    // First 3 (blockSize=3) are well-interleaved; 4th+ are same system
    const questions = [
      makeQ('A', 'a1'), makeQ('B', 'b1'), makeQ('C', 'c1'),
      makeQ('D', 'd1'), makeQ('D', 'd2'), makeQ('D', 'd3'), makeQ('D', 'd4'),
    ];
    const result = validateInterleaving(questions, 3, 3);
    expect(result.isValid).toBe(true);
    expect(result.systemDistribution).toMatchObject({ A: 1, B: 1, C: 1 });
    // D should not appear in distribution (sliced out)
    expect(result.systemDistribution['D']).toBeUndefined();
  });

  it('counts only blockSize questions even when more are provided', () => {
    const questions = Array.from({ length: 30 }, (_, i) =>
      makeQ(i < 5 ? 'Cardiology' : 'Neurology', `q${i}`)
    );
    const result = validateInterleaving(questions, 10, 1);
    const totalCounted = Object.values(result.systemDistribution).reduce((a, b) => a + b, 0);
    expect(totalCounted).toBe(10);
  });

  // ── systemDistribution ──

  it('systemDistribution counts correctly', () => {
    const questions = [
      makeQ('A', 'a1'), makeQ('B', 'b1'), makeQ('A', 'a2'), makeQ('C', 'c1'), makeQ('A', 'a3'),
    ];
    const { systemDistribution } = validateInterleaving(questions, 20, 1);
    expect(systemDistribution['A']).toBe(3);
    expect(systemDistribution['B']).toBe(1);
    expect(systemDistribution['C']).toBe(1);
  });

  // ── return shape ──

  it('always returns isValid, issues (array), and systemDistribution (object)', () => {
    const result = validateInterleaving([], 20, 3);
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.systemDistribution).toBe('object');
  });
});

// ─── getWeakSystemRecommendations ─────────────────────────────────────────────

describe('getWeakSystemRecommendations', () => {
  // ── Edge cases ──

  it('returns [] for empty input', () => {
    expect(getWeakSystemRecommendations({})).toEqual([]);
  });

  it('returns [] when all systems have fewer than 5 attempts', () => {
    const perf = {
      A: { correct: 3, total: 4 },
      B: { correct: 0, total: 2 },
    };
    expect(getWeakSystemRecommendations(perf)).toEqual([]);
  });

  it('includes system with exactly 5 attempts (boundary: total < 5 is the skip condition)', () => {
    const perf = { A: { correct: 0, total: 5 } };
    const result = getWeakSystemRecommendations(perf);
    expect(result).toContain('A');
  });

  it('excludes system with total = 4 (below threshold)', () => {
    const perf = {
      A: { correct: 0, total: 4 }, // skipped
      B: { correct: 0, total: 10 },
    };
    const result = getWeakSystemRecommendations(perf);
    expect(result).not.toContain('A');
    expect(result).toContain('B');
  });

  // ── Ranking correctness ──

  it('sorts by score = (1 - accuracy) * weight descending', () => {
    // All unknown systems (weight=0.05), so score ∝ (1 - accuracy)
    // Lowest accuracy → highest score → first in result
    const perf = {
      HighAccuracy: { correct: 9, total: 10 }, // score = 0.1 * 0.05 = 0.005
      MidAccuracy:  { correct: 5, total: 10 }, // score = 0.5 * 0.05 = 0.025
      LowAccuracy:  { correct: 1, total: 10 }, // score = 0.9 * 0.05 = 0.045
    };
    const result = getWeakSystemRecommendations(perf);
    expect(result[0]).toBe('LowAccuracy');
    expect(result[1]).toBe('MidAccuracy');
    expect(result[2]).toBe('HighAccuracy');
  });

  it('returns at most 3 systems even when more qualify', () => {
    const perf = {
      A: { correct: 0, total: 10 },
      B: { correct: 1, total: 10 },
      C: { correct: 2, total: 10 },
      D: { correct: 3, total: 10 },
      E: { correct: 4, total: 10 },
    };
    const result = getWeakSystemRecommendations(perf);
    expect(result).toHaveLength(3);
  });

  it('top 3 are the weakest systems when more than 3 qualify', () => {
    // All unknown systems, accuracy determines score entirely
    const perf = {
      A: { correct: 0, total: 10 }, // worst
      B: { correct: 1, total: 10 },
      C: { correct: 2, total: 10 },
      D: { correct: 9, total: 10 }, // best (not in top-3 weak)
    };
    const result = getWeakSystemRecommendations(perf);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).not.toContain('D');
  });

  it('returns fewer than 3 when fewer than 3 systems qualify', () => {
    const perf = {
      OnlyValid: { correct: 0, total: 10 },
      TooFew:    { correct: 0, total: 3 }, // skipped
    };
    const result = getWeakSystemRecommendations(perf);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('OnlyValid');
  });

  it('system with 100% accuracy has score=0 and falls to bottom', () => {
    const perf = {
      Perfect:   { correct: 10, total: 10 }, // score=0
      NeverRight: { correct: 0, total: 10 }, // score=0.05
    };
    const result = getWeakSystemRecommendations(perf);
    expect(result[0]).toBe('NeverRight');
    expect(result[1]).toBe('Perfect');
  });

  it('returns an array of strings (system names)', () => {
    const perf = { A: { correct: 2, total: 10 } };
    const result = getWeakSystemRecommendations(perf);
    expect(Array.isArray(result)).toBe(true);
    for (const s of result) {
      expect(typeof s).toBe('string');
    }
  });
});
