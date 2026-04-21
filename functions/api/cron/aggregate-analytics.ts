/**
 * Daily Analytics Aggregation Cron Endpoint
 * Compiles daily user statistics for performance tracking
 *
 * Called by: Cloudflare Scheduled Handler at 2 AM UTC
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { z } from 'zod';
import { cronEndpoint, ok } from '../_shared/endpoint';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const BodySchema = z.object({
  forceDate: z.string().optional(),
}).optional().default({});

export const onRequestPost = cronEndpoint({
  schema: BodySchema,
  handler: async (context) => {
    const { env } = context;
    const log = createEndpointLogger('/api/cron/aggregate-analytics', 'SYSTEM');
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      log.info('Starting analytics aggregation', { date: yesterday.toISOString() });

      type AttemptRow = {
        userId: string;
        wasCorrect: boolean;
        timeSpentMs: number | null;
        system: string | null;
        conditionId: string | null;
        medicalContentId: string | null;
      };
      const attempts = (await prisma.questionAttempt.findMany({
        where: { createdAt: { gte: yesterday, lt: today } },
        select: {
          userId: true,
          wasCorrect: true,
          timeSpentMs: true,
          system: true,
          conditionId: true,
          medicalContentId: true,
        },
      })) as AttemptRow[];

      type UserAgg = {
        total: number;
        correct: number;
        timeSum: number;
        systems: Set<string>;
        bySystem: Map<string, { total: number; correct: number }>;
      };
      const perUser = new Map<string, UserAgg>();
      for (const a of attempts) {
        const cur = perUser.get(a.userId) ?? {
          total: 0, correct: 0, timeSum: 0,
          systems: new Set<string>(),
          bySystem: new Map<string, { total: number; correct: number }>(),
        };
        cur.total += 1;
        if (a.wasCorrect) cur.correct += 1;
        cur.timeSum += a.timeSpentMs ?? 0;
        if (a.system) {
          cur.systems.add(a.system);
          const sys = cur.bySystem.get(a.system) ?? { total: 0, correct: 0 };
          sys.total += 1;
          if (a.wasCorrect) sys.correct += 1;
          cur.bySystem.set(a.system, sys);
        }
        perUser.set(a.userId, cur);
      }

      const sessionDateOnly = new Date(yesterday);
      sessionDateOnly.setUTCHours(0, 0, 0, 0);

      for (const [userId, agg] of perUser.entries()) {
        const avgTime = agg.total > 0 ? agg.timeSum / agg.total : 0;
        const accuracyBySystem: Record<string, number> = {};
        agg.bySystem.forEach((v, sys) => {
          accuracyBySystem[sys] = v.total > 0 ? (v.correct / v.total) * 100 : 0;
        });
        await prisma.dailyUserAnalytics.upsert({
          where: { userId_sessionDate: { userId, sessionDate: sessionDateOnly } },
          update: {
            questionsAnswered: agg.total,
            correctAnswers: agg.correct,
            accuracy: agg.total > 0 ? (agg.correct / agg.total) * 100 : 0,
            avgResponseTimeMs: Math.round(avgTime),
            systemsStudied: [...agg.systems],
            accuracyBySystem: Object.keys(accuracyBySystem).length > 0 ? accuracyBySystem : undefined,
            updatedAt: new Date(),
          },
          create: {
            id: `daily_${userId}_${sessionDateOnly.toISOString().split('T')[0]}`,
            userId,
            sessionDate: sessionDateOnly,
            questionsAnswered: agg.total,
            correctAnswers: agg.correct,
            accuracy: agg.total > 0 ? (agg.correct / agg.total) * 100 : 0,
            avgResponseTimeMs: Math.round(avgTime),
            systemsStudied: [...agg.systems],
            accuracyBySystem: Object.keys(accuracyBySystem).length > 0 ? accuracyBySystem : undefined,
            updatedAt: new Date(),
          },
        });
      }

      // Per-user per-condition accuracy
      const perUserCondition = new Map<string, Map<string, { total: number; correct: number; medicalContentId: string | null }>>();
      for (const a of attempts) {
        const conditionId = a.conditionId ?? a.medicalContentId;
        if (!conditionId) continue;
        let userMap = perUserCondition.get(a.userId);
        if (!userMap) { userMap = new Map(); perUserCondition.set(a.userId, userMap); }
        const cur = userMap.get(conditionId) ?? { total: 0, correct: 0, medicalContentId: a.medicalContentId };
        cur.total += 1;
        if (a.wasCorrect) cur.correct += 1;
        userMap.set(conditionId, cur);
      }
      for (const [userId, condMap] of perUserCondition.entries()) {
        for (const [conditionId, v] of condMap.entries()) {
          await prisma.userConditionAccuracy.upsert({
            where: { userId_conditionId: { userId, conditionId } },
            update: {
              attemptCount: { increment: v.total },
              correctCount: { increment: v.correct },
              lastAttemptedAt: sessionDateOnly,
              updatedAt: new Date(),
            },
            create: {
              id: `uca_${userId}_${conditionId}`,
              userId,
              conditionId,
              medicalContentId: v.medicalContentId ?? undefined,
              attemptCount: v.total,
              correctCount: v.correct,
              lastAttemptedAt: sessionDateOnly,
            },
          });
        }
      }

      const processedCount = perUser.size;

      await prisma.auditLog.create({
        data: {
          id: `audit_analytics_${yesterday.toISOString().split('T')[0]}_${Date.now()}`,
          action: 'DAILY_ANALYTICS_AGGREGATION',
          entityType: 'SYSTEM',
          details: {
            date: yesterday.toISOString(),
            usersProcessed: processedCount,
            timestamp: new Date().toISOString(),
          },
        },
      });

      log.info('Analytics aggregation completed', { date: yesterday.toISOString(), usersProcessed: processedCount });

      return ok({ usersProcessed: processedCount, date: yesterday.toISOString() });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
