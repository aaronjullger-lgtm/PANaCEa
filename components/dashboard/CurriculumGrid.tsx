/**
 * CurriculumGrid - "Magnetic" physics-based system selector
 * Uses Framer Motion spring animations for premium kinetic feel.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ABBREVIATION_TO_TOPIC_MAP, getSystemDisplayFullName } from '@/src/constants';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SystemCode } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

interface CurriculumGridProps {
  isLoading?: boolean;
  selectedSystems: Set<SystemCode>;
  onSystemToggle: (system: SystemCode) => void;
  growthAreas?: string[];
  progressData?: Record<string, number>;
}

const SYSTEMS = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];

export const CurriculumGrid: React.FC<CurriculumGridProps> = ({
  isLoading,
  selectedSystems,
  onSystemToggle,
  growthAreas = [],
  progressData,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {Array.from({ length: 15 }).map((_, i) => (
          <SkeletonLoader key={`skeleton-${i}`} variant="rectangular" className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2"
      variants={prefersReducedMotion ? undefined : containerVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
    >
      {SYSTEMS.map((system) => {
        const fullName = getSystemDisplayFullName(system);
        const isSelected = selectedSystems.has(system);
        const isWeak = growthAreas.some((a) => a.toUpperCase() === system || a === system);
        const progress = progressData?.[system] ?? 0;

        return (
          <motion.button
            key={system}
            variants={prefersReducedMotion ? undefined : itemVariants}
            onClick={() => onSystemToggle(system)}
            whileHover={
              prefersReducedMotion ? undefined : { scale: 1.03, y: -4, boxShadow: '0 10px 20px -4px rgba(15,23,42,0.15)' }
            }
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            title={fullName}
            data-mastery={isWeak ? 'weak' : undefined}
            className={`
              relative flex flex-col justify-between p-3 min-h-0 rounded-xl text-left
              bg-white dark:bg-[var(--color-bg-secondary)] shadow-sm border
              transition-colors duration-300
              ${isSelected
                ? 'border-l-4 border-l-muted-amber-500 bg-slate-50 dark:bg-[var(--color-bg-tertiary)] border-slate-200 dark:border-[var(--color-border)]'
                : 'border-slate-200 dark:border-[var(--color-border)] hover:bg-slate-50 dark:hover:bg-[var(--color-bg-tertiary)]'
              }
              ${isSelected ? 'text-slate-900 dark:text-[var(--color-text-primary)]' : 'text-slate-600 dark:text-[var(--color-text-muted)]'}
            `}
          >
            <div className="flex justify-between items-start w-full gap-2">
              <span className={`font-semibold text-xs truncate ${isSelected ? 'text-[var(--color-text-primary)]' : ''}`}>
                {system}
              </span>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-amber-500 shadow-[0_0_6px_rgba(176,155,115,0.6)]"
                />
              )}
            </div>
            <div className="text-[10px] opacity-80 truncate mt-0.5" title={fullName}>
              {fullName}
            </div>
            {progressData && (
              <div className="mt-2 w-full">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Mastery</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                    className={`h-full rounded-full ${progress > 80 ? 'bg-emerald-500' : 'bg-muted-amber-500'}`}
                  />
                </div>
              </div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
};
