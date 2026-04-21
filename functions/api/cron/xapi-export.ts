/**
 * Cron: xAPI Export
 *
 * Exports recent learning activity as xAPI 1.0.3 statements.
 * Converts QuestionAttempts and ReviewLogs from the last 24 hours.
 *
 * GET /api/cron/xapi-export?hours=24&format=json
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { z } from 'zod';
import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createXapiStatement, type PanaceaEvent, type XapiStatement } from '../../../lib/services/xapiEmitter';

const QuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).optional().default(24),
  format: z.enum(['json', 'jsonld']).optional().default('json'),
});

export const onRequestGet = cronEndpoint({
  schema: QuerySchema,
  source: 'query',
  handler: async (context) => {
    const { env, validated } = context as typeof context & { validated: z.infer<typeof QuerySchema> };
    const hours = validated?.hours ?? 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const startTime = Date.now();

      console.log(`[cron:xapi-export] Exporting activity since ${since.toISOString()} (${hours}h)`);

      const [attempts, reviews] = await Promise.all([
        prisma.questionAttempt.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: 'asc' },
          take: 1000,
        }),
        prisma.reviewLog.findMany({
          where: { createdAt: { gte: since }, review_type: 'real' },
          orderBy: { createdAt: 'asc' },
          take: 1000,
        }),
      ]);

      const statements: XapiStatement[] = [];

      for (const a of attempts) {
        const event: PanaceaEvent = {
          type: 'question_answered',
          userId: a.userId,
          timestamp: a.createdAt.toISOString(),
          questionId: a.questionId,
          isCorrect: a.wasCorrect,
          questionFormat: a.questionType ?? undefined,
          durationMs: a.timeSpentMs ?? undefined,
          systemTag: a.system ?? undefined,
          confidence: a.implicitConfidence ?? undefined,
        };
        statements.push(createXapiStatement(event));
      }

      for (const r of reviews) {
        const event: PanaceaEvent = {
          type: 'review_completed',
          userId: r.userId,
          timestamp: r.reviewedAt.toISOString(),
          cardId: r.id,
          sessionId: r.sessionId ?? undefined,
          isCorrect: r.wasCorrect,
          retention: r.retrievability ?? undefined,
          stability: r.stability,
          difficulty: r.difficulty,
          intervalDays: r.elapsedDays ?? undefined,
          durationMs: r.responseTimeMs ?? undefined,
          systemTag: r.system ?? undefined,
        };
        statements.push(createXapiStatement(event));
      }

      statements.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const durationMs = Date.now() - startTime;
      console.log(`[cron:xapi-export] Exported ${statements.length} statements in ${durationMs}ms`);

      return ok({
        count: statements.length,
        sources: { attempts: attempts.length, reviews: reviews.length },
        since: since.toISOString(),
        hours,
        duration_ms: durationMs,
        statements,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
