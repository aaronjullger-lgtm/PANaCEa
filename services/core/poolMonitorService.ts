/**
 * Question Pool Monitor & Batch Generation Failsafe
 *
 * Monitors question pool levels and triggers batch generation
 * when pool drops below threshold to ensure users never run out of questions.
 */

import { prisma } from '@/lib/prisma';

// Thresholds for triggering batch generation
const THRESHOLDS = {
  CRITICAL: 10, // Immediate generation needed
  WARNING: 50, // Schedule batch generation
  HEALTHY: 200, // Pool is healthy
  BATCH_SIZE: 25, // Questions to generate per batch
};

export interface PoolStatus {
  system: string;
  total: number;
  unused: number;
  status: 'critical' | 'warning' | 'healthy';
  needsGeneration: boolean;
}

/**
 * Check pool levels for all systems
 */
export async function checkPoolLevels(): Promise<PoolStatus[]> {
  const systems = [
    'CV',
    'PULM',
    'GI',
    'NEURO',
    'MSK',
    'DERM',
    'HEME',
    'ENDO',
    'HEENT',
    'RENAL',
    'REPRO',
    'PSYCH',
    'ID',
    'GU',
  ];

  const results: PoolStatus[] = [];

  for (const system of systems) {
    const [total, unused] = await Promise.all([
      prisma.preGeneratedQuestion.count({ where: { system } }),
      prisma.preGeneratedQuestion.count({ where: { system, usedAt: null } }),
    ]);

    let status: 'critical' | 'warning' | 'healthy';
    if (unused <= THRESHOLDS.CRITICAL) {
      status = 'critical';
    } else if (unused <= THRESHOLDS.WARNING) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    results.push({
      system,
      total,
      unused,
      status,
      needsGeneration: status !== 'healthy',
    });
  }

  return results;
}

/**
 * Get systems that need generation (below warning threshold)
 */
export async function getSystemsNeedingGeneration(): Promise<string[]> {
  const poolStatus = await checkPoolLevels();
  return poolStatus
    .filter((s) => s.needsGeneration)
    .sort((a, b) => a.unused - b.unused) // Most critical first
    .map((s) => s.system);
}

/**
 * Check if a specific user is approaching the end of available questions
 */
export async function checkUserPoolExhaustion(
  userId: string,
  system?: string
): Promise<{
  unseenCount: number;
  totalAvailable: number;
  percentRemaining: number;
  needsBatchGeneration: boolean;
}> {
  const where: any = {};
  if (system) where.system = system;

  // Get user's seen questions
  const seenCount = await prisma.userQuestionSeen.count({
    where: { userId, questionType: 'pre_generated' },
  });

  // Get total available questions
  const totalAvailable = await prisma.preGeneratedQuestion.count({ where });

  const unseenCount = Math.max(0, totalAvailable - seenCount);
  const percentRemaining = totalAvailable > 0 ? (unseenCount / totalAvailable) * 100 : 0;

  return {
    unseenCount,
    totalAvailable,
    percentRemaining,
    needsBatchGeneration: unseenCount < THRESHOLDS.WARNING,
  };
}

/**
 * Queue batch generation for a system
 * In production, this would add to a job queue (Bull, etc.)
 */
export async function queueBatchGeneration(
  system: string,
  count: number = THRESHOLDS.BATCH_SIZE,
  priority: 'high' | 'normal' = 'normal'
): Promise<{ queued: boolean; jobId?: string }> {
  // Log the request
  console.log(
    `[PoolMonitor] Queuing batch generation: ${system}, count=${count}, priority=${priority}`
  );

  // In production: Add to job queue
  // await jobQueue.add('generateQuestions', { system, count }, { priority: priority === 'high' ? 1 : 5 });

  // For now, just log and return
  return {
    queued: true,
    jobId: `batch_${system}_${Date.now()}`,
  };
}

/**
 * Run the failsafe check - call this periodically or on user request
 */
export async function runFailsafeCheck(): Promise<{
  checked: boolean;
  criticalSystems: string[];
  warningSystems: string[];
  actionsQueued: number;
}> {
  const poolStatus = await checkPoolLevels();

  const criticalSystems = poolStatus.filter((s) => s.status === 'critical').map((s) => s.system);
  const warningSystems = poolStatus.filter((s) => s.status === 'warning').map((s) => s.system);

  let actionsQueued = 0;

  // Queue high-priority generation for critical systems
  for (const system of criticalSystems) {
    await queueBatchGeneration(system, THRESHOLDS.BATCH_SIZE * 2, 'high');
    actionsQueued++;
  }

  // Queue normal generation for warning systems
  for (const system of warningSystems) {
    await queueBatchGeneration(system, THRESHOLDS.BATCH_SIZE, 'normal');
    actionsQueued++;
  }

  return {
    checked: true,
    criticalSystems,
    warningSystems,
    actionsQueued,
  };
}

/**
 * Get overall pool health report
 */
export async function getPoolHealthReport(): Promise<{
  overallHealth: 'critical' | 'warning' | 'healthy';
  totalQuestions: number;
  totalUnused: number;
  systemBreakdown: PoolStatus[];
  recommendations: string[];
}> {
  const systemBreakdown = await checkPoolLevels();

  const totalQuestions = systemBreakdown.reduce((sum, s) => sum + s.total, 0);
  const totalUnused = systemBreakdown.reduce((sum, s) => sum + s.unused, 0);

  const criticalCount = systemBreakdown.filter((s) => s.status === 'critical').length;
  const warningCount = systemBreakdown.filter((s) => s.status === 'warning').length;

  let overallHealth: 'critical' | 'warning' | 'healthy';
  if (criticalCount > 0) {
    overallHealth = 'critical';
  } else if (warningCount > 3) {
    overallHealth = 'warning';
  } else {
    overallHealth = 'healthy';
  }

  const recommendations: string[] = [];
  if (criticalCount > 0) {
    recommendations.push(`URGENT: ${criticalCount} systems have critically low question pools`);
  }
  if (warningCount > 0) {
    recommendations.push(`${warningCount} systems need question generation soon`);
  }
  if (totalQuestions < 1000) {
    recommendations.push('Consider running bulk content generation to build question pool');
  }

  return {
    overallHealth,
    totalQuestions,
    totalUnused,
    systemBreakdown,
    recommendations,
  };
}

// CLI for testing
const isMainModule =
  typeof process !== 'undefined' && process.argv[1]?.includes('poolMonitorService');
if (isMainModule) {
  (async () => {
    console.log('=== Pool Health Report ===\n');
    const report = await getPoolHealthReport();

    console.log(`Overall Health: ${report.overallHealth.toUpperCase()}`);
    console.log(`Total Questions: ${report.totalQuestions}`);
    console.log(`Unused Questions: ${report.totalUnused}\n`);

    console.log('System Breakdown:');
    for (const s of report.systemBreakdown) {
      const icon = s.status === 'critical' ? '🔴' : s.status === 'warning' ? '🟡' : '🟢';
      console.log(`  ${icon} ${s.system}: ${s.unused}/${s.total} unused`);
    }

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      for (const rec of report.recommendations) {
        console.log(`  • ${rec}`);
      }
    }

    process.exit(0);
  })();
}
