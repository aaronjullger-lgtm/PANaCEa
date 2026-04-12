/**
 * Item Calibration Service
 *
 * Computes psychometric quality metrics for questions from student response data.
 * Implements Elo-based dynamic difficulty + classical test theory (CTT) metrics.
 *
 * Metrics computed per question:
 *   - Elo difficulty (logit scale, updated via student-item interactions)
 *   - p-value (proportion correct)
 *   - Discrimination index D (upper 27% - lower 27%)
 *   - Point-biserial correlation r_pb
 *   - Distractor analysis (selection rates by ability group)
 *   - Quality flag (good / review / poor / remove)
 *
 * Research basis:
 *   - Pelánek (2016): Elo in education (Computers & Education, 98)
 *   - IRT 3PL: P = c + (1-c) / (1 + e^(-a(θ-b)))
 *   - Veerkamp & Glas (2000): CUSUM for item parameter drift
 *
 * @see lib/services/irtEloService.ts — Intra-session ordering (companion)
 * @module lib/services/itemCalibrationService
 */

import { BASE_K_FACTOR, MIN_K_FACTOR } from '@/lib/services/irtEloService';

// ─── Types ────────────────────────────────────────────────────────

export interface AttemptRecord {
  questionId: string;
  userId: string;
  wasCorrect: boolean;
  selectedAnswer: string;
  timeSpentMs: number;
  /** User's overall accuracy (0-1) for ability ranking */
  userAccuracy: number;
  createdAt: Date;
}

export interface DistractorStats {
  /** Answer option text */
  option: string;
  /** Total times selected */
  selectedCount: number;
  /** Times selected by top 27% ability group */
  selectedByTop: number;
  /** Times selected by bottom 27% ability group */
  selectedByBottom: number;
  /** Selection proportion */
  proportion: number;
  /** Distractor discrimination (top - bottom rate) */
  discrimination: number;
  /** Quality classification */
  quality: 'functional' | 'weak' | 'negative';
}

export type QualityFlag = 'good' | 'review' | 'poor' | 'remove';

export interface ItemCalibration {
  questionId: string;
  /** Elo difficulty on logit scale (-3 to +3), 0 = average */
  eloDifficulty: number;
  /** Glicko-style uncertainty (decreases with observations) */
  uncertainty: number;
  /** Proportion correct (0-1) */
  pValue: number;
  /** Discrimination index D = P_high - P_low */
  discriminationIndex: number;
  /** Point-biserial correlation */
  pointBiserial: number;
  /** Per-distractor analysis */
  distractorStats: DistractorStats[];
  /** Quality classification */
  qualityFlag: QualityFlag;
  /** Specific quality issues found */
  qualityIssues: string[];
  /** Total student responses */
  totalResponses: number;
  /** Calibration timestamp */
  lastCalibratedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────

/** Percentile split for discrimination index (upper/lower groups) */
const DISCRIMINATION_PERCENTILE = 0.27;
/** Minimum responses before calibrating */
export const MIN_OBSERVATIONS = 30;
/** Thresholds for quality flagging */
const DI_GOOD = 0.30;
const DI_REVIEW = 0.10;
const PB_GOOD = 0.20;
const PB_REVIEW = 0.10;
const DISTRACTOR_MIN_SELECTION = 0.05;
/** Uncertainty decay per observation */
const UNCERTAINTY_DECAY = 0.98;
const DEFAULT_UNCERTAINTY = 2.0;
const MIN_UNCERTAINTY = 0.3;

// ─── Core Computations ───────────────────────────────────────────

/**
 * Compute p-value (facility) and discrimination index from attempts.
 * Discrimination uses upper/lower 27% by user accuracy.
 */
export function computeDiscriminationMetrics(attempts: AttemptRecord[]): {
  pValue: number;
  discriminationIndex: number;
} {
  const n = attempts.length;
  if (n === 0) return { pValue: 0, discriminationIndex: 0 };

  const pValue = attempts.filter((a) => a.wasCorrect).length / n;

  // Sort by user accuracy to identify top/bottom groups
  const sorted = [...attempts].sort((a, b) => b.userAccuracy - a.userAccuracy);
  const groupSize = Math.max(1, Math.floor(n * DISCRIMINATION_PERCENTILE));
  const topGroup = sorted.slice(0, groupSize);
  const bottomGroup = sorted.slice(-groupSize);

  const pTop = topGroup.filter((a) => a.wasCorrect).length / topGroup.length;
  const pBottom = bottomGroup.filter((a) => a.wasCorrect).length / bottomGroup.length;

  return { pValue, discriminationIndex: pTop - pBottom };
}

/**
 * Compute point-biserial correlation between item correctness and total score.
 * r_pb = (M_pass - M_fail) / S_total * sqrt(p * q)
 */
export function computePointBiserial(attempts: AttemptRecord[]): number {
  const n = attempts.length;
  if (n < 3) return 0;

  const correct = attempts.filter((a) => a.wasCorrect);
  const incorrect = attempts.filter((a) => !a.wasCorrect);
  if (correct.length === 0 || incorrect.length === 0) return 0;

  const mPass = correct.reduce((s, a) => s + a.userAccuracy, 0) / correct.length;
  const mFail = incorrect.reduce((s, a) => s + a.userAccuracy, 0) / incorrect.length;

  const allScores = attempts.map((a) => a.userAccuracy);
  const mean = allScores.reduce((s, v) => s + v, 0) / n;
  const variance = allScores.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  if (sd < 0.001) return 0;

  const p = correct.length / n;
  const q = 1 - p;

  return ((mPass - mFail) / sd) * Math.sqrt(p * q);
}

/**
 * Run Elo update loop through attempts chronologically.
 * Returns final difficulty estimate and uncertainty.
 */
export function eloUpdateLoop(
  attempts: AttemptRecord[],
  initialDifficulty: number = 0
): { difficulty: number; uncertainty: number } {
  let difficulty = initialDifficulty;
  let uncertainty = DEFAULT_UNCERTAINTY;
  let count = 0;

  // Sort chronologically
  const sorted = [...attempts].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const attempt of sorted) {
    count++;
    // Adaptive K factor: higher for new items, lower as confidence grows
    const kFactor = Math.max(
      MIN_K_FACTOR,
      BASE_K_FACTOR * (uncertainty / DEFAULT_UNCERTAINTY)
    );

    // Expected probability (Rasch model)
    const expectedP = 1 / (1 + Math.exp(-(attempt.userAccuracy * 4 - 2 - difficulty)));
    const outcome = attempt.wasCorrect ? 1 : 0;
    const surprise = outcome - expectedP;

    // Update difficulty (decrease if student got it right, increase if wrong)
    difficulty -= kFactor * surprise;

    // Clamp to reasonable range
    difficulty = Math.max(-3, Math.min(3, difficulty));

    // Decay uncertainty
    uncertainty = Math.max(MIN_UNCERTAINTY, uncertainty * UNCERTAINTY_DECAY);
  }

