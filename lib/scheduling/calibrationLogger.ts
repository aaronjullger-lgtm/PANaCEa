/**
 * CalibrationLog Writer (Edge-safe, fire-and-forget)
 *
 * Emits one CalibrationLog row per real FSRS-eligible review so that
 * predicted retrievability can be scored against realized outcomes offline.
 *
 * Rules:
 *  - NEVER throws. Log-and-swallow on every failure path.
 *  - NEVER part of the scheduler's hot path for correctness — it is pure telemetry.
 *  - Typed against Prisma's generated CalibrationLog model. If the Prisma client
 *    has not been regenerated yet (e.g. before `npm run db:push`), delegateAny
 *    falls back to `(prisma as any).calibrationLog` so TypeScript build does not
 *    block schema migration.
 *
 * Related: prisma/schema.prisma → model CalibrationLog
 * Consumer: lib/scheduling/shadowValidator.ts (Sprint 3.2) joins prediction
 *   rows to the next review's actualOutcome to compute Brier / log-loss / ECE.
 */

import type { SessionType } from '@prisma/client';

// Structural shape (matches Prisma.CalibrationLogCreateInput shape).
// Keeping this as a local interface prevents a tight import on a model that
// does not exist until `prisma generate` is re-run post-schema-change.
export interface CalibrationLogInput {
  userId: string;
  questionId?: string | null;
  conditionId?: string | null;
  reviewLogId?: string | null;
  outcomeReviewLogId?: string | null;
  /** FSRS retrievability at the moment of this review, BEFORE the new grade is applied */
  predictedRetrievability: number;
  stabilityAtPrediction: number;
  difficultyAtPrediction: number;
  intervalDaysAtPrediction: number;
  /** Rating fed to FSRS (binary: 1=Again, 3=Good) */
  ratingFed: number;
  elapsedDaysAtOutcome: number;
  actualOutcome: boolean;
  implicitConfidence?: number | null;
  rapidGuess?: boolean;
  /** Ghost Grader rule that fired, or 'none' */
  ghostGraderRule?: string | null;
  /** 'full' | 'partial' | 'minimal' */
  telemetryQuality?: string | null;
  /** Wilson score lower bound (90% CI) at time of review — populated in Sprint 3.4 */
  wilsonLower?: number | null;
  isMastered?: boolean | null;
  /** True if prior review was high-confidence error AND this review is correct — Sprint 3.5 */
  hypercorrectionEligible?: boolean;
  sessionType?: SessionType;
  fsrsVersion?: string;
}

/** Minimal Prisma client surface we need — avoids importing the full PrismaClient type here. */
interface PrismaWithCalibrationLog {
  calibrationLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

/** Bound [0, 1] with NaN guard. */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Write a single CalibrationLog row.
 *
 * Fire-and-forget — callers do NOT need to await. But awaiting is cheap and
 * lets the caller know if the emission was attempted. Either way, this
 * function never throws; failures are logged to console.warn and swallowed.
 *
 * The returned promise always resolves with a boolean indicating whether
 * the write succeeded (useful for tests; callers may discard).
 */
export async function writeCalibrationLog(
  prisma: unknown,
  input: CalibrationLogInput,
  logger?: { warn?: (msg: string, meta?: Record<string, unknown>) => void }
): Promise<boolean> {
  try {
    const client = prisma as PrismaWithCalibrationLog;
    // Delegate may not exist in generated client yet (pre-migration).
    const delegate = client.calibrationLog ?? (prisma as { calibrationLog?: typeof client.calibrationLog }).calibrationLog;
    if (!delegate || typeof delegate.create !== 'function') {
      logger?.warn?.('[CalibrationLog] delegate missing — did `prisma generate` run after schema change?');
      return false;
    }

    await delegate.create({
      data: {
        userId: input.userId,
        questionId: input.questionId ?? null,
        conditionId: input.conditionId ?? null,
        reviewLogId: input.reviewLogId ?? null,
        outcomeReviewLogId: input.outcomeReviewLogId ?? null,
        predictedRetrievability: clamp01(input.predictedRetrievability),
        stabilityAtPrediction: Math.max(0, input.stabilityAtPrediction),
        difficultyAtPrediction: Math.max(0, input.difficultyAtPrediction),
        intervalDaysAtPrediction: Math.max(0, input.intervalDaysAtPrediction),
        ratingFed: input.ratingFed,
        elapsedDaysAtOutcome: Math.max(0, input.elapsedDaysAtOutcome),
        actualOutcome: input.actualOutcome,
        implicitConfidence: input.implicitConfidence ?? null,
        rapidGuess: input.rapidGuess ?? false,
        ghostGraderRule: input.ghostGraderRule ?? null,
        telemetryQuality: input.telemetryQuality ?? null,
        wilsonLower: input.wilsonLower ?? null,
        isMastered: input.isMastered ?? null,
        hypercorrectionEligible: input.hypercorrectionEligible ?? false,
        sessionType: input.sessionType ?? 'MAIN',
        fsrsVersion: input.fsrsVersion ?? '6.0',
      },
    });

    return true;
  } catch (err) {
    // NEVER throw — this is pure telemetry.
    const msg = err instanceof Error ? err.message : String(err);
    logger?.warn?.('[CalibrationLog] write failed (non-fatal)', { error: msg });
    return false;
  }
}
