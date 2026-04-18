/**
 * PANCE Distribution Service
 *
 * Manages accurate PANCE blueprint distribution for main session.
 * Single source of truth: lib/constants/blueprint.ts
 */

import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '@/lib/constants/blueprint';
import { PANCE_DECK, TASK_DECK, ABBREVIATION_TO_TOPIC_MAP } from "@/config/topic-map";

// PANCE Task Categories
export const PANCE_TASK_PERCENTAGES: Record<string, number> = {
  'Formulating Diagnosis': 18,
  'History Taking/PE': 16,
  'Using Diagnostic Studies': 14,
  'Clinical Intervention': 16,
  'Pharmaceutical Therapeutics': 14,
  'Health Maintenance': 10,
  'Applying Science Concepts': 12,
};

export interface SessionDistributionState {
  systemCounts: Record<string, number>;
  taskCounts: Record<string, number>;
  totalQuestions: number;
  startedAt: number;
  lastUpdated: number;
}

export interface DistributionDrift {
  system: string;
  expected: number;
  actual: number;
  driftPercent: number;
  needsCorrection: boolean;
}

const SESSION_STATE_KEY = 'panceai_session_distribution';

/**
 * Initialize or retrieve session distribution state
 */
export function getSessionDistribution(): SessionDistributionState {
  try {
    const stored = sessionStorage.getItem(SESSION_STATE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as SessionDistributionState;
      // Reset if session is stale (> 4 hours)
      if (Date.now() - state.lastUpdated > 4 * 60 * 60 * 1000) {
        return createFreshState();
      }
      return state;
    }
  } catch {
    // Ignore parse errors
  }
  return createFreshState();
}

