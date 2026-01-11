/**
 * Core Services - Unified Exports
 * 
 * This barrel file consolidates related services into logical groups.
 * Import from here instead of individual files for cleaner imports.
 * 
 * @example
 * import { questionService, sessionService, attemptService } from '@/services/core';
 */

// ============================================================================
// QUESTION SERVICES - Primary question management (CONSOLIDATED)
// ============================================================================

// NEW: Unified question service that consolidates 4 legacy services
import * as consolidatedQuestionService from './questionService';
import * as attemptServiceModule from '../attemptService';

// Re-export as namespaced services
export const questionService = consolidatedQuestionService;
export const attemptService = attemptServiceModule;

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

// Named exports from attemptService
export {
  recordQuestionAttempt,
  getUserStats,
} from '../attemptService';

// ============================================================================
// SESSION SERVICES - Session management
// ============================================================================

import * as mainSessionServiceModule from '../mainSessionService';
import * as customSessionServiceModule from '../customSessionService';

export const sessionService = mainSessionServiceModule;
export const customSessionService = customSessionServiceModule;

// Named exports from sessionService
export {
  fetchSessionQuestions,
  recordSessionAnswer,
  initializeSession,
  getPoolStatus,
  checkAndReplenishPool,
  getSessionSummary,
} from '../mainSessionService';

// ============================================================================
// DRILL SERVICES - Drill-specific logic
// ============================================================================

import * as drillServiceModule from '../drillService';
import * as drillStatsServiceModule from '../drillStatsService';

export const drillService = drillServiceModule;
export const drillStatsService = drillStatsServiceModule;

// ============================================================================
// CONTENT SERVICES - Medical content management
// ============================================================================

import * as conditionServiceModule from '../conditionService';
import * as conditionContentServiceModule from '../conditionContentService';

export const conditionService = conditionServiceModule;
export const conditionContentService = conditionContentServiceModule;

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
 * The following services are being consolidated. Use the unified services above.
 * 
 * QUESTION-RELATED (use questionService):
 * - enhancedQuestionService.ts → Use questionService with enhanced options
 * - intelligentQuestionService.ts → Use questionService with adaptive mode
 * - adaptiveQuestionEngine.ts → Integrated into questionService
 * - questionSeedService.ts → Use server-side questionPoolService
 * - stagingQuestionService.ts → Use server-side questionPoolService with staging flag
 * 
 * SESSION-RELATED (use sessionService):
 * - sessionMomentumService.ts → Integrated into sessionService
 * - realTimeSessionOptimizer.ts → Integrated into sessionService
 * - contextAwareOrchestrator.ts → Integrated into sessionService
 * 
 * Import pattern change:
 * OLD: import { getQuestion } from '@/services/questionService';
 * NEW: import { questionService } from '@/services/core';
 *      questionService.getQuestion(...);
 */
