/**
 * Psychometric Item Analysis Service
 *
 * Computes per-question quality metrics used in classical test theory:
 *   - Discrimination Index (D): top 27% accuracy - bottom 27% accuracy
 *   - Point-Biserial Correlation (rpb): correlation between item score and total score
 *   - Distractor Analysis: selection rates per option, non-functioning distractor flagging
 *
 * These metrics feed a content quality feedback loop:
 *   - Flag poor items (D < 0.10, negative rpb, non-functioning distractors)
 *   - Surface in admin panel for human review
 *   - Inform AI self-refine loop (Sprint 22) about common item deficiencies
 *
 * Research basis:
 *   - Ebel & Frisbie (1991): Classical Test Theory item statistics
 *   - Haladyna & Rodriguez (2013): Item writing guidelines
 *   - NBME item analysis standards: D ≥ 0.20 acceptable, rpb ≥ 0.15 acceptable
 *
 * Architecture:
 *   Pure computation — operates on arrays of attempt records.
 *   Minimum 30 attempts per item required for reliable statistics.
 *
 * Sprint 21 — Content quality feedback loop
 * @module lib/services/itemAnalysisService
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** A single student's attempt on a question */
export interface ItemAttemptRecord {
  /** Student identifier */
  studentId: string;
  /** Whether the student got this item correct */
  isCorrect: boolean;
  /** Which option the student selected (e.g., 'A', 'B', 'C', 'D') */
  selectedOption: string;
  /** Student's total score across all items (for rpb computation) */
  totalScore: number;
  /** Student's total items attempted */
  totalItems: number;
  /** Time spent on this item in ms */
  timeSpentMs: number;
}

/** Distractor-level analysis */
export interface DistractorAnalysis {
  /** The option label */
  option: string;
  /** Whether this is the correct answer */
  isCorrect: boolean;
  /** Number of students who selected this option */
  selectionCount: number;
  /** Fraction of students who selected this option */
  selectionRate: number;
  /** Whether this distractor is non-functioning (< 5% selection rate for wrong answers) */
  isNonFunctioning: boolean;
  /** Average total score of students who selected this option */
  avgTotalScore: number;
}

/** Complete item analysis for a single question */
export interface ItemAnalysis {
  /** Question identifier */
  questionId: string;
  /** Number of attempts analyzed */
  attemptCount: number;
  /** Overall difficulty (p-value: fraction correct) */
  difficulty: number;
  /** Discrimination index (D): top 27% - bottom 27% */
  discriminationIndex: number;
  /** Point-biserial correlation */
  pointBiserial: number;
  /** Per-option distractor analysis */
  distractors: DistractorAnalysis[];
  /** Average time spent in ms */
  avgTimeMs: number;
  /** Median time spent in ms */
  medianTimeMs: number;
  /** Quality flags */
  flags: ItemFlag[];
  /** Overall quality grade */
  grade: 'excellent' | 'good' | 'acceptable' | 'review' | 'revise';
}

