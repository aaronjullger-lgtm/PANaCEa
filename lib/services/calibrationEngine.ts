/**
 * Metacognitive Calibration Engine
 *
 * Research:
 * - Kruger & Dunning (1999). "Unskilled and Unaware of It." JPSP.
 * - Koriat (1997). "Monitoring one's own knowledge during study."
 * - "The Illusion of Knowing in College" (PMC, 2021)
 *
 * Builds a 2×2 confidence-accuracy matrix to identify four student states:
 *
 *   CONFIDENT + CORRECT     → Mastered (leave alone)
 *   CONFIDENT + INCORRECT   → Dangerous Misconception (highest priority fix)
 *   NOT CONFIDENT + CORRECT → Underconfident Mastery (build self-efficacy)
 *   NOT CONFIDENT + WRONG   → Acknowledged Gap (normal learning)
 *
 * "Dangerous Misconceptions" are the most harmful: the student thinks they
 * know the material but consistently gets it wrong. These get aggressive
 * FSRS rescheduling and explicit surfacing on the dashboard.
 *
 * @module lib/services/calibrationEngine
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type CalibrationState =
  | 'mastered'              // Confident + correct
  | 'dangerous_misconception' // Confident + incorrect — HIGHEST PRIORITY
  | 'underconfident_mastery'  // Not confident + correct
  | 'acknowledged_gap';       // Not confident + incorrect

export interface CalibrationEntry {
  questionId: string;
  conditionId: string | null;
  system: string | null;
  wasCorrect: boolean;
  confidence: number; // 0-1 (from implicit or explicit confidence)
  timestamp: Date;
}

export interface CalibrationQuadrant {
  state: CalibrationState;
  count: number;
  fraction: number;
  examples: CalibrationEntry[];
}

export interface CalibrationReport {
  totalEntries: number;
  quadrants: Record<CalibrationState, CalibrationQuadrant>;

  /** Misconceptions that need immediate attention */
  dangerousMisconceptions: MisconceptionAlert[];

  /** Underconfident areas where the student is better than they think */
  underconfidentAreas: string[];

  /** Overall calibration score: 0 = perfectly calibrated, 1 = totally miscalibrated */
  miscalibrationScore: number;

  /** Brier score for confidence calibration */
  brierScore: number;
}

