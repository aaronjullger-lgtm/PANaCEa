/**
 * Circadian Analytics Service
 * Tracks user performance by time of day to optimize study scheduling
 * Phase 13: Requirement 55
 */

import type { PerformanceRecord } from '../types';

interface TimeOfDayStats {
  hour: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

interface CircadianInsight {
  bestTimeRange: string;
  worstTimeRange: string;
  averageAccuracy: number;
  bestAccuracy: number;
  worstAccuracy: number;
  recommendation: string;
}

const STORAGE_KEY = 'panceai_circadian_data_v1';

/**
 * Get hour of day (0-23) from timestamp
 */
function getHourFromTimestamp(timestamp: number): number {
  return new Date(timestamp).getHours();
}

/**
 * Categorize hour into time range
 */
function getTimeRange(hour: number): string {
  if (hour >= 6 && hour < 12) return 'Morning (6 AM - 12 PM)';
  if (hour >= 12 && hour < 17) return 'Afternoon (12 PM - 5 PM)';
  if (hour >= 17 && hour < 21) return 'Evening (5 PM - 9 PM)';
  return 'Night (9 PM - 6 AM)';
}

/**
 * Analyze performance by time of day
 */
export function analyzeCircadianPerformance(
  performanceRecords: PerformanceRecord[]
): TimeOfDayStats[] {
  const hourlyStats = new Map<number, { correct: number; total: number }>();

  // Initialize all 24 hours
  for (let hour = 0; hour < 24; hour++) {
    hourlyStats.set(hour, { correct: 0, total: 0 });
  }

  // Aggregate data by hour
  performanceRecords.forEach((record) => {
    const hour = getHourFromTimestamp(record.timestamp);
    const stats = hourlyStats.get(hour)!;
    stats.total++;
    if (record.isCorrect) {
      stats.correct++;
    }
  });

  // Convert to array format
  const result: TimeOfDayStats[] = [];
  hourlyStats.forEach((stats, hour) => {
    result.push({
      hour,
      totalQuestions: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
    });
  });

  return result;
}

/**
 * Get circadian insights and recommendations
 */
export function getCircadianInsights(
  performanceRecords: PerformanceRecord[]
): CircadianInsight | null {
  if (performanceRecords.length < 20) {
    return null; // Need minimum data for meaningful insights
  }

  const hourlyStats = analyzeCircadianPerformance(performanceRecords);

  // Filter hours with at least 5 questions
  const significantHours = hourlyStats.filter((stat) => stat.totalQuestions >= 5);

  if (significantHours.length === 0) {
    return null;
  }

  // Find best and worst performing hours
  let bestHour = significantHours[0];
  let worstHour = significantHours[0];
  let totalAccuracy = 0;
  let hoursWithData = 0;

  significantHours.forEach((stat) => {
    if (stat.accuracy > bestHour.accuracy) {
      bestHour = stat;
    }
    if (stat.accuracy < worstHour.accuracy) {
      worstHour = stat;
    }
    totalAccuracy += stat.accuracy;
    hoursWithData++;
  });

  const averageAccuracy = totalAccuracy / hoursWithData;
  const performanceDifference = ((bestHour.accuracy - worstHour.accuracy) * 100).toFixed(0);

  // Generate recommendation
  let recommendation = '';
  if (parseFloat(performanceDifference) >= 15) {
    const bestTimeRange = getTimeRange(bestHour.hour);
    recommendation =
      `You score ${performanceDifference}% higher during ${bestTimeRange}. ` +
      `Consider scheduling your most challenging study sessions during this time.`;
  } else if (parseFloat(performanceDifference) >= 10) {
    recommendation =
      `Your performance varies moderately throughout the day. ` +
      `Try to tackle harder topics during your peak hours.`;
  } else {
    recommendation =
      `Your performance is consistent throughout the day. ` +
      `Great job maintaining focus regardless of time!`;
  }

  return {
    bestTimeRange: getTimeRange(bestHour.hour),
    worstTimeRange: getTimeRange(worstHour.hour),
    averageAccuracy: averageAccuracy * 100,
    bestAccuracy: bestHour.accuracy * 100,
    worstAccuracy: worstHour.accuracy * 100,
    recommendation,
  };
}

/**
 * Check if user is studying at an unusual time (late night)
 * Based on requirement #54: "If a user is active at 3 AM: Pop up a gentle modal"
 */
export function isLateNightStudying(): boolean {
  const currentHour = new Date().getHours();
  // Check 2 AM - 5 AM range (centered around 3 AM from requirements)
  return currentHour >= 2 && currentHour < 5;
}

/**
 * Get optimal study time recommendation based on historical performance
 */
export function getOptimalStudyTime(performanceRecords: PerformanceRecord[]): string | null {
  const insights = getCircadianInsights(performanceRecords);
  if (!insights) {
    return null;
  }

  return insights.bestTimeRange;
}

/**
 * Format hour for display (e.g., "9 AM", "2 PM")
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Save circadian data to local storage
 */
export function saveCircadianData(data: any): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save circadian data:', error);
  }
}

/**
 * Load circadian data from local storage
 */
export function loadCircadianData(): any {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load circadian data:', error);
    return null;
  }
}

/**
 * Record a single performance event with circadian tracking
 * This function stores the raw data for later analysis
 */
export function recordCircadianPerformance(record: {
  timestamp: number;
  isCorrect: boolean;
  topic: string;
}): void {
  try {
    const data = loadCircadianData() || { records: [] };
    data.records = data.records || [];

    // Add the new record
    data.records.push({
      timestamp: record.timestamp,
      isCorrect: record.isCorrect,
      topic: record.topic,
      hour: getHourFromTimestamp(record.timestamp),
    });

    // Keep only last 1000 records to prevent storage bloat
    if (data.records.length > 1000) {
      data.records = data.records.slice(-1000);
    }

    saveCircadianData(data);
  } catch (error) {
    console.error('Failed to record circadian performance:', error);
  }
}
