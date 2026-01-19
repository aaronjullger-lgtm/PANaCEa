/**
 * Zod-based API Request Validation
 *
 * Provides type-safe request validation with clear error messages.
 * Usage:
 *   app.post('/api/endpoint', validate(mySchema), handler)
 */

import { z, ZodError, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Validation error response type
 */
export interface ValidationErrorResponse {
  error: 'Validation failed';
  details: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Middleware factory that validates request body against a Zod schema
 */
/**
 * Middleware factory that validates request body against a Zod schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (result.success) {
      // Replace body with validated & transformed data
      req.body = result.data;
      return next();
    }

    // Fix: Cast to access error since TS control flow doesn't narrow after early return
    const zodError = (result as { success: false; error: ZodError }).error;

    const errors = zodError.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    } satisfies ValidationErrorResponse);
  };
}

/**
 * Middleware factory that validates request params against a Zod schema
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (result.success) {
      req.params = result.data as any;
      return next();
    }

    // Fix: Cast to access error
    const zodError = (result as { success: false; error: ZodError }).error;

    const errors = zodError.issues.map((issue) => ({
      field: issue.path.join('.') || 'params',
      message: issue.message,
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    } satisfies ValidationErrorResponse);
  };
}

/**
 * Middleware factory that validates request query against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (result.success) {
      // Cast to any because Express types query as ParsedQs
      (req as any).validatedQuery = result.data;
      return next();
    }

    // Fix: Cast to access error
    const zodError = (result as { success: false; error: ZodError }).error;

    const errors = zodError.issues.map((issue) => ({
      field: issue.path.join('.') || 'query',
      message: issue.message,
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    } satisfies ValidationErrorResponse);
  };
}

// ============================================================================
// Common Reusable Schema Components
// ============================================================================

/** UUID string validation */
export const uuidSchema = z.string().uuid('Must be a valid UUID');

/** Pagination params */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Sort direction */
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('asc');

/** Non-empty string with reasonable max length */
export const safeStringSchema = z.string().min(1).max(10000);

/** Integer ID from URL param (coerced from string) */
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// ============================================================================
// API Endpoint Schemas
// ============================================================================

/**
 * POST /api/srs/submit - Submit SRS answer
 */
export const srsSubmitSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  selectedAnswer: z.number().int().min(0).max(10, 'selectedAnswer must be 0-10'),
  correctAnswer: z.number().int().min(0).max(10, 'correctAnswer must be 0-10'),
  responseTimeMs: z.number().int().min(0).max(600000, 'responseTimeMs must be 0-600000').optional(),
  confidenceLevel: z.enum(['low', 'medium', 'high']).optional(),
});

/**
 * POST /geminiProxy - AI question generation
 */
export const geminiProxySchema = z.object({
  prompt: safeStringSchema,
  modelName: z
    .string()
    .regex(/^gemini-[\w.-]+$/, 'Invalid model name')
    .default('gemini-1.5-flash'),
  temperature: z.number().min(0).max(2).default(0.8),
});

/**
 * POST /api/questions/flag - Flag a question for review
 */
export const flagQuestionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userEmail: z.string().email().optional().or(z.literal('')),
  userFirstName: z.string().optional().or(z.literal('')),
  questionId: z.string().min(1, 'questionId is required'),
  questionText: z.string().optional(),
  correctAnswer: z.string().optional(),
  topic: z.string().optional(),
  system: z.string().optional(),
  flagType: z.enum(['typo', 'incorrect_answer', 'unclear', 'outdated', 'other']),
  description: z.string().min(1, 'Description is required').max(2000),
  priority: z.enum(['low', 'medium', 'high']).default('medium').optional(),
});

/**
 * POST /api/sessions - Create study session
 */
export const createSessionSchema = z.object({
  mode: z.enum(['practice', 'exam', 'review', 'adaptive']),
  system: z.string().optional(),
  conditionIds: z.array(z.string()).max(50).optional(),
  questionCount: z.number().int().min(1).max(200).default(20),
});

/**
 * POST /api/user/preferences - Update user preferences
 */
export const updatePreferencesSchema = z.object({
  dailyGoal: z.number().int().min(1).max(500).optional(),
  notifications: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  focusSystems: z.array(z.string()).max(20).optional(),
});

/**
 * GET /api/conditions search params
 */
export const conditionSearchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  system: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * POST /api/games/wordle/guess
 */
export const wordleGuessSchema = z.object({
  guess: z.string().length(5, 'Guess must be exactly 5 characters').toUpperCase(),
});

/**
 * POST /api/feedback - Submit feedback
 */
export const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'content', 'other']),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  email: z.string().email().optional(),
  page: z.string().max(200).optional(),
});
