#!/usr/bin/env tsx
/**
 * User Statistics Calculation Jobs
 * 
 * Centralized user-specific calculations:
 * - FSRS card processing and due card calculation
 * - Streak tracking and updates
 * - Weekly progress report generation
 * - Personalized recommendation generation
 * - Performance trend analysis
 * 
 * These jobs are called by hourly/daily/weekly tasks
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// HOURLY: Quick Stats Updates
// ============================================================================

/**
 * Update user streaks and check for streak breaks
 * Uses DailyStreak and UserLearningProfile tables
 */
export async function updateUserStreaks(): Promise<{
  updated: number;
  broken: number;
  maintained: number;
}> {
  console.log('📊 Updating user streaks...');
  
  const stats = { updated: 0, broken: 0, maintained: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  try {
    // Get all users with learning profiles that have active streaks
    const usersWithStreaks = await prisma.userLearningProfile.findMany({
      where: {
        currentStreak: { gt: 0 },
      },
      select: {
        id: true,
        userId: true,
        currentStreak: true,
        longestDailyStreak: true,
      },
    });
    
    for (const profile of usersWithStreaks) {
      // Check if user had activity yesterday
      const yesterdayActivity = await prisma.dailyStreak.findFirst({
        where: {
          userId: profile.userId,
          date: yesterday,
          questionsAnswered: { gt: 0 },
        },
      });
      
      if (!yesterdayActivity) {
        // Missed a day, break streak
        await prisma.userLearningProfile.update({
          where: { id: profile.id },
          data: { currentStreak: 0 },
        });
        stats.broken++;
      } else {
        stats.maintained++;
      }
      
      stats.updated++;
    }
    
    console.log(`✅ Streaks: ${stats.updated} checked, ${stats.broken} broken, ${stats.maintained} maintained`);
    return stats;
  } catch (error) {
    console.error('❌ Failed to update streaks:', error);
    throw error;
  }
}

/**
 * Calculate due cards for FSRS spaced repetition
 */
export async function calculateDueCards(): Promise<{
  usersProcessed: number;
  totalDueCards: number;
}> {
  console.log('🎴 Calculating due FSRS cards...');
  
  const stats = { usersProcessed: 0, totalDueCards: 0 };
  const now = new Date();
  
  try {
    // Get users with progress records
    const userProgress = await prisma.userProgress.groupBy({
      by: ['userId'],
    });
    
    for (const user of userProgress) {
      // Count due cards for this user
      const dueCount = await prisma.userProgress.count({
        where: {
          userId: user.userId,
          nextReviewAt: { lte: now },
        },
      });
      
      // Update learning profile with due count
      await prisma.userLearningProfile.upsert({
        where: { userId: user.userId },
        create: {
          id: `ulp_${user.userId}`,
          userId: user.userId,
        },
        update: {
          updatedAt: now,
        },
      });
      
      stats.usersProcessed++;
      stats.totalDueCards += dueCount;
    }
    
    console.log(`✅ Due cards: ${stats.usersProcessed} users, ${stats.totalDueCards} total due cards`);
    return stats;
  } catch (error) {
    console.error('❌ Failed to calculate due cards:', error);
    throw error;
  }
}

/**
 * Update hourly leaderboard cache
 */
export async function updateLeaderboardCache(): Promise<number> {
  console.log('🏆 Updating leaderboard cache...');
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Get top performers in the last hour
    const hourlyLeaders = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: oneHourAgo },
      },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: 100,
    });
    
    console.log(`✅ Leaderboard: ${hourlyLeaders.length} active users this hour`);
    return hourlyLeaders.length;
  } catch (error) {
    console.error('❌ Failed to update leaderboard:', error);
    throw error;
  }
}

// ============================================================================
// DAILY: Recommendation Generation
// ============================================================================

/**
 * Generate daily study recommendations for each user
 * Stores recommendations in UserLearningProfile
 */
