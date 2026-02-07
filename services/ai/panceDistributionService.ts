/**
 * PANCE Distribution Service
 *
 * Implements weighted random sampling based on the 2025 NCCPA PANCE Blueprint.
 * Ensures question generation follows the official exam content distribution.
 *
 * ARCHITECTURE: Database-First
 * - This service coordinates weighted selection, but content comes from Prisma queries
 * - No static content arrays (per .clinerules)
 */

/**
 * Official 2025 PANCE Blueprint System Percentages
 * Source: .clinerules SYSTEM 3 mandate
 */
export const PANCE_SYSTEM_PERCENTAGES: Record<string, number> = {
  Cardiovascular: 11,
  Pulmonary: 9,
  'GI / Nutrition': 8,
  Musculoskeletal: 8,
  HEENT: 8,
  'Reproductive (Male & Female)': 7,
  Psychiatry: 7,
  Endocrine: 6,
  Genitourinary: 6,
  Dermatology: 5,
  Neurology: 5,
  Hematology: 5,
  Infectious: 5,
  'Renal / Urology': 4,
  Immunology: 3,
  Other: 3,
};

/**
 * PANCE Task Categories (Clinical Assessment Areas)
 * Based on NCCPA task distribution
 */
export const PANCE_TASK_PERCENTAGES: Record<string, number> = {
  Diagnosis: 30,
  'History & Physical': 25,
  Treatment: 20,
  'Health Maintenance': 15,
  'Applying Basic Science': 10,
};

/**
 * System name normalization map
 * Handles variations in system naming conventions
 */
const SYSTEM_ALIASES: Record<string, string> = {
  cardio: 'Cardiovascular',
  cardiovascular: 'Cardiovascular',
  cardiac: 'Cardiovascular',
  pulm: 'Pulmonary',
  pulmonary: 'Pulmonary',
  respiratory: 'Pulmonary',
  gi: 'GI / Nutrition',
  gastrointestinal: 'GI / Nutrition',
  'gi/nutrition': 'GI / Nutrition',
  msk: 'Musculoskeletal',
  musculoskeletal: 'Musculoskeletal',
  ortho: 'Musculoskeletal',
  heent: 'HEENT',
  'ent/ophthalmology': 'HEENT',
  reproductive: 'Reproductive (Male & Female)',
  'reproductive (male & female)': 'Reproductive (Male & Female)',
  psych: 'Psychiatry',
  psychiatry: 'Psychiatry',
  'behavioral health': 'Psychiatry',
  endo: 'Endocrine',
  endocrine: 'Endocrine',
  gu: 'Genitourinary',
  genitourinary: 'Genitourinary',
  derm: 'Dermatology',
  dermatology: 'Dermatology',
  neuro: 'Neurology',
  neurology: 'Neurology',
  heme: 'Hematology',
  hematology: 'Hematology',
  id: 'Infectious',
  infectious: 'Infectious',
  'infectious disease': 'Infectious',
  renal: 'Renal / Urology',
  'renal/urology': 'Renal / Urology',
  immuno: 'Immunology',
  immunology: 'Immunology',
};

/**
 * Question distribution tracker (in-memory)
 * Used to monitor drift from target distribution
 */
interface DistributionTracker {
  systems: Record<string, number>;
  tasks: Record<string, number>;
  totalQuestions: number;
}

const distributionTracker: DistributionTracker = {
  systems: {},
  tasks: {},
  totalQuestions: 0,
};

/**
 * Normalize system code to official PANCE system name
 *
 * @param code - System code or alias
 * @returns Normalized system name or null if unrecognized
 */
export function normalizeSystemCode(code: string): string | null {
  if (!code) return null;

  const normalized = code.toLowerCase().trim();

  // Check if it's already a valid system
  const exactMatch = Object.keys(PANCE_SYSTEM_PERCENTAGES).find(
    (sys) => sys.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;

  // Check aliases
  if (SYSTEM_ALIASES[normalized]) {
    return SYSTEM_ALIASES[normalized];
  }

  // No match found
  return null;
}

/**
 * Get weighted random system based on PANCE distribution
 *
 * @param enabledSystems - Optional set of enabled systems to filter by
 * @returns Selected system name
 */
export function getWeightedRandomSystem(enabledSystems?: Set<string>): string {
  // Filter to enabled systems only
  const availableSystems = enabledSystems
    ? Object.keys(PANCE_SYSTEM_PERCENTAGES).filter((sys) => enabledSystems.has(sys))
    : Object.keys(PANCE_SYSTEM_PERCENTAGES);

  if (availableSystems.length === 0) {
    // Fallback to Cardiovascular if no systems enabled
    return 'Cardiovascular';
  }

  // Build weighted array
  const weights = availableSystems.map((sys) => PANCE_SYSTEM_PERCENTAGES[sys] || 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Generate random value
  const random = Math.random() * totalWeight;

  // Select weighted system
  let cumulativeWeight = 0;
  for (let i = 0; i < availableSystems.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      return availableSystems[i];
    }
  }

  // Fallback (should never reach here)
  return availableSystems[0] ?? 'Cardiovascular';
}

/**
 * Get weighted random task category
 *
 * @returns Selected task name
 */
export function getWeightedRandomTask(): string {
  const tasks = Object.keys(PANCE_TASK_PERCENTAGES);
  const weights = tasks.map((task) => PANCE_TASK_PERCENTAGES[task]);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const random = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (let i = 0; i < tasks.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      return tasks[i];
    }
  }

  // Fallback
  return 'Diagnosis';
}

/**
 * Record a generated question in the distribution tracker
 *
 * @param system - System name
 * @param task - Task category
 */
export function recordQuestion(system: string, task: string): void {
  if (!distributionTracker.systems[system]) {
    distributionTracker.systems[system] = 0;
  }
  if (!distributionTracker.tasks[task]) {
    distributionTracker.tasks[task] = 0;
  }

  distributionTracker.systems[system]++;
  distributionTracker.tasks[task]++;
  distributionTracker.totalQuestions++;
}

/**
 * Get current distribution statistics
 *
 * @returns Current vs target distribution analysis
 */
export function getDistributionStats(): {
  systems: Record<string, { actual: number; target: number; drift: number }>;
  tasks: Record<string, { actual: number; target: number; drift: number }>;
  totalQuestions: number;
} {
  const { systems, tasks, totalQuestions } = distributionTracker;

  // Calculate system drift
  const systemStats: Record<string, { actual: number; target: number; drift: number }> = {};
  for (const [system, count] of Object.entries(systems)) {
    const actualPercent = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
    const targetPercent = PANCE_SYSTEM_PERCENTAGES[system] || 0;
    systemStats[system] = {
      actual: actualPercent,
      target: targetPercent,
      drift: actualPercent - targetPercent,
    };
  }

  // Calculate task drift
  const taskStats: Record<string, { actual: number; target: number; drift: number }> = {};
  for (const [task, count] of Object.entries(tasks)) {
    const actualPercent = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
    const targetPercent = PANCE_TASK_PERCENTAGES[task] || 0;
    taskStats[task] = {
      actual: actualPercent,
      target: targetPercent,
      drift: actualPercent - targetPercent,
    };
  }

  return {
    systems: systemStats,
    tasks: taskStats,
    totalQuestions,
  };
}

/**
 * Reset distribution tracker
 * (Useful for testing or session boundaries)
 */
export function resetDistributionTracker(): void {
  distributionTracker.systems = {};
  distributionTracker.tasks = {};
  distributionTracker.totalQuestions = 0;
}
