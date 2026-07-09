/**
 * Sparkline - Lightweight SVG sparkline component
 *
 * A minimalist line chart for visualizing trends inline.
 * Perfect for lab values, performance metrics, etc.
 */

import React from 'react';

export interface SparklineProps {
  /** Array of numeric values to plot */
  data: number[];
  /** Width of the sparkline in pixels */
  width?: number;
  /** Height of the sparkline in pixels */
  height?: number;
  /** Color of the line */
  color?: string;
  /** Thickness of the line */
  strokeWidth?: number;
  /** Whether to show dots at data points */
  showDots?: boolean;
  /** Whether to fill area under the line */
  fillArea?: boolean;
  /** Minimum value for Y-axis (auto-calculated if not provided) */
  min?: number;
  /** Maximum value for Y-axis (auto-calculated if not provided) */
  max?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the last value as a label */
  showLastValue?: boolean;
  /** Format function for the last value label */
  formatValue?: (value: number) => string;
  /** Optional reference range to shade normal limits */
  referenceRange?: [number, number];
  /** Accessible text alternative for the chart (WCAG 1.1.1). Auto-summarized if omitted. */
  ariaLabel?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color,
  strokeWidth = 2,
  showDots = false,
  fillArea = true,
  min: minProp,
  max: maxProp,
  className = '',
  showLastValue = false,
  formatValue = (v) => v.toFixed(1),
  referenceRange,
  ariaLabel,
}: SparklineProps) {
  // Defensive: sanitize data - filter out NaN, Infinity, and convert all values to numbers
  const sanitizedData = (data ?? []).map((v) => Number(v)).filter((v) => Number.isFinite(v));

  // Return loading skeleton if no valid data
  if (sanitizedData.length === 0) {
    return (
      <div className={`inline-flex items-center ${className}`} style={{ width, height }}>
        <div className="w-full h-full bg-data-neutral rounded animate-pulse" />
      </div>
    );
  }

  // Calculate min and max if not provided
  const min = minProp !== undefined ? minProp : Math.min(...sanitizedData);
  const max = maxProp !== undefined ? maxProp : Math.max(...sanitizedData);

  // Prevent division by zero
  const range = max - min || 1;

  // Calculate points
  const padding = strokeWidth;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = sanitizedData.map((value, index) => {
    const x = padding + (index / (sanitizedData.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    // Defensive: clamp values to prevent SVG rendering issues
    return {
      x: Number.isFinite(x) ? x : padding,
      y: Number.isFinite(y) ? y : padding,
      value,
    };
  });

  // Generate SVG path
  const buildSmoothPath = () => {
    if (points.length === 0) return '';
    const firstPoint = points[0];
    if (!firstPoint) return '';
    if (points.length === 1) {
      return `M ${firstPoint.x},${firstPoint.y}`;
    }

    const d: string[] = [`M ${firstPoint.x},${firstPoint.y}`];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
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

  const pathData = buildSmoothPath();

  // Generate area path if needed
  const lastPoint = points[points.length - 1];
  const areaPathData =
    fillArea && lastPoint
      ? `${pathData} L ${lastPoint.x},${height - padding} L ${padding},${height - padding} Z`
      : '';

  const lastValue = sanitizedData[sanitizedData.length - 1] ?? 0;
  const chartAriaLabel =
    ariaLabel ?? `Trend sparkline, ${sanitizedData.length} points, latest ${formatValue(lastValue)}`;
  const inRange = referenceRange
    ? lastValue >= referenceRange[0] && lastValue <= referenceRange[1]
    : true;
  // Use design system colors: data-pass (teal) and data-fail (red)
  const semanticColorClass = inRange ? 'text-data-pass' : 'text-data-fail';
  /* Brand-safe: use accent when no color passed (SVG stroke accepts var() in browser) */
  const effectiveColor = color ?? 'var(--color-accent)';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="sparkline" role="img" aria-label={chartAriaLabel}>
        {referenceRange && (
          <rect
            x={padding}
            width={chartWidth}
            y={padding + chartHeight - ((referenceRange[1] - min) / range) * chartHeight}
            height={((referenceRange[1] - referenceRange[0]) / range) * chartHeight}
            fill="var(--color-data-pass)"
            fillOpacity={0.08}
            rx={2}
          />
        )}

        {/* Fill area under the line */}
        {fillArea && <path d={areaPathData} fill={effectiveColor} fillOpacity={0.1} />}

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots at data points */}
        {showDots &&
          points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={strokeWidth} fill={effectiveColor} />
          ))}

        {/* Highlight last point */}
        {points.length > 0 && lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={strokeWidth * 1.5}
            fill={effectiveColor}
            opacity={0.8}
          />
        )}
      </svg>

      {/* Last value label */}
      {showLastValue && sanitizedData.length > 0 && (
        <span
          className={`text-sm font-medium ${semanticColorClass}`}
          style={{ color: effectiveColor }}
        >
          {formatValue(lastValue)}
        </span>
      )}
    </div>
  );
}

