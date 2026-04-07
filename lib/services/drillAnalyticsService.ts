/**
 * Drill Analytics Service
 *
 * Provides relative performance feedback for drill sessions, comparing a
 * user's accuracy on a specific condition against their system-level baseline.
 *
 * This is READ-ONLY analytics — it never writes FSRS state or ReviewLog records.
 *
 * Usage: called after a QuestionAttempt is saved (read-after-write) so the
 * new attempt is included in the accuracy counts.
 *
 * @module lib/services/drillAnalyticsService
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelativeDrillPerformance {
  /** Accuracy for this specific condition (null if < 5 attempts) */
  conditionAccuracy: number | null;
  /** Accuracy for the same system, excluding this condition (null if < 5 attempts) */
  systemAccuracy: number | null;
  /**
   * conditionAccuracy / systemAccuracy ratio.
   * > 1.0 = performing better on this condition than system average.
   * < 1.0 = under-performing relative to system average.
   * Null if either accuracy is null.
   */
  relativePerformance: number | null;
  conditionAttemptCount: number;
  systemAttemptCount: number;
  /**
   * True when relativePerformance is non-null and < 0.80.
   * Indicates this condition is a high-priority remediation target.
   */
  isRemediationTarget: boolean;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compute relative drill performance for a user on a specific condition
 * compared to their system-level accuracy baseline.
 *
 * @param userId          Internal user UUID
 * @param conditionFamily Clinical condition family (e.g. 'SVT'). Null = condition metrics skipped.
 * @param systemCategory  DB system abbreviation (e.g. 'CV'). Used for system-level baseline.
 * @param lookbackCount   Number of recent drill attempts to evaluate per group (default 20).
 */
export async function getRelativeDrillPerformance(
  prisma: PrismaClient,
  userId: string,
  conditionFamily: string | null | undefined,
  systemCategory: string | null | undefined,
  lookbackCount = 20
): Promise<RelativeDrillPerformance> {
  // Guard: need at least a system to produce meaningful feedback
  if (!systemCategory) {
    return {
      conditionAccuracy: null,
      systemAccuracy: null,
      relativePerformance: null,
      conditionAttemptCount: 0,
      systemAttemptCount: 0,
      isRemediationTarget: false,
    };
  }

  // ── Condition-level accuracy ──────────────────────────────────────────────
  // Fetch last {lookbackCount} drill attempts for this user + conditionFamily
  // by joining QuestionAttempt to Question via questionId.
  let conditionAccuracy: number | null = null;
  let conditionAttemptCount = 0;

  if (conditionFamily) {
    try {
      const conditionRows = await prisma.$queryRaw<Array<{ cnt: bigint; correct: bigint }>>`
        SELECT
          COUNT(qa.id)::bigint   AS cnt,
          SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::bigint AS correct
        FROM (
          SELECT qa.id, qa."wasCorrect"
          FROM "QuestionAttempt" qa
          INNER JOIN "Question" q ON q.id = qa."questionId"
          WHERE qa."userId"       = ${userId}
            AND qa."isMainSession" = false
            AND q."conditionFamily" = ${conditionFamily}
          ORDER BY qa."createdAt" DESC
          LIMIT ${lookbackCount}
        ) AS qa
      `;

      conditionAttemptCount = Number(conditionRows[0]?.cnt ?? 0);
      if (conditionAttemptCount >= 5) {
        conditionAccuracy =
          conditionAttemptCount > 0 ? Number(conditionRows[0].correct) / conditionAttemptCount : 0;
      }
    } catch {
      // Non-fatal — condition metrics unavailable
    }
  }

  // ── System-level accuracy (excluding this conditionFamily) ────────────────
  // Fetch last {lookbackCount} drill attempts for this user + system,
  // excluding questions that belong to the specific conditionFamily.
  let systemAccuracy: number | null = null;
  let systemAttemptCount = 0;

  try {
    // Two variants: with and without conditionFamily exclusion join.
    const systemRows = conditionFamily
      ? await prisma.$queryRaw<Array<{ cnt: bigint; correct: bigint }>>`
          SELECT
            COUNT(qa.id)::bigint   AS cnt,
            SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::bigint AS correct
          FROM (
            SELECT qa.id, qa."wasCorrect"
            FROM "QuestionAttempt" qa
            INNER JOIN "Question" q ON q.id = qa."questionId"
            WHERE qa."userId"        = ${userId}
              AND qa."isMainSession"  = false
              AND qa."system"         = ${systemCategory}
              AND (q."conditionFamily" IS NULL OR q."conditionFamily" != ${conditionFamily})
            ORDER BY qa."createdAt" DESC
            LIMIT ${lookbackCount}
          ) AS qa
        `
      : await prisma.$queryRaw<Array<{ cnt: bigint; correct: bigint }>>`
          SELECT
            COUNT(id)::bigint AS cnt,
            SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END)::bigint AS correct
          FROM (
            SELECT id, "wasCorrect"
            FROM "QuestionAttempt"
            WHERE "userId"       = ${userId}
              AND "isMainSession" = false
              AND "system"        = ${systemCategory}
            ORDER BY "createdAt" DESC
            LIMIT ${lookbackCount}
          ) AS qa
        `;

    systemAttemptCount = Number(systemRows[0]?.cnt ?? 0);
    if (systemAttemptCount >= 5) {
      systemAccuracy =
        systemAttemptCount > 0 ? Number(systemRows[0].correct) / systemAttemptCount : 0;
    }
  } catch {
    // Non-fatal
  }

  // ── Relative performance ──────────────────────────────────────────────────
  const relativePerformance =
    conditionAccuracy !== null && systemAccuracy !== null && systemAccuracy > 0
      ? conditionAccuracy / systemAccuracy
      : null;

  const isRemediationTarget = relativePerformance !== null && relativePerformance < 0.8;

  return {
    conditionAccuracy:
      conditionAccuracy !== null ? Math.round(conditionAccuracy * 1000) / 1000 : null,
    systemAccuracy:
      systemAccuracy !== null ? Math.round(systemAccuracy * 1000) / 1000 : null,
    relativePerformance:
      relativePerformance !== null ? Math.round(relativePerformance * 1000) / 1000 : null,
    conditionAttemptCount,
    systemAttemptCount,
    isRemediationTarget,
  };
}
