/**
 * PANaCEa Shared API Types — Sessions
 *
 * Request types derived from Zod schemas + response types for session
 * generation, configuration, and analytics.
 */

import type { QuestionDTO } from './questions';

// Re-export request types from Zod schemas
export type {
  SessionGenerateRequest,
  SessionConfig,
  SessionAnalyticsRequest,
} from '../schemas/sessions';

// =============================================================================
// SESSION GENERATION — RESPONSE
// =============================================================================

/** Metadata about how a session was generated. */
export interface SessionSelectionMix {
  dueReviewCount: number;
  resurfacedCount: number;
  newCardCount: number;
}

export interface SessionMetadata {
  dueReviewCount: number;
  newCardCount: number;
  systemDistribution: Record<string, number>;
  estimatedMinutes: number;
  mode: string;
  blueprintStage?: string;
  learnerPhase?: string;
  source: 'reservoir' | 'on_demand' | 'mixed';
  /**
   * Optional adaptive-selection metadata for debugging and analytics.
   * Kept optional so reservoir and legacy paths remain backward compatible.
   */
  adaptiveVersion?: 'v1';
  selectionMix?: SessionSelectionMix;
}

/**
 * POST /api/study/session/generate response data (unwrapped).
 */
export interface SessionGenerateResult {
  sessionId: string;
  questions: QuestionDTO[];
  metadata: SessionMetadata;
  /** Legacy fields some callers still read. */
  questionIds?: string[];
  priorityBreakdown?: Record<string, number>;
  initialDifficulty?: string;
}

/**
 * GET /api/study/session/:sessionId/questions response data (unwrapped).
 */
export interface SessionQuestionsResult {
  questions: QuestionDTO[];
}
