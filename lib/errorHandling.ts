/**
 * Unified Error Handling for PANaCEa
 *
 * Provides:
 * - AppError class for throwing typed errors with HTTP status codes
 * - createErrorResponse for consistent API error responses
 * - Integration with centralized logger
 */

import { logger } from './logger';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Application-specific error with HTTP status code
 * Use this instead of throwing generic Error objects
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Common error types with predefined status codes
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Creates a standardized error Response for Cloudflare Functions
 * Logs the error and returns a consistent JSON error response
 *
 * @param error - The error object (AppError, Error, or unknown)
 * @param defaultMessage - Fallback message for non-AppError errors
 * @returns Response object with error details
 *
 * @example
 * ```typescript
 * try {
 *   // ... handler logic
 *   if (!found) throw new NotFoundError('User');
 * } catch (error) {
 *   return createErrorResponse(error, 'Failed to fetch user');
 * }
 * ```
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = 'An error occurred'
): Response {
  const isAppError = error instanceof AppError;
  const status = isAppError ? error.statusCode : 500;
  const message = isAppError ? error.message : defaultMessage;
  const code = isAppError ? error.code : 'INTERNAL_ERROR';
  const details = isAppError ? error.details : undefined;

  // Log the error with appropriate level
  if (status >= 500) {
    logger.error('API Error:', { error: error instanceof Error ? error.message : String(error) });
  } else if (status >= 400) {
    logger.warn('Client Error:', { message, code, status });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code,
      ...(details && { details }),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * Creates a success Response for Cloudflare Functions
 *
 * @param data - Response data
 * @param status - HTTP status code (default 200)
 * @returns Response object with success: true and data
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}

/**
 * Checks if error is an operational error (expected) vs programming error (bug)
 * Operational errors should be handled gracefully, programming errors should crash
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) return true;
  if (error instanceof Error) {
    // Prisma errors are operational
    if (error.name.startsWith('Prisma')) return true;
    // Network errors are operational
    if (error.message.includes('fetch') || error.message.includes('network')) return true;
  }
  return false;
}
