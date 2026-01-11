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
// Merged from: performanceService, panaceScorePredictor,
// panceScorePredictorService, performancePredictionService

export {
  // Main prediction function
  predictScore,

  // Legacy prediction function (prefer predictScore for new code)
  predictPANCEScore,

  // Constants
  NCCPA_BLUEPRINT_WEIGHTS,
  PANCE_CONSTANTS,

  // Types
  type SystemPerformance,
  type ScorePrediction,
  type PredictionResult,
  type PerformanceSnapshot,
  type ConditionStats,
  type SubcategoryStats,
  type SystemStats,
  type PerformanceDataPoint,
  type ISystemPerformance,
  type IrtPredictedScore,
  type HistoricalPrediction,

  // Recording & Stats
  recordQuestionOutcome,
  getHierarchicalStats,
  clearPerformanceCache,

  // Session prediction
  updatePerformancePrediction,
  getSessionPrediction,
  getConfidenceInterval,
  resetPrediction,
  calculateTrend,

  // Class-based predictor
  PANCEScorePredictorService,
} from './performanceService';

// Direct export of getPrediction for components that use it
export { getPrediction } from '../performancePredictionService';

// ============================================================================
// USER ANALYTICS SERVICE (Phase 6 Consolidation)
// ============================================================================
// Merged from: advancedUserAnalyticsEngine, circadianAnalyticsService,
// researchBackedAnalytics

export {
  // Namespaces for full access
  advancedAnalytics,
  circadianAnalytics,
  researchAnalytics,

  // High-level unified API
  getFullAnalyticsSnapshot,
  getQuickStatus,
  getOptimalConditions,
  checkBreakNeeded,

  // Cognitive state
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

  // Circadian
  isLateNightStudying,
  getCircadianInsights,
  analyzeCircadianPerformance,

  // FSRS personalization
  calculatePersonalizedFSRS,
  getSystemFSRSAdjustments,

  // Research-backed analysis
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
} from './userAnalyticsService';

// Additional exports from circadianAnalyticsService
export { recordCircadianPerformance } from '../circadianAnalyticsService';

// Alias for cleaner imports
export { default as userAnalytics } from './userAnalyticsService';

// ============================================================================
// ANALYTICS STORAGE (deepAnalyticsStore + sessionAnalyticsSyncService)
// ============================================================================

export {
  // Storage operations
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

  // Types
  type QuestionAttemptRecord,
  type DailyStudyRecord,
  type LearningMilestone,
  type AnalyticsSnapshot,
} from '../deepAnalyticsStore';

export {
  // Session sync
  collectSessionAnalytics,
  syncSessionAnalytics,
  processPendingSync,
  fetchLearningProfile,

  // Types
  type SessionAnalyticsPayload,
} from '../sessionAnalyticsSyncService';

// ============================================================================
// LEGACY EXPORTS (Deprecated - Use unified API above)
// ============================================================================

import * as advancedUserAnalyticsModule from '../advancedUserAnalyticsEngine';
import * as circadianAnalyticsModule from '../circadianAnalyticsService';
import * as deepAnalyticsModule from '../deepAnalyticsStore';

/**
 * @deprecated Use userAnalytics or direct imports from userAnalyticsService
 */
export const analyticsService = advancedUserAnalyticsModule;

/**
 * @deprecated Use circadianAnalytics from userAnalyticsService
 */
export const circadianService = circadianAnalyticsModule;

/**
 * @deprecated Use storage functions directly from this module
 */
export const deepAnalytics = deepAnalyticsModule;
