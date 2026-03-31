/**
 * Canonical Error Boundary for PANaCEa
 *
 * Single error boundary with variant-based behavior:
 * - 'global': Root-level boundary with error persistence, Sentry, bug reporting
 * - 'page': Standard page-level boundary with retry/go-home
 * - 'drill': Drill-specific with back-to-command-center
 * - 'ai': Gemini API boundary with exponential backoff retry
 * - 'inline': Lightweight inline boundary for widgets/panels
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp, Clock, Wifi, Server } from 'lucide-react';
import { logError, addBreadcrumb } from '@/lib/errors/errorLogger';
import { toAppError, NetworkError, type AppError } from '@/lib/errors/types';
import { getUserFacingError, type ErrorDisplayContext } from '@/lib/utils/errorHandlingUtils';
import { StorageKeys } from '@/lib/storage/storageRegistry';
import { captureError } from '@/lib/monitoring/sentry';
import { MaintenancePage } from './MaintenancePage';

// ============================================================================
// Types
// ============================================================================

export type ErrorBoundaryVariant = 'global' | 'page' | 'drill' | 'ai' | 'inline';

export interface ErrorBoundaryFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  retryCount: number;
  isRetrying: boolean;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Controls the default fallback UI style */
  variant?: ErrorBoundaryVariant;
  /** Custom fallback render prop — overrides default UI when provided */
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Called when the user resets the boundary */
  onReset?: () => void;
  /** For drill variant: label for back button */
  drillType?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
  showDetails: boolean;
  errorId: string | null;
}

// ============================================================================
// Gemini error parsing (preserved from GeminiErrorBoundary)
// ============================================================================

export interface GeminiErrorInfo {
  type: 'rate_limit' | 'server_error' | 'network' | 'timeout' | 'generic';
  status?: number;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export function parseGeminiError(error: Error | Response | unknown): GeminiErrorInfo {
  if (error instanceof Response) {
    const status = error.status;
    if (status === 429) {
      return { type: 'rate_limit', status, message: 'Too many requests. Please wait a moment.', retryable: true, retryAfterMs: 60000 };
    }
    if (status === 503 || status === 502 || status === 504) {
      return { type: 'server_error', status, message: 'The AI service is temporarily unavailable.', retryable: true, retryAfterMs: 5000 };
    }
    if (status === 408) {
      return { type: 'timeout', status, message: 'The request timed out. Please try again.', retryable: true, retryAfterMs: 3000 };
    }
    return { type: 'generic', status, message: `Request failed with status ${status}`, retryable: false };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      return { type: 'network', message: 'Network connection lost. Check your internet and try again.', retryable: true, retryAfterMs: 2000 };
    }
    if (msg.includes('timeout')) {
      return { type: 'timeout', message: 'The request took too long. Please try again.', retryable: true, retryAfterMs: 3000 };
    }
    if (msg.includes('rate') || msg.includes('429')) {
      return { type: 'rate_limit', message: 'Rate limit reached. Please wait before retrying.', retryable: true, retryAfterMs: 60000 };
    }
    if (msg.includes('503') || msg.includes('unavailable')) {
      return { type: 'server_error', message: 'AI service temporarily unavailable.', retryable: true, retryAfterMs: 5000 };
    }
    return { type: 'generic', message: error.message || 'An unexpected error occurred', retryable: false };
  }

  return { type: 'generic', message: 'An unexpected error occurred', retryable: false };
}

// ============================================================================
// Chunk load error detection (preserved from root ErrorBoundary)
// ============================================================================

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Unable to preload CSS') ||
    (error.message.includes('vendor-') && error.message.includes('.js'))
  );
}

// ============================================================================
// Helpers
// ============================================================================

function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function persistError(errorId: string, error: Error, errorInfo: ErrorInfo): void {
  try {
    const errorLog = {
      id: errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
    };
    const existing = JSON.parse(localStorage.getItem(StorageKeys.ERROR_LOG) || '[]');
    existing.unshift(errorLog);
    localStorage.setItem(StorageKeys.ERROR_LOG, JSON.stringify(existing.slice(0, 5)));
  } catch {
    // Ignore localStorage errors
  }
}

function getAiErrorIcon(type: GeminiErrorInfo['type']) {
  switch (type) {
    case 'rate_limit':
    case 'timeout':
      return <Clock className="w-10 h-10 text-[var(--color-data-provisional)]" />;
    case 'network':
      return <Wifi className="w-10 h-10 text-[var(--color-accent)]" />;
    case 'server_error':
      return <Server className="w-10 h-10 text-[var(--color-data-fail)]" />;
    default:
      return <AlertTriangle className="w-10 h-10 text-[var(--color-data-fail)]" />;
  }
}

