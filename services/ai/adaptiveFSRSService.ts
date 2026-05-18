/**
 * Adaptive FSRS Service with CMRR Integration
 *
 * Provides adaptive study planning based on FSRS principles and
 * integrates with CMRR (Compute Minimum Recommended Retention) optimizer.
 */

import type { SystemMasteryProfile } from './advancedUserAnalyticsEngine';
import {
  calculateOptimalRetention as calculateCMRRRetention,
  type ReviewHistoryEntry,
  type FSRSParams,
  type CMRROutput,
} from '@/lib/cmrr-optimizer';

// ============================================================================
// Types
// ============================================================================

export interface AdaptiveFSRSResult {
  scheduledReviewTime: Date;
  recommendedDifficulty: 'easy' | 'medium' | 'hard';
  estimatedRetention: number;
  confidence: number;
}

export interface AdaptiveStudyPlan {
  recommendedQuestions: number;
  focusSystems: string[];
  estimatedTimeMinutes: number;
  breakSuggestions: Array<{
    afterQuestion: number;
    reason: string;
  }>;
  difficultyMix: {
    easy: number;
    medium: number;
    hard: number;
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get adaptive FSRS scheduling recommendation
 *
 * @param conditionId - The condition to schedule
 * @param currentStability - Current stability value from FSRS
 * @param lastReviewGrade - Last review grade (1-4)
 * @returns Adaptive scheduling result
 */
export function getAdaptiveFSRS(
  conditionId: string,
  currentStability: number = 1,
  lastReviewGrade: number = 3
): AdaptiveFSRSResult {
  // Stub implementation: Return sensible defaults
  const now = new Date();
  const daysUntilReview = Math.max(1, Math.round(currentStability));
  const scheduledReviewTime = new Date(now.getTime() + daysUntilReview * 24 * 60 * 60 * 1000);

  // Determine difficulty based on grade
  let recommendedDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  if (lastReviewGrade <= 2) {
    recommendedDifficulty = 'easy';
  } else if (lastReviewGrade >= 4) {
    recommendedDifficulty = 'hard';
  }

  // Estimate retention using simplified FSRS formula
  const estimatedRetention = Math.min(
    0.95,
    0.9 / Math.pow(1 + daysUntilReview / currentStability, 0.5)
  );

  return {
    scheduledReviewTime,
    recommendedDifficulty,
    estimatedRetention,
    confidence: currentStability > 5 ? 0.8 : 0.5,
  };
}

/**
 * Generate an adaptive study plan based on available time and user mastery
 *
 * @param availableMinutes - Minutes available for study
 * @param newCardsAvailable - Number of new cards available
 * @param reviewCardsDue - Number of review cards due
 * @param systemMastery - Array of system mastery profiles
 * @returns Adaptive study plan
 */
export function generateAdaptiveStudyPlan(
  availableMinutes: number,
  newCardsAvailable: number,
  reviewCardsDue: number,
  systemMastery: SystemMasteryProfile[]
): AdaptiveStudyPlan {
  // Calculate how many questions can fit in available time
  // Assume 2 minutes per question on average
  const estimatedQuestionsInTime = Math.floor(availableMinutes / 2);

  // Prioritize reviews, then new cards
  const reviewQuestions = Math.min(reviewCardsDue, Math.floor(estimatedQuestionsInTime * 0.6));
  const newQuestions = Math.min(newCardsAvailable, estimatedQuestionsInTime - reviewQuestions);

  const totalQuestions = reviewQuestions + newQuestions;

  // Identify focus systems (weakest areas with sufficient data)
  const focusSystems = systemMastery
    .filter((s) => s.questionsSeen >= 5)
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 3)
    .map((s) => s.system);

  // If no weak areas, pick from general pool
  if (focusSystems.length === 0) {
    focusSystems.push('Cardiovascular', 'Pulmonary', 'Gastrointestinal');
  }

  // Calculate break suggestions (every 10 questions or 20 minutes)
  const breakSuggestions: Array<{ afterQuestion: number; reason: string }> = [];
  const questionsPerBreak = 10;
  for (let i = questionsPerBreak; i < totalQuestions; i += questionsPerBreak) {
    breakSuggestions.push({
      afterQuestion: i,
      reason: i === questionsPerBreak ? 'Maintain focus' : 'Prevent fatigue',
    });
  }

  // Difficulty mix based on available time and mastery
  const avgMastery =
    systemMastery.length > 0
      ? systemMastery.reduce((sum, s) => sum + s.masteryLevel, 0) / systemMastery.length
      : 50;

  let difficultyMix: { easy: number; medium: number; hard: number };
  if (avgMastery < 50) {
    // Lower mastery: more easy questions
    difficultyMix = {
      easy: Math.round(totalQuestions * 0.5),
      medium: Math.round(totalQuestions * 0.4),
      hard: Math.round(totalQuestions * 0.1),
    };
  } else if (avgMastery > 75) {
    // High mastery: more challenging
    difficultyMix = {
      easy: Math.round(totalQuestions * 0.2),
      medium: Math.round(totalQuestions * 0.4),
      hard: Math.round(totalQuestions * 0.4),
    };
  } else {
    // Balanced mix
    difficultyMix = {
      easy: Math.round(totalQuestions * 0.3),
      medium: Math.round(totalQuestions * 0.5),
      hard: Math.round(totalQuestions * 0.2),
    };
  }

  return {
    recommendedQuestions: totalQuestions,
    focusSystems,
    estimatedTimeMinutes: totalQuestions * 2, // 2 minutes per question
    breakSuggestions,
    difficultyMix,
  };
}

/**
 * Calculate optimal retention target using CMRR (Compute Minimum Recommended Retention)
 *
 * This function integrates the CMRR optimizer to provide personalized retention targets
 * based on user review history, available study time, and learning parameters.
 *
 * @param availableStudyTimePerDay - Available study time per day in minutes
 * @param totalItems - Total number of items (cards) in the user's collection
 * @param desiredWorkload - Desired maximum workload (unused in CMRR, kept for backward compatibility)
 * @param options - Additional options for CMRR optimization
 * @param options.reviewHistory - User's review history (if not provided, returns default retention)
 * @param options.targetExamDate - Optional target exam date for urgency adjustment
 * @param options.currentParams - Current FSRS parameters for the user
 * @returns Optimal retention value (0.80-0.97)
 */
export function calculateOptimalRetention(
  availableStudyTimePerDay: number,
  totalItems: number,
  desiredWorkload: number = 100,
  options?: {
    reviewHistory?: ReviewHistoryEntry[];
    targetExamDate?: Date;
    currentParams?: FSRSParams;
  }
): number {
  // If no review history is provided, return default retention (0.90)
  // This maintains backward compatibility with existing callers
  if (!options?.reviewHistory || options.reviewHistory.length === 0) {
    return 0.9;
  }

  // Call the CMRR optimizer with the provided data
  const cmrrResult: CMRROutput = calculateCMRRRetention({
    reviewHistory: options.reviewHistory,
    avgStudyTimeMinutes: availableStudyTimePerDay,
    targetExamDate: options.targetExamDate,
    currentParams: options.currentParams,
  });

  return cmrrResult.optimalRetention;
}

/**
 * Helper function to fetch user review history from the database
 * (To be implemented when database access is available in this context)
 *
 * @param userId - User ID to fetch review history for
 * @returns Promise resolving to review history entries
 */
export async function fetchUserReviewHistory(
  userId: string,
  token?: string | null
): Promise<ReviewHistoryEntry[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/user/review-history?limit=500&mainOnly=true`, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const reviews = data.reviews ?? data.data?.reviews ?? [];

    return reviews.map((r: Record<string, unknown>) => ({
      rating: Number(r.rating ?? (r.wasCorrect ? 3 : 1)),
      elapsed_days: Number(r.elapsedDays ?? 0),
      scheduled_days: Number(r.scheduledDays ?? 0),
      review: new Date(String(r.reviewedAt ?? r.createdAt ?? new Date().toISOString())),
      state: Number(r.state ?? 0),
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  getAdaptiveFSRS,
  generateAdaptiveStudyPlan,
  calculateOptimalRetention,
  fetchUserReviewHistory,
};
