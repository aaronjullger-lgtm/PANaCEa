import React from 'react';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

/**
 * SkeletonLoader - Animated placeholder for loading states
 * 
 * Prevents layout shift (jitter) by reserving space while data loads.
 * Uses Tailwind's animate-pulse for smooth loading animation.
 * 
 * @param width - CSS width value (default: 100%)
 * @param height - CSS height value (default: 1rem for text, 4rem for others)
 * @param className - Additional Tailwind classes
 * @param variant - Shape: text (thin line), circular (circle), rectangular (block)
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height,
  className = '',
  variant = 'rectangular',
}) => {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700 animate-pulse';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const defaultHeight = variant === 'text' ? '1rem' : height || '4rem';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height: defaultHeight }}
      aria-label="Loading..."
      role="status"
    />
  );
};

/**
 * SkeletonText - Convenience component for text line skeletons
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonLoader
        key={i}
        variant="text"
        width={i === lines - 1 ? '80%' : '100%'}
      />
    ))}
  </div>
);

/**
 * SkeletonCard - Full card skeleton with header and body
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-6 ${className}`}>
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

export default SkeletonLoader;
