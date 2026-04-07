/**
 * PANaCEa Shared API Types — Common Primitives
 *
 * Single source of truth for response envelopes, FSRS scheduling types,
 * and shared enums used across all API domains.
 *
 * Both frontend (hooks, SDK, components) and backend (Edge Functions)
 * should import from here — never redefine these shapes locally.
 */

// =============================================================================
// RESPONSE ENVELOPES
// =============================================================================

/**
 * Standard success response from all API endpoints.
 *
 * Server always returns `{ success: true, data: T, timestamp }`.
 * The SDK `unwrap()` normalises legacy shapes into this form.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/** Standard error response from all API endpoints. */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown> | string;
  timestamp: string;
  /** Hint to the client on whether the request is safe to retry */
  retryable?: boolean;
}

/** Union of success and error — what every `fetch()` call actually returns. */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Paginated response envelope. */
export interface PaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// FSRS SCHEDULING
// =============================================================================

/**
 * FSRS v6 card state enum.
 * Mirrors `lib/fsrs.ts` — imported here so API consumers don't need the FSRS lib.
 */
export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

/**
 * FSRS scheduling result returned by the drill review pipeline.
 * Shared between `drillReviewService` response and frontend drill hooks.
 */
export interface FSRSSchedule {
  intervalDays: number;
  nextDueDate: string;
  stability: number;
  difficulty: number;
}

/**
 * FSRS card state stored in UserProgress.
 * Subset of the full `FSRSCard` from `lib/fsrs.ts`, used for API serialization.
 */
export interface FSRSCardState {
  due?: string;
  stability?: number;
  difficulty?: number;
  elapsed_days?: number;
  scheduled_days?: number;
  reps?: number;
  lapses?: number;
  state?: FSRSState | number;
  last_review?: string;
}

// =============================================================================
// IMPLICIT METRICS (returned in drill responses)
// =============================================================================

/** Implicit behavioral metrics computed by the FSRS pipeline. */
export interface ImplicitMetricsResult {
  rating: number;
  gradeContinuous: number;
  confidence: number;
  latencyRatio: number;
  answerSwitches: number;
}

/** Circadian context computed during review. */
export interface CircadianResult {
  phase: string;
  stabilityModifier: number;
  localHour: number;
}

// =============================================================================
// ENUMS & LITERALS
// =============================================================================

/** Organ systems used throughout the curriculum and API. */
export const ORGAN_SYSTEMS = [
  'cardiovascular',
  'pulmonary',
  'gastrointestinal',
  'musculoskeletal',
  'heent',
  'reproductive',
  'neurological',
  'psychiatry',
  'endocrine',
  'dermatology',
  'genitourinary',
  'hematology',
  'infectious_disease',
  'nephrology',
  'emergency_medicine',
] as const;

export type OrganSystem = (typeof ORGAN_SYSTEMS)[number];

/** Difficulty levels. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Question modes used across sessions and drills. */
export type QuestionMode = 'drill' | 'session' | 'review' | 'exam' | 'rapid_recall';

/**
 * Session types that gate FSRS updates.
 * - 'main' | 'drill' → FSRS written (QuestionAttempt + ReviewLog + Card)
 * - 'targeted' → sole FSRS writer in some routing variants
 * - 'cram' | 'rapid_recall' → QuestionAttempt only, FSRS skipped
 */
export type SessionType = 'main' | 'drill' | 'cram' | 'rapid_recall' | 'targeted';

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard for API error responses. */
export function isApiError(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as Record<string, unknown>).success === false &&
    'error' in response
  );
}

/** Type guard for successful API responses. */
export function isApiSuccess<T>(response: unknown): response is ApiSuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as Record<string, unknown>).success === true
  );
}
