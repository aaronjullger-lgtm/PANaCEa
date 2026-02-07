/**
 * TrendSparkline Component
 *
 * Small sparkline chart showing performance trends over recent sessions.
 * Designed for embedding in stat cards to show "Recent Form" visually.
 */

import React, { useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TrendSparklineProps {
  /** Array of numeric values (e.g., accuracy percentages) */
  data: number[];
  /** Width of the sparkline in pixels */
  width?: number;
  /** Height of the sparkline in pixels */
  height?: number;
  /** Color scheme: auto, clinical (green/teal only), success, warning, danger */
  colorScheme?: 'auto' | 'clinical' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Show trend indicator icon */
  showTrend?: boolean;
  /** Show the latest value as text */
  showValue?: boolean;
  /** Label text */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

const COLOR_SCHEMES = {
  success: {
    line: '#10b981',
    gradient: 'rgba(16, 185, 129, 0.2)',
    text: 'text-emerald-500',
  },
  /** Clinical: teal/green for success; avoids red/yellow (medical alarm semantics) */
  clinical: {
    line: '#14b8a6',
    gradient: 'rgba(20, 184, 166, 0.2)',
    text: 'text-teal-500',
  },
  warning: {
    line: '#0d9488',
    gradient: 'rgba(13, 148, 136, 0.2)',
    text: 'text-teal-600',
  },
  danger: {
    line: '#ef4444',
    gradient: 'rgba(239, 68, 68, 0.2)',
    text: 'text-red-500',
  },
  neutral: {
    line: '#6b7280',
    gradient: 'rgba(107, 114, 128, 0.2)',
    text: 'text-[var(--color-text-muted)]',
  },
};

export const TrendSparkline: React.FC<TrendSparklineProps> = ({
  data,
  width = 120,
  height = 40,
  colorScheme = 'auto',
  showTrend = true,
  showValue = true,
  label,
  className = '',
  ariaLabel,
}) => {
  const uniqueId = useId();
  const gradientId = `sparkline-gradient-${uniqueId}`;

  const { pathD, fillPathD, trend, colors, latestValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        pathD: '',
        fillPathD: '',
        trend: 'stable' as const,
        colors: COLOR_SCHEMES.neutral,
        latestValue: 0,
      };
    }

    // Calculate min and max for scaling
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Prevent division by zero

    // Calculate points
    const padding = 4;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y, value };
    });

    // Generate smooth path using cubic bezier curves
    const buildPath = (points: { x: number; y: number }[]) => {
      if (points.length === 0) return '';
      const firstPoint = points[0];
      if (!firstPoint) return '';
      if (points.length === 1) return `M ${firstPoint.x},${firstPoint.y}`;

      const d: string[] = [`M ${firstPoint.x},${firstPoint.y}`];

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        // Skip if required points are missing
        if (!p1 || !p2) continue;

        const p0 = points[i - 1] ?? p1;
        const p3 = points[i + 2] ?? p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
      }

      return d.join(' ');
    };

    const pathD = buildPath(points);

    // Create filled area path
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const fillPathD =
      points.length > 0 && firstPoint && lastPoint
        ? `${pathD} L ${lastPoint.x},${height} L ${firstPoint.x},${height} Z`
        : '';

    // Calculate trend (compare last 3 points average to first 3 points average)
    const recentAvg = data.slice(-3).reduce((sum, v) => sum + v, 0) / Math.min(3, data.length);
    const earlyAvg = data.slice(0, 3).reduce((sum, v) => sum + v, 0) / Math.min(3, data.length);
    const diff = recentAvg - earlyAvg;
    const trend = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';

    // Determine color scheme (clinical: green/teal only; avoid red/yellow for success)
    let colors = COLOR_SCHEMES.neutral;
    if (colorScheme === 'clinical') {
      const avgValue = data.reduce((sum, v) => sum + v, 0) / data.length;
      if (avgValue >= 80) colors = COLOR_SCHEMES.clinical;
      else if (avgValue >= 60) colors = COLOR_SCHEMES.warning;
      else colors = COLOR_SCHEMES.neutral;
    } else if (colorScheme === 'auto') {
      const avgValue = data.reduce((sum, v) => sum + v, 0) / data.length;
      if (avgValue >= 80) colors = COLOR_SCHEMES.success;
      else if (avgValue >= 60) colors = COLOR_SCHEMES.warning;
      else colors = COLOR_SCHEMES.danger;
    } else {
      colors = COLOR_SCHEMES[colorScheme];
    }

    return {
      pathD,
      fillPathD,
      trend,
      colors,
      latestValue: data[data.length - 1] ?? 0,
    };
  }, [data, width, height, colorScheme]);

  if (!data || data.length === 0) {
    return (
      <div
        className={`inline-flex items-center gap-2 ${className}`}
        role="img"
        aria-label={ariaLabel || 'No trend data available'}
      >
        <div
          className="bg-[var(--color-bg-secondary)] rounded-md flex items-center justify-center border-2 border-dashed border-[var(--color-border-muted)]"
          style={{ width, height }}
        >
          <span className="text-xs text-[var(--color-text-muted)]">No trend data</span>
        </div>
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      role="img"
      aria-label={
        ariaLabel || `Performance trend: ${trend}, current value ${latestValue.toFixed(0)}%`
      }
    >
      {/* Sparkline SVG */}
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.line} stopOpacity="0.3" />
              <stop offset="100%" stopColor={colors.line} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Filled area */}
          <motion.path
            d={fillPathD}
            fill={`url(#${gradientId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Line path */}
          <motion.path
            d={pathD}
            fill="none"
            stroke={colors.line}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />

          {/* Endpoint dot */}
          <motion.circle
            cx={width - 4}
            cy={
              data.length > 0
                ? height -
                  4 -
                  ((latestValue - Math.min(...data)) /
                    (Math.max(...data) - Math.min(...data) || 1)) *
                    (height - 8)
                : height / 2
            }
            r={3}
            fill={colors.line}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          />
        </svg>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-0.5">
        {label && (
          <span className="text-xs text-[var(--color-text-muted)] font-medium">{label}</span>
        )}

        {showValue && (
          <div className="flex items-center gap-1.5">
            <span className={`text-lg font-bold ${colors.text}`}>{Math.round(latestValue)}%</span>

            {showTrend && (
              <TrendIcon
                className={`w-4 h-4 ${
                  trend === 'up'
                    ? 'text-teal-500'
                    : trend === 'down'
                      ? 'text-slate-500'
                      : 'text-[var(--color-text-muted)]'
                }`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact variant for inline display
 */
export const TrendSparklineCompact: React.FC<
  Omit<TrendSparklineProps, 'width' | 'height' | 'showValue'>
> = (props) => {
  return <TrendSparkline {...props} width={80} height={30} showValue={false} />;
};

export default TrendSparkline;
