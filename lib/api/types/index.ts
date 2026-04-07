/**
 * PANaCEa Shared API Types — Barrel Export
 *
 * The single import for all API contract types:
 *
 * ```ts
 * import type {
 *   DrillSubmitReviewResult,
 *   QuestionAttemptResult,
 *   SessionGenerateResult,
 *   UserProfile,
 *   ApiResponse,
 *   FSRSSchedule,
 * } from '@/lib/api/types';
 * ```
 *
 * For Zod schemas (runtime validation), import from `@/lib/api/schemas` instead.
 */

// ── Common ──────────────────────────────────────────────────────────────────
export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginatedResponse,
  FSRSSchedule,
  FSRSCardState,
  ImplicitMetricsResult,
  CircadianResult,
  OrganSystem,
  Difficulty,
  QuestionMode,
  SessionType,
} from './common';

export { FSRSState, ORGAN_SYSTEMS, isApiError, isApiSuccess } from './common';

// ── Drills ──────────────────────────────────────────────────────────────────
export type {
  DrillSubmitReviewRequest,
  DrillTelemetry,
  InteractionEvent,
  DeviceInfo,
  DrillSubmitReviewResult,
  DrillSubmitPayload,
  DrillSubmitResult,
  SubmitAnswerParams,
  UseDrillFSRSOptions,
  DrillFSRSResponse,
  FSRSNextReview,
  DrillLogAttemptRequest,
  DrillLogAttemptResult,
} from './drills';

// ── Questions ───────────────────────────────────────────────────────────────
export type {
  QuestionAttemptRequest,
  FlagQuestionRequest,
  QuestionAttemptResult,
  SystemStats,
  QuestionDTO,
} from './questions';

// ── Sessions ────────────────────────────────────────────────────────────────
export type {
  SessionGenerateRequest,
  SessionConfig,
  SessionAnalyticsRequest,
  SessionGenerateResult,
  SessionMetadata,
} from './sessions';

// ── User ────────────────────────────────────────────────────────────────────
export type {
  UserProfile,
  UserProfileUpdate,
  UserStats,
  SystemPerformance,
  PerformanceArea,
  FSRSParams,
} from './user';

// ── Streaks (re-export request type from schema) ─────────────────────────────
export type { StreakRecordRequest } from '../schemas/streaks';

// ── Performance (re-export request type from schema) ─────────────────────────
export type { PerformanceRecordRequest } from '../schemas/performance';
