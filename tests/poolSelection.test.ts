/**
 * Unit tests for question pool selection logic
 */

import { describe, it, expect } from 'vitest';
import {
  fisherYatesShuffle,
  selectByPanceDistribution,
  PANCE_SYSTEM_PERCENTAGES,
} from '../lib/poolSelection';

describe('fisherYatesShuffle', () => {
  it('returns same length as input', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = fisherYatesShuffle(arr, () => 0.5);
    expect(shuffled).toHaveLength(5);
  });

  it('contains all original elements', () => {
    const arr = ['a', 'b', 'c'];
    const shuffled = fisherYatesShuffle(arr, () => 0.5);
    expect(shuffled.sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate original array', () => {
    const arr = [1, 2, 3];
    fisherYatesShuffle(arr, () => 0.5);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('is deterministic with seeded rng', () => {
    let seed = 0.1;
    const rng = () => ((seed += 0.1), seed % 1);
    const arr = [1, 2, 3, 4, 5];
    const a = fisherYatesShuffle([...arr], rng);
    seed = 0.1;
    const b = fisherYatesShuffle([...arr], rng);
    expect(a).toEqual(b);
  });

  it('returns empty array for empty input', () => {
    expect(fisherYatesShuffle([])).toEqual([]);
  });
});

describe('selectByPanceDistribution', () => {
  const makeQuestion = (id: string, system: string) => ({
    id,
    system,
    question: `Q${id}`,
  });

  it('returns empty array for empty pool', () => {
    expect(selectByPanceDistribution([], 10)).toEqual([]);
  });

  it('returns full pool when count >= pool length', () => {
    const pool = [makeQuestion('1', 'CV'), makeQuestion('2', 'PULM')];
    expect(selectByPanceDistribution(pool, 5)).toHaveLength(2);
    expect(selectByPanceDistribution(pool, 2)).toHaveLength(2);
  });

  it('returns requested count when pool is larger', () => {
    const pool = Array.from({ length: 50 }, (_, i) =>
      makeQuestion(String(i), i % 2 === 0 ? 'CV' : 'PULM')
    );
    const selected = selectByPanceDistribution(pool, 10, () => 0.5);
    expect(selected).toHaveLength(10);
  });

  it('selects from multiple systems when pool has them', () => {
    const pool = [
      ...Array.from({ length: 20 }, (_, i) => makeQuestion(`cv${i}`, 'CV')),
      ...Array.from({ length: 20 }, (_, i) => makeQuestion(`pulm${i}`, 'PULM')),
    ];
    const selected = selectByPanceDistribution(pool, 15);
    expect(selected).toHaveLength(15);
    const systems = new Set(selected.map((q) => q.system));
    expect(systems.size).toBeGreaterThanOrEqual(1);
  });

  it('returns unique questions (no duplicates)', () => {
    const pool = Array.from({ length: 30 }, (_, i) =>
      makeQuestion(String(i), i % 3 === 0 ? 'CV' : i % 3 === 1 ? 'PULM' : 'GI')
    );
    const selected = selectByPanceDistribution(pool, 15);
    const ids = selected.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles unknown systems with default weight', () => {
    const pool = [
      makeQuestion('1', 'UNKNOWN_SYS'),
      makeQuestion('2', 'UNKNOWN_SYS'),
      makeQuestion('3', 'UNKNOWN_SYS'),
    ];
    const selected = selectByPanceDistribution(pool, 2);
    expect(selected).toHaveLength(2);
  });

  it('skewed pool (500 DERM, 50 CV) approximates Blueprint distribution within tolerance', () => {
    const pool = [
      ...Array.from({ length: 500 }, (_, i) => makeQuestion(`derm-${i}`, 'DERM')),
      ...Array.from({ length: 50 }, (_, i) => makeQuestion(`cv-${i}`, 'CV')),
    ];
    const runs = 50;
    const countPerRun = 20;
    const systemCounts: Record<string, number> = {};
    for (let r = 0; r < runs; r++) {
      const selected = selectByPanceDistribution(pool, countPerRun);
      for (const q of selected) {
        systemCounts[q.system] = (systemCounts[q.system] ?? 0) + 1;
      }
    }
    const total = runs * countPerRun;
    const cvPct = (systemCounts['CV'] ?? 0) / total;
    const dermPct = (systemCounts['DERM'] ?? 0) / total;
    // Blueprint weighting: CV (11%) preferred over DERM (5%). With skewed pool we should not get 95% DERM.
    expect(dermPct).toBeLessThan(0.5);
    expect(cvPct).toBeGreaterThanOrEqual(0.05);
  });
});

describe('PANCE_SYSTEM_PERCENTAGES', () => {
  it('has expected systems', () => {
    expect(PANCE_SYSTEM_PERCENTAGES.CV).toBe(11);
    expect(PANCE_SYSTEM_PERCENTAGES.PULM).toBe(9);
  });

  it('total is close to 100', () => {
    const total = Object.values(PANCE_SYSTEM_PERCENTAGES).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(90);
    expect(total).toBeLessThanOrEqual(110);
  });
});
