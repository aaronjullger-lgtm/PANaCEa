/**
 * Question pool selection utilities
 *
 * Pure functions for weighted random selection following PANCE blueprint.
 * Used by /api/questions/pool and unit-tested for correctness.
 */

/** Official PANCE Content Blueprint percentages (2024) */
export const PANCE_SYSTEM_PERCENTAGES: Record<string, number> = {
  CV: 11,
  PULM: 9,
  GI: 8,
  MSK: 8,
  ID: 7,
  NEURO: 7,
  PSYCH: 7,
  REPRO: 7,
  ENDO: 6,
  HEENT: 6,
  PRO: 6,
  HEME: 5,
  RENAL: 5,
  DERM: 4,
  GU: 4,
};

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
    bySystem[sys] = fisherYatesShuffle(bySystem[sys], rng);
  }

  const systemWeights: { system: string; weight: number; index: number }[] = [];
  const totalPercent = Object.values(PANCE_SYSTEM_PERCENTAGES).reduce((a, b) => a + b, 0);

  for (const sys of Object.keys(bySystem)) {
    const pancePercent = PANCE_SYSTEM_PERCENTAGES[sys] ?? 3;
    systemWeights.push({
      system: sys,
      weight: pancePercent / totalPercent,
      index: 0,
    });
  }

  const selected: T[] = [];

  while (selected.length < count) {
    const available = systemWeights.filter((sw) => sw.index < bySystem[sw.system].length);
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
    if (!chosen) chosen = available[0];

    const question = bySystem[chosen.system][chosen.index];
    if (question) {
      selected.push(question);
      chosen.index++;
    }
  }

  return fisherYatesShuffle(selected, rng);
}
