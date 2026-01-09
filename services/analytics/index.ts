/**
 * Analytics Services - Unified Exports
 * 
 * Consolidates all analytics and performance tracking services.
 * 
 * @example
 * import { analyticsService, performanceService, predictionService } from '@/services/analytics';
 */

// ============================================================================
// PRIMARY ANALYTICS
// ============================================================================

import * as advancedUserAnalyticsModule from '../advancedUserAnalyticsEngine';
import * as performanceServiceModule from '../performanceService';
import * as performancePredictionModule from '../performancePredictionService';

export const analyticsService = advancedUserAnalyticsModule;
export const performanceService = performanceServiceModule;
export const predictionService = performancePredictionModule;

// ============================================================================
// SCORE PREDICTION - PANCE/PANRE score estimation
// ============================================================================

import * as panaceScorePredictorModule from '../panaceScorePredictor';
import * as panceScorePredictorModule from '../panceScorePredictorService';

// Note: These two services have overlapping functionality
// Use panceScorePredictor for new code
export const scorePredictorService = panceScorePredictorModule;

// ============================================================================
// SESSION ANALYTICS
// ============================================================================

import * as sessionAnalyticsSyncModule from '../sessionAnalyticsSyncService';
import * as answerPatternModule from '../answerPatternService';

export const sessionAnalyticsService = sessionAnalyticsSyncModule;
export const answerPatternService = answerPatternModule;

// ============================================================================
// BEHAVIORAL ANALYTICS
// ============================================================================

import * as behavioralConfidenceModule from '../behavioralConfidenceService';
import * as sessionMomentumModule from '../sessionMomentumService';

export const behavioralService = behavioralConfidenceModule;
export const momentumService = sessionMomentumModule;

// ============================================================================
// DEEP ANALYTICS STORES
// ============================================================================

import * as deepAnalyticsStoreModule from '../deepAnalyticsStore';
import * as researchBackedAnalyticsModule from '../researchBackedAnalytics';

export const deepAnalyticsStore = deepAnalyticsStoreModule;
export const researchAnalytics = researchBackedAnalyticsModule;

// ============================================================================
// PREDICTIVE ENGINES
// ============================================================================

import * as predictiveAnalyticsEngineModule from '../predictiveAnalyticsEngine';
import * as masteryVelocityPredictorModule from '../masteryVelocityPredictor';

export const predictiveEngine = predictiveAnalyticsEngineModule;
export const masteryPredictor = masteryVelocityPredictorModule;

// ============================================================================
// DEPRECATION GUIDE
// ============================================================================
/**
 * ANALYTICS SERVICE CONSOLIDATION:
 * 
 * The following services have overlapping functionality:
 * 
 * SCORE PREDICTION (use scorePredictorService):
 * - panaceScorePredictor.ts → Primary
 * - panceScorePredictorService.ts → Legacy, to be deprecated
 * 
 * SESSION ANALYTICS (use sessionAnalyticsService):
 * - circadianAnalyticsService.ts → Specialized, keep separate
 * - studentInsightsService.ts → Integrated into analyticsService
 * 
 * BEHAVIORAL (use behavioralService):
 * - smartPauseService.ts → Keep for pause-specific logic
 * - learningPatternEngine.ts → Integrated into predictiveEngine
 */
