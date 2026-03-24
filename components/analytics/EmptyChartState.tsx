/**
 * EmptyChartState Component
 *
 * Unified empty state pattern for all charts across the application.
 * Uses baseline copy ("Not yet assessed") and optional diagnostic CTA
 * so the app never feels "dead" — gamify data collection.
 *
 * Part of Phase 3 Visualization Improvements - "No Data" Consistency
 * Empty State Pedagogy: Pre-filled baseline + diagnostic CTA
 */

import React from 'react';
import { Activity, BarChart3, Brain, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export type ChartType = 'line' | 'bar' | 'radar' | 'area' | 'heatmap' | 'generic';

/** Default CTA label for unlocking charts via a short diagnostic quiz */
export const DIAGNOSTIC_CTA_LABEL = 'Take a 10-question diagnostic quiz to unlock this graph';

interface EmptyChartStateProps {
  /** Type of chart to display placeholder for */
  chartType?: ChartType;
  /** Height of the empty state container */
  height?: number | string;
  /** Baseline message (avoid "No Data"; use "Not yet assessed") */
  message?: string;
  /** Show icon based on chart type */
  showIcon?: boolean;
  /** Diagnostic CTA: gamify data collection */
  diagnosticCta?: {
    label?: string;
    onClick: () => void;
  };
}

const chartIcons: Record<ChartType, React.ComponentType<{ className?: string }>> = {
  line: TrendingUp,
  bar: BarChart3,
  radar: Activity,
  area: TrendingUp,
  heatmap: Activity,
  generic: BarChart3,
};

const chartPlaceholders: Record<ChartType, React.ReactNode> = {
  line: (
    <svg viewBox="0 0 400 200" className="w-full h-full opacity-[0.06]">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid)" />
      <polyline
        points="20,150 80,120 140,140 200,80 260,100 320,60 380,90"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 400 200" className="w-full h-full opacity-[0.06]">
      <rect x="30" y="120" width="40" height="70" rx="4" fill="currentColor" opacity="0.4" />
      <rect x="90" y="80" width="40" height="110" rx="4" fill="currentColor" opacity="0.4" />
      <rect x="150" y="100" width="40" height="90" rx="4" fill="currentColor" opacity="0.4" />
      <rect x="210" y="60" width="40" height="130" rx="4" fill="currentColor" opacity="0.4" />
      <rect x="270" y="90" width="40" height="100" rx="4" fill="currentColor" opacity="0.4" />
      <rect x="330" y="110" width="40" height="80" rx="4" fill="currentColor" opacity="0.4" />
    </svg>
  ),
  radar: (
    <svg viewBox="0 0 200 200" className="w-full h-full opacity-[0.06]">
      <polygon
        points="100,20 173,60 173,140 100,180 27,140 27,60"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <polygon
        points="100,50 150,75 150,125 100,150 50,125 50,75"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <polygon
        points="100,65 138,88 125,135 100,145 75,120 62,88"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
      />
    </svg>
  ),
  area: (
    <svg viewBox="0 0 400 200" className="w-full h-full opacity-[0.06]">
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d="M 20 150 L 80 120 L 140 140 L 200 80 L 260 100 L 320 60 L 380 90 L 380 190 L 20 190 Z"
        fill="url(#areaGradient)"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
      />
    </svg>
  ),
  heatmap: (
    <svg viewBox="0 0 400 200" className="w-full h-full opacity-[0.06]">
      {Array.from({ length: 10 }).map((_, col) =>
        Array.from({ length: 5 }).map((_, row) => (
          <rect
            key={`${col}-${row}`}
            x={col * 40 + 5}
            y={row * 40 + 5}
            width="35"
            height="35"
            rx="4"
            fill="currentColor"
            // Deterministic pseudo-random opacity based on position.
            // Avoids Math.random() which produces different values each
            // module load — causing SSR/client mismatches and visual
            // inconsistency between navigations.
            opacity={(((col * 5 + row) * 37) % 91) / 182 + 0.1}
          />
        ))
      )}
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 400 200" className="w-full h-full opacity-[0.06]">
      <rect
        x="50"
        y="50"
        width="300"
        height="120"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <circle cx="200" cy="110" r="40" fill="currentColor" opacity="0.2" />
    </svg>
  ),
};

// React.memo: EmptyChartState is a pure display component. Memoizing it
// prevents dashboard panels from re-rendering the placeholder SVG every
// time an unrelated parent state change occurs.
export const EmptyChartState: React.FC<EmptyChartStateProps> = React.memo(({
  chartType = 'generic',
  height = 320,
  message = 'Not yet assessed',
  showIcon = true,
  diagnosticCta,
}) => {
  const Icon = chartIcons[chartType];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-[var(--color-text-muted)]"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* Chart placeholder outline */}
      <div className="relative w-full h-full flex items-center justify-center">
        {chartPlaceholders[chartType]}

        {/* Centered content overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
          {showIcon && (
            <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
              <Icon className="w-8 h-8 opacity-30" />
            </div>
          )}
          <p className="text-sm font-medium opacity-60 text-center">{message}</p>
          {diagnosticCta && (
            <button
              type="button"
              onClick={diagnosticCta.onClick}
              className="mt-1 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {diagnosticCta.label ?? DIAGNOSTIC_CTA_LABEL}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
EmptyChartState.displayName = 'EmptyChartState';

/**
 * Specific empty state variants for common use cases.
 * Default to "Not yet assessed" and support diagnostic CTA.
 */

export const EmptyLineChart: React.FC<{
  message?: string;
  height?: number;
  diagnosticCta?: { label?: string; onClick: () => void };
}> = ({ message = 'Not yet assessed', height, diagnosticCta }) => (
  <EmptyChartState
    chartType="line"
    message={message}
    height={height}
    diagnosticCta={diagnosticCta}
  />
);

export const EmptyBarChart: React.FC<{
  message?: string;
  height?: number;
  diagnosticCta?: { label?: string; onClick: () => void };
}> = ({ message = 'Not yet assessed', height, diagnosticCta }) => (
  <EmptyChartState
    chartType="bar"
    message={message}
    height={height}
    diagnosticCta={diagnosticCta}
  />
);

export const EmptyRadarChart: React.FC<{
  message?: string;
  height?: number;
  diagnosticCta?: { label?: string; onClick: () => void };
}> = ({ message = 'Not yet assessed', height, diagnosticCta }) => (
  <EmptyChartState
    chartType="radar"
    message={message}
    height={height}
    diagnosticCta={diagnosticCta}
  />
);

export const EmptyHeatmap: React.FC<{
  message?: string;
  height?: number;
  diagnosticCta?: { label?: string; onClick: () => void };
}> = ({ message = 'Not yet assessed', height, diagnosticCta }) => (
  <EmptyChartState
    chartType="heatmap"
    message={message}
    height={height}
    diagnosticCta={diagnosticCta}
  />
);

export default EmptyChartState;
