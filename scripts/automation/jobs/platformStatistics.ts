/**
 * Platform Statistics Job
 * 
 * Sprint: Statistics Improvement Plan - Step 1
 * Schedule: Daily at 2 AM UTC
 * 
 * Collects platform-wide metrics and stores in PlatformStatistics table:
 * - Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
 * - Retention rates (7-day, 30-day)
 * - Question answering metrics
 * - Session metrics
 * - FSRS card metrics
 * 
 * This enables historical trend tracking and fast dashboard loading.
 */

import { PrismaClient } from '@prisma/client';
import { disconnectPrisma, prisma } from '../../helpers/prisma-client';

/**
 * Calculate date ranges for different time windows
 */
function getDateRanges(targetDate: Date) {
  const today = new Date(targetDate);
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  
  return { today, yesterday, weekAgo, monthAgo };
}

/**
 * Calculate DAU/WAU/MAU from QuestionAttempt data
 */
async function calculateActiveUsers(prisma: PrismaClient, ranges: ReturnType<typeof getDateRanges>) {
  const { today, weekAgo, monthAgo } = ranges;
  
  // DAU: Users who attempted questions yesterday
  const dauResult = await prisma.questionAttempt.groupBy({
    by: ['userId'],
    where: {
      createdAt: {
        gte: ranges.yesterday,
        lt: today,
      },
    },
  });
  const dau = dauResult.length;
  
  // WAU: Users who attempted questions in last 7 days
  const wauResult = await prisma.questionAttempt.groupBy({
    by: ['userId'],
    where: {
      createdAt: {
        gte: weekAgo,
        lt: today,
      },
    },
  });
  const wau = wauResult.length;
  
  // MAU: Users who attempted questions in last 30 days
  const mauResult = await prisma.questionAttempt.groupBy({
    by: ['userId'],
    where: {
      createdAt: {
        gte: monthAgo,
        lt: today,
      },
    },
  });
  const mau = mauResult.length;
  
  return { dau, wau, mau };
}

/**
 * Calculate new vs. returning users
 */
