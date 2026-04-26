/**
 * User-Friendly Error Handling Utilities for StudyPANaCEa
 * Provides consistent error handling across the application
 */

// Import Sentry utilities from lazy-loading module (avoids static @sentry/react import)
import { captureError, captureMessage } from '@/lib/monitoring/sentry';
import { getCalmSystemCopy } from '@/lib/systemStateCopy';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories for user-friendly messages
export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'server'
  | 'database'
  | 'timeout'
  | 'rate_limit'
  | 'not_found'
  | 'conflict'
  | 'unknown';

// Structured error interface
export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  timestamp: string;
  context?: Record<string, unknown>;
  originalError?: Error;
}

// Error code to category mapping
const ERROR_CATEGORY_MAP: Record<string, ErrorCategory> = {
  // Network errors
  ERR_NETWORK: 'network',
  ERR_CONNECTION_REFUSED: 'network',
  ERR_NAME_NOT_RESOLVED: 'network',
  ENOTFOUND: 'network',
  ECONNREFUSED: 'network',
  ECONNRESET: 'network',

  // Timeout errors
  ETIMEDOUT: 'timeout',
  ESOCKETTIMEDOUT: 'timeout',
  ERR_TIMEOUT: 'timeout',

  // Auth errors
  ERR_UNAUTHORIZED: 'authentication',
  ERR_FORBIDDEN: 'authorization',

  // Validation
  ERR_VALIDATION: 'validation',
  ERR_BAD_REQUEST: 'validation',

  // Server errors
  ERR_INTERNAL_SERVER: 'server',
  ERR_SERVICE_UNAVAILABLE: 'server',

  // Rate limiting
  ERR_TOO_MANY_REQUESTS: 'rate_limit',

  // Not found
  ERR_NOT_FOUND: 'not_found',

  // Conflict
  ERR_CONFLICT: 'conflict',
};

// User-friendly message templates
const USER_MESSAGES: Record<ErrorCategory, string> = {
  network:
    "Your progress is safe. We'll reconnect automatically when the connection returns.",
  authentication: 'Your session has expired. Please sign in again to continue.',
  authorization: 'This area is not available for your current account.',
  validation: 'Please check your input and try again.',
  server: 'This is temporarily unavailable. Your progress is safe.',
  database: 'Saving is paused. Your progress is safe locally.',
  timeout: 'This is taking longer than expected. Retry when you are ready.',
  rate_limit: 'Give this a moment before trying again.',
  not_found: 'This item is unavailable. Try search or return to Study.',
  conflict: 'This item was already updated. Refresh before trying again.',
  unknown: 'This is temporarily unavailable. Your progress is safe.',
};

// Retry configuration by error category
const RETRY_CONFIG: Record<
  ErrorCategory,
  { retryable: boolean; maxRetries: number; delayMs: number }
> = {
  network: { retryable: true, maxRetries: 3, delayMs: 1000 },
  authentication: { retryable: false, maxRetries: 0, delayMs: 0 },
  authorization: { retryable: false, maxRetries: 0, delayMs: 0 },
  validation: { retryable: false, maxRetries: 0, delayMs: 0 },
  server: { retryable: true, maxRetries: 2, delayMs: 2000 },
  database: { retryable: true, maxRetries: 2, delayMs: 1500 },
  timeout: { retryable: true, maxRetries: 2, delayMs: 1000 },
  rate_limit: { retryable: true, maxRetries: 1, delayMs: 5000 },
  not_found: { retryable: false, maxRetries: 0, delayMs: 0 },
  conflict: { retryable: true, maxRetries: 1, delayMs: 500 },
  unknown: { retryable: true, maxRetries: 1, delayMs: 1000 },
};

/**
 * Categorize an error based on HTTP status or error code
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof Response || (error && typeof error === 'object' && 'status' in error)) {
    const status = (error as { status: number }).status;
    if (status === 401) return 'authentication';
    if (status === 403) return 'authorization';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 422 || status === 400) return 'validation';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server';
  }

  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    if (code && ERROR_CATEGORY_MAP[code]) {
      return ERROR_CATEGORY_MAP[code];
    }

    // Check error message patterns
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('unauthorized') || message.includes('unauthenticated'))
      return 'authentication';
    if (message.includes('forbidden') || message.includes('permission')) return 'authorization';
  }

  return 'unknown';
}

/**
 * Determine error severity based on category and context
 */
