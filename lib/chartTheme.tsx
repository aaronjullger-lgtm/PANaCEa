import React from 'react';

/**
 * Recharts Theme Configuration
 *
 * Centralized styling for all Recharts components using CSS variables.
 * Ensures consistent theming across light/dark modes.
 */

export const chartTheme = {
  /**
   * Grid styling for CartesianGrid components
   */
  grid: {
    stroke: 'var(--color-border-light)', // Lighter than border - reduces visual vibration
    strokeDasharray: '3 3',
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
   * Chart colors - semantic color palette
   */
  colors: {
    primary: 'var(--color-accent)',
    secondary: 'var(--color-accent-secondary)',
    success: 'var(--color-data-pass)',
    warning: 'var(--color-data-provisional)',
    error: 'var(--color-data-fail)',
    info: 'var(--color-accent)',
    neutral: 'var(--color-text-muted)',
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

export default chartTheme;
