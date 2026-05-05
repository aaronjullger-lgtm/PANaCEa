/**
 * PANaCEa Shared API Types — Questions
 *
 * Request types derived from Zod schemas + response types matching
 * the actual shapes returned by /api/questions/attempt.
 */

// Re-export request types from Zod schemas
export type { QuestionAttemptRequest, FlagQuestionRequest } from '../schemas/questions';

// =============================================================================
// QUESTION ATTEMPT — RESPONSE
// =============================================================================

/** System-level performance statistics returned with each attempt. */
export interface SystemStats {
  system: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  recentTrend: 'improving' | 'declining' | 'neutral';
}

/**
 * POST /api/questions/attempt response data (unwrapped).
 */
export interface QuestionAttemptResult {
  success: boolean;
  attemptId: string;
  stats: {
    totalQuestionsAnswered: number;
    correctAnswers: number;
    overallAccuracy: number;
  };
  systemStats?: SystemStats;
  nextReviewDate?: string;
}

// =============================================================================
// QUESTION DTO (shared between session generation and drill endpoints)
// =============================================================================

/**
 * Question data transfer object — the shape a question takes when sent
 * from the server to the client, regardless of endpoint.
 *
 * Used by: session generation, drill batches, reservoir, question bank.
 */
export interface QuestionDTO {
  id: string;
  questionId?: string | null;
  canonicalQuestionId?: string | null;
  sourceQuestionId?: string | null;
  questionSource?: 'question' | 'pre_generated' | 'staging' | 'seed' | 'generated';
  question: string;
  vignette?: string | null;
  options: string[];
  correctAnswer: string;
  correctAnswerIndex: number;
  explanation?: string | null;
  system?: string | null;
  category?: string;
  topic?: string;
  difficulty?: string | null;
  conditionId?: string | null;
  medicalContentId?: string | null;
  /** How this question was sourced for the session. */
  source?: 'due_review' | 'new_card' | 'reservoir' | 'on_demand' | 'pre_generated' | 'question';
}
