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
export interface SessionMetadata {
  dueReviewCount: number;
  newCardCount: number;
  systemDistribution: Record<string, number>;
  estimatedMinutes: number;
  mode: string;
  blueprintStage?: string;
  learnerPhase?: string;
  source: 'reservoir' | 'on_demand' | 'mixed';
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
