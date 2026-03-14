/**
 * CANONICAL ErrorBoundary
 *
 * Centralized error handling for all error scenarios across the application.
 * Supports multiple variants for different use cases (global, page, drill, AI, inline).
 *
 * This is THE ONLY error boundary implementation — all others are deprecated.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Wifi, Clock, Server } from 'lucide-react';
import { logError, addBreadcrumb } from '@/lib/errors/errorLogger';
import {
  toAppError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ApiError,
  type AppError,
} from '@/lib/errors/types';
import { getUserFacingError } from '@/lib/utils/errorHandlingUtils';

export type ErrorBoundaryVariant = 'global' | 'page' | 'drill' | 'ai' | 'inline';

export interface ErrorBoundaryProps {
  children: ReactNode;
  variant?: ErrorBoundaryVariant;
  fallback?: ReactNode;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  onRetry?: () => void | Promise<void>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  appError: AppError | null;
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Parse Gemini/AI API errors for better messaging and retry logic
 */
function parseAiError(error: Error | unknown): {
  type: 'rate_limit' | 'server_error' | 'network' | 'timeout' | 'generic';
  retryable: boolean;
  retryAfterMs?: number;
  icon: React.ReactNode;
} {
  let errorMessage = '';

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  if (errorMessage.includes('429') || errorMessage.includes('rate')) {
    return {
      type: 'rate_limit',
      retryable: true,
      retryAfterMs: 5000,
      icon: <Clock className="w-6 h-6" />,
    };
  }

  if (errorMessage.includes('5') || errorMessage.includes('server')) {
    return {
      type: 'server_error',
      retryable: true,
      retryAfterMs: 3000,
      icon: <Server className="w-6 h-6" />,
    };
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('CORS')
  ) {
    return {
      type: 'network',
      retryable: true,
      retryAfterMs: 2000,
      icon: <Wifi className="w-6 h-6" />,
    };
  }

  if (errorMessage.includes('timeout')) {
    return {
      type: 'timeout',
      retryable: true,
      retryAfterMs: 3000,
      icon: <Clock className="w-6 h-6" />,
    };
  }

  return {
    type: 'generic',
    retryable: false,
    icon: <AlertTriangle className="w-6 h-6" />,
  };
}

