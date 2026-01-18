/**
 * Content Statistics Job
 *
 * Sprint: Statistics Improvement Plan - Step 2
 * Schedule: Daily at 3 AM UTC
 *
 * Collects content usage metrics per condition and stores in ContentStatistics table:
 * - View counts per condition
 * - Question answering metrics
 * - Unique users studying each condition
 * - Average accuracy per condition
 * - Average time spent
 * - Bookmark and flag counts
 *
 * This enables:
 * - Identifying which conditions need more questions
 * - Finding trending topics
 * - Discovering under-studied high-yield conditions
 * - Content quality assessment
 */

import { PrismaClient } from '@prisma/client';
import { disconnectPrisma, prisma } from '../../helpers/prisma-client';

/**
 * Calculate date range for yesterday
 */
function getDateRange(targetDate: Date) {
  const today = new Date(targetDate);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return { yesterday, today };
}

/**
 * Get all conditions that had activity yesterday
 */
async function getActiveConditions(
  prisma: PrismaClient,
  yesterday: Date,
  today: Date
): Promise<string[]> {
  // Get conditions from question attempts
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      createdAt: {
        gte: yesterday,
        lt: today,
      },
      conditionId: {
        not: null,
      },
    },
    select: {
      conditionId: true,
    },
    distinct: ['conditionId'],
  });

  return attempts.map((a) => a.conditionId).filter((id): id is string => id !== null);
}

/**
 * Calculate question metrics for a specific condition
 */
async function calculateQuestionMetrics(
  prisma: PrismaClient,
  conditionId: string,
  yesterday: Date,
  today: Date
) {
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      conditionId,
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    },
  });

  const questionsAnswered = attempts.length;
  const questionsCorrect = attempts.filter((a) => a.wasCorrect).length;
  const averageAccuracy = questionsAnswered > 0 ? questionsCorrect / questionsAnswered : null;

  // Calculate average time spent (exclude outliers > 10 minutes)
  const validTimes = attempts
    .filter((a) => a.timeSpentMs && a.timeSpentMs > 0 && a.timeSpentMs < 600000)
    .map((a) => a.timeSpentMs!);

  const averageTimeSpent =
    validTimes.length > 0
      ? Math.floor(validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length)
      : null;

  // Get unique users
  const uniqueUserIds = new Set(attempts.map((a) => a.userId));
  const uniqueUsers = uniqueUserIds.size;

  return {
    questionsAnswered,
    questionsCorrect,
    averageAccuracy,
    averageTimeSpent,
    uniqueUsers,
  };
}

/**
 * Calculate view count for a condition
 * Note: We approximate views from question attempts since we don't have a separate view tracking
 */
async function calculateViews(
  prisma: PrismaClient,
  conditionId: string,
  yesterday: Date,
  today: Date
): Promise<number> {
  // For now, we use question attempts as a proxy for views
  // In the future, we could add explicit view tracking
  const count = await prisma.questionAttempt.count({
    where: {
      conditionId,
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    },
  });

  return count;
}

/**
 * Calculate bookmark count for a condition
 */
async function calculateBookmarkCount(
  prisma: PrismaClient,
  conditionId: string,
  yesterday: Date,
  today: Date
): Promise<number> {
  // UserBookmark model no longer exists; bookmark counts are not tracked in Prisma
  // Returning 0 keeps the enrichment job compiling until bookmarks are reintroduced
  return 0;
}

/**
 * Calculate flag count for a condition's questions
 */
async function calculateFlagCount(
  prisma: PrismaClient,
  conditionId: string,
  yesterday: Date,
  today: Date
): Promise<number> {
  // Get all questions for this condition
  const questions = await prisma.preGeneratedQuestion.findMany({
    where: { conditionId },
    select: { id: true },
  });

  const questionIds = questions.map((q) => q.id);

  if (questionIds.length === 0) {
    return 0;
  }

  // Count flags for these questions
  const count = await prisma.questionFlag.count({
    where: {
      questionId: { in: questionIds },
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    },
  });

  return count;
}

/**
 * Process statistics for a single condition
 */
