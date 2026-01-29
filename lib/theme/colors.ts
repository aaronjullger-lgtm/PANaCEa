/**
 * Centralized Color System
 *
 * Provides a consistent color palette across the application.
 * Uses CSS custom properties that adapt to light/dark mode.
 */

/**
 * Theme color categories following Tailwind naming conventions
 */
const baseThemeSet = {
  bg: 'bg-[var(--color-bg-secondary)]',
  text: 'text-[var(--color-text-primary)]',
  border: 'border-[var(--color-border)]',
  hover: 'hover:bg-[var(--color-bg-tertiary)]',
  accent: 'bg-[var(--color-accent)]',
} as const;

export const themeColors = {
  // Primary brand colors
  stone: { ...baseThemeSet },

  // System colors for body systems
  rose: { ...baseThemeSet },
  pink: { ...baseThemeSet },
  slate: { ...baseThemeSet },
  emerald: { ...baseThemeSet },
  amber: { ...baseThemeSet },
  blue: { ...baseThemeSet },
  teal: { ...baseThemeSet },
  violet: { ...baseThemeSet },
  cyan: { ...baseThemeSet },
  purple: { ...baseThemeSet },
  red: { ...baseThemeSet },
};

/**
 * Semantic color system using CSS custom properties
 * These adapt automatically to light/dark mode
 */
export const semanticColors = {
  // Background colors
  bgPrimary: 'var(--color-bg-primary)',
  bgSecondary: 'var(--color-bg-secondary)',
  bgTertiary: 'var(--color-bg-tertiary)',

  // Text colors
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',

  // Border colors
  border: 'var(--color-border)',
  borderLight: 'var(--color-border-light)',

  // Interactive colors
  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',

  // Status colors
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',

  // Card and glass effects
  cardBg: 'var(--color-card-bg)',
  glassBg: 'var(--color-glass-bg)',
  overlay: 'var(--color-overlay)',
};

/**
 * Get theme color classes based on theme name
 */
export function getThemeColors(theme: keyof typeof themeColors) {
  return themeColors[theme] || themeColors.slate;
}

/**
 * Status color mappings for feedback UI
 */
export const statusColors = {
  success: {
    bg: 'bg-[var(--color-data-pass)]/10',
    text: 'text-[var(--color-data-pass)]',
    border: 'border-[var(--color-data-pass)]/30',
    icon: 'text-[var(--color-data-pass)]',
  },
  error: {
    bg: 'bg-[var(--color-data-fail)]/10',
    text: 'text-[var(--color-data-fail)]',
    border: 'border-[var(--color-data-fail)]/30',
    icon: 'text-[var(--color-data-fail)]',
  },
  warning: {
    bg: 'bg-[var(--color-data-provisional)]/10',
    text: 'text-[var(--color-data-provisional)]',
    border: 'border-[var(--color-data-provisional)]/30',
    icon: 'text-[var(--color-data-provisional)]',
  },
  info: {
    bg: 'bg-[var(--color-accent)]/10',
    text: 'text-[var(--color-accent)]',
    border: 'border-[var(--color-accent)]/30',
    icon: 'text-[var(--color-accent)]',
  },
  neutral: {
    bg: 'bg-[var(--color-bg-tertiary)]/60',
    text: 'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-border)]',
    icon: 'text-[var(--color-text-muted)]',
  },
};

/**
 * Get status color classes
 */
export function getStatusColors(status: keyof typeof statusColors) {
  return statusColors[status] || statusColors.neutral;
}

/**
 * Generate gradient classes for visual appeal
 */
export const gradients = {
  primary: 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]',
  success: 'bg-gradient-to-br from-[var(--color-data-pass)] to-[var(--color-data-pass)]',
  warning: 'bg-gradient-to-br from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  error: 'bg-gradient-to-br from-[var(--color-data-fail)] to-[var(--color-data-fail)]',
  info: 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]',
  subtle:
    'bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]',
};

/**
 * Utility to combine Tailwind classes safely
 * Removes duplicates and handles conflicts
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
