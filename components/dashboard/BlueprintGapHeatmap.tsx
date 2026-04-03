/**
 * BlueprintGapHeatmap — Visual gap analysis against NCCPA 2025 Blueprint.
 *
 * Shows a sorted horizontal bar chart where each bar represents a system.
 * Bar length = gap magnitude, color = accuracy, sorted most-under-studied first.
 * Includes accuracy overlay and total coverage score.
 *
 * @see hooks/useBlueprintGaps.ts
 * @see functions/api/analytics/blueprint-gaps.ts
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { BlueprintGapSystem, BlueprintGapsData } from '@/hooks/useBlueprintGaps';

interface BlueprintGapHeatmapProps {
  data: BlueprintGapsData;
  className?: string;
  /** If true, shows compact version (no accuracy labels) */
  compact?: boolean;
}

/**
 * Returns a color based on accuracy: red < 50%, amber 50–70%, green > 70%
 */
function accuracyColor(accuracy: number): string {
  if (accuracy === 0) return 'var(--color-text-muted)';
  if (accuracy < 50) return 'var(--color-data-fail, #ef4444)';
  if (accuracy < 70) return 'var(--color-data-provisional, #f59e0b)';
  return 'var(--color-data-pass, #22c55e)';
}

/**
 * Returns a background color for the gap bar based on gap direction.
 * Negative gap (under-studied) = red tones; positive = blue tones.
 */
function gapBarColor(gapPercent: number, accuracy: number): string {
  if (gapPercent < -3) {
    // Under-studied — severity based on gap magnitude
    return accuracy < 50
      ? 'var(--color-data-fail, #ef4444)'
      : 'var(--color-data-provisional, #f59e0b)';
  }
  if (gapPercent > 3) {
    // Over-studied — informational blue
    return 'var(--color-accent, #3b82f6)';
  }
  // Within ±3% of target — on track
  return 'var(--color-data-pass, #22c55e)';
}

function gapLabel(gapPercent: number): string {
  if (gapPercent < -3) return 'Under-studied';
  if (gapPercent > 3) return 'Over-studied';
  return 'On target';
}

export function BlueprintGapHeatmap({
  data,
  className = '',
  compact = false,
}: BlueprintGapHeatmapProps) {
  const prefersReducedMotion = useReducedMotion();

  // Max absolute gap for scaling bars
  const maxAbsGap = useMemo(
    () => Math.max(...data.systems.map((s) => Math.abs(s.gapPercent)), 1),
    [data.systems]
  );

  // Count systems needing attention (under-studied by >3% OR accuracy <60%)
  const needsAttention = useMemo(
    () =>
      data.systems.filter(
        (s) => s.gapPercent < -3 || (s.totalAttempts > 5 && s.accuracy < 60)
      ).length,
    [data.systems]
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.1 },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  };

  if (data.totalAttempts === 0) {
    return (
      <div
        className={`rounded-lg p-5 ${className}`}
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Blueprint Gap Analysis
        </h3>
        <p
          className="text-xs text-center py-6"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Answer questions across different systems to see your blueprint coverage gaps.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-5 ${className}`}
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Blueprint Gap Analysis
          </h3>
          {needsAttention > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--color-data-fail, #ef4444)',
                color: 'white',
                opacity: 0.9,
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              {needsAttention} gap{needsAttention > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Coverage:
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--color-accent)' }}
          >
            {data.coverageScore}%
          </span>
        </div>
      </div>

      {/* System rows — sorted by gap (most under-studied first) */}
      <motion.div
        className="space-y-2"
        variants={containerVariants}
        initial={prefersReducedMotion ? 'visible' : 'hidden'}
        animate="visible"
      >
        {data.systems.map((sys) => {
          const barWidth = Math.min((Math.abs(sys.gapPercent) / maxAbsGap) * 100, 100);
          const barColor = gapBarColor(sys.gapPercent, sys.accuracy);
          const isUnderStudied = sys.gapPercent < -3;
          const isOverStudied = sys.gapPercent > 3;

          return (
            <motion.div
              key={sys.system}
              variants={rowVariants}
              className="group relative"
            >
              <div className="flex items-center gap-2">
                {/* System name */}
                <div className="w-28 flex-shrink-0 flex items-center gap-1.5">
                  {isUnderStudied && (
                    <TrendingDown
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: 'var(--color-data-fail, #ef4444)' }}
                    />
                  )}
                  {!isUnderStudied && !isOverStudied && (
                    <CheckCircle2
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: 'var(--color-data-pass, #22c55e)' }}
                    />
                  )}
                  <span
                    className="text-xs font-medium truncate"
                    style={{
                      color: isUnderStudied
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    {sys.system}
                  </span>
                </div>

                {/* Gap bar */}
                <div className="flex-1 flex items-center">
                  <div
                    className="relative h-4 w-full overflow-hidden rounded-sm"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                  >
                    <motion.div
                      className="h-full rounded-sm"
                      style={{ backgroundColor: barColor, opacity: 0.85 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.6,
                        ease: 'easeOut',
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="w-20 flex-shrink-0 flex items-center justify-end gap-2">
                  {!compact && sys.totalAttempts > 0 && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: accuracyColor(sys.accuracy) }}
                    >
                      {sys.accuracy}%
                    </span>
                  )}
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{
                      color: isUnderStudied
                        ? 'var(--color-data-fail, #ef4444)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {sys.gapPercent > 0 ? '+' : ''}{sys.gapPercent}%
                  </span>
                </div>
              </div>

              {/* Hover tooltip */}
              <div
                className="absolute left-32 -top-8 z-10 hidden group-hover:block pointer-events-none"
              >
                <div
                  className="rounded px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
                  style={{ backgroundColor: 'rgba(0,0,0,0.85)', color: 'white' }}
                >
                  {sys.system}: {sys.totalAttempts} Qs ({sys.accuracy}% acc) · Target {sys.targetPercent}% · Actual {sys.actualPercent}% · {gapLabel(sys.gapPercent)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Legend */}
      <div
        className="mt-4 pt-3 flex flex-wrap gap-4 text-xs border-t"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: 'var(--color-data-fail, #ef4444)' }}
          />
          Under-studied
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: 'var(--color-data-provisional, #f59e0b)' }}
          />
          Needs focus
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: 'var(--color-data-pass, #22c55e)' }}
          />
          On target
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: 'var(--color-accent, #3b82f6)' }}
          />
          Over-studied
        </span>
      </div>
    </div>
  );
}

export default BlueprintGapHeatmap;
