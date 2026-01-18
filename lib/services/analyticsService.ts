/**
 * Analytics Service for Peer Benchmarking
 *
 * Provides functions to calculate user performance metrics and compare against cohort benchmarks.
 * Uses efficient Prisma aggregations to avoid loading all rows into memory.
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

export interface UserAccuracyProfile {
  system: string;
  accuracy: number;
  totalQuestions: number;
  correctCount: number;
}

export interface CohortBenchmark {
  system: string;
  averageAccuracy: number;
  p90Accuracy: number;
  totalParticipants: number;
}

export interface PeerComparison {
  system: string;
  userAccuracy: number;
  cohortAverage: number;
  userPercentile: number;
  totalQuestions: number;
}

// ============================================================================
// 1. Get User Accuracy Profile
// ============================================================================

/**
 * Calculates a user's accuracy profile across all systems.
 * Uses groupBy to avoid fetching all individual attempts.
 *
 * @param userId - The user's ID
 * @returns Array of accuracy metrics by system
 */
export async function getUserAccuracyProfile(userId: string): Promise<UserAccuracyProfile[]> {
  // Group by system and wasCorrect to get counts
  const groupedData = await prisma.questionAttempt.groupBy({
    by: ['system', 'wasCorrect'],
    where: {
      userId,
      system: { not: null }, // Exclude attempts without system classification
    },
    _count: {
      id: true,
    },
  }) as Array<{ system: string | null; wasCorrect: boolean; _count: { id: number } }>;

  // Organize data by system
  const systemMap = new Map<string, { correct: number; total: number }>();

  for (const row of groupedData) {
    const system = row.system;
    if (!system) continue;

    const existing = systemMap.get(system) || { correct: 0, total: 0 };
    existing.total += row._count.id;
    if (row.wasCorrect) {
      existing.correct += row._count.id;
    }
    systemMap.set(system, existing);
  }

  // Convert to output format
  const profile: UserAccuracyProfile[] = [];
  for (const [system, stats] of systemMap.entries()) {
    profile.push({
      system,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      totalQuestions: stats.total,
      correctCount: stats.correct,
    });
  }

  return profile.sort((a, b) => a.system.localeCompare(b.system));
}

// ============================================================================
// 2. Get Cohort Benchmarks
// ============================================================================

/**
 * Calculates cohort-wide benchmarks for each system.
 * Filters out users with <5 attempts per system for statistical relevance.
 *
 * @param cohortId - The cohort ID, or 'global' for all users
 * @returns Array of benchmark metrics by system
 */
export async function getCohortBenchmarks(cohortId: string): Promise<CohortBenchmark[]> {
  let targetUserIds: string[] | undefined;

  // Determine which users to include
  if (cohortId !== 'global') {
    const cohortMembers = await prisma.cohortMember.findMany({
      where: { cohortId },
      select: { userId: true },
    });
    targetUserIds = cohortMembers.map((m) => m.userId);

    if (targetUserIds.length === 0) {
      return []; // No users in cohort
    }
  }

  // Group by userId and system to get individual user stats
  const userSystemData = await prisma.questionAttempt.groupBy({
    by: ['userId', 'system', 'wasCorrect'],
    where: {
      system: { not: null },
      ...(targetUserIds && { userId: { in: targetUserIds } }),
    },
    _count: {
      id: true,
    },
  }) as Array<{ userId: string; system: string | null; wasCorrect: boolean; _count: { id: number } }>;

  // Calculate per-user, per-system accuracy
  interface UserSystemStat {
    userId: string;
    system: string;
    accuracy: number;
    totalQuestions: number;
  }

  const userSystemStats: UserSystemStat[] = [];
  const userSystemMap = new Map<string, Map<string, { correct: number; total: number }>>();

  for (const row of userSystemData) {
    const system = row.system;
    const userId = row.userId;
    if (!system) continue;

    let systemMap = userSystemMap.get(userId);
    if (!systemMap) {
      systemMap = new Map();
      userSystemMap.set(userId, systemMap);
    }

    const existing = systemMap.get(system) || { correct: 0, total: 0 };
    existing.total += row._count.id;
    if (row.wasCorrect) {
      existing.correct += row._count.id;
    }
    systemMap.set(system, existing);
  }

  // Convert to flat array and filter by minimum attempts
  for (const [userId, systemMap] of userSystemMap.entries()) {
    for (const [system, stats] of systemMap.entries()) {
      if (stats.total >= 5) {
        // Minimum 5 attempts for statistical relevance
        userSystemStats.push({
          userId,
          system,
          accuracy: (stats.correct / stats.total) * 100,
          totalQuestions: stats.total,
        });
      }
    }
  }

  // Group by system to calculate cohort benchmarks
  const systemBenchmarks = new Map<string, number[]>();

  for (const stat of userSystemStats) {
    const accuracies = systemBenchmarks.get(stat.system) || [];
    accuracies.push(stat.accuracy);
    systemBenchmarks.set(stat.system, accuracies);
  }

  // Calculate average and P90 for each system
  const benchmarks: CohortBenchmark[] = [];

  for (const [system, accuracies] of systemBenchmarks.entries()) {
    if (accuracies.length === 0) continue;

    const sum = accuracies.reduce((acc, val) => acc + val, 0);
    const average = sum / accuracies.length;

    // Calculate 90th percentile
    const sorted = [...accuracies].sort((a, b) => a - b);
    const p90Index = Math.floor(sorted.length * 0.9);
    const p90 = sorted[p90Index] || sorted[sorted.length - 1];

    benchmarks.push({
      system,
      averageAccuracy: average,
      p90Accuracy: p90,
      totalParticipants: accuracies.length,
    });
  }

  return benchmarks.sort((a, b) => a.system.localeCompare(b.system));
}