export interface MisconceptionAlert {
  system: string;
  conditionId: string;
  incorrectCount: number;
  avgConfidence: number;
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Confidence threshold for "confident" vs "not confident" */
const CONFIDENCE_THRESHOLD = 0.6;

/** Minimum entries for a condition to be flagged as a misconception */
const MIN_ENTRIES_FOR_MISCONCEPTION = 3;

/** Minimum wrong-while-confident rate to flag a misconception */
const MISCONCEPTION_THRESHOLD = 0.6;

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Analyze calibration entries and produce a calibration report.
 */
export function analyzeCalibration(entries: CalibrationEntry[]): CalibrationReport {
  if (entries.length === 0) {
    return emptyReport();
  }

  // Classify each entry into a quadrant
  const classified = entries.map(e => ({
    ...e,
    state: classifyState(e.wasCorrect, e.confidence),
  }));

  // Build quadrants
  const quadrants: Record<CalibrationState, CalibrationQuadrant> = {
    mastered: buildQuadrant('mastered', classified),
    dangerous_misconception: buildQuadrant('dangerous_misconception', classified),
    underconfident_mastery: buildQuadrant('underconfident_mastery', classified),
    acknowledged_gap: buildQuadrant('acknowledged_gap', classified),
  };

  // Find dangerous misconceptions (grouped by condition)
  const misconceptions = findMisconceptions(classified);

  // Find underconfident areas (systems where they're mostly correct but not confident)
  const underconfident = findUnderconfidentAreas(classified);

  // Calculate miscalibration score
  const miscalibrationScore = calculateMiscalibration(entries);

  // Calculate Brier score
  const brierScore = calculateBrierScore(entries);

  return {
    totalEntries: entries.length,
    quadrants,
    dangerousMisconceptions: misconceptions,
    underconfidentAreas: underconfident,
    miscalibrationScore,
    brierScore,
  };
}

/**
 * Check if a specific concept has become a dangerous misconception.
 * Use this after each answer to detect emerging patterns.
 */
export function checkForMisconception(
  conditionEntries: CalibrationEntry[]
): MisconceptionAlert | null {
  if (conditionEntries.length < MIN_ENTRIES_FOR_MISCONCEPTION) return null;

  const confidentWrong = conditionEntries.filter(
    e => !e.wasCorrect && e.confidence >= CONFIDENCE_THRESHOLD
  );

  const rate = confidentWrong.length / conditionEntries.length;
  if (rate < MISCONCEPTION_THRESHOLD) return null;

  const first = conditionEntries[0]!;
  const system = first.system ?? 'Unknown';
  const conditionId = first.conditionId ?? 'unknown';
  const avgConf = confidentWrong.reduce((s, e) => s + e.confidence, 0) / confidentWrong.length;

  return {
    system,
    conditionId,
    incorrectCount: confidentWrong.length,
    avgConfidence: avgConf,
    message: `You've been confident but incorrect on this topic ${confidentWrong.length} times. This is a misconception that needs targeted review.`,
  };
}

/**
 * Get feedback message for the student based on their calibration state.
 * These messages are designed to be encouraging, not punitive.
 */
export function getCalibrationFeedback(
  wasCorrect: boolean,
  confidence: number
): { state: CalibrationState; message: string; emoji: string } {
  const state = classifyState(wasCorrect, confidence);

  switch (state) {
    case 'mastered':
      return {
        state,
        message: 'Confident and correct — this concept is solid.',
        emoji: '✓',
      };
    case 'dangerous_misconception':
      return {
        state,
        message: 'You felt sure about this one, but the answer was different. Worth a closer look.',
        emoji: '⚡',
      };
    case 'underconfident_mastery':
      return {
        state,
        message: 'You got this right even though you weren\'t sure — you know more than you think.',
        emoji: '💪',
      };
    case 'acknowledged_gap':
      return {
        state,
        message: 'You recognized you weren\'t sure, and that\'s great self-awareness. This will come with practice.',
        emoji: '📚',
      };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyState(wasCorrect: boolean, confidence: number): CalibrationState {
  const isConfident = confidence >= CONFIDENCE_THRESHOLD;

  if (wasCorrect && isConfident) return 'mastered';
  if (!wasCorrect && isConfident) return 'dangerous_misconception';
  if (wasCorrect && !isConfident) return 'underconfident_mastery';
  return 'acknowledged_gap';
}

function buildQuadrant(
  state: CalibrationState,
  classified: (CalibrationEntry & { state: CalibrationState })[]
): CalibrationQuadrant {
  const matching = classified.filter(e => e.state === state);
  return {
    state,
    count: matching.length,
    fraction: classified.length > 0 ? matching.length / classified.length : 0,
    examples: matching.slice(-5), // Keep last 5 as examples
  };
}

function findMisconceptions(
  classified: (CalibrationEntry & { state: CalibrationState })[]
): MisconceptionAlert[] {
  // Group by conditionId
  const byCondition = new Map<string, (CalibrationEntry & { state: CalibrationState })[]>();
  for (const entry of classified) {
    if (!entry.conditionId) continue;
    const existing = byCondition.get(entry.conditionId) ?? [];
    existing.push(entry);
    byCondition.set(entry.conditionId, existing);
  }

  const alerts: MisconceptionAlert[] = [];
  for (const [conditionId, entries] of byCondition) {
    const misconceptions = entries.filter(e => e.state === 'dangerous_misconception');
    if (misconceptions.length < MIN_ENTRIES_FOR_MISCONCEPTION) continue;

    const rate = misconceptions.length / entries.length;
    if (rate < MISCONCEPTION_THRESHOLD) continue;

    const avgConf = misconceptions.reduce((s, e) => s + e.confidence, 0) / misconceptions.length;
    alerts.push({
      system: entries[0]!.system ?? 'Unknown',
      conditionId,
      incorrectCount: misconceptions.length,
      avgConfidence: avgConf,
      message: `${misconceptions.length} confident-but-wrong answers detected. Targeted review recommended.`,
    });
  }

  return alerts.sort((a, b) => b.incorrectCount - a.incorrectCount);
}

function findUnderconfidentAreas(
  classified: (CalibrationEntry & { state: CalibrationState })[]
): string[] {
  // Group by system
  const bySystem = new Map<string, CalibrationState[]>();
  for (const entry of classified) {
    const sys = entry.system ?? 'Unknown';
    const existing = bySystem.get(sys) ?? [];
    existing.push(entry.state);
    bySystem.set(sys, existing);
  }

  const underconfident: string[] = [];
  for (const [system, states] of bySystem) {
    const underconfidentCount = states.filter(s => s === 'underconfident_mastery').length;
    if (states.length >= 5 && underconfidentCount / states.length > 0.3) {
      underconfident.push(system);
    }
  }

  return underconfident;
}

/**
 * Miscalibration score: mean absolute difference between confidence and accuracy.
 * 0 = perfectly calibrated, 1 = maximally miscalibrated.
 */
function calculateMiscalibration(entries: CalibrationEntry[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => {
    const actual = e.wasCorrect ? 1 : 0;
    return sum + Math.abs(e.confidence - actual);
  }, 0);
  return total / entries.length;
}

/**
 * Brier score: mean squared difference between confidence and outcome.
 * Lower is better. 0 = perfect, 0.25 = random, 1 = worst.
 */
function calculateBrierScore(entries: CalibrationEntry[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => {
    const actual = e.wasCorrect ? 1 : 0;
    return sum + Math.pow(e.confidence - actual, 2);
  }, 0);
  return total / entries.length;
}

function emptyReport(): CalibrationReport {
  const empty: CalibrationQuadrant = { state: 'mastered', count: 0, fraction: 0, examples: [] };
  return {
    totalEntries: 0,
    quadrants: {
      mastered: { ...empty, state: 'mastered' },
      dangerous_misconception: { ...empty, state: 'dangerous_misconception' },
      underconfident_mastery: { ...empty, state: 'underconfident_mastery' },
      acknowledged_gap: { ...empty, state: 'acknowledged_gap' },
    },
    dangerousMisconceptions: [],
    underconfidentAreas: [],
    miscalibrationScore: 0,
    brierScore: 0,
  };
}
