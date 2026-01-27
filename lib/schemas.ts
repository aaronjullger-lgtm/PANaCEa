/**
 * Shared Zod Schemas for PANaCEa
 *
 * These schemas define the contract between frontend and backend.
 * Use these for:
 * - Frontend form validation
 * - Backend request validation
 * - Type inference (z.infer<typeof Schema>)
 *
 * IMPORT PATH:
 *   Frontend: import { SessionSchema } from '@/lib/schemas';
 *   Backend:  import { SessionSchema } from '../_shared/schemas';
 *
 * @see https://zod.dev for Zod documentation
 */

import { z } from 'zod';

// ============================================================================
// COMMON PRIMITIVES
// ============================================================================

/**
 * UUID validation for IDs
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * Clerk user ID format (user_xxxxx)
 */
export const ClerkUserIdSchema = z
  .string()
  .regex(/^user_[a-zA-Z0-9]+$/, 'Invalid Clerk user ID format');

/**
 * Timestamp as ISO string or Date
 */
export const TimestampSchema = z.union([
  z.string().datetime({ message: 'Invalid ISO datetime string' }),
  z.date(),
]);

/**
 * Positive integer (for counts, limits, etc.)
 */
export const PositiveIntSchema = z.coerce
  .number()
  .int('Must be an integer')
  .positive('Must be positive');

// ============================================================================
// SESSION SCHEMAS
// ============================================================================

/**
 * Organ System enum matching NCCPA Blueprint
 */
export const OrganSystemSchema = z.enum([
  'CARDIOVASCULAR',
  'PULMONARY',
  'GASTROINTESTINAL',
  'MUSCULOSKELETAL',
  'HEENT',
  'REPRODUCTIVE',
  'NEUROLOGICAL',
  'PSYCHIATRY',
  'ENDOCRINE',
  'DERMATOLOGY',
  'GENITOURINARY',
  'HEMATOLOGY',
  'INFECTIOUS_DISEASE',
  'NEPHROLOGY',
  'EMERGENCY_MEDICINE',
]);

export type OrganSystem = z.infer<typeof OrganSystemSchema>;

/**
 * Session type enum
 */
export const SessionTypeSchema = z.enum([
  'MAIN',           // Standard study session
  'RAPID_REVIEW',   // Quick review of due cards
  'DEEP_LEARNING',  // Extended learning mode
  'EXAM_SIMULATION', // Timed exam practice
  'CUSTOM',         // Custom session with specific settings
  'CRAM',           // Cram mode (excluded from SRS stats)
]);

export type SessionType = z.infer<typeof SessionTypeSchema>;

/**
 * Difficulty levels
 */
export const DifficultySchema = z.enum(['easy', 'medium', 'hard', 'adaptive']);

/**
 * Session preferences for customization
 */
export const SessionPreferencesSchema = z.object({
  questionCount: z.coerce.number().int().min(5).max(100).default(20),
  systems: z.array(OrganSystemSchema).min(1).max(15).optional(),
  excludeRecent: z.boolean().default(true),
  targetDifficulty: DifficultySchema.default('adaptive'),
  focusWeakAreas: z.boolean().default(true),
  timedMode: z.boolean().default(false),
  timePerQuestion: z.coerce.number().int().min(30).max(300).optional(), // seconds
});

export type SessionPreferences = z.infer<typeof SessionPreferencesSchema>;

/**
 * Session creation request
 * Used by: /api/questions/session (POST)
 */
export const SessionCreateSchema = z.object({
  sessionType: SessionTypeSchema,
  preferences: SessionPreferencesSchema.optional(),
});

export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;

/**
 * Session record (database representation)
 */
export const SessionRecordSchema = z.object({
  id: UUIDSchema,
  userId: z.string(), // Can be Clerk ID or UUID
  sessionType: SessionTypeSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
  totalQuestions: PositiveIntSchema.default(0),
  correctAnswers: z.coerce.number().int().min(0).default(0),
  accuracy: z.coerce.number().min(0).max(100).default(0),
  totalTimeMs: z.coerce.number().int().min(0).default(0),
  preferences: SessionPreferencesSchema.optional(),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;

// ============================================================================
// QUESTION SCHEMAS
// ============================================================================

/**
 * Question type enum
 */
export const QuestionTypeSchema = z.enum([
  'clinical_vignette',
  'lab_interpretation',
  'differential_diagnosis',
  'pharmacology',
  'basic_science',
  'procedure',
  'emergency',
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/**
 * FSRS rating (1-4 scale)
 */
export const FSRSRatingSchema = z.union([
  z.literal(1), // Again
  z.literal(2), // Hard
  z.literal(3), // Good
  z.literal(4), // Easy
]);

export type FSRSRating = z.infer<typeof FSRSRatingSchema>;

/**
 * Question answer submission
 */
export const QuestionAnswerSchema = z.object({
  questionId: UUIDSchema,
  selectedAnswer: z.coerce.number().int().min(0).max(4),
  timeSpentMs: z.coerce.number().int().min(0).max(3600000), // Max 1 hour
  rating: FSRSRatingSchema.optional(),
  confidence: z.coerce.number().min(0).max(100).optional(),
});

export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;

/**
 * Question generation request
 */
export const QuestionGenerationSchema = z.object({
  conditionId: z.string().min(2).max(100),
  questionType: QuestionTypeSchema,
  difficulty: DifficultySchema.optional(),
  system: OrganSystemSchema.optional(),
});

export type QuestionGenerationInput = z.infer<typeof QuestionGenerationSchema>;

// ============================================================================
// REVIEW SCHEMAS
// ============================================================================

/**
 * SRS Review submission
 */
export const ReviewSubmissionSchema = z.object({
  questionId: UUIDSchema,
  userAnswer: z.string().min(1).max(5000),
  rating: FSRSRatingSchema,
  timeSpentMs: z.coerce.number().int().min(0).max(3600000),
  confidence: z.coerce.number().min(0).max(100).optional(),
  sessionId: z.string().optional(),
  sessionType: SessionTypeSchema.optional(),
});

export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

/**
 * Session analytics recording
 */
export const SessionAnalyticsSchema = z.object({
  sessionId: z.string().min(1),
  startedAt: TimestampSchema,
  endedAt: TimestampSchema,
  totalQuestions: PositiveIntSchema,
  correctAnswers: z.coerce.number().int().min(0).default(0),
  accuracy: z.coerce.number().min(0).max(100).default(0),
  totalTimeMs: z.coerce.number().int().min(0).default(0),
  systemBreakdown: z.record(OrganSystemSchema, z.object({
    correct: z.number().int().min(0),
    total: z.number().int().min(0),
  })).optional(),
});

export type SessionAnalytics = z.infer<typeof SessionAnalyticsSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse with helpful error messages
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const errors = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(`${context ? `${context}: ` : ''}Validation failed - ${errors}`);
}

/**
 * Safe parse that returns null on failure (for optional validation)
 */
export function safeParseSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

// ============================================================================
// TYPE EXPORTS (for convenience)
// ============================================================================

export type {
  z,
};