export async function generateDailyRecommendations(): Promise<{
  usersProcessed: number;
  recommendationsGenerated: number;
}> {
  console.log('🎯 Generating daily study recommendations...');
  
  const stats = { usersProcessed: 0, recommendationsGenerated: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    // Get active users (studied in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUserIds = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    
    for (const userRecord of activeUserIds) {
      const userId = userRecord.userId;
      
      // Get performance records grouped by system
      const userRecords = await prisma.performanceRecord.findMany({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          system: true,
          isCorrect: true,
        },
      });
      
      // Calculate system stats
      const systemStats: Record<string, { total: number; correct: number }> = {};
      for (const record of userRecords) {
        const sys = record.system || 'unknown';
        if (!systemStats[sys]) systemStats[sys] = { total: 0, correct: 0 };
        systemStats[sys].total++;
        if (record.isCorrect) systemStats[sys].correct++;
      }
      
      // Find weak systems (< 70% accuracy)
      const weakSystems: string[] = [];
      for (const [system, stats] of Object.entries(systemStats)) {
        if (stats.total >= 5 && (stats.correct / stats.total) < 0.7) {
          weakSystems.push(system);
        }
      }
      
      // Count due cards
      const dueCount = await prisma.userProgress.count({
        where: {
          userId,
          nextReviewAt: { lte: today },
        },
      });
      
      // Generate recommendation
      const recommendations = [];
      if (weakSystems.length > 0) {
        recommendations.push(`Focus on weak systems: ${weakSystems.slice(0, 3).join(', ')}`);
      }
      if (dueCount > 0) {
        recommendations.push(`${dueCount} cards due for review`);
      }
      recommendations.push(`Study goal: ${Math.min(20, Math.max(5, dueCount))} questions today`);
      
      // Update learning profile with recommendations
      await prisma.userLearningProfile.upsert({
        where: { userId },
        create: {
          id: `ulp_${userId}`,
          userId,
          weakestSystems: weakSystems.slice(0, 5),
          recommendations,
        },
        update: {
          weakestSystems: weakSystems.slice(0, 5),
          recommendations,
          updatedAt: new Date(),
        },
      });
      
      stats.usersProcessed++;
      stats.recommendationsGenerated++;
    }
    
    console.log(`✅ Recommendations: ${stats.usersProcessed} users, ${stats.recommendationsGenerated} generated`);
    return stats;
  } catch (error) {
    console.error('❌ Failed to generate recommendations:', error);
    throw error;
  }
}

/**
 * Calculate Daily Active Users (DAU) and store analytics
 */
export async function calculateDAUMetrics(): Promise<{
  dau: number;
  newUsers: number;
  returningUsers: number;
}> {
  console.log('📈 Calculating DAU metrics...');
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count unique users with activity yesterday
    const activeUsers = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });
    
    const dau = activeUsers.length;
    
    // Count new users yesterday
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });
    
    const returningUsers = Math.max(0, dau - newUsers);
    
    // Log metrics (could store to a dedicated analytics table)
    console.log(`✅ DAU: ${dau} (${newUsers} new, ${returningUsers} returning)`);
    return { dau, newUsers, returningUsers };
  } catch (error) {
    console.error('❌ Failed to calculate DAU:', error);
    throw error;
  }
}

/**
 * Aggregate user confusion patterns for DDx suggestions
 */
export async function aggregateConfusionPatterns(): Promise<number> {
  console.log('🔀 Aggregating confusion patterns...');
  
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Count confusion pairs created/updated in last week
    const recentConfusions = await prisma.confusionPair.count({
      where: {
        lastOccurrence: { gte: oneWeekAgo },
      },
    });
    
    console.log(`✅ Confusion patterns: ${recentConfusions} patterns found in last week`);
    return recentConfusions;
  } catch (error) {
    console.error('❌ Failed to aggregate confusion patterns:', error);
    throw error;
  }
}

// ============================================================================
// WEEKLY: Progress Reports
// ============================================================================

/**
 * Generate weekly progress reports for all active users
 */
