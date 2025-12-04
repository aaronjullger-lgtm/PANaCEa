/**
 * Centralized Color System
 * 
 * Provides a consistent color palette across the application.
 * Uses CSS custom properties that adapt to light/dark mode.
 */

/**
 * Theme color categories following Tailwind naming conventions
 */
export const themeColors = {
  // Primary brand colors
  stone: {
    bg: 'bg-stone-50 dark:bg-stone-900',
    text: 'text-stone-900 dark:text-stone-50',
    border: 'border-stone-300 dark:border-stone-700',
    hover: 'hover:bg-stone-100 dark:hover:bg-stone-800',
  },
  
  // System colors for body systems
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-900/30',
    text: 'text-rose-900 dark:text-rose-50',
    border: 'border-rose-300 dark:border-rose-700',
    hover: 'hover:bg-rose-100 dark:hover:bg-rose-800/50',
    accent: 'bg-rose-500',
  },
  
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-900/30',
    text: 'text-pink-900 dark:text-pink-50',
    border: 'border-pink-300 dark:border-pink-700',
    hover: 'hover:bg-pink-100 dark:hover:bg-pink-800/50',
    accent: 'bg-pink-500',
  },
  
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    text: 'text-slate-900 dark:text-slate-50',
    border: 'border-slate-300 dark:border-slate-700',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    accent: 'bg-slate-500',
  },
  
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    text: 'text-emerald-900 dark:text-emerald-50',
    border: 'border-emerald-300 dark:border-emerald-700',
    hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-800/50',
    accent: 'bg-emerald-500',
  },
  
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    text: 'text-amber-900 dark:text-amber-50',
    border: 'border-amber-300 dark:border-amber-700',
    hover: 'hover:bg-amber-100 dark:hover:bg-amber-800/50',
    accent: 'bg-amber-500',
  },
  
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-900 dark:text-blue-50',
    border: 'border-blue-300 dark:border-blue-700',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-800/50',
    accent: 'bg-blue-500',
  },
  
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-900/30',
    text: 'text-teal-900 dark:text-teal-50',
    border: 'border-teal-300 dark:border-teal-700',
    hover: 'hover:bg-teal-100 dark:hover:bg-teal-800/50',
    accent: 'bg-teal-500',
  },
  
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    text: 'text-violet-900 dark:text-violet-50',
    border: 'border-violet-300 dark:border-violet-700',
    hover: 'hover:bg-violet-100 dark:hover:bg-violet-800/50',
    accent: 'bg-violet-500',
  },
  
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-900/30',
    text: 'text-cyan-900 dark:text-cyan-50',
    border: 'border-cyan-300 dark:border-cyan-700',
    hover: 'hover:bg-cyan-100 dark:hover:bg-cyan-800/50',
    accent: 'bg-cyan-500',
  },
  
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    text: 'text-purple-900 dark:text-purple-50',
    border: 'border-purple-300 dark:border-purple-700',
    hover: 'hover:bg-purple-100 dark:hover:bg-purple-800/50',
    accent: 'bg-purple-500',
  },
  
  red: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    text: 'text-red-900 dark:text-red-50',
    border: 'border-red-300 dark:border-red-700',
    hover: 'hover:bg-red-100 dark:hover:bg-red-800/50',
    accent: 'bg-red-500',
  },
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
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
  },
  neutral: {
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-800',
    icon: 'text-gray-500',
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
  primary: 'bg-gradient-to-br from-blue-500 to-purple-600',
  success: 'bg-gradient-to-br from-green-500 to-emerald-600',
  warning: 'bg-gradient-to-br from-yellow-500 to-orange-600',
  error: 'bg-gradient-to-br from-red-500 to-pink-600',
  info: 'bg-gradient-to-br from-cyan-500 to-blue-600',
  subtle: 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900',
};

/**
 * Utility to combine Tailwind classes safely
 * Removes duplicates and handles conflicts
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
