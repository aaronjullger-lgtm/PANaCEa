/**
 * Unified User Analytics Service
 *
 * FORTRESS MODE: Consolidated analytics entry point (Phase 6)
 *
 * Merges functionality from:
 * - advancedUserAnalyticsEngine.ts (cognitive state, learning velocity, FSRS)
 * - circadianAnalyticsService.ts (time-of-day analysis)
 * - researchBackedAnalytics.ts (research-based metrics, test readiness)
 *
 * @module services/analytics/userAnalyticsService
 */

import * as advancedAnalytics from '../advancedUserAnalyticsEngine';
import * as circadianAnalytics from '../circadianAnalyticsService';
import * as researchAnalytics from '../researchBackedAnalytics';

// ============================================================================
// Namespace Re-exports
// ============================================================================

/** Advanced cognitive and learning analytics */
export { advancedAnalytics };

/** Circadian rhythm and time-of-day analytics */
export { circadianAnalytics };

/** Research-backed learning analytics */
export { researchAnalytics };

// ============================================================================
// Unified High-Level API
// ============================================================================

/**
 * Get complete analytics snapshot for current user
 * Combines all analytics sources into one comprehensive view
 */
export async function getFullAnalyticsSnapshot(
  userId: string,
  systemMastery: advancedAnalytics.SystemMasteryProfile[],
  overallAccuracy: number,
  totalQuestions: number
) {
  const [testReadiness, userStats] = await Promise.all([
    researchAnalytics.assessTestReadiness(),
    researchAnalytics.generateUserFriendlyStats(),
  ]);

  return {
    cognitive: advancedAnalytics.getCognitiveState(),
    comprehensive: advancedAnalytics.generateComprehensiveAnalytics(
      userId,
      systemMastery,
      overallAccuracy,
      totalQuestions
    ),
    testReadiness,
    userStats,
    isLateNight: circadianAnalytics.isLateNightStudying(),
  };
}

/**
 * Get quick status for dashboard widgets
 */
export function getQuickStatus() {
  const cognitive = advancedAnalytics.getCognitiveState();
  const breakCheck = advancedAnalytics.shouldSuggestBreak();

  return {
    cognitiveLoad: cognitive.cognitiveLoad,
    fatigueLevel: cognitive.fatigueLevel,
    shouldBreak: breakCheck.suggest,
    breakReason: breakCheck.reason,
    isLateNight: circadianAnalytics.isLateNightStudying(),
  };
}

/**
 * Get optimal study conditions
 */
export async function getOptimalConditions() {
  const [circadian, cognitive, timeOfDay] = await Promise.all([
    researchAnalytics.analyzeCircadianPatterns(),
    researchAnalytics.analyzeCognitiveLoad(),
    Promise.resolve(advancedAnalytics.getOptimalStudyTime()),
  ]);

  return {
    peakHour: circadian.peakLearningHour,
    chronotype: circadian.chronotype,
    fatigueOnset: cognitive.fatigueOnsetRate,
    optimalDifficulty: cognitive.optimalDifficulty,
    bestTimeConfidence: timeOfDay.confidence,
  };
}

/**
 * Check if user should take a break
 */
export function checkBreakNeeded() {
  return advancedAnalytics.shouldSuggestBreak();
}

// ============================================================================
// Direct Function Exports (convenience)
// ============================================================================

// Cognitive state
export const getCognitiveState = advancedAnalytics.getCognitiveState;
export const recordCognitiveDataPoint = advancedAnalytics.recordCognitiveDataPoint;
export const shouldSuggestBreak = advancedAnalytics.shouldSuggestBreak;

// Learning velocity
export const getLearningVelocity = advancedAnalytics.getLearningVelocity;
export const recordSessionVelocity = advancedAnalytics.recordSessionVelocity;

// Time of day
export const getPerformanceByTimeOfDay = advancedAnalytics.getPerformanceByTimeOfDay;
export const getOptimalStudyTime = advancedAnalytics.getOptimalStudyTime;
export const recordTimeOfDayAttempt = advancedAnalytics.recordTimeOfDayAttempt;

// Circadian
export const isLateNightStudying = circadianAnalytics.isLateNightStudying;
export const getCircadianInsights = circadianAnalytics.getCircadianInsights;
export const analyzeCircadianPerformance = circadianAnalytics.analyzeCircadianPerformance;
export const formatHour = circadianAnalytics.formatHour;

// FSRS personalization
export const calculatePersonalizedFSRS = advancedAnalytics.calculatePersonalizedFSRS;
export const getSystemFSRSAdjustments = advancedAnalytics.getSystemFSRSAdjustments;

// Research-backed analysis
export const analyzeLearningEfficiency = researchAnalytics.analyzeLearningEfficiency;
export const analyzeMetacognition = researchAnalytics.analyzeMetacognition;
export const analyzeCognitiveLoad = researchAnalytics.analyzeCognitiveLoad;
export const analyzeCircadianPatterns = researchAnalytics.analyzeCircadianPatterns;
export const analyzeStrengthsWeaknesses = researchAnalytics.analyzeStrengthsWeaknesses;
export const assessTestReadiness = researchAnalytics.assessTestReadiness;
export const generateUserFriendlyStats = researchAnalytics.generateUserFriendlyStats;

// Comprehensive
export const generateComprehensiveAnalytics = advancedAnalytics.generateComprehensiveAnalytics;
export const generateQuestionTargeting = advancedAnalytics.generateQuestionTargeting;

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Namespaces
  advancedAnalytics,
  circadianAnalytics,
  researchAnalytics,

  // High-level API
  getFullAnalyticsSnapshot,
  getQuickStatus,
  getOptimalConditions,
  checkBreakNeeded,

  // Cognitive
  getCognitiveState,
  recordCognitiveDataPoint,
  shouldSuggestBreak,

  // Learning velocity
  getLearningVelocity,
  recordSessionVelocity,

  // Time of day
  getPerformanceByTimeOfDay,
  getOptimalStudyTime,
  recordTimeOfDayAttempt,
  isLateNightStudying,

  // FSRS
  calculatePersonalizedFSRS,
  getSystemFSRSAdjustments,

  // Research-backed
  analyzeLearningEfficiency,
  analyzeMetacognition,
  analyzeCognitiveLoad,
  analyzeCircadianPatterns,
  analyzeStrengthsWeaknesses,
  assessTestReadiness,
  generateUserFriendlyStats,

  // Comprehensive
  generateComprehensiveAnalytics,
  generateQuestionTargeting,
};
