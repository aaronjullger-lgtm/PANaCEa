/**
 * Semantic Color Mapping Utility
 * 
 * This utility provides mappings from raw Tailwind colors to semantic design tokens
 * to help enforce the "Glass & Gradient" design system.
 * 
 * @see docs/DESIGN_SYSTEM.md for full design system documentation
 */

// ============================================
// SEMANTIC COLOR TOKENS (CSS Variables)
// ============================================

/**
 * Semantic color tokens using CSS variables for theme-aware colors.
 * These automatically adapt to light/dark mode.
 */
export const SEMANTIC_TOKENS = {
  // Surface colors
  surface: {
    primary: 'var(--color-bg-primary)', // Main background
    secondary: 'var(--color-bg-secondary)', // Card backgrounds
    tertiary: 'var(--color-bg-tertiary)', // Subtle backgrounds
  },
  
  // Text colors
  text: {
    primary: 'var(--color-text-primary)', // Main text
    secondary: 'var(--color-text-secondary)', // Subdued text
    muted: 'var(--color-text-muted)', // Very subtle text
  },
  
  // Border colors
  border: {
    default: 'var(--color-border)', // Standard borders
  },
  
  // Action colors
  action: {
    primary: 'var(--color-accent)', // Primary action color
    hover: 'var(--color-accent-hover)', // Hover state
  },
} as const;

// ============================================
// STANDARD GRADIENT COLORS
// ============================================

/**
 * Standard Tailwind gradient colors for buttons (per DESIGN_SYSTEM.md).
 * These use standard Tailwind color names, not custom tokens.
 */
export const GRADIENT_COLORS = {
  primary: {
    from: 'from-blue-600',
    to: 'to-indigo-600',
    hoverFrom: 'hover:from-blue-700',
    hoverTo: 'hover:to-indigo-700',
  },
  success: {
    from: 'from-emerald-500',
    to: 'to-green-600',
    hoverFrom: 'hover:from-emerald-600',
    hoverTo: 'hover:to-green-700',
  },
  warning: {
    from: 'from-amber-500',
    to: 'to-orange-500',
    hoverFrom: 'hover:from-amber-600',
    hoverTo: 'hover:to-orange-600',
  },
  danger: {
    from: 'from-red-500',
    to: 'to-rose-600',
    hoverFrom: 'hover:from-red-600',
    hoverTo: 'hover:to-rose-700',
  },
} as const;

// ============================================
// COLOR MIGRATION MAPPINGS
// ============================================

/**
 * Migration guide from raw Tailwind colors to semantic tokens.
 * Use this to find the correct semantic replacement for raw color classes.
 */
export const COLOR_MIGRATION_MAP = {
  // Background colors
  'bg-white': 'bg-[var(--color-bg-primary)]',
  'bg-slate-50': 'bg-[var(--color-bg-primary)]',
  'bg-slate-100': 'bg-[var(--color-bg-secondary)]',
  'bg-slate-200': 'bg-[var(--color-bg-secondary)]',
  'bg-slate-800': 'bg-[var(--color-bg-secondary)]',
  'bg-slate-900': 'bg-[var(--color-bg-primary)]',
  
  // Text colors
  'text-slate-900': 'text-[var(--color-text-primary)]',
  'text-slate-800': 'text-[var(--color-text-primary)]',
  'text-slate-700': 'text-[var(--color-text-secondary)]',
  'text-slate-600': 'text-[var(--color-text-secondary)]',
  'text-slate-500': 'text-[var(--color-text-muted)]',
  'text-slate-400': 'text-[var(--color-text-muted)]',
  'text-white': 'text-[var(--color-text-primary)]',
  
  // Border colors
  'border-slate-200': 'border-[var(--color-border)]',
  'border-slate-300': 'border-[var(--color-border)]',
  'border-slate-700': 'border-[var(--color-border)]',
  
  // Action/accent colors
  'text-blue-600': 'text-[var(--color-accent)]',
  'text-blue-500': 'text-[var(--color-accent)]',
  'bg-blue-600': 'bg-[var(--color-accent)]',
  'border-blue-500': 'border-[var(--color-accent)]',
} as const;

// ============================================
// CONTEXTUAL COLOR HELPERS
// ============================================

/**
 * Get the appropriate text color based on context
 */
export function getTextColor(context: 'primary' | 'secondary' | 'muted'): string {
  return SEMANTIC_TOKENS.text[context];
}

/**
 * Get the appropriate background color based on context
 */
export function getSurfaceColor(context: 'primary' | 'secondary' | 'tertiary'): string {
  return SEMANTIC_TOKENS.surface[context];
}

/**
 * Get gradient classes for a button variant
 */
export function getGradientClasses(variant: 'primary' | 'success' | 'warning' | 'danger'): string {
  const colors = GRADIENT_COLORS[variant];
  return `bg-gradient-to-r ${colors.from} ${colors.to} ${colors.hoverFrom} ${colors.hoverTo}`;
}

// ============================================
// VALIDATION & LINTING HELPERS
// ============================================

/**
 * List of forbidden raw color classes that should be replaced with semantic tokens.
 * Used for linting and validation.
 */
export const FORBIDDEN_RAW_COLORS = [
  // Blue variants (use semantic tokens or standard gradients instead)
  'bg-blue-500', 'bg-blue-600', 'bg-blue-700',
  'text-blue-500', 'text-blue-600', 'text-blue-700',
  'border-blue-500', 'border-blue-600',
  
  // Orange variants (use amber-orange gradients for warnings)
  'bg-orange-500', 'bg-orange-600',
  'text-orange-500', 'text-orange-600',
  
  // Indigo variants (use in gradients only, not as solid colors)
  'bg-indigo-500', 'bg-indigo-600',
  'text-indigo-500', 'text-indigo-600',
  
  // Green variants (use emerald-green gradients for success)
  'bg-green-500', 'bg-green-600',
  'text-green-500', 'text-green-600',
  
  // Red/Rose variants (use red-rose gradients for danger)
  'bg-red-500', 'bg-red-600',
  'text-red-500', 'text-red-600',
  
  // Slate variants (use semantic tokens)
  'bg-slate-100', 'bg-slate-200', 'bg-slate-800', 'bg-slate-900',
  'text-slate-500', 'text-slate-600', 'text-slate-700', 'text-slate-900',
] as const;

/**
 * Check if a class string contains forbidden raw colors
 */
export function containsForbiddenColors(classString: string): boolean {
  return FORBIDDEN_RAW_COLORS.some(color => classString.includes(color));
}

/**
 * Suggest semantic replacements for raw color classes
 */
export function suggestSemanticReplacement(rawColor: string): string | null {
  return COLOR_MIGRATION_MAP[rawColor as keyof typeof COLOR_MIGRATION_MAP] ?? null;
}

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * Example usage:
 * 
 * // ❌ BEFORE (Raw Tailwind colors)
 * <div className="bg-slate-100 text-slate-900 border-slate-200">
 * 
 * // ✅ AFTER (Semantic tokens)
 * <div className={`${getSurfaceColor('secondary')} ${getTextColor('primary')} border-[var(--color-border)]`}>
 * 
 * // OR using inline styles:
 * <div className="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]">
 * 
 * // For gradients:
 * <button className={getGradientClasses('primary')}>Click me</button>
 * 
 * // Validation:
 * const classes = "bg-blue-500 text-white";
 * if (containsForbiddenColors(classes)) {
 *   console.warn("Raw colors detected! Use semantic tokens instead.");
 * }
 */
