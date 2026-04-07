/**
 * PANaCEa Shared Schemas — Sessions
 *
 * Zod schemas for session generation and configuration endpoints.
 */

import { z } from 'zod';

// =============================================================================
// SESSION GENERATION — REQUEST
// =============================================================================

/**
 * POST /api/study/session/generate request body.
 */
export const SessionGenerateRequestSchema = z.object({
  mode: z
    .enum(['adaptive', 'system', 'subcategory', 'condition', 'review', 'focused'])
    .optional()
    .default('adaptive'),
  size: z.number().int().min(5).max(100).optional().default(20),
  blueprintWeights: z.record(z.string(), z.number()).optional().default({}),
  system: z.string().optional(),
  subcategory: z.string().optional(),
  conditionId: z.string().optional(),
  boostSystems: z.array(z.string()).optional(),
  suppressSystems: z.array(z.string()).optional(),
  perSystemCaps: z.record(z.string(), z.number()).optional(),
  blueprintStage: z.string().optional().default('general'),
  blueprintExamTypes: z.array(z.string()).optional(),
  blueprintLabel: z.string().optional(),
  urgencyMultiplier: z.number().min(0).max(3).optional().default(1),
  gatedSystems: z.array(z.string()).optional(),
  systems: z.array(z.string()).optional(),
  initialDifficulty: z.string().optional(),
  /**
   * Session lane for blueprint enforcement:
   * - 'main' → blueprint-distributed PANCE readiness
   * - 'eor'  → rotation-specific EOR prep
   * - 'drill' → lightweight drill mode
   */
  sessionLane: z.enum(['main', 'eor', 'drill']).optional(),
  /** EOR-specific: deadline date for spaced repetition clamping (ISO string). */
  eorDeadline: z.string().optional(),
});

// =============================================================================
// SESSION CONFIG (for session settings / custom sessions)
// =============================================================================

/** Session configuration used by the session settings UI. */
export const SessionConfigSchema = z.object({
  questionCount: z.number().int().min(5).max(100).default(20),
  systems: z
    .array(
      z.enum([
        'cardiovascular',
        'pulmonary',
        'gastrointestinal',
        'musculoskeletal',
        'heent',
        'reproductive',
        'neurological',
        'psychiatry',
        'endocrine',
        'dermatology',
        'genitourinary',
        'hematology',
        'infectious_disease',
        'nephrology',
        'emergency_medicine',
      ])
    )
    .min(1)
    .max(15)
    .optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  mode: z.enum(['drill', 'session', 'review', 'exam', 'rapid_recall']).optional().default('session'),
  includeNew: z.boolean().optional().default(true),
  includeReview: z.boolean().optional().default(true),
  includeMissed: z.boolean().optional().default(false),
  interleaved: z.boolean().optional().default(true),
});

// =============================================================================
// SESSION ANALYTICS — REQUEST
// =============================================================================

/** POST /api/analytics/session request body. */
export const SessionAnalyticsRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  totalQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  totalTimeMs: z.number().int().min(0),
  bestStreak: z.number().int().min(0).optional(),
  finalStreak: z.number().int().min(0).optional(),
  totalAnswerChanges: z.number().int().min(0).optional(),
  systemsCovered: z
    .array(
      z.enum([
        'cardiovascular',
        'pulmonary',
        'gastrointestinal',
        'musculoskeletal',
        'heent',
        'reproductive',
        'neurological',
        'psychiatry',
        'endocrine',
        'dermatology',
        'genitourinary',
        'hematology',
        'infectious_disease',
        'nephrology',
        'emergency_medicine',
      ])
    )
    .optional(),
  mode: z.enum(['drill', 'session', 'review', 'exam', 'rapid_recall']).optional(),
  focus: z.string().max(50).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type SessionGenerateRequest = z.infer<typeof SessionGenerateRequestSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type SessionAnalyticsRequest = z.infer<typeof SessionAnalyticsRequestSchema>;
