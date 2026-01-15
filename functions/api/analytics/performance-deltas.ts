/**
 * API Endpoint: /api/analytics/performance-deltas
 * 
 * Computes the "Gap Analysis" - user's performance vs. cohort benchmarks.
 * Shows where the user stands vs. Top 10% performers for each system.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareContext } from '../_shared/types';

// NCCPA Blueprint Systems
const NCCPA_SYSTEMS = [
  'CV', 'PULM', 'GI', 'MSK', 'HEENT', 'REPRO',
  'NEURO', 'PSYCH', 'ENDO', 'DERM', 'GU', 'HEME', 'ID', 'RENAL'
];

// Human-readable system names
const SYSTEM_DISPLAY_NAMES: Record<string, string> = {
  'CV': 'Cardiovascular',
  'PULM': 'Pulmonary',
  'GI': 'Gastrointestinal',
  'MSK': 'Musculoskeletal',
  'HEENT': 'HEENT',
  'REPRO': 'Reproductive',
  'NEURO': 'Neurological',
  'PSYCH': 'Psychiatry',
  'ENDO': 'Endocrine',
  'DERM': 'Dermatology',
  'GU': 'Genitourinary',
  'HEME': 'Hematology',
  'ID': 'Infectious Disease',
  'RENAL': 'Nephrology',
};

// Default cohort benchmarks (fallback if no platform stats)
// Based on typical PANCE performance data
const DEFAULT_BENCHMARKS: Record<string, { average: number; p90: number }> = {
  'CV': { average: 72, p90: 88 },
  'PULM': { average: 70, p90: 86 },
  'GI': { average: 71, p90: 87 },
  'MSK': { average: 69, p90: 85 },
  'HEENT': { average: 68, p90: 84 },
  'REPRO': { average: 67, p90: 83 },
  'NEURO': { average: 66, p90: 82 },
  'PSYCH': { average: 70, p90: 86 },
  'ENDO': { average: 65, p90: 81 },
  'DERM': { average: 71, p90: 87 },
  'GU': { average: 68, p90: 84 },
  'HEME': { average: 64, p90: 80 },
  'ID': { average: 67, p90: 83 },
  'RENAL': { average: 63, p90: 79 },
};

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

interface SystemData {
  name: string;
  accuracy: number;
  cohortAverage: number;
  cohortP90: number;
  cohortDelta: number;
  topPerformerGap: number;
  yieldScore: number;
  status: 'strength' | 'average' | 'weakness' | 'critical';
  isInsufficientData: boolean;
}

/**
 * GET: Retrieve user's performance deltas vs. cohort
 */