async function calculateUserCohorts(prisma: PrismaClient, ranges: ReturnType<typeof getDateRanges>) {
  const { today, yesterday } = ranges;
  
  // Get users active yesterday
  const activeUserIds = await prisma.questionAttempt.findMany({
    where: {
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  
  let newUsers = 0;
  let returningUsers = 0;
  
  // Check if each user had activity before yesterday
  for (const { userId } of activeUserIds) {
    const priorActivity = await prisma.questionAttempt.findFirst({
      where: {
        userId,
        createdAt: { lt: yesterday },
      },
    });
    
    if (priorActivity) {
      returningUsers++;
    } else {
      newUsers++;
    }
  }
  
  return { newUsers, returningUsers };
}

/**
 * Calculate retention rates
 */
async function calculateRetention(prisma: PrismaClient, ranges: ReturnType<typeof getDateRanges>) {
  const { today, yesterday, weekAgo, monthAgo } = ranges;
  
  // 7-day retention: Users active 7 days ago who were also active yesterday
  const users7DaysAgo = await prisma.questionAttempt.findMany({
    where: {
      createdAt: {
        gte: weekAgo,
        lt: new Date(weekAgo.getTime() + 24 * 60 * 60 * 1000), // 7 days ago + 1 day
      },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  
  let retained7Day = 0;
  for (const { userId } of users7DaysAgo) {
    const recentActivity = await prisma.questionAttempt.findFirst({
      where: {
        userId,
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });
    if (recentActivity) retained7Day++;
  }
  
  const retention7Day = users7DaysAgo.length > 0 
    ? retained7Day / users7DaysAgo.length 
    : null;
  
  // 30-day retention: Users active 30 days ago who were also active yesterday
  const users30DaysAgo = await prisma.questionAttempt.findMany({
    where: {
      createdAt: {
        gte: monthAgo,
        lt: new Date(monthAgo.getTime() + 24 * 60 * 60 * 1000), // 30 days ago + 1 day
      },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  
  let retained30Day = 0;
  for (const { userId } of users30DaysAgo) {
    const recentActivity = await prisma.questionAttempt.findFirst({
      where: {
        userId,
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });
    if (recentActivity) retained30Day++;
  }
  
  const retention30Day = users30DaysAgo.length > 0 
    ? retained30Day / users30DaysAgo.length 
    : null;
  
  return { retention7Day, retention30Day };
}

/**
 * Calculate question answering metrics
 */
async function calculateQuestionMetrics(prisma: PrismaClient, ranges: ReturnType<typeof getDateRanges>) {
  const { today, yesterday } = ranges;
  
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    },
  });
  
  const questionsAnswered = attempts.length;
  const questionsCorrect = attempts.filter(a => a.wasCorrect).length;
  const questionsIncorrect = questionsAnswered - questionsCorrect;
  const averageAccuracy = questionsAnswered > 0 
    ? questionsCorrect / questionsAnswered 
    : null;
  
  return {
    questionsAnswered,
    questionsCorrect,
    questionsIncorrect,
    averageAccuracy,
  };
}

/**
 * Calculate session metrics
 */
async function calculateSessionMetrics(prisma: PrismaClient, ranges: ReturnType<typeof getDateRanges>) {
  const { today, yesterday } = ranges;
  
  const sessions = await prisma.studySession.findMany({
    where: {
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    },
  });
  
  const sessionsStarted = sessions.length;
  const sessionsCompleted = sessions.filter(s => s.status === 'completed').length;
  
  const durations = sessions
    .filter(s => s.durationMs && s.durationMs > 0)
    .map(s => s.durationMs!);
  
  const averageSessionDuration = durations.length > 0
    ? Math.floor(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : null;
  
  const totalStudyTime = durations.reduce((sum, d) => sum + d, 0);
  
  return {
    sessionsStarted,
    sessionsCompleted,
    averageSessionDuration,
    totalStudyTime,
  };
}

/**
 * Calculate FSRS card metrics
 */
async function calculateFSRSMetrics(prisma: PrismaClient, ranges: ReturnType<typeof getDateRanges>) {
  const { today, yesterday } = ranges;
  
  // Get all user progress records updated yesterday
  const progressRecords = await prisma.userProgress.findMany({
    where: {
      updatedAt: {
        gte: yesterday,
        lt: today,
      },
    },
    select: {
      fsrsCard: true,
    },
  });
  
  let fsrsCardsReviewed = 0;
  let fsrsCardsMature = 0;
  let totalRetention = 0;
  let retentionCount = 0;
  
  for (const record of progressRecords) {
    if (record.fsrsCard && typeof record.fsrsCard === 'object') {
      const card = record.fsrsCard as any;
      
      // Count as reviewed if it has a due date or reps
      if (card.reps !== undefined && card.reps > 0) {
        fsrsCardsReviewed++;
      }
      
      // Count as mature if stability > 21 days
      if (card.stability !== undefined && card.stability > 21) {
        fsrsCardsMature++;
      }
      
      // Calculate retention (approximation based on stability)
      if (card.stability !== undefined && card.stability > 0) {
        // Simple retention approximation: stability / (stability + 1)
        const retention = card.stability / (card.stability + 1);
        totalRetention += retention;
        retentionCount++;
      }
    }
  }
  
  const fsrsAverageRetention = retentionCount > 0
    ? totalRetention / retentionCount
    : null;
  
  return {
    fsrsCardsReviewed,
    fsrsCardsMature,
    fsrsAverageRetention,
  };
}

/**
 * Main job function
 */
export async function runPlatformStatisticsJob(targetDate: Date = new Date()) {
  console.log('🚀 Platform Statistics Job Starting...');
  console.log(`📅 Target Date: ${targetDate.toISOString().split('T')[0]}`);
  
  try {
    const ranges = getDateRanges(targetDate);
    const dateString = ranges.yesterday.toISOString().split('T')[0];
    
    console.log('\n📊 Calculating metrics...');
    
    // Calculate all metrics in parallel
    const [
      activeUsers,
      userCohorts,
      retention,
      questionMetrics,
      sessionMetrics,
      fsrsMetrics,
    ] = await Promise.all([
      calculateActiveUsers(prisma, ranges),
      calculateUserCohorts(prisma, ranges),
      calculateRetention(prisma, ranges),
      calculateQuestionMetrics(prisma, ranges),
      calculateSessionMetrics(prisma, ranges),
      calculateFSRSMetrics(prisma, ranges),
    ]);
    
    console.log('\n✅ Metrics calculated:');
    console.log(`   DAU: ${activeUsers.dau}`);
    console.log(`   WAU: ${activeUsers.wau}`);
    console.log(`   MAU: ${activeUsers.mau}`);
    console.log(`   New Users: ${userCohorts.newUsers}`);
    console.log(`   Returning Users: ${userCohorts.returningUsers}`);
    console.log(`   Questions Answered: ${questionMetrics.questionsAnswered}`);
    console.log(`   Average Accuracy: ${questionMetrics.averageAccuracy ? (questionMetrics.averageAccuracy * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`   Sessions Started: ${sessionMetrics.sessionsStarted}`);
    console.log(`   FSRS Cards Reviewed: ${fsrsMetrics.fsrsCardsReviewed}`);
    
    // Upsert platform statistics
    const stats = await prisma.platformStatistics.upsert({
      where: { date: ranges.yesterday },
      create: {
        id: `platform_${dateString}`,
        date: ranges.yesterday,
        dau: activeUsers.dau,
        wau: activeUsers.wau,
        mau: activeUsers.mau,
        newUsers: userCohorts.newUsers,
        returningUsers: userCohorts.returningUsers,
        retention7Day: retention.retention7Day,
        retention30Day: retention.retention30Day,
        questionsAnswered: questionMetrics.questionsAnswered,
        questionsCorrect: questionMetrics.questionsCorrect,
        questionsIncorrect: questionMetrics.questionsIncorrect,
        averageAccuracy: questionMetrics.averageAccuracy,
        sessionsStarted: sessionMetrics.sessionsStarted,
        sessionsCompleted: sessionMetrics.sessionsCompleted,
        averageSessionDuration: sessionMetrics.averageSessionDuration,
        totalStudyTime: sessionMetrics.totalStudyTime,
        fsrsCardsReviewed: fsrsMetrics.fsrsCardsReviewed,
        fsrsCardsMature: fsrsMetrics.fsrsCardsMature,
        fsrsAverageRetention: fsrsMetrics.fsrsAverageRetention,
      },
      update: {
        dau: activeUsers.dau,
        wau: activeUsers.wau,
        mau: activeUsers.mau,
        newUsers: userCohorts.newUsers,
        returningUsers: userCohorts.returningUsers,
        retention7Day: retention.retention7Day,
        retention30Day: retention.retention30Day,
        questionsAnswered: questionMetrics.questionsAnswered,
        questionsCorrect: questionMetrics.questionsCorrect,
        questionsIncorrect: questionMetrics.questionsIncorrect,
        averageAccuracy: questionMetrics.averageAccuracy,
        sessionsStarted: sessionMetrics.sessionsStarted,
        sessionsCompleted: sessionMetrics.sessionsCompleted,
        averageSessionDuration: sessionMetrics.averageSessionDuration,
        totalStudyTime: sessionMetrics.totalStudyTime,
        fsrsCardsReviewed: fsrsMetrics.fsrsCardsReviewed,
        fsrsCardsMature: fsrsMetrics.fsrsCardsMature,
        fsrsAverageRetention: fsrsMetrics.fsrsAverageRetention,
      },
    });
    
    console.log('\n✅ Platform statistics saved successfully!');
    console.log(`   ID: ${stats.id}`);
    console.log(`   Date: ${stats.date}`);
    
  } catch (error) {
    console.error('❌ Platform statistics job failed:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

// Run if called directly
if (require.main === module) {
  runPlatformStatisticsJob()
    .then(() => {
      console.log('\n✅ Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Job failed:', error);
      process.exit(1);
    });
}
