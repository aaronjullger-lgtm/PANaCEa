/**
 * Learning Curve Service
 * Aggregates daily performance and stability trend data for visualization.
 */

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { logger } from "@/lib/simple-logger";

// Types from API responses
export interface DailyPerformancePoint {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface StabilityTrendPoint {
  date: string;
  avgStability: number;
  totalReviews: number;
  conditions: Array<{ conditionId: string; stability: number }>;
}

export interface LearningCurveDataPoint {
  date: string;
  accuracy?: number;
  attempts?: number;
  correct?: number;
  avgStability?: number;
  totalReviews?: number;
  avgDurationMs?: number; // TODO: add when available
}

export interface LearningCurveData {
  points: LearningCurveDataPoint[];
  summary?: {
    startDate: string;
    endDate: string;
    totalAttempts: number;
    totalCorrect: number;
    avgAccuracy: number;
    avgStability?: number;
    stabilityGrowth?: number;
  };
}

/**
 * Fetches daily performance data for a given time range.
 */
export async function fetchDailyPerformance(
  token: string,
  days: number = 30
): Promise<{ dailyPerformance: DailyPerformancePoint[]; period: string }> {
  const url = `${getApiEndpoint('/api/user/daily-performance')}?days=${days}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch daily performance: ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON but got ${contentType || 'text/html'}`);
  }
  const result = await response.json();
  // The endpoint returns { period, startDate, endDate, dailyPerformance, summary }
  if (result.dailyPerformance && Array.isArray(result.dailyPerformance)) {
    return {
      dailyPerformance: result.dailyPerformance,
      period: result.period || `${days}d`,
    };
  }
  // fallback if structure differs
  return { dailyPerformance: [], period: `${days}d` };
}

/**
 * Fetches stability trend data for a given time range.
 */
export async function fetchStabilityTrend(
  token: string,
  days: number = 30
): Promise<{ trendData: StabilityTrendPoint[] }> {
  const url = `${getApiEndpoint(API_ENDPOINTS.USER_STABILITY_TREND)}?days=${days}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch stability trend: ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON but got ${contentType || 'text/html'}`);
  }
  const result = await response.json();
  // The endpoint returns { data: trendData, summary } after middleware stripping
  let trendData: StabilityTrendPoint[] = [];
  if (Array.isArray(result.data)) {
    trendData = result.data;
  } else if (result.data && Array.isArray(result.data.data)) {
    // nested structure (maybe before middleware change)
    trendData = result.data.data;
  } else if (Array.isArray(result)) {
    // fallback: result is directly the array
    trendData = result;
  }
  return { trendData };
}

/**
 * Merges daily performance and stability trend data by date.
 */
export function mergeLearningCurveData(
  dailyPoints: DailyPerformancePoint[],
  stabilityPoints: StabilityTrendPoint[]
): LearningCurveDataPoint[] {
  const map = new Map<string, LearningCurveDataPoint>();

  dailyPoints.forEach((dp) => {
    map.set(dp.date, {
      date: dp.date,
      accuracy: dp.accuracy,
      attempts: dp.attempts,
      correct: dp.correct,
    });
  });

  stabilityPoints.forEach((sp) => {
    const existing = map.get(sp.date);
    if (existing) {
      existing.avgStability = sp.avgStability;
      existing.totalReviews = sp.totalReviews;
    } else {
      map.set(sp.date, {
        date: sp.date,
        avgStability: sp.avgStability,
        totalReviews: sp.totalReviews,
      });
    }
  });

  // Sort by date ascending
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetches and merges learning curve data.
 */
export async function fetchLearningCurveData(
  token: string,
  days: number = 30
): Promise<LearningCurveData> {
  const [dailyResult, stabilityResult] = await Promise.all([
    fetchDailyPerformance(token, days),
    fetchStabilityTrend(token, days),
  ]);

  const points = mergeLearningCurveData(
    dailyResult.dailyPerformance,
    stabilityResult.trendData
  );

  // Calculate summary
  const totalAttempts = dailyResult.dailyPerformance.reduce((sum, dp) => sum + dp.attempts, 0);
  const totalCorrect = dailyResult.dailyPerformance.reduce((sum, dp) => sum + dp.correct, 0);
  const avgAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;
  const avgStability = stabilityResult.trendData.length > 0
    ? stabilityResult.trendData.reduce((sum, sp) => sum + sp.avgStability, 0) / stabilityResult.trendData.length
    : undefined;

  const sortedPoints = points.sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sortedPoints[0]?.date || '';
  const endDate = sortedPoints[sortedPoints.length - 1]?.date || '';

  return {
    points,
    summary: {
      startDate,
      endDate,
      totalAttempts,
      totalCorrect,
      avgAccuracy,
      avgStability,
      // stability growth could be computed from first and last stability points
    },
  };
}