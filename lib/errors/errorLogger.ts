/**
 * Edge-Compatible Error Logging Service
 *
 * Production-grade error logging with Sentry integration.
 * Works in both browser and Cloudflare Pages Functions (Edge Runtime).
 *
 * Features:
 * - Structured error logging with metadata
 * - Sentry integration for production monitoring
 * - Breadcrumb tracking for error context
 * - Safe error serialization
 * - Development console logging
 * - Edge Runtime compatible (no Node.js APIs)
 */

import type { AppError, ErrorSeverity } from './types';
import { isAppError, toAppError } from './types';

/**
 * Breadcrumb for tracking user actions leading to errors
 */
export interface Breadcrumb {
  message: string;
  category: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
  errorId: string;
  message: string;
  name: string;
  stack?: string;
  category: string;
  severity: ErrorSeverity;
  timestamp: string;
  context?: Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
  userAgent?: string;
  url?: string;
}

/**
 * Lazy-loaded Sentry functions (production only)
 */
let sentryModule: {
  captureError: (error: Error, context?: Record<string, unknown>) => void;
  addBreadcrumb: (
    message: string,
    category: string,
    level?: ErrorSeverity,
    data?: Record<string, unknown>
  ) => void;
} | null = null;

/**
 * Initialize Sentry module (lazy load in production)
 */
async function initSentry() {
  if (sentryModule) return sentryModule;

  if (import.meta.env.PROD) {
    try {
      const sentry = await import('../monitoring/sentry');
      sentryModule = {
        captureError: sentry.captureError,
        addBreadcrumb: sentry.addBreadcrumb,
      };
      return sentryModule;
    } catch (error) {
      console.warn('[ErrorLogger] Failed to load Sentry module:', error);
      return null;
    }
  }

  return null;
}

/**
 * Breadcrumb storage (in-memory, max 50)
 */
const breadcrumbBuffer: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

/**
 * Add a breadcrumb to track user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, unknown>
): void {
  const breadcrumb: Breadcrumb = {
    message,
    category,
    level,
    timestamp: new Date().toISOString(),
    data,
  };

  breadcrumbBuffer.push(breadcrumb);

  // Keep buffer size manageable
  if (breadcrumbBuffer.length > MAX_BREADCRUMBS) {
    breadcrumbBuffer.shift();
  }

  // Send to Sentry if available
  initSentry().then((sentry) => {
    if (sentry) {
      sentry.addBreadcrumb(message, category, level as ErrorSeverity, data);
    }
  });

  // Log in development
  if (import.meta.env.DEV) {
    console.debug(`[Breadcrumb] ${category}: ${message}`, data);
  }
}

/**
 * Get recent breadcrumbs
 */
export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbBuffer];
}

/**
 * Clear breadcrumbs
 */
export function clearBreadcrumbs(): void {
  breadcrumbBuffer.length = 0;
}

/**
 * Safe error serialization for logging
 * Handles circular references and non-serializable values
 */
function serializeError(error: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  // Add custom properties from AppError
  if (isAppError(error)) {
    serialized.category = error.category;
    serialized.severity = error.severity;
    serialized.errorId = error.errorId;
    serialized.timestamp = error.timestamp;
    serialized.retryable = error.retryMetadata.retryable;
    serialized.context = error.context;
  }

  return serialized;
}

/**
 * Get safe environment metadata
 */
function getEnvironmentMetadata(): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    environment: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    timestamp: new Date().toISOString(),
  };

  // Browser-specific metadata
  if (typeof window !== 'undefined') {
    metadata.userAgent = navigator.userAgent;
    metadata.url = window.location.href;
    metadata.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  return metadata;
}

/**
 * Main error logging function
 *
 * @param error - Error to log (AppError, Error, or unknown)
 * @param context - Additional context for debugging
 *
 * @example
 * ```typescript
 * try {
 *   await fetchData();
 * } catch (error) {
 *   logError(error, { operation: 'fetchData', userId: user.id });
 * }
 * ```
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  // Convert to AppError for consistent handling
  const appError = toAppError(error);

  // Create log entry
  const logEntry: ErrorLogEntry = {
    errorId: appError.errorId,
    message: appError.message,
    name: appError.name,
    stack: appError.stack,
    category: appError.category,
    severity: appError.severity,
    timestamp: appError.timestamp,
    context: {
      ...appError.context,
      ...context,
      ...getEnvironmentMetadata(),
    },
    breadcrumbs: getBreadcrumbs(),
  };

  // Add browser-specific data
  if (typeof window !== 'undefined') {
    logEntry.userAgent = navigator.userAgent;
    logEntry.url = window.location.href;
  }

  // Log to console in development
  if (import.meta.env.DEV) {
    const consoleMethod =
      appError.severity === 'fatal' || appError.severity === 'error'
        ? console.error
        : appError.severity === 'warning'
          ? console.warn
          : console.log;

    consoleMethod(
      `[${appError.category.toUpperCase()}] ${appError.message}`,
      '\nError ID:',
      appError.errorId,
      '\nContext:',
      logEntry.context,
      '\nStack:',
      appError.stack
    );
  }

  // Send to Sentry in production
  if (import.meta.env.PROD) {
    initSentry().then((sentry) => {
      if (sentry) {
        sentry.captureError(appError, {
          tags: {
            category: appError.category,
            errorId: appError.errorId,
            retryable: appError.retryMetadata.retryable.toString(),
          },
          extra: {
            ...logEntry.context,
            breadcrumbs: logEntry.breadcrumbs,
          },
          level: appError.severity,
        });
      }
    });
  }

  // Store in session storage for debugging (browser only)
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      const errorLog = sessionStorage.getItem('panacea_error_log');
      const errors = errorLog ? JSON.parse(errorLog) : [];
      errors.push(logEntry);

      // Keep last 20 errors
      if (errors.length > 20) {
        errors.shift();
      }

      sessionStorage.setItem('panacea_error_log', JSON.stringify(errors));
    } catch {
      // Ignore sessionStorage errors
    }
  }
}

/**
 * Log error with additional context and automatic breadcrumb
 *
 * @example
 * ```typescript
 * logErrorWithContext(error, 'fetchUserData', { userId: '123' });
 * ```
 */
export function logErrorWithContext(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): void {
  addBreadcrumb(`Operation failed: ${operation}`, 'error', 'error', context);
  logError(error, { ...context, operation });
}

/**
 * Get error logs from session storage (for debugging)
 */
export function getErrorLogs(): ErrorLogEntry[] {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return [];
  }

  try {
    const errorLog = sessionStorage.getItem('panacea_error_log');
    return errorLog ? JSON.parse(errorLog) : [];
  } catch {
    return [];
  }
}

/**
 * Clear error logs from session storage
 */
export function clearErrorLogs(): void {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('panacea_error_log');
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Track performance issue as a warning
 */
export function logPerformanceIssue(
  operation: string,
  duration: number,
  threshold: number,
  context?: Record<string, unknown>
): void {
  if (duration > threshold) {
    addBreadcrumb(
      `Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
      'performance',
      'warning',
      { operation, duration, threshold, ...context }
    );

    if (import.meta.env.DEV) {
      console.warn(
        `[Performance] ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
        context
      );
    }
  }
}

/**
 * Export for use in error boundaries
 */
export { serializeError, getEnvironmentMetadata };
