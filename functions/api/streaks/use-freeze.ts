/**
 * Streak API - Use a streak freeze for a missed day
 * POST /api/streaks/use-freeze
 *
 * Consumes one streak freeze to protect the streak for the given date.
 * @see docs/AUDIT_STREAK_FRAGILITY.md
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const UseFreezeSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  }),
});

/**
 * POST: Use one streak freeze for the given date (must be today or in the past)
 */
export const onRequestPost = authenticatedEndpoint(UseFreezeSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/streaks/use-freeze');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const activityDate = new Date(validated.body.date + 'T00:00:00.000Z');
    // Validate that the date parsed correctly (invalid dates like 2025-99-99 would return NaN)
    const activityTime = activityDate.getTime();
    if (isNaN(activityTime)) {
      return { status: 400, error: 'Invalid date format' };
    }

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
    if (activityTime > today.getTime()) {
      return { status: 400, error: 'Cannot use a freeze for a future date' };
    }

    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: auth.userId },
      select: { streakFreezes: true },
    });
    const freezes = prefs?.streakFreezes ?? 0;
    if (freezes < 1) {
      return { status: 400, error: 'No streak freezes available' };
    }

    await prisma.$transaction([
      prisma.streakFreezeUse.upsert({
        where: {
          userId_date: {
            userId: auth.userId,
            date: activityDate,
          },
        },
        create: {
          userId: auth.userId,
          date: activityDate,
        },
        update: {},
      }),
      prisma.userPreferences.update({
        where: { userId: auth.userId },
        data: { streakFreezes: { decrement: 1 } },
      }),
    ]);

    logger.info('Streak freeze used', {
      userId: auth.userId,
      date: validated.body.date,
    });

    return {
      data: {
        success: true,
        date: validated.body.date,
        streakFreezesRemaining: freezes - 1,
      },
      status: 200,
    };
  } catch (error: unknown) {
    logger.error('Use freeze error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to use streak freeze');
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
});
