/**
 * Specialized Error Boundaries for Drill Components
 *
 * Provides graceful degradation for drill sessions:
 * - API errors: Show retry option with cached questions
 * - Network errors: Enable offline mode
 * - Budget exceeded: Queue questions for later
 */

import React, { Component, ErrorInfo, ReactNode, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  RefreshCw,
  WifiOff,
  DollarSign,
  ArrowLeft,
  BookOpen,
  Clock,
} from 'lucide-react';
import type { ErrorCategory } from '@/lib/utils/errorHandlingUtils';
import { getUserFacingError } from '@/lib/utils/errorHandlingUtils';

// Lazy load Sentry to avoid initialization conflicts with Clerk
let captureError: ((error: Error, context?: Record<string, unknown>) => void) | null = null;
if (import.meta.env.PROD) {
  import('../../lib/monitoring/sentry')
    .then((sentry) => {
      captureError = sentry.captureError;
    })
    .catch(() => {});
}

// ============================================================================
// Types
// ============================================================================

interface DrillErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onReturnHome?: () => void;
  drillType?: string;
}

interface DrillErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorType: 'api' | 'network' | 'budget' | 'unknown';
}

// ============================================================================
// Error Type Detection
// ============================================================================

function detectErrorType(error: Error): 'api' | 'network' | 'budget' | 'unknown' {
  const message = error.message.toLowerCase();

  // Budget/rate limit errors
  if (
    message.includes('rate limit') ||
    message.includes('quota exceeded') ||
    message.includes('429') ||
    message.includes('budget')
  ) {
    return 'budget';
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('failed to fetch') ||
    message.includes('net::') ||
    !navigator.onLine
  ) {
    return 'network';
  }

  // API errors (4xx, 5xx)
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404') ||
    message.includes('500') ||
    message.includes('internal server error')
  ) {
    return 'api';
  }

  return 'unknown';
}

function errorTypeToCategory(type: 'api' | 'network' | 'budget' | 'unknown'): ErrorCategory {
  switch (type) {
    case 'api':
      return 'server';
    case 'network':
      return 'network';
    case 'budget':
      return 'rate_limit';
    default:
      return 'unknown';
  }
}

// ============================================================================
// Error Fallback Components
// ============================================================================

interface ErrorFallbackProps {
  error: Error | null;
  errorType: 'api' | 'network' | 'budget' | 'unknown';
  onRetry?: () => void;
  onReturnHome?: () => void;
  drillType?: string;
}

function ApiErrorFallback({ error, errorType, onRetry, onReturnHome }: ErrorFallbackProps) {
  const category = errorTypeToCategory(errorType);
  const { title, message, secondaryLabel } = getUserFacingError(category, 'drill');
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
    >
      <div className="w-16 h-16 bg-data-fail/10 dark:bg-data-fail/20 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-data-fail" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h2>

      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">{message}</p>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-action-blue-600 text-white rounded-lg hover:bg-action-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        <button
          onClick={onReturnHome}
          className="flex items-center gap-2 px-4 py-2 bg-clinical-slate-200 dark:bg-clinical-slate-700 text-clinical-slate-700 dark:text-clinical-slate-200 rounded-lg hover:bg-clinical-slate-300 dark:hover:bg-clinical-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {secondaryLabel ?? 'Back to Command Center'}
        </button>
      </div>

      {error && import.meta.env.DEV && (
        <details className="mt-6 text-left w-full max-w-md">
          <summary className="text-sm text-clinical-slate-500 cursor-pointer">
            Technical Details
          </summary>
          <pre className="mt-2 p-3 bg-clinical-slate-100 dark:bg-clinical-slate-800 rounded text-xs overflow-auto">
            {error.message}
          </pre>
        </details>
      )}
    </motion.div>
  );
}

function NetworkErrorFallback({ onRetry, onReturnHome, drillType }: ErrorFallbackProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
    >
      <div className="w-16 h-16 bg-data-provisional/10 dark:bg-data-provisional/20 rounded-full flex items-center justify-center mb-6">
        <WifiOff className="w-8 h-8 text-data-provisional" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">You're Offline</h2>

      <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md">
        No internet connection detected. Some features require connectivity.
      </p>

      {isOnline && (
        <div className="bg-data-pass/10 dark:bg-data-pass/20 text-data-pass px-4 py-2 rounded-lg mb-4">
          Connection restored! Click retry to continue.
        </div>
      )}

      <div className="bg-action-blue-50 dark:bg-action-blue-900/20 rounded-lg p-4 mb-6 max-w-md">
        <div className="flex items-center gap-2 text-action-blue-700 dark:text-action-blue-300 font-medium mb-2">
          <BookOpen className="w-4 h-4" />
          Offline Mode Available
        </div>
        <p className="text-sm text-action-blue-600 dark:text-action-blue-400">
          You can continue studying with previously cached questions. Your progress will sync when
          you reconnect.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          disabled={!isOnline}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isOnline
              ? 'bg-action-blue-600 text-white hover:bg-action-blue-700'
              : 'bg-clinical-slate-300 dark:bg-clinical-slate-600 text-clinical-slate-500 cursor-not-allowed'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>

        <button
          onClick={onReturnHome}
          className="flex items-center gap-2 px-4 py-2 bg-clinical-slate-200 dark:bg-clinical-slate-700 text-clinical-slate-700 dark:text-clinical-slate-200 rounded-lg hover:bg-clinical-slate-300 dark:hover:bg-clinical-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return Home
        </button>
      </div>
    </motion.div>
  );
}