  return { difficulty, uncertainty };
}

/**
 * Analyze distractor selection patterns.
 */
export function analyzeDistractors(
  attempts: AttemptRecord[],
  topGroup: AttemptRecord[],
  bottomGroup: AttemptRecord[]
): DistractorStats[] {
  const n = attempts.length;
  if (n === 0) return [];

  // Collect all unique options
  const optionCounts = new Map<string, { total: number; top: number; bottom: number }>();

  for (const a of attempts) {
    const entry = optionCounts.get(a.selectedAnswer) ?? { total: 0, top: 0, bottom: 0 };
    entry.total++;
    optionCounts.set(a.selectedAnswer, entry);
  }
  for (const a of topGroup) {
    const entry = optionCounts.get(a.selectedAnswer);
    if (entry) entry.top++;
  }
  for (const a of bottomGroup) {
    const entry = optionCounts.get(a.selectedAnswer);
    if (entry) entry.bottom++;
  }

  const topN = topGroup.length || 1;
  const bottomN = bottomGroup.length || 1;

  return Array.from(optionCounts.entries()).map(([option, counts]) => {
    const proportion = counts.total / n;
    const topRate = counts.top / topN;
    const bottomRate = counts.bottom / bottomN;
    const disc = topRate - bottomRate;

    let quality: DistractorStats['quality'] = 'functional';
    if (disc < -0.1) quality = 'negative';
    else if (proportion < DISTRACTOR_MIN_SELECTION || disc < 0.05) quality = 'weak';

    return {
      option,
      selectedCount: counts.total,
      selectedByTop: counts.top,
      selectedByBottom: counts.bottom,
      proportion,
      discrimination: disc,
      quality,
    };
  });
}

/**
 * Determine quality flag and issues for a calibrated item.
 */
