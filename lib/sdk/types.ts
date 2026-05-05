/**
 * PANaCEa Internal SDK — Shared Types
 *
 * This file is the SDK's type surface. Domain-specific request/response types
 * now live in `lib/api/types/` and are re-exported here so existing SDK call
 * sites continue to import from `@/lib/sdk`.
 *
 * SDK-internal types (error handling, response envelopes, client config)
 * remain defined here since they are SDK concerns, not API contracts.
 */

// =============================================================================
// SDK-INTERNAL: Auth
// =============================================================================

/** Injected token provider — keeps Clerk out of the SDK. */
export type TokenProvider = () => Promise<string | null>;

// =============================================================================
// SDK-INTERNAL: Error handling
// =============================================================================

/** Error categories for downstream retry/display logic. */
export type ApiErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'timeout' | 'unknown';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorPayload };

export class ApiError extends Error {
  public readonly category: ApiErrorCategory;

  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.category = ApiError.categorize(status, code);
  }

  /** Whether the request is safe to retry (transient failures). */
  get isRetryable(): boolean {
    return this.category === 'network' || this.category === 'timeout' || this.category === 'server';
  }

  /** Whether the user should re-authenticate. */
  get isAuthError(): boolean {
    return this.category === 'auth';
  }

  /** User-facing message that's honest but non-scary. */
  get userMessage(): string {
    switch (this.category) {
      case 'network':
        return "Unable to reach the server. Check your connection and try again.";
      case 'timeout':
        return "The request took too long. Your answer is saved locally — we'll sync it shortly.";
      case 'auth':
        return 'Your session has expired. Please sign in again.';
      case 'validation':
        return 'Something was wrong with the request. Please try again.';
      case 'server':
        return "Something went wrong on our end. Your answer is safe — we'll retry automatically.";
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private static categorize(status: number, code?: string): ApiErrorCategory {
    if (code === 'TIMEOUT') return 'timeout';
    if (code === 'NETWORK_ERROR' || status === 0) return 'network';
    if (status === 401 || status === 403) return 'auth';
    if (status === 400 || status === 404 || status === 422) return 'validation';
    if (status >= 500) return 'server';
    return 'unknown';
  }
}

export function apiErrorToResult(error: unknown): ApiResult<never> {
  if (error instanceof ApiError) {
    return {
      ok: false,
      error: {
        code: error.code ?? (error.status > 0 ? `HTTP_${error.status}` : 'API_ERROR'),
        message: error.message || error.userMessage,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected error',
    },
  };
}

// =============================================================================
// SDK-INTERNAL: Response envelope (used by core.ts unwrap())
// =============================================================================

/**
 * The server returns one of three shapes:
 *   1. { data: T }                      — most endpoints
 *   2. { success: true, data: T }       — user/stats, analytics
 *   3. bare T                           — a few legacy endpoints
 *
 * The SDK core normalises all three into `T` before the domain client sees it.
 */
export interface WrappedResponse<T = unknown> {
  ok?: boolean;
  success?: boolean;
  data?: T;
  error?: string | ApiErrorPayload | Record<string, unknown>;
  code?: string;
  message?: string;
  details?: unknown;
  status?: number;
  timestamp?: string;
}

// =============================================================================
// SDK-INTERNAL: Client options
// =============================================================================

export interface SdkClientOptions {
  /** Base URL — defaults to '' (relative to origin). */
  baseUrl?: string;
  /** Default timeout in ms — defaults to 30 000. */
  timeoutMs?: number;
  /** Extra headers added to every request. */
  defaultHeaders?: Record<string, string>;
  /** Max retries for transient errors (default: 2). Set 0 to disable. */
  maxRetries?: number;
  /** Allow POST retries for specific paths (e.g., idempotent submission endpoints). */
  retryablePosts?: string[];
}

// =============================================================================
// DOMAIN TYPES — re-exported from the shared type library
//
// Source of truth: lib/api/types/
// These re-exports keep existing `import { X } from '@/lib/sdk'` call sites
// working without any changes, while eliminating duplicate definitions.
// =============================================================================

// ── Drills ------------------------------------------------------------------
export type {
  DrillSubmitReviewRequest as DrillSubmitPayload,
  DrillSubmitReviewResult as DrillSubmitResult,
} from '@/lib/api/types/drills';

// ── Sessions ----------------------------------------------------------------
export type {
  SessionGenerateRequest as SessionGeneratePayload,
  SessionGenerateResult,
  SessionQuestionsResult,
} from '@/lib/api/types/sessions';

// ── User --------------------------------------------------------------------
export type {
  UserProfile,
  UserStats,
  FSRSParams,
} from '@/lib/api/types/user';

// =============================================================================
// DOMAIN TYPES — SDK-specific (not yet in shared library)
// =============================================================================

// -- SRS ---------------------------------------------------------------------

export interface SRSItem {
  id?: string;
  dueDate: Date;
  [key: string]: unknown;
}

export interface SRSDueResult {
  items: SRSItem[];
  totalDue: number;
}

export interface SRSSubmitPayload {
  srsItemId?: string | null;
  topicProgressId?: string;
  questionId: string;
  variantId?: string;
  rating: number;
  isCorrect: boolean;
  userAnswer?: string;
  timeSpent?: number;
  progressContext?: 'READINESS' | 'TARGETED' | string | null;
  telemetry?: Record<string, unknown>;
  urgencyMultiplier?: number;
  [key: string]: unknown;
}

// -- Content -----------------------------------------------------------------

export interface ContentSearchResult {
  results: Array<{
    id: string;
    name: string;
    type: 'condition' | 'drug';
    description?: string;
    [key: string]: unknown;
  }>;
  count: number;
  query: string;
}

export interface SemanticSearchPayload {
  query: string;
  limit?: number;
  system?: string;
}

export interface SemanticSearchResult {
  results: Array<{
    id: string;
    name: string;
    score: number;
    overview?: string;
    system?: string;
    [key: string]: unknown;
  }>;
}
