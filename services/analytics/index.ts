/**
 * Analytics Services - Unified Exports
 *
 * FORTRESS MODE: Consolidated analytics and performance tracking services.
 *
 * @example
 * // Performance & Score Prediction
 * import { predictScore, NCCPA_BLUEPRINT_WEIGHTS } from '@/services/analytics';
 *
 * // User Analytics (cognitive, circadian, research-backed)
 * import { userAnalytics, getQuickStatus, assessTestReadiness } from '@/services/analytics';
 */

// ============================================================================
// PERFORMANCE SERVICE (Phase 6 Consolidation)
// ============================================================================

import * as performanceServiceModule from './performanceService';
import * as panaceScorePredictorModule from './panaceScorePredictor';
import * as panceScorePredictorServiceModule from './panceScorePredictorService';
import * as performancePredictionServiceModule from './performancePredictionService';

export const performanceService = performanceServiceModule;
export const panaceScorePredictor = panaceScorePredictorModule;
export const panceScorePredictorService = panceScorePredictorServiceModule;
export const performancePredictionService = performancePredictionServiceModule;

// Named exports from performanceService
export {
  predictScore,
  predictPANCEScore,
  NCCPA_BLUEPRINT_WEIGHTS,
  recordQuestionOutcome,
  getHierarchicalStats,
  clearPerformanceCache,
  updatePerformancePrediction,
  getSessionPrediction,
  getConfidenceInterval,
  resetPrediction,
  calculateTrend,
} from './performanceService';

// Direct export of getPrediction for components
export { getPrediction } from './performancePredictionService';

// ============================================================================
// USER ANALYTICS SERVICE (Advanced, Circadian, Research-Backed)
// ============================================================================

import * as advancedUserAnalyticsEngineModule from '../advancedUserAnalyticsEngine';
import * as circadianAnalyticsServiceModule from '../circadianAnalyticsService';
import * as researchBackedAnalyticsModule from './researchBackedAnalytics';
import * as userContextServiceModule from './userContextService';
import * as userProfileServiceModule from './userProfileService';
import * as studentInsightsServiceModule from './studentInsightsService';

export const advancedAnalytics = advancedUserAnalyticsEngineModule;
export const circadianAnalytics = circadianAnalyticsServiceModule;
export const researchAnalytics = researchBackedAnalyticsModule;
export const userContextService = userContextServiceModule;
export const userProfileService = userProfileServiceModule;
export const studentInsightsService = studentInsightsServiceModule;

// Named exports from advanced analytics
export {
  getCognitiveState,
  recordCognitiveDataPoint,
  shouldSuggestBreak,
  getLearningVelocity,
  recordSessionVelocity,
  getPerformanceByTimeOfDay,
  getOptimalStudyTime,
  recordTimeOfDayAttempt,
  calculatePersonalizedFSRS,
  getSystemFSRSAdjustments,
} from '../advancedUserAnalyticsEngine';

// Named exports from circadian analytics
export {
  recordCircadianPerformance,
  formatHour,
  isLateNightStudying,
  getCircadianInsights,
  analyzeCircadianPerformance,
} from '../circadianAnalyticsService';

// Named exports from research-backed analytics
export {
  analyzeLearningEfficiency,
  analyzeMetacognition,
  analyzeCognitiveLoad,
  analyzeCircadianPatterns,
  analyzeStrengthsWeaknesses,
  assessTestReadiness,
  generateUserFriendlyStats,
  generateComprehensiveAnalytics,
  generateQuestionTargeting,
} from './researchBackedAnalytics';

// ============================================================================
// BEHAVIORAL & PATTERN ANALYSIS
// ============================================================================

import * as answerPatternServiceModule from './answerPatternService';
import * as behavioralConfidenceServiceModule from './behavioralConfidenceService';
import * as learningPatternEngineModule from './learningPatternEngine';

export const answerPatternService = answerPatternServiceModule;
export const behavioralConfidenceService = behavioralConfidenceServiceModule;
export const learningPatternEngine = learningPatternEngineModule;

// ============================================================================
// PREDICTIVE ANALYTICS
// ============================================================================

import * as masteryVelocityPredictorModule from './masteryVelocityPredictor';
import * as predictiveAnalyticsEngineModule from './predictiveAnalyticsEngine';

export const masteryVelocityPredictor = masteryVelocityPredictorModule;
export const predictiveAnalyticsEngine = predictiveAnalyticsEngineModule;

// ============================================================================
// SESSION ANALYTICS
// ============================================================================

import * as sessionAnalyticsSyncServiceModule from './sessionAnalyticsSyncService';
import * as sessionMomentumServiceModule from './sessionMomentumService';

export const sessionAnalyticsSyncService = sessionAnalyticsSyncServiceModule;
export const sessionMomentumService = sessionMomentumServiceModule;

// Named exports from session analytics
export {
  collectSessionAnalytics,
  syncSessionAnalytics,
  processPendingSync,
  fetchLearningProfile,
} from './sessionAnalyticsSyncService';

// ============================================================================
// ANALYTICS STORAGE
// ============================================================================

import * as deepAnalyticsStoreModule from './deepAnalyticsStore';
import * as calibrationServiceModule from './calibrationService';

export const deepAnalyticsStore = deepAnalyticsStoreModule;
export const calibrationService = calibrationServiceModule;

// Named exports from storage
export {
  storeQuestionAttempt,
  getQuestionAttempts,
  storeDailyRecord,
  getDailyRecords,
  storeMilestone,
  getMilestones,
  storeSnapshot,
  getSnapshots,
  getStorageStats,
  generateId,
  getTodayString,
} from './deepAnalyticsStore';

// Named exports from user profile service
export {
  loadUserProfile,
  saveUserProfile,
  updateUserProfile,
  clearUserProfile,
  hasCompletedOnboarding,
} from './userProfileService';

// Named exports from user context service
export {
  getUserContext,
  setUserContext,
  shouldShowPANREContent,
  shouldShowPANCEContent,
  getExamLabel,
} from './userContextService';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  CognitiveState,
  LearningVelocity,
  PerformanceByTimeOfDay,
  PerformanceByDayOfWeek,
  SystemMasteryProfile,
  OptimalStudyConditions,
  PersonalizedFSRSParams,
  QuestionTargeting,
  ComprehensiveUserAnalytics,
  AnalyticsInsight,
  ResponsePatternMetrics,
} from '../advancedUserAnalyticsEngine';

export type {
  UserFriendlyStats,
  TestReadinessAssessment,
  StrengthWeaknessAnalysis,
} from './researchBackedAnalytics';

export type {
  SystemPerformance,
  ScorePrediction,
  PredictionResult,
  PerformanceSnapshot,
  ConditionStats,
  SubcategoryStats,
  SystemStats,
  PerformanceDataPoint,
} from './performanceService';

export type {
  QuestionAttemptRecord,
  DailyStudyRecord,
  LearningMilestone,
  AnalyticsSnapshot,
  SessionAnalyticsPayload,
} from './deepAnalyticsStore';

// ============================================================================
// DEPRECATION GUIDE
// ============================================================================
/**
 * ANALYTICS SERVICE CONSOLIDATION:
 *
 * Import pattern change:
 * OLD: import { performanceService } from '@/services/performanceService';
 * NEW: import { performanceService } from '@/services/analytics';
 *
 * OLD: import { advancedAnalytics } from '@/services/advancedUserAnalyticsEngine';
 * NEW: import { advancedAnalytics } from '@/services/analytics';
 */
