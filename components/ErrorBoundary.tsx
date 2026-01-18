/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// Lazy load Sentry to avoid initialization conflicts with Clerk
let captureError: ((error: Error, context?: Record<string, unknown>) => void) | null = null;
if (import.meta.env.PROD) {
  import('../lib/monitoring/sentry')
    .then((sentry) => {
      captureError = sentry.captureError;
    })
    .catch(() => {});
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store error info in state
    this.setState({
      error,
      errorInfo,
    });

    // Check if this is a chunk loading error (stale cache issue)
    const isChunkLoadError =
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Unable to preload CSS') ||
      (error.message.includes('vendor-') && error.message.includes('.js'));

    if (isChunkLoadError) {
      console.warn('[ErrorBoundary] Chunk load error detected - likely stale cache');
      // Auto-reload for chunk errors after a short delay
      setTimeout(() => {
        // Clear service worker caches
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        // Unregister service worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => registration.unregister());
          });
        }
        // Force reload from server
        window.location.reload();
      }, 1500);
    }

    // Send to error tracking service
    if (captureError) {
      captureError(error, {
        tags: {
          boundary: 'root',
          isChunkError: isChunkLoadError.toString(),
        },
        extra: {
          componentStack: errorInfo.componentStack,
          errorName: error.name,
          errorMessage: error.message,
        },
        level: isChunkLoadError ? 'warning' : 'error',
      });
    }
  }

  isChunkLoadError(): boolean {
    const error = this.state.error;
    if (!error) return false;
    return (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Unable to preload CSS') ||
      (error.message.includes('vendor-') && error.message.includes('.js'))
    );
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.handleReset();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const isChunkError = this.isChunkLoadError();

      return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] p-8"
          >
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4"
              >
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </motion.div>

              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                {isChunkError ? 'Update Available' : 'Oops! Something went wrong'}
              </h2>

              <p className="text-[var(--color-text-muted)] mb-6">
                {isChunkError
                  ? 'A new version of PANaCEa is available. The page will automatically refresh in a moment to load the latest version.'
                  : "We encountered an unexpected error. This has been logged and we'll look into it."}
              </p>

              {isChunkError && (
                <div className="w-full mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Clearing cache and refreshing...
                  </p>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="w-full mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-left">
                  <p className="text-sm font-mono text-red-500 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="text-xs font-mono text-[var(--color-text-muted)] mt-2">
                      <summary className="cursor-pointer hover:text-[var(--color-text-primary)]">
                        Stack trace
                      </summary>
                      <pre className="mt-2 overflow-auto max-h-48 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3 w-full">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleGoHome}
                  className="flex-1 px-4 py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 * Usage: const throwError = useErrorHandler()
 */
export function useErrorHandler() {
  const [, setError] = React.useState();

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}
