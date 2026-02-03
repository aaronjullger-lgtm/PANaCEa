/**
 * Calibration Quadrants (Metacognition / Illusion of Competence)
 *
 * Buckets each (confidence, wasCorrect) into:
 * - Mastered: High confidence + Right
 * - Dangerous Misconception: High confidence + Wrong (critical for PA students)
 * - Lucky Guess: Low confidence + Right (needs review)
 * - Unconfident Wrong: Low confidence + Wrong
 *
 * Used by dashboard Calibration widget and FSRS-aware scheduling.
 */

export const CONFIDENCE_THRESHOLD = 0.6; // 0-1; >= this = "high confidence"

export type CalibrationQuadrant =
  | 'mastered'
  | 'dangerous_misconception'
  | 'lucky_guess'
  | 'unconfident_wrong';

export interface CalibrationQuadrantCounts {
  mastered: number;
  dangerousMisconception: number;
  luckyGuess: number;
  unconfidentWrong: number;
  total: number;
}

export interface CalibrationQuadrantRow {
  confidence: number;
  wasCorrect: boolean;
  quadrant: CalibrationQuadrant;
}

/**
 * Classify a single (confidence, wasCorrect) into a quadrant.
 * confidence is 0-1 (implicit from behavior).
 */
export function classifyQuadrant(
  confidence: number,
  wasCorrect: boolean,
  threshold: number = CONFIDENCE_THRESHOLD
): CalibrationQuadrant {
  const high = confidence >= threshold;
  if (high && wasCorrect) return 'mastered';
  if (high && !wasCorrect) return 'dangerous_misconception';
  if (!high && wasCorrect) return 'lucky_guess';
  return 'unconfident_wrong';
}

/**
 * Aggregate an array of (confidence, wasCorrect) into quadrant counts.
 * Skips entries where confidence is null/undefined.
 */
export function computeQuadrantCounts(
  items: Array<{ confidence: number | null | undefined; wasCorrect: boolean }>,
  threshold: number = CONFIDENCE_THRESHOLD
): CalibrationQuadrantCounts {
  const counts: CalibrationQuadrantCounts = {
    mastered: 0,
    dangerousMisconception: 0,
    luckyGuess: 0,
    unconfidentWrong: 0,
    total: 0,
  };

  for (const { confidence, wasCorrect } of items) {
    if (confidence == null || Number.isNaN(confidence)) continue;
    const c = Math.max(0, Math.min(1, confidence));
    counts.total++;
    const q = classifyQuadrant(c, wasCorrect, threshold);
    if (q === 'mastered') counts.mastered++;
    else if (q === 'dangerous_misconception') counts.dangerousMisconception++;
    else if (q === 'lucky_guess') counts.luckyGuess++;
    else counts.unconfidentWrong++;
  }

  return counts;
}

/**
 * Labels for UI (distinct from AI calibration).
 */
export function getQuadrantLabel(quadrant: CalibrationQuadrant): {
  short: string;
  long: string;
  description: string;
} {
  switch (quadrant) {
    case 'mastered':
      return {
        short: 'Mastered',
        long: 'Mastered',
        description: 'High confidence, correct — solid retrieval.',
      };
    case 'dangerous_misconception':
      return {
        short: 'Dangerous',
        long: 'Dangerous Misconception',
        description: 'High confidence, wrong — critical to review.',
      };
    case 'lucky_guess':
      return {
        short: 'Lucky Guess',
        long: 'Lucky Guess',
        description: 'Low confidence, correct — needs review.',
      };
    case 'unconfident_wrong':
      return {
        short: 'Unconfident',
        long: 'Unconfident Wrong',
        description: 'Low confidence, wrong — study and retest.',
      };
  }
}