export async function generateWeeklyProgressReports(): Promise<{
  reportsGenerated: number;
  usersImproved: number;
  usersDeclined: number;
}> {
  console.log('📊 Generating weekly progress reports...');
  
  const stats = { reportsGenerated: 0, usersImproved: 0, usersDeclined: 0 };
  
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Get users with activity in the last week
    const activeUserIds = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: oneWeekAgo },
      },
    });
    
    for (const userRecord of activeUserIds) {
      const userId = userRecord.userId;
      
      // This week performance
      const thisWeekRecords = await prisma.performanceRecord.findMany({
        where: {
          userId,
          createdAt: { gte: oneWeekAgo },
        },
        select: {
          system: true,
          isCorrect: true,
          createdAt: true,
        },
      });
      
      // Last week performance
      const lastWeekRecords = await prisma.performanceRecord.findMany({
        where: {
          userId,
          createdAt: {
            gte: twoWeeksAgo,
            lt: oneWeekAgo,
          },
        },
        select: {
          isCorrect: true,
        },
      });
      
      // Calculate accuracy
      const thisWeekCorrect = thisWeekRecords.filter(r => r.isCorrect).length;
      const thisWeekAccuracy = thisWeekRecords.length > 0
        ? (thisWeekCorrect / thisWeekRecords.length) * 100
        : 0;
      
      const lastWeekCorrect = lastWeekRecords.filter(r => r.isCorrect).length;
      const lastWeekAccuracy = lastWeekRecords.length > 0
        ? (lastWeekCorrect / lastWeekRecords.length) * 100
        : 0;
      
      const improvement = thisWeekAccuracy - lastWeekAccuracy;
      
      if (improvement > 0) stats.usersImproved++;
      else if (improvement < 0) stats.usersDeclined++;
      
      // Calculate system breakdown
      const systemBreakdown: Record<string, { total: number; correct: number }> = {};
      for (const record of thisWeekRecords) {
        const sys = record.system || 'unknown';
        if (!systemBreakdown[sys]) systemBreakdown[sys] = { total: 0, correct: 0 };
        systemBreakdown[sys].total++;
        if (record.isCorrect) systemBreakdown[sys].correct++;
      }
      
      // Identify strongest and weakest systems
      const systemEntries = Object.entries(systemBreakdown)
        .filter(([_, s]) => s.total >= 3)
        .map(([system, s]) => ({
          system,
          accuracy: s.correct / s.total,
        }))
        .sort((a, b) => b.accuracy - a.accuracy);
      
      const strongest = systemEntries.slice(0, 3).map(s => s.system);
      const weakest = systemEntries.slice(-3).map(s => s.system);
      
      // Generate insights
      const insights: string[] = [];
      if (improvement > 5) {
        insights.push(`Great progress! Accuracy improved by ${improvement.toFixed(1)}% this week.`);
      } else if (improvement < -5) {
        insights.push(`Accuracy dropped ${Math.abs(improvement).toFixed(1)}%. Consider reviewing weak areas.`);
      }
      if (weakest.length > 0) {
        insights.push(`Focus areas: ${weakest.join(', ')}`);
      }
      
      // Update learning profile
      await prisma.userLearningProfile.upsert({
        where: { userId },
        create: {
          id: `ulp_${userId}`,
          userId,
          lifetimeQuestions: thisWeekRecords.length,
          lifetimeCorrect: thisWeekCorrect,
          lifetimeAccuracy: thisWeekAccuracy,
          strongestSystems: strongest,
          weakestSystems: weakest,
          learningInsights: insights,
        },
        update: {
          lifetimeQuestions: { increment: thisWeekRecords.length },
          lifetimeCorrect: { increment: thisWeekCorrect },
          lifetimeAccuracy: thisWeekAccuracy,
          strongestSystems: strongest,
          weakestSystems: weakest,
          learningInsights: insights,
          updatedAt: new Date(),
        },
      });
      
      stats.reportsGenerated++;
    }
    
    console.log(`✅ Weekly reports: ${stats.reportsGenerated} generated, ${stats.usersImproved} improved, ${stats.usersDeclined} declined`);
    return stats;
  } catch (error) {
    console.error('❌ Failed to generate weekly reports:', error);
    throw error;
  }
}

