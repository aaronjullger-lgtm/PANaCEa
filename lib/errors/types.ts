/**
 * Structured Error Types for Production Error Handling
 * 
 * Provides type-safe error classes with categorization, retry metadata,
 * and context for production monitoring via Sentry.
 */

/**
 * Error severity levels matching Sentry's classification
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Error categories for classification and monitoring
 */
export type ErrorCategory =
  | 'network'
  | 'api'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'rate_limit'
  | 'timeout'
  | 'database'
  | 'filesystem'
  | 'external_service'
  | 'user_input'
  | 'configuration'
  | 'unknown';

/**
 * Retry strategy metadata
 */
export interface RetryMetadata {
  retryable: boolean;
  retryAfterMs?: number;
  maxRetries?: number;
  currentAttempt?: number;
}

/**
 * Base application error with structured metadata
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryMetadata: RetryMetadata;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;
  public readonly errorId: string;

  constructor(
    message: string,
    category: ErrorCategory = 'unknown',
    severity: ErrorSeverity = 'error',
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.severity = severity;
    this.retryMetadata = { retryable };
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Network-related errors (fetch failures, connection issues)
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'network',
      statusCode && statusCode >= 500 ? 'error' : 'warning',
      true, // Network errors are typically retryable
      context
    );
    this.name = 'NetworkError';
    this.retryMetadata = {
      retryable: true,
      retryAfterMs: 2000,
      maxRetries: 3,
    };
  }
}

/**
 * API-related errors (external service failures, rate limits)
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'api',
      statusCode === 429 ? 'warning' : statusCode && statusCode >= 500 ? 'error' : 'warning',
      statusCode ? statusCode >= 500 || statusCode === 429 || statusCode === 408 : false,
      { ...context, endpoint, statusCode }
    );
    this.name = 'ApiError';

    // Configure retry based on status code
    if (statusCode === 429) {
      this.retryMetadata = {
        retryable: true,
        retryAfterMs: 60000,
        maxRetries: 2,
      };
    } else if (statusCode && statusCode >= 500) {
      this.retryMetadata = {
        retryable: true,
        retryAfterMs: 3000,
        maxRetries: 3,
      };
    } else if (statusCode === 408) {
      this.retryMetadata = {
        retryable: true,
        retryAfterMs: 1000,
        maxRetries: 2,
      };
    }
  }
}

/**
 * Validation errors (user input, schema validation)
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'validation',
      'warning',
      false, // Validation errors are not retryable
      { ...context, field, value }
    );
    this.name = 'ValidationError';
  }
}

/**
 * Authentication errors (missing/invalid credentials)
 */
export class AuthenticationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      message,
      'authentication',
      'warning',
      false, // Auth errors typically require user action
      context
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization errors (insufficient permissions)
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string,
    public readonly resource?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'authorization',
      'warning',
      false,
      { ...context, resource }
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'rate_limit', 'warning', true, context);
    this.name = 'RateLimitError';
    this.retryMetadata = {
      retryable: true,
      retryAfterMs: (retryAfterSeconds || 60) * 1000,
      maxRetries: 2,
    };
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'timeout', 'warning', true, { ...context, timeoutMs });
    this.name = 'TimeoutError';
    this.retryMetadata = {
      retryable: true,
      retryAfterMs: 1000,
      maxRetries: 2,
    };
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly operation?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'database', 'error', true, { ...context, operation });
    this.name = 'DatabaseError';
    this.retryMetadata = {
      retryable: true,
      retryAfterMs: 2000,
      maxRetries: 2,
    };
  }
}

/**
 * External service errors (Gemini, Supabase, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'external_service',
      statusCode && statusCode >= 500 ? 'error' : 'warning',
      true,
      { ...context, service, statusCode }
    );
    this.name = 'ExternalServiceError';
    this.retryMetadata = {
      retryable: true,
      retryAfterMs: statusCode === 429 ? 60000 : 3000,
      maxRetries: 2,
    };
  }
}

/**
 * Configuration errors (missing env vars, invalid config)
 */
export class ConfigurationError extends AppError {
  constructor(
    message: string,
    public readonly configKey?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'configuration', 'error', false, { ...context, configKey });
    this.name = 'ConfigurationError';
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryMetadata.retryable;
  }
  return false;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'unknown', 'error', false, {
      originalName: error.name,
      originalStack: error.stack,
    });
  }

  return new AppError(
    String(error),
    'unknown',
    'error',
    false
  );
}

/**
 * Extract safe error message for user display
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isAppError(error)) {
    switch (error.category) {
      case 'network':
        return 'Network connection issue. Please check your internet and try again.';
      case 'rate_limit':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'timeout':
        return 'Request timed out. Please try again.';
      case 'authentication':
        return 'Authentication required. Please sign in.';
      case 'authorization':
        return 'You do not have permission to perform this action.';
      case 'validation':
        return error.message; // Validation errors are already user-friendly
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  return 'An unexpected error occurred. Please try again.';
}
