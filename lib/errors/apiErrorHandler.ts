/**
 * API Error Handler - Utilities for handling API errors with AppError system
 *
 * This module provides utilities for converting fetch errors, network errors,
 * and API response errors into standardized AppError instances.
 */

import {
  AppErrorFactory,
  ErrorCategory,
  ErrorCode,
  RecoveryAction,
  type AppError,
} from './appError';

/**
 * Options for handling API errors
 */
export interface ApiErrorHandlerOptions {
  /** Endpoint name for error context */
  endpoint?: string;
  /** HTTP method for error context */
  method?: string;
  /** Whether to include response body in error details */
  includeResponseBody?: boolean;
  /** Default recovery actions for network errors */
  defaultRecoveryActions?: RecoveryAction[];
  /** Whether to retry automatically on network errors */
  autoRetry?: boolean;
  /** Maximum retry attempts for auto-retry */
  maxRetryAttempts?: number;
}

type RetryableAppError = AppError & {
  retryDelay?: number;
};

function getRetryDelay(error: AppError, attempt: number): number {
  const retryableError = error as RetryableAppError;
  return retryableError.retryDelay || 1000 * Math.pow(2, attempt - 1);
}

function createApiError(
  originalError: unknown,
  category: ErrorCategory,
  code: ErrorCode,
  details: Record<string, unknown>,
  options: {
    userMessage: string;
    technicalMessage: string;
    recoveryActions: RecoveryAction[];
    isRetryable: boolean;
    retryDelay?: number;
  }
): RetryableAppError {
  const appError = AppErrorFactory.create(originalError, category, code, details);

  return {
    ...appError,
    userMessage: options.userMessage,
    message: options.technicalMessage,
    recoveryActions: options.recoveryActions,
    isRetryable: options.isRetryable,
    maxRetries: options.isRetryable ? appError.maxRetries : 0,
    ...(options.retryDelay !== undefined ? { retryDelay: options.retryDelay } : {}),
  };
}

/**
 * Convert a fetch Response error to AppError
 */
export async function responseToAppError(
  response: Response,
  options: ApiErrorHandlerOptions = {}
): Promise<AppError> {
  const { endpoint, method, includeResponseBody = false } = options;

  const errorDetails: Record<string, unknown> = {
    status: response.status,
    statusText: response.statusText,
    endpoint,
    method,
  };

  try {
    // Try to parse error response body
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const errorData = (await response.json()) as unknown;
      errorDetails.responseBody = includeResponseBody ? errorData : 'REDACTED';

      // Extract error message from common API error formats
      const errorRecord =
        errorData && typeof errorData === 'object' ? (errorData as Record<string, unknown>) : {};
      const nestedError =
        errorRecord.error && typeof errorRecord.error === 'object'
          ? (errorRecord.error as Record<string, unknown>)
          : undefined;
      const errorMessage =
        (nestedError?.message as string | undefined) ||
        (errorRecord.message as string | undefined) ||
        (typeof errorRecord.error === 'string' ? errorRecord.error : undefined) ||
        `HTTP ${response.status}: ${response.statusText}`;

      return createAppErrorForHttpStatus(response.status, errorMessage, errorDetails, options);
    } else if (contentType?.includes('text/')) {
      const text = await response.text();
      errorDetails.responseBody = includeResponseBody ? text : 'REDACTED';
      return createAppErrorForHttpStatus(response.status, text, errorDetails, options);
    }
  } catch (parseError) {
    // If we can't parse the response, just use status info
    console.warn('Failed to parse error response:', parseError);
  }

  return createAppErrorForHttpStatus(
    response.status,
    `HTTP ${response.status}: ${response.statusText}`,
    errorDetails,
    options
  );
}

/**
 * Create AppError for specific HTTP status codes
 */
