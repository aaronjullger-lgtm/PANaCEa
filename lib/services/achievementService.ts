/**
 * Achievement service for PANaCEa platform
 * Handles achievement checking, unlocking, and tracking
 */

import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS, getAchievementById } from '../../config/achievements';

const prisma = new PrismaClient();

export interface AchievementProgress {
  achievementId: string;
  isUnlocked: boolean;
  progress: number; // 0-100
  unlockedAt?: Date;
}

/**
 * Check if user has unlocked a specific achievement
 */
export async function hasAchievement(
  userId: string,
  achievementId: string
): Promise<boolean> {
  const achievement = await prisma.userAchievement.findUnique({
    where: {
      userId_achievementId: {
        userId,
        achievementId,
      },
    },
  });
  return !!achievement;
}

/**
 * Unlock an achievement for a user
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string,
  progress: number = 100
): Promise<boolean> {
  try {
    // Check if already unlocked
    const existing = await hasAchievement(userId, achievementId);
    if (existing) return false;

    // Create achievement record
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId,
        progress,
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to unlock achievement:', error);
    return false;
  }
}

/**
 * Get all achievements for a user with unlock status
 */
export async function getUserAchievements(
  userId: string
): Promise<AchievementProgress[]> {
  const unlockedAchievements = await prisma.userAchievement.findMany({
    where: { userId },
  });

  const unlockedMap = new Map(
    unlockedAchievements.map((a) => [
      a.achievementId,
      { progress: a.progress, unlockedAt: a.unlockedAt },
    ])
  );

  return ACHIEVEMENTS.map((def) => {
    const unlocked = unlockedMap.get(def.id);
    return {
      achievementId: def.id,
      isUnlocked: !!unlocked,
      progress: unlocked?.progress || 0,
      unlockedAt: unlocked?.unlockedAt,
    };
  });
}

/**
 * Check and unlock streak-based achievements
 */
export async function checkStreakAchievements(
  userId: string,
  currentStreak: number
): Promise<string[]> {
  const unlockedIds: string[] = [];

  const streakAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirements.type === 'streak' && !a.requirements.condition
  );

  for (const achievement of streakAchievements) {
    if (currentStreak >= achievement.requirements.value) {
      const wasUnlocked = await unlockAchievement(userId, achievement.id);
      if (wasUnlocked) {
        unlockedIds.push(achievement.id);
      }
    }
  }

  return unlockedIds;
}

/**
 * Check and unlock daily streak achievements
 */
export async function checkDailyStreakAchievements(
  userId: string,
  dailyStreak: number
): Promise<string[]> {
  const unlockedIds: string[] = [];

  const dailyAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirements.type === 'streak' && a.requirements.condition === 'daily'
  );

  for (const achievement of dailyAchievements) {
    if (dailyStreak >= achievement.requirements.value) {
      const wasUnlocked = await unlockAchievement(userId, achievement.id);
      if (wasUnlocked) {
        unlockedIds.push(achievement.id);
      }
    }
  }

  return unlockedIds;
}

/**
 * Check and unlock question count achievements
 */
export async function checkQuestionCountAchievements(
  userId: string,
  totalQuestions: number
): Promise<string[]> {
  const unlockedIds: string[] = [];

  const countAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirements.type === 'count'
  );

  for (const achievement of countAchievements) {
    if (totalQuestions >= achievement.requirements.value) {
      const wasUnlocked = await unlockAchievement(userId, achievement.id);
      if (wasUnlocked) {
        unlockedIds.push(achievement.id);
      }
    }
  }

  return unlockedIds;
}

/**
 * Check and unlock accuracy achievements
 */
export async function checkAccuracyAchievements(
  userId: string,
  accuracy: number,
  questionCount: number
): Promise<string[]> {
  const unlockedIds: string[] = [];

  const accuracyAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirements.type === 'accuracy'
  );

  for (const achievement of accuracyAchievements) {
    // Parse session size requirement from condition
    const match = achievement.requirements.condition?.match(/session_(\d+)/);
    const requiredQuestions = match ? parseInt(match[1]) : 0;

    if (
      questionCount >= requiredQuestions &&
      accuracy >= achievement.requirements.value
    ) {
      const wasUnlocked = await unlockAchievement(userId, achievement.id);
      if (wasUnlocked) {
        unlockedIds.push(achievement.id);
      }
    }
  }

  return unlockedIds;
}

/**
 * Check and unlock mastery achievements
 */
export async function checkMasteryAchievements(
  userId: string,
  systemCode: string
): Promise<string[]> {
  const unlockedIds: string[] = [];

  const masteryAchievements = ACHIEVEMENTS.filter(
    (a) =>
      a.requirements.type === 'mastery' &&
      a.requirements.condition === systemCode
  );

  for (const achievement of masteryAchievements) {
    // Check if user has gold mastery in this system
    const mastery = await prisma.masteryProgress.findFirst({
      where: {
        userId,
        systemCode,
        masteryTier: 'gold',
      },
    });

    if (mastery) {
      const wasUnlocked = await unlockAchievement(userId, achievement.id);
      if (wasUnlocked) {
        unlockedIds.push(achievement.id);
      }
    }
  }

  return unlockedIds;
}

/**
 * Check for "all systems gold" achievement
 */
export async function checkAllSystemsGoldAchievement(
  userId: string
): Promise<string[]> {
  const unlockedIds: string[] = [];

  const allSystems = ['CV', 'PULM', 'GI', 'NEURO', 'RENAL', 'ENDO', 'HEME', 'MSK', 'DERM', 'PSYCH'];
  
  const goldMasteries = await prisma.masteryProgress.findMany({
    where: {
      userId,
      masteryTier: 'gold',
      systemCode: { in: allSystems },
    },
  });

  if (goldMasteries.length >= allSystems.length) {
    const wasUnlocked = await unlockAchievement(userId, 'all_systems_gold');
    if (wasUnlocked) {
      unlockedIds.push('all_systems_gold');
    }
  }

  return unlockedIds;
}

/**
 * Check special achievements (baseline, time-based, etc.)
 */
export async function checkSpecialAchievement(
  userId: string,
  achievementId: string
): Promise<boolean> {
  return unlockAchievement(userId, achievementId);
}

/**
 * Get achievement statistics for user
 */
export async function getAchievementStats(userId: string) {
  const achievements = await getUserAchievements(userId);
  const unlocked = achievements.filter((a) => a.isUnlocked);

  const byRarity = ACHIEVEMENTS.reduce((acc, def) => {
    const isUnlocked = unlocked.some((u) => u.achievementId === def.id);
    acc[def.rarity] = (acc[def.rarity] || 0) + (isUnlocked ? 1 : 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    total: ACHIEVEMENTS.length,
    unlocked: unlocked.length,
    percentage: Math.round((unlocked.length / ACHIEVEMENTS.length) * 100),
    byRarity,
    recentUnlocks: unlocked
      .sort((a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0))
      .slice(0, 5),
  };
}
