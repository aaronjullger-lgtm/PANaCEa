/**
 * PANaCEa Shared Schemas — Questions
 *
 * Zod validation schemas for question attempt and generation endpoints.
 * Canonical contract for /api/questions/attempt.
 */

import { z } from 'zod';

// =============================================================================
// QUESTION ATTEMPT — REQUEST
// =============================================================================

/**
 * POST /api/questions/attempt request body.
 *
 * Records a question attempt with correctness and optional telemetry.
 * Note: FSRS updates go through /api/drills/submit-review, not here.
 */
export const QuestionAttemptRequestSchema = z
  .object({
    questionId: z.string().min(1).max(100),
    isCorrect: z.boolean().optional(),
    wasCorrect: z.boolean().optional(),
    system: z.string().optional(),
    conditionId: z.string().min(1).max(100).optional(),
    medicalContentId: z.string().optional(),
    questionType: z.string().max(50).optional(),
    mode: z
      .enum(['drill', 'session', 'review', 'exam', 'rapid_recall'])
      .optional()
      .default('session'),
    timeSpent: z.number().int().min(0).max(600000).optional(),
    timeSpentMs: z.number().int().min(0).max(600000).optional(),
    answerChangedCount: z.number().int().min(0).max(100).optional(),
    isRankedAttempt: z.boolean().optional().default(false),
    selectedAnswer: z
      .union([z.number().int().min(0).max(4), z.enum(['A', 'B', 'C', 'D', 'E'])])
      .optional(),
    telemetryJson: z.record(z.string(), z.unknown()).optional(),
    durationMs: z.number().optional(),
    isMainSession: z.boolean().optional().default(false),
    rating: z.number().int().min(1).max(4).optional(),
  })
  .refine((data) => data.isCorrect !== undefined || data.wasCorrect !== undefined, {
    message: 'Either isCorrect or wasCorrect must be provided',
  });

// =============================================================================
// QUESTION FLAGGING — REQUEST
// =============================================================================

/**
 * POST /api/questions/flag request body.
 * Matches the actual inline schema in functions/api/questions/flag/index.ts.
 */
export const FlagQuestionRequestSchema = z.object({
  userEmail: z.string().email().optional(),
  userFirstName: z.string().max(100).optional(),
  questionId: z.string().min(1).max(100),
  questionText: z.string().optional(),
  correctAnswer: z.string().max(500).optional(),
  topic: z.string().max(100).optional(),
  system: z.string().max(100).optional(),
  flagType: z.enum(['typo', 'incorrect_answer', 'unclear', 'outdated', 'other']),
  description: z.string().min(1).max(1000),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type QuestionAttemptRequest = z.infer<typeof QuestionAttemptRequestSchema>;
export type FlagQuestionRequest = z.infer<typeof FlagQuestionRequestSchema>;
