/**
 * MetacognitiveMirror — Container for all metacognitive insight widgets
 *
 * Drop this into the "Data" tab of DashboardPage to give students
 * a behavioral self-awareness section. Uses useMetacognitiveStats()
 * to fetch data in one API call, then fans out to individual widgets.
 *
 * @module components/dashboard/metacognitive/MetacognitiveMirror
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs, skeletonLineVariants, widgetEntrance } from '@/config/appViews';
import { ShimmerOverlay } from '@/components/loading';
import { useMetacognitiveStats } from '@/hooks/useMetacognitiveStats';
import { FirstInstinctCard } from './FirstInstinctCard';
import { CircadianHeatmap } from './CircadianHeatmap';
import { SpeedAccuracyCard } from './SpeedAccuracyCard';
import { ConfidenceCalibrationCard } from './ConfidenceCalibrationCard';

interface Props {
  /** Data window in days (default 30) */
  days?: number;
}

export const MetacognitiveMirror: React.FC<Props> = ({ days = 30 }) => {
  const prefersReducedMotion = useReducedMotion();
  const { data, isLoading, error } = useMetacognitiveStats(days);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Metacognitive Mirror
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={prefersReducedMotion ? undefined : skeletonLineVariants}
              initial={prefersReducedMotion ? false : "hidden"}
              animate="visible"
              className="relative h-48 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden"
            >
              <ShimmerOverlay intensity="subtle" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-1/3 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                <div className="h-24 w-full rounded-lg bg-[var(--color-bg-tertiary)] animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Metacognitive Mirror
        </h2>
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={prefersReducedMotion ? { duration: 0 } : springs.gentle}
          className="text-sm text-[var(--color-text-muted)]"
        >
          {error || 'Unable to load behavioral insights.'}
        </motion.p>
      </section>
    );
  }

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { y: 12, filter: 'blur(4px)' }}
      animate={{ y: 0, filter: 'blur(0px)' }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.snappy}
      className="space-y-4"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Metacognitive Mirror
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          Last {data.meta.periodDays} days &middot; {data.meta.totalAttempts} questions
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          <FirstInstinctCard key="first-instinct" insight={data.answerSwitchInsight} />,
          <CircadianHeatmap key="circadian" buckets={data.circadianPerformance} />,
          <SpeedAccuracyCard key="speed-accuracy" buckets={data.speedAccuracy} />,
          <ConfidenceCalibrationCard key="confidence" buckets={data.confidenceCurve} />,
        ] as React.ReactElement[]).map((widget, i) => (
          <motion.div
            key={widget.key}
            variants={prefersReducedMotion ? undefined : widgetEntrance}
            initial={prefersReducedMotion ? false : "hidden"}
            animate="visible"
            custom={i}
          >
            {widget}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default MetacognitiveMirror;
