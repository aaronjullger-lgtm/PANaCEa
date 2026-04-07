/**
 * ReviewLog Service
 * Centralized helper for creating ReviewLog entries with input validation
 * matching the database CHECK constraints added in Sprint 2.
 *
 * All ReviewLog writes should go through `createReviewLogEntry()` to ensure
 * constraint compliance and consistent field population.
 *
 * Database constraints (as of Sprint 2):
 *   - grade: [0, 4]
 *   - state: [0, 3]
 *   - stability: >= 0
 *   - difficulty: [0, 1]
 *   - responseTimeMs: >= 0 (nullable)
 *   - grade_continuous: [1, 4] (nullable)
 *   - implicit_confidence: [0, 1] (nullable)
 *   - review_type: 'real' | 'rapid_guess' | 'cram' | 'practice'
 *   - retrievability: [0, 1] (nullable)
 *   - elapsedDays: >= 0 (nullable)
 *   - enforce_fsrs_main_session: real reviews must have sessionType=MAIN
 */

import type { CircadianPhase, SessionType } from '@prisma/client';

/** Valid review_type values matching the CHECK constraint. */
export const VALID_REVIEW_TYPES = ['real', 'rapid_guess', 'cram', 'practice'] as const;
export type ReviewType = (typeof VALID_REVIEW_TYPES)[number];

export interface CreateReviewLogInput {
  // Required fields
  userId: string;
  grade: number;
  state: number;
  stability: number;
  difficulty: number;
  wasCorrect: boolean;
  reviewedAt: Date;
  review_type: ReviewType;
  sessionType: SessionType;

  // Contextual identifiers
  conditionId?: string | null;
  medicalContentId?: string | null;
  questionId?: string | null;
  questionType?: string | null;
  questionFkId?: string | null;
  sessionId?: string | null;
  attemptId?: string | null;
  system?: string | null;

  // FSRS metrics
  retrievability?: number | null;
  elapsedDays?: number | null;
  scheduledAt?: Date | null;
  grade_continuous?: number | null;
  implicit_confidence?: number | null;

  // Behavioral telemetry
  responseTimeMs?: number | null;
  hover_oscillations?: number | null;
  vignette_regressions?: number | null;
  time_to_first_interaction?: number | null;
  circadian_phase?: CircadianPhase | null;
  telemetry?: Record<string, unknown> | null;

  // Classification
  taskType?: string | null;
  errorCategory?: string | null;
  errorConfidence?: number | null;
  blueprintExamType?: string | null;
  blueprintStage?: string | null;

  // Metadata
  deviceType?: string | null;
  fsrsVersion?: string;
}

/**
 * Clamp a number to a range, returning null if the input is null/undefined/NaN.
 */
function clampOrNull(value: number | null | undefined, min: number, max: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp a required number to a range, returning the min if input is NaN/undefined.
 */
function clampRequired(value: number, min: number, max: number, fallback?: number): number {
  if (!Number.isFinite(value)) return fallback ?? min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and sanitize a ReviewLog input, returning a Prisma-ready data object.
 * Throws if a required field is invalid in a way that can't be auto-corrected.
 */
export function sanitizeReviewLogInput(input: CreateReviewLogInput): Record<string, unknown> {
  // Validate review_type
  if (!VALID_REVIEW_TYPES.includes(input.review_type)) {
    throw new Error(`Invalid review_type: ${input.review_type}. Must be one of: ${VALID_REVIEW_TYPES.join(', ')}`);
  }

  // Enforce the main-session constraint: real reviews must have sessionType=MAIN
  // (The DB constraint allows non-real types with any sessionType)
  // NOTE: This constraint was relaxed — drills with review_type='real' use sessionType=DRILL.
  // The actual DB constraint is: (review_type='real' AND sessionType='MAIN') OR (review_type != 'real')
  // But drillReviewService writes real+DRILL, so we don't enforce this at the app layer.
  // The DB constraint should be updated or removed to match actual usage.

  return {
    userId: input.userId,
    conditionId: input.conditionId ?? undefined,
    medicalContentId: input.medicalContentId ?? undefined,
    questionId: input.questionId ?? undefined,
    questionFkId: input.questionFkId ?? undefined,
    questionType: input.questionType ?? undefined,
    sessionId: input.sessionId ?? undefined,
    attemptId: input.attemptId ?? undefined,
    system: input.system ?? undefined,

    // Constrained numeric fields
    grade: clampRequired(input.grade, 0, 4),
    state: clampRequired(input.state, 0, 3),
    stability: Math.max(0, Number.isFinite(input.stability) ? input.stability : 0),
    difficulty: clampRequired(input.difficulty, 0, 1),

    // Nullable constrained fields
    retrievability: clampOrNull(input.retrievability, 0, 1),
    elapsedDays: input.elapsedDays != null && Number.isFinite(input.elapsedDays)
      ? Math.max(0, input.elapsedDays)
      : undefined,
    grade_continuous: clampOrNull(input.grade_continuous, 1, 4),
    implicit_confidence: clampOrNull(input.implicit_confidence, 0, 1),
    responseTimeMs: input.responseTimeMs != null && Number.isFinite(input.responseTimeMs)
      ? Math.max(0, Math.round(input.responseTimeMs))
      : undefined,

    // Boolean + enum fields
    wasCorrect: input.wasCorrect,
    review_type: input.review_type,
    sessionType: input.sessionType,
    circadian_phase: input.circadian_phase ?? undefined,

    // Timestamps
    reviewedAt: input.reviewedAt,
    scheduledAt: input.scheduledAt ?? undefined,

    // Behavioral telemetry (no constraints, pass through)
    hover_oscillations: input.hover_oscillations ?? undefined,
    vignette_regressions: input.vignette_regressions ?? undefined,
    time_to_first_interaction: input.time_to_first_interaction ?? undefined,
    telemetry: input.telemetry ?? undefined,

    // Classification
    taskType: input.taskType ?? undefined,
    errorCategory: input.errorCategory ?? undefined,
    errorConfidence: input.errorConfidence ?? undefined,
    blueprintExamType: input.blueprintExamType ?? undefined,
    blueprintStage: input.blueprintStage ?? undefined,

    // Metadata
    deviceType: input.deviceType ?? undefined,
    fsrsVersion: input.fsrsVersion ?? '6.0',
  };
}

/**
 * Create a ReviewLog entry with full input validation.
 *
 * @param prisma - Prisma client (or transaction client)
 * @param input  - ReviewLog data (will be sanitized before write)
 * @returns The created ReviewLog record
 */
export async function createReviewLogEntry(
  prisma: any,
  input: CreateReviewLogInput
): Promise<{ id: string }> {
  const data = sanitizeReviewLogInput(input);
  return prisma.reviewLog.create({ data });
}
