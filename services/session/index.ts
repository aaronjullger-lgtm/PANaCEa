/**
 * Session Services - Unified Exports
 *
 * FORTRESS MODE: Consolidated session management services.
 *
 * @example
 * import { 
 *   fetchSessionQuestions, 
 *   recordQuestionAttempt,
 *   shouldTakeBreak 
 * } from '@/services/session';
 */

// ============================================================================
// UNIFIED SESSION SERVICE
// ============================================================================

export {
  // Unified API
  recordQuestionAttempt,
  getFullSessionState,
  shouldTakeBreak,
  startNewSession,
  endSessionWithSummary,
  
  // Main session
  initializeSession,
  getSessionState,
  endSession,
  fetchSessionQuestions,
  prefetchQuestions,
  recordSessionAnswer,
  getSessionSummary,
  getPoolStatus,
  checkAndReplenishPool,
  
  // Momentum
  recordMomentumResult,
  calculateMomentum,
  resetMomentum,
  getMomentumInsights,
  detectFatigueSignals,
  
  // Optimizer
  analyzeCognitiveState,
  optimizeSession,
  calculateOptimalSessionLength,
  predictFatiguePoint,
  
  // Types
  type FullSessionState,
  type MomentumLevel,
  type MomentumState,
  type CognitiveSnapshot,
  type SessionOptimization,
  type PerformanceMetrics,
  type SessionSettings,
  type Question,
} from './sessionService';

// Default export for namespace access
export { default as sessionService } from './sessionService';

// ============================================================================
// LEGACY EXPORTS (Deprecated)
// ============================================================================

import * as mainSessionModule from '../mainSessionService';
import * as momentumModule from '../sessionMomentumService';
import * as optimizerModule from '../realTimeSessionOptimizer';

/** @deprecated Use sessionService or direct imports */
export const mainSession = mainSessionModule;

/** @deprecated Use momentum functions from sessionService */
export const sessionMomentum = momentumModule;

/** @deprecated Use optimizer functions from sessionService */
export const realTimeOptimizer = optimizerModule;
