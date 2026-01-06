/**
 * Sentry Error Tracking Configuration
 * 
 * Centralizes error tracking and performance monitoring for PANaCEa.
 * Used across client-side React app and CloudFlare Functions.
 */

import * as Sentry from '@sentry/react';

export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  beforeSend?: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
}

/**
 * Initialize Sentry for React application
 */
export function initializeSentry(config?: Partial<SentryConfig>): void {
  const isDevelopment = import.meta.env.DEV;
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Don't initialize in development unless explicitly enabled
  if (isDevelopment && !import.meta.env.VITE_SENTRY_ENABLE_DEV) {
    console.log('[Sentry] Skipping initialization in development');
    return;
  }

  if (!dsn) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  const defaultConfig: SentryConfig = {
    dsn,
    environment: import.meta.env.MODE || 'production',
    
    // Performance Monitoring
    tracesSampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in prod
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Filter sensitive data
    beforeSend: (event: Sentry.ErrorEvent) => {
      // Remove sensitive data from events
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }
      
      // Remove query parameters that might contain sensitive data
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          url.searchParams.delete('token');
          url.searchParams.delete('apiKey');
          event.request.url = url.toString();
        } catch (e) {
          // Invalid URL, skip sanitization
        }
      }
      
      return event;
    },
  };

  const finalConfig = { ...defaultConfig, ...config };

  Sentry.init({
    dsn: finalConfig.dsn,
    environment: finalConfig.environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: finalConfig.tracesSampleRate,
    replaysSessionSampleRate: finalConfig.replaysSessionSampleRate,
    replaysOnErrorSampleRate: finalConfig.replaysOnErrorSampleRate,
    beforeSend: finalConfig.beforeSend,
    
    // Ignore common non-critical errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      
      // Network errors (often transient)
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      
      // ResizeObserver (benign)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      
      // Chunk loading (handled by ErrorBoundary)
      'ChunkLoadError',
      'Loading chunk',
      
      // Ad blockers
      'adsbygoogle',
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Capture error with context
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
    user?: { id: string; email?: string };
  }
): string {
  console.error('[Sentry] Capturing error:', error, context);
  
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  
  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }
  
  if (context?.user) {
    Sentry.setUser(context.user);
  }
  
  return Sentry.captureException(error, {
    level: context?.level || 'error',
  });
}

/**
 * Capture message (non-error logging)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): string {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  
  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }
  
  return Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
  role?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Measure performance of an async operation using Sentry spans
 */
export async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: 'function',
      attributes: tags,
    },
    async () => {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        throw error;
      }
    }
  );
}

/**
 * Create Sentry error boundary wrapper
 */
export const withSentryErrorBoundary = Sentry.withErrorBoundary;

/**
 * Profile React component performance
 */
export const withProfiler = Sentry.withProfiler;

/**
 * Export Sentry namespace for advanced usage
 */
export { Sentry };
