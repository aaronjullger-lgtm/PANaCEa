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
  const { data, isLoading, error } = useMetacognitiveStats(days);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Metacognitive Mirror
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] animate-pulse"
            />
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
        <p className="text-sm text-[var(--color-text-muted)]">
          {error || 'Unable to load behavioral insights.'}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Metacognitive Mirror
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          Last {data.meta.periodDays} days &middot; {data.meta.totalAttempts} questions
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FirstInstinctCard insight={data.answerSwitchInsight} />
        <CircadianHeatmap buckets={data.circadianPerformance} />
        <SpeedAccuracyCard buckets={data.speedAccuracy} />
        <ConfidenceCalibrationCard buckets={data.confidenceCurve} />
      </div>
    </section>
  );
};

export default MetacognitiveMirror;
