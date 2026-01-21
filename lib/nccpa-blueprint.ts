/**
 * NCCPA Blueprint Weighting & Interleaving System
 *
 * Implements research-backed interleaving for PANCE preparation.
 * Forces topic switching based on NCCPA exam blueprint weightings
 * to maximize "context change" benefits for long-term retention.
 *
 * Blueprint Source: NCCPA 2025 Content Blueprint
 * Research: Rohrer & Taylor (2007) - Interleaving improves retention
 *
 * NOTE: This module re-exports from lib/constants/blueprint.ts for
 * backward compatibility. New code should import directly from there.
 */

// Re-export canonical constants from single source of truth
export {
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
} from './constants/blueprint';

// Backward compatibility: alias the old constant name
import { NCCPA_2025_BLUEPRINT, SYSTEM_ALIASES as CANONICAL_ALIASES } from './constants/blueprint';

/**
 * @deprecated Use NCCPA_2025_BLUEPRINT from lib/constants/blueprint.ts instead
 * Keeping for backward compatibility with existing imports.
 */
export const NCCPA_BLUEPRINT_WEIGHTS: Record<string, number> = { ...NCCPA_2025_BLUEPRINT };

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
    const weight = NCCPA_2025_BLUEPRINT[system] || 0.05; // Default weight
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
  const { blockSize = 20, minSystems = 3, avoidRepeatWindow = 2 } = options;

  // Import normalizeSystemName locally to use canonical version
  const normalizeSystem = (system: string): string => {
    if (CANONICAL_ALIASES[system]) return CANONICAL_ALIASES[system];
    const lowerSystem = system.toLowerCase();
    for (const [alias, canonical] of Object.entries(CANONICAL_ALIASES)) {
      if (alias.toLowerCase() === lowerSystem) return canonical;
    }
    return system;
  };

  // Group questions by normalized system
  const bySystem = new Map<string, T[]>();
  for (const q of questions) {
    const system = normalizeSystem(q.system);
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
  let dotProduct = 0;
  let targetMagnitude = 0;
  let actualMagnitude = 0;

  for (const system of Object.keys(NCCPA_2025_BLUEPRINT)) {
    const targetWeight = NCCPA_2025_BLUEPRINT[system] || 0;
    const target = Math.round(result.length * targetWeight);
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
  minSystems: number = 3
): {
  isValid: boolean;
  issues: string[];
  systemDistribution: Record<string, number>;
} {
  const issues: string[] = [];
  const systemCounts: Record<string, number> = {};

  const normalizeSystem = (system: string): string => {
    if (CANONICAL_ALIASES[system]) return CANONICAL_ALIASES[system];
    const lowerSystem = system.toLowerCase();
    for (const [alias, canonical] of Object.entries(CANONICAL_ALIASES)) {
      if (alias.toLowerCase() === lowerSystem) return canonical;
    }
    return system;
  };

  for (const q of questions.slice(0, blockSize)) {
    const system = normalizeSystem(q.system);
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
    const system = normalizeSystem(q.system);
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
    const weight = NCCPA_2025_BLUEPRINT[system] || 0.05;

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
  NCCPA_2025_BLUEPRINT,
  SYSTEM_ALIASES: CANONICAL_ALIASES,
  MIN_SYSTEMS_PER_BLOCK: 3,
  applyInterleaving,
  validateInterleaving,
  getWeakSystemRecommendations,
};