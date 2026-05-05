/**
 * PANaCEa Shared Schemas — Drills
 *
 * Zod validation schemas for the drill review pipeline.
 * Imported by both the Edge endpoint (`functions/api/drills/submit-review.ts`)
 * and the frontend SDK for compile-time type inference.
 *
 * IMPORTANT: Any change here is the single source of truth for the
 * /api/drills/submit-review contract.
 */

import { z } from 'zod';

// =============================================================================
// TELEMETRY (nested within drill submission)
// =============================================================================

/** Individual interaction event during a question attempt. */
export const InteractionEventSchema = z.object({
  type: z.enum([
    'click',
    'hover',
    'scroll',
    'keypress',
    'option_select',
    'hint_view',
    'explanation_expand',
  ]),
  timestamp_ms: z.number().int().min(0),
  target: z.string().optional(),
});

/** Device and viewport information. */
export const DeviceInfoSchema = z.object({
  viewport_width: z.number().int().min(0),
  viewport_height: z.number().int().min(0),
  device_pixel_ratio: z.number().min(0),
  is_touch_device: z.boolean(),
  user_agent_short: z.string().optional(),
});

/** Option selection chronometry captured during an answer. */
export const OptionInteractionTelemetrySchema = z.object({
  option_id: z.string(),
  selected_at_ms: z.number().int().min(0),
  deselected_at_ms: z.number().int().min(0).nullable(),
  dwell_ms: z.number().int().min(0).nullable(),
});

/**
 * Full telemetry payload captured per question attempt.
 * Includes CRPL (Cognitive Rhythm Perception Layer) signals and Ghost Grader metrics.
 */
export const DrillTelemetrySchema = z
  .object({
    // Core timing
    duration_ms: z.number().int().min(0),
    time_to_first_interaction_ms: z.number().int().min(0).nullable(),
    rapid_guess: z.boolean(),

    // Question classification
    question_type: z.enum(['vignette', 'recall', 'image', 'rapid_recall', 'unknown']),
    mvrt_threshold_ms: z.number().int().min(0),

    // Timestamps
    question_displayed_at: z.string(),
    answer_submitted_at: z.string(),

    // Answer behavior
    answer_changes: z.number().int().min(0),
    hint_viewed: z.boolean(),
    hint_view_duration_ms: z.number().int().min(0).nullable(),

    // Interaction log
    interactions: z.array(InteractionEventSchema).optional(),

    // Session context
    session_id: z.string().optional(),
    study_plan_task_id: z.string().optional(),
    study_plan_date: z.string().optional(),
    study_plan_source: z.string().optional(),
    urgency_multiplier: z.number().min(0.5).max(2).optional(),
    question_number: z.number().int().min(1).optional(),
    device_info: DeviceInfoSchema.optional(),

    // Ghost Grader: micro-kinetic signals
    hover_oscillations: z.number().int().min(0).optional(),
    vignette_regressions: z.number().int().min(0).optional(),
    selection_drift_ms: z.number().int().min(0).optional(),
    tremor_score: z.number().min(0).max(1).optional(),
    cursor_entropy: z.number().min(0).optional(),
    elimination_velocity: z.number().min(0).optional(),
    input_method: z.enum(['mouse', 'touch']).optional(),
    trajectory_metrics: z.record(z.string(), z.unknown()).optional(),
    typing_metrics: z.record(z.string(), z.unknown()).optional(),
    hesitation_count: z.number().int().min(0).optional(),
    option_interactions: z.array(OptionInteractionTelemetrySchema).optional(),
    unique_options_considered: z.number().int().min(0).optional(),
    explanation_engagement: z.record(z.string(), z.unknown()).optional(),
    study_mode: z.enum(['direct', 'guided']).optional(),
    guided_scaffold: z.object({
      level: z.string(),
      hints_viewed: z.number().int().min(0),
      reflection_length: z.number().int().min(0),
    }).optional(),
  })
  .strict();

// =============================================================================
// DRILL SUBMIT REVIEW — REQUEST
// =============================================================================

/**
 * POST /api/drills/submit-review request body.
 *
 * This schema is the canonical contract. The Edge endpoint and the frontend SDK
 * both derive their TypeScript types from this single definition.
 */
export const DrillSubmitReviewRequestSchema = z.object({
  questionId: z.string().min(1),
  canonicalQuestionId: z.string().min(1).nullable().optional(),
  sourceQuestionId: z.string().min(1).optional(),
  questionSource: z.enum(['question', 'pre_generated', 'staging', 'seed', 'generated']).optional(),
  medicalContentId: z.string().min(1).nullable().optional(),
  selectedAnswer: z.union([z.string(), z.number()]),
  timeSpentMs: z.number().int().min(0).max(3600000),
  timeToFirstClick: z.number().int().min(0).optional(),
  answerSwitches: z.number().int().min(0).optional(),
  totalDwellTime: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  wakeTimeHHMM: z.string().optional(),
  telemetry: DrillTelemetrySchema.optional(),
  /**
   * Session type gates FSRS updates:
   * - 'main' | 'drill' → QuestionAttempt + ReviewLog
   * - 'targeted' → sole FSRS writer: QuestionAttempt + ReviewLog + Card/UserProgress
   * - 'cram' | 'rapid_recall' → QuestionAttempt only, FSRS skipped
   *
   * NOTE: Self-reported confidence (confidenceRating, surpriseFlag) is intentionally
   * NOT part of this schema. FSRS ratings are 100% implicit, derived from telemetry.
   */
  sessionType: z.enum(['main', 'drill', 'cram', 'rapid_recall', 'targeted']).optional(),
  /**
   * Sprint S3 — Idempotency key (optional).
   *
   * Clients that retry submissions (offline sync, flaky networks, double-submit
   * protection) should supply a stable unique string here. The Edge endpoint
   * caches the successful response body under `idem:<endpoint>:<userId>:<key>`
   * in the CACHE KV namespace for 24h. A retry with the same key returns the
   * cached response without re-entering the FSRS pipeline — preventing
   * duplicate QuestionAttempt / ReviewLog rows.
   *
   * Format is intentionally permissive (any 8–128 char string) so existing
   * client-side queue IDs (e.g. `review-<ts>-<rand>` from syncManager) are
   * accepted without a client migration. Uniqueness-per-submission is the
   * caller's responsibility.
   *
   * Backward-compatible: omitting this field preserves pre-S3 behavior (every
   * request runs the full pipeline; no cache check, no cache write).
   */
  idempotencyKey: z.string().min(8).max(128).optional(),
});

// =============================================================================
// DRILL LOG ATTEMPT — REQUEST
// =============================================================================

/**
 * POST /api/drill/log-attempt request body (deprecated — use /api/drills/submit-review).
 *
 * Lightweight logging for drill-type attempts (photo_drill, contrastive_drill, etc.)
 * that don't go through the full FSRS submit-review pipeline.
 */
export const DrillLogAttemptRequestSchema = z.object({
  questionId: z.string().optional(),
  conditionId: z.string().optional(),
  drillType: z.enum(['photo_drill', 'contrastive_drill', 'rapid_recall', 'wordle']),
  wasCorrect: z.boolean(),
  responseTimeMs: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// INFERRED TYPES (derive TS from Zod — never hand-write these)
// =============================================================================

// Inferred types — always derived from Zod, never hand-written
export type DrillSubmitReviewRequest = z.infer<typeof DrillSubmitReviewRequestSchema>;
export type DrillTelemetry = z.infer<typeof DrillTelemetrySchema>;
export type InteractionEvent = z.infer<typeof InteractionEventSchema>;
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;
export type DrillLogAttemptRequest = z.infer<typeof DrillLogAttemptRequestSchema>;
