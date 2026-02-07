/**
 * NCCPA Blueprint Weighting System
 *
 * Ensures question sessions match the official PANCE exam distribution.
 * Based on the 2024 NCCPA Content Blueprint.
 *
 * Reference: docs/panceblueprint.md
 */

export interface SystemWeight {
  system: string;
  percentage: number;
  questionsPerHundred: number;
  questionsPerSession: (sessionSize: number) => number;
}

/**
 * Official NCCPA PANCE Blueprint Weights
 * Total adds to 100%
 */
export const NCCPA_BLUEPRINT_WEIGHTS: Record<string, number> = {
  CV: 11, // Cardiovascular
  PULM: 9, // Pulmonary
  GI: 9, // Gastrointestinal
  MSK: 9, // Musculoskeletal
  HEENT: 8, // Head/Eyes/Ears/Nose/Throat
  REPRO: 8, // Reproductive
  NEURO: 7, // Neurologic
  PSYCH: 7, // Psychiatry/Behavioral
  ENDO: 6, // Endocrine
  DERM: 5, // Dermatologic
  GU: 5, // Genitourinary
  HEME: 4, // Hematologic
  ID: 4, // Infectious Disease
  RENAL: 4, // Renal
  EMERGENCY: 2, // Emergency Medicine
};

/**
 * System aliases for flexible matching
 */
const SYSTEM_ALIASES: Record<string, string> = {
  CARDIOVASCULAR: 'CV',
  CARDIAC: 'CV',
  HEART: 'CV',
  PULMONARY: 'PULM',
  RESPIRATORY: 'PULM',
  LUNG: 'PULM',
  GASTROINTESTINAL: 'GI',
  DIGESTIVE: 'GI',
  MUSCULOSKELETAL: 'MSK',
  ORTHOPEDIC: 'MSK',
  ORTHO: 'MSK',
  EYES_EARS_NOSE_THROAT: 'HEENT',
  ENT: 'HEENT',
  REPRODUCTIVE: 'REPRO',
  OB_GYN: 'REPRO',
  OBGYN: 'REPRO',
  NEUROLOGIC: 'NEURO',
  NEUROLOGY: 'NEURO',
  PSYCHIATRY: 'PSYCH',
  BEHAVIORAL: 'PSYCH',
  MENTAL_HEALTH: 'PSYCH',
  ENDOCRINE: 'ENDO',
  DERMATOLOGIC: 'DERM',
  SKIN: 'DERM',
  GENITOURINARY: 'GU',
  UROLOGY: 'GU',
  HEMATOLOGIC: 'HEME',
  BLOOD: 'HEME',
  INFECTIOUS_DISEASE: 'ID',
  INFECTION: 'ID',
  RENAL: 'RENAL',
  KIDNEY: 'RENAL',
  EMERGENCY: 'EMERGENCY',
  ER: 'EMERGENCY',
};

/**
 * Normalize system code to NCCPA standard
 */
export function normalizeSystemCode(system: string): string {
  if (!system) return 'UNKNOWN';

  const upper = system.toUpperCase().trim();

  // Check if already a valid code
  if (upper in NCCPA_BLUEPRINT_WEIGHTS) return upper;

  // Check aliases
  if (upper in SYSTEM_ALIASES) return SYSTEM_ALIASES[upper] ?? upper;

  // Return as-is if not found (will get 0% weight)
  return upper;
}

/**
 * Get weight percentage for a system (0-100)
 */
export function getSystemWeight(system: string): number {
  const normalized = normalizeSystemCode(system);
  return NCCPA_BLUEPRINT_WEIGHTS[normalized] || 0;
}

/**
 * Calculate number of questions for each system in a session
 *
 * @param sessionSize - Total number of questions in session (e.g., 40)
 * @returns Map of system -> question count
 */
