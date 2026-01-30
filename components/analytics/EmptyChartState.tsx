/**
 * EmptyChartState Component
 *
 * Unified empty state pattern for all charts across the application.
 * Displays a consistent visual metaphor (faint gray placeholder outline)
 * rather than mixing text, icons, and other patterns.
 *
 * Part of Phase 3 Visualization Improvements - "No Data" Consistency
 */

import React from 'react';
import { Activity, BarChart3, Brain, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export type ChartType = 'line' | 'bar' | 'radar' | 'area' | 'heatmap' | 'generic';

interface EmptyChartStateProps {
  /** Type of chart to display placeholder for */
  chartType?: ChartType;
  /** Height of the empty state container */
  height?: number | string;
  /** Custom message to display */
  message?: string;
  /** Show icon based on chart type */
  showIcon?: boolean;
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
            opacity={Math.random() * 0.5 + 0.1}
          />
        ))
      )}
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 400 200" className="w-full h-full opacity-[0.06]">
      <rect x="50" y="50" width="300" height="120" rx="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <circle cx="200" cy="110" r="40" fill="currentColor" opacity="0.2" />
    </svg>
  ),
};

export const EmptyChartState: React.FC<EmptyChartStateProps> = ({
  chartType = 'generic',
  height = 320,
  message = 'No data available yet',
  showIcon = true,
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {showIcon && (
            <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
              <Icon className="w-8 h-8 opacity-30" />
            </div>
          )}
          <p className="text-sm font-medium opacity-60">{message}</p>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Specific empty state variants for common use cases
 */

export const EmptyLineChart: React.FC<{ message?: string; height?: number }> = ({ 
  message = 'Complete questions to see performance trends', 
  height 
}) => (
  <EmptyChartState chartType="line" message={message} height={height} />
);

export const EmptyBarChart: React.FC<{ message?: string; height?: number }> = ({ 
  message = 'Data will appear once you start reviewing', 
  height 
}) => (
  <EmptyChartState chartType="bar" message={message} height={height} />
);

export const EmptyRadarChart: React.FC<{ message?: string; height?: number }> = ({ 
  message = 'Complete questions across multiple systems', 
  height 
}) => (
  <EmptyChartState chartType="radar" message={message} height={height} />
);

export const EmptyHeatmap: React.FC<{ message?: string; height?: number }> = ({ 
  message = 'Your activity will appear here', 
  height 
}) => (
  <EmptyChartState chartType="heatmap" message={message} height={height} />
);

export default EmptyChartState;
