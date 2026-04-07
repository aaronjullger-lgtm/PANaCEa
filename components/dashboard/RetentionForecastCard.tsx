/**
 * Retention Forecast Card
 *
 * Replaces the simple "9 questions due" number with a Retention Forecast:
 * - Forgetting curve (retention dropping over time)
 * - "After review" curve showing how doing due reviews bumps retention back to 100%
 * - Framing: "Save the memory" instead of "Clear the notification"
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import ChartContainer from '../shared/ChartContainer';
import { Brain, ArrowRight, Sparkles } from 'lucide-react';

export interface DecayPoint {
  day: number;
  retentionProb: number;
}

interface RetentionForecastCardProps {
  dueCount: number;
  decayCurveData: DecayPoint[];
  onStartReview: () => void;
  className?: string;
}

function buildChartData(decayCurveData: DecayPoint[]): Array<{
  day: number;
  withoutReview: number;
  afterReview: number;
}> {
  // After review: retention resets to 100% at day 0, then decays like the curve from day 1 onward
  if (!decayCurveData?.length) {
    return Array.from({ length: 31 }, (_, day) => ({
      day,
      withoutReview: Math.max(0, Math.min(100, Math.exp(-day / 5) * 100)),
      afterReview: day === 0 ? 100 : Math.max(0, Math.min(100, Math.exp(-(day - 1) / 5) * 100)),
    }));
  }
  return decayCurveData.map((d, i) => ({
    day: d.day,
    withoutReview: d.retentionProb,
    afterReview: i === 0 ? 100 : (decayCurveData[i - 1]?.retentionProb ?? 0),
  }));
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) => {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl px-3 py-2 shadow-sm">
      <p className="text-[var(--color-text-primary)] font-semibold text-sm mb-1">Day {label}</p>
      <p className="text-[var(--color-text-muted)] text-xs tabular-nums">
        Without review: {Math.round(payload[0]?.value ?? 0)}%
      </p>
      <p className="text-[var(--color-data-pass)] text-xs tabular-nums">
        After review: {Math.round(payload[1]?.value ?? 0)}%
      </p>
    </div>
  );
};

export const RetentionForecastCard: React.FC<RetentionForecastCardProps> = ({
  dueCount,
  decayCurveData,
  onStartReview,
  className = '',
}) => {
  const chartData = useMemo(() => buildChartData(decayCurveData), [decayCurveData]);
  const prefersReducedMotion = useReducedMotion();

  if (dueCount === 0) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { y: 8 }}
        animate={{ y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : undefined}
        className={`group bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-xl p-6 shadow-sm transition-all duration-300 ${className}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-[var(--color-accent)]/15">
            <Brain className="w-6 h-6 text-[var(--color-text-inverse)]" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              All Caught Up
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              No cards due right now — great work!
            </p>
          </div>
        </div>
        <div className="text-center py-6 bg-[var(--color-data-pass)]/10 rounded-xl">
          <Sparkles className="w-8 h-8 text-[var(--color-data-pass)] mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-[var(--color-data-pass)] font-medium">
            Your retention curve is stable. New reviews will appear when they’re due.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { x: -20 }}
      animate={{ x: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
      className={`group bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-xl p-6 shadow-sm transition-all duration-300 ${className}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)] rounded-xl shadow-lg shadow-[var(--color-accent)]/20">
          <Brain className="w-6 h-6 text-[var(--color-text-inverse)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Retention Forecast
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Save the memory — doing reviews now bumps the curve back to 100%
          </p>
        </div>
      </div>

      {/* Forgetting curve + After-review curve */}
      <div className="h-[200px] min-h-[160px] w-full min-w-0 mt-2 mb-4" role="figure" aria-label="Retention forecast chart showing memory decay with and without review">
        <span className="sr-only">
          Chart showing retention probability over 30 days. Without review, retention decays over time.
          After completing {dueCount} due review{dueCount !== 1 ? 's' : ''}, retention resets to 100%.
        </span>
        <ChartContainer minHeight={160} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={160} minWidth={0}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="decayGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-data-provisional)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-data-provisional)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-data-pass)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-data-pass)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="var(--color-text-muted)"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                ticks={[0, 5, 10, 15, 20, 25, 30]}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                domain={[0, 100]}
                width={28}
              />
              <ReferenceLine
                y={90}
                stroke="var(--color-data-fail)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => (
                  <span className="text-[var(--color-text-secondary)] text-xs">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="withoutReview"
                name="Without review (decay)"
                stroke="var(--color-data-provisional)"
                strokeWidth={2}
                fill="url(#decayGradient)"
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="afterReview"
                name="After review (saved)"
                stroke="var(--color-data-pass)"
                strokeWidth={2}
                fill="url(#recoveryGradient)"
                animationDuration={800}
                animationBegin={200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        <strong className="tabular-nums">{dueCount}</strong> review{dueCount !== 1 ? 's' : ''} due — doing them now resets
        retention to 100% for those memories.
      </p>

      <button
        onClick={onStartReview}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-text-inverse)] font-semibold rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
      >
        Save the memory — Start Review
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
      </button>
    </motion.div>
  );
};

export default RetentionForecastCard;