export function determineErrorSeverity(
  category: ErrorCategory,
  context?: Record<string, unknown>
): ErrorSeverity {
  // Critical: Authentication/authorization failures during critical operations
  if (category === 'authentication' || category === 'authorization') {
    return 'high';
  }

  // High: Server errors, database errors
  if (category === 'server' || category === 'database') {
    return 'high';
  }

  // Medium: Network, timeout, rate limit
  if (category === 'network' || category === 'timeout' || category === 'rate_limit') {
    return 'medium';
  }

  // Low: Validation, not found, conflict (user-correctable)
  return 'low';
}

/**
 * Create a structured AppError from any error
 */
export function createAppError(error: unknown, context?: Record<string, unknown>): AppError {
  const category = categorizeError(error);
  const severity = determineErrorSeverity(category, context);
  const retryConfig = RETRY_CONFIG[category];

  let message = 'An error occurred';
  let code = 'ERR_UNKNOWN';

  if (error instanceof Error) {
    message = error.message;
    code = (error as Error & { code?: string }).code || 'ERR_UNKNOWN';
  } else if (typeof error === 'string') {
    message = error;
  }

  return {
    code,
    message,
    userMessage: USER_MESSAGES[category],
    category,
    severity,
    recoverable: category !== 'authentication' && category !== 'authorization',
    retryable: retryConfig.retryable,
    timestamp: new Date().toISOString(),
    context,
    originalError: error instanceof Error ? error : undefined,
  };
}

/**
 * Report error to Sentry with appropriate level
 */
export function reportError(appError: AppError): void {
  const sentryLevel = {
    low: 'info' as const,
    medium: 'warning' as const,
    high: 'error' as const,
    critical: 'fatal' as const,
  }[appError.severity];

  if (appError.originalError) {
    captureError(appError.originalError, {
      tags: {
        error_category: appError.category,
        error_code: appError.code,
        recoverable: String(appError.recoverable),
        retryable: String(appError.retryable),
      },
      extra: appError.context,
      level: sentryLevel,
    });
  } else {
    captureMessage(appError.message, sentryLevel, {
      tags: {
        error_category: appError.category,
        error_code: appError.code,
        recoverable: String(appError.recoverable),
        retryable: String(appError.retryable),
      },
      extra: appError.context,
    });
  }
}

/**
 * Execute a function with automatic retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: AppError) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2, onRetry } = options;

  let lastError: AppError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = createAppError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const currentDelay = delayMs * Math.pow(backoffMultiplier, attempt);

      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await sleep(currentDelay);
    }
  }

  throw lastError;
}

/**
 * Helper function for delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe fetch wrapper with error handling
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit & {
    timeout?: number;
    parseJson?: boolean;
    context?: Record<string, unknown>;
  }
): Promise<{ data: T | null; error: AppError | null }> {
  const { timeout = 30000, parseJson = true, context, ...fetchOptions } = options || {};

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = createAppError(response, { url, ...context });
      reportError(error);
      return { data: null, error };
    }

    const data = parseJson ? await response.json() : await response.text();
    return { data: data as T, error: null };
  } catch (error) {
    const appError = createAppError(error, { url, ...context });
    reportError(appError);
    return { data: null, error: appError };
  }
}

/**
 * Error boundary fallback props helper
 */
export interface ErrorFallbackProps {
  error: AppError;
  resetErrorBoundary: () => void;
}

/**
 * Create error fallback component props from Error
 */
export function createErrorFallbackProps(error: Error, resetFn: () => void): ErrorFallbackProps {
  return {
    error: createAppError(error),
    resetErrorBoundary: resetFn,
  };
}

/**
 * Format error for display in toast/notification
 */
export function formatErrorForToast(error: AppError): {
  title: string;
  description: string;
  variant: 'error' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
} {
  const variant =
    error.severity === 'low' ? 'info' : error.severity === 'medium' ? 'warning' : 'error';
  const calmCopy = getCalmSystemCopy(error.message);

  return {
    title: getErrorTitle(error.category),
    description: calmCopy.description || error.userMessage,
    variant,
    action: error.retryable ? { label: 'Try Again', onClick: () => {} } : undefined,
  };
}

/**
 * Get a short title for error category
 */
function getErrorTitle(category: ErrorCategory): string {
  const titles: Record<ErrorCategory, string> = {
    network: 'Connection paused',
    authentication: 'Session Expired',
    authorization: 'Access unavailable',
    validation: 'Check this entry',
    server: 'Service unavailable',
    database: 'Save paused',
    timeout: 'Still working',
    rate_limit: 'Brief pause needed',
    not_found: 'Item unavailable',
    conflict: 'Already updated',
    unknown: 'Temporarily unavailable',
  };
  return titles[category];
}

