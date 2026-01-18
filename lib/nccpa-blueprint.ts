/**
 * NCCPA Blueprint Weighting & Interleaving System
 *
 * Implements research-backed interleaving for PANCE preparation.
 * Forces topic switching based on NCCPA exam blueprint weightings
 * to maximize "context change" benefits for long-term retention.
 *
 * Blueprint Source: NCCPA 2024 Content Blueprint
 * Research: Rohrer & Taylor (2007) - Interleaving improves retention
 */

/**
 * Official NCCPA Blueprint weights (2024)
 * Total = 100%
 */
export const NCCPA_BLUEPRINT_WEIGHTS: Record<string, number> = {
  Cardiovascular: 0.11,
  Pulmonary: 0.09,
  Gastrointestinal: 0.08,
  Musculoskeletal: 0.08,
  'Infectious Disease': 0.07,
  Neurological: 0.07,
  Psychiatry: 0.07,
  Reproductive: 0.07,
  Endocrine: 0.06,
  HEENT: 0.06,
  'Professional Practice': 0.06,
  Hematology: 0.05,
  Renal: 0.05,
  Dermatology: 0.04,
  Genitourinary: 0.04,
};

/**
 * System aliases for flexible matching
 */
export const SYSTEM_ALIASES: Record<string, string> = {
  // Primary names
  Cardiovascular: 'Cardiovascular',
  Cardiac: 'Cardiovascular',
  Cardiology: 'Cardiovascular',
  Heart: 'Cardiovascular',

  Pulmonary: 'Pulmonary',
  Pulm: 'Pulmonary',
  Respiratory: 'Pulmonary',
  Lungs: 'Pulmonary',

  Gastrointestinal: 'Gastrointestinal',
  GI: 'Gastrointestinal',
  Gastro: 'Gastrointestinal',
  Digestive: 'Gastrointestinal',

  Musculoskeletal: 'Musculoskeletal',
  MSK: 'Musculoskeletal',
  Ortho: 'Musculoskeletal',
  Orthopedic: 'Musculoskeletal',

  'Infectious Disease': 'Infectious Disease',
  ID: 'Infectious Disease',
  Infectious: 'Infectious Disease',
  Infection: 'Infectious Disease',

  Neurological: 'Neurological',
  Neuro: 'Neurological',
  Neurology: 'Neurological',
  'Nervous System': 'Neurological',

  Psychiatry: 'Psychiatry',
  Psych: 'Psychiatry',
  'Mental Health': 'Psychiatry',
  Behavioral: 'Psychiatry',

  Reproductive: 'Reproductive',
  'OB/GYN': 'Reproductive',
  OBGYN: 'Reproductive',
  "Women's Health": 'Reproductive',
  "Men's Health": 'Reproductive',

  Endocrine: 'Endocrine',
  Endo: 'Endocrine',
  Endocrinology: 'Endocrine',
  Hormones: 'Endocrine',

  HEENT: 'HEENT',
  ENT: 'HEENT',
  Eyes: 'HEENT',
  Ears: 'HEENT',
  'Head and Neck': 'HEENT',

  'Professional Practice': 'Professional Practice',
  'Prof Practice': 'Professional Practice',
  Ethics: 'Professional Practice',
  'Practice Management': 'Professional Practice',

  Hematology: 'Hematology',
  Heme: 'Hematology',
  Blood: 'Hematology',
  Oncology: 'Hematology',

  Renal: 'Renal',
  Nephrology: 'Renal',
  Kidney: 'Renal',

  Dermatology: 'Dermatology',
  Derm: 'Dermatology',
  Skin: 'Dermatology',

  Genitourinary: 'Genitourinary',
  GU: 'Genitourinary',
  Urology: 'Genitourinary',
};

/**
 * Minimum systems per 20-question block
 */
export const MIN_SYSTEMS_PER_BLOCK = 3;

/**
 * Target distribution for a 20-question session
 * Rounded to nearest integer based on blueprint weights
 */
