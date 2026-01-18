/**
 * Daily Analytics Aggregation Cron Endpoint
 * Compiles daily user statistics for performance tracking
 *
 * Called by: Cloudflare Scheduled Handler at 2 AM UTC
 */

import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../_shared/prisma-edge';
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

    // Get all users with activity in the last 24 hours
    const activeUsers = await prisma.questionAttempt.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: yesterday },
      },
      _count: { id: true },
    });

    let processedCount = 0;

    for (const userActivity of activeUsers) {
      const attempts = await prisma.questionAttempt.findMany({
        where: {
          userId: userActivity.userId,
          createdAt: { gte: yesterday, lt: today },
        },
        select: {
          isCorrect: true,
          timeSpentMs: true,
          system: true,
        },
      });

      const totalAttempts = attempts.length;
      const correctAttempts = attempts.filter((a) => a.isCorrect).length;
      const avgTime = attempts.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0) / totalAttempts;

      // Systems studied
      const systems = [...new Set(attempts.map((a) => a.system).filter(Boolean))];

      // Upsert daily analytics
      await prisma.sessionAnalytics.upsert({
        where: {
          userId_sessionDate: {
            userId: userActivity.userId,
            sessionDate: yesterday,
          },
        },
        update: {
          questionsAnswered: totalAttempts,
          correctAnswers: correctAttempts,
          accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
          avgResponseTimeMs: Math.round(avgTime),
          systemsStudied: systems,
          updatedAt: new Date(),
        },
        create: {
          userId: userActivity.userId,
          sessionDate: yesterday,
          questionsAnswered: totalAttempts,
          correctAnswers: correctAttempts,
          accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
          avgResponseTimeMs: Math.round(avgTime),
          systemsStudied: systems,
        },
      });

      processedCount++;
    }

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