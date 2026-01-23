/**
 * FSRS Parameter Optimization Automation Jobs
 *
 * Weekly batch optimization of FSRS v6 parameters for all eligible users.
 * Uses L-BFGS algorithm to minimize Brier score and personalize retention.
 *
 * @module fsrsOptimization
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import {
  runFullOptimization,
  canOptimize,
  validateParameters,
  MIN_REVIEWS_FOR_OPTIMIZATION,
  type PersonalizedFSRSParams as OptimizedParams,
} from '../../../lib/fsrs-optimizer';
import { type ReviewSnapshot } from '../../../lib/fsrs';

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

/** Minimum days between optimizations */
const MIN_DAYS_BETWEEN_OPTIMIZATION = 7;

/** Minimum new reviews required to trigger re-optimization */
const MIN_NEW_REVIEWS_FOR_REOPTIMIZATION = 50;

/** Batch size for processing users */
const BATCH_SIZE = 25;

/** Maximum users to process per run (prevent timeout) */
const MAX_USERS_PER_RUN = 100;

// ============================================================================
// Weekly Jobs
// ============================================================================

/**
 * Optimize FSRS parameters for all eligible users
 *
 * Eligibility criteria:
 * - Has at least 100 reviews
 * - Either never optimized OR (>7 days since last optimization AND >50 new reviews)
 *
 * @returns Statistics about the optimization run
 */
