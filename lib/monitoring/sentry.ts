/**
 * Sentry Error Tracking Configuration
 *
 * IMPORTANT: This module uses lazy loading to prevent conflicts with Clerk.
 * Sentry is only loaded when VITE_SENTRY_DSN is configured.
 */

// Sentry instance - loaded lazily only when DSN is configured
let Sentry: typeof import('@sentry/react') | null = null;
let isInitialized = false;

export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

/**
 * Initialize Sentry for React application
 * Only loads Sentry SDK if DSN is configured
 */
export async function initializeSentry(config?: Partial<SentryConfig>): Promise<void> {
  // @ts-ignore
  const mode = import.meta.env?.MODE;
  const isProduction = mode === 'production';

  // Only touch the DSN when we're in production
  if (!isProduction) {
    console.log('[Sentry] Skipping initialization outside production');
    return;
  }

  // @ts-ignore
  const dsn = import.meta.env?.VITE_SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  try {
    // Dynamically import Sentry only when we have a DSN
    Sentry = await import('@sentry/react');

    const defaultConfig: SentryConfig = {
      dsn,
      environment: mode || 'production',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    };

    const finalConfig = { ...defaultConfig, ...config };

    Sentry.init({
      dsn: finalConfig.dsn,
      environment: finalConfig.environment,
      // Use our tunnel to bypass ad-blockers and CORS restrictions
      // The tunnel proxies Sentry envelopes through our own API
      // Wrapped in transport to suppress errors if tunnel fails
      tunnel: '/api/sentry-tunnel',
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
      sendDefaultPii: true, // Required for agent monitoring

      // Custom transport to suppress tunnel errors
      transport: (options) => {
        const defaultTransport = Sentry.makeFetchTransport(options);
        return (envelope) => {
          return defaultTransport(envelope).catch((error) => {
            // Suppress sentry-tunnel errors to avoid console spam
            console.debug('[Sentry] Tunnel error suppressed:', error);
            return Promise.resolve();
          });
        };
      },

      // Filter sensitive data
      beforeSend: (event) => {
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['Cookie'];
        }
        return event;
      },

      // Ignore common non-critical errors
      ignoreErrors: [
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'ChunkLoadError',
        'Loading chunk',
        'adsbygoogle',
      ],
    });

    isInitialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Capture error with context
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    user?: { id: string; email?: string };
  }
): string {
  console.error('[Error]', error.message, context);

  if (!Sentry || !isInitialized) {
    return '';
  }

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
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string {
  if (!Sentry || !isInitialized) {
    console.log(`[${level}]`, message, context);
    return '';
  }

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
  if (!Sentry || !isInitialized) {
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  if (!Sentry || !isInitialized) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, unknown>
): void {
  if (!Sentry || !isInitialized) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Measure performance of an async operation
 */
export async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  if (!Sentry || !isInitialized) {
    return operation();
  }

  return Sentry.startSpan(
    {
      name,
      op: 'function',
      attributes: tags,
    },
    async () => {
      return operation();
    }
  );
}
