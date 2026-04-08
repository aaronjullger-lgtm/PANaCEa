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
    : 'bg-[var(--color-bg-primary)]/80';

  const dotClass = forceDark
    ? 'bg-[var(--color-bg-primary)]'
    : 'bg-[var(--color-accent)]';

  const textClass = forceDark
    ? 'text-[var(--color-text-inverse)]'
    : 'text-[var(--color-text-primary)]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 ${bgClass} flex flex-col items-center justify-center z-50`}
      style={{ backdropFilter: 'blur(16px) saturate(1.2)', WebkitBackdropFilter: 'blur(16px) saturate(1.2)' }}
    >
      {/* Spinner variant (default) */}
      {variant === 'spinner' && (
        <>
          <div className="flex space-x-2.5">
            <motion.div
              className={`w-2.5 h-2.5 ${dotClass} rounded-full`}
              animate={{ y: [-8, 0, -8], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: 0, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className={`w-2.5 h-2.5 ${dotClass} rounded-full`}
              animate={{ y: [-8, 0, -8], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className={`w-2.5 h-2.5 ${dotClass} rounded-full`}
              animate={{ y: [-8, 0, -8], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p
            className={`mt-5 ${textClass} text-body font-semibold tracking-tight`}
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
          <div className="w-56 h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #818cf8))' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          </div>
          <p
            className={`mt-5 ${textClass} text-body font-semibold tracking-tight`}
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
 * Uses Tailwind's animate-pulse and semantic color tokens (bg-[var(--color-bg-tertiary)] to bg-[var(--color-bg-tertiary)]).
 * Follows ui-design-system.mdc skeleton rules.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  shimmer = false,
}) => {
  return (
    <div
      className={`
        bg-[var(--color-bg-tertiary)]
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
  initial: { opacity: 0.3 },
  animate: { opacity: 0.8 },
  transition: {
    repeat: Infinity,
    repeatType: 'reverse' as const,
    duration: 1.4,
    ease: [0.16, 1, 0.3, 1] as number[],
  },
};

/**
 * CANONICAL ClinicalSkeleton - Medical/professional loading state
 *
 * Used for AI content streaming, medical question display.
 * Follows ui-design-system.mdc skeleton rules with slate colors.
 */
// React.memo prevents re-rendering when a parent re-renders with the same props.
// ClinicalSkeleton is a pure display component — wrapping it avoids thrashing
// the shimmer animation every time the parent state changes (e.g. streaming text).
export const ClinicalSkeleton: React.FC<ClinicalSkeletonProps> = React.memo(({
  variant = 'default',
  lines = 3,
  className = '',
}) => {
  const isCompact = variant === 'compact';

  // Generate varied line widths for natural appearance.
  // Deterministic values based on index avoid non-deterministic Math.random()
  // which causes layout shifts and React hydration warnings on each render.
  const SKELETON_WIDTHS = [85, 92, 78, 88, 75, 90, 82, 95, 70, 87] as const;
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    const base = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
    // Last line is intentionally shorter (mimics real text)
    return i === lines - 1 ? Math.round(base * 0.75) : base;
  });

  return (
    <div
      className={`
        relative overflow-hidden skeleton-shimmer
        ${
          isCompact
            ? 'p-4 rounded-lg'
            : 'rounded-xl p-6'
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
              bg-gradient-to-r from-slate-200 to-slate-300
              dark:from-slate-700 dark:to-slate-600
              rounded
            `}
          />
        ))}
      </div>
    </div>
  );
});
ClinicalSkeleton.displayName = 'ClinicalSkeleton';

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
    <div className={`${width} ${height} bg-[var(--color-bg-tertiary)] rounded animate-pulse`} />
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
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
            <div>
              <div className="w-32 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-1" />
              <div className="w-24 h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            </div>
          </div>

          {showTimer && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-tertiary)] animate-pulse" />
            </div>
          )}
        </div>

        {showProgress && (
          <div className="mb-6 h-1 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse" />
        )}

        {/* Question skeleton */}
        <div className="card-cinematic mb-8 p-6">
          <SkeletonLine width="w-3/4" height="h-6" />
          <SkeletonLine width="w-full" height="h-4" className="mt-4" />
          <SkeletonLine width="w-5/6" height="h-4" className="mt-2" />
        </div>

        {/* Options skeleton */}
        <div className="space-y-3">
          {Array.from({ length: optionCount }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[var(--color-card-bg)] flex items-center gap-3"
              style={{ boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.04)' }}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] animate-pulse flex-shrink-0" />
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
 * CommandCenterSkeleton - Dashboard-shaped skeleton for Command Center lazy load.
 *
 * Layout mirrors the real CommandCenterHub above-the-fold content:
 *   1. Greeting heading + subtitle
 *   2. Status chip row
 *   3. Quick stats bar (2-col mobile, 4-col desktop)
 *   4. Hero action card
 * This prevents a visible layout "jump" when the lazy component replaces
 * the skeleton after Suspense resolves.
 */
export const CommandCenterSkeleton: React.FC<{ message?: string }> = ({
  message = 'Loading dashboard...',
}) => (
  <div className="pt-6 space-y-6" role="status" aria-label={message}>
    {/* Greeting skeleton */}
    <div>
      <div className="h-8 w-56 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse" />
      <div className="flex gap-2 mt-3">
        <div className="h-7 w-16 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse" />
        <div className="h-7 w-20 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse" />
      </div>
      <div className="h-4 w-64 bg-[var(--color-bg-tertiary)] rounded mt-3 animate-pulse" />
    </div>

    {/* Quick stats bar skeleton (matches 2-col mobile / 4-col desktop grid) */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="card-stat flex items-center gap-3 p-3.5"
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-5 w-10 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            <div className="h-3 w-16 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>

    {/* Hero card skeleton */}
    <div className="card-cinematic h-40 animate-pulse" />

    <p className="text-sm text-[var(--color-text-muted)]" aria-live="polite">{message}</p>
  </div>
);

/**
 * QuickStatsBarSkeleton - Skeleton for stats bar component.
 * Uses the same grid-cols-2 / md:grid-cols-4 as the real QuickStatsBar
 * so there's no layout shift when the real component mounts.
 */
export const QuickStatsBarSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" role="status" aria-label="Loading stats">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="card-stat flex items-center gap-3 p-3.5"
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-5 w-10 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
          <div className="h-3 w-16 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
        </div>
      </div>
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
    <div className="h-6 bg-[var(--color-bg-tertiary)] rounded-lg w-3/4 animate-pulse" />
    <div className="space-y-2">
      <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-full animate-pulse" />
      <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-5/6 animate-pulse" />
    </div>
    <div className="space-y-2 pt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse" />
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
        <div className="w-8 h-8 bg-[var(--color-bg-tertiary)] rounded-full flex-shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/3 animate-pulse" />
          <div className="space-y-1">
            <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-full animate-pulse" />
            <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-5/6 animate-pulse" />
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

// Skeleton aliases for backwards compatibility
export const UserStatsOverviewSkeleton: React.FC = () => (
  <div className="space-y-4">
    <Skeleton className="h-20 w-full rounded-xl" />
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <Skeleton className="h-24 w-full rounded-xl" />
);

export const SkeletonWidget: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton className={`h-32 w-full rounded-xl ${className}`.trim()} />
);

export const SkeletonDrillCard: React.FC = () => (
  <Skeleton className="h-48 w-full rounded-xl" />
);

export const SkeletonQuizQuestion: React.FC = () => (
  <div className="space-y-4">
    <Skeleton className="h-6 w-full rounded" />
    <Skeleton className="h-4 w-3/4 rounded" />
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full rounded" />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded" />
    ))}
  </div>
);

// SkeletonLoader — alias for backwards compatibility (imported by some components from @/components/loading)
export const SkeletonLoader: React.FC<{ height?: string; width?: string; className?: string }> = ({
  height,
  width,
  className = '',
}) => (
  <Skeleton
    className={`${height ? `h-[${height}]` : ''} ${width ? `w-[${width}]` : 'w-full'} ${className}`.trim()}
  />
);

// SkeletonCard — alias for backwards compatibility
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton className={`h-32 w-full rounded-xl ${className}`.trim()} />
);

/**
 * SkeletonText — multi-line text placeholder.
 * Thin alias for ClinicalSkeleton with variant="compact" so the padding
 * matches inline text blocks rather than standalone cards.
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => <ClinicalSkeleton variant="compact" lines={lines} className={className} />;