export async function optimizeAllUsersFSRS(): Promise<{
  eligible: number;
  processed: number;
  optimized: number;
  skipped: number;
  failed: number;
  avgImprovement: number;
}> {
  console.log('🧠 [FSRS Optimization] Starting weekly parameter optimization...');

  const stats = {
    eligible: 0,
    processed: 0,
    optimized: 0,
    skipped: 0,
    failed: 0,
    totalImprovement: 0,
  };

  try {
    // Find users eligible for optimization
    const eligibleUsers = await findEligibleUsers();
    stats.eligible = eligibleUsers.length;

    console.log(`📊 [FSRS Optimization] Found ${stats.eligible} eligible users`);

    if (stats.eligible === 0) {
      console.log('✅ [FSRS Optimization] No users need optimization');
      return { ...stats, avgImprovement: 0 };
    }

    // Process in batches
    for (
      let i = 0;
      i < eligibleUsers.length && stats.processed < MAX_USERS_PER_RUN;
      i += BATCH_SIZE
    ) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
      console.log(`🔄 [FSRS Optimization] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

      await Promise.all(
        batch.map(async (user) => {
          try {
            const result = await optimizeUserFSRS(
              user.userId,
              user.reviewCount,
              user.lastOptimizedAt
            );
            stats.processed++;

            if (result.optimized) {
              stats.optimized++;
              stats.totalImprovement += result.improvement;
            } else {
              stats.skipped++;
            }
          } catch (error) {
            stats.processed++;
            stats.failed++;
            console.error(`❌ [FSRS Optimization] Failed for user ${user.userId}:`, error);
          }
        })
      );
    }

    const avgImprovement = stats.optimized > 0 ? stats.totalImprovement / stats.optimized : 0;

    console.log(`✅ [FSRS Optimization] Complete!`);
    console.log(`   📈 Optimized: ${stats.optimized}/${stats.processed} users`);
    console.log(`   ⏭️  Skipped: ${stats.skipped}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    console.log(`   📊 Avg Improvement: ${avgImprovement.toFixed(1)}%`);

    return { ...stats, avgImprovement };
  } catch (error) {
    console.error('❌ [FSRS Optimization] Fatal error:', error);
    throw error;
  }
}

/**
 * Generate optimization status report
 *
 * @returns Report statistics
 */
export async function generateOptimizationReport(): Promise<{
  totalUsers: number;
  optimizedUsers: number;
  eligibleUsers: number;
  averageBrierScore: number;
  averageImprovement: number;
  systemsAnalyzed: number;
}> {
  console.log('📊 [FSRS Optimization] Generating optimization status report...');

  const [totalUsers, optimizedParams, eligibleUsers] = await Promise.all([
    prisma.user.count(),
    prisma.personalizedFSRSParams.findMany({
      select: {
        brierScore: true,
        improvementOverDefault: true,
        systemModifiers: true,
      },
    }),
    findEligibleUsers(),
  ]);

  const optimizedUsers = optimizedParams.length;

  const averageBrierScore =
    optimizedUsers > 0
      ? optimizedParams.reduce((sum, p) => sum + (p.brierScore ?? 0), 0) / optimizedUsers
      : 0;

  const averageImprovement =
    optimizedUsers > 0
      ? optimizedParams.reduce((sum, p) => sum + (p.improvementOverDefault ?? 0), 0) /
        optimizedUsers
      : 0;

  const systemsAnalyzed = optimizedParams.reduce((count, p) => {
    if (p.systemModifiers && typeof p.systemModifiers === 'object') {
      return count + Object.keys(p.systemModifiers).length;
    }
    return count;
  }, 0);

  const report = {
    totalUsers,
    optimizedUsers,
    eligibleUsers: eligibleUsers.length,
    averageBrierScore: Math.round(averageBrierScore * 10000) / 10000,
    averageImprovement: Math.round(averageImprovement * 10) / 10,
    systemsAnalyzed,
  };

  console.log(`✅ [FSRS Optimization] Report generated:`);
  console.log(`   👥 Total Users: ${report.totalUsers}`);
  console.log(`   ✨ Optimized: ${report.optimizedUsers}`);
  console.log(`   🎯 Eligible for optimization: ${report.eligibleUsers}`);
  console.log(`   📉 Avg Brier Score: ${report.averageBrierScore}`);
  console.log(`   📈 Avg Improvement: ${report.averageImprovement}%`);

  return report;
}

/**
 * Clean up stale optimization data
 * Removes optimization records for deleted users
 *
 * @returns Number of records cleaned
 */
export async function cleanupStaleOptimizations(): Promise<{ cleaned: number }> {
  console.log('🧹 [FSRS Optimization] Cleaning up stale optimization records...');

  // Find optimization records for users that no longer exist
  const staleRecords = await prisma.personalizedFSRSParams.findMany({
    where: {
      user: null, // User was deleted
    },
    select: { id: true },
  });

  if (staleRecords.length > 0) {
    await prisma.personalizedFSRSParams.deleteMany({
      where: {
        id: { in: staleRecords.map((r) => r.id) },
      },
    });
  }

  console.log(`✅ [FSRS Optimization] Cleaned ${staleRecords.length} stale records`);

  return { cleaned: staleRecords.length };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface EligibleUser {
  userId: string;
  reviewCount: number;
  lastOptimizedAt: Date | null;
}

/**
 * Find users eligible for FSRS optimization
 */
async function findEligibleUsers(): Promise<EligibleUser[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MIN_DAYS_BETWEEN_OPTIMIZATION);

  // Get users with enough reviews
  const usersWithReviews = await prisma.userProgress.groupBy({
    by: ['userId'],
    _count: { id: true },
    having: {
      id: { _count: { gte: MIN_REVIEWS_FOR_OPTIMIZATION } },
    },
  });

  if (usersWithReviews.length === 0) {
    return [];
  }

  const userIds = usersWithReviews.map((u) => u.userId);

  // Get existing optimization records
  const existingOptimizations = await prisma.personalizedFSRSParams.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, lastOptimizedAt: true, sampleSize: true },
  });

  const optimizationMap = new Map(existingOptimizations.map((o) => [o.userId, o]));

  // Get current review counts
  const reviewCounts = await prisma.reviewLog.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds } },
    _count: { id: true },
  });

  const reviewCountMap = new Map(reviewCounts.map((r) => [r.userId, r._count.id]));

  // Filter eligible users
  const eligible: EligibleUser[] = [];

  for (const user of usersWithReviews) {
    const existing = optimizationMap.get(user.userId);
    const currentReviewCount = reviewCountMap.get(user.userId) ?? 0;

    // Check eligibility
    const { canOptimize: hasEnoughReviews } = canOptimize(currentReviewCount);

    if (!hasEnoughReviews) continue;

    // Never optimized = eligible
    if (!existing) {
      eligible.push({
        userId: user.userId,
        reviewCount: currentReviewCount,
        lastOptimizedAt: null,
      });
      continue;
    }

    // Check if enough time has passed
    const daysSinceOptimization = existing.lastOptimizedAt
      ? (Date.now() - existing.lastOptimizedAt.getTime()) / 86400000
      : Infinity;

    if (daysSinceOptimization < MIN_DAYS_BETWEEN_OPTIMIZATION) continue;

    // Check if enough new reviews
    const newReviews = currentReviewCount - (existing.sampleSize ?? 0);
    if (newReviews < MIN_NEW_REVIEWS_FOR_REOPTIMIZATION) continue;

    eligible.push({
      userId: user.userId,
      reviewCount: currentReviewCount,
      lastOptimizedAt: existing.lastOptimizedAt,
    });
  }

  // Sort by never optimized first, then by most reviews
  eligible.sort((a, b) => {
    if (!a.lastOptimizedAt && b.lastOptimizedAt) return -1;
    if (a.lastOptimizedAt && !b.lastOptimizedAt) return 1;
    return b.reviewCount - a.reviewCount;
  });

  return eligible.slice(0, MAX_USERS_PER_RUN);
}

