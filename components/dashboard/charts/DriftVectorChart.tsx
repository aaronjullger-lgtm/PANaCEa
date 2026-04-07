/**
 * DriftVectorChart.tsx
 *
 * Visualizes the "Ghost Line" - a projection of score decay over time
 * without review. Shows current score, projected decay, and passing threshold.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import type { DriftVector, DriftProjection } from '../../../lib/driftCalculator';
import { getDriftMessage, getDriftStatusLabel } from '../../../lib/driftCalculator';

// =============================================================================
// TYPES
// =============================================================================

interface DriftVectorChartProps {
  drift: DriftVector;
  className?: string;
  showDetails?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PASSING_SCORE = 350;
const CHART_HEIGHT = 200;
const CHART_WIDTH = 400;
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

const URGENCY_COLORS = {
  critical: { bg: 'bg-data-fail/10', border: 'border-data-fail', text: 'text-data-fail' },
  high: { bg: 'bg-[var(--color-data-provisional)]/10', border: 'border-[var(--color-data-provisional)]', text: 'text-[var(--color-data-provisional)]' },
  medium: { bg: 'bg-data-provisional/10', border: 'border-data-provisional', text: 'text-data-provisional' },
  low: { bg: 'bg-data-pass/10', border: 'border-data-pass', text: 'text-data-pass' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function scaleY(score: number, minScore: number, maxScore: number): number {
  const chartArea = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const range = maxScore - minScore;
  const normalized = range > 0 ? (score - minScore) / range : 0.5;
  return CHART_HEIGHT - PADDING.bottom - normalized * chartArea;
}

function scaleX(day: number, maxDays: number): number {
  const chartArea = CHART_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + (maxDays > 0 ? (day / maxDays) : 0) * chartArea;
}

// =============================================================================
// SVG LINE CHART
// =============================================================================

function DriftLineChart({ projections }: { projections: DriftProjection[] }) {
  const { pathD, ghostPathD, minScore, maxScore, passingY } = useMemo(() => {
    if (projections.length === 0) {
      return { pathD: '', ghostPathD: '', minScore: 200, maxScore: 500, passingY: 0 };
    }

    const scores = projections.map((p) => p.predictedScore);
    const min = Math.min(...scores, PASSING_SCORE - 20);
    const max = Math.max(...scores, PASSING_SCORE + 100);

    // Main line path (solid line for current)
    const mainPath = projections
      .map((p, i) => {
        const x = scaleX(p.day, 14);
        const y = scaleY(p.predictedScore, min, max);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Ghost line (dashed, projected decay)
    const ghostPath = projections
      .slice(1)
      .map((p, i) => {
        const x = scaleX(p.day, 14);
        const y = scaleY(p.predictedScore, min, max);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    const passingLineY = scaleY(PASSING_SCORE, min, max);

    return {
      pathD: mainPath,
      ghostPathD: ghostPath,
      minScore: min,
      maxScore: max,
      passingY: passingLineY,
    };
  }, [projections]);

  if (projections.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-data-neutral">
        No data available
      </div>
    );
  }

  const currentScore = projections[0]?.predictedScore ?? 0;
  const day7Score = projections[7]?.predictedScore ?? currentScore;
  const day14Score = projections[14]?.predictedScore ?? day7Score;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid Lines */}
      <g className="text-data-neutral dark:text-data-neutral">
        {[0, 7, 14].map((day) => (
          <line
            key={`grid-${day}`}
            x1={scaleX(day, 14)}
            y1={PADDING.top}
            x2={scaleX(day, 14)}
            y2={CHART_HEIGHT - PADDING.bottom}
            stroke="currentColor"
            strokeDasharray="2,2"
            strokeWidth="1"
          />
        ))}
      </g>

      {/* Passing Threshold Line */}
      <line
        x1={PADDING.left}
        y1={passingY}
        x2={CHART_WIDTH - PADDING.right}
        y2={passingY}
        stroke="var(--color-data-fail)"
        strokeWidth="2"
        strokeDasharray="8,4"
      />
      <text
        x={CHART_WIDTH - PADDING.right + 5}
        y={passingY + 4}
        fill="var(--color-data-fail)"
        fontSize="10"
        fontWeight="bold"
      >
        350
      </text>

      {/* Ghost Line (Decay Projection) */}
      <motion.path
        d={ghostPathD}
        fill="none"
        stroke="var(--color-data-fail)"
        strokeWidth="2"
        strokeDasharray="6,4"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />

      {/* Current Score Point */}
      <motion.circle
        cx={scaleX(0, 14)}
        cy={scaleY(currentScore, minScore, maxScore)}
        r="6"
        fill="var(--color-accent)"
        stroke="var(--color-accent-hover)"
        strokeWidth="2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Day 7 Ghost Point */}
      <motion.circle
        cx={scaleX(7, 14)}
        cy={scaleY(day7Score, minScore, maxScore)}
        r="4"
        fill="var(--color-data-fail)"
        stroke="var(--color-data-fail)"
        strokeWidth="2"
        opacity={0.7}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      />

      {/* Day 14 Ghost Point */}
      <motion.circle
        cx={scaleX(14, 14)}
        cy={scaleY(day14Score, minScore, maxScore)}
        r="4"
        fill="var(--color-data-fail)"
        stroke="var(--color-data-fail)"
        strokeWidth="2"
        opacity={0.5}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.8 }}
      />

      {/* X-Axis Labels */}
      <text
        x={scaleX(0, 14)}
        y={CHART_HEIGHT - 10}
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
      >
        Now
      </text>
      <text
        x={scaleX(7, 14)}
        y={CHART_HEIGHT - 10}
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
      >
        Day 7
      </text>
      <text
        x={scaleX(14, 14)}
        y={CHART_HEIGHT - 10}
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
      >
        Day 14
      </text>

      {/* Y-Axis Labels */}
      <text x={15} y={PADDING.top + 5} fill="currentColor" fontSize="10" textAnchor="start">
        {Math.round(maxScore)}
      </text>
      <text
        x={15}
        y={CHART_HEIGHT - PADDING.bottom}
        fill="currentColor"
        fontSize="10"
        textAnchor="start"
      >
        {Math.round(minScore)}
      </text>

      {/* Score Annotations */}
      <text
        x={scaleX(0, 14)}
        y={scaleY(currentScore, minScore, maxScore) - 12}
        textAnchor="middle"
        fill="var(--color-accent)"
        fontSize="12"
        fontWeight="bold"
      >
        {currentScore}
      </text>
      <text
        x={scaleX(7, 14)}
        y={scaleY(day7Score, minScore, maxScore) - 10}
        textAnchor="middle"
        fill="var(--color-data-fail)"
        fontSize="10"
        opacity={0.8}
      >
        {day7Score}
      </text>
    </svg>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DriftVectorChart({ drift, className, showDetails = true }: DriftVectorChartProps) {
  const urgencyColors = URGENCY_COLORS[drift.urgency];
  const message = getDriftMessage(drift);
  const statusLabel = getDriftStatusLabel(drift);

  const scoreDrop = drift.currentScore - drift.projectedScoreDay7;

  return (
    <div className={cn('rounded-xl border p-4', urgencyColors.bg, urgencyColors.border, className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Score Trajectory
        </h3>
        <span className={cn('text-xs font-medium px-2 py-1 rounded', urgencyColors.text)}>
          {statusLabel}
        </span>
      </div>

      {/* Chart */}
      <div className="relative">
        <DriftLineChart projections={drift.projections} />
      </div>

      {/* Stats Row */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-data-neutral dark:border-data-neutral">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-category-practice)]">{drift.currentScore}</div>
            <div className="text-xs text-data-neutral">Current</div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'text-2xl font-bold',
                scoreDrop > 0 ? 'text-data-fail' : 'text-data-pass'
              )}
            >
              {scoreDrop > 0 ? `-${scoreDrop}` : '+0'}
            </div>
            <div className="text-xs text-data-neutral">7-Day Δ</div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'text-2xl font-bold',
                drift.daysUntilDanger <= 7
                  ? 'text-data-fail'
                  : drift.daysUntilDanger <= 14
                    ? 'text-data-provisional'
                    : 'text-data-pass'
              )}
            >
              {drift.daysUntilDanger >= 999 ? '∞' : `${drift.daysUntilDanger}d`}
            </div>
            <div className="text-xs text-data-neutral">Buffer</div>
          </div>
        </div>
      )}

      {/* Alert Message */}
      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        className={cn(
          'mt-3 p-2 rounded-lg text-sm',
          drift.urgency === 'critical'
            ? 'bg-data-fail dark:bg-data-fail/30 text-data-fail dark:text-data-fail'
            : drift.urgency === 'high'
              ? 'bg-[var(--color-data-provisional)]/20 dark:bg-[var(--color-data-provisional)]/30 text-[var(--color-data-provisional)] dark:text-[var(--color-data-provisional)]'
              : 'bg-data-neutral dark:bg-data-neutral text-data-neutral dark:text-data-neutral'
        )}
      >
        {message}
      </motion.div>
    </div>
  );
}

export default DriftVectorChart;
