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
  critical: { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-500' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-500' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500', text: 'text-amber-500' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-500' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function scaleY(score: number, minScore: number, maxScore: number): number {
  const chartArea = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const normalized = (score - minScore) / (maxScore - minScore);
  return CHART_HEIGHT - PADDING.bottom - normalized * chartArea;
}

function scaleX(day: number, maxDays: number): number {
  const chartArea = CHART_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + (day / maxDays) * chartArea;
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
      <div className="flex items-center justify-center h-[200px] text-slate-500">
        No data available
      </div>
    );
  }

  const currentScore = projections[0]?.predictedScore || 0;
  const day7Score = projections[7]?.predictedScore || currentScore;
  const day14Score = projections[14]?.predictedScore || day7Score;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid Lines */}
      <g className="text-slate-200 dark:text-slate-700">
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
        stroke="#EF4444"
        strokeWidth="2"
        strokeDasharray="8,4"
      />
      <text
        x={CHART_WIDTH - PADDING.right + 5}
        y={passingY + 4}
        fill="#EF4444"
        fontSize="10"
        fontWeight="bold"
      >
        350
      </text>

      {/* Ghost Line (Decay Projection) */}
      <motion.path
        d={ghostPathD}
        fill="none"
        stroke="#F87171"
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
        fill="#3B82F6"
        stroke="#1D4ED8"
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
        fill="#F87171"
        stroke="#EF4444"
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
        fill="#F87171"
        stroke="#EF4444"
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
        fill="#3B82F6"
        fontSize="12"
        fontWeight="bold"
      >
        {currentScore}
      </text>
      <text
        x={scaleX(7, 14)}
        y={scaleY(day7Score, minScore, maxScore) - 10}
        textAnchor="middle"
        fill="#F87171"
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
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{drift.currentScore}</div>
            <div className="text-xs text-slate-500">Current</div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'text-2xl font-bold',
                scoreDrop > 0 ? 'text-red-500' : 'text-green-500'
              )}
            >
              {scoreDrop > 0 ? `-${scoreDrop}` : '+0'}
            </div>
            <div className="text-xs text-slate-500">7-Day Δ</div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'text-2xl font-bold',
                drift.daysUntilDanger <= 7
                  ? 'text-red-500'
                  : drift.daysUntilDanger <= 14
                    ? 'text-amber-500'
                    : 'text-green-500'
              )}
            >
              {drift.daysUntilDanger >= 999 ? '∞' : `${drift.daysUntilDanger}d`}
            </div>
            <div className="text-xs text-slate-500">Buffer</div>
          </div>
        </div>
      )}

      {/* Alert Message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'mt-3 p-2 rounded-lg text-sm',
          drift.urgency === 'critical'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : drift.urgency === 'high'
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        )}
      >
        {message}
      </motion.div>
    </div>
  );
}

export default DriftVectorChart;
