/**
 * Core Services - Unified Exports
 *
 * This barrel file consolidates core educational services.
 * Import from here instead of individual files for cleaner imports.
 *
 * @example
 * import { questionService, sessionService, attemptService } from '@/services/core';
 */

// ============================================================================
// QUESTION SERVICES - Primary question management
// ============================================================================

import * as questionServiceModule from './questionService';
import * as attemptServiceModule from './attemptService';
import * as questionPoolServiceModule from './questionPoolService';
import * as questionQualityServiceModule from './questionQualityService';
import * as questionSeedServiceModule from './questionSeedService';
import * as stagingQuestionServiceModule from './stagingQuestionService';
import * as variantQueueServiceModule from './variantQueueService';

export const questionService = questionServiceModule;
export const attemptService = attemptServiceModule;
export const questionPoolService = questionPoolServiceModule;
export const questionQualityService = questionQualityServiceModule;
export const questionSeedService = questionSeedServiceModule;
export const stagingQuestionService = stagingQuestionServiceModule;
export const variantQueueService = variantQueueServiceModule;

// Named exports for common operations (tree-shakeable)
export {
  getQuestion,
  getQuestionBatch,
  getOptimalQuestions,
  getEnhancedQuestion,
  getIntelligentQuestions,
  getWeakAreaQuestions,
  getReviewQuestions,
  calculateAdaptiveState,
  selectOptimalQuestions,
  convertPoolQuestion,
  fetchPearlsForQuestion,
  SYSTEM_CODE_MAP,
  SYSTEM_NAME_TO_CODE,
} from './questionService';

export { recordQuestionAttempt, getUserStats } from './attemptService';

// ============================================================================
// SESSION SERVICES - Session management and orchestration
// ============================================================================

import * as mainSessionServiceModule from './mainSessionService';
import * as customSessionServiceModule from './customSessionService';
import * as sessionServiceModule from './sessionService';
import * as noRepeatServiceModule from './noRepeatService';
import * as poolMonitorServiceModule from './poolMonitorService';

export const sessionService = mainSessionServiceModule;
export const customSessionService = customSessionServiceModule;
export const sessionMgmt = sessionServiceModule;
export const noRepeatService = noRepeatServiceModule;
export const poolMonitorService = poolMonitorServiceModule;

// Named exports from session services
export {
  fetchSessionQuestions,
  recordSessionAnswer,
  initializeSession,
  getPoolStatus,
  checkAndReplenishPool,
  getSessionSummary,
} from './mainSessionService';

// ============================================================================
// DRILL SERVICES - Drill-specific logic and statistics
// ============================================================================

import * as drillServiceModule from './drillService';
import * as drillStatsServiceModule from './drillStatsService';
import * as dailyTriadServiceModule from './dailyTriadService';
import * as wordleServiceModule from './wordleService';

export const drillService = drillServiceModule;
export const drillStatsService = drillStatsServiceModule;
export const dailyTriadService = dailyTriadServiceModule;
export const wordleService = wordleServiceModule;

// ============================================================================
// CONTENT SERVICES - Medical content and condition management
// ============================================================================

import * as conditionServiceModule from './conditionService';
import * as conditionContentServiceModule from './conditionContentService';
import * as conditionDataLoaderModule from './conditionDataLoader';

export const conditionService = conditionServiceModule;
export const conditionContentService = conditionContentServiceModule;
export const conditionDataLoader = conditionDataLoaderModule;

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
