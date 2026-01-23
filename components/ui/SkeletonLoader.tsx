import React from 'react';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * SkeletonLoader - Animated placeholder for loading states
 *
 * Prevents layout shift (CLS = 0.0) by reserving space while data loads.
 * Uses Tailwind's animate-pulse for smooth loading animation.
 *
 * @param width - CSS width value (default: 100%)
 * @param height - CSS height value (default: 1rem for text, 4rem for others)
 * @param className - Additional Tailwind classes
 * @param variant - Shape: text (thin line), circular (circle), rectangular (block)
 * @param animation - Animation style: pulse (default), wave, or none
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height,
  className = '',
  variant = 'rectangular',
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700';

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 bg-[length:200%_100%]',
    none: '',
  };

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const defaultHeight = variant === 'text' ? '1rem' : height || '4rem';

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={{ width, height: defaultHeight }}
      aria-label="Loading content..."
      aria-busy="true"
      role="status"
    />
  );
};

/**
 * SkeletonText - Convenience component for text line skeletons
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 1, className = '', lastLineWidth = '80%' }) => (
  <div
    className={`space-y-2 ${className}`}
    role="status"
    aria-label={`Loading ${lines} lines of text`}
  >
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonLoader key={i} variant="text" width={i === lines - 1 ? lastLineWidth : '100%'} />
    ))}
  </div>
);

/**
 * SkeletonCard - Full card skeleton with header and body
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-6 ${className}`}
    role="status"
    aria-label="Loading card content"
  >
    <div className="flex items-center gap-3 mb-4">
      <SkeletonLoader variant="circular" width="3rem" height="3rem" />
      <div className="flex-1 space-y-2">
        <SkeletonLoader variant="text" width="60%" />
        <SkeletonLoader variant="text" width="40%" />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
);

/**
 * SkeletonQuestionCard - Skeleton for question cards in drill sessions
 * Matches QuestionCard layout to prevent CLS
 */
export const SkeletonQuestionCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-6 ${className}`}
    role="status"
    aria-label="Loading question"
  >
    {/* Question header with system badge */}
    <div className="flex items-center justify-between mb-4">
      <SkeletonLoader variant="rectangular" width="120px" height="28px" className="rounded-full" />
      <SkeletonLoader variant="text" width="80px" />
    </div>

    {/* Question text (3-4 lines typical) */}
    <div className="mb-6">
      <SkeletonText lines={4} lastLineWidth="60%" />
    </div>

    {/* Answer options (4 choices) */}
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4 rounded-lg border border-[var(--color-border)]"
        >
          <SkeletonLoader variant="circular" width="24px" height="24px" />
          <SkeletonLoader variant="text" width={`${85 - i * 10}%`} />
        </div>
      ))}
    </div>
  </div>
);

/**
 * SkeletonAnalyticsDashboard - Skeleton for analytics dashboard
 * Matches AnalyticsDashboard layout
 */
export const SkeletonAnalyticsDashboard: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div className={`space-y-6 ${className}`} role="status" aria-label="Loading analytics">
    {/* Summary stats row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4"
        >
          <SkeletonLoader variant="text" width="60%" className="mb-2" />
          <SkeletonLoader variant="rectangular" width="80%" height="2rem" />
        </div>
      ))}
    </div>

    {/* Chart area */}
    <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-6">
      <SkeletonLoader variant="text" width="200px" className="mb-4" />
      <SkeletonLoader variant="rectangular" width="100%" height="250px" />
    </div>

    {/* Performance breakdown */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4"
        >
          <SkeletonLoader variant="text" width="50%" className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <SkeletonLoader variant="text" width="40%" />
                <SkeletonLoader
                  variant="rectangular"
                  width="60%"
                  height="12px"
                  className="rounded-full"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * SkeletonListItem - Skeleton for list items (conditions, topics, etc.)
 */
export const SkeletonListItem: React.FC<{ showAvatar?: boolean; className?: string }> = ({
  showAvatar = true,
  className = '',
}) => (
  <div
    className={`flex items-center gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] ${className}`}
    role="status"
    aria-label="Loading list item"
  >
    {showAvatar && <SkeletonLoader variant="circular" width="48px" height="48px" />}
    <div className="flex-1 space-y-2">
      <SkeletonLoader variant="text" width="70%" />
      <SkeletonLoader variant="text" width="40%" />
    </div>
    <SkeletonLoader variant="rectangular" width="60px" height="24px" className="rounded-full" />
  </div>
);

/**
 * SkeletonList - Multiple list items skeleton
 */
export const SkeletonList: React.FC<{
  count?: number;
  showAvatars?: boolean;
  className?: string;
}> = ({ count = 5, showAvatars = true, className = '' }) => (
  <div className={`space-y-3 ${className}`} role="status" aria-label={`Loading ${count} items`}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonListItem key={i} showAvatar={showAvatars} />
    ))}
  </div>
);

/**
 * SkeletonButton - Skeleton for button placeholders
 */
export const SkeletonButton: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-8 w-20',
    md: 'h-10 w-28',
    lg: 'h-12 w-36',
  };

  return (
    <SkeletonLoader
      variant="rectangular"
      className={`${sizeClasses[size]} rounded-lg ${className}`}
    />
  );
};

/**
 * SkeletonImage - Skeleton for image placeholders with aspect ratio support
 */
export const SkeletonImage: React.FC<{
  aspectRatio?: '1:1' | '4:3' | '16:9' | '3:2';
  className?: string;
}> = ({ aspectRatio = '16:9', className = '' }) => {
  const aspectRatioClasses = {
    '1:1': 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '16:9': 'aspect-video',
    '3:2': 'aspect-[3/2]',
  };

  return (
    <div
      className={`${aspectRatioClasses[aspectRatio]} ${className}`}
      role="status"
      aria-label="Loading image"
    >
      <SkeletonLoader variant="rectangular" width="100%" height="100%" />
    </div>
  );
};

/**
 * SkeletonNavbar - Skeleton for navigation bar
 */
export const SkeletonNavbar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] ${className}`}
    role="status"
    aria-label="Loading navigation"
  >
    <SkeletonLoader variant="rectangular" width="120px" height="32px" />
    <div className="flex items-center gap-4">
      <SkeletonLoader variant="text" width="80px" className="hidden md:block" />
      <SkeletonLoader variant="text" width="80px" className="hidden md:block" />
      <SkeletonLoader variant="text" width="80px" className="hidden md:block" />
      <SkeletonLoader variant="circular" width="40px" height="40px" />
    </div>
  </div>
);

/**
 * SkeletonTable - Skeleton for data tables
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => (
  <div
    className={`bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden ${className}`}
    role="status"
    aria-label={`Loading table with ${rows} rows`}
  >
    {/* Header */}
    <div className="flex gap-4 p-4 border-b border-[var(--color-border)] bg-slate-50 dark:bg-slate-800">
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonLoader key={i} variant="text" width={`${100 / columns - 2}%`} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={rowIndex}
        className="flex gap-4 p-4 border-b border-[var(--color-border)] last:border-b-0"
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <SkeletonLoader key={colIndex} variant="text" width={`${100 / columns - 2}%`} />
        ))}
      </div>
    ))}
  </div>
);

export default SkeletonLoader;
