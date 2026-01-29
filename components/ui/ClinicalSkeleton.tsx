/**
 * ClinicalSkeleton Component
 * 
 * Professional skeleton loader for latency masking during AI streaming.
 * Implements the "Stormy Slate" aesthetic with semantic tokens.
 * 
 * Usage:
 * - Default: Full clinical text block skeleton
 * - Compact: Smaller variant for answer options
 * - Custom lines: Control number of lines displayed
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface ClinicalSkeletonProps {
  /** Variant: 'default' for questions, 'compact' for options */
  variant?: 'default' | 'compact';
  /** Number of skeleton lines to display */
  lines?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pulsing animation for skeleton lines
 */
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
 * ClinicalSkeleton - Latency masking skeleton for AI content
 */
const ClinicalSkeleton: React.FC<ClinicalSkeletonProps> = ({
  variant = 'default',
  lines = 3,
  className = '',
}) => {
  const isCompact = variant === 'compact';

  // Generate array of line widths (varied for natural appearance)
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    // Last line is typically shorter
    if (i === lines - 1) return 65 + Math.random() * 15;
    // Other lines are 80-95% width
    return 80 + Math.random() * 15;
  });

  return (
    <div
      className={`
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
              bg-gradient-to-r from-[var(--color-bg-tertiary)] to-[var(--color-bg-secondary)]
              rounded
            `}
          />
        ))}
      </div>

      {/* Optional shimmer effect overlay for premium feel */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-text-inverse)]/15 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'linear',
        }}
        style={{
          maskImage: 'linear-gradient(to right, transparent, black, transparent)',
        }}
      />
    </div>
  );
};

export { ClinicalSkeleton };
export default ClinicalSkeleton;

/**
 * StreamingSkeleton - Skeleton that fades out as content streams in
 * 
 * Usage: Wrap this around streaming content
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
