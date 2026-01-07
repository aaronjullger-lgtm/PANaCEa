import React from 'react';
import { motion } from 'framer-motion';

interface ClinicalSkeletonProps {
  className?: string;
  lines?: number;
  variant?: 'card' | 'compact';
}

const ClinicalSkeleton: React.FC<ClinicalSkeletonProps> = ({
  className = '',
  lines = 5,
  variant = 'card',
}) => {
  const heightClass = variant === 'card'
    ? 'min-h-[260px] sm:min-h-[320px]'
    : 'min-h-[120px]';

  const mergedClassName = [
    'relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700',
    'bg-white dark:bg-slate-900 shadow-sm',
    heightClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      initial={{ opacity: 0.6, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={mergedClassName}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-white/70 to-slate-100/60 dark:from-slate-800/60 dark:via-slate-900/70 dark:to-slate-900/80" />
      <div className="relative p-6 space-y-3 animate-pulse">
        <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded-full" />
        <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-full" />
        <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-full" />
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full"
            style={{ width: `${90 - idx * 7}%` }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default ClinicalSkeleton;
