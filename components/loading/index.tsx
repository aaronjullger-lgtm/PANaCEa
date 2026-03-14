/**
 * CANONICAL Loading System
 *
 * Centralized exports for all loading/skeleton components.
 * This is THE ONLY place to import loaders and skeletons from.
 *
 * All other loading/skeleton implementations are deprecated.
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// Loader Component
// ============================================================================

export type LoaderVariant = 'spinner' | 'skeleton' | 'progress' | 'clinical';

export interface LoaderProps {
  variant?: LoaderVariant;
  message?: string;
  forceDark?: boolean;
}

/**
 * CANONICAL Loader - unified loading spinner
 */
export const Loader: React.FC<LoaderProps> = ({
  variant = 'spinner',
  message = 'Loading...',
  forceDark = false,
}) => {
  // Prevent scrolling behind overlay
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const bgClass = forceDark
    ? 'bg-black'
    : 'bg-[var(--color-bg-primary)]/80 backdrop-blur-md';

  const dotClass = forceDark
    ? 'bg-white'
    : 'bg-[var(--color-accent)]';

  const textClass = forceDark
    ? 'text-white'
    : 'text-[var(--color-text-primary)]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 ${bgClass} flex flex-col items-center justify-center z-50`}
    >
      {/* Spinner variant (default) */}
      {variant === 'spinner' && (
        <>
          <div className="flex space-x-2">
            <motion.div
              className={`w-3 h-3 ${dotClass} rounded-full`}
              animate={{ y: [-8, 0, -8] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className={`w-3 h-3 ${dotClass} rounded-full`}
              animate={{ y: [-8, 0, -8] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
            />
            <motion.div
              className={`w-3 h-3 ${dotClass} rounded-full`}
              animate={{ y: [-8, 0, -8] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
            />
          </div>
          <p
            className={`mt-4 ${textClass} font-semibold`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        </>
      )}

      {/* Progress variant */}
      {variant === 'progress' && (
        <>
          <div className="w-48 h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--color-accent)]"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
          <p
            className={`mt-4 ${textClass} font-semibold`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        </>
      )}
    </motion.div>
  );
};

// ============================================================================
// Skeleton Component
// ============================================================================

export interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

/**
 * CANONICAL Skeleton - Generic content placeholder with pulse animation
 *
 * Uses Tailwind's animate-pulse and semantic color tokens (bg-slate-800 to bg-slate-700).
 * Follows ui-design-system.mdc skeleton rules.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  shimmer = false,
}) => {
  return (
    <div
      className={`
        bg-slate-800 dark:bg-slate-700
        animate-pulse
        relative
        overflow-hidden
        rounded-xl
        ${className}
      `}
      aria-label="Loading content..."
      aria-busy="true"
      aria-live="polite"
    >
      {shimmer && (
        <div
          className="absolute inset-0 min-w-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent"
          aria-hidden
        />
      )}
    </div>
  );
};

// ============================================================================
// ClinicalSkeleton Component
// ============================================================================

export interface ClinicalSkeletonProps {
  variant?: 'default' | 'compact';
  lines?: number;
  className?: string;
}

const pulseAnimation = {
  initial: { opacity: 0.4 },
  animate: { opacity: 1 },
  transition: {
    repeat: Infinity,
    repeatType: 'reverse' as const,
    duration: 1.2,
    ease: 'easeInOut' as const,
  },
};

/**
 * CANONICAL ClinicalSkeleton - Medical/professional loading state
 *
 * Used for AI content streaming, medical question display.
 * Follows ui-design-system.mdc skeleton rules with slate colors.
 */
export const ClinicalSkeleton: React.FC<ClinicalSkeletonProps> = ({
  variant = 'default',
  lines = 3,
  className = '',
}) => {
  const isCompact = variant === 'compact';

  // Generate varied line widths for natural appearance
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    if (i === lines - 1) return 65 + Math.random() * 15;
    return 80 + Math.random() * 15;
  });

  return (
    <div
      className={`
        relative overflow-hidden skeleton-shimmer
        ${
          isCompact
            ? 'p-4 rounded-lg'
            : 'rounded-xl border border-[var(--color-border)] p-6 shadow-sm'
        }
        bg-[var(--color-card-bg)]
        ${className}
      `}
      role="status"
      aria-label="Loading content"
    >
      <div className="space-y-3">
        {lineWidths.map((width, index) => (
          <motion.div
            key={index}
            {...pulseAnimation}
            style={{
              animationDelay: `${index * 0.1}s`,
              width: `${width}%`,
            }}
            className={`
              ${isCompact ? 'h-4' : 'h-5'}
              bg-gradient-to-r from-slate-800 to-slate-700
              dark:from-slate-700 dark:to-slate-600
              rounded
            `}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * StreamingSkeleton - Skeleton that fades out as content streams in
 */
export const StreamingSkeleton: React.FC<{
  isStreaming: boolean;
  children: React.ReactNode;
  lines?: number;
}> = ({ isStreaming, children, lines = 3 }) => {
  if (!isStreaming) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: children ? 0 : 1 }}
      transition={{ duration: 0.3 }}
    >
      <ClinicalSkeleton lines={lines} />
    </motion.div>
  );
};

// ============================================================================
// DrillLoadingState Component
// ============================================================================

export interface DrillLoadingStateProps {
  optionCount?: number;
  showTimer?: boolean;
  showProgress?: boolean;
  message?: string;
  variant?: 'question' | 'image' | 'lab' | 'encounter';
}

/**
 * CANONICAL DrillLoadingState - Specialized drill mode loading skeleton
 *
 * Displays structured loading state for drill questions with options, timer, and progress.
 */
export const DrillLoadingState: React.FC<DrillLoadingStateProps> = ({
  optionCount = 4,
  showTimer = true,
  showProgress = true,
  message = 'Loading question...',
  variant = 'question',
}) => {
  const SkeletonLine = ({ width = 'w-full', height = 'h-4' }) => (
    <div className={`${width} ${height} bg-slate-800 dark:bg-slate-700 rounded animate-pulse`} />
  );

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
            <div className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-700 animate-pulse" />
            <div>
              <div className="w-32 h-5 bg-slate-800 dark:bg-slate-700 rounded animate-pulse mb-1" />
              <div className="w-24 h-4 bg-slate-800 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          </div>

          {showTimer && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg bg-slate-800 dark:bg-slate-700 animate-pulse" />
            </div>
          )}
        </div>

        {showProgress && (
          <div className="mb-6 h-1 bg-slate-800 dark:bg-slate-700 rounded-full animate-pulse" />
        )}

        {/* Question skeleton */}
        <div className="mb-8 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
          <SkeletonLine width="w-3/4" height="h-6" />
          <SkeletonLine width="w-full" height="h-4" className="mt-4" />
          <SkeletonLine width="w-5/6" height="h-4" className="mt-2" />
        </div>

        {/* Options skeleton */}
        <div className="space-y-3">
          {Array.from({ length: optionCount }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] flex items-center gap-3"
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 dark:bg-slate-700 animate-pulse flex-shrink-0" />
              <SkeletonLine width="w-3/4" height="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Specialized Loading Components
// ============================================================================

/**
 * LoadingProgress - Top-of-page progress bar for perceived performance
 */
export interface LoadingProgressProps {
  isLoading: boolean;
  duration?: number;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  isLoading,
  duration = 2000,
}) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 90) {
            return prev + 90 / (duration / 50);
          }
          if (prev < 95) {
            return prev + 0.1;
          }
          return prev;
        });
      }, 50);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, duration]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isLoading || progress > 0 ? 1 : 0 }}
      exit={{ opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent"
    >
      <motion.div
        className="h-full bg-[var(--color-accent)]"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </motion.div>
  );
};