export function calculateTargetDistribution(sessionSize: number = 20): Record<string, number> {
  const distribution: Record<string, number> = {};
  let total = 0;

  // Calculate raw distribution
  for (const [system, weight] of Object.entries(NCCPA_BLUEPRINT_WEIGHTS)) {
    const target = Math.round(sessionSize * weight);
    distribution[system] = target;
    total += target;
  }

  // Adjust for rounding errors
  if (total !== sessionSize) {
    const diff = sessionSize - total;
    // Add/remove from highest weighted system
    distribution['Cardiovascular'] += diff;
  }

  return distribution;
}

/**
 * Normalize system name to canonical form
 */
export function normalizeSystemName(system: string): string {
  const normalized = SYSTEM_ALIASES[system];
  if (normalized) return normalized;

  // Try case-insensitive match
  const lowerSystem = system.toLowerCase();
  for (const [alias, canonical] of Object.entries(SYSTEM_ALIASES)) {
    if (alias.toLowerCase() === lowerSystem) {
      return canonical;
    }
  }

  return system; // Return as-is if not found
}

/**
 * Question with system metadata
 */
export interface QuestionWithSystem {
  id: string;
  system: string;
  [key: string]: unknown;
}

/**
 * Interleaving result with metadata
 */
export interface InterleavingResult<T extends QuestionWithSystem> {
  questions: T[];
  systemDistribution: Record<string, number>;
  distinctSystems: number;
  meetsMinSystemRequirement: boolean;
  blueprintAdherence: number; // 0-1 score
}

/**
 * Weighted random selection of systems based on blueprint
 */