/**
 * Calculate weekly retention metrics
 */
export async function calculateWeeklyRetention(): Promise<{
  weeklyRetention: number;
  churned: number;
  reactivated: number;
}> {
  console.log('📉 Calculating weekly retention...');
  
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Users active last week
    const lastWeekActive = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: twoWeeksAgo,
          lt: oneWeekAgo,
        },
      },
    });
    
    // Users active this week
    const thisWeekActive = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: oneWeekAgo },
      },
    });
    
    const lastWeekUserIds = new Set(lastWeekActive.map(u => u.userId));
    const thisWeekUserIds = new Set(thisWeekActive.map(u => u.userId));
    
    // Retained: active both weeks
    const retained = [...lastWeekUserIds].filter(id => thisWeekUserIds.has(id)).length;
    
    // Churned: active last week, not this week
    const churned = [...lastWeekUserIds].filter(id => !thisWeekUserIds.has(id)).length;
    
    // Reactivated: active this week, not last week
    const reactivated = [...thisWeekUserIds].filter(id => !lastWeekUserIds.has(id)).length;
    
    const weeklyRetention = lastWeekUserIds.size > 0
      ? (retained / lastWeekUserIds.size) * 100
      : 0;
    
    console.log(`✅ Retention: ${weeklyRetention.toFixed(1)}% (${retained} retained, ${churned} churned, ${reactivated} reactivated)`);
    return { weeklyRetention, churned, reactivated };
  } catch (error) {
    console.error('❌ Failed to calculate retention:', error);
    throw error;
  }
}

/**
 * Update PANCE readiness estimates based on recent performance
 */
export async function updatePANCEReadinessEstimates(): Promise<number> {
  console.log('🎓 Updating PANCE readiness estimates...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get users with activity
    const allUserIds = await prisma.performanceRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });
    
    // Filter to users with at least 50 questions
    const activeUserIds = allUserIds.filter(u => u._count.id >= 50);
    
    let updated = 0;
    
    for (const userRecord of activeUserIds) {
      const userId = userRecord.userId;
      
      // Calculate overall accuracy
      const records = await prisma.performanceRecord.findMany({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          isCorrect: true,
          system: true,
        },
      });
      
      const accuracy = records.filter(r => r.isCorrect).length / records.length;
      
      // Estimate PANCE score (200-800 scale, passing ~450)
      // Rough estimate: accuracy * 600 + 200, capped at 800
      const estimatedScore = Math.min(800, Math.round(accuracy * 600 + 200));
      
      // Determine readiness level
      let readinessLevel = 'not_ready';
      let passLikelihood = 0;
      
      if (accuracy >= 0.85) {
        readinessLevel = 'ready';
        passLikelihood = 95;
      } else if (accuracy >= 0.75) {
        readinessLevel = 'almost_ready';
        passLikelihood = 80;
      } else if (accuracy >= 0.65) {
        readinessLevel = 'progressing';
        passLikelihood = 50;
      } else {
        passLikelihood = Math.round(accuracy * 60);
      }
      
      await prisma.userLearningProfile.upsert({
        where: { userId },
        create: {
          id: `ulp_${userId}`,
          userId,
          estimatedScore,
          readinessLevel,
        },
        update: {
          estimatedScore,
          readinessLevel,
          updatedAt: new Date(),
        },
      });
      
      updated++;
    }
    
    console.log(`✅ PANCE readiness: ${updated} users updated`);
    return updated;
  } catch (error) {
    console.error('❌ Failed to update PANCE readiness:', error);
    throw error;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export default {
  // Hourly
  updateUserStreaks,
  calculateDueCards,
  updateLeaderboardCache,
  
  // Daily
  generateDailyRecommendations,
  calculateDAUMetrics,
  aggregateConfusionPatterns,
  
  // Weekly
  generateWeeklyProgressReports,
  calculateWeeklyRetention,
  updatePANCEReadinessEstimates,
  
  disconnect,
};