/**
 * Context for tailoring user-facing error copy (e.g. drill vs tutor)
 */
export type ErrorDisplayContext = 'default' | 'drill' | 'gemini';

/**
 * User-facing error copy for ErrorState and error boundary fallbacks.
 * Returns friendly title, message, primary action label, and optional secondary action label.
 */
export function getUserFacingError(
  category: ErrorCategory,
  context: ErrorDisplayContext = 'default'
): {
  title: string;
  message: string;
  primaryAction: string;
  secondaryLabel?: string;
} {
  if (context === 'gemini') {
    return {
      title: 'Tutor unavailable',
      message:
        'Continue the question and try the tutor again in a moment.',
      primaryAction: 'Try Again',
      secondaryLabel: 'Go Home',
    };
  }

  const base: Record<ErrorCategory, { title: string; message: string }> = {
    network: {
      title: 'Connection paused',
      message: "Your progress is saved locally. We'll sync automatically when the connection returns.",
    },
    authentication: {
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in again to continue.',
    },
    authorization: {
      title: 'Access unavailable',
      message: 'This area is not available for your current account.',
    },
    validation: {
      title: 'Check this entry',
      message: 'Please check your input and try again.',
    },
    server: {
      title: 'Temporarily unavailable',
      message: 'Your progress is safe. Retry or return to Study.',
    },
    database: {
      title: 'Save paused',
      message: 'Your progress is safe locally. Retry when you are ready.',
    },
    timeout: {
      title: 'Still working',
      message: 'This is taking longer than expected. Retry when you are ready.',
    },
    rate_limit: {
      title: 'Brief pause needed',
      message: 'Give this a moment before trying again.',
    },
    not_found: {
      title: 'Item unavailable',
      message: 'Try search or return to Study.',
    },
    conflict: {
      title: 'Already updated',
      message: 'Refresh before trying again.',
    },
    unknown: {
      title: 'Temporarily unavailable',
      message: 'Your progress is safe. Retry or return to Study.',
    },
  };

  const { title, message } = base[category];
  const primaryAction = 'Try Again';
  const secondaryLabel =
    context === 'drill'
      ? 'Back to Command Center'
      : category === 'network' || category === 'server' || category === 'unknown'
        ? 'Go Home'
        : undefined;

  return { title, message, primaryAction, secondaryLabel };
}

/**
 * Check if error is recoverable by user action
 */
export function isUserRecoverable(error: AppError): boolean {
  return (
    error.category === 'validation' ||
    error.category === 'network' ||
    error.category === 'timeout' ||
    error.category === 'rate_limit'
  );
}

/**
 * Get recovery suggestions for user
 */
export function getRecoverySuggestions(error: AppError): string[] {
  const suggestions: Record<ErrorCategory, string[]> = {
    network: [
      'Check your internet connection',
      'Try disabling VPN if active',
      'Refresh the page and try again',
    ],
    authentication: ['Sign in again to continue', 'Clear browser cookies and try again'],
    authorization: ['Contact your administrator for access', 'Try a different account'],
    validation: [
      'Review your input for errors',
      'Check required fields',
      'Ensure data format is correct',
    ],
    server: ['Wait a moment and try again', 'Contact support if the issue persists'],
    database: ['Try again in a few seconds', 'Check if you have unsaved changes'],
    timeout: ['Check your internet connection', 'Try a smaller request', 'Wait and try again'],
    rate_limit: ['Wait a minute before trying again', 'Reduce the frequency of requests'],
    not_found: [
      'Check the URL for typos',
      'The item may have been deleted',
      'Try searching for it',
    ],
    conflict: ['Refresh the page to get latest data', 'Your changes may have been saved elsewhere'],
    unknown: [
      'Refresh the page',
      'Try again in a few moments',
      'Contact support if the issue persists',
    ],
  };

  return suggestions[error.category];
}

/**
 * Hook-friendly error state type
 */
export interface UseErrorState {
  error: AppError | null;
  isError: boolean;
  clearError: () => void;
  setError: (error: unknown, context?: Record<string, unknown>) => void;
}

/**
 * Create initial error state for custom hooks
 */
export function createErrorState(): UseErrorState {
  let currentError: AppError | null = null;

  return {
    get error() {
      return currentError;
    },
    get isError() {
      return currentError !== null;
    },
    clearError: () => {
      currentError = null;
    },
    setError: (error: unknown, context?: Record<string, unknown>) => {
      currentError = createAppError(error, context);
      reportError(currentError);
    },
  };
}
