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
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#3b82f6',
  strokeWidth = 2,
  showDots = false,
  fillArea = false,
  min: minProp,
  max: maxProp,
  className = '',
  showLastValue = false,
  formatValue = (v) => v.toFixed(1),
}: SparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Calculate min and max if not provided
  const min = minProp !== undefined ? minProp : Math.min(...data);
  const max = maxProp !== undefined ? maxProp : Math.max(...data);
  
  // Prevent division by zero
  const range = max - min || 1;

  // Calculate points
  const padding = strokeWidth;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value };
  });

  // Generate SVG path
  const pathData = points.map((point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${command} ${point.x},${point.y}`;
  }).join(' ');

  // Generate area path if needed
  const areaPathData = fillArea
    ? `${pathData} L ${points[points.length - 1].x},${height - padding} L ${padding},${height - padding} Z`
    : '';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="sparkline">
        {/* Fill area under the line */}
        {fillArea && (
          <path
            d={areaPathData}
            fill={color}
            fillOpacity={0.1}
          />
        )}
        
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Dots at data points */}
        {showDots && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={strokeWidth}
            fill={color}
          />
        ))}
        
        {/* Highlight last point */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={strokeWidth * 1.5}
            fill={color}
            opacity={0.8}
          />
        )}
      </svg>
      
      {/* Last value label */}
      {showLastValue && data.length > 0 && (
        <span className="text-sm font-medium" style={{ color }}>
          {formatValue(data[data.length - 1])}
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
}

export function SparklineBar({
  data,
  width = 100,
  height = 30,
  color = '#3b82f6',
  min: minProp,
  max: maxProp,
  className = '',
  barGap = 1,
}: SparklineBarProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const min = minProp !== undefined ? minProp : 0;
  const max = maxProp !== undefined ? maxProp : Math.max(...data);
  const range = max - min || 1;

  const barWidth = (width - (data.length - 1) * barGap) / data.length;

  return (
    <svg width={width} height={height} className={`sparkline-bar ${className}`}>
      {data.map((value, index) => {
        const barHeight = ((value - min) / range) * height;
        const x = index * (barWidth + barGap);
        const y = height - barHeight;
        
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            rx={1}
          />
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

  const color = isNeutral ? 'text-slate-500' : isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓';

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color} ${className}`}>
      <span>{arrow}</span>
      <span>{formatValue(current)}</span>
      {showPercentage && !isNeutral && (
        <span className="text-xs">
          ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}
