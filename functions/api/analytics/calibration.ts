/**
 * API: GET /api/analytics/calibration
 *
 * Returns metacognition "Calibration" quadrant counts (Illusion of Competence):
 * - Mastered: High confidence + Right
 * - Dangerous Misconception: High confidence + Wrong
 * - Lucky Guess: Low confidence + Right
 * - Unconfident Wrong: Low confidence + Wrong
 *
 * Data from QuestionAttempt.implicitConfidence (and telemetryJson fallback).
 * Used by dashboard Calibration widget and FSRS-aware scheduling.
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';
import { computeQuadrantCounts } from '../../../lib/calibrationQuadrants';

const DEFAULT_DAYS = 90;
const MAX_ATTEMPTS = 2000;

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

export const onRequestGet = authenticatedEndpoint(
  z
    .object({
      days: z.coerce.number().min(1).max(365).optional().default(DEFAULT_DAYS),
    })
    .optional()
    .default({ days: DEFAULT_DAYS }),
  async (context) => {
    if (!context.env.DATABASE_URL) {
      return {
        status: 503,
        data: {
          error: 'Calibration unavailable',
          message: 'Server database is not configured.',
        },
      };
    }
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const days = context.validated?.days ?? DEFAULT_DAYS;

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          status: 404,
          error: 'User not found',
        };
      }

      const since = new Date();
      since.setDate(since.getDate() - days);

      const attempts = await prisma.questionAttempt.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: since },
        },
        select: {
          wasCorrect: true,
          implicitConfidence: true,
          telemetryJson: true,
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ATTEMPTS,
      });

      const items = attempts.map((row) => ({
        confidence: getConfidence(row),
        wasCorrect: row.wasCorrect,
      }));

      const calibration = computeQuadrantCounts(items);

      return {
        status: 200,
        data: {
          calibration: {
            mastered: calibration.mastered,
            dangerousMisconception: calibration.dangerousMisconception,
            luckyGuess: calibration.luckyGuess,
            unconfidentWrong: calibration.unconfidentWrong,
            total: calibration.total,
          },
          days,
        },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isDbUnavailable =
        /connect|ECONNREFUSED|timeout|database.*unavailable|P1001|P1017|accelerate|pool/i.test(errMsg);
      return {
        status: isDbUnavailable ? 503 : 500,
        data: {
          error: isDbUnavailable ? 'Calibration unavailable' : 'Failed to load calibration',
          message: isDbUnavailable
            ? 'Database is temporarily unavailable. Please try again.'
            : errMsg || 'Please try again later.',
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
