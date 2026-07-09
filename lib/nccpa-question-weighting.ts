/**
 * NCCPA Blueprint Weighting System
 *
 * Ensures question sessions match the official PANCE exam distribution.
 * Based on the 2024 NCCPA Content Blueprint.
 *
 * Reference: docs/panceblueprint.md
 */

/**
 * Question Order Distribution by Learner Phase
 *
 * Maps Bloom's taxonomy to PANCE preparation stages:
 * - first  = Remember/Understand (recall a fact)
 * - second = Apply/Analyze (diagnose then treat — one intermediate step)
 * - third  = Evaluate/Create (multi-step vignette with confounders)
 *
 * PANCE actual distribution is approximately: 10% first, 35% second, 55% third
 */
export type LearnerPhase = 'didactic' | 'clinical' | 'pance_prep';

export interface OrderDistribution {
  first: number;   // percentage as decimal (0.0-1.0)
  second: number;
  third: number;
}

export const ORDER_DISTRIBUTION_BY_PHASE: Record<LearnerPhase, OrderDistribution> = {
  didactic: { first: 0.30, second: 0.50, third: 0.20 },   // building foundation
  clinical: { first: 0.15, second: 0.40, third: 0.45 },   // applying knowledge
  pance_prep: { first: 0.10, second: 0.35, third: 0.55 }, // match exam distribution
};

/**
 * PANCE Task Category Weights (per NCCPA 2025 blueprint)
 */
export const PANCE_TASK_CATEGORY_WEIGHTS: Record<string, number> = {
  diagnosis: 18,
  history_pe: 16,
  management: 16,
  pharmaceutical: 15,
  health_maintenance: 11,
  diagnostics: 10,
  basic_science: 8,
  professional: 6,
};

/**
 * Select question order based on learner phase distribution.
 * Uses weighted random selection.
 */
export function selectQuestionOrder(phase: LearnerPhase): 'first' | 'second' | 'third' {
  const dist = ORDER_DISTRIBUTION_BY_PHASE[phase];
  const rand = Math.random();
  if (rand < dist.first) return 'first';
  if (rand < dist.first + dist.second) return 'second';
  return 'third';
}

/**
 * Calculate how many questions of each order to include in a session.
 */
export function calculateOrderDistribution(
  sessionSize: number,
  phase: LearnerPhase
): { first: number; second: number; third: number } {
  const dist = ORDER_DISTRIBUTION_BY_PHASE[phase];
  const first = Math.round(sessionSize * dist.first);
  const third = Math.round(sessionSize * dist.third);
  const second = sessionSize - first - third; // remainder to avoid rounding drift
  return { first, second, third };
}

/**
 * User profile fields relevant to phase inference.
 * Matches a subset of the Prisma User model.
 */
export interface LearnerProfile {
  currentRotation?: string | null;
  eorTestDate?: Date | string | null;
  rotationEndDate?: Date | string | null;
  examDate?: Date | string | null;
  yearInProgram?: string | null;
  trainingPhase?: 'DIDACTIC' | 'CLINICAL' | 'GRADUATED' | null;
}

/**
 * Infer the learner phase from user profile data.
 *
 * Priority order:
 *   1. PANCE exam date < 8 weeks → pance_prep
 *   2. EOR exam date < 4 weeks → pance_prep (rotation crunch)
 *   3. On a clinical rotation with EOR > 4 weeks → clinical
 *   4. trainingPhase === CLINICAL or yearInProgram >= 2 → clinical
 *   5. trainingPhase === GRADUATED → pance_prep (recert / PANRE)
 *   6. Default → didactic
 *
 * @param profile  User profile fields (all optional/nullable for resilience)
 * @param now      Optional override for "today" (useful for testing)
 */
export function inferLearnerPhase(profile: LearnerProfile, now?: Date): LearnerPhase {
  const today = now ?? new Date();

  // Helper: parse a date field that may be a Date object or ISO string
  const toDate = (v: Date | string | null | undefined): Date | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const weeksUntil = (target: Date): number =>
    (target.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000);

  // ── Check PANCE exam date first (highest priority) ──
  const examDate = toDate(profile.examDate);
  if (examDate && weeksUntil(examDate) <= 8 && weeksUntil(examDate) >= -1) {
    return 'pance_prep';
  }

  // ── Check EOR / rotation end proximity ──
  const eorDate = toDate(profile.eorTestDate) ?? toDate(profile.rotationEndDate);
  if (eorDate) {
    const weeksToEor = weeksUntil(eorDate);
    if (weeksToEor <= 4 && weeksToEor >= -1) {
      // Rotation crunch — shift to exam-format questions
      return 'pance_prep';
    }
  }

  // ── Currently on a clinical rotation ──
  if (profile.currentRotation) {
    return 'clinical';
  }

  // ── Infer from DB training phase enum ──
  if (profile.trainingPhase === 'GRADUATED') {
    return 'pance_prep'; // PANRE / recertification
  }
  if (profile.trainingPhase === 'CLINICAL') {
    return 'clinical';
  }

  // ── Infer from year in program ──
  const year = profile.yearInProgram ? parseInt(profile.yearInProgram, 10) : NaN;
  if (!isNaN(year) && year >= 2) {
    return 'clinical';
  }

  // ── Default: didactic (first-year or unknown) ──
  return 'didactic';
}

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
  const sessionSize = 40;
  const distribution = calculateSessionDistribution(sessionSize);
  const selected = selectWeightedSystems(5);
  const testCounts = new Map([
    ['CV', 5],
    ['PULM', 4],
    ['GI', 3],
  ]);
  const validation = validateSessionDistribution(testCounts, sessionSize);

  return {
    sessionSize,
    distribution: Array.from(distribution.entries()),
    selected,
    validation,
  };
}
