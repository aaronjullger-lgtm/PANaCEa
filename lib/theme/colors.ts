/**
 * Centralized Color System — LEGACY SHIM.
 *
 * The canonical color tokens live in `@/lib/tokens` (see `lib/tokens/colors.ts`).
 * This file is kept for backward compatibility and re-exports the relevant
 * bundles. New code should import from `@/lib/tokens` directly.
 */

import { statusColors as canonicalStatusColors, getStatusColors as canonicalGetStatusColors } from '@/lib/tokens';

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
  background: 'var(--color-background)',
  surface: 'var(--color-surface)',
  surfaceElevated: 'var(--color-surface-elevated)',

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
  risk: 'var(--color-risk)',
  danger: 'var(--color-danger)',
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
 * Re-exported from the canonical tokens module.
 */
export const statusColors = canonicalStatusColors;

/**
 * Get status color classes
 */
export const getStatusColors = canonicalGetStatusColors;

/**
 * Generate gradient classes for visual appeal
 */
export const gradients = {
  primary: 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]',
  success: 'bg-gradient-to-br from-[var(--color-data-pass)] to-[var(--color-data-pass)]',
  warning:
    'bg-gradient-to-br from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  error: 'bg-gradient-to-br from-[var(--color-data-fail)] to-[var(--color-data-fail)]',
  info: 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]',
  subtle: 'bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]',
};

// cn() utility has been consolidated to @/lib/utils (uses clsx + tailwind-merge).
// Import from there instead: import { cn } from '@/lib/utils';