/**
 * SparklineBar - Simple bar chart sparkline
 */
export interface SparklineBarProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  min?: number;
  max?: number;
  className?: string;
  barGap?: number;
  /** Accessible text alternative for the chart (WCAG 1.1.1). Auto-summarized if omitted. */
  ariaLabel?: string;
}

export function SparklineBar({
  data,
  width = 100,
  height = 30,
  color = 'var(--color-accent)',
  min: minProp,
  max: maxProp,
  className = '',
  barGap = 1,
  ariaLabel,
}: SparklineBarProps) {
  // Defensive: sanitize data - filter out NaN, Infinity, and convert all values to numbers
  const sanitizedData = (data ?? []).map((v) => Number(v)).filter((v) => Number.isFinite(v));

  if (sanitizedData.length === 0) {
    return (
      <div className={`sparkline-bar ${className}`} style={{ width, height }}>
        <div className="w-full h-full bg-data-neutral rounded animate-pulse" />
      </div>
    );
  }

  const min = minProp !== undefined ? minProp : 0;
  const max = maxProp !== undefined ? maxProp : Math.max(...sanitizedData);
  const range = max - min || 1;

  const barWidth = (width - (sanitizedData.length - 1) * barGap) / sanitizedData.length;

  return (
    <svg
      width={width}
      height={height}
      className={`sparkline-bar ${className}`}
      role="img"
      aria-label={ariaLabel ?? `Bar sparkline, ${sanitizedData.length} bars`}
    >
      {sanitizedData.map((value, index) => {
        const barHeight = Math.max(0, ((value - min) / range) * height);
        const x = index * (barWidth + barGap);
        const y = height - barHeight;

        // Defensive: ensure all values are finite
        if (!Number.isFinite(barHeight) || !Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return (
          <rect key={index} x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={1} />
        );
      })}
    </svg>
  );
}

/**
 * TrendIndicator - Shows trend direction with color coding
 */
export interface TrendIndicatorProps {
  current: number;
  previous: number;
  formatValue?: (value: number) => string;
  showPercentage?: boolean;
  className?: string;
}

export function TrendIndicator({
  current,
  previous,
  formatValue = (v) => v.toFixed(1),
  showPercentage = true,
  className = '',
}: TrendIndicatorProps) {
  const change = current - previous;
  const percentChange = previous !== 0 ? (change / previous) * 100 : 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  const color = isNeutral
    ? 'text-data-neutral'
    : isPositive
      ? 'text-data-pass'
      : 'text-data-fail';
  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓';

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color} ${className}`}>
      <span>{arrow}</span>
      <span>{formatValue(current)}</span>
      {showPercentage && !isNeutral && (
        <span className="text-xs">
          ({percentChange > 0 ? '+' : ''}
          {percentChange.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}
