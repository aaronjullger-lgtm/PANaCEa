/**
 * QuizViewWithErrorBoundary - Wraps QuizView with enhanced error handling
 * 
 * This component provides:
 * 1. EnhancedErrorBoundary for React error catching
 * 2. AppError integration for consistent error handling
 * 3. Recovery actions for different error types
 * 4. Mobile-responsive error UI
 */

import React from 'react';
import { EnhancedErrorBoundary } from '@/components/error/EnhancedErrorBoundary';
import QuizView, { type QuizViewProps } from './QuizView';

/**
 * Custom fallback UI for QuizView errors
 */
const QuizViewErrorFallback: React.FC<{
  error: Error;
  resetErrorBoundary: () => void;
}> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Session Error
          </h2>
          <p className="text-[var(--color-text-secondary)]">
            We encountered an issue with your study session. Don't worry, your progress has been saved.
          </p>
        </div>
        
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 text-left">
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Error details:
          </p>
          <p className="text-sm text-[var(--color-text-muted)] font-mono break-words">
            {error.message || 'Unknown error'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={resetErrorBoundary}
            className="flex-1 min-h-[44px] px-4 py-2.5 bg-[var(--color-accent)] text-white font-medium rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors"
          >
            Retry Session
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 min-h-[44px] px-4 py-2.5 bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
        
        <div className="pt-6 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            If this error persists, please try:
          </p>
          <ul className="text-xs text-[var(--color-text-muted)] mt-2 space-y-1 list-disc list-inside">
            <li>Refreshing the page</li>
            <li>Checking your internet connection</li>
            <li>Clearing your browser cache</li>
            <li>Contacting support if the issue continues</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * QuizView wrapped with EnhancedErrorBoundary
 */
export const QuizViewWithErrorBoundary: React.FC<QuizViewProps> = (props) => {
  return (
    <EnhancedErrorBoundary
      fallback={QuizViewErrorFallback}
      onError={(error) => {
        // Log session errors for analytics
        console.error('[QuizViewErrorBoundary] Session error:', error);
        
        // You could add error reporting here:
        // if (typeof window !== 'undefined' && (window as any).Sentry) {
        //   (window as any).Sentry.captureException(error);
        // }
      }}
    >
      <QuizView {...props} />
    </EnhancedErrorBoundary>
  );
};

export default QuizViewWithErrorBoundary;