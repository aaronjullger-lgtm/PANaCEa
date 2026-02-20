/**
 * Calibration Integration for FSRS Optimization
 * 
 * Fetches user calibration quadrants (metacognitive accuracy) and adjusts
 * FSRS scheduling parameters accordingly.
 */

import { computeQuadrantCounts } from '@/lib/calibrationQuadrants';
import type { CalibrationQuadrantCounts } from '@/lib/calibrationQuadrants';

/**
 * Fetch calibration quadrant counts for a user from QuestionAttempt data.
 * Uses implicitConfidence and wasCorrect fields.
 */
export async function fetchCalibrationQuadrantsForUser(
  userId: string,
  prisma: any, // Prisma client (Edge or Node)
  days: number = 90
): Promise<CalibrationQuadrantCounts> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const attempts = await prisma.questionAttempt.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    select: {
      wasCorrect: true,
      implicitConfidence: true,
      telemetryJson: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000, // Limit to avoid performance issues
  });

  const items = attempts.map((row: any) => ({
    confidence: getConfidence(row),
    wasCorrect: row.wasCorrect,
  }));

  return computeQuadrantCounts(items);
}

/**
 * Extract confidence from QuestionAttempt row.
 * Follows the same logic as the calibration endpoint.
 */
function getConfidence(row: {
  implicitConfidence: number | null;
  telemetryJson: unknown;
}): number | null {
  if (row.implicitConfidence != null && !Number.isNaN(row.implicitConfidence)) {
    return row.implicitConfidence;
  }
  const json = row.telemetryJson as { server_computed?: { implicit_confidence?: number } } | null;
  const fromJson = json?.server_computed?.implicit_confidence;
  if (typeof fromJson === 'number' && !Number.isNaN(fromJson)) return fromJson;
  return null;
}

/**
 * Compute a calibration‑based adjustment factor for FSRS retention target.
 * 
 * Heuristic:
 * - High proportion of Dangerous Misconceptions → lower retention (more reviews)
 * - High proportion of Mastered items → can increase retention (fewer reviews)
 * - Balanced quadrants → no change
 * 
 * Returns a multiplier between 0.85 and 1.15 to apply to the baseline retention.
 */
export function computeRetentionAdjustment(
  quadrants: CalibrationQuadrantCounts
): number {
  const { mastered, dangerousMisconception, luckyGuess, unconfidentWrong, total } = quadrants;
  if (total === 0) return 1.0;

  const dangerousRatio = dangerousMisconception / total;
  const masteredRatio = mastered / total;
  const luckyRatio = luckyGuess / total;
  const unconfidentRatio = unconfidentWrong / total;

  // Base adjustment: reduce retention when dangerous misconceptions are high
  let adjustment = 1.0 - (dangerousRatio * 0.3); // up to 30% reduction
  // Slightly increase retention when mastery is high
  adjustment += masteredRatio * 0.1; // up to 10% increase
  // Slightly reduce retention when lucky guesses are high (underconfidence)
  adjustment -= luckyRatio * 0.05;
  // Slightly increase retention when unconfident wrong (aware of weakness)
  adjustment += unconfidentRatio * 0.05;

  // Clamp to reasonable bounds
  return Math.max(0.85, Math.min(1.15, adjustment));
}

/**
 * Apply calibration adjustment to an optimal retention value.
 */
export function adjustRetentionWithCalibration(
  baselineRetention: number,
  quadrants: CalibrationQuadrantCounts
): number {
  const multiplier = computeRetentionAdjustment(quadrants);
  const adjusted = baselineRetention * multiplier;
  // Keep retention within FSRS sensible bounds (0.75–0.97)
  return Math.max(0.75, Math.min(0.97, adjusted));
}