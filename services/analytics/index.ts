/**
 * Analytics Services - Unified Exports
 *
 * FORTRESS MODE: Consolidated analytics and performance prediction services.
 *
 * @example
 * import { predictScore, NCCPA_BLUEPRINT_WEIGHTS, PANCE_CONSTANTS } from '@/services/analytics';
 */

// ============================================================================
// UNIFIED PERFORMANCE SERVICE (Phase 6 Consolidation)
// ============================================================================
// Merged from:
// - performanceService.ts (localStorage recording)
// - panaceScorePredictor.ts (simple domain weights)
// - panceScorePredictorService.ts (IRT-based prediction)
// - performancePredictionService.ts (session-scoped)

export {
  // Main prediction function
  predictScore,
  
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

// ============================================================================
// LEGACY EXPORTS (Deprecated - Use unified API above)
// ============================================================================
// These maintain backward compatibility during migration

import * as advancedUserAnalyticsModule from '../advancedUserAnalyticsEngine';
import * as circadianAnalyticsModule from '../circadianAnalyticsService';
import * as deepAnalyticsModule from '../deepAnalyticsStore';

/**
 * @deprecated Use imports from './performanceService' directly
 */
export const analyticsService = advancedUserAnalyticsModule;

/**
 * @deprecated Functionality merged into performanceService
 */
export const circadianAnalytics = circadianAnalyticsModule;

/**
 * @deprecated Use predictScore() from performanceService
 */
export const deepAnalytics = deepAnalyticsModule;
