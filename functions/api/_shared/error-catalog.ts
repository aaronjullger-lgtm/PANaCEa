/**
 * Structured Error Catalog for PANaCEa API
 *
 * Single source of truth for error codes, HTTP status, and default messages.
 * Every non-success response from the API MUST map to one of these codes.
 *
 * Usage:
 *   import { ErrorCode, errorFromCatalog } from './error-catalog';
 *   return errorFromCatalog(ErrorCode.UNAUTHORIZED);
 *   return errorFromCatalog(ErrorCode.VALIDATION_FAILED, { details: zodErrors });
 */

// ─── Codes (frozen enum) ─────────────────────────────────────────────────────

/**
 * Stable error codes. These are part of the public API contract.
 * Do not rename without a version bump + consumer migration.
 */
export const ErrorCode = {
  // --- Auth / authz (401, 403) ---
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  EDITOR_REQUIRED: 'EDITOR_REQUIRED',
  APPROVER_REQUIRED: 'APPROVER_REQUIRED',

  // --- Validation (400, 413, 415) ---
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  MISSING_PARAMETER: 'MISSING_PARAMETER',

  // --- Resource (404, 409, 410) ---
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',
  FEATURE_DISABLED: 'FEATURE_DISABLED',

  // --- Rate limiting (429) ---
  RATE_LIMITED: 'RATE_LIMITED',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',

  // --- Server (500, 502, 503, 504) ---
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DB_ERROR: 'DB_ERROR',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  GEMINI_ERROR: 'GEMINI_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  ENV_MISCONFIGURED: 'ENV_MISCONFIGURED',

  // --- CORS (403) ---
  CORS_ORIGIN_BLOCKED: 'CORS_ORIGIN_BLOCKED',

  // --- Generic fallback ---
  ERROR: 'ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─── Catalog entries ─────────────────────────────────────────────────────────

export interface ErrorCatalogEntry {
  /** HTTP status code */
  status: number;
  /** Default human-readable message; handlers may override */
  defaultMessage: string;
  /** Whether this error should be captured to Sentry by default */
  capture: boolean;
}

/**
 * Catalog: code → (status, default message, observability rules)
 */
export const ERROR_CATALOG: Record<ErrorCode, ErrorCatalogEntry> = {
  // Auth
  [ErrorCode.UNAUTHORIZED]: {
    status: 401,
    defaultMessage: 'Authentication required',
    capture: false,
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    status: 401,
    defaultMessage: 'Session expired. Please sign in again.',
    capture: false,
  },
  [ErrorCode.TOKEN_INVALID]: {
    status: 401,
    defaultMessage: 'Invalid authentication token',
    capture: false,
  },
  [ErrorCode.FORBIDDEN]: {
    status: 403,
    defaultMessage: 'Access denied',
    capture: false,
  },
  [ErrorCode.ADMIN_REQUIRED]: {
    status: 403,
    defaultMessage: 'Admin access required',
    capture: false,
  },
  [ErrorCode.EDITOR_REQUIRED]: {
    status: 403,
    defaultMessage: 'Editor or higher access required',
    capture: false,
  },
  [ErrorCode.APPROVER_REQUIRED]: {
    status: 403,
    defaultMessage: 'Approver or admin access required',
    capture: false,
  },

  // Validation
  [ErrorCode.VALIDATION_FAILED]: {
    status: 400,
    defaultMessage: 'Request validation failed',
    capture: false,
  },
  [ErrorCode.INVALID_JSON]: {
    status: 400,
    defaultMessage: 'Invalid JSON in request body',
    capture: false,
  },
  [ErrorCode.PAYLOAD_TOO_LARGE]: {
    status: 413,
    defaultMessage: 'Request payload too large',
    capture: false,
  },
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: {
    status: 415,
    defaultMessage: 'Unsupported media type',
    capture: false,
  },
  [ErrorCode.MISSING_PARAMETER]: {
    status: 400,
    defaultMessage: 'Required parameter missing',
    capture: false,
  },

  // Resource
  [ErrorCode.NOT_FOUND]: {
    status: 404,
    defaultMessage: 'Resource not found',
    capture: false,
  },
  [ErrorCode.CONFLICT]: {
    status: 409,
    defaultMessage: 'Resource conflict',
    capture: false,
  },
  [ErrorCode.GONE]: {
    status: 410,
    defaultMessage: 'Resource no longer available',
    capture: false,
  },
  [ErrorCode.FEATURE_DISABLED]: {
    status: 404,
    defaultMessage: 'Feature is disabled',
    capture: false,
  },

  // Rate limiting
  [ErrorCode.RATE_LIMITED]: {
    status: 429,
    defaultMessage: 'Too many requests. Please try again later.',
    capture: false,
  },
  [ErrorCode.AI_QUOTA_EXCEEDED]: {
    status: 429,
    defaultMessage: 'AI request quota exceeded. Please try again later.',
    capture: true,
  },

  // Server
  [ErrorCode.INTERNAL_ERROR]: {
    status: 500,
    defaultMessage: 'Internal server error',
    capture: true,
  },
  [ErrorCode.DB_ERROR]: {
    status: 500,
    defaultMessage: 'Database error',
    capture: true,
  },
  [ErrorCode.UPSTREAM_ERROR]: {
    status: 502,
    defaultMessage: 'Upstream service error',
    capture: true,
  },
  [ErrorCode.GEMINI_ERROR]: {
    status: 502,
    defaultMessage: 'AI service error',
    capture: true,
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    status: 503,
    defaultMessage: 'Service temporarily unavailable',
    capture: true,
  },
  [ErrorCode.TIMEOUT]: {
    status: 504,
    defaultMessage: 'Request timed out',
    capture: true,
  },
  [ErrorCode.ENV_MISCONFIGURED]: {
    status: 500,
    defaultMessage: 'Server environment misconfigured',
    capture: true,
  },

  // CORS
  [ErrorCode.CORS_ORIGIN_BLOCKED]: {
    status: 403,
    defaultMessage: 'Origin not allowed',
    capture: false,
  },

  // Fallback
  [ErrorCode.ERROR]: {
    status: 500,
    defaultMessage: 'An error occurred',
    capture: true,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get catalog entry for a code, falling back to generic ERROR.
 */
export function getCatalogEntry(code: string | ErrorCode): ErrorCatalogEntry {
  return ERROR_CATALOG[code as ErrorCode] ?? ERROR_CATALOG[ErrorCode.ERROR];
}

/**
 * Infer an ErrorCode from an HTTP status code.
 * Used as a best-effort mapping for legacy code paths.
 */
export function codeFromStatus(status: number): ErrorCode {
  if (status === 400) return ErrorCode.VALIDATION_FAILED;
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 409) return ErrorCode.CONFLICT;
  if (status === 410) return ErrorCode.GONE;
  if (status === 413) return ErrorCode.PAYLOAD_TOO_LARGE;
  if (status === 415) return ErrorCode.UNSUPPORTED_MEDIA_TYPE;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status === 502) return ErrorCode.UPSTREAM_ERROR;
  if (status === 503) return ErrorCode.SERVICE_UNAVAILABLE;
  if (status === 504) return ErrorCode.TIMEOUT;
  if (status >= 500) return ErrorCode.INTERNAL_ERROR;
  return ErrorCode.ERROR;
}

/**
 * Type guard: is this a known catalog code?
 */
export function isKnownErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && code in ERROR_CATALOG;
}