function variantToDisplayContext(variant: ErrorBoundaryVariant): ErrorDisplayContext {
  if (variant === 'drill') return 'drill';
  if (variant === 'ai') return 'gemini';
  return 'default';
}

// ============================================================================
// ErrorBoundary Class
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
      showDetails: false,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const variant = this.props.variant || 'page';

    this.setState({ errorInfo });

    // Chunk load errors: auto-reload
    if (isChunkLoadError(error)) {
      addBreadcrumb('Chunk load error detected (stale cache)', 'error-boundary', 'error', {
        errorName: error.name,
        errorMessage: error.message,
      });
      const appError = new NetworkError('Failed to load application module (stale cache)', undefined, {
        errorName: error.name,
        originalMessage: error.message,
      });
      logError(appError, { boundary: variant, isChunkError: true });
      setTimeout(() => {
        if ('caches' in window) {
          caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
        }
        window.location.reload();
      }, 1500);
      return;
    }

    // Structured logging
    addBreadcrumb(
      `Error boundary caught error (${variant})`,
      'error-boundary',
      'error',
      {
        errorName: error.name,
        variant,
        componentStack: errorInfo.componentStack?.slice(0, 500),
      }
    );

    const appError = toAppError(error);
    logError(appError, {
      boundary: variant,
      componentStack: errorInfo.componentStack,
      errorName: error.name,
      errorMessage: error.message,
    });

    // Sentry reporting for global and page variants
    if (variant === 'global' || variant === 'page') {
      try {
        captureError(error, {
          extra: {
            componentStack: errorInfo.componentStack,
            errorBoundary: variant,
            errorId: this.state.errorId,
          },
        });
      } catch {
        // Sentry not available
      }
    }

    // Persist errors for global variant
    if (variant === 'global' && this.state.errorId) {
      persistError(this.state.errorId, error, errorInfo);
    }

    // Call custom handler
    this.props.onError?.(error, errorInfo);
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
      showDetails: false,
      errorId: null,
    });
    this.props.onReset?.();
  };

  private handleRetry = (): void => {
    const { error, retryCount } = this.state;
    const variant = this.props.variant || 'page';
    const maxRetries = variant === 'ai' ? 3 : 2;

    if (retryCount >= maxRetries) return;

    this.setState({ isRetrying: true });

    let backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
    if (variant === 'ai' && error) {
      const geminiInfo = parseGeminiError(error);
      if (geminiInfo.retryAfterMs) backoffMs = geminiInfo.retryAfterMs;
    }

    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
        isRetrying: false,
        showDetails: false,
        errorId: null,
      });
      this.props.onReset?.();
    }, backoffMs);
  };

  private handleGoHome = (): void => {
    this.handleReset();
    window.location.href = '/';
  };

  private toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo, retryCount, isRetrying, showDetails, errorId } = this.state;
    const variant = this.props.variant || 'page';
    const { fallback } = this.props;

    // Custom fallback
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback({
          error: error!,
          errorInfo,
          resetError: this.handleReset,
          retryCount,
          isRetrying,
        });
      }
      return fallback;
    }

    // Chunk load error — show update message
    if (error && isChunkLoadError(error)) {
      return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] p-8 text-center">
            <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Update Available</h2>
            <p className="text-[var(--color-text-muted)]">
              A new version of PANaCEa is available. The page will refresh automatically.
            </p>
          </div>
        </div>
      );
    }

    // Global variant: maintenance page for server config errors
    if (variant === 'global' && error?.name === 'ServerConfigError') {
      return <MaintenancePage message={error.message} onRetry={this.handleReset} />;
    }

    // Variant-specific rendering
    switch (variant) {
      case 'global':
        return this.renderGlobal(error!, errorInfo, errorId, showDetails);
      case 'ai':
        return this.renderAi(error!, retryCount, isRetrying);
      case 'drill':
        return this.renderDrill(error!);
      case 'inline':
        return this.renderInline(error!);
      case 'page':
      default:
        return this.renderPage(error!);
    }
  }

  // ---------- Global fallback ----------
  private renderGlobal(error: Error, errorInfo: ErrorInfo | null, errorId: string | null, showDetails: boolean): ReactNode {
    const { title, message } = getUserFacingError('server', 'default');

    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden">
          <div className="bg-[var(--color-data-fail)] p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{title}</h1>
                <p className="text-white/80 text-sm">{message}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {errorId && (
              <div className="bg-[var(--color-bg-tertiary)]/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Error ID:</span>
                <code className="text-sm font-mono text-[var(--color-text-primary)] select-all">{errorId}</code>
              </div>
            )}

            <p className="text-[var(--color-text-secondary)]">
              You can try again or go home and try another section.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={this.handleReset} className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white rounded-lg transition-colors font-medium">
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <button onClick={this.handleGoHome} className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-primary)] rounded-lg transition-colors font-medium">
                <Home className="w-4 h-4" /> Go Home
              </button>
            </div>

            <button onClick={() => { window.open(`mailto:support@panacea-study.com?subject=${encodeURIComponent(`Bug Report: ${error.name}`)}&body=${encodeURIComponent(`Error ID: ${errorId}\nError: ${error.message}\nURL: ${window.location.href}\n`)}`); }} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50 rounded-lg transition-colors text-sm">
              <Bug className="w-4 h-4" /> Report this issue
            </button>

            <div className="border-t border-[var(--color-border)] pt-4">
              <button onClick={this.toggleDetails} className="flex items-center justify-between w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                <span>Technical Details</span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showDetails && (
                <div className="mt-3 space-y-3">
                  <div className="bg-[var(--color-data-fail)]/10 rounded-lg p-3 border border-[var(--color-data-fail)]/20">
                    <p className="text-sm font-mono text-[var(--color-data-fail)]">
                      <span className="font-semibold">{error.name}:</span> {error.message}
                    </p>
                  </div>
                  {error.stack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--color-text-muted)] mb-2">Stack Trace</summary>
                      <pre className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">{error.stack}</pre>
                    </details>
                  )}
                  {errorInfo?.componentStack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--color-text-muted)] mb-2">Component Stack</summary>
                      <pre className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">{errorInfo.componentStack}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[var(--color-bg-tertiary)]/30 px-6 py-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              PANaCEa &bull; Your progress has been saved
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- AI/Gemini fallback ----------
  private renderAi(error: Error, retryCount: number, isRetrying: boolean): ReactNode {
    const geminiInfo = parseGeminiError(error);
    const maxRetries = 3;
    const canRetry = geminiInfo.retryable && retryCount < maxRetries;
    const { title, message, primaryAction, secondaryLabel } = getUserFacingError('server', 'gemini');

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
        {getAiErrorIcon(geminiInfo.type)}

        <h3 className="mt-4 text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md">{message}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canRetry && (
            <button onClick={this.handleRetry} disabled={isRetrying} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : primaryAction}
            </button>
          )}
          {secondaryLabel && (
            <button onClick={this.handleGoHome} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg font-medium border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
              <Home className="w-4 h-4" /> {secondaryLabel}
            </button>
          )}
        </div>

        {retryCount > 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Retry attempt {retryCount} of {maxRetries}</p>
        )}
        {!canRetry && retryCount >= maxRetries && (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Please refresh the page or try again later.</p>
        )}
      </div>
    );
  }

  // ---------- Drill fallback ----------
  private renderDrill(error: Error): ReactNode {
    const { title, message, secondaryLabel } = getUserFacingError('server', 'drill');

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="w-16 h-16 bg-[var(--color-data-fail)]/10 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-[var(--color-data-fail)]" />
        </div>

        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{title}</h2>
        <p className="text-[var(--color-text-secondary)] mb-6 max-w-md">{message}</p>

        <div className="flex gap-3">
          <button onClick={this.handleReset} className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-colors">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <button onClick={this.handleGoHome} className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
            <Home className="w-4 h-4" /> {secondaryLabel ?? 'Back to Command Center'}
          </button>
        </div>

        {import.meta.env.DEV && (
          <details className="mt-6 text-left w-full max-w-md">
            <summary className="text-sm text-[var(--color-text-muted)] cursor-pointer">Technical Details</summary>
            <pre className="mt-2 p-3 bg-[var(--color-bg-tertiary)] rounded text-xs overflow-auto text-[var(--color-text-secondary)]">{error.message}</pre>
          </details>
        )}
      </div>
    );
  }

  // ---------- Page fallback ----------
  private renderPage(error: Error): ReactNode {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-data-fail)]/30 p-8 max-w-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-[var(--color-data-fail)]/10">
              <AlertTriangle className="w-6 h-6 text-[var(--color-data-fail)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Something went wrong</h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                This component encountered an error. The rest of your dashboard should still work.
              </p>

              {import.meta.env.DEV && error && (
                <details className="mb-4 text-xs">
                  <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Error Details</summary>
                  <pre className="mt-2 p-3 bg-[var(--color-bg-tertiary)] rounded-lg overflow-auto max-h-40 text-[var(--color-data-fail)]">
                    {error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3">
                <button onClick={this.handleReset} className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] font-semibold rounded-lg transition-colors">
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
                <button onClick={() => globalThis.location.reload()} className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-primary)] font-semibold rounded-lg transition-colors">
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Inline fallback ----------
  private renderInline(error: Error): ReactNode {
    return (
      <div className="rounded-lg border border-[var(--color-data-fail)]/20 bg-[var(--color-data-fail)]/5 p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Failed to load</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{error.message}</p>
          </div>
          <button onClick={this.handleReset} className="text-xs px-3 py-1.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md transition-colors flex-shrink-0">
            Retry
          </button>
        </div>
      </div>
    );
  }
}

