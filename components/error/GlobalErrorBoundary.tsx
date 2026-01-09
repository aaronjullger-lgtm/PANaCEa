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
    this.setState(prev => ({ showDetails: !prev.showDetails }));
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

      const { error, errorInfo, showDetails, errorId } = this.state;

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Something went wrong</h1>
                  <p className="text-red-100 text-sm">
                    We've encountered an unexpected error
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Error ID for support */}
              {errorId && (
                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Error ID:
                  </span>
                  <code className="text-sm font-mono text-slate-800 dark:text-slate-200 select-all">
                    {errorId}
                  </code>
                </div>
              )}

              {/* Friendly message */}
              <p className="text-slate-600 dark:text-slate-300">
                We apologize for the inconvenience. This error has been logged and our team will look into it. 
                You can try one of the following options:
              </p>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>

              {/* Report bug button */}
              <button
                onClick={this.handleReportBug}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
              >
                <Bug className="w-4 h-4" />
                Report this issue
              </button>

              {/* Technical details (collapsible) */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
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
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                      <p className="text-sm font-mono text-red-700 dark:text-red-400">
                        <span className="font-semibold">{error?.name}:</span> {error?.message}
                      </p>
                    </div>

                    {/* Stack trace */}
                    {error?.stack && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 dark:text-slate-400 mb-2">
                          Stack Trace
                        </summary>
                        <pre className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
                          {error.stack}
                        </pre>
                      </details>
                    )}

                    {/* Component stack */}
                    {errorInfo?.componentStack && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 dark:text-slate-400 mb-2">
                          Component Stack
                        </summary>
                        <pre className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
                          {errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                PANaCEa • Your progress has been saved • Last updated: {new Date().toLocaleTimeString()}
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
