/**
 * Streak API - Auto-apply streak freeze for missed days
 * POST /api/streaks/auto-freeze
 *
 * Called on app open. Checks if the user missed any goal days since last activity.
 * If freezes are available, auto-applies them to preserve the streak.
 *
 * @see lib/streakCalc.ts for weekend mode and freeze logic
 * @see docs/AUDIT_STREAK_FRAGILITY.md
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserId } from '../_shared/user-resolver';
import { isGoalDay, previousGoalDay, lastGoalDayOnOrBefore, type StreakGoalDays } from '../../../lib/streakCalc';

function toMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function toDateKey(d: Date): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

/**
 * POST: Auto-apply streak freezes for missed goal days
 *
 * Walks backward from yesterday, finds missed goal days with no activity or freeze,
 * and auto-applies available freezes to bridge the gap.
 */
export const onRequestPost = authenticatedEndpoint({}, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/streaks/auto-freeze');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const today = toMidnightUTC(new Date());
    const internalUserId = await resolveOrCreateUserId(prisma, auth.userId);

    // Fetch user preferences
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: internalUserId },
      select: { streakFreezes: true, streakGoalDays: true },
    });

    let availableFreezes = prefs?.streakFreezes ?? 0;
    const streakGoalDays = (prefs?.streakGoalDays as StreakGoalDays) || 'all';

    if (availableFreezes < 1) {
      return {
        data: { freezesApplied: 0, remainingFreezes: 0 },
        status: 200,
      };
    }

    // Fetch recent activity dates (last 14 days is sufficient)
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

    const [activities, existingFreezes] = await Promise.all([
      prisma.dailyStreak.findMany({
        where: {
          userId: internalUserId,
          date: { gte: twoWeeksAgo },
        },
        select: { date: true },
      }),
      prisma.streakFreezeUse.findMany({
        where: {
          userId: internalUserId,
          date: { gte: twoWeeksAgo },
        },
        select: { date: true },
      }),
    ]);

    const activityKeys = new Set(activities.map((a) => toDateKey(a.date)));
    const frozenKeys = new Set(existingFreezes.map((f) => toDateKey(f.date)));

    // Walk backward from yesterday, find missed goal days
    const missedDays: Date[] = [];
    let cursor = previousGoalDay(
      lastGoalDayOnOrBefore(today, streakGoalDays),
      streakGoalDays
    );

    // If today is a goal day, start from yesterday's goal day
    if (isGoalDay(today, streakGoalDays)) {
      cursor = previousGoalDay(today, streakGoalDays);
    }

    // Walk back up to 7 goal days looking for gaps
    const MAX_LOOKBACK = 7;
    let checked = 0;
    while (checked < MAX_LOOKBACK) {
      const key = toDateKey(cursor);
      if (activityKeys.has(key) || frozenKeys.has(key)) {
        // This day is covered — stop looking (streak is continuous from here)
        break;
      }
      // This is a missed goal day — needs a freeze
      missedDays.push(toMidnightUTC(cursor));
      cursor = previousGoalDay(cursor, streakGoalDays);
      checked++;
    }

    // If we found no covered day within lookback, the streak is already broken
    // Don't waste freezes on a broken streak
    if (checked >= MAX_LOOKBACK && missedDays.length >= MAX_LOOKBACK) {
      return {
        data: {
          freezesApplied: 0,
          remainingFreezes: availableFreezes,
          streakAlreadyBroken: true,
        },
        status: 200,
      };
    }

    // Apply freezes to missed days (most recent first)
    const freezesToApply = missedDays.slice(0, availableFreezes);
    if (freezesToApply.length === 0) {
      return {
        data: { freezesApplied: 0, remainingFreezes: availableFreezes },
        status: 200,
      };
    }

    // Batch upsert freezes and decrement count
    const operations = freezesToApply.map((date) =>
      prisma!.streakFreezeUse.upsert({
        where: {
          userId_date: { userId: internalUserId, date },
        },
        create: { userId: internalUserId, date },
        update: {},
      })
    );

    operations.push(
      prisma.userPreferences.update({
        where: { userId: internalUserId },
        data: { streakFreezes: { decrement: freezesToApply.length } },
      }) as any
    );

    await prisma.$transaction(operations);

    logger.info('Auto-freeze applied', {
      userId: internalUserId,
      freezesApplied: freezesToApply.length,
      dates: freezesToApply.map(toDateKey),
    });

    return {
      data: {
        freezesApplied: freezesToApply.length,
        remainingFreezes: availableFreezes - freezesToApply.length,
        frozenDates: freezesToApply.map(toDateKey),
      },
      status: 200,
    };
  } catch (error: unknown) {
    logger.error('Auto-freeze error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to auto-apply streak freezes');
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
});
