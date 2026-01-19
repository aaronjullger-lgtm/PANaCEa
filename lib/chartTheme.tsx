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
    stroke: 'var(--color-border)',
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
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
  },

  /**
   * Chart colors - semantic color palette
   */
  colors: {
    primary: 'var(--color-accent)',
    secondary: 'var(--color-accent-secondary)',
    success: '#10b981', // Emerald 500
    warning: '#f59e0b', // Amber 500
    error: '#ef4444', // Red 500
    info: '#3b82f6', // Blue 500
    neutral: '#64748b', // Slate 500
  },

  /**
   * Gradient definitions for areas/bars
   */
  gradients: {
    primary: ['#3b82f6', '#1e40af'], // Blue gradient
    success: ['#10b981', '#059669'], // Emerald gradient
    warning: ['#f59e0b', '#d97706'], // Amber gradient
    error: ['#ef4444', '#dc2626'], // Red gradient
    accent: ['#8b5cf6', '#7c3aed'], // Purple gradient
    performance: ['#3b82f6', '#10b981'], // Blue to emerald
  },
};

/**
 * Helper to create a linear gradient definition for Recharts
 * Usage: <defs>{createGradient('myGradient', chartTheme.gradients.primary)}</defs>
 *
 * Returns React.ReactElement that should be placed inside a <defs> tag in your chart
 */
export const createGradient = (id: string, colors: string[]): React.ReactElement => {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
      <stop offset="0%" stopColor={colors[0]} stopOpacity={0.8} />
      <stop offset="100%" stopColor={colors[1]} stopOpacity={0.2} />
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
