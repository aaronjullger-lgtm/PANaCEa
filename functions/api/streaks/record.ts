/**
 * Streak API - Record daily activity
 * POST /api/streaks/record
 *
 * Also: awards coins, and may award 1 streak freeze per 7 consecutive goal days.
 * @see docs/AUDIT_STREAK_FRAGILITY.md
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { computeCurrentStreak, type StreakGoalDays } from '../../../lib/streakCalc';
import { calculateCoinsEarned, STREAK_FREEZE_CONFIG } from '../../../data/modes/dailyRitualsData';

// Shared schema — single source of truth for this endpoint's request contract.
// To change the /api/streaks/record contract, edit lib/api/schemas/streaks.ts.
import { StreakRecordRequestSchema } from '../../../lib/api/schemas/streaks';
const RecordStreakSchema = z.object({ body: StreakRecordRequestSchema });

export const onRequestOptions = withCors();

/**
 * POST: Record daily study activity; award coins; optionally award 1 freeze per 7-day streak
 */
export const onRequestPost = authenticatedEndpoint(RecordStreakSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/streaks/record');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const payload = validated.body;

    const activityDate = payload.date
      ? new Date(payload.date + 'T00:00:00.000Z')
      : new Date(
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

    const streak = await prisma.dailyStreak.upsert({
      where: {
        userId_date: {
          userId: auth.userId,
          date: activityDate,
        },
      },
      update: {
        questionsAnswered: { increment: payload.questionsAnswered },
        accuracyPercent: payload.accuracyPercent,
        studyMinutes: { increment: payload.studyMinutes ?? 0 },
      },
      create: {
        id: crypto.randomUUID(),
        userId: auth.userId,
        date: activityDate,
        questionsAnswered: payload.questionsAnswered,
        accuracyPercent: payload.accuracyPercent,
        studyMinutes: payload.studyMinutes ?? 0,
      },
    });

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

    let coinsEarned = 0;
    let freezeEarned = false;

    const [streakRows, freezeRows, prefs] = await Promise.all([
      prisma.dailyStreak.findMany({
        where: { userId: auth.userId },
        orderBy: { date: 'desc' },
        take: 365,
        select: { date: true },
      }),
      prisma.streakFreezeUse.findMany({
        where: { userId: auth.userId },
        select: { date: true },
      }),
      prisma.userPreferences.findUnique({
        where: { userId: auth.userId },
        select: {
          streakGoalDays: true,
          streakFreezes: true,
          userCoins: true,
          dailyGoal: true,
          customSettings: true,
        },
      }),
    ]);

    const streakGoalDays: StreakGoalDays =
      prefs?.streakGoalDays === 'weekdays' ? 'weekdays' : 'all';
    const activityDates = streakRows.map((r) => new Date(r.date));
    const frozenDates = freezeRows.map((r) => new Date(r.date));
    const { currentStreak, isActiveToday } = computeCurrentStreak({
      activityDates,
      frozenDates,
      today,
      streakGoalDays,
    });

    const hadActiveStreak = isActiveToday && currentStreak >= 1;
    const correctAnswers = Math.round((payload.accuracyPercent / 100) * payload.questionsAnswered);
    coinsEarned = calculateCoinsEarned(payload.questionsAnswered, correctAnswers, hadActiveStreak);

    if (prefs) {
      const customSettings = (prefs.customSettings as Record<string, unknown>) ?? {};
      const lastFreezeEarnedStreak = (customSettings.lastFreezeEarnedStreak as number) ?? 0;
      const streakFreezes = prefs.streakFreezes ?? 0;
      if (
        currentStreak >= 7 &&
        currentStreak >= lastFreezeEarnedStreak + 7 &&
        streakFreezes < STREAK_FREEZE_CONFIG.maxFreezes
      ) {
        freezeEarned = true;
        await prisma.userPreferences.update({
          where: { userId: auth.userId },
          data: {
            streakFreezes: { increment: 1 },
            userCoins: { increment: coinsEarned },
            customSettings: {
              ...customSettings,
              lastFreezeEarnedStreak: currentStreak,
            },
          },
        });
      } else if (coinsEarned > 0) {
        await prisma.userPreferences.update({
          where: { userId: auth.userId },
          data: { userCoins: { increment: coinsEarned } },
        });
      }
    }

    logger.info('Streak recorded', {
      userId: auth.userId,
      date: activityDate.toISOString().split('T')[0],
      questionsAnswered: streak.questionsAnswered,
      coinsEarned: freezeEarned ? '(included in update)' : coinsEarned,
      freezeEarned,
    });

    return {
      data: {
        success: true,
        message: 'Activity recorded successfully',
        data: {
          date: activityDate.toISOString().split('T')[0],
          questionsAnswered: streak.questionsAnswered,
          accuracyPercent: streak.accuracyPercent,
          studyMinutes: streak.studyMinutes,
          coinsEarned,
          freezeEarned,
        },
      },
      status: 201,
    };
  } catch (error: unknown) {
    logger.error('Streak record error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to record streak');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