/**
 * Detect chunk loading errors (stale cache, old bundle)
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Unable to preload CSS') ||
    (error.message.includes('vendor-') && error.message.includes('.js'))
  );
}

/**
 * CANONICAL ErrorBoundary - handles all error scenarios
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const variant = this.props.variant || 'global';
    const isChunkError = isChunkLoadError(error);

    // Convert to structured AppError
    const appError = isChunkError
      ? new NetworkError('Failed to load application module (stale cache)', undefined, {
          errorName: error.name,
          originalMessage: error.message,
        })
      : toAppError(error);

    // Log breadcrumb
    addBreadcrumb(
      isChunkError ? 'Chunk load error detected (stale cache)' : `Error boundary [${variant}] caught error`,
      'error-boundary',
      'error',
      {
        variant,
        errorName: error.name,
        errorMessage: error.message,
        isChunkError,
        componentStack: errorInfo.componentStack?.slice(0, 500),
      }
    );

    // Log structured error
    logError(appError, {
      variant,
      boundary: variant,
      isChunkError,
      componentStack: errorInfo.componentStack,
    });

    // Update state
    this.setState({
      error,
      errorInfo,
      appError,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // Auto-reload for chunk errors
    if (isChunkError) {
      console.warn('[ErrorBoundary] Chunk load error detected - clearing cache and reloading');
      setTimeout(() => {
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => registration.unregister());
          });
        }
        window.location.reload();
      }, 1500);
    }
  }

  handleReset = async (): Promise<void> => {
    if (this.props.onRetry) {
      this.setState({ isRetrying: true });
      try {
        await this.props.onRetry();
      } catch (e) {
        console.error('Retry handler failed:', e);
      }
      this.setState({ isRetrying: false });
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
      retryCount: this.state.retryCount + 1,
    });
  };

  handleGoHome = (): void => {
    this.handleReset();
    window.location.href = '/';
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, appError, isRetrying, retryCount } = this.state;
    const { fallback, variant = 'global' } = this.props;

    if (!hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    const isChunkError = isChunkLoadError(error);
    const isAiVariant = variant === 'ai';
    const isInlineVariant = variant === 'inline';

    // AI error handling with retry info
    const aiErrorInfo = isAiVariant && error ? parseAiError(error) : null;

    // Get user-facing message
    const userMessage = isAiVariant && appError ? getUserFacingError(appError) : undefined;

    // Inline variant - minimal UI
    if (isInlineVariant) {
      return (
        <div
          className="p-4 rounded-lg bg-[var(--color-data-fail)]/5 border border-[var(--color-data-fail)]/20 flex items-start gap-3"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {error?.message || 'An error occurred'}
            </p>
            {import.meta.env.DEV && errorInfo && (
              <details className="mt-2 text-xs text-[var(--color-text-muted)]">
                <summary className="cursor-pointer hover:text-[var(--color-text-primary)]">
                  Details
                </summary>
                <pre className="mt-2 overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              disabled={isRetrying}
              className="mt-2 text-sm font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </button>
          </div>
        </div>
      );
    }

    // Full error UI for global/page/drill variants
    return (
      <div
        className={`
          ${variant === 'global' ? 'min-h-screen' : 'min-h-[500px]'}
          bg-[var(--color-bg-primary)] flex items-center justify-center p-4
        `}
        role="alert"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`
            ${variant === 'global' ? 'max-w-md' : 'max-w-lg'}
            w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl
            border border-[var(--color-border)] p-8
          `}
        >
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="w-16 h-16 bg-[var(--color-data-fail)]/10 rounded-full flex items-center justify-center mb-4"
            >
              {isAiVariant && aiErrorInfo
                ? React.cloneElement(aiErrorInfo.icon as React.ReactElement, {
                    className: 'w-8 h-8 text-[var(--color-text-muted)]',
                  })
                : <AlertTriangle className="w-8 h-8 text-[var(--color-text-muted)]" />}
            </motion.div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              {isChunkError
                ? 'Update Available'
                : isAiVariant
                  ? 'AI Service Error'
                  : 'Something Went Wrong'}
            </h2>

            {/* Message */}
            <p className="text-[var(--color-text-muted)] mb-6 max-w-sm">
              {isChunkError
                ? 'A new version of PANaCEa is available. The page will automatically refresh.'
                : isAiVariant && userMessage
                  ? userMessage
                  : 'An unexpected error occurred. This has been logged and we will look into it.'}
            </p>

            {/* Chunk reload indicator */}
            {isChunkError && (
              <div className="w-full mb-6 p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg">
                <p className="text-sm text-[var(--color-accent)] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Clearing cache and refreshing...
                </p>
              </div>
            )}

            {/* AI retry info */}
            {isAiVariant && aiErrorInfo && (
              <div className="w-full mb-6 p-3 bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 rounded-lg">
                <p className="text-xs text-[var(--color-info)]">
                  {aiErrorInfo.type === 'rate_limit' && 'Rate limited - will try again shortly'}
                  {aiErrorInfo.type === 'timeout' && 'Request timed out - please try again'}
                  {aiErrorInfo.type === 'network' && 'Network error - checking connection'}
                  {aiErrorInfo.type === 'server_error' && 'Service temporarily unavailable'}
                  {retryCount > 0 && ` (Attempt ${retryCount + 1})`}
                </p>
              </div>
            )}

            {/* Dev error details */}
            {import.meta.env.DEV && error && (
              <div className="w-full mb-6 p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/20 rounded-lg text-left">
                <p className="text-sm font-mono text-[var(--color-data-fail)] mb-2">
                  {error.toString()}
                </p>
                {errorInfo && (
                  <details className="text-xs font-mono text-[var(--color-text-muted)] mt-2">
                    <summary className="cursor-pointer hover:text-[var(--color-text-primary)]">
                      Stack trace
                    </summary>
                    <pre className="mt-2 overflow-auto max-h-48 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleReset}
                disabled={isRetrying}
                className="flex-1 px-4 py-3 bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </motion.button>

              {variant !== 'inline' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleGoHome}
                  className="flex-1 px-4 py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Home
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
}

/**
 * HOC: withErrorBoundary
 * Wraps a component with an ErrorBoundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  variant: ErrorBoundaryVariant = 'page',
  fallback?: ReactNode
): React.FC<P> => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary variant={variant} fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};

/**
 * Hook: useErrorHandler
 * Throw errors from functional components to be caught by ErrorBoundary
 */
export function useErrorHandler() {
  const [, setError] = React.useState();

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}
