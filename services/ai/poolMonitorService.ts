/**
 * Compatibility wrapper for AI content generation pool monitoring.
 *
 * The active learner-serving pool is `PreGeneratedQuestion`; staging questions
 * are a review queue and should not drive refill decisions. Keep this module as
 * the AI namespace entrypoint, but delegate counts to the core pool monitor.
 */

import {
  checkPoolLevels as checkPreGeneratedPoolLevels,
  getPoolHealthReport,
} from '@/services/core/poolMonitorService';

export interface PoolStatus {
  system: string;
  total: number;
  unused: number;
  status: 'critical' | 'warning' | 'healthy';
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
  const rows = await checkPreGeneratedPoolLevels();

  return rows
    .map((row) => ({
      ...row,
      percentageUnused: row.total > 0 ? Math.round((row.unused / row.total) * 1000) / 10 : 0,
      needsGeneration: row.unused < threshold,
    }))
    .sort((a, b) => a.unused - b.unused);
}

/**
 * Get detailed statistics about the question pool
 *
 * @returns Detailed pool statistics
 */
export async function getPoolStatistics() {
  const rows = await checkPoolLevels();

  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    byStatus: rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {}),
    bySystem: Object.fromEntries(rows.map((row) => [row.system, row.total])),
  };
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
  const report = await getPoolHealthReport();
  if (report.systemBreakdown.length === 0) return 0;

  const criticalPenalty = report.systemBreakdown.filter((row) => row.status === 'critical').length;
  const warningPenalty = report.systemBreakdown.filter((row) => row.status === 'warning').length;

  return Math.max(0, 100 - criticalPenalty * 20 - warningPenalty * 8);
}
