/**
 * Streak API - Get user streak information
 * GET /api/streaks/:userId
 *
 * Supports Streak Freezes and Weekend Mode (streakGoalDays).
 * @see docs/AUDIT_STREAK_FRAGILITY.md
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  computeCurrentStreak,
  computeLongestStreak,
  type StreakGoalDays,
} from '../../../lib/streakCalc';

const StreakParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
});

export const onRequestOptions = withCors();

/**
 * GET: Fetch user's current streak (with freezes and weekend mode)
 */
export const onRequestGet = authenticatedEndpoint(StreakParamsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/streaks/[userId]');
  const { userId: requestedUserId } = validated.params;

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
    const [streakRows, freezeRows, prefs] = await Promise.all([
      prisma.dailyStreak.findMany({
        where: { userId: requestedUserId },
        orderBy: { date: 'desc' },
        take: 365,
        select: { date: true },
      }),
      prisma.streakFreezeUse.findMany({
        where: { userId: requestedUserId },
        select: { date: true },
      }),
      prisma.userPreferences.findUnique({
        where: { userId: auth.userId },
        select: { streakGoalDays: true, streakFreezes: true, userCoins: true },
      }),
    ]);

    const streakGoalDays: StreakGoalDays =
      (prefs?.streakGoalDays as StreakGoalDays) === 'weekdays' ? 'weekdays' : 'all';
    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    const activityDates = streakRows.map((r) => new Date(r.date));
    const frozenDates = freezeRows.map((r) => new Date(r.date));

    const { currentStreak, isActiveToday } = computeCurrentStreak({
      activityDates,
      frozenDates,
      today,
      streakGoalDays,
    });
    const longestStreak = computeLongestStreak({
      activityDates,
      frozenDates,
      today,
      streakGoalDays,
    });

    const flameLevel = Math.min(
      5,
      currentStreak >= 100
        ? 5
        : currentStreak >= 30
          ? 4
          : currentStreak >= 14
            ? 3
            : currentStreak >= 7
              ? 2
              : currentStreak >= 3
                ? 1
                : 0
    );

    logger.info('Fetched user streaks', {
      userId: requestedUserId,
      currentStreak,
      isActiveToday,
      streakGoalDays,
    });

    return {
      data: {
        currentStreak,
        longestStreak,
        isActiveToday,
        flameLevel,
        lastActivity: streakRows.length > 0 ? (streakRows[0]?.date ?? null) : null,
        streakFreezes: prefs?.streakFreezes ?? 0,
        userCoins: prefs?.userCoins ?? 0,
        streakGoalDays,
      },
    };
  } catch (error: unknown) {
    logger.error('Streak GET error', {
      error: error instanceof Error ? error.message : String(error),
      userId: requestedUserId,
    });
    throw new Error('Internal server error');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
