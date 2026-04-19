/**
 * PANaCEa API Contracts — Registry
 *
 * Single catalog of every contracted endpoint. Importing from here is the
 * only supported way to call an API method through the typed client.
 *
 * A contract describes:
 *   - HTTP method + path
 *   - Request schema (or null for no input)
 *   - Response schema (for the envelope's `data` field)
 *   - Canonical error codes
 *
 * To add an endpoint:
 *   1. Ensure request schema lives in `lib/api/schemas/<domain>.ts`
 *   2. Ensure response schema lives in `lib/api/schemas/responses.ts`
 *   3. Register it here with a stable camelCase name
 *   4. The matching Edge function reads the request schema for validation
 *
 * The convention is one contract per endpoint. Overloaded endpoints (same
 * path, different methods) should be split into separate contracts with
 * names that carry the verb — `getFoo`, `createFoo`, etc.
 */

import { ErrorCode } from '../../../functions/api/_shared/error-catalog';
import {
  DrillSubmitReviewRequestSchema,
  DrillLogAttemptRequestSchema,
} from '../schemas/drills';
import {
  QuestionAttemptRequestSchema,
  FlagQuestionRequestSchema,
} from '../schemas/questions';
import { StreakRecordRequestSchema } from '../schemas/streaks';
import { PerformanceRecordRequestSchema } from '../schemas/performance';
import {
  DrillSubmitReviewResponseSchema,
  DrillLogAttemptResponseSchema,
  QuestionAttemptResponseSchema,
  FlagQuestionResponseSchema,
  StreakRecordResponseSchema,
  PerformanceRecordResponseSchema,
} from '../schemas/responses';
import { defineContract } from './types';

// ─── Drill submission ────────────────────────────────────────────────────────

export const submitDrillReview = defineContract({
  method: 'POST',
  path: '/api/drills/submit-review',
  request: DrillSubmitReviewRequestSchema,
  response: DrillSubmitReviewResponseSchema,
  errors: [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.VALIDATION_FAILED,
    ErrorCode.NOT_FOUND,
    ErrorCode.RATE_LIMITED,
    ErrorCode.DB_ERROR,
  ],
  description: 'Submit a drill answer, update FSRS, return scheduling data',
});

export const logDrillAttempt = defineContract({
  method: 'POST',
  path: '/api/drill/log-attempt',
  request: DrillLogAttemptRequestSchema,
  response: DrillLogAttemptResponseSchema,
  errors: [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.VALIDATION_FAILED,
    ErrorCode.RATE_LIMITED,
  ],
  description:
    'Log a lightweight drill attempt (photo, contrastive, rapid recall, wordle) — FSRS skipped',
});

// ─── Questions ───────────────────────────────────────────────────────────────

export const submitQuestionAttempt = defineContract({
  method: 'POST',
  path: '/api/questions/attempt',
  request: QuestionAttemptRequestSchema,
  response: QuestionAttemptResponseSchema,
  errors: [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.VALIDATION_FAILED,
    ErrorCode.NOT_FOUND,
    ErrorCode.RATE_LIMITED,
  ],
  description: 'Record a question attempt (correctness + telemetry)',
});

export const flagQuestion = defineContract({
  method: 'POST',
  path: '/api/questions/flag',
  request: FlagQuestionRequestSchema,
  response: FlagQuestionResponseSchema,
  errors: [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.VALIDATION_FAILED,
    ErrorCode.RATE_LIMITED,
  ],
  description: 'Flag a question for review (typo, wrong answer, unclear, etc.)',
});

// ─── Streaks ─────────────────────────────────────────────────────────────────

export const recordStreak = defineContract({
  method: 'POST',
  path: '/api/streaks/record',
  request: StreakRecordRequestSchema,
  response: StreakRecordResponseSchema,
  errors: [ErrorCode.UNAUTHORIZED, ErrorCode.VALIDATION_FAILED],
  description: 'Record streak activity for the authenticated user',
});

// ─── Performance ─────────────────────────────────────────────────────────────

export const recordPerformance = defineContract({
  method: 'POST',
  path: '/api/performance/record',
  request: PerformanceRecordRequestSchema,
  response: PerformanceRecordResponseSchema,
  errors: [ErrorCode.UNAUTHORIZED, ErrorCode.VALIDATION_FAILED],
  description: 'Record performance metrics for the authenticated user',
});

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Map of every registered contract, keyed by its contract name.
 * Useful for docs generation, schema exports, and contract audits.
 */
export const contracts = {
  submitDrillReview,
  logDrillAttempt,
  submitQuestionAttempt,
  flagQuestion,
  recordStreak,
  recordPerformance,
} as const;

export type ContractName = keyof typeof contracts;

// Re-export core types for ergonomic imports:
// `import { defineContract, type ApiContract } from '@/lib/api/contracts';`
export type {
  ApiContract,
  HttpMethod,
  ContractRequest,
  ContractResponse,
  ContractParams,
} from './types';
export { defineContract, interpolatePath } from './types';