export function calculateSessionDistribution(sessionSize: number): Map<string, number> {
  const distribution = new Map<string, number>();

  // Calculate ideal distribution
  for (const [system, percentage] of Object.entries(NCCPA_BLUEPRINT_WEIGHTS)) {
    const idealCount = (percentage / 100) * sessionSize;
    distribution.set(system, Math.round(idealCount));
  }

  // Adjust for rounding errors to ensure total equals sessionSize
  const total = Array.from(distribution.values()).reduce((sum, count) => sum + count, 0);

  if (total !== sessionSize) {
    const diff = sessionSize - total;
    const systems = Array.from(distribution.entries()).sort((a, b) => b[1] - a[1]);

    // Add/subtract from largest systems
    for (let i = 0; i < Math.abs(diff); i++) {
      const entry = systems[i % systems.length];
      if (entry == null) continue;
      const [system, count] = entry;
      distribution.set(system, count + Math.sign(diff));
    }
  }

  return distribution;
}

/**
 * Select systems weighted by NCCPA blueprint
 *
 * @param count - Number of systems to select
 * @param exclude - Systems to exclude from selection
 * @returns Array of selected system codes
 */
export function selectWeightedSystems(count: number, exclude: Set<string> = new Set()): string[] {
  const systems = Object.entries(NCCPA_BLUEPRINT_WEIGHTS)
    .filter(([system]) => !exclude.has(system))
    .map(([system, weight]) => ({ system, weight }));

  const selected: string[] = [];
  const cumulativeWeights = systems.map((s, i) =>
    systems.slice(0, i + 1).reduce((sum, sys) => sum + sys.weight, 0)
  );
  const totalWeight = cumulativeWeights[cumulativeWeights.length - 1] ?? 0;

  for (let i = 0; i < count; i++) {
    const rand = Math.random() * totalWeight;
    const index = cumulativeWeights.findIndex((w) => w >= rand);

    if (index !== -1) {
      const sys = systems[index];
      if (sys) selected.push(sys.system);
    }
  }

  return selected;
}

/**
 * Validate if a session distribution matches NCCPA blueprint
 * Returns true if within acceptable tolerance (±2% per system)
 */
export function validateSessionDistribution(
  questionCounts: Map<string, number>,
  sessionSize: number,
  tolerance: number = 2
): { valid: boolean; violations: Array<{ system: string; expected: number; actual: number }> } {
  const violations: Array<{ system: string; expected: number; actual: number }> = [];

  for (const [system, expectedPercentage] of Object.entries(NCCPA_BLUEPRINT_WEIGHTS)) {
    const actualCount = questionCounts.get(system) || 0;
    const actualPercentage = (actualCount / sessionSize) * 100;
    const diff = Math.abs(actualPercentage - expectedPercentage);

    if (diff > tolerance) {
      violations.push({
        system,
        expected: expectedPercentage,
        actual: actualPercentage,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Get system weights as array sorted by percentage (high to low)
 */
export function getSystemWeightsSorted(): SystemWeight[] {
  return Object.entries(NCCPA_BLUEPRINT_WEIGHTS)
    .map(([system, percentage]) => ({
      system,
      percentage,
      questionsPerHundred: percentage,
      questionsPerSession: (sessionSize: number) => Math.round((percentage / 100) * sessionSize),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Get distribution summary for display
 */
export function getDistributionSummary(sessionSize: number = 40): string {
  const distribution = calculateSessionDistribution(sessionSize);
  const sorted = Array.from(distribution.entries()).sort((a, b) => b[1] - a[1]);

  let summary = `NCCPA Blueprint Distribution (${sessionSize} questions):\n`;
  summary += sorted
    .map(([system, count]) => `  ${system}: ${count} (${getSystemWeight(system)}%)`)
    .join('\n');

  return summary;
}

/**
 * Sample usage example
 */
export function exampleUsage() {
  console.log('🎓 NCCPA Blueprint Weighting System\n');

  // 40-question session
  const sessionSize = 40;
  const distribution = calculateSessionDistribution(sessionSize);

  console.log(`Distribution for ${sessionSize}-question session:`);
  for (const [system, count] of distribution) {
    console.log(`  ${system}: ${count} questions (${getSystemWeight(system)}%)`);
  }

  console.log('\nWeighted random selection (5 systems):');
  const selected = selectWeightedSystems(5);
  console.log(`  ${selected.join(', ')}`);

  console.log('\nValidation:');
  const testCounts = new Map([
    ['CV', 5],
    ['PULM', 4],
    ['GI', 3],
  ]);
  const validation = validateSessionDistribution(testCounts, 40);
  console.log(`  Valid: ${validation.valid}`);
  if (!validation.valid) {
    console.log('  Violations:', validation.violations);
  }
}
