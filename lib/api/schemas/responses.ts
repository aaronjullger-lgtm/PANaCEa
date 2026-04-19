/**
 * PANaCEa Shared Schemas — Responses
 *
 * Zod schemas for the `data` payload of every contracted endpoint's success
 * envelope. Pairs 1:1 with the TS types in `lib/api/types/`, but with
 * runtime validation so the client catches server drift.
 *
 * The envelope itself (success/data/traceId/timestamp/error) is validated
 * by `parseEnvelope` in `lib/sdk/callApi.ts`. These schemas describe only
 * the inner `data` payload.
 *
 * Keep this file terse: only add schemas that are wired into a contract.
 * Everything else stays as hand-written types in `lib/api/types/`.
 */

import { z } from 'zod';

// ─── Shared fragments ────────────────────────────────────────────────────────

/** FSRS scheduling result. Mirrors `FSRSSchedule` in `lib/api/types/common.ts`. */
export const FSRSScheduleSchema = z.object({
  intervalDays: z.number(),
  nextDueDate: z.string(),
  stability: z.number(),
  difficulty: z.number(),
});

/** Implicit behavioral metrics returned by the drill pipeline. */
export const ImplicitMetricsResultSchema = z.object({
  rating: z.number(),
  gradeContinuous: z.number(),
  confidence: z.number(),
  latencyRatio: z.number(),
  answerSwitches: z.number(),
});

/** Circadian context computed during a drill review. */
export const CircadianResultSchema = z.object({
  phase: z.string(),
  stabilityModifier: z.number(),
  localHour: z.number(),
});

// ─── Drills ──────────────────────────────────────────────────────────────────

/**
 * POST /api/drills/submit-review — success `data` shape.
 *
 * Matches `DrillSubmitReviewResult` in `lib/api/types/drills.ts`. Kept
 * permissive (passthrough) so server-side additions don't break the client
 * before we've updated the schema.
 */
export const DrillSubmitReviewResponseSchema = z
  .object({
    success: z.boolean(),
    isCorrect: z.boolean(),
    quality: z.number(),
    parTimeMs: z.number(),
    timeSpentMs: z.number(),
    implicitMetrics: ImplicitMetricsResultSchema,
    circadian: CircadianResultSchema,
    fsrsSchedule: FSRSScheduleSchema.optional(),
    isRapidGuess: z.boolean(),
    nextReview: FSRSScheduleSchema.nullable(),
  })
  .passthrough();

/**
 * POST /api/drill/log-attempt — success `data` shape (deprecated endpoint).
 */
export const DrillLogAttemptResponseSchema = z.object({
  success: z.boolean(),
  attemptId: z.string(),
  isMainSession: z.literal(false),
});

// ─── Questions ───────────────────────────────────────────────────────────────

/** System-level performance stats embedded in the attempt response. */
export const SystemStatsSchema = z.object({
  system: z.string(),
  totalAttempts: z.number(),
  correctAttempts: z.number(),
  accuracy: z.number(),
  recentTrend: z.enum(['improving', 'declining', 'neutral']),
});

/**
 * POST /api/questions/attempt — success `data` shape.
 */
export const QuestionAttemptResponseSchema = z
  .object({
    success: z.boolean(),
    attemptId: z.string(),
    stats: z.object({
      totalQuestionsAnswered: z.number(),
      correctAnswers: z.number(),
      overallAccuracy: z.number(),
    }),
    systemStats: SystemStatsSchema.optional(),
    nextReviewDate: z.string().optional(),
  })
  .passthrough();

/**
 * POST /api/questions/flag — success `data` shape.
 * The endpoint returns a simple acknowledgement; kept minimal + passthrough
 * so future additions (flagId, status, etc.) don't require a client bump.
 */
export const FlagQuestionResponseSchema = z
  .object({
    success: z.boolean().optional(),
    flagId: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

// ─── Streaks ─────────────────────────────────────────────────────────────────

/**
 * POST /api/streaks/record — success `data` shape.
 * Kept permissive; the endpoint returns aggregated streak state.
 */
export const StreakRecordResponseSchema = z
  .object({
    currentStreak: z.number().optional(),
    longestStreak: z.number().optional(),
    lastActiveDate: z.string().optional(),
  })
  .passthrough();

// ─── Performance ─────────────────────────────────────────────────────────────

/**
 * POST /api/performance/record — success `data` shape.
 */
export const PerformanceRecordResponseSchema = z
  .object({
    recorded: z.boolean().optional(),
    totalAttempts: z.number().optional(),
  })
  .passthrough();

// ─── Inferred response types ────────────────────────────────────────────────

export type DrillSubmitReviewResponse = z.infer<
  typeof DrillSubmitReviewResponseSchema
>;
export type DrillLogAttemptResponse = z.infer<
  typeof DrillLogAttemptResponseSchema
>;
export type QuestionAttemptResponse = z.infer<
  typeof QuestionAttemptResponseSchema
>;
export type FlagQuestionResponse = z.infer<typeof FlagQuestionResponseSchema>;
export type StreakRecordResponse = z.infer<typeof StreakRecordResponseSchema>;
export type PerformanceRecordResponse = z.infer<
  typeof PerformanceRecordResponseSchema
>;