/**
 * CommandCenterSkeleton - Dashboard-shaped skeleton for Command Center lazy load
 */
export const CommandCenterSkeleton: React.FC<{ message?: string }> = ({
  message = 'Loading dashboard...',
}) => (
  <div className="p-6 space-y-4">
    <div className="h-12 bg-slate-800 dark:bg-slate-700 rounded-xl animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 bg-slate-800 dark:bg-slate-700 rounded-xl animate-pulse" />
      ))}
    </div>
    <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
  </div>
);

/**
 * QuickStatsBarSkeleton - Skeleton for stats bar component
 */
export const QuickStatsBarSkeleton: React.FC = () => (
  <div className="flex gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex-1 h-20 bg-slate-800 dark:bg-slate-700 rounded-lg animate-pulse" />
    ))}
  </div>
);

// ============================================================================
// Specialized Question & Chat Skeletons (re-exported for backward compat)
// ============================================================================

/**
 * QuestionSkeleton - Loading state for quiz/drill questions
 */
export const QuestionSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`space-y-4 ${className}`}>
    <div className="h-6 bg-slate-800 dark:bg-slate-700 rounded-lg w-3/4 animate-pulse" />
    <div className="space-y-2">
      <div className="h-4 bg-slate-800 dark:bg-slate-700 rounded w-full animate-pulse" />
      <div className="h-4 bg-slate-800 dark:bg-slate-700 rounded w-5/6 animate-pulse" />
    </div>
    <div className="space-y-2 pt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-800 dark:bg-slate-700 rounded-lg animate-pulse" />
      ))}
    </div>
  </div>
);

/**
 * ChatSkeleton - Loading state for chat/conversation streams
 */
export const ChatSkeleton: React.FC<{
  messageCount?: number;
  className?: string;
}> = ({ messageCount = 3, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: messageCount }).map((_, i) => (
      <div key={i} className="flex gap-3">
        <div className="w-8 h-8 bg-slate-800 dark:bg-slate-700 rounded-full flex-shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-800 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
          <div className="space-y-1">
            <div className="h-3 bg-slate-800 dark:bg-slate-700 rounded w-full animate-pulse" />
            <div className="h-3 bg-slate-800 dark:bg-slate-700 rounded w-5/6 animate-pulse" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ============================================================================
// Re-exports for convenience
// ============================================================================

export default {
  Loader,
  Skeleton,
  ClinicalSkeleton,
  StreamingSkeleton,
  DrillLoadingState,
  LoadingProgress,
  CommandCenterSkeleton,
  QuickStatsBarSkeleton,
  QuestionSkeleton,
  ChatSkeleton,
};
