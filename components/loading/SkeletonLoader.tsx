/**
 * Skeleton Loader Component
 * 
 * Provides skeleton screens for better perceived performance while content loads.
 * Shows placeholder UI that mimics the structure of the actual content.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  /** Width of the skeleton (can be px, %, or rem) */
  width?: string | number;
  /** Height of the skeleton (can be px, %, or rem) */
  height?: string | number;
  /** Border radius */
  radius?: 'sm' | 'md' | 'lg' | 'full' | 'none';
  /** Additional CSS classes */
  className?: string;
  /** Animation variant */
  variant?: 'pulse' | 'wave' | 'none';
}

/**
 * Basic skeleton element with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  radius = 'md',
  className = '',
  variant = 'pulse',
}) => {
  const radiusClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };
  
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };
  
  const baseClasses = `
    bg-slate-200 dark:bg-slate-700
    ${radiusClasses[radius]}
    ${className}
  `;
  
  if (variant === 'pulse') {
    return (
      <motion.div
        className={baseClasses}
        style={style}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }
  
  if (variant === 'wave') {
    return (
      <div className={`${baseClasses} overflow-hidden relative`} style={style}>
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>
    );
  }
  
  return <div className={baseClasses} style={style} />;
};

/**
 * Skeleton for a card component
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-card-bg)] ${className}`}>
      <Skeleton height="1.5rem" width="60%" className="mb-3" />
      <Skeleton height="1rem" width="100%" className="mb-2" />
      <Skeleton height="1rem" width="90%" className="mb-2" />
      <Skeleton height="1rem" width="80%" />
    </div>
  );
};

/**
 * Skeleton for a text block
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height="1rem"
          width={index === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton for a quiz question card
 */
export const SkeletonQuizQuestion: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-6 border border-[var(--color-border)] rounded-xl bg-[var(--color-card-bg)] ${className}`}>
      {/* Question header */}
      <div className="mb-4">
        <Skeleton height="1.25rem" width="40%" className="mb-3" />
        <SkeletonText lines={4} />
      </div>
      
      {/* Answer options */}
      <div className="space-y-3 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 border border-[var(--color-border)] rounded-lg"
          >
            <Skeleton height="1rem" width="80%" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for a drill mode card
 */
export const SkeletonDrillCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-6 border border-[var(--color-border)] rounded-xl bg-[var(--color-card-bg)] ${className}`}>
      <div className="flex items-start gap-4 mb-4">
        <Skeleton width="48px" height="48px" radius="lg" />
        <div className="flex-1">
          <Skeleton height="1.5rem" width="60%" className="mb-2" />
          <Skeleton height="1rem" width="80%" />
        </div>
      </div>
      <Skeleton height="2.5rem" width="100%" radius="md" />
    </div>
  );
};

/**
 * Skeleton for a dashboard widget
 */
export const SkeletonWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-5 border border-[var(--color-border)] rounded-xl bg-[var(--color-card-bg)] ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton height="1.25rem" width="40%" />
        <Skeleton width="32px" height="32px" radius="md" />
      </div>
      <Skeleton height="3rem" width="50%" className="mb-4" />
      <SkeletonText lines={2} />
    </div>
  );
};
