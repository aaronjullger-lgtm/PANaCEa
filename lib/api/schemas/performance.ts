/**
 * PANaCEa Shared Schemas — Performance
 *
 * Zod validation schemas for performance recording endpoints.
 */

import { z } from 'zod';

// =============================================================================
// PERFORMANCE RECORD — REQUEST
// =============================================================================

/**
 * POST /api/performance/record request body.
 *
 * Records session-level drill performance (score, accuracy, time).
 * Per-question data goes through /api/questions/attempt.
 */
export const PerformanceRecordRequestSchema = z.object({
  drillType: z.string().min(1).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  questionsAttempted: z.number().int().min(0).max(1000),
  correctAnswers: z.number().int().min(0).max(1000),
  accuracy: z.number().min(0).max(1),
  /** Duration in milliseconds. Max 24 hours. */
  timeSpent: z.number().int().min(0).max(86400000),
  bestStreak: z.number().int().min(0).max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type PerformanceRecordRequest = z.infer<typeof PerformanceRecordRequestSchema>;
