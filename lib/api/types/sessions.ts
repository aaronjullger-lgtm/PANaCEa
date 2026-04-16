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
 * Legacy priority buckets still consumed by older frontend session launchers.
 *
 * `A` maps to review-heavy cards, `B` is reserved for an intermediate bucket
 * that some older selectors used, and `C` maps to new-card exploration.
 */
export interface SessionPriorityBreakdown {
  A: number;
  B: number;
  C: number;
}

/**
 * Minimal persisted StudySession snapshot needed to resume or inspect a
 * generated session without reconstructing settings client-side.
 */
export interface StudySessionSnapshot {
  id: string;
  mode?: string | null;
  focus?: string | null;
  difficulty?: string | null;
  systemsTargeted: string[];
  blueprintStage?: string | null;
  blueprintLabel?: string | null;
  totalQuestions?: number | null;
}

/**
 * POST /api/study/session/generate response data (unwrapped).
 */
export interface SessionGenerateResult {
  sessionId: string;
  questions: QuestionDTO[];
  metadata: SessionMetadata;
  /** Legacy compatibility fields derived from `questions` + `metadata` when omitted. */
  questionIds?: string[];
  priorityBreakdown?: SessionPriorityBreakdown;
  initialDifficulty?: string;
}