function createFreshState(): SessionDistributionState {
  const systems = Object.keys(BLUEPRINT_PERCENT_BY_ABBREVIATION);
  const tasks = Object.keys(PANCE_TASK_PERCENTAGES);

  return {
    systemCounts: Object.fromEntries(systems.map((s) => [s, 0])),
    taskCounts: Object.fromEntries(tasks.map((t) => [t, 0])),
    totalQuestions: 0,
    startedAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

/**
 * Save session distribution state
 */
export function saveSessionDistribution(state: SessionDistributionState): void {
  state.lastUpdated = Date.now();
  sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
}

/**
 * Record a question in the distribution tracker
 */
export function recordQuestion(system: string, task?: string): void {
  const state = getSessionDistribution();

  // Normalize system code
  const normalizedSystem = normalizeSystemCode(system);
  if (normalizedSystem && state.systemCounts[normalizedSystem] !== undefined) {
    state.systemCounts[normalizedSystem]++;
  }

  // Record task if provided
  if (task && state.taskCounts[task] !== undefined) {
    state.taskCounts[task]++;
  }

  state.totalQuestions++;
  saveSessionDistribution(state);
}

/**
 * Normalize various system name formats to standard code
 */
export function normalizeSystemCode(system: string): string | null {
  // Already a code
  if (BLUEPRINT_PERCENT_BY_ABBREVIATION[system]) {
    return system;
  }

  // Try reverse lookup from full name
  const code = Object.entries(ABBREVIATION_TO_TOPIC_MAP).find(
    ([, fullName]) => fullName.toLowerCase() === system.toLowerCase()
  )?.[0];

  if (code && BLUEPRINT_PERCENT_BY_ABBREVIATION[code]) {
    return code;
  }

  // Common aliases
  const aliases: Record<string, string> = {
    cardiovascular: 'CV',
    cardio: 'CV',
    pulmonary: 'PULM',
    pulm: 'PULM',
    respiratory: 'PULM',
    gastrointestinal: 'GI',
    gastro: 'GI',
    musculoskeletal: 'MSK',
    orthopedic: 'MSK',
    infectious: 'ID',
    'infectious disease': 'ID',
    neurologic: 'NEURO',
    neurology: 'NEURO',
    psychiatric: 'PSYCH',
    psychiatry: 'PSYCH',
    'mental health': 'PSYCH',
    reproductive: 'REPRO',
    'ob/gyn': 'REPRO',
    obstetrics: 'REPRO',
    gynecology: 'REPRO',
    endocrine: 'ENDO',
    endocrinology: 'ENDO',
    heent: 'HEENT',
    ent: 'HEENT',
    ophthalmology: 'HEENT',
    professional: 'PRO',
    'professional practice': 'PRO',
    hematologic: 'HEME',
    hematology: 'HEME',
    oncology: 'HEME',
    renal: 'RENAL',
    nephrology: 'RENAL',
    dermatologic: 'DERM',
    dermatology: 'DERM',
    genitourinary: 'GU',
    urology: 'GU',
  };

  return aliases[system.toLowerCase()] || null;
}

/**
 * Calculate distribution drift from PANCE blueprint
 */
export function calculateDistributionDrift(): DistributionDrift[] {
  const state = getSessionDistribution();
  const drifts: DistributionDrift[] = [];

  if (state.totalQuestions < 5) {
    // Not enough data for meaningful drift calculation
    return [];
  }

  for (const [system, targetPercent] of Object.entries(BLUEPRINT_PERCENT_BY_ABBREVIATION)) {
    const actual = state.systemCounts[system] || 0;
    const actualPercent = (actual / state.totalQuestions) * 100;
    const driftPercent = actualPercent - targetPercent;

    drifts.push({
      system,
      expected: targetPercent,
      actual: Math.round(actualPercent * 10) / 10,
      driftPercent: Math.round(driftPercent * 10) / 10,
      needsCorrection: Math.abs(driftPercent) > 5, // >5% drift triggers correction
    });
  }

  return drifts.sort((a, b) => a.driftPercent - b.driftPercent);
}

/**
 * Get the next recommended system based on distribution drift
 * Returns systems that are under-represented
 */
export function getNextRecommendedSystem(): string | null {
  const drifts = calculateDistributionDrift();

  // Find most under-represented systems
  const underRepresented = drifts.filter((d) => d.driftPercent < -3);

  if (underRepresented.length === 0) {
    return null; // Distribution is balanced
  }

  // Weighted random selection favoring more under-represented systems
  const weights = underRepresented.map((d) => Math.abs(d.driftPercent));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < underRepresented.length; i++) {
    // underRepresented.length bounded loop: indices are valid.
    random -= weights[i]!;
    if (random <= 0) {
      return underRepresented[i]!.system;
    }
  }

  return underRepresented[0]!.system;
}

/**
 * Get session statistics summary
 */
export function getSessionSummary(): {
  totalQuestions: number;
  sessionDuration: number;
  systemBreakdown: Array<{
    system: string;
    name: string;
    count: number;
    percent: number;
    target: number;
  }>;
  questionsPerMinute: number;
  distributionScore: number;
} {
  const state = getSessionDistribution();
  const sessionDuration = (Date.now() - state.startedAt) / 1000 / 60; // minutes

  const systemBreakdown = Object.entries(state.systemCounts)
    .map(([system, count]) => ({
      system,
      name: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      count,
      percent: state.totalQuestions > 0 ? Math.round((count / state.totalQuestions) * 100) : 0,
      target: BLUEPRINT_PERCENT_BY_ABBREVIATION[system] || 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate distribution score (100 = perfect, lower = more drift)
  const drifts = calculateDistributionDrift();
  const avgDrift =
    drifts.length > 0
      ? drifts.reduce((sum, d) => sum + Math.abs(d.driftPercent), 0) / drifts.length
      : 0;
  const distributionScore = Math.max(0, Math.round(100 - avgDrift * 2));

  return {
    totalQuestions: state.totalQuestions,
    sessionDuration: Math.round(sessionDuration * 10) / 10,
    systemBreakdown,
    questionsPerMinute:
      sessionDuration > 0 ? Math.round((state.totalQuestions / sessionDuration) * 10) / 10 : 0,
    distributionScore,
  };
}

/**
 * Reset session distribution (for new session)
 */
export function resetSessionDistribution(): void {
  sessionStorage.removeItem(SESSION_STATE_KEY);
}

/**
 * Get a weighted random system following PANCE distribution
 * Uses the PANCE_DECK but allows drift correction
 */
export function getWeightedRandomSystem(enabledSystems?: Set<string>): string {
  // Check if we need drift correction
  const recommendedSystem = getNextRecommendedSystem();
  if (recommendedSystem && Math.random() < 0.3) {
    // 30% chance to use recommended system for drift correction
    if (!enabledSystems || enabledSystems.has(recommendedSystem)) {
      return recommendedSystem;
    }
  }

  // Filter deck to enabled systems
  let deck = [...PANCE_DECK];
  if (enabledSystems && enabledSystems.size > 0) {
    deck = deck.filter((system) => enabledSystems.has(system));
  }

  if (deck.length === 0) {
    deck = [...PANCE_DECK];
  }

  // Shuffle and pick; deck is guaranteed non-empty by the fallback above.
  const index = Math.floor(Math.random() * deck.length);
  return deck[index]!;
}

/**
 * Get a random task from PANCE task distribution
 */
export function getWeightedRandomTask(): string {
  const deck = [...TASK_DECK];
  const index = Math.floor(Math.random() * deck.length);
  // TASK_DECK is a non-empty constant.
  return deck[index]!;
}
