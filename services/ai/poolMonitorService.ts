/**
 * Pool Monitor Service - Tracks question pool levels and health
 *
 * Database-First Architecture: Monitors the staging question pool
 * and provides insights for content generation prioritization.
 */

import { prisma } from '../../lib/prisma';

export interface PoolStatus {
  system: string;
  total: number;
  unused: number;
  percentageUnused: number;
  needsGeneration: boolean;
}

/**
 * Check the current levels of the staging question pool
 *
 * @param threshold - Minimum acceptable number of unused questions (default: 50)
 * @returns Array of pool status by organ system
 */
export async function checkPoolLevels(threshold: number = 50): Promise<PoolStatus[]> {
  try {
    // Query the staging questions grouped by organ system
    const stagingQuestions = await prisma.stagingQuestion.groupBy({
      by: ['system'],
      _count: {
        id: true,
      },
      where: {
        status: {
          in: ['APPROVED', 'PENDING'],
        },
      },
    });

    // Query used questions (those that have been promoted)
    const usedQuestions = await prisma.stagingQuestion.groupBy({
      by: ['system'],
      _count: {
        id: true,
      },
      where: {
        status: 'PROMOTED',
      },
    });

    // Create a map of used counts
    const usedMap = new Map<string, number>();
    usedQuestions.forEach((row) => {
      usedMap.set(row.system, row._count?.id ?? 0);
    });

    // Build pool status for each system
    const poolStatuses: PoolStatus[] = stagingQuestions.map((row) => {
      const total = row._count?.id ?? 0;
      const used = usedMap.get(row.system) || 0;
      const unused = Math.max(0, total - used);
      const percentageUnused = total > 0 ? (unused / total) * 100 : 0;

      return {
        system: row.system,
        total,
        unused,
        percentageUnused: Math.round(percentageUnused * 10) / 10,
        needsGeneration: unused < threshold,
      };
    });

    // Sort by unused count (ascending) to prioritize systems that need generation
    return poolStatuses.sort((a, b) => a.unused - b.unused);
  } catch (error) {
    console.error('Error checking pool levels:', error);
    throw new Error(
      `Failed to check pool levels: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get detailed statistics about the question pool
 *
 * @returns Detailed pool statistics
 */
export async function getPoolStatistics() {
  try {
    const totalQuestions = await prisma.stagingQuestion.count();

    const byStatus = await prisma.stagingQuestion.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const bySystem = await prisma.stagingQuestion.groupBy({
      by: ['system'],
      _count: {
        id: true,
      },
    });

    const byDifficulty = await prisma.stagingQuestion.groupBy({
      by: ['difficulty'],
      _count: {
        id: true,
      },
    });

    return {
      total: totalQuestions,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count?.id ?? 0])),
      bySystem: Object.fromEntries(bySystem.map((row) => [row.system, row._count?.id ?? 0])),
      byDifficulty: Object.fromEntries(
        byDifficulty.map((row) => [row.difficulty || 'UNSPECIFIED', row._count?.id ?? 0])
      ),
    };
  } catch (error) {
    console.error('Error getting pool statistics:', error);
    throw new Error(
      `Failed to get pool statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get systems that need immediate content generation
 *
 * @param threshold - Minimum acceptable number of unused questions (default: 50)
 * @returns Array of system names that need generation
 */
export async function getSystemsNeedingGeneration(threshold: number = 50): Promise<string[]> {
  const poolLevels = await checkPoolLevels(threshold);
  return poolLevels.filter((status) => status.needsGeneration).map((status) => status.system);
}

/**
 * Check if a specific system needs more questions
 *
 * @param system - The organ system to check
 * @param threshold - Minimum acceptable number of unused questions (default: 50)
 * @returns True if the system needs more questions
 */
export async function systemNeedsGeneration(
  system: string,
  threshold: number = 50
): Promise<boolean> {
  const poolLevels = await checkPoolLevels(threshold);
  const systemStatus = poolLevels.find((status) => status.system === system);
  return systemStatus ? systemStatus.needsGeneration : true; // Default to true if system not found
}

/**
 * Get a health score for the overall question pool (0-100)
 *
 * @returns Health score where 100 is fully stocked, 0 is empty
 */
export async function getPoolHealthScore(): Promise<number> {
  try {
    const poolLevels = await checkPoolLevels();

    if (poolLevels.length === 0) {
      return 0;
    }

    // Calculate average percentage unused across all systems
    const avgPercentage =
      poolLevels.reduce((sum, status) => sum + status.percentageUnused, 0) / poolLevels.length;

    // Health score is based on how close we are to target (50+ unused = 100%)
    const healthScore = Math.min(100, avgPercentage * 2);

    return Math.round(healthScore);
  } catch (error) {
    console.error('Error calculating pool health score:', error);
    return 0;
  }
}