// ============================================================================
// 3. Generate Peer Comparison
// ============================================================================

/**
 * Generates a comprehensive peer comparison for a user.
 * Determines the appropriate cohort (provided, user's first study group, or global).
 * Calculates the user's percentile within the cohort for each system.
 *
 * @param userId - The user's ID
 * @param cohortId - Optional cohort ID. If not provided, uses user's first cohort or 'global'
 * @returns Array of peer comparison metrics by system
 */
export async function generatePeerComparison(
  userId: string,
  cohortId?: string
): Promise<PeerComparison[]> {
  // Determine target cohort
  let targetCohortId = cohortId;

  if (!targetCohortId) {
    // Try to find user's first cohort
    const userCohort = await prisma.cohortMember.findFirst({
      where: { userId },
      select: { cohortId: true },
    });

    targetCohortId = userCohort?.cohortId || 'global';
  }

  // Get user's accuracy profile
  const userProfile = await getUserAccuracyProfile(userId);

  // Get all users in the cohort with their accuracies for percentile calculation
  let targetUserIds: string[] | undefined;

  if (targetCohortId !== 'global') {
    const cohortMembers = await prisma.cohortMember.findMany({
      where: { cohortId: targetCohortId },
      select: { userId: true },
    });
    targetUserIds = cohortMembers.map((m) => m.userId);

    if (targetUserIds.length === 0) {
      // User is in a cohort with no other members, fall back to global
      targetCohortId = 'global';
      targetUserIds = undefined;
    }
  }

  // Get cohort distribution data for percentile calculation
  const cohortData = await prisma.questionAttempt.groupBy({
    by: ['userId', 'system', 'wasCorrect'],
    where: {
      system: { not: null },
      ...(targetUserIds && { userId: { in: targetUserIds } }),
    },
    _count: {
      id: true,
    },
  }) as Array<{ userId: string; system: string | null; wasCorrect: boolean; _count: { id: number } }>;

  // Build cohort accuracy distribution by system
  const cohortSystemMap = new Map<string, Map<string, { correct: number; total: number }>>();

  for (const row of cohortData) {
    if (!row.system) continue;

    let userMap = cohortSystemMap.get(row.system);
    if (!userMap) {
      userMap = new Map();
      cohortSystemMap.set(row.system, userMap);
    }

    const existing = userMap.get(row.userId) || { correct: 0, total: 0 };
    existing.total += row._count.id;
    if (row.wasCorrect) {
      existing.correct += row._count.id;
    }
    userMap.set(row.userId, existing);
  }

  // Calculate cohort averages and user percentiles
  const comparisons: PeerComparison[] = [];

  for (const userStat of userProfile) {
    const { system, accuracy: userAccuracy, totalQuestions } = userStat;

    const userMap = cohortSystemMap.get(system);
    if (!userMap) {
      // No cohort data for this system
      comparisons.push({
        system,
        userAccuracy,
        cohortAverage: 0,
        userPercentile: 0,
        totalQuestions,
      });
      continue;
    }

    // Calculate cohort average and percentile
    const accuracies: number[] = [];
    for (const [uid, stats] of userMap.entries()) {
      if (stats.total >= 5) {
        // Only include users with 5+ attempts
        accuracies.push((stats.correct / stats.total) * 100);
      }
    }

    if (accuracies.length === 0) {
      comparisons.push({
        system,
        userAccuracy,
        cohortAverage: 0,
        userPercentile: 0,
        totalQuestions,
      });
      continue;
    }

    const cohortAverage = accuracies.reduce((sum, val) => sum + val, 0) / accuracies.length;

    // Calculate percentile: percentage of users with accuracy <= user's accuracy
    const lowerOrEqualCount = accuracies.filter((acc) => acc <= userAccuracy).length;
    const userPercentile = (lowerOrEqualCount / accuracies.length) * 100;

    comparisons.push({
      system,
      userAccuracy,
      cohortAverage,
      userPercentile,
      totalQuestions,
    });
  }

  return comparisons.sort((a, b) => a.system.localeCompare(b.system));
}
