/**
 * Dashboard Review Queue API
 *
 * GET /api/dashboard/review-queue
 *
 * Returns SRS-scheduled concepts due for review today (from Metacognition Engine).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserId } from '../_shared/user-resolver';

const ReviewQueueSchema = z.object({});

interface ReviewItem {
  id: string;
  topic: string;
  reason: string;
  priority: string;
  scheduledFor: string;
  passed: boolean;
  system?: string;
  conditionId?: string;
}

function parseConceptKey(topic: string): { system: string; conditionId?: string } {
  const parts = topic.split('|');
  return {
    system: parts[0] ?? 'General',
    conditionId: parts[1] && parts[1] !== 'unknown' ? parts[1] : undefined,
  };
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ReviewQueueSchema, async (context) => {
  const { env, auth } = context;
  const log = createEndpointLogger('/api/dashboard/review-queue', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { status: 404, error: 'User not found' };
    }

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const pending = await prisma.studyRecommendation.findMany({
      where: {
        userId,
        type: 'review',
        status: 'pending',
      },
      select: { id: true, topic: true, reason: true, priority: true, data: true },
    });

    const dueToday: ReviewItem[] = [];
    for (const rec of pending) {
      const data = rec.data as { scheduledFor?: string; source?: string; passed?: boolean } | null;
      if (data?.source !== 'metacognition_srs' || !data.scheduledFor) continue;

      const scheduledFor = new Date(data.scheduledFor);
      if (scheduledFor <= todayEnd) {
        const { system, conditionId } = parseConceptKey(rec.topic);
        dueToday.push({
          id: rec.id,
          topic: rec.topic,
          reason: rec.reason,
          priority: rec.priority,
          scheduledFor: data.scheduledFor,
          passed: data.passed ?? false,
          system,
          conditionId,
        });
      }
    }

    dueToday.sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 };
      return (
        (prio[a.priority as keyof typeof prio] ?? 1) - (prio[b.priority as keyof typeof prio] ?? 1)
      );
    });

    log.info('Review queue fetched', { userId, dueCount: dueToday.length });

    return {
      data: {
        dueToday,
        count: dueToday.length,
      },
    };
  } catch (error) {
    log.error('Review queue error', { error });
    return {
      status: 500,
      error: 'Internal server error',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