// ============================================================================
// HOC
// ============================================================================

/**
 * Wrap any component with an ErrorBoundary.
 *
 * @example
 * const SafeWidget = withErrorBoundary(Widget, { variant: 'inline' });
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  Wrapped.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return Wrapped;
}

// ============================================================================
// Hook for programmatic error throwing (functional components)
// ============================================================================

export function useErrorHandler() {
  const [, setError] = React.useState();
  return React.useCallback((error: Error) => {
    setError(() => { throw error; });
  }, []);
}

// ============================================================================
// Gemini retry hook (preserved from GeminiErrorBoundary)
// ============================================================================

export function useGeminiRetry(maxRetries = 2) {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const executeWithRetry = React.useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          setRetryCount(attempt);
          const result = await fn();
          setRetryCount(0);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const errorInfo = parseGeminiError(error);

          if (!errorInfo.retryable || attempt >= maxRetries) {
            setRetryCount(0);
            throw lastError;
          }

          const backoffMs = errorInfo.retryAfterMs || Math.min(1000 * Math.pow(2, attempt), 30000);
          setIsRetrying(true);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          setIsRetrying(false);
        }
      }

      throw lastError || new Error('Max retries exceeded');
    },
    [maxRetries]
  );

  return { executeWithRetry, retryCount, isRetrying };
}

// ============================================================================
// AI-dependent views list (preserved from withGeminiErrorBoundary)
// ============================================================================

export const AI_DEPENDENT_VIEWS = [
  'quiz', 'patient_encounter', 'cram_mode', 'ddx_compare', 'grand_rounds',
  'physiology_drill', 'guideline_drill', 'system_drill', 'condition_drill',
  'panre_la', 'ecg_drill', 'derm_drill', 'imaging_drill',
  'antibiotic_mode', 'fluid_electrolyte', 'code_blue_speed', 'rapid_recall',
] as const;

export type AIDependentView = (typeof AI_DEPENDENT_VIEWS)[number];

export function isAIDependentView(view: string): view is AIDependentView {
  return AI_DEPENDENT_VIEWS.includes(view as AIDependentView);
}

// ============================================================================
// WithGeminiErrorBoundary — inline wrapper for AI views (replaces hoc/)
// ============================================================================

interface WithGeminiErrorBoundaryProps {
  children: ReactNode;
  viewName: string;
  onRetry: () => void;
}

/**
 * Inline wrapper that puts children inside an ai-variant ErrorBoundary.
 * Drop-in replacement for the former components/hoc/withGeminiErrorBoundary.
 */
export const WithGeminiErrorBoundary: React.FC<WithGeminiErrorBoundaryProps> = ({
  children,
  viewName,
  onRetry,
}) => {
  return (
    <ErrorBoundary key={viewName} variant="ai" onReset={onRetry}>
      {children}
    </ErrorBoundary>
  );
};

/**
 * HOC that wraps a component with an ai-variant ErrorBoundary.
 */
export function withGeminiErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  viewName: string
) {
  const WithBoundary: React.FC<P & { onRetry?: () => void }> = (props) => {
    const { onRetry, ...rest } = props;
    const handleRetry = onRetry || (() => window.location.reload());
    return (
      <ErrorBoundary variant="ai" onReset={handleRetry}>
        <WrappedComponent {...(rest as P)} />
      </ErrorBoundary>
    );
  };
  WithBoundary.displayName = `withGeminiErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithBoundary;
}
