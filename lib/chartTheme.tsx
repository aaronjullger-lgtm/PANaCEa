import React from 'react';

/**
 * Recharts Theme Configuration
 *
 * Centralized styling for all Recharts components using CSS variables.
 * Ensures consistent theming across light/dark modes.
 */

export const chartTheme = {
  /**
   * Grid styling for CartesianGrid components.
   * Faint blue-gray only; no vertical lines (or 10% opacity) to avoid X-axis label noise.
   */
  grid: {
    stroke: 'var(--chart-grid-stroke)',
    strokeDasharray: '3 3',
    vertical: false,
    horizontal: true,
  },

  /**
   * Axis styling for XAxis and YAxis components
   */
  axis: {
    tick: {
      fill: 'var(--color-text-muted)',
      fontSize: 11,
    },
    line: {
      stroke: 'var(--color-border)',
    },
    axisLine: {
      stroke: 'var(--color-border)',
    },
  },

  /**
   * Tooltip styling
   */
  tooltip: {
    contentStyle: {
      backgroundColor: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '0.75rem',
      padding: '0.75rem',
      boxShadow: '0 4px 6px -1px var(--color-shadow-soft)',
    },
    labelStyle: {
      color: 'var(--color-text-primary)',
      fontWeight: 600,
      marginBottom: '0.5rem',
    },
    itemStyle: {
      color: 'var(--color-text-muted)',
      fontSize: '0.875rem',
    },
  },

  /**
   * Legend styling
   */
  legend: {
    wrapperStyle: {
      paddingTop: '1rem',
    },
    iconType: 'circle' as const,
    textStyle: {
      fill: 'var(--color-text-muted)',
      fontSize: '0.875rem',
    },
  },

  /**
   * Axis label styling (for XAxis and YAxis label prop)
   */
  axisLabel: {
    style: {
      fill: 'var(--color-text-muted)',
      fontSize: 12,
      fontWeight: 500,
    },
    offset: -5,
  },

  /**
   * Chart colors - brand-safe palette derived from Dark Blue base (no generic blue/orange clash).
   * Bar 1: Base Blue, Bar 2: Hue -20deg + Lightness, Bar 3: Hue +20deg + Lightness.
   */
  colors: {
    primary: 'var(--color-accent)',
    secondary: 'var(--color-accent-secondary)',
    success: 'var(--color-data-pass)',
    warning: 'var(--color-data-provisional)',
    error: 'var(--color-data-fail)',
    info: 'var(--color-accent)',
    neutral: 'var(--color-text-muted)',
    /** Brand-safe bar sequence for multi-series (Recharts/Chart.js) (audit H4) */
    barSequence: [
      'var(--color-primary, var(--color-accent))',
      'var(--color-blue, var(--color-accent-secondary))',
      'var(--color-success, var(--color-data-pass))',
      'var(--color-gold, var(--color-data-provisional))',
      'var(--color-orange, var(--color-data-fail))',
      'var(--color-purple, var(--color-accent))',
    ],
  },

  /**
   * SVG-safe color tokens for custom SVG charts (DriftVectorChart, etc.)
   * These return CSS variable references usable in fill/stroke attributes.
   */
  svg: {
    primary: 'var(--color-accent)',
    danger: 'var(--color-data-fail)',
    dangerLight: 'var(--color-data-fail)',
    warning: 'var(--color-data-provisional)',
    success: 'var(--color-data-pass)',
    muted: 'var(--color-text-muted)',
    gridStroke: 'var(--chart-grid-stroke)',
    axisStroke: 'var(--color-border)',
    textPrimary: 'var(--color-text-primary)',
    textMuted: 'var(--color-text-muted)',
    // Semantic aliases for SVG chart components (audit M1)
    axis: 'var(--color-border)',
    grid: 'var(--chart-grid-stroke)',
    label: 'var(--color-text-muted)',
    positive: 'var(--color-data-pass)',
    negative: 'var(--color-data-fail)',
    neutral: 'var(--color-text-muted)',
    accent: 'var(--color-accent)',
  },

  /**
   * Gradient definitions for areas/bars
   */
  gradients: {
    primary: ['var(--color-accent)', 'var(--color-accent)'],
    success: ['var(--color-data-pass)', 'var(--color-data-pass)'],
    warning: ['var(--color-data-provisional)', 'var(--color-data-provisional)'],
    error: ['var(--color-data-fail)', 'var(--color-data-fail)'],
    accent: ['var(--color-accent)', 'var(--color-accent)'],
    performance: ['var(--color-accent)', 'var(--color-data-pass)'],
  },

  /**
   * Circular progress / radial chart standards
   * Ensures consistency across all donut/circular charts
   */
  radialProgress: {
    strokeWidth: 8,
    strokeLinecap: 'round' as const,
    animationDuration: 1, // seconds
  },
};

/**
 * Helper to create a linear gradient definition for Recharts
 * Usage: <defs>{createGradient('myGradient', chartTheme.gradients.primary)}</defs>
 *
 * Returns React.ReactElement that should be placed inside a <defs> tag in your chart
 */
export const createGradient = (id: string, colors: string[]): React.ReactElement => {
  const startColor = colors[0] ?? 'var(--color-accent)';
  const endColor = colors[1] ?? startColor;
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
      <stop offset="0%" stopColor={startColor} stopOpacity={0.8} />
      <stop offset="100%" stopColor={endColor} stopOpacity={0.2} />
    </linearGradient>
  );
};

/**
 * Responsive chart dimensions helper
 * Returns appropriate height based on container width
 */
export const getResponsiveHeight = (width: number): number => {
  if (width < 640) return 200; // Mobile
  if (width < 1024) return 250; // Tablet
  return 300; // Desktop
};

/**
 * Stability bucket color mapping — theme-aware.
 * Returns CSS variable-based fills for StabilityPyramid bars.
 */
export const stabilityBucketColor: Record<string, string> = {
  // Time-based keys (original)
  '<1d': 'var(--color-data-fail)',
  '1-3d': 'var(--color-data-provisional)',
  '3-7d': 'var(--color-data-provisional)',
  '7-21d': 'var(--color-accent)',
  '21d+': 'var(--color-data-pass)',
  // Semantic keys (audit M3) — aliases for readability
  new: 'var(--color-data-fail)',
  learning: 'var(--color-data-provisional)',
  young: 'var(--color-data-provisional)',
  mature: 'var(--color-accent)',
  mastered: 'var(--color-data-pass)',
};

/**
 * Get a theme-safe fill color for a stability bucket.
 * Falls back to accent if bucket is unrecognized.
 */
export function getStabilityColor(bucket: string): string {
  return stabilityBucketColor[bucket] ?? 'var(--color-accent)';
}

/**
 * Safe display formatter for chart tooltips/labels.
 * Returns '—' for NaN/Infinity/null/undefined.
 */
export function safeChartDisplay(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'number' && (!isFinite(value) || isNaN(value))) return fallback;
  return String(value);
}

/**
 * Safe numeric coercion for chart data values (audit M2).
 * Returns a finite number or the fallback — never NaN/Infinity.
 */
export function safeChartValue(value: number | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  return isFinite(value) ? value : fallback;
}

export default chartTheme;