function createAppErrorForHttpStatus(
  status: number,
  message: string,
  details: Record<string, unknown>,
  options: ApiErrorHandlerOptions
): AppError {
  const { endpoint, method, defaultRecoveryActions = [] } = options;

  switch (status) {
    case 400:
      return createApiError(
        new Error(message),
        ErrorCategory.VALIDATION,
        ErrorCode.VALIDATION_INVALID_FORMAT,
        { ...details, endpoint, method },
        {
          userMessage: 'Invalid request. Please check your input and try again.',
          technicalMessage: `Validation error: ${message}`,
          recoveryActions: [RecoveryAction.CLEAR_CACHE, ...defaultRecoveryActions],
          isRetryable: false,
        }
      );

    case 401:
      return createApiError(
        new Error(message),
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_TOKEN_EXPIRED,
        { ...details, endpoint, method },
        {
          userMessage: 'Your session has expired. Please sign in again.',
          technicalMessage: `Authentication error: ${message}`,
          recoveryActions: [RecoveryAction.REAUTHENTICATE, ...defaultRecoveryActions],
          isRetryable: false,
        }
      );

    case 403:
      return createApiError(
        new Error(message),
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_PERMISSION_DENIED,
        { ...details, endpoint, method },
        {
          userMessage: "You don't have permission to access this resource.",
          technicalMessage: `Permission denied: ${message}`,
          recoveryActions: [RecoveryAction.REAUTHENTICATE, ...defaultRecoveryActions],
          isRetryable: false,
        }
      );

    case 404:
      return createApiError(
        new Error(message),
        ErrorCategory.CLIENT,
        ErrorCode.CONTENT_NOT_FOUND,
        { ...details, endpoint, method },
        {
          userMessage: 'The requested resource was not found.',
          technicalMessage: `Resource not found: ${message}`,
          recoveryActions: [RecoveryAction.REFRESH, ...defaultRecoveryActions],
          isRetryable: false,
        }
      );

    case 429:
      return createApiError(
        new Error(message),
        ErrorCategory.RATE_LIMIT,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        { ...details, endpoint, method },
        {
          userMessage: 'Too many requests. Please wait a moment and try again.',
          technicalMessage: `Rate limit exceeded: ${message}`,
          recoveryActions: [RecoveryAction.WAIT_AND_RETRY, ...defaultRecoveryActions],
          isRetryable: true,
          retryDelay: 60000, // 1 minute
        }
      );

    case 500:
    case 502:
    case 503:
    case 504:
      return createApiError(
        new Error(message),
        ErrorCategory.NETWORK,
        ErrorCode.NETWORK_SERVER_ERROR,
        { ...details, endpoint, method },
        {
          userMessage: 'The server is experiencing issues. Please try again in a moment.',
          technicalMessage: `Server error (${status}): ${message}`,
          recoveryActions: [
            RecoveryAction.RETRY,
            RecoveryAction.GO_OFFLINE,
            ...defaultRecoveryActions,
          ],
          isRetryable: true,
          retryDelay: 10000, // 10 seconds
        }
      );

    default:
      return createApiError(
        new Error(message),
        ErrorCategory.NETWORK,
        status >= 500 ? ErrorCode.NETWORK_SERVER_ERROR : ErrorCode.UNKNOWN_ERROR,
        { ...details, endpoint, method },
        {
          userMessage: 'An unexpected error occurred. Please try again.',
          technicalMessage: `HTTP ${status}: ${message}`,
          recoveryActions: [RecoveryAction.RETRY, ...defaultRecoveryActions],
          isRetryable: status >= 500, // Retry on server errors
        }
      );
  }
}

/**
 * Convert a network/fetch error to AppError
 */
export function networkErrorToAppError(
  error: Error | DOMException,
  options: ApiErrorHandlerOptions = {}
): AppError {
  const { endpoint, method, defaultRecoveryActions = [] } = options;

  const errorMessage = error.message || 'Network error';
  const isOffline = !navigator.onLine;

  if (isOffline) {
    return createApiError(
      error,
      ErrorCategory.NETWORK,
      ErrorCode.NETWORK_OFFLINE,
      { endpoint, method, offline: true },
      {
        userMessage: 'You appear to be offline. Please check your connection.',
        technicalMessage: `Network offline: ${errorMessage}`,
        recoveryActions: [RecoveryAction.GO_OFFLINE, RecoveryAction.RETRY, ...defaultRecoveryActions],
        isRetryable: true,
        retryDelay: 5000, // 5 seconds
      }
    );
  }

  // Check for specific network error types
  if (error.name === 'AbortError') {
    return createApiError(
      error,
      ErrorCategory.NETWORK,
      ErrorCode.NETWORK_TIMEOUT,
      { endpoint, method, timeout: true },
      {
        userMessage: 'The request timed out. Please try again.',
        technicalMessage: `Request timeout: ${errorMessage}`,
        recoveryActions: [RecoveryAction.RETRY, ...defaultRecoveryActions],
        isRetryable: true,
        retryDelay: 3000, // 3 seconds
      }
    );
  }

  if (error.name === 'TypeError' && errorMessage.includes('Failed to fetch')) {
    return createApiError(
      error,
      ErrorCategory.NETWORK,
      ErrorCode.NETWORK_SERVER_ERROR,
      { endpoint, method, fetchError: true },
      {
        userMessage: 'Unable to connect to the server. Please check your connection.',
        technicalMessage: `Failed to fetch: ${errorMessage}`,
        recoveryActions: [RecoveryAction.RETRY, RecoveryAction.GO_OFFLINE, ...defaultRecoveryActions],
        isRetryable: true,
        retryDelay: 5000, // 5 seconds
      }
    );
  }

  // Generic network error
  return createApiError(
    error,
    ErrorCategory.NETWORK,
    ErrorCode.NETWORK_SERVER_ERROR,
    { endpoint, method, errorName: error.name },
    {
      userMessage: 'A network error occurred. Please check your connection and try again.',
      technicalMessage: `Network error: ${errorMessage}`,
      recoveryActions: [RecoveryAction.RETRY, ...defaultRecoveryActions],
      isRetryable: true,
    }
  );
}