function BudgetExceededFallback({ onReturnHome }: ErrorFallbackProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
    >
      <div className="w-16 h-16 bg-deep-plum-100 dark:bg-deep-plum-900/30 rounded-full flex items-center justify-center mb-6">
        <DollarSign className="w-8 h-8 text-deep-plum-500" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Hourly Limit Reached
      </h2>

      <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md">
        You've been studying hard! To ensure fair access for everyone, there's a temporary cooldown
        period.
      </p>

      <div className="bg-deep-plum-50 dark:bg-deep-plum-900/20 rounded-lg p-4 mb-6 max-w-md">
        <div className="flex items-center gap-2 text-deep-plum-700 dark:text-deep-plum-300 font-medium mb-2">
          <Clock className="w-4 h-4" />
          What You Can Do
        </div>
        <ul className="text-sm text-deep-plum-600 dark:text-deep-plum-400 text-left space-y-1">
          <li>• Review your analytics dashboard</li>
          <li>• Study condition reference pages</li>
          <li>• Take a well-deserved break</li>
          <li>• Return in about an hour</li>
        </ul>
      </div>

      <button
        onClick={onReturnHome}
        className="flex items-center gap-2 px-4 py-2 bg-deep-plum-600 text-white rounded-lg hover:bg-deep-plum-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Go to Dashboard
      </button>
    </motion.div>
  );
}

function UnknownErrorFallback({ error, errorType, onRetry, onReturnHome }: ErrorFallbackProps) {
  const category = errorTypeToCategory(errorType);
  const { title, message, secondaryLabel } = getUserFacingError(category, 'drill');
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
    >
      <div className="w-16 h-16 bg-clinical-slate-100 dark:bg-clinical-slate-800 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-clinical-slate-500" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h2>

      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">{message}</p>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-action-blue-600 text-white rounded-lg hover:bg-action-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        <button
          onClick={onReturnHome}
          className="flex items-center gap-2 px-4 py-2 bg-clinical-slate-200 dark:bg-clinical-slate-700 text-clinical-slate-700 dark:text-clinical-slate-200 rounded-lg hover:bg-clinical-slate-300 dark:hover:bg-clinical-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {secondaryLabel ?? 'Back to Command Center'}
        </button>
      </div>

      {error && import.meta.env.DEV && (
        <details className="mt-6 text-left w-full max-w-md">
          <summary className="text-sm text-clinical-slate-500 cursor-pointer">
            Technical Details
          </summary>
          <pre className="mt-2 p-3 bg-clinical-slate-100 dark:bg-clinical-slate-800 rounded text-xs overflow-auto">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Error Boundary Class
// ============================================================================

export class DrillErrorBoundary extends Component<
  DrillErrorBoundaryProps,
  DrillErrorBoundaryState
> {
  constructor(props: DrillErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'unknown',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DrillErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorType: detectErrorType(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    console.error('[DrillErrorBoundary] Caught error:', error, errorInfo);

    // Send to error tracking
    if (captureError) {
      captureError(error, {
        tags: {
          boundary: 'drill',
          errorType: this.state.errorType,
          drillType: this.props.drillType || 'unknown',
        },
        extra: {
          componentStack: errorInfo.componentStack,
          errorMessage: error.message,
        },
        level: this.state.errorType === 'network' ? 'warning' : 'error',
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorType: 'unknown',
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReturnHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorType: 'unknown',
    });

    if (this.props.onReturnHome) {
      this.props.onReturnHome();
    } else {
      // Default: navigate to home
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const fallbackProps: ErrorFallbackProps = {
        error: this.state.error,
        errorType: this.state.errorType,
        onRetry: this.handleReset,
        onReturnHome: this.handleReturnHome,
        drillType: this.props.drillType,
      };

      // Render appropriate fallback based on error type
      switch (this.state.errorType) {
        case 'api':
          return <ApiErrorFallback {...fallbackProps} />;
        case 'network':
          return <NetworkErrorFallback {...fallbackProps} />;
        case 'budget':
          return <BudgetExceededFallback {...fallbackProps} />;
        default:
          return <UnknownErrorFallback {...fallbackProps} />;
      }
    }

    return this.props.children;
  }
}

// ============================================================================
// Hook for programmatic error handling
// ============================================================================

export function useDrillError() {
  const [error, setError] = useState<Error | null>(null);

  const reportError = useCallback((err: Error | string) => {
    const errorObj = typeof err === 'string' ? new Error(err) : err;
    setError(errorObj);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const throwError = useCallback(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    error,
    hasError: error !== null,
    errorType: error ? detectErrorType(error) : null,
    reportError,
    clearError,
    throwError,
  };
}

export default DrillErrorBoundary;