/** Quality flags for items needing attention */
export interface ItemFlag {
  type: ItemFlagType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export type ItemFlagType =
  | 'NON_DISCRIMINATING'      // D < 0.10
  | 'NEGATIVE_DISCRIMINATION' // D < 0 (penalizes knowledgeable students)
  | 'NEGATIVE_RPB'            // rpb < 0
  | 'TOO_EASY'                // p > 0.95
  | 'TOO_HARD'                // p < 0.20
  | 'NON_FUNCTIONING_DISTRACTOR' // option selected < 5%
  | 'INSUFFICIENT_DATA'       // < 30 attempts
  | 'SLOW_ITEM';              // avg time > 3× median across all items

// ─── Constants ──────────────────────────────────────────────────────────

export const ITEM_ANALYSIS_THRESHOLDS = {
  MIN_ATTEMPTS: 30,
  DISCRIMINATION_EXCELLENT: 0.40,
  DISCRIMINATION_GOOD: 0.30,
  DISCRIMINATION_ACCEPTABLE: 0.20,
  DISCRIMINATION_POOR: 0.10,
  RPB_ACCEPTABLE: 0.15,
  DIFFICULTY_TOO_EASY: 0.95,
  DIFFICULTY_TOO_HARD: 0.20,
  DISTRACTOR_MIN_RATE: 0.05,
  /** Fraction of top/bottom students for D computation */
  EXTREME_GROUP_FRACTION: 0.27,
} as const;

// ─── Core Computation ───────────────────────────────────────────────────

/**
 * Compute full item analysis for a question given its attempt records.
 */
export function analyzeItem(
  questionId: string,
  attempts: ItemAttemptRecord[]
): ItemAnalysis {
  const flags: ItemFlag[] = [];
  const n = attempts.length;

  // Insufficient data guard
  if (n < ITEM_ANALYSIS_THRESHOLDS.MIN_ATTEMPTS) {
    flags.push({
      type: 'INSUFFICIENT_DATA',
      severity: 'info',
      message: `Only ${n} attempts (need ${ITEM_ANALYSIS_THRESHOLDS.MIN_ATTEMPTS} for reliable statistics)`,
    });
  }

  // 1. Difficulty (p-value)
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const difficulty = n > 0 ? correctCount / n : 0;

  // 2. Discrimination Index (D)
  const discriminationIndex = computeDiscriminationIndex(attempts);

  // 3. Point-Biserial Correlation
  const pointBiserial = computePointBiserial(attempts);

  // 4. Distractor Analysis
  const distractors = computeDistractorAnalysis(attempts);

  // 5. Time statistics
  const times = attempts.map((a) => a.timeSpentMs).sort((a, b) => a - b);
  const avgTimeMs = n > 0 ? times.reduce((s, t) => s + t, 0) / n : 0;
  const medianTimeMs = n > 0
    ? n % 2 === 1
      ? times[Math.floor(n / 2)] ?? 0
      : ((times[n / 2 - 1] ?? 0) + (times[n / 2] ?? 0)) / 2
    : 0;

  // ─── Flag Generation ──────────────────────────────────────────────

  if (difficulty > ITEM_ANALYSIS_THRESHOLDS.DIFFICULTY_TOO_EASY) {
    flags.push({
      type: 'TOO_EASY',
      severity: 'warning',
      message: `Item is too easy (p = ${difficulty.toFixed(2)}). ${Math.round(difficulty * 100)}% of students answer correctly.`,
    });
  }

  if (difficulty < ITEM_ANALYSIS_THRESHOLDS.DIFFICULTY_TOO_HARD) {
    flags.push({
      type: 'TOO_HARD',
      severity: 'warning',
      message: `Item is too hard (p = ${difficulty.toFixed(2)}). Only ${Math.round(difficulty * 100)}% answer correctly.`,
    });
  }

  if (discriminationIndex < 0) {
    flags.push({
      type: 'NEGATIVE_DISCRIMINATION',
      severity: 'critical',
      message: `Negative discrimination (D = ${discriminationIndex.toFixed(2)}). Low-performers outperform high-performers — item may be misleading.`,
    });
  } else if (discriminationIndex < ITEM_ANALYSIS_THRESHOLDS.DISCRIMINATION_POOR) {
    flags.push({
      type: 'NON_DISCRIMINATING',
      severity: 'warning',
      message: `Non-discriminating item (D = ${discriminationIndex.toFixed(2)}). Does not differentiate between strong and weak students.`,
    });
  }

  if (pointBiserial < 0) {
    flags.push({
      type: 'NEGATIVE_RPB',
      severity: 'critical',
      message: `Negative point-biserial (rpb = ${pointBiserial.toFixed(2)}). Correct answer negatively correlated with overall performance.`,
    });
  }

  for (const d of distractors) {
    if (d.isNonFunctioning) {
      flags.push({
        type: 'NON_FUNCTIONING_DISTRACTOR',
        severity: 'info',
        message: `Option ${d.option} is non-functioning (selected by ${Math.round(d.selectionRate * 100)}% of students). Consider replacing.`,
      });
    }
  }

  // Grade assignment
  const grade = assignGrade(discriminationIndex, pointBiserial, difficulty, flags);

  return {
    questionId,
    attemptCount: n,
    difficulty,
    discriminationIndex,
    pointBiserial,
    distractors,
    avgTimeMs,
    medianTimeMs,
    flags,
    grade,
  };
}

// ─── Statistical Functions ──────────────────────────────────────────────

/**
 * Discrimination Index (D):
 * Sort students by total score, compare top 27% vs bottom 27% on this item.
 */
export function computeDiscriminationIndex(attempts: ItemAttemptRecord[]): number {
  const n = attempts.length;
  if (n < 2) return 0;

  // Sort by total score descending
  const sorted = [...attempts].sort((a, b) => {
    const scoreA = a.totalItems > 0 ? a.totalScore / a.totalItems : 0;
    const scoreB = b.totalItems > 0 ? b.totalScore / b.totalItems : 0;
    return scoreB - scoreA;
  });

  const groupSize = Math.max(1, Math.round(n * ITEM_ANALYSIS_THRESHOLDS.EXTREME_GROUP_FRACTION));
  const topGroup = sorted.slice(0, groupSize);
  const bottomGroup = sorted.slice(n - groupSize);

  const topCorrectRate = topGroup.filter((a) => a.isCorrect).length / topGroup.length;
  const bottomCorrectRate = bottomGroup.filter((a) => a.isCorrect).length / bottomGroup.length;

  return topCorrectRate - bottomCorrectRate;
}

/**
 * Point-Biserial Correlation:
 * Correlation between dichotomous item score (0/1) and continuous total score.
 *
 * rpb = (M1 - M0) / Sx × √(p × q)
 *   where M1 = mean total score of correct group
 *         M0 = mean total score of incorrect group
 *         Sx = SD of all total scores
 *         p = proportion correct, q = 1 - p
 */
export function computePointBiserial(attempts: ItemAttemptRecord[]): number {
  const n = attempts.length;
  if (n < 2) return 0;

  const correctGroup = attempts.filter((a) => a.isCorrect);
  const incorrectGroup = attempts.filter((a) => !a.isCorrect);

  if (correctGroup.length === 0 || incorrectGroup.length === 0) return 0;

  const totalScoreRate = (a: ItemAttemptRecord) =>
    a.totalItems > 0 ? a.totalScore / a.totalItems : 0;

  const m1 = mean(correctGroup.map(totalScoreRate));
  const m0 = mean(incorrectGroup.map(totalScoreRate));
  const allScores = attempts.map(totalScoreRate);
  const sx = stdDev(allScores);

  if (sx === 0) return 0;

  const p = correctGroup.length / n;
  const q = 1 - p;

  return ((m1 - m0) / sx) * Math.sqrt(p * q);
}

/**
 * Distractor analysis: selection rates and avg performance per option.
 */
export function computeDistractorAnalysis(
  attempts: ItemAttemptRecord[]
): DistractorAnalysis[] {
  const n = attempts.length;
  if (n === 0) return [];

  // Group by selected option
  const optionGroups: Record<string, ItemAttemptRecord[]> = {};
  for (const a of attempts) {
    if (!optionGroups[a.selectedOption]) optionGroups[a.selectedOption] = [];
    optionGroups[a.selectedOption]!.push(a);
  }

  // Determine which option is correct (most common correct selection)
  const correctOption = findCorrectOption(attempts);

  return Object.entries(optionGroups)
    .map(([option, group]) => {
      const selectionCount = group.length;
      const selectionRate = selectionCount / n;
      const isCorrect = option === correctOption;
      const avgTotalScore =
        group.length > 0
          ? group.reduce(
              (s, a) => s + (a.totalItems > 0 ? a.totalScore / a.totalItems : 0),
              0
            ) / group.length
          : 0;

      return {
        option,
        isCorrect,
        selectionCount,
        selectionRate,
        isNonFunctioning:
          !isCorrect && selectionRate < ITEM_ANALYSIS_THRESHOLDS.DISTRACTOR_MIN_RATE,
        avgTotalScore,
      };
    })
    .sort((a, b) => {
      // Correct answer first, then by option label
      if (a.isCorrect !== b.isCorrect) return a.isCorrect ? -1 : 1;
      return a.option.localeCompare(b.option);
    });
}

/**
 * Batch analyze multiple questions.
 */
export function batchAnalyzeItems(
  itemAttempts: Map<string, ItemAttemptRecord[]>
): ItemAnalysis[] {
  const results: ItemAnalysis[] = [];
  for (const [questionId, attempts] of itemAttempts) {
    results.push(analyzeItem(questionId, attempts));
  }
  // Sort by grade severity (worst first for review queue)
  const gradeOrder = { revise: 0, review: 1, acceptable: 2, good: 3, excellent: 4 };
  results.sort(
    (a, b) => (gradeOrder[a.grade] ?? 4) - (gradeOrder[b.grade] ?? 4)
  );
  return results;
}

/**
 * Filter items that need human review.
 */
export function flaggedItemsForReview(analyses: ItemAnalysis[]): ItemAnalysis[] {
  return analyses.filter(
    (a) => a.grade === 'revise' || a.grade === 'review'
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function findCorrectOption(attempts: ItemAttemptRecord[]): string {
  const correctAttempts = attempts.filter((a) => a.isCorrect);
  if (correctAttempts.length === 0) return '';
  // Most common selected option among correct attempts
  const counts: Record<string, number> = {};
  for (const a of correctAttempts) {
    counts[a.selectedOption] = (counts[a.selectedOption] ?? 0) + 1;
  }
  let best = '';
  let bestCount = 0;
  for (const [opt, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = opt;
      bestCount = count;
    }
  }
  return best;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function assignGrade(
  D: number,
  rpb: number,
  p: number,
  flags: ItemFlag[]
): ItemAnalysis['grade'] {
  const hasCritical = flags.some((f) => f.severity === 'critical');
  if (hasCritical) return 'revise';

  const warningCount = flags.filter((f) => f.severity === 'warning').length;
  if (warningCount >= 2) return 'review';

  if (D >= ITEM_ANALYSIS_THRESHOLDS.DISCRIMINATION_EXCELLENT && rpb >= 0.30 && p >= 0.30 && p <= 0.80) {
    return 'excellent';
  }
  if (D >= ITEM_ANALYSIS_THRESHOLDS.DISCRIMINATION_GOOD && rpb >= ITEM_ANALYSIS_THRESHOLDS.RPB_ACCEPTABLE) {
    return 'good';
  }
  if (D >= ITEM_ANALYSIS_THRESHOLDS.DISCRIMINATION_ACCEPTABLE) {
    return 'acceptable';
  }

  return 'review';
}
