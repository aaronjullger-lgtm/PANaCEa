/**
 * Core Services - Unified Exports
 *
 * This barrel file consolidates core educational services.
 * Import from here instead of individual files for cleaner imports.
 *
 * MOCK MODE:
 * Set VITE_USE_MOCK=true in .env to use MockSessionService for development
 * without a live database connection.
 *
 * @example
 * import { questionService, sessionService, attemptService } from '@/services/core';
 */

// ============================================================================
// MOCK MODE SUPPORT
// ============================================================================

import * as mockSessionServiceModule from './mockSessionService';

/**
 * Check if mock mode is enabled via environment variable
 */
export const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true';
};

// Export mock service for direct access when needed
export const mockSessionService = mockSessionServiceModule;
export { isMockModeEnabled, getRandomMockPatient, getAllMockPatients } from './mockSessionService';

// ============================================================================
// QUESTION SERVICES - Primary question management
// ============================================================================

// REMOVED: questionService - re-exports from AI services that have @prisma/client
// import * as questionServiceModule from './questionService';
import * as attemptServiceModule from './attemptService';
// REMOVED: questionPoolService - has runtime prisma import, server-only
import * as questionQualityServiceModule from './questionQualityService';
// REMOVED: questionSeedService - has runtime prisma import, server-only
// REMOVED: stagingQuestionService - has runtime prisma import, server-only
// REMOVED: variantQueueService - has @prisma/client import, server-only

// REMOVED: questionService - re-exports from AI services that have @prisma/client
// export const questionService = questionServiceModule;
export const attemptService = attemptServiceModule;
// export const questionPoolService = questionPoolServiceModule; // SERVER-ONLY: use API
export const questionQualityService = questionQualityServiceModule;
// export const questionSeedService = questionSeedServiceModule; // SERVER-ONLY: use API
// export const stagingQuestionService = stagingQuestionServiceModule; // SERVER-ONLY: use API
// export const variantQueueService = variantQueueServiceModule; // SERVER-ONLY: use API

// REMOVED: Named exports from questionService - pulls in @prisma/client via AI service re-exports
// export {
//   getQuestion,
//   getQuestionBatch,
//   getOptimalQuestions,
//   getEnhancedQuestion,
//   getIntelligentQuestions,
//   getWeakAreaQuestions,
//   getReviewQuestions,
//   calculateAdaptiveState,
//   selectOptimalQuestions,
//   convertPoolQuestion,
//   fetchPearlsForQuestion,
//   SYSTEM_CODE_MAP,
//   SYSTEM_NAME_TO_CODE,
// } from './questionService';

export { recordQuestionAttempt, getUserStats } from './attemptService';

// ============================================================================
// SESSION SERVICES - Session management and orchestration
// ============================================================================

import * as mainSessionServiceModule from './mainSessionService';
import * as customSessionServiceModule from './customSessionService';
import * as sessionServiceModule from './sessionService';
// NOTE: poolMonitorService is SERVER-ONLY (uses PrismaClient) - import directly in server code

export const sessionService = mainSessionServiceModule;
export const customSessionService = customSessionServiceModule;
export const sessionMgmt = sessionServiceModule;
// export const noRepeatService = noRepeatServiceModule; // SERVER-ONLY: use API
// export const poolMonitorService = poolMonitorServiceModule; // SERVER-ONLY: use API

// Named exports from session services
export {
  fetchSessionQuestions,
  recordSessionAnswer,
  initializeSession,
  getPoolStatus,
  checkAndReplenishPool,
  getSessionSummary,
  prefetchQuestions,
} from './mainSessionService';

// ============================================================================
// DRILL SERVICES - Drill-specific logic and statistics
// ============================================================================

import * as drillServiceModule from './drillService';
import * as drillStatsServiceModule from './drillStatsService';
import * as dailyTriadServiceModule from './dailyTriadService';
// REMOVED: wordleService - has runtime prisma import, server-only

export const drillService = drillServiceModule;
export const drillStatsService = drillStatsServiceModule;
export const dailyTriadService = dailyTriadServiceModule;
// export const wordleService = wordleServiceModule; // SERVER-ONLY: use API

// Named exports from drill services
export { submitDrillResult } from './drillService';

export {
  getDrillLandingStats,
  getCategoryBreakdown,
  recordDrillSession,
  getRecommendedDifficulty,
  getDrillStats,
  getAllDrillStats,
  getDrillProgress,
  calculateNextDifficulty,
} from './drillStatsService';

// ============================================================================
// CONTENT SERVICES - Medical content and condition management
// ============================================================================

import * as conditionServiceModule from '../conditionService';
import * as conditionContentServiceModule from '../conditionContentService';
// REMOVED: conditionDataLoader - has runtime prisma import, server-only

export const conditionService = conditionServiceModule;
export const conditionContentService = conditionContentServiceModule;
// export const conditionDataLoader = conditionDataLoaderModule; // SERVER-ONLY: use API

// ============================================================================
// SUPPORT SERVICES - Coaching, feedback, and other utilities
// ============================================================================

import * as coachingServiceModule from './CoachingService';
import * as feedbackServiceModule from './feedbackService';

export const coachingService = coachingServiceModule;
export const feedbackService = feedbackServiceModule;

// ============================================================================
// TYPES - Common types
// ============================================================================
// Types are exported from their respective service modules via namespace imports above
// Access via: questionService.SomeType, sessionService.SomeType, etc.

// ============================================================================
// DEPRECATION GUIDE
// ============================================================================
/**
 * SERVICE CONSOLIDATION GUIDE:
 *
 * Import pattern change:
 * OLD: import { getQuestion } from '@/services/questionService';
 * NEW: import { questionService } from '@/services/core';
 *      questionService.getQuestion(...);
 *
 * Or use named exports:
 * NEW: import { getQuestion } from '@/services/core';
 */