/**
 * Optimize FSRS parameters for a single user
 */
async function optimizeUserFSRS(
  userId: string,
  _reviewCount: number,
  _lastOptimizedAt: Date | null
): Promise<{ optimized: boolean; improvement: number }> {
  // Fetch user's review history with system codes
  const userProgress = await prisma.userProgress.findMany({
    where: { userId },
    select: {
      reviewHistory: true,
      medicalContent: {
        select: { systemCode: true },
      },
    },
    orderBy: { updatedAt: 'asc' },
  });

  if (userProgress.length === 0) {
    return { optimized: false, improvement: 0 };
  }

  // Aggregate all review snapshots
  const allSnapshots: ReviewSnapshot[] = [];
  const systemCodes: Record<number, string> = {};
  let snapshotIndex = 0;

  for (const progress of userProgress) {
    const history = progress.reviewHistory as ReviewSnapshot[] | null;
    if (!history || !Array.isArray(history)) continue;

    for (const snapshot of history) {
      allSnapshots.push(snapshot);
      if (progress.medicalContent?.systemCode) {
        systemCodes[snapshotIndex] = progress.medicalContent.systemCode;
      }
      snapshotIndex++;
    }
  }

  // Run optimization
  const result = await runFullOptimization(userId, allSnapshots, systemCodes);

  // Validate results
  const validation = validateParameters(result.w);
  if (!validation.valid) {
    console.warn(
      `⚠️ [FSRS Optimization] Invalid parameters for user ${userId}:`,
      validation.errors
    );
    return { optimized: false, improvement: 0 };
  }

  // Upsert to database
  await prisma.personalizedFSRSParams.upsert({
    where: { userId },
    create: {
      userId,
      w: result.w,
      sampleSize: result.sampleSize,
      lastOptimizedAt: result.lastOptimizedAt,
      improvementOverDefault: result.improvementOverDefault,
      brierScore: result.brierScore,
      validationBrierScore: result.defaultBrierScore,
      systemModifiers: result.systemModifiers ?? undefined,
    },
    update: {
      w: result.w,
      sampleSize: result.sampleSize,
      lastOptimizedAt: result.lastOptimizedAt,
      improvementOverDefault: result.improvementOverDefault,
      brierScore: result.brierScore,
      validationBrierScore: result.defaultBrierScore,
      systemModifiers: result.systemModifiers ?? undefined,
    },
  });

  return {
    optimized: true,
    improvement: result.improvementOverDefault,
  };
}

// ============================================================================
// Lifecycle
// ============================================================================

/**
 * Disconnect from database
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Weekly jobs
  optimizeAllUsersFSRS,
  generateOptimizationReport,
  cleanupStaleOptimizations,

  // Lifecycle
  disconnect,
};
