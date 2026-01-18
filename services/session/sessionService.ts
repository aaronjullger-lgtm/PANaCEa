/**
 * Unified Session Service
 *
 * FORTRESS MODE: Consolidated session management (Phase 6)
 *
 * Merges functionality from:
 * - mainSessionService.ts (orchestration, question fetching)
 * - sessionMomentumService.ts (momentum/flow tracking)
 * - realTimeSessionOptimizer.ts (cognitive optimization)
 *
 * @module services/session/sessionService
 */

import * as mainSession from '../mainSessionService';
import * as momentum from '../sessionMomentumService';
import * as optimizer from '../realTimeSessionOptimizer';

// ============================================================================
// Re-exports from Main Session Service
// ============================================================================

export {
  // Session lifecycle
  initializeSession,
  getSessionState,
  endSession,

  // Question management
  fetchSessionQuestions,
  prefetchQuestions,

  // Recording
  recordSessionAnswer,

  // Summary
  getSessionSummary,

  // Pool management
  getPoolStatus,
  checkAndReplenishPool,
} from '../mainSessionService';

// Re-export types
export type { SessionSettings, Question } from '../../types';

// ============================================================================
// Re-exports from Momentum Service
// ============================================================================

export {
  // Momentum tracking
  recordMomentumResult,
  calculateMomentum,
  resetMomentum,
  getMomentumInsights,

  // Fatigue detection
  detectFatigueSignals,

  // Types
  type MomentumLevel,
  type MomentumState,
} from '../sessionMomentumService';

// ============================================================================
// Re-exports from Real-Time Optimizer
// ============================================================================

export {
  // Cognitive analysis
  analyzeCognitiveState,

  // Session optimization
  optimizeSession,
  calculateOptimalSessionLength,
  predictFatiguePoint,

  // Types
  type CognitiveSnapshot,
  type SessionOptimization,
  type PerformanceMetrics,
} from '../realTimeSessionOptimizer';

// ============================================================================
// Unified High-Level API
// ============================================================================

/**
 * Complete session state with all metrics
 */
export interface FullSessionState {
  session: ReturnType<typeof mainSession.getSessionState>;
  momentum: momentum.MomentumState;
  cognitive: optimizer.CognitiveSnapshot | null;
  optimization: optimizer.SessionOptimization | null;
  fatigueSignals: { isFatigued: boolean; signals: string[] };
}

/**
 * Record a question attempt with full tracking
 * Combines all recording functions into one
 */
export function recordQuestionAttempt(
  questionId: string,
  isCorrect: boolean,
  system: string,
  timeSpentMs: number,
  parTimeMs: number = 60000
): void {
  // Record in main session
  mainSession.recordSessionAnswer(questionId, isCorrect, system, timeSpentMs);

  // Record for momentum tracking
  momentum.recordMomentumResult(isCorrect, timeSpentMs, parTimeMs);
}

/**
 * Get complete session state including all metrics
 */
export function getFullSessionState(
  recentAttempts?: { wasCorrect: boolean; responseTimeMs: number; timestamp: Date }[]
): FullSessionState {
  const session = mainSession.getSessionState();
  const momentumState = momentum.calculateMomentum();
  const fatigueSignals = momentum.detectFatigueSignals();

  let cognitive: optimizer.CognitiveSnapshot | null = null;
  let optimizationResult: optimizer.SessionOptimization | null = null;

  if (recentAttempts && recentAttempts.length > 0 && session) {
    cognitive = optimizer.analyzeCognitiveState(recentAttempts, new Date(session.startTime));

    const metrics: optimizer.PerformanceMetrics = {
      questionsAttempted: session.questionsAnswered,
      correctAnswers: session.correctAnswers,
      avgResponseTimeMs:
        session.questionsAnswered > 0 ? session.totalTimeMs / session.questionsAnswered : 0,
      responseTimeTrend:
        momentumState.speedTrend === 'faster'
          ? 'faster'
          : momentumState.speedTrend === 'slower'
            ? 'slower'
            : 'stable',
      accuracyTrend:
        momentumState.recentAccuracy > 70
          ? 'improving'
          : momentumState.recentAccuracy < 50
            ? 'declining'
            : 'stable',
      sessionDurationMinutes: (Date.now() - session.startTime) / 60000,
    };

    // Convert system performance to accuracy map
    const systemAccuracies: Record<string, number> = {};
    for (const [sys, stats] of Object.entries(session.systemPerformance)) {
      systemAccuracies[sys] = stats.total > 0 ? stats.correct / stats.total : 0;
    }

    const currentSystem = Object.keys(session.systemPerformance)[0] || 'general';
    optimizationResult = optimizer.optimizeSession(
      cognitive,
      metrics,
      currentSystem,
      systemAccuracies
    );
  }

  return {
    session,
    momentum: momentumState,
    cognitive,
    optimization: optimizationResult,
    fatigueSignals,
  };
}

/**
 * Check if user should take a break (combines multiple signals)
 */
export function shouldTakeBreak(): {
  shouldBreak: boolean;
  urgency: 'low' | 'medium' | 'high';
  reasons: string[];
} {
  const momentumState = momentum.calculateMomentum();
  const fatigue = momentum.detectFatigueSignals();
  const reasons: string[] = [];
  let urgency: 'low' | 'medium' | 'high' = 'low';

  if (fatigue.isFatigued) {
    reasons.push(...fatigue.signals);
    urgency = 'high';
  }

  if (momentumState.level === 'cold' || momentumState.level === 'cooling') {
    reasons.push(`Momentum is ${momentumState.level}`);
    if (urgency === 'low') urgency = 'medium';
  }

  if (momentumState.recommendation?.toLowerCase().includes('break')) {
    reasons.push(momentumState.recommendation);
    if (urgency === 'low') urgency = 'medium';
  }

  return {
    shouldBreak: reasons.length > 0,
    urgency,
    reasons,
  };
}

/**
 * Start a new session with full initialization
 */
export function startNewSession() {
  momentum.resetMomentum();
  return mainSession.initializeSession();
}

/**
 * End session and get complete summary
 */
export function endSessionWithSummary() {
  const summary = mainSession.getSessionSummary();
  const momentumInsights = momentum.getMomentumInsights();
  const session = mainSession.endSession();

  return {
    session,
    summary,
    momentumInsights,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Namespaces for full access
  mainSession,
  momentum,
  optimizer,

  // Unified API
  recordQuestionAttempt,
  getFullSessionState,
  shouldTakeBreak,
  startNewSession,
  endSessionWithSummary,

  // Main session
  initializeSession: mainSession.initializeSession,
  getSessionState: mainSession.getSessionState,
  endSession: mainSession.endSession,
  fetchSessionQuestions: mainSession.fetchSessionQuestions,
  recordSessionAnswer: mainSession.recordSessionAnswer,
  getSessionSummary: mainSession.getSessionSummary,

  // Momentum
  calculateMomentum: momentum.calculateMomentum,
  getMomentumInsights: momentum.getMomentumInsights,
  detectFatigueSignals: momentum.detectFatigueSignals,

  // Optimizer
  analyzeCognitiveState: optimizer.analyzeCognitiveState,
  optimizeSession: optimizer.optimizeSession,
  predictFatiguePoint: optimizer.predictFatiguePoint,
};
