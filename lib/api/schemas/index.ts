/**
 * PANaCEa Shared Schemas — Barrel Export
 *
 * Re-exports all Zod schemas and their inferred types.
 * Import from here for one-stop access:
 *
 * ```ts
 * import { DrillSubmitReviewRequestSchema, type DrillSubmitReviewRequest } from '@/lib/api/schemas';
 * ```
 */

// Drills
export {
  DrillSubmitReviewRequestSchema,
  DrillTelemetrySchema,
  InteractionEventSchema,
  DeviceInfoSchema,
  DrillLogAttemptRequestSchema,
  type DrillSubmitReviewRequest,
  type DrillTelemetry,
  type InteractionEvent,
  type DeviceInfo,
  type DrillLogAttemptRequest,
} from './drills';

// Questions
export {
  QuestionAttemptRequestSchema,
  FlagQuestionRequestSchema,
  type QuestionAttemptRequest,
  type FlagQuestionRequest,
} from './questions';

// Sessions
export {
  SessionGenerateRequestSchema,
  SessionConfigSchema,
  SessionAnalyticsRequestSchema,
  type SessionGenerateRequest,
  type SessionConfig,
  type SessionAnalyticsRequest,
} from './sessions';

// Streaks
export {
  StreakRecordRequestSchema,
  type StreakRecordRequest,
} from './streaks';

// Performance
export {
  PerformanceRecordRequestSchema,
  type PerformanceRecordRequest,
} from './performance';
