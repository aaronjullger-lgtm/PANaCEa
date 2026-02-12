/**
 * EnhancedErrorBoundary - Error boundary with unified error taxonomy and recovery actions
 * 
 * Uses the AppError system to provide consistent error handling,
 * user-friendly messages, and actionable recovery options.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, WifiOff, ShieldAlert, Database, Cpu, UserX, Clock, FileWarning, ZapOff } from 'lucide-react';
import { AppError, AppErrorFactory, ErrorCategory, RecoveryAction, toAppError, getPrimaryRecoveryAction } from '@/lib/errors/appError';

interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  context?: Record<string, unknown>;
  showDetailsInProduction?: boolean;
}

interface EnhancedErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * EnhancedErrorBoundary - Modern error boundary with AppError integration
 * 
 * Features:
 * - Unified error taxonomy
 * - User-friendly messages based on error category
 * - Actionable recovery options
 * - Retry logic with exponential backoff
 * - Error reporting to monitoring services
 * - Context-aware error handling
 */
export class EnhancedErrorBoundary extends Component<EnhancedErrorBoundaryProps, EnhancedErrorBoundaryState> {
  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    // Convert to AppError immediately
    const appError = toAppError(error);
    
    return {
      hasError: true,
      error: appError,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Convert to AppError with context
    const appError = AppErrorFactory.create(error, ErrorCategory.CLIENT, undefined, {
      ...this.props.context,
      componentStack: errorInfo.componentStack,
      boundary: 'EnhancedErrorBoundary',
    });

    // Update state
    this.setState({
      error: appError,
      errorInfo,
    });

    // Log error for debugging
    console.error('[EnhancedErrorBoundary] Caught error:', appError);
    console.error('[EnhancedErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // Report to monitoring (in production)
    this.reportErrorToMonitoring(appError);
  }

  /**
   * Report error to monitoring service (Sentry, etc.)
   */
  private reportErrorToMonitoring(error: AppError): void {
    // In production, integrate with your monitoring service
    if (process.env.NODE_ENV === 'production' && !error.reported) {
      // Example: Sentry.captureException(error.originalError || error);
      console.log('[EnhancedErrorBoundary] Error reported to monitoring:', error);
      
      // Mark as reported
      error.reported = true;
    }
  }

  /**
   * Handle retry action
   */
  private handleRetry = (): void => {
    const { error } = this.state;
    
    if (!error || !error.isRetryable) {
      this.handleReset();
      return;
    }

    // Check max retries
    if (error.retryCount && error.retryCount >= error.maxRetries) {
      console.warn('[EnhancedErrorBoundary] Max retries exceeded');
      return;
    }

    // Increment retry count
    const newRetryCount = (error.retryCount || 0) + 1;
    
    // Update error with new retry count
    const updatedError = {
      ...error,
      retryCount: newRetryCount,
    };

    this.setState({
      error: updatedError,
      retryCount: newRetryCount,
    });

    // Reset after a delay (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, newRetryCount), 10000); // Max 10 seconds
    setTimeout(() => {
      this.handleReset();
    }, delay);
  };

  /**
   * Handle reset (clear error state)
   */
  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  /**
   * Handle specific recovery action
   */
  private handleRecoveryAction = (action: RecoveryAction): void => {
    switch (action) {
      case RecoveryAction.RETRY:
        this.handleRetry();
        break;
        
      case RecoveryAction.REFRESH:
        window.location.reload();
        break;
        
      case RecoveryAction.CLEAR_CACHE:
        // Clear relevant caches
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              caches.delete(cacheName);
            });
          });
        }
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
        break;
        
      case RecoveryAction.REAUTHENTICATE:
        // Redirect to login
        window.location.href = '/auth/sign-in';
        break;
        
      case RecoveryAction.GO_OFFLINE:
        // Switch to offline mode
        // This would trigger your offline mode logic
        console.log('[EnhancedErrorBoundary] Switching to offline mode');
        this.handleReset();
        break;
        
      case RecoveryAction.NAVIGATE_AWAY:
        // Navigate to home
        window.location.href = '/';
        break;
        
      case RecoveryAction.WAIT_AND_RETRY:
        // Wait 5 seconds and retry
        setTimeout(() => {
          this.handleRetry();
        }, 5000);
        break;
        
      default:
        this.handleReset();
    }
  };

  /**
   * Get icon for error category
   */
  private getErrorIcon(category: ErrorCategory): ReactNode {
    const iconClass = 'w-8 h-8';
    
    switch (category) {
      case ErrorCategory.NETWORK:
        return <WifiOff className={`${iconClass} text-[var(--color-data-fail)]`} />;
        
      case ErrorCategory.AUTHENTICATION:
        return <UserX className={`${iconClass} text-[var(--color-data-warning)]`} />;
        
      case ErrorCategory.AI_SERVICE:
        return <Cpu className={`${iconClass} text-[var(--color-data-provisional)]`} />;
        
      case ErrorCategory.DATABASE:
        return <Database className={`${iconClass} text-[var(--color-data-fail)]`} />;
        
      case ErrorCategory.SESSION:
        return <Clock className={`${iconClass} text-[var(--color-data-warning)]`} />;
        
      case ErrorCategory.CONTENT:
        return <FileWarning className={`${iconClass} text-[var(--color-data-provisional)]`} />;
        
      case ErrorCategory.RATE_LIMIT:
        return <ZapOff className={`${iconClass} text-[var(--color-data-warning)]`} />;
        
      case ErrorCategory.VALIDATION:
        return <ShieldAlert className={`${iconClass} text-[var(--color-data-provisional)]`} />;
        
      default:
        return <AlertCircle className={`${iconClass} text-[var(--color-data-fail)]`} />;
    }
  }

  /**
   * Get color for error category
   */
  private getErrorColor(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10';
        
      case ErrorCategory.AUTHENTICATION:
        return 'border-[var(--color-data-warning)]/30 bg-[var(--color-data-warning)]/10';
        
      case ErrorCategory.AI_SERVICE:
        return 'border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10';
        
      case ErrorCategory.DATABASE:
        return 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10';
        
      case ErrorCategory.SESSION:
        return 'border-[var(--color-data-warning)]/30 bg-[var(--color-data-warning)]/10';
        
      case ErrorCategory.CONTENT:
        return 'border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10';
        
      case ErrorCategory.RATE_LIMIT:
        return 'border-[var(--color-data-warning)]/30 bg-[var(--color-data-warning)]/10';
        
      case ErrorCategory.VALIDATION:
        return 'border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10';
        
      default:
        return 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10';
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error } = this.state;
      const primaryAction = getPrimaryRecoveryAction(error);
      const showDetails = this.props.showDetailsInProduction || process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4 sm:p-6">
          <div className={`rounded-2xl border p-6 sm:p-8 max-w-lg w-full ${this.getErrorColor(error.category)}`}>
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="p-3 rounded-xl flex-shrink-0">
                {this.getErrorIcon(error.category)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] mb-2">
                  {error.userMessage}
                </h3>
                
                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                  {error.category === ErrorCategory.NETWORK 
                    ? 'Check your internet connection and try again.'
                    : error.category === ErrorCategory.AUTHENTICATION
                    ? 'Please sign in again to continue.'
                    : 'The rest of your dashboard should still work.'
                  }
                </p>

                {/* Show error details in development or if enabled */}
                {showDetails && error.message && (
                  <details className="mb-4 text-xs">
                    <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
                      Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-[var(--color-bg-tertiary)] rounded-lg overflow-auto max-h-40">
                      <div className="text-[var(--color-data-fail)] font-mono text-xs">
                        <div className="mb-1">
                          <span className="font-semibold">Category:</span> {error.category}
                        </div>
                        <div className="mb-1">
                          <span className="font-semibold">Code:</span> {error.code}
                        </div>
                        <div className="mb-1">
                          <span className="font-semibold">Message:</span> {error.message}
                        </div>
                        {this.state.errorInfo?.componentStack && (
                          <div className="mt-2">
                            <span className="font-semibold">Stack:</span>
                            <pre className="mt-1 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                )}

                {/* Recovery actions */}
                <div className="space-y-3">
                  {/* Primary action button */}
                  <button
                    onClick={() => this.handleRecoveryAction(primaryAction)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] font-semibold rounded-lg transition-colors"
                    disabled={error.retryCount && error.retryCount >= error.maxRetries}
                  >
                    {primaryAction === RecoveryAction.RETRY && <RefreshCw className="w-4 h-4" />}
                    {primaryAction === RecoveryAction.REFRESH && <RefreshCw className="w-4 h-4" />}
                    {primaryAction === RecoveryAction.REAUTHENTICATE && <UserX className="w-4 h-4" />}
                    {this.getActionLabel(primaryAction)}
                    {error.retryCount && error.retryCount > 0 && (
                      <span className="text-xs opacity-80">({error.retryCount}/{error.maxRetries})</span>
                    )}
                  </button>

                  {/* Secondary actions (if any) */}
                  {error.recoveryActions.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {error.recoveryActions.slice(1).map((action, index) => (
                        <button
                          key={index}
                          onClick={() => this.handleRecoveryAction(action)}
                          className="px-3 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors"
                        >
                          {this.getActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Retry status */}
                {error.isRetryable && error.retryCount && error.retryCount > 0 && (
                  <div className="mt-4 text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[var(--color-accent)] rounded-full"
                          style={{ width: `${(error.retryCount / error.maxRetries) * 100}%` }}
                        />
                      </div>
                      <span>Attempt {error.retryCount} of {error.maxRetries}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  /**
   * Get user-friendly label for recovery action
   */
  private getActionLabel(action: RecoveryAction): string {
    switch (action) {
      case RecoveryAction.RETRY:
        return 'Try Again';
      case RecoveryAction.REFRESH:
        return 'Refresh Page';
      case RecoveryAction.CLEAR_CACHE:
        return 'Clear Cache';
      case RecoveryAction.REAUTHENTICATE:
        return 'Sign In Again';
      case RecoveryAction.GO_OFFLINE:
        return 'Go Offline';
      case RecoveryAction.CONTACT_SUPPORT:
        return 'Contact Support';
      case RecoveryAction.NAVIGATE_AWAY:
        return 'Go to Home';
      case RecoveryAction.WAIT_AND_RETRY:
        return 'Wait & Retry';
      case RecoveryAction.USE_ALTERNATIVE:
        return 'Use Alternative';
      case RecoveryAction.REPORT_ISSUE:
        return 'Report Issue';
      default:
        return 'Continue';
    }
  }
}

/**
 * Functional wrapper for easier usage with hooks
 */
export const withEnhancedErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    context?: Record<string, unknown>;
    showDetailsInProduction?: boolean;
  }
): React.FC<P> => {
  const { fallback, context, showDetailsInProduction } = options || {};
  
  return (props: P) => (
    <EnhancedErrorBoundary 
      fallback={fallback}
      context={context}
      showDetailsInProduction={showDetailsInProduction}
    >
      <Component {...props} />
    </EnhancedErrorBoundary>
  );
};

/**
 * Hook for programmatic error handling
 */
export function useEnhancedErrorHandling() {
  const handleError = (error: unknown, context?: Record<string, unknown>): AppError => {
    const appError = toAppError(error);
    
    // Add context if provided
    if (context) {
      appError.context = { ...appError.context, ...context };
    }
    
    // Log error
    console.error('[useEnhancedErrorHandling]', appError);
    
    // Report to monitoring in production
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error, { extra: context });
    }
    
    return appError;
  };
  
  const createError = (
    category: ErrorCategory,
    code: string,
    message: string,
    userMessage?: string,
    context?: Record<string, unknown>
  ): AppError => {
    const error = new Error(message);
    const appError = AppErrorFactory.create(error, category, code as any, context);
    
    if (userMessage) {
      appError.userMessage = userMessage;
    }
    
    return appError;
  };
  
  return {
    handleError,
    createError,
    ErrorCategory,
    RecoveryAction,
  };
}

export default EnhancedErrorBoundary;