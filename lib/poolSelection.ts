/**
 * Question pool selection utilities
 *
 * Pure functions for weighted random selection following PANCE blueprint.
 * Used by /api/questions/pool and unit-tested for correctness.
 * Single source of truth: lib/constants/blueprint.ts
 */

import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from './constants/blueprint';

/** @deprecated Use BLUEPRINT_PERCENT_BY_ABBREVIATION from lib/constants/blueprint.ts */
export const PANCE_SYSTEM_PERCENTAGES: Record<string, number> = { ...BLUEPRINT_PERCENT_BY_ABBREVIATION };

/**
 * Fisher-Yates shuffle for unbiased randomization
 */
export function fisherYatesShuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Select questions from a pool following PANCE distribution percentages
 */
export function selectByPanceDistribution<T extends { system: string | null }>(
  pool: T[],
  count: number,
  rng: () => number = Math.random
): T[] {
  if (pool.length === 0) return [];
  if (pool.length <= count) return pool;

  const bySystem: Record<string, T[]> = {};
  for (const q of pool) {
    const sys = q.system || 'General';
    bySystem[sys] ??= [];
    bySystem[sys].push(q);
  }

  for (const sys of Object.keys(bySystem)) {
    const arr = bySystem[sys];
    if (arr) bySystem[sys] = fisherYatesShuffle(arr, rng);
  }

  const systemWeights: { system: string; weight: number; index: number }[] = [];
  const totalPercent = Object.values(BLUEPRINT_PERCENT_BY_ABBREVIATION).reduce((a, b) => a + b, 0);

  for (const sys of Object.keys(bySystem)) {
    const pancePercent = BLUEPRINT_PERCENT_BY_ABBREVIATION[sys] ?? 3;
    systemWeights.push({
      system: sys,
      weight: pancePercent / totalPercent,
      index: 0,
    });
  }

  const selected: T[] = [];

  while (selected.length < count) {
    const available = systemWeights.filter((sw) => {
      const arr = bySystem[sw.system];
      return arr != null && sw.index < arr.length;
    });
    if (available.length === 0) break;

    const totalWeight = available.reduce((sum, sw) => sum + sw.weight, 0);
    let random = rng() * totalWeight;
    let chosen: (typeof available)[0] | null = null;

    for (const sw of available) {
      random -= sw.weight;
      if (random <= 0) {
        chosen = sw;
        break;
      }
    }
    if (!chosen) chosen = available[0] ?? null;
    if (chosen == null) break;

    const sysArr = bySystem[chosen.system];
    const question = sysArr?.[chosen.index];
    if (question != null) {
      selected.push(question);
      chosen.index++;
    }
  }

  return fisherYatesShuffle(selected, rng);
}
