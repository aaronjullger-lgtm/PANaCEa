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
 * Standard gradient tokens for buttons (per DESIGN_SYSTEM.md).
 */
export const GRADIENT_COLORS = {
  primary: {
    from: 'from-[var(--color-accent)]',
    to: 'to-[var(--color-accent)]',
    hoverFrom: 'hover:from-[var(--color-accent)]/90',
    hoverTo: 'hover:to-[var(--color-accent)]/90',
  },
  success: {
    from: 'from-[var(--color-data-pass)]',
    to: 'to-[var(--color-data-pass)]',
    hoverFrom: 'hover:from-[var(--color-data-pass)]/90',
    hoverTo: 'hover:to-[var(--color-data-pass)]/90',
  },
  warning: {
    from: 'from-[var(--color-data-provisional)]',
    to: 'to-[var(--color-data-provisional)]',
    hoverFrom: 'hover:from-[var(--color-data-provisional)]/90',
    hoverTo: 'hover:to-[var(--color-data-provisional)]/90',
  },
  danger: {
    from: 'from-[var(--color-data-fail)]',
    to: 'to-[var(--color-data-fail)]',
    hoverFrom: 'hover:from-[var(--color-data-fail)]/90',
    hoverTo: 'hover:to-[var(--color-data-fail)]/90',
  },
} as const;

// ============================================
// COLOR MIGRATION MAPPINGS
// ============================================

/**
 * Migration guide from raw Tailwind colors to semantic tokens.
 * Use this to find the correct semantic replacement for raw color classes.
 */
const legacyKey = (prefix: 'bg' | 'text' | 'border', color: string, shade?: string) =>
  shade ? `${prefix}-${color}-${shade}` : `${prefix}-${color}`;

export const COLOR_MIGRATION_MAP = {
  // Background colors
  [legacyKey('bg', 'white')]: 'bg-[var(--color-bg-primary)]',
  [legacyKey('bg', 'slate', '50')]: 'bg-[var(--color-bg-primary)]',
  [legacyKey('bg', 'slate', '100')]: 'bg-[var(--color-bg-secondary)]',
  [legacyKey('bg', 'slate', '200')]: 'bg-[var(--color-bg-secondary)]',
  [legacyKey('bg', 'slate', '800')]: 'bg-[var(--color-bg-secondary)]',
  [legacyKey('bg', 'slate', '900')]: 'bg-[var(--color-bg-primary)]',

  // Text colors
  [legacyKey('text', 'slate', '900')]: 'text-[var(--color-text-primary)]',
  [legacyKey('text', 'slate', '800')]: 'text-[var(--color-text-primary)]',
  [legacyKey('text', 'slate', '700')]: 'text-[var(--color-text-secondary)]',
  [legacyKey('text', 'slate', '600')]: 'text-[var(--color-text-secondary)]',
  [legacyKey('text', 'slate', '500')]: 'text-[var(--color-text-muted)]',
  [legacyKey('text', 'slate', '400')]: 'text-[var(--color-text-muted)]',
  [legacyKey('text', 'white')]: 'text-[var(--color-text-primary)]',

  // Border colors
  [legacyKey('border', 'slate', '200')]: 'border-[var(--color-border)]',
  [legacyKey('border', 'slate', '300')]: 'border-[var(--color-border)]',
  [legacyKey('border', 'slate', '700')]: 'border-[var(--color-border)]',

  // Action/accent colors
  [legacyKey('text', 'blue', '600')]: 'text-[var(--color-accent)]',
  [legacyKey('text', 'blue', '500')]: 'text-[var(--color-accent)]',
  [legacyKey('bg', 'blue', '600')]: 'bg-[var(--color-accent)]',
  [legacyKey('border', 'blue', '500')]: 'border-[var(--color-accent)]',
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
  legacyKey('bg', 'blue', '500'),
  legacyKey('bg', 'blue', '600'),
  legacyKey('bg', 'blue', '700'),
  legacyKey('text', 'blue', '500'),
  legacyKey('text', 'blue', '600'),
  legacyKey('text', 'blue', '700'),
  legacyKey('border', 'blue', '500'),
  legacyKey('border', 'blue', '600'),

  // Orange variants (use amber-orange gradients for warnings)
  legacyKey('bg', 'orange', '500'),
  legacyKey('bg', 'orange', '600'),
  legacyKey('text', 'orange', '500'),
  legacyKey('text', 'orange', '600'),

  // Indigo variants (use in gradients only, not as solid colors)
  legacyKey('bg', 'indigo', '500'),
  legacyKey('bg', 'indigo', '600'),
  legacyKey('text', 'indigo', '500'),
  legacyKey('text', 'indigo', '600'),

  // Green variants (use emerald-green gradients for success)
  legacyKey('bg', 'green', '500'),
  legacyKey('bg', 'green', '600'),
  legacyKey('text', 'green', '500'),
  legacyKey('text', 'green', '600'),

  // Red/Rose variants (use red-rose gradients for danger)
  legacyKey('bg', 'red', '500'),
  legacyKey('bg', 'red', '600'),
  legacyKey('text', 'red', '500'),
  legacyKey('text', 'red', '600'),

  // Slate variants (use semantic tokens)
  legacyKey('bg', 'slate', '100'),
  legacyKey('bg', 'slate', '200'),
  legacyKey('bg', 'slate', '800'),
  legacyKey('bg', 'slate', '900'),
  legacyKey('text', 'slate', '500'),
  legacyKey('text', 'slate', '600'),
  legacyKey('text', 'slate', '700'),
  legacyKey('text', 'slate', '900'),
] as const;

/**
 * Check if a class string contains forbidden raw colors
 */
export function containsForbiddenColors(classString: string): boolean {
  return FORBIDDEN_RAW_COLORS.some((color) => classString.includes(color));
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
 * <div className="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]">
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
 * const classes = "bg-[var(--color-accent)] text-[var(--color-text-inverse)]";
 * if (containsForbiddenColors(classes)) {
 *   console.warn("Raw colors detected! Use semantic tokens instead.");
 * }
 */
