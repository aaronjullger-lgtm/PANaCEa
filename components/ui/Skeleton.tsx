/**
 * Skeleton - Shimmering placeholder for loading states
 * Supports optional "shine" effect for extra polish.
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  /** When true, adds a sweeping shimmer overlay */
  shimmer?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', shimmer = false }) => {
  return (
    <div
      className={`
        bg-data-neutral dark:bg-data-neutral
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
