/**
 * ErrorStateCard — Reusable error display with retry, details, and consistent styling.
 *
 * Use this in widgets, panels, and page sections that fetch data:
 * - Shows a friendly title + message (never raw stack traces or 500 codes)
 * - Retry button with countdown for rate-limited endpoints
 * - Collapsible technical details (dev mode + production for error IDs)
 * - Consistent with workspace styling tokens
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ErrorStateCardProps {
  /** Friendly title shown to the user */
  title?: string;
  /** Friendly message — never raw error codes */
  message?: string;
  /** Raw error for technical details (shown in collapsible section) */
  error?: Error | string | null;
  /** Error ID for support correlation */
  errorId?: string;
  /** Called when the user clicks Retry */
  onRetry?: () => void;
  /** Whether a retry is in progress */
  isRetrying?: boolean;
  /** Minimum time between retries (ms). Shows a cooldown timer. Default 3000 */
  retryCooldownMs?: number;
  /** Override for the retry label */
  retryLabel?: string;
  /** Compact mode for inline/in-widget use */
  compact?: boolean;
  /** Additional class name */
  className?: string;
}

export const ErrorStateCard: React.FC<ErrorStateCardProps> = ({
  title = 'Unable to load',
  message = 'Something went wrong while loading this section. Your progress is safe.',
  error,
  errorId,
  onRetry,
  isRetrying = false,
  retryCooldownMs = 3000,
  retryLabel = 'Try again',
  compact = false,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleDetails = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  // Cooldown timer after retry
  useEffect(() => {
    if (isRetrying && retryCooldownMs > 0) {
      setCooldownRemaining(Math.ceil(retryCooldownMs / 1000));
      cooldownRef.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCooldownRemaining(0);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [isRetrying, retryCooldownMs]);

  const errorMessage =
    typeof error === 'string'
      ? error
      : error?.message || null;
  const hasDetails = !!(errorMessage || errorId);

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl border border-[var(--color-data-fail)]/20 bg-[var(--color-data-fail)]/5 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-data-fail)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{message}</p>
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                icon={isRetrying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              >
                {isRetrying && cooldownRemaining > 0
                  ? `Retrying in ${cooldownRemaining}s...`
                  : retryLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-[var(--color-data-fail)]/20 bg-[var(--color-bg-secondary)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-6">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--color-data-fail)]/10">
          <AlertTriangle className="h-6 w-6 text-[var(--color-data-fail)]" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{message}</p>
          </div>
          {onRetry && (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                icon={
                  isRetrying ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )
                }
              >
                {isRetrying && cooldownRemaining > 0
                  ? `Retrying in ${cooldownRemaining}s...`
                  : retryLabel}
              </Button>
              {isRetrying && cooldownRemaining > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <Clock className="h-3 w-3" />
                  Auto-retry in {cooldownRemaining}s
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Technical details (collapsible) */}
      {hasDetails && (
        <div className="border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={toggleDetails}
            className="flex w-full items-center justify-between px-6 py-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <span>Technical details</span>
            {showDetails ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showDetails && (
            <div className="space-y-2 px-6 pb-4">
              {errorId && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                  <span className="text-xs text-[var(--color-text-muted)]">Error ID</span>
                  <code className="text-xs font-mono text-[var(--color-text-primary)] select-all">
                    {errorId}
                  </code>
                </div>
              )}
              {errorMessage && (
                <div className="rounded-lg bg-[var(--color-data-fail)]/5 border border-[var(--color-data-fail)]/10 p-3">
                  <p className="text-xs font-mono text-[var(--color-data-fail)] break-words">
                    {errorMessage}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorStateCard;
