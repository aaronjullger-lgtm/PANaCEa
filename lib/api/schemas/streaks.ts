/**
 * PANaCEa Shared Schemas — Streaks
 *
 * Zod validation schemas for streak recording and management endpoints.
 */

import { z } from 'zod';

// =============================================================================
// STREAK RECORD — REQUEST
// =============================================================================

/**
 * POST /api/streaks/record request body.
 *
 * Records daily study activity for streak calculation. Also awards coins
 * and may grant a streak freeze per 7 consecutive goal days.
 */
export const StreakRecordRequestSchema = z.object({
  /** ISO date string (YYYY-MM-DD). Defaults to today UTC if omitted. */
  date: z.string().optional(),
  questionsAnswered: z.number().int().min(0),
  accuracyPercent: z.number().min(0).max(100),
  studyMinutes: z.number().int().min(0).optional(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type StreakRecordRequest = z.infer<typeof StreakRecordRequestSchema>;