/**
 * Enhanced fetch wrapper that returns AppError on failure
 */
export async function fetchWithErrorHandling(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ApiErrorHandlerOptions = {}
): Promise<Response> {
  const {
    endpoint,
    method = init?.method || 'GET',
    autoRetry = false,
    maxRetryAttempts = 3,
  } = options;

  let lastError: AppError | null = null;
  let attempt = 0;

  while (attempt < (autoRetry ? maxRetryAttempts : 1)) {
    attempt++;

    try {
      const response = await fetch(input, init);

      if (!response.ok) {
        const appError = await responseToAppError(response, options);
        lastError = appError;

        // Check if we should retry
        if (autoRetry && appError.isRetryable && attempt < maxRetryAttempts) {
          const delay = getRetryDelay(appError, attempt); // Exponential backoff
          console.log(
            `Retrying ${endpoint || 'request'} in ${delay}ms (attempt ${attempt}/${maxRetryAttempts})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw appError;
      }

      return response;
    } catch (error) {
      // If it's already an AppError, rethrow it
      if (error && typeof error === 'object' && 'category' in error) {
        lastError = error as AppError;

        // Check if we should retry
        if (autoRetry && lastError.isRetryable && attempt < maxRetryAttempts) {
          const delay = getRetryDelay(lastError, attempt);
          console.log(
            `Retrying ${endpoint || 'request'} in ${delay}ms (attempt ${attempt}/${maxRetryAttempts})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }

      // Convert to AppError
      const appError = networkErrorToAppError(
        error instanceof Error ? error : new Error(String(error)),
        options
      );
      lastError = appError;

      // Check if we should retry
      if (autoRetry && appError.isRetryable && attempt < maxRetryAttempts) {
        const delay = getRetryDelay(appError, attempt);
        console.log(
          `Retrying ${endpoint || 'request'} in ${delay}ms (attempt ${attempt}/${maxRetryAttempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw appError;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error in fetchWithErrorHandling');
}

/**
 * Enhanced fetch wrapper that automatically parses JSON and handles errors
 */
export async function fetchJsonWithErrorHandling<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ApiErrorHandlerOptions = {}
): Promise<T> {
  const response = await fetchWithErrorHandling(input, init, options);

  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    throw createApiError(
      error instanceof Error ? error : new Error(String(error)),
      ErrorCategory.CLIENT,
      ErrorCode.CLIENT_SCRIPT_ERROR,
      { endpoint: options.endpoint, method: options.method },
      {
        userMessage: 'Failed to parse server response.',
        technicalMessage: 'JSON parse error',
        recoveryActions: [RecoveryAction.REFRESH, RecoveryAction.CLEAR_CACHE],
        isRetryable: false,
      }
    );
  }
}

/**
 * Check if we're online and handle offline state gracefully
 */
export function checkNetworkStatus(): { isOnline: boolean; error?: AppError } {
  const isOnline = navigator.onLine;

  if (!isOnline) {
    return {
      isOnline: false,
      error: createApiError(
        new Error('Network offline'),
        ErrorCategory.NETWORK,
        ErrorCode.NETWORK_OFFLINE,
        { offline: true },
        {
          userMessage: 'You appear to be offline. Please check your connection.',
          technicalMessage: 'Network offline',
          recoveryActions: [RecoveryAction.GO_OFFLINE, RecoveryAction.RETRY],
          isRetryable: true,
          retryDelay: 5000,
        }
      ),
    };
  }

  return { isOnline: true };
}

/**
 * Create a retry policy for specific error types
 */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
  retryableCategories: ErrorCategory[];
}

/**
 * Default retry policy for network requests
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
  retryableCategories: [ErrorCategory.NETWORK, ErrorCategory.RATE_LIMIT],
};

/**
 * Execute a function with retry logic based on AppError
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<T> {
  let lastError: AppError | Error | null = null;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = shouldRetryError(error, policy, attempt);

      if (!shouldRetry || attempt === policy.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        policy.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        policy.maxDelay
      );

      console.log(`Retry attempt ${attempt}/${policy.maxAttempts} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error in executeWithRetry');
}

/**
 * Determine if an error should be retried based on policy
 */
function shouldRetryError(error: unknown, policy: RetryPolicy, attempt: number): boolean {
  if (attempt >= policy.maxAttempts) return false;

  // Check if it's an AppError
  if (error && typeof error === 'object' && 'category' in error) {
    const appError = error as AppError;

    // Check category
    if (policy.retryableCategories.includes(appError.category)) {
      return appError.isRetryable !== false;
    }

    return false;
  }

  // For non-AppError errors, check if they're network-related
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('connection')
    );
  }

  return false;
}
