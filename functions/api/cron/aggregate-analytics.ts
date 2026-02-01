/**
 * Daily Analytics Aggregation Cron Endpoint
 * Compiles daily user statistics for performance tracking
 *
 * Called by: Cloudflare Scheduled Handler at 2 AM UTC
 */

import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// Zod schema for cron request (optional body for manual runs)
const CronRequestSchema = z
  .object({
    forceDate: z.string().optional(), // Optional: override date for manual runs
  })
  .optional()
  .default({});

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const log = createEndpointLogger('/api/cron/aggregate-analytics', 'SYSTEM');
  let prisma: EdgePrismaClient | null = null;

  // Verify cron secret
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    log.warn('Unauthorized cron access attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse and validate request body (optional for cron)
    let body = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is fine for cron
    }

    const validation = CronRequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: validation.error.format() }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Get start of today (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    log.info('Starting analytics aggregation', { date: yesterday.toISOString() });

    // Single query for all attempts in the date range (avoids N+1)
    type AttemptRow = {
      userId: string;
      wasCorrect: boolean;
      timeSpentMs: number | null;
      system: string | null;
    };
    const attempts = (await prisma.questionAttempt.findMany({
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
      select: {
        userId: true,
        wasCorrect: true,
        timeSpentMs: true,
        system: true,
      },
    })) as AttemptRow[];

    // Aggregate per user in memory
    const perUser = new Map<
      string,
      { total: number; correct: number; timeSum: number; systems: Set<string> }
    >();
    for (const a of attempts) {
      const cur = perUser.get(a.userId) ?? {
        total: 0,
        correct: 0,
        timeSum: 0,
        systems: new Set<string>(),
      };
      cur.total += 1;
      if (a.wasCorrect) cur.correct += 1;
      cur.timeSum += a.timeSpentMs ?? 0;
      if (a.system) cur.systems.add(a.system);
      perUser.set(a.userId, cur);
    }

    const sessionDateOnly = new Date(yesterday);
    sessionDateOnly.setUTCHours(0, 0, 0, 0);

    for (const [userId, agg] of perUser.entries()) {
      const avgTime = agg.total > 0 ? agg.timeSum / agg.total : 0;
      await prisma.dailyUserAnalytics.upsert({
        where: {
          userId_sessionDate: { userId, sessionDate: sessionDateOnly },
        },
        update: {
          questionsAnswered: agg.total,
          correctAnswers: agg.correct,
          accuracy: agg.total > 0 ? (agg.correct / agg.total) * 100 : 0,
          avgResponseTimeMs: Math.round(avgTime),
          systemsStudied: [...agg.systems],
          updatedAt: new Date(),
        },
        create: {
          userId,
          sessionDate: sessionDateOnly,
          questionsAnswered: agg.total,
          correctAnswers: agg.correct,
          accuracy: agg.total > 0 ? (agg.correct / agg.total) * 100 : 0,
          avgResponseTimeMs: Math.round(avgTime),
          systemsStudied: [...agg.systems],
        },
      });
    }
    const processedCount = perUser.size;

    // Log to audit
    await prisma.auditLog.create({
      data: {
        action: 'DAILY_ANALYTICS_AGGREGATION',
        entityType: 'SYSTEM',
        details: {
          date: yesterday.toISOString(),
          usersProcessed: processedCount,
          timestamp: new Date().toISOString(),
        },
      },
    });

    log.info('Analytics aggregation completed', {
      date: yesterday.toISOString(),
      usersProcessed: processedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        usersProcessed: processedCount,
        date: yesterday.toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    log.error('Analytics aggregation failed', error);
    return new Response(
      JSON.stringify({
        error: 'Aggregation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
