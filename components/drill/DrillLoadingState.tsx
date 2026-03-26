/**
 * DrillLoadingState
 *
 * Standardized loading skeleton for all drill modes.
 * Provides consistent UX across the app during data fetching.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface DrillLoadingStateProps {
  /** Number of answer options to show in skeleton */
  optionCount?: number;
  /** Whether to show timer skeleton */
  showTimer?: boolean;
  /** Whether to show progress bar skeleton */
  showProgress?: boolean;
  /** Custom message to display */
  message?: string;
  /** Variant for different drill types */
  variant?: 'question' | 'image' | 'lab' | 'encounter';
}

export const DrillLoadingState: React.FC<DrillLoadingStateProps> = ({
  optionCount = 4,
  showTimer = true,
  showProgress = true,
  message = 'Loading question...',
  variant = 'question',
}) => {
  return (
    <div
      className="min-h-[500px] bg-[var(--color-bg-primary)] p-6"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
            <div>
              <div className="w-32 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-1" />
              <div className="w-24 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            </div>
          </div>

          {showTimer && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] animate-pulse" />
              <div className="w-12 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            </div>
          )}
        </div>

        {/* Progress bar skeleton */}
        {showProgress && (
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <div className="w-24 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
              <div className="w-16 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            </div>
            <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--color-accent)]/30"
                initial={{ width: '0%' }}
                animate={{ width: '30%' }}
                transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
              />
            </div>
          </div>
        )}

        {/* Main content skeleton */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-8">
          {/* Image skeleton for visual drills */}
          {(variant === 'image' || variant === 'lab') && (
            <div className="mb-6">
              <div className="aspect-video rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[var(--color-bg-primary)]/50 animate-pulse" />
              </div>
            </div>
          )}

          {/* Lab values skeleton */}
          {variant === 'lab' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 animate-pulse">
                  <div className="w-16 h-3 bg-[var(--color-bg-primary)]/50 rounded mb-2" />
                  <div className="w-12 h-5 bg-[var(--color-bg-primary)]/50 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Question stem skeleton */}
          <div className="mb-6 space-y-2">
            <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-full" />
            <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-11/12" />
            <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-4/5" />
            {variant === 'encounter' && (
              <>
                <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-3/4 mt-4" />
                <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-5/6" />
              </>
            )}
          </div>

          {/* Answer options skeleton */}
          {variant !== 'encounter' && (
            <div className="space-y-3">
              {Array.from({ length: optionCount || 4 }).map((_, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0.5 }}
                  animate={{}}
                  transition={{
                    duration: 0.5,
                    delay: idx * 0.1,
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-bg-tertiary)]"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)]/50 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--color-bg-primary)]/50 rounded animate-pulse w-3/4" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Chat input skeleton for encounter mode */}
          {variant === 'encounter' && (
            <div className="mt-6 border-t border-[var(--color-border)] pt-6">
              <div className="flex gap-3">
                <div className="flex-1 h-12 bg-[var(--color-bg-tertiary)] rounded-xl animate-pulse" />
                <div className="w-12 h-12 bg-[var(--color-bg-tertiary)] rounded-xl animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Loading message */}
        <div className="text-center mt-6">
          <motion.p
            initial={{ opacity: 0.5 }}
            animate={{}}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            className="text-[var(--color-text-muted)] flex items-center justify-center gap-2"
          >
            <span className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-pulse" />
            {message}
          </motion.p>
        </div>
      </div>
    </div>
  );
};

/**
 * Empty state for drills with no available questions
 */
interface DrillEmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const DrillEmptyState: React.FC<DrillEmptyStateProps> = ({
  title = 'All Caught Up!',
  message = 'No questions available right now. Check back later or try a different mode.',
  actionLabel = 'Go Back',
  onAction,
  icon,
}) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-20 h-20 rounded-full bg-[var(--color-data-pass)]/10 flex items-center justify-center mx-auto mb-6">
          {icon || <span className="text-4xl">✓</span>}
        </div>

        <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{title}</h3>
        <p className="text-[var(--color-text-muted)] mb-6">{message}</p>

        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold rounded-xl hover:opacity-90 transition-opacity min-h-[44px]"
          >
            {actionLabel}
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default DrillLoadingState;
