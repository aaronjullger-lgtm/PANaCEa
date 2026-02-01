#!/usr/bin/env tsx
/**
 * FSRS v6 Parameter Optimizer
 *
 * This script reads user review history from the database and calculates
 * personalized FSRS parameters (21 weights) using L-BFGS optimization.
 *
 * Usage:
 *   npm run optimize-params [userId]
 *   tsx scripts/optimize-params.ts [userId]
 *
 * If no userId is provided, optimizes for all users with sufficient data.
 */

// CRITICAL: Import env-loader FIRST to ensure DATABASE_URL is loaded
// before any module that depends on it (especially lib/prisma.ts)
import './env-loader';

import {
  runFullOptimization,
  MIN_REVIEWS_FOR_OPTIMIZATION,
  type ReviewSnapshot,
  type PersonalizedFSRSParams,
} from '../lib/fsrs-optimizer';
import { prisma, disconnectPrisma } from '../lib/prisma';

// Use the prisma singleton from lib/prisma.ts which handles:
// - Development: PG Adapter for WASM engine compatibility
// - Production: Accelerate extension for Edge runtime
// This avoids PrismaClientInitializationError in Prisma 7

interface UserProgressRecord {
  id: string;
  userId: string;
  conditionId: string;
  reviewHistory: ReviewSnapshot[];
  totalAttempts: number;
}

/**
 * Fetch all review history for a specific user
 */
async function fetchUserReviewHistory(userId: string): Promise<ReviewSnapshot[]> {
  const userProgressRecords = await prisma.userProgress.findMany({
    where: { userId },
    select: {
      reviewHistory: true,
      totalAttempts: true,
    },
  });

  // Flatten all review snapshots from all conditions
  const allSnapshots: ReviewSnapshot[] = [];

  for (const record of userProgressRecords) {
    if (Array.isArray(record.reviewHistory)) {
      // Type assertion: Prisma returns Json but we know it's ReviewSnapshot[]
      const snapshots = record.reviewHistory as unknown as ReviewSnapshot[];
      allSnapshots.push(...snapshots);
    }
  }

  return allSnapshots;
}

/**
 * Save optimized parameters to database
 */
async function saveOptimizedParams(params: PersonalizedFSRSParams): Promise<void> {
  await prisma.personalizedFSRSParams.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      w: params.w,
      sampleSize: params.sampleSize,
      lastOptimizedAt: params.lastOptimizedAt,
      improvementOverDefault: params.improvementOverDefault,
      optimizationIterations: params.iterations,
      systemModifiers: params.systemModifiers || {},
    },
    update: {
      w: params.w,
      sampleSize: params.sampleSize,
      lastOptimizedAt: params.lastOptimizedAt,
      improvementOverDefault: params.improvementOverDefault,
      optimizationIterations: params.iterations,
      systemModifiers: params.systemModifiers || {},
    },
  });
}

/**
 * Optimize FSRS parameters for a single user
 */
async function optimizeUserParams(userId: string): Promise<boolean> {
  console.log(`\n🔬 Optimizing FSRS parameters for user: ${userId}`);

  // Fetch review history
  const reviewHistory = await fetchUserReviewHistory(userId);

  if (reviewHistory.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
    console.log(
      `⚠️  Insufficient data: ${reviewHistory.length} reviews (minimum: ${MIN_REVIEWS_FOR_OPTIMIZATION})`
    );
    return false;
  }

  console.log(`✓ Found ${reviewHistory.length} review records`);
  console.log(`🧮 Running L-BFGS optimization...`);

  // Run optimization
  const startTime = Date.now();
  const result = await runFullOptimization(userId, reviewHistory);

  if (!result) {
    console.log(`❌ Optimization failed`);
    return false;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Save to database
  await saveOptimizedParams(result);

  // Display results
  console.log(`\n✅ Optimization complete in ${duration}s`);
  console.log(`📊 Results:`);
  console.log(`   Sample Size: ${result.sampleSize} reviews`);
  console.log(`   Brier Score: ${result.brierScore.toFixed(4)} (lower is better)`);
  console.log(`   Default Brier: ${result.defaultBrierScore.toFixed(4)}`);
  console.log(`   Improvement: ${(result.improvementOverDefault * 100).toFixed(2)}%`);
  console.log(`   Iterations: ${result.iterations}`);

  if (result.systemModifiers) {
    console.log(`   System Modifiers: ${Object.keys(result.systemModifiers).length} systems`);
  }

  console.log(`\n📝 Optimized Parameters (w[0]-w[20]):`);
  console.log(`   ${result.w.map((v) => v.toFixed(4)).join(', ')}`);

  return true;
}

/**
 * Find all users with sufficient review data
 */
async function findOptimizableUsers(): Promise<string[]> {
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  const optimizableUsers: string[] = [];

  for (const user of users) {
    const reviewHistory = await fetchUserReviewHistory(user.id);
    if (reviewHistory.length >= MIN_REVIEWS_FOR_OPTIMIZATION) {
      optimizableUsers.push(user.id);
    }
  }

  return optimizableUsers;
}

/**
 * Main execution
 */
async function main() {
  const targetUserId = process.argv[2];

  console.log('🚀 FSRS v6 Parameter Optimizer');
  console.log('================================\n');

  try {
    if (targetUserId) {
      // Optimize specific user
      const success = await optimizeUserParams(targetUserId);
      process.exit(success ? 0 : 1);
    } else {
      // Optimize all eligible users
      console.log('🔍 Scanning for users with sufficient review data...\n');
      const users = await findOptimizableUsers();

      if (users.length === 0) {
        console.log('⚠️  No users found with sufficient review data');
        console.log(`   (Minimum: ${MIN_REVIEWS_FOR_OPTIMIZATION} reviews)\n`);
        process.exit(0);
      }

      console.log(`✓ Found ${users.length} user(s) with sufficient data\n`);

      let successCount = 0;
      for (const userId of users) {
        const success = await optimizeUserParams(userId);
        if (success) successCount++;
      }

      console.log(`\n📈 Summary: ${successCount}/${users.length} users optimized successfully`);
    }
  } catch (error) {
    console.error('\n❌ Error during optimization:', error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

// Run if executed directly (ESM pattern)
// In ESM, use import.meta.url to check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { optimizeUserParams, fetchUserReviewHistory };