export function computeQualityFlag(
  pValue: number,
  discriminationIndex: number,
  pointBiserial: number,
  distractorStats: DistractorStats[]
): { flag: QualityFlag; issues: string[] } {
  const issues: string[] = [];

  // Discrimination index checks
  if (discriminationIndex < 0) {
    issues.push(`Negative discrimination index (${discriminationIndex.toFixed(3)}): item may be miskeyed`);
  } else if (discriminationIndex < DI_REVIEW) {
    issues.push(`Very low discrimination (${discriminationIndex.toFixed(3)} < ${DI_REVIEW})`);
  } else if (discriminationIndex < DI_GOOD) {
    issues.push(`Below-target discrimination (${discriminationIndex.toFixed(3)} < ${DI_GOOD})`);
  }

  // Point-biserial checks
  if (pointBiserial < 0) {
    issues.push(`Negative point-biserial (${pointBiserial.toFixed(3)}): likely miskeyed`);
  } else if (pointBiserial < PB_REVIEW) {
    issues.push(`Very low point-biserial (${pointBiserial.toFixed(3)} < ${PB_REVIEW})`);
  } else if (pointBiserial < PB_GOOD) {
    issues.push(`Below-target point-biserial (${pointBiserial.toFixed(3)} < ${PB_GOOD})`);
  }

  // p-value extremes
  if (pValue < 0.10) issues.push(`Very difficult item (p=${pValue.toFixed(2)})`);
  if (pValue > 0.95) issues.push(`Very easy item (p=${pValue.toFixed(2)})`);

  // Distractor checks
  const weakDistractors = distractorStats.filter((d) => d.quality === 'weak');
  const negativeDistractors = distractorStats.filter((d) => d.quality === 'negative');
  if (negativeDistractors.length > 0) {
    issues.push(`${negativeDistractors.length} negative distractor(s): attract high-performers`);
  }
  if (weakDistractors.length > 0) {
    issues.push(`${weakDistractors.length} non-functioning distractor(s) (<5% selection)`);
  }

  // Assign flag
  let flag: QualityFlag = 'good';
  if (discriminationIndex < 0 || pointBiserial < 0 || negativeDistractors.length > 0) {
    flag = 'remove';
  } else if (issues.length >= 2 || discriminationIndex < DI_REVIEW || pointBiserial < PB_REVIEW) {
    flag = 'poor';
  } else if (issues.length >= 1) {
    flag = 'review';
  }

  return { flag, issues };
}

// ─── Orchestration ────────────────────────────────────────────────

/**
 * Calibrate a single question from its attempt history.
 */
export function calibrateItem(
  questionId: string,
  attempts: AttemptRecord[],
  initialDifficulty: number = 0
): ItemCalibration {
  const { pValue, discriminationIndex } = computeDiscriminationMetrics(attempts);
  const pointBiserial = computePointBiserial(attempts);
  const { difficulty, uncertainty } = eloUpdateLoop(attempts, initialDifficulty);

  // Build top/bottom groups for distractor analysis
  const sorted = [...attempts].sort((a, b) => b.userAccuracy - a.userAccuracy);
  const groupSize = Math.max(1, Math.floor(attempts.length * DISCRIMINATION_PERCENTILE));
  const topGroup = sorted.slice(0, groupSize);
  const bottomGroup = sorted.slice(-groupSize);
  const distractorStats = analyzeDistractors(attempts, topGroup, bottomGroup);

  const { flag, issues } = computeQualityFlag(
    pValue,
    discriminationIndex,
    pointBiserial,
    distractorStats
  );

  return {
    questionId,
    eloDifficulty: difficulty,
    uncertainty,
    pValue,
    discriminationIndex,
    pointBiserial,
    distractorStats,
    qualityFlag: flag,
    qualityIssues: issues,
    totalResponses: attempts.length,
    lastCalibratedAt: new Date().toISOString(),
  };
}

/**
 * Batch calibrate multiple items from grouped attempt data.
 * Skips items with fewer than MIN_OBSERVATIONS responses.
 */
export function batchCalibrateItems(
  attemptsByQuestion: Map<string, AttemptRecord[]>,
  initialDifficulties?: Map<string, number>,
  minResponses: number = MIN_OBSERVATIONS
): Map<string, ItemCalibration> {
  const results = new Map<string, ItemCalibration>();

  for (const [questionId, attempts] of attemptsByQuestion) {
    if (attempts.length < minResponses) continue;

    const initialDiff = initialDifficulties?.get(questionId) ?? 0;
    const calibration = calibrateItem(questionId, attempts, initialDiff);
    results.set(questionId, calibration);
  }

  return results;
}

/**
 * Summarize batch calibration results.
 */
export function summarizeCalibration(
  results: Map<string, ItemCalibration>
): {
  total: number;
  good: number;
  review: number;
  poor: number;
  remove: number;
  avgDifficulty: number;
  avgDiscrimination: number;
} {
  const items = Array.from(results.values());
  const total = items.length;
  if (total === 0) {
    return { total: 0, good: 0, review: 0, poor: 0, remove: 0, avgDifficulty: 0, avgDiscrimination: 0 };
  }

  return {
    total,
    good: items.filter((i) => i.qualityFlag === 'good').length,
    review: items.filter((i) => i.qualityFlag === 'review').length,
    poor: items.filter((i) => i.qualityFlag === 'poor').length,
    remove: items.filter((i) => i.qualityFlag === 'remove').length,
    avgDifficulty: items.reduce((s, i) => s + i.eloDifficulty, 0) / total,
    avgDiscrimination: items.reduce((s, i) => s + i.discriminationIndex, 0) / total,
  };
}
