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
    bg-muted/50
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
    <div className={`p-4 border border-border rounded-lg bg-card ${className}`}>
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
    <div className={`p-6 border border-border rounded-xl bg-card ${className}`}>
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
            className="p-4 border border-border rounded-lg"
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
    <div className={`p-6 border border-border rounded-xl bg-card ${className}`}>
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
    <div className={`p-5 border border-border rounded-xl bg-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton height="1.25rem" width="40%" />
        <Skeleton width="32px" height="32px" radius="md" />
      </div>
      <Skeleton height="3rem" width="50%" className="mb-4" />
      <SkeletonText lines={2} />
    </div>
  );
};

/**
 * QuestionSkeleton - Mimics a quiz question with answer options
 * Prevents layout shift when loading new questions in drill modes
 */
export const QuestionSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Question header */}
      <div className="space-y-3">
        <Skeleton height="1.5rem" width="30%" radius="md" />
        <Skeleton height="1.25rem" width="100%" radius="md" />
        <Skeleton height="1.25rem" width="95%" radius="md" />
        <Skeleton height="1.25rem" width="85%" radius="md" />
      </div>

      {/* Answer options (4 bars) */}
      <div className="grid grid-cols-1 gap-3 mt-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="p-4 min-h-[56px] border border-border rounded-lg bg-card flex items-center"
          >
            <Skeleton height="1rem" width={`${70 + Math.random() * 20}%`} />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * ChatSkeleton - Mimics alternating chat bubbles
 * Used for patient encounter loading states
 */
export const ChatSkeleton: React.FC<{ 
  messages?: number;
  className?: string;
}> = ({ messages = 3, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: messages }).map((_, index) => {
        const isUser = index % 2 === 0;
        return (
          <div
            key={index}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg ${
                isUser 
                  ? 'bg-primary/10 rounded-br-none' 
                  : 'bg-muted rounded-bl-none'
              }`}
            >
              <Skeleton 
                height="1rem" 
                width={`${60 + Math.random() * 30}%`}
                className="mb-2"
              />
              <Skeleton 
                height="1rem" 
                width={`${40 + Math.random() * 40}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * StatCardSkeleton - Small metric card placeholder
 * Used for dashboard statistics that are loading
 */
export const StatCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-4 border border-border rounded-lg bg-card ${className}`}>
      <Skeleton height="0.875rem" width="50%" className="mb-3" />
      <Skeleton height="2rem" width="40%" className="mb-2" />
      <Skeleton height="0.75rem" width="60%" />
    </div>
  );
};

/**
 * TableSkeleton - Loading state for data tables
 */
export const TableSkeleton: React.FC<{ 
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className = '' }) => {
  return (
    <div className={`border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-muted/30 p-4 border-b border-border">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height="1rem" width="70%" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="p-4 border-b border-border last:border-b-0"
        >
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={colIndex} 
                height="1rem" 
                width={`${50 + Math.random() * 40}%`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