export const onRequestGet = async (context: CloudflareContext<Env>) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult || !authResult.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's question attempts grouped by system
    const attempts = await prisma.questionAttempt.findMany({
      where: { userId: user.id },
      select: {
        isCorrect: true,
        system: true,
      },
    });

    if (attempts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          userTotalAttempts: 0,
          overallPercentile: 0,
          systems: [],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Aggregate user stats by system
    const userStats: Record<string, { correct: number; total: number }> = {};
    for (const attempt of attempts) {
      const system = attempt.system || 'UNKNOWN';
      if (!userStats[system]) {
        userStats[system] = { correct: 0, total: 0 };
      }
      userStats[system].total++;
      if (attempt.isCorrect) {
        userStats[system].correct++;
      }
    }

    // Try to get platform-wide stats for cohort benchmarks
    let cohortBenchmarks: Record<string, { average: number; p90: number }> = { ...DEFAULT_BENCHMARKS };
    
    try {
      const platformStats = await prisma.platformStatistics.findFirst({
        orderBy: { computedAt: 'desc' },
      });
      
      if (platformStats?.systemPerformance) {
        const systemPerf = platformStats.systemPerformance as Record<string, any>;
        for (const [system, data] of Object.entries(systemPerf)) {
          if (data && typeof data === 'object' && 'accuracy' in data) {
            cohortBenchmarks[system] = {
              average: data.accuracy || DEFAULT_BENCHMARKS[system]?.average || 70,
              p90: Math.min(95, (data.accuracy || 70) + 15), // Estimate P90 as average + 15%
            };
          }
        }
      }
    } catch (e) {
      // Use defaults if no platform stats available
      console.log('[performance-deltas] Using default benchmarks');
    }

    // Calculate overall user accuracy
    const totalCorrect = Object.values(userStats).reduce((s, v) => s + v.correct, 0);
    const totalAttempts = Object.values(userStats).reduce((s, v) => s + v.total, 0);
    const overallAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;
    
    // Estimate overall percentile
    const overallPercentile = estimatePercentile(overallAccuracy);

    // Build system data
    const systems: SystemData[] = [];
    
    for (const system of NCCPA_SYSTEMS) {
      const stats = userStats[system];
      const benchmark = cohortBenchmarks[system] || DEFAULT_BENCHMARKS[system] || { average: 70, p90: 85 };
      
      const accuracy = stats && stats.total >= 5 
        ? Math.round((stats.correct / stats.total) * 100)
        : 0;
      
      const isInsufficientData = !stats || stats.total < 10;
      
      const cohortAverage = Math.round(benchmark.average);
      const cohortP90 = Math.round(benchmark.p90);
      const cohortDelta = accuracy - cohortAverage;
      const topPerformerGap = Math.max(0, cohortP90 - accuracy);
      
      // Yield score: how much improvement potential weighted by importance
      // Higher gap = higher yield, but also consider if user is already below average
      const yieldScore = topPerformerGap * (cohortDelta < 0 ? 1.5 : 1.0);
      
      // Determine status
      let status: SystemData['status'] = 'average';
      if (isInsufficientData) {
        status = 'weakness'; // Unknown = treat as potential weakness
      } else if (accuracy >= cohortP90 - 5) {
        status = 'strength';
      } else if (accuracy >= cohortAverage) {
        status = 'average';
      } else if (accuracy >= cohortAverage - 10) {
        status = 'weakness';
      } else {
        status = 'critical';
      }

      systems.push({
        name: SYSTEM_DISPLAY_NAMES[system] || system,
        accuracy: isInsufficientData ? 0 : accuracy,
        cohortAverage,
        cohortP90,
        cohortDelta: isInsufficientData ? -cohortAverage : cohortDelta,
        topPerformerGap: isInsufficientData ? cohortP90 : topPerformerGap,
        yieldScore: isInsufficientData ? 100 : yieldScore, // Insufficient data = high yield to study
        status,
        isInsufficientData,
      });
    }

    // Sort by yield score descending (highest improvement potential first)
    systems.sort((a, b) => b.yieldScore - a.yieldScore);

    return new Response(JSON.stringify({
      success: true,
      data: {
        userTotalAttempts: totalAttempts,
        overallPercentile: Math.round(overallPercentile),
        systems,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[performance-deltas] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Estimate percentile from accuracy
 * Uses a rough normal distribution approximation
 */
function estimatePercentile(accuracy: number): number {
  // Rough mapping based on typical PANCE score distributions
  // 60% accuracy → ~30th percentile
  // 70% accuracy → ~50th percentile
  // 80% accuracy → ~75th percentile
  // 90% accuracy → ~95th percentile
  
  if (accuracy >= 95) return 99;
  if (accuracy >= 90) return 95;
  if (accuracy >= 85) return 85;
  if (accuracy >= 80) return 75;
  if (accuracy >= 75) return 60;
  if (accuracy >= 70) return 50;
  if (accuracy >= 65) return 40;
  if (accuracy >= 60) return 30;
  if (accuracy >= 55) return 20;
  if (accuracy >= 50) return 15;
  return 10;
}

// Handle CORS preflight
export const onRequestOptions = () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
