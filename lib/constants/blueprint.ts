/**
 * NCCPA PANCE Blueprint 2025 - Single Source of Truth
 *
 * Official exam content weightings for PA-C certification.
 * All session generators and analytics MUST import from this file.
 *
 * Source: NCCPA 2025 Content Blueprint
 * Last Updated: January 2026
 *
 * @see https://www.nccpa.net/pance-content-blueprint
 */

/**
 * Official NCCPA 2025 Blueprint weights as decimals (sum = 1.0)
 * These are the definitive weights used across the entire application.
 */
export const NCCPA_2025_BLUEPRINT: Readonly<Record<string, number>> = {
  Cardiovascular: 0.11,
  Pulmonary: 0.09,
  Gastrointestinal: 0.09,
  Musculoskeletal: 0.09,
  HEENT: 0.08,
  Reproductive: 0.08,
  Neurological: 0.07,
  Psychiatry: 0.07,
  Endocrine: 0.06,
  Dermatology: 0.05,
  Genitourinary: 0.05,
  Hematology: 0.04,
  'Infectious Disease': 0.04,
  Nephrology: 0.04,
  'Emergency Medicine': 0.02,
  General: 0.02, // Fallback for uncategorized content
} as const;

/**
 * Blueprint weights as whole number percentages (sum = 100)
 * Use this when integer percentages are needed (e.g., UI display)
 */
export const NCCPA_2025_BLUEPRINT_PERCENT: Readonly<Record<string, number>> = {
  Cardiovascular: 11,
  Pulmonary: 9,
  Gastrointestinal: 9,
  Musculoskeletal: 9,
  HEENT: 8,
  Reproductive: 8,
  Neurological: 7,
  Psychiatry: 7,
  Endocrine: 6,
  Dermatology: 5,
  Genitourinary: 5,
  Hematology: 4,
  'Infectious Disease': 4,
  Nephrology: 4,
  'Emergency Medicine': 2,
  General: 2,
} as const;

/**
 * System aliases for flexible matching across the codebase.
 * Maps common abbreviations and alternate names to canonical system names.
 */
export const SYSTEM_ALIASES: Readonly<Record<string, string>> = {
  // Cardiovascular
  Cardiovascular: 'Cardiovascular',
  Cardiac: 'Cardiovascular',
  Cardiology: 'Cardiovascular',
  Heart: 'Cardiovascular',
  CV: 'Cardiovascular',

  // Pulmonary
  Pulmonary: 'Pulmonary',
  Pulm: 'Pulmonary',
  PULM: 'Pulmonary',
  Respiratory: 'Pulmonary',
  Lungs: 'Pulmonary',

  // Gastrointestinal
  Gastrointestinal: 'Gastrointestinal',
  GI: 'Gastrointestinal',
  Gastro: 'Gastrointestinal',
  Digestive: 'Gastrointestinal',

  // Musculoskeletal
  Musculoskeletal: 'Musculoskeletal',
  MSK: 'Musculoskeletal',
  Ortho: 'Musculoskeletal',
  Orthopedic: 'Musculoskeletal',

  // HEENT
  HEENT: 'HEENT',
  ENT: 'HEENT',
  Eyes: 'HEENT',
  Ears: 'HEENT',
  'Head and Neck': 'HEENT',

  // Reproductive
  Reproductive: 'Reproductive',
  'OB/GYN': 'Reproductive',
  OBGYN: 'Reproductive',
  "Women's Health": 'Reproductive',
  "Men's Health": 'Reproductive',

  // Neurological
  Neurological: 'Neurological',
  Neuro: 'Neurological',
  NEURO: 'Neurological',
  Neurology: 'Neurological',
  'Nervous System': 'Neurological',

  // Psychiatry
  Psychiatry: 'Psychiatry',
  Psych: 'Psychiatry',
  PSYCH: 'Psychiatry',
  'Mental Health': 'Psychiatry',
  Behavioral: 'Psychiatry',

  // Endocrine
  Endocrine: 'Endocrine',
  Endo: 'Endocrine',
  ENDO: 'Endocrine',
  Endocrinology: 'Endocrine',
  Hormones: 'Endocrine',

  // Dermatology
  Dermatology: 'Dermatology',
  Derm: 'Dermatology',
  DERM: 'Dermatology',
  Skin: 'Dermatology',

  // Genitourinary
  Genitourinary: 'Genitourinary',
  GU: 'Genitourinary',
  Urology: 'Genitourinary',

  // Hematology
  Hematology: 'Hematology',
  Heme: 'Hematology',
  HEME: 'Hematology',
  Blood: 'Hematology',
  Oncology: 'Hematology',

  // Infectious Disease
  'Infectious Disease': 'Infectious Disease',
  ID: 'Infectious Disease',
  Infectious: 'Infectious Disease',
  Infection: 'Infectious Disease',

  // Nephrology
  Nephrology: 'Nephrology',
  Renal: 'Nephrology',
  RENAL: 'Nephrology',
  Kidney: 'Nephrology',

  // Emergency Medicine
  'Emergency Medicine': 'Emergency Medicine',
  EM: 'Emergency Medicine',
  Emergency: 'Emergency Medicine',

  // General
  General: 'General',
  Other: 'General',
  Miscellaneous: 'General',
} as const;

/**
 * Minimum number of distinct systems required per 20-question block.
 * Research shows interleaving across 3+ systems improves retention.
 */
export const MIN_SYSTEMS_PER_BLOCK = 3;