function selectWeightedSystem(
  availableSystems: string[],
  recentSystems: string[],
  avoidRepeat: number = 2
): string {
  // Filter out recently used systems if possible
  let candidates = availableSystems.filter((s) => !recentSystems.slice(-avoidRepeat).includes(s));

  // If too restrictive, allow recent systems
  if (candidates.length === 0) {
    candidates = availableSystems;
  }

  // Calculate weights for candidates
  let totalWeight = 0;
  const weights: { system: string; weight: number }[] = [];

  for (const system of candidates) {
    const weight = NCCPA_BLUEPRINT_WEIGHTS[system] || 0.05; // Default weight
    weights.push({ system, weight });
    totalWeight += weight;
  }

  // Weighted random selection
  let random = Math.random() * totalWeight;
  for (const { system, weight } of weights) {
    random -= weight;
    if (random <= 0) return system;
  }

  return candidates[0]; // Fallback
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Apply interleaving to a question set
 *
 * Algorithm:
 * 1. Group questions by system
 * 2. Build sequence using weighted selection with no-repeat constraint
 * 3. Ensure minimum system diversity (M ≥ 3)
 * 4. Calculate blueprint adherence score
 */
export function applyInterleaving<T extends QuestionWithSystem>(
  questions: T[],
  options: {
    blockSize?: number;
    minSystems?: number;
    avoidRepeatWindow?: number;
  } = {}
): InterleavingResult<T> {
  const { blockSize = 20, minSystems = MIN_SYSTEMS_PER_BLOCK, avoidRepeatWindow = 2 } = options;

  // Group questions by normalized system
  const bySystem = new Map<string, T[]>();
  for (const q of questions) {
    const system = normalizeSystemName(q.system);
    if (!bySystem.has(system)) bySystem.set(system, []);
    bySystem.get(system)!.push(q);
  }

  // Shuffle within each system group
  for (const [system, qs] of bySystem) {
    bySystem.set(system, shuffleArray(qs));
  }

  const availableSystems = Array.from(bySystem.keys());
  const result: T[] = [];
  const recentSystems: string[] = [];
  const systemCounts: Record<string, number> = {};
  const targetSize = Math.min(blockSize, questions.length);

  // Build interleaved sequence
  while (result.length < targetSize) {
    // Select next system
    const systemsWithQuestions = availableSystems.filter((s) => (bySystem.get(s)?.length || 0) > 0);

    if (systemsWithQuestions.length === 0) break;

    const selectedSystem = selectWeightedSystem(
      systemsWithQuestions,
      recentSystems,
      avoidRepeatWindow
    );

    // Get next question from selected system
    const systemQuestions = bySystem.get(selectedSystem)!;
    const question = systemQuestions.shift()!;

    result.push(question);
    recentSystems.push(selectedSystem);
    systemCounts[selectedSystem] = (systemCounts[selectedSystem] || 0) + 1;
  }

  // Calculate metrics
  const distinctSystems = Object.keys(systemCounts).length;
  const meetsMinSystemRequirement = distinctSystems >= minSystems;

  // Calculate blueprint adherence (cosine similarity)
  const targetDist = calculateTargetDistribution(result.length);
  let dotProduct = 0;
  let targetMagnitude = 0;
  let actualMagnitude = 0;

  for (const system of Object.keys(NCCPA_BLUEPRINT_WEIGHTS)) {
    const target = targetDist[system] || 0;
    const actual = systemCounts[system] || 0;
    dotProduct += target * actual;
    targetMagnitude += target * target;
    actualMagnitude += actual * actual;
  }

  const blueprintAdherence =
    targetMagnitude > 0 && actualMagnitude > 0
      ? dotProduct / (Math.sqrt(targetMagnitude) * Math.sqrt(actualMagnitude))
      : 0;

  return {
    questions: result,
    systemDistribution: systemCounts,
    distinctSystems,
    meetsMinSystemRequirement,
    blueprintAdherence,
  };
}

/**
 * Validate that a question set meets interleaving requirements
 */
export function validateInterleaving<T extends QuestionWithSystem>(
  questions: T[],
  blockSize: number = 20,
  minSystems: number = MIN_SYSTEMS_PER_BLOCK
): {
  isValid: boolean;
  issues: string[];
  systemDistribution: Record<string, number>;
} {
  const issues: string[] = [];
  const systemCounts: Record<string, number> = {};

  for (const q of questions.slice(0, blockSize)) {
    const system = normalizeSystemName(q.system);
    systemCounts[system] = (systemCounts[system] || 0) + 1;
  }

  const distinctSystems = Object.keys(systemCounts).length;

  if (distinctSystems < minSystems) {
    issues.push(`Only ${distinctSystems} distinct systems (minimum ${minSystems} required)`);
  }

  // Check for excessive repetition
  let lastSystem = '';
  let repeatCount = 0;
  for (const q of questions.slice(0, blockSize)) {
    const system = normalizeSystemName(q.system);
    if (system === lastSystem) {
      repeatCount++;
      if (repeatCount >= 3) {
        issues.push(`${system} appears ${repeatCount + 1} times consecutively`);
      }
    } else {
      repeatCount = 0;
    }
    lastSystem = system;
  }

  return {
    isValid: issues.length === 0,
    issues,
    systemDistribution: systemCounts,
  };
}

/**
 * Get recommended study focus based on performance gaps
 */
export function getWeakSystemRecommendations(
  performanceBySystem: Record<string, { correct: number; total: number }>
): string[] {
  const weakSystems: { system: string; score: number; weight: number }[] = [];

  for (const [system, { correct, total }] of Object.entries(performanceBySystem)) {
    if (total < 5) continue; // Not enough data

    const accuracy = correct / total;
    const weight = NCCPA_BLUEPRINT_WEIGHTS[system] || 0.05;

    // Score = (1 - accuracy) * blueprint_weight
    // Higher score = more important to improve
    const score = (1 - accuracy) * weight;
    weakSystems.push({ system, score, weight });
  }

  // Sort by score descending
  weakSystems.sort((a, b) => b.score - a.score);

  // Return top 3 weak systems
  return weakSystems.slice(0, 3).map((s) => s.system);
}

export default {
  NCCPA_BLUEPRINT_WEIGHTS,
  SYSTEM_ALIASES,
  MIN_SYSTEMS_PER_BLOCK,
  calculateTargetDistribution,
  normalizeSystemName,
  applyInterleaving,
  validateInterleaving,
  getWeakSystemRecommendations,
};
