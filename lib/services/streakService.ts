/**
 * Streak tracking service for PANaCEa platform
 * Manages daily activity streaks and flame level calculation
 */

import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../db';
import { getTodayUTC } from '../utils/timeUtils';

const getPrisma = () => getPrismaClient();

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  flameLevel: number; // 0-5, for visual representation
  lastActiveDate: Date | null;
  isActiveToday: boolean;
}

/**
 * Get current date in UTC (normalized to midnight)
 * Using UTC ensures consistent date calculations regardless of client/server timezone
 */
function getTodayDate(): Date {
  return getTodayUTC();
}

/**
 * Get yesterday's date in UTC
 */
function getYesterdayDate(): Date {
  const today = getTodayUTC();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday;
}

/**
 * Record a study activity for today
 */
export async function recordDailyActivity(
  userId: string,
  questionsAnswered: number,
  accuracyPercent: number,
  studyMinutes: number = 0
): Promise<void> {
  const today = getTodayDate();
  const prisma = getPrisma();

  await prisma.dailyStreak.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    update: {
      questionsAnswered: { increment: questionsAnswered },
      accuracyPercent: (accuracyPercent + (await getCurrentDayAccuracy(userId))) / 2,
      studyMinutes: { increment: studyMinutes },
    },
    create: {
      id: uuidv4(),
      userId,
      date: today,
      questionsAnswered,
      accuracyPercent,
      studyMinutes,
    },
  });
}

/**
 * Get current day's accuracy (for averaging)
 */
async function getCurrentDayAccuracy(userId: string): Promise<number> {
  const today = getTodayDate();
  const prisma = getPrisma();
  const record = await prisma.dailyStreak.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });
  return record?.accuracyPercent || 0;
}

/**
 * Calculate current streak for a user
 */
export async function getCurrentStreak(userId: string): Promise<StreakInfo> {
  const prisma = getPrisma();
  const streaks = await prisma.dailyStreak.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 365, // Check up to a year
  });

  if (streaks.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      flameLevel: 0,
      lastActiveDate: null,
      isActiveToday: false,
    };
  }

  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  // Check if active today
  const isActiveToday = streaks[0]?.date.getTime() === today.getTime();

  // Calculate current streak
  let currentStreak = 0;
  let expectedDate = isActiveToday ? today : yesterday;

  for (const streak of streaks) {
    const streakDate = new Date(streak.date);
    streakDate.setHours(0, 0, 0, 0);

    if (streakDate.getTime() === expectedDate.getTime()) {
      currentStreak++;
      expectedDate = new Date(expectedDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const streak of streaks) {
    const streakDate = new Date(streak.date);
    streakDate.setHours(0, 0, 0, 0);

    if (prevDate === null) {
      tempStreak = 1;
    } else {
      const dayDiff = Math.floor(
        (prevDate.getTime() - streakDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    prevDate = streakDate;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Calculate flame level (0-5)
  let flameLevel = 0;
  if (currentStreak >= 3) flameLevel = 1;
  if (currentStreak >= 7) flameLevel = 2;
  if (currentStreak >= 14) flameLevel = 3;
  if (currentStreak >= 30) flameLevel = 4;
  if (currentStreak >= 100) flameLevel = 5;

  return {
    currentStreak,
    longestStreak,
    flameLevel,
    lastActiveDate: streaks[0]?.date || null,
    isActiveToday,
  };
}

/**
 * Get streak statistics for display
 */
export async function getStreakStats(userId: string) {
  const info = await getCurrentStreak(userId);
  const prisma = getPrisma();

  const thisWeek = await prisma.dailyStreak.findMany({
    where: {
      userId,
      date: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const thisMonth = await prisma.dailyStreak.findMany({
    where: {
      userId,
      date: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    ...info,
    activeDaysThisWeek: thisWeek.length,
    activeDaysThisMonth: thisMonth.length,
    totalQuestionsThisWeek: thisWeek.reduce((sum, s) => sum + s.questionsAnswered, 0),
    totalQuestionsThisMonth: thisMonth.reduce((sum, s) => sum + s.questionsAnswered, 0),
    avgAccuracyThisWeek:
      thisWeek.length > 0
        ? thisWeek.reduce((sum, s) => sum + s.accuracyPercent, 0) / thisWeek.length
        : 0,
    avgAccuracyThisMonth:
      thisMonth.length > 0
        ? thisMonth.reduce((sum, s) => sum + s.accuracyPercent, 0) / thisMonth.length
        : 0,
  };
}

/**
 * Check if streak is at risk (no activity today and it's late in the day)
 */
export function isStreakAtRisk(lastActiveDate: Date | null): boolean {
  if (!lastActiveDate) return false;

  const today = getTodayDate();
  const lastActive = new Date(lastActiveDate);
  lastActive.setHours(0, 0, 0, 0);

  // Streak is at risk if last active was yesterday and current hour is past 6 PM
  const currentHour = new Date().getHours();
  return lastActive.getTime() === getYesterdayDate().getTime() && currentHour >= 18;
}
