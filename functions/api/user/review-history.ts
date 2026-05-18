/**
 * API Endpoint: GET /api/user/review-history
 *
 * Fetches complete review history for export / optimizer tooling.
 * Returns canonical ReviewLog events with legacy QuestionAttempt-compatible
 * fields so older clients can keep reading createdAt/durationMs/telemetryJson.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (300/min), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserId } from '../_shared/user-resolver';

const ReviewHistorySchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
      mainOnly: z.enum(['true', 'false']).optional().default('false'),
      includeRapidGuesses: z.enum(['true', 'false']).optional().default('false'),
    })
    .optional()
    .default({}),
});

function telemetryQualityFrom(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const serverComputed = (raw as Record<string, unknown>).server_computed;
  if (!serverComputed || typeof serverComputed !== 'object' || Array.isArray(serverComputed)) {
    return null;
  }
  const quality = (serverComputed as Record<string, unknown>).telemetry_quality;
  return typeof quality === 'string' ? quality : null;
}

function numberFromTelemetry(raw: unknown, key: string): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const onRequestGet = authenticatedEndpoint(
  ReviewHistorySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const query = validated.query ?? {};
      const limit = query.limit ?? 1000;
      const mainOnly = query.mainOnly === 'true';
      const includeRapidGuesses = query.includeRapidGuesses === 'true';
      const userId = await resolveOrCreateUserId(prisma, auth.userId);
      const reviewTypes = includeRapidGuesses ? ['real', 'rapid_guess'] : ['real'];

      const rows = await prisma.reviewLog.findMany({
        where: {
          userId,
          review_type: { in: reviewTypes },
          ...(mainOnly ? { sessionType: { in: ['MAIN', 'DRILL'] } } : {}),
        },
        select: {
          id: true,
          userId: true,
          questionId: true,
          conditionId: true,
          medicalContentId: true,
          grade: true,
          grade_continuous: true,
          wasCorrect: true,
          reviewedAt: true,
          scheduledAt: true,
          elapsedDays: true,
          responseTimeMs: true,
          state: true,
          stability: true,
          difficulty: true,
          retrievability: true,
          sessionId: true,
          attemptId: true,
          sessionType: true,
          review_type: true,
          system: true,
          telemetry: true,
          QuestionAttempt: {
            select: {
              selectedAnswer: true,
              durationMs: true,
              telemetryJson: true,
              answerChangedCount: true,
              timeSpentMs: true,
              createdAt: true,
            },
          },
        },
        orderBy: { reviewedAt: 'asc' },
        take: limit,
      });

      const reviews = rows.map((row) => {
        const attempt = row.QuestionAttempt;
        const telemetry = attempt?.telemetryJson ?? row.telemetry ?? null;
        const answerChanges =
          attempt?.answerChangedCount ??
          numberFromTelemetry(row.telemetry, 'answer_changes') ??
          numberFromTelemetry(row.telemetry, 'answerChangedCount') ??
          null;
        const durationMs = attempt?.durationMs ?? row.responseTimeMs ?? null;

        return {
          id: row.attemptId ?? row.id,
          reviewLogId: row.id,
          attemptId: row.attemptId ?? null,
          userId: auth.userId,
          questionId: row.questionId,
          conditionId: row.conditionId,
          medicalContentId: row.medicalContentId,
          wasCorrect: Boolean(row.wasCorrect),
          createdAt: new Date(row.reviewedAt).toISOString(),
          reviewedAt: new Date(row.reviewedAt).toISOString(),
          scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
          durationMs,
          responseTimeMs: row.responseTimeMs ?? durationMs,
          answerChangedCount: answerChanges,
          timeSpentMs: attempt?.timeSpentMs ?? row.responseTimeMs ?? durationMs,
          telemetryJson: telemetry,
          system: row.system ?? null,
          selectedAnswer: attempt?.selectedAnswer ?? null,
          rating: Number(row.grade),
          gradeContinuous: row.grade_continuous ?? null,
          state: row.state,
          stability: row.stability,
          difficulty: row.difficulty,
          retrievability: row.retrievability ?? null,
          elapsedDays: row.elapsedDays ?? null,
          sessionId: row.sessionId ?? null,
          sessionType: String(row.sessionType ?? 'MAIN'),
          reviewType: String(row.review_type ?? 'real'),
          telemetryQuality: telemetryQualityFrom(row.telemetry),
        };
      });

      return {
        data: {
          reviews,
          events: reviews,
          count: reviews.length,
          userId: auth.userId,
        },
      };
    } catch (error) {
      console.error('Failed to fetch review history:', error);
      return { status: 500, error: 'Failed to fetch review history' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
