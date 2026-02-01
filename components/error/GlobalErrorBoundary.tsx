/**
 * Global Error Boundary
 *
 * Catches all unhandled React errors at the application root level.
 * Provides graceful degradation and recovery options for production.
 *
 * Features:
 * - Catches component errors during rendering, lifecycle, and constructors
 * - Reports errors to Sentry for production monitoring
 * - Provides user-friendly error UI with recovery options
 * - Persists error state for debugging
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { captureError } from '../../lib/monitoring/sentry';
import { MaintenancePage } from './MaintenancePage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  errorId: string | null;
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Persist error to localStorage for debugging
 */
function persistError(errorId: string, error: Error, errorInfo: ErrorInfo): void {
  try {
    const errorLog = {
      id: errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Keep last 5 errors
    const existingErrors = JSON.parse(localStorage.getItem('panacea_error_log') || '[]');
    existingErrors.unshift(errorLog);
    localStorage.setItem('panacea_error_log', JSON.stringify(existingErrors.slice(0, 5)));
  } catch {
    // Ignore localStorage errors
  }
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({ errorInfo });

    // Log to console for development
    console.error('[GlobalErrorBoundary] Caught error:', error);
    console.error('[GlobalErrorBoundary] Component stack:', errorInfo.componentStack);

    // Report to Sentry for production monitoring
    try {
      captureError(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          errorBoundary: 'GlobalErrorBoundary',
          errorId: this.state.errorId,
        },
      });
    } catch {
      // Sentry not available, ignore
    }

    // Persist for debugging
    if (this.state.errorId) {
      persistError(this.state.errorId, error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    // Clear any cached state that might cause the error
    try {
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.href = '/';
  };

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: null,
    });
  };

  private toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  private handleReportBug = (): void => {
    const { error, errorInfo, errorId } = this.state;
    const subject = encodeURIComponent(`Bug Report: ${error?.name || 'Unknown Error'}`);
    const body = encodeURIComponent(
      `Error ID: ${errorId}\n\n` +
        `Error: ${error?.message || 'Unknown'}\n\n` +
        `URL: ${window.location.href}\n\n` +
        `User Agent: ${navigator.userAgent}\n\n` +
        `Stack Trace:\n${error?.stack || 'Not available'}\n\n` +
        `Component Stack:\n${errorInfo?.componentStack || 'Not available'}\n\n` +
        `Please describe what you were doing when this error occurred:\n\n`
    );

    window.open(`mailto:support@panacea-study.com?subject=${subject}&body=${body}`);
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Server/config errors: show MaintenancePage instead of generic error
      const { error } = this.state;
      if (
        error?.name === 'ServerConfigError' ||
        error?.message?.includes('Server configuration error')
      ) {
        return <MaintenancePage message={error.message} onRetry={this.handleRetry} />;
      }

      const { errorInfo, showDetails, errorId } = this.state;

      return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden">
            {/* Header */}
            <div className="bg-[var(--color-data-fail)] p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Something went wrong</h1>
                  <p className="text-white/80 text-sm">We've encountered an unexpected error</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Error ID for support */}
              {errorId && (
                <div className="bg-[var(--color-bg-tertiary)]/50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">Error ID:</span>
                  <code className="text-sm font-mono text-[var(--color-text-primary)] select-all">
                    {errorId}
                  </code>
                </div>
              )}

              {/* Friendly message */}
              <p className="text-[var(--color-text-secondary)]">
                We apologize for the inconvenience. This error has been logged and our team will
                look into it. You can try one of the following options:
              </p>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white rounded-lg transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-white rounded-lg transition-colors font-medium"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>

              {/* Report bug button */}
              <button
                onClick={this.handleReportBug}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50 rounded-lg transition-colors text-sm"
              >
                <Bug className="w-4 h-4" />
                Report this issue
              </button>

              {/* Technical details (collapsible) */}
              <div className="border-t border-[var(--color-border)] pt-4">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  <span>Technical Details</span>
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showDetails && (
                  <div className="mt-3 space-y-3">
                    {/* Error name and message */}
                    <div className="bg-[var(--color-data-fail)]/10 rounded-lg p-3 border border-[var(--color-data-fail)]/20">
                      <p className="text-sm font-mono text-[var(--color-data-fail)]">
                        <span className="font-semibold">{error?.name}:</span> {error?.message}
                      </p>
                    </div>

                    {/* Stack trace */}
                    {error?.stack && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-[var(--color-text-muted)] mb-2">
                          Stack Trace
                        </summary>
                        <pre className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
                          {error.stack}
                        </pre>
                      </details>
                    )}

                    {/* Component stack */}
                    {errorInfo?.componentStack && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-[var(--color-text-muted)] mb-2">
                          Component Stack
                        </summary>
                        <pre className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
                          {errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[var(--color-bg-tertiary)]/30 px-6 py-4 border-t border-[var(--color-border)]">
              <p className="text-xs text-center text-[var(--color-text-muted)]">
                PANaCEa • Your progress has been saved • Last updated:{' '}
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
