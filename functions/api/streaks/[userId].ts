/**
 * Streak API - Get user streak information
 * GET /api/streaks/:userId
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const StreakParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
});

interface PagesContext {
  request: Request;
  env: any;
  params: {
    userId: string;
  };
}

export const onRequestOptions = withCors();

/**
 * GET: Fetch user's current streak information
 */
export const onRequestGet = authenticatedEndpoint(StreakParamsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/streaks/[userId]');
  const { userId: requestedUserId } = validated.params;

  // Users can only fetch their own streaks
  if (auth.userId !== requestedUserId) {
    logger.warn('Forbidden access attempt', {
      authenticatedUserId: auth.userId,
      requestedUserId,
    });
    throw new Error('Forbidden');
  }

  if (!env.DATABASE_URL) {
    logger.error('Database not configured');
    throw new Error('Database not configured');
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const streaks = await prisma.dailyStreak.findMany({
      where: { userId: requestedUserId },
      orderBy: { date: 'desc' },
      take: 100,
    });

    // Calculate current streak
    let currentStreak = 0;
    let isActiveToday = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (streaks.length > 0) {
      const lastStreak = streaks[0];
      const lastDate = new Date(lastStreak.date);
      lastDate.setHours(0, 0, 0, 0);

      if (lastDate.getTime() === today.getTime()) {
        isActiveToday = true;
        currentStreak = 1;
        // Check previous days
        for (let i = 1; i < streaks.length; i++) {
          const prevDate = new Date(streaks[i].date);
          prevDate.setHours(0, 0, 0, 0);
          const expectedDate = new Date(today);
          expectedDate.setDate(expectedDate.getDate() - i);

          if (prevDate.getTime() === expectedDate.getTime()) {
            currentStreak++;
          } else {
            break;
          }
        }
      } else if (lastDate.getTime() === yesterday.getTime()) {
        currentStreak = 1;
        // Check previous days
        for (let i = 1; i < streaks.length; i++) {
          const prevDate = new Date(streaks[i].date);
          prevDate.setHours(0, 0, 0, 0);
          const expectedDate = new Date(yesterday);
          expectedDate.setDate(expectedDate.getDate() - i);

          if (prevDate.getTime() === expectedDate.getTime()) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    logger.info('Fetched user streaks', {
      userId: requestedUserId,
      currentStreak,
      isActiveToday,
    });

    return {
      data: {
        currentStreak,
        longestStreak: currentStreak, // Simplified for now
        isActiveToday,
        flameLevel: Math.min(currentStreak, 5),
        lastActivity: streaks.length > 0 ? streaks[0].date : null,
      },
    };
  } catch (error: any) {
    logger.error('Streak GET error', {
      error: error.message,
      userId: requestedUserId,
    });
    throw new Error('Internal server error');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});