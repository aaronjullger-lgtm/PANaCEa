/**
 * PANaCEa Shared API Types — Drills
 *
 * Request and response types for the drill review pipeline.
 *
 * REQUEST types are derived from Zod schemas in `lib/api/schemas/drills.ts`
 * and re-exported here for convenience.
 *
 * RESPONSE types are hand-written to match the actual shapes returned by
 * `submitDrillReview()` in `drillReviewService.ts` + the endpoint wrapper
 * in `functions/api/drills/submit-review.ts`.
 */

import type { FSRSSchedule, ImplicitMetricsResult, CircadianResult } from './common';

// Re-export request types from Zod schemas (single source of truth)
export type {
  DrillSubmitReviewRequest,
  DrillTelemetry,
  InteractionEvent,
  DeviceInfo,
  DrillLogAttemptRequest,
} from '../schemas/drills';

// =============================================================================
// DRILL SUBMIT REVIEW — RESPONSE
// =============================================================================

/**
 * The inner `data` payload returned by POST /api/drills/submit-review.
 *
 * This is what the frontend receives after the SDK unwraps the
 * `{ success, data, timestamp }` envelope.
 *
 * Shape matches: `submitDrillReview()` return + endpoint additions
 * (isRapidGuess, nextReview).
 */
export interface DrillSubmitReviewResult {
  success: boolean;
  isCorrect: boolean;
  quality: number;
  parTimeMs: number;
  timeSpentMs: number;
  implicitMetrics: ImplicitMetricsResult;
  circadian: CircadianResult;
  /**
   * FSRS schedule data — present when FSRS was updated.
   * `undefined` when skipped (cram, rapid_recall, rapid guess, no conditionId).
   */
  fsrsSchedule?: FSRSSchedule;
  /** Whether the answer was below the MVRT threshold. */
  isRapidGuess: boolean;
  /**
   * Convenience alias for `fsrsSchedule`, shaped for `EnhancedFeedbackPanel`.
   * `null` when FSRS was skipped.
   */
  nextReview: FSRSSchedule | null;
}

// =============================================================================
// SDK-LAYER ALIASES
// =============================================================================

/**
 * Payload shape used by the SDK drills client and `useDrillFSRS` hook.
 *
 * Extends the base request with the `sessionType` that the hook injects.
 * This is identical to `DrillSubmitReviewRequest` — the alias exists so
 * SDK call-sites read naturally:
 *
 * ```ts
 * drillsClient.submitReview(payload: DrillSubmitPayload)
 * ```
 */
export type { DrillSubmitReviewRequest as DrillSubmitPayload } from '../schemas/drills';

/**
 * Result shape after SDK `unwrap()`.
 * Identical to `DrillSubmitReviewResult`.
 */
export type DrillSubmitResult = DrillSubmitReviewResult;

// =============================================================================
// HOOK-LAYER TYPES
// =============================================================================

/** Parameters accepted by `useDrillFSRS.submitAnswer()`. */
export interface SubmitAnswerParams {
  questionId: string;
  selectedAnswer: string | number;
  timeSpentMs: number;
}

/** Options for the `useDrillFSRS` hook. */
export interface UseDrillFSRSOptions {
  drillType: string;
}

/**
 * Full FSRS response shape expected by `useDrillFSRS`.
 * Matches `DrillSubmitReviewResult` — the alias keeps the hook self-documenting.
 */
export type DrillFSRSResponse = DrillSubmitReviewResult;

/** Normalized scheduling data for `EnhancedFeedbackPanel`. */
export type FSRSNextReview = FSRSSchedule;

// =============================================================================
// DRILL LOG ATTEMPT (simpler endpoints)
// =============================================================================

// DrillLogAttemptRequest is re-exported from ../schemas/drills above.

/**
 * POST /api/drill/log-attempt response data (deprecated — use /api/drills/submit-review).
 * Shape matches the actual endpoint return: { success, attemptId, isMainSession }.
 */
export interface DrillLogAttemptResult {
  success: boolean;
  attemptId: string;
  isMainSession: false;
}
