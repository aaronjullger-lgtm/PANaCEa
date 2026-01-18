/**
 * Enhanced Mode Loading States
 *
 * Specialized skeleton loaders for each training mode to improve perceived performance.
 * These match the actual content structure of each mode for seamless transitions.
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Loading state for Grand Rounds mode
 * Shows vignette + option skeletons
 */
export const GrandRoundsLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[var(--color-bg-tertiary)] rounded-xl animate-pulse" />
            <div>
              <div className="w-32 h-6 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-2" />
              <div className="w-48 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            </div>
          </div>
          <div className="w-24 h-10 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse" />
        </div>

        {/* Case vignette skeleton */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-8 mb-6">
          <div className="w-40 h-6 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-full" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[95%]" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[90%]" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[85%]" />
          </div>
        </div>

        {/* Options skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action buttons skeleton */}
        <div className="flex justify-between mt-6">
          <div className="w-32 h-10 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse" />
          <div className="w-40 h-10 bg-[var(--color-accent)]/20 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
};

/**
 * Loading state for DDx Trainer mode
 * Shows differential diagnosis problem skeleton
 */
export const DdxTrainerLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="w-48 h-8 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
          <div className="w-24 h-10 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse" />
        </div>

        {/* Vignette card */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 mb-6">
          <div className="w-32 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-3" />
          <div className="space-y-2">
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-full" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[93%]" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[88%]" />
          </div>
        </div>

        {/* Diagnosis options grid */}
        <div className="w-64 h-6 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] animate-pulse"
            >
              <div className="h-6 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
            </div>
          ))}
        </div>

        {/* Submit button skeleton */}
        <div className="flex justify-center">
          <div className="w-48 h-12 bg-[var(--color-accent)]/20 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
};

/**
 * Loading state for Cram Mode
 * Shows high-yield condition list skeleton
 */
export const CramModeLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-64 h-10 bg-[var(--color-bg-tertiary)] rounded animate-pulse mx-auto mb-3" />
          <div className="w-96 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse mx-auto" />
        </div>

        {/* Progress bar skeleton */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <div className="w-32 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            <div className="w-24 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
          </div>
          <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse" />
        </div>

        {/* Question card skeleton */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-8 mb-6">
          <div className="space-y-3 mb-6">
            <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-full" />
            <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[95%]" />
            <div className="h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-[90%]" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] animate-pulse"
              >
                <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Generic loading state with pulsing message
 * Fallback for modes without specialized skeletons
 */
export const GenericModeLoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading training mode...',
}) => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
      <div className="text-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="w-16 h-16 border-4 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full mx-auto"
        />
        <motion.p
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          className="text-[var(--color-text-muted)]"
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
};