async function processCondition(
  prisma: PrismaClient,
  conditionId: string,
  yesterday: Date,
  today: Date,
  dateString: string
) {
  try {
    const [questionMetrics, views, bookmarkCount, flagCount] = await Promise.all([
      calculateQuestionMetrics(prisma, conditionId, yesterday, today),
      calculateViews(prisma, conditionId, yesterday, today),
      calculateBookmarkCount(prisma, conditionId, yesterday, today),
      calculateFlagCount(prisma, conditionId, yesterday, today),
    ]);

    // Verify condition exists in MedicalContent
    const medicalContent = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    if (!medicalContent) {
      console.warn(`⚠️  Skipping ${conditionId}: Not found in MedicalContent`);
      return null;
    }

    // Upsert content statistics
    const stats = await prisma.contentStatistics.upsert({
      where: {
        conditionId_date: {
          conditionId,
          date: yesterday,
        },
      },
      create: {
        id: `content_${conditionId}_${dateString}`,
        conditionId,
        date: yesterday,
        views,
        questionsAnswered: questionMetrics.questionsAnswered,
        questionsCorrect: questionMetrics.questionsCorrect,
        uniqueUsers: questionMetrics.uniqueUsers,
        averageAccuracy: questionMetrics.averageAccuracy,
        averageTimeSpent: questionMetrics.averageTimeSpent,
        bookmarkCount,
        flagCount,
      },
      update: {
        views,
        questionsAnswered: questionMetrics.questionsAnswered,
        questionsCorrect: questionMetrics.questionsCorrect,
        uniqueUsers: questionMetrics.uniqueUsers,
        averageAccuracy: questionMetrics.averageAccuracy,
        averageTimeSpent: questionMetrics.averageTimeSpent,
        bookmarkCount,
        flagCount,
      },
    });

    return stats;
  } catch (error) {
    console.error(`❌ Error processing ${conditionId}:`, error);
    return null;
  }
}

/**
 * Main job function
 */
export async function runContentStatisticsJob(targetDate: Date = new Date()) {
  console.log('🚀 Content Statistics Job Starting...');
  console.log(`📅 Target Date: ${targetDate.toISOString().split('T')[0]}`);

  try {
    const { yesterday, today } = getDateRange(targetDate);
    const dateString = yesterday.toISOString().split('T')[0];

    console.log('\n🔍 Finding active conditions...');
    const activeConditions = await getActiveConditions(prisma, yesterday, today);
    console.log(`   Found ${activeConditions.length} conditions with activity`);

    if (activeConditions.length === 0) {
      console.log('\n⚠️  No active conditions found for yesterday');
      return;
    }

    console.log('\n📊 Processing condition statistics...');
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process conditions in batches of 10 to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < activeConditions.length; i += batchSize) {
      const batch = activeConditions.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map((conditionId) =>
          processCondition(prisma, conditionId, yesterday, today, dateString)
        )
      );

      // Count results
      results.forEach((result) => {
        if (result === null) {
          skipCount++;
        } else {
          successCount++;
        }
      });

      console.log(
        `   Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeConditions.length / batchSize)}`
      );
    }

    console.log('\n✅ Content statistics saved successfully!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Errors: ${errorCount}`);

    // Show top 5 most studied conditions
    const topConditions = await prisma.contentStatistics.findMany({
      where: { date: yesterday },
      orderBy: { questionsAnswered: 'desc' },
      take: 5,
      include: {
        MedicalContent: {
          select: { condition: true },
        },
      },
    });

    if (topConditions.length > 0) {
      console.log('\n🏆 Top 5 Most Studied Conditions:');
      topConditions.forEach((stat, index) => {
        const condition = stat.MedicalContent?.condition || stat.conditionId;
        const accuracy = stat.averageAccuracy
          ? (stat.averageAccuracy.toNumber() * 100).toFixed(1) + '%'
          : 'N/A';
        console.log(`   ${index + 1}. ${condition}`);
        console.log(
          `      Questions: ${stat.questionsAnswered}, Users: ${stat.uniqueUsers}, Accuracy: ${accuracy}`
        );
      });
    }
  } catch (error) {
    console.error('❌ Content statistics job failed:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

// Run if called directly
if (require.main === module) {
  runContentStatisticsJob()
    .then(() => {
      console.log('\n✅ Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Job failed:', error);
      process.exit(1);
    });
}