/**
 * Maximum deviation allowed from blueprint weights before throwing error.
 * 5% tolerance accounts for rounding and small sample sizes.
 */
export const BLUEPRINT_TOLERANCE = 0.05;

/**
 * Validate that blueprint weights sum to approximately 1.0.
 * Throws an error if the sum deviates by more than BLUEPRINT_TOLERANCE.
 *
 * @throws Error if weights don't sum to ~1.0
 */
export function validateBlueprintWeights(): void {
  const sum = Object.values(NCCPA_2025_BLUEPRINT).reduce((a, b) => a + b, 0);
  const deviation = Math.abs(sum - 1.0);

  if (deviation > BLUEPRINT_TOLERANCE) {
    throw new Error(
      `Blueprint weights sum to ${sum.toFixed(4)}, expected ~1.0 (deviation: ${(deviation * 100).toFixed(2)}% exceeds ${BLUEPRINT_TOLERANCE * 100}% tolerance)`
    );
  }
}

/**
 * Normalize a system name to its canonical form.
 * Returns the input unchanged if no alias match is found.
 *
 * @param system - The system name to normalize
 * @returns Canonical system name
 */
export function normalizeSystemName(system: string): string {
  // Direct match
  if (SYSTEM_ALIASES[system]) {
    return SYSTEM_ALIASES[system];
  }

  // Case-insensitive match
  const lowerSystem = system.toLowerCase();
  for (const [alias, canonical] of Object.entries(SYSTEM_ALIASES)) {
    if (alias.toLowerCase() === lowerSystem) {
      return canonical;
    }
  }

  // Return as-is if no match found
  return system;
}

/**
 * Get the blueprint weight for a system (normalized).
 * Returns the General weight if the system is not found.
 *
 * @param system - The system name
 * @returns Blueprint weight (0-1)
 */
export function getSystemWeight(system: string): number {
  const normalized = normalizeSystemName(system);
  return NCCPA_2025_BLUEPRINT[normalized] ?? NCCPA_2025_BLUEPRINT.General;
}

/**
 * Calculate target distribution for a session of given size.
 * Rounds to nearest integer while ensuring total matches sessionSize.
 *
 * @param sessionSize - Number of questions in the session
 * @returns Map of system names to target question counts
 */
export function calculateTargetDistribution(sessionSize: number = 20): Record<string, number> {
  const distribution: Record<string, number> = {};
  let total = 0;

  // Calculate raw distribution
  for (const [system, weight] of Object.entries(NCCPA_2025_BLUEPRINT)) {
    if (system === 'General') continue; // Skip fallback category
    const target = Math.round(sessionSize * weight);
    if (target > 0) {
      distribution[system] = target;
      total += target;
    }
  }

  // Adjust for rounding errors
  if (total !== sessionSize) {
    const diff = sessionSize - total;
    // Add/remove from highest weighted system
    distribution['Cardiovascular'] = (distribution['Cardiovascular'] || 0) + diff;
  }

  return distribution;
}

/**
 * Validate that a question distribution meets blueprint requirements.
 * Returns validation result with any issues found.
 *
 * @param distribution - Actual question counts by system
 * @param sessionSize - Total questions in session
 * @returns Validation result
 */
export function validateSessionDistribution(
  distribution: Record<string, number>,
  sessionSize: number
): {
  isValid: boolean;
  issues: string[];
  deviationScore: number;
} {
  const issues: string[] = [];
  const target = calculateTargetDistribution(sessionSize);
  let totalDeviation = 0;

  // Check system diversity
  const distinctSystems = Object.keys(distribution).filter((k) => distribution[k] > 0).length;
  if (distinctSystems < MIN_SYSTEMS_PER_BLOCK) {
    issues.push(
      `Only ${distinctSystems} distinct systems (minimum ${MIN_SYSTEMS_PER_BLOCK} required)`
    );
  }

  // Check weight deviations
  for (const [system, targetCount] of Object.entries(target)) {
    const actualCount = distribution[system] || 0;
    const targetPercent = targetCount / sessionSize;
    const actualPercent = actualCount / sessionSize;
    const deviation = Math.abs(targetPercent - actualPercent);
    totalDeviation += deviation;

    if (deviation > BLUEPRINT_TOLERANCE) {
      issues.push(
        `${system}: ${(actualPercent * 100).toFixed(1)}% actual vs ${(targetPercent * 100).toFixed(1)}% target`
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    deviationScore: totalDeviation,
  };
}

/**
 * Get ordered list of systems by blueprint weight (highest first).
 * Useful for prioritizing content generation and display.
 */
export function getSystemsByWeight(): string[] {
  return Object.entries(NCCPA_2025_BLUEPRINT)
    .filter(([system]) => system !== 'General')
    .sort(([, a], [, b]) => b - a)
    .map(([system]) => system);
}

/**
 * Get all canonical system names (excluding General fallback).
 */
export function getAllSystems(): string[] {
  return Object.keys(NCCPA_2025_BLUEPRINT).filter((s) => s !== 'General');
}

// Run validation on module load to catch configuration errors early
validateBlueprintWeights();

export default {
  NCCPA_2025_BLUEPRINT,
  NCCPA_2025_BLUEPRINT_PERCENT,
  SYSTEM_ALIASES,
  MIN_SYSTEMS_PER_BLOCK,
  BLUEPRINT_TOLERANCE,
  validateBlueprintWeights,
  normalizeSystemName,
  getSystemWeight,
  calculateTargetDistribution,
  validateSessionDistribution,
  getSystemsByWeight,
  getAllSystems,
};
