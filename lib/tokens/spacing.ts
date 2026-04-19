/**
 * PANaCEa Spacing, Radius, and Shadow Tokens — canonical
 *
 * Numeric pixel/rem values for inline styles, plus Tailwind class shortcuts.
 * Values mirror `tailwind.config.js` and `index.css`.
 */

/* ---------- Spacing scale (4px base unit) ---------- */

export const space = {
  0:    '0',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  10:   '40px',
  12:   '48px',
  16:   '64px',
  20:   '80px',
  24:   '96px',
} as const;

/** Numeric spacing (useful for Math, inline-style padding/margin numbers) */
export const spaceNum = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

/* ---------- Border radius ---------- */

export const radius = {
  none: '0',
  sm:   '4px',
  md:   '6px',
  lg:   '8px',
  xl:   '12px',
  '2xl':'16px',
  '3xl':'24px',
  full: '9999px',
} as const;

/* ---------- Shadow tokens ----------
 * Elevation levels — use these names rather than raw box-shadow strings.
 * Values match the `boxShadow` extensions in tailwind.config.js.
 */

export const shadow = {
  /** Very subtle — stat cards, inactive surfaces */
  xs: '0 0 0 1px rgba(0, 0, 0, 0.03), 0 2px 8px -2px rgba(0, 0, 0, 0.05)',
  /** Default ring-shadow used by Card primitive (ring + small ambient) */
  card: '0 0 0 1px var(--color-glass-border, var(--color-border)), 0 2px 8px -2px var(--color-glass-shadow, rgba(0,0,0,0.08)), 0 1px 3px -1px rgba(0,0,0,0.04)',
  /** Card glass — ring + deeper ambient for frosted-glass surfaces (Card primitive default) */
  cardGlass: '0 0 0 1px var(--color-glass-border, var(--color-border)), 0 4px 16px -4px var(--color-glass-shadow, rgba(0,0,0,0.12)), 0 2px 6px -2px rgba(0,0,0,0.04)',
  /** Elevated — modals, dropdowns */
  elevated: '0 1px 3px rgba(0, 0, 0, 0.04), 0 6px 16px -4px rgba(0, 0, 0, 0.08)',
  /** Cinematic — premium card hover, marketing */
  cinematic: '0 0 0 1px rgba(59, 130, 246, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.1)',
  /** Glass — frosted panels (no ring) */
  glass: '0 4px 16px -2px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  /** Modal — high elevation */
  modal: '0 18px 42px var(--color-shadow-soft)',
  /** Inset ring — subtle separators */
  insetRing: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
} as const;

/* ---------- Focus ring ---------- */

export const focus = {
  ring:     '0 0 0 2px var(--color-focus-ring)',
  ringOffset: '0 0 0 2px var(--color-bg-primary), 0 0 0 4px var(--color-focus-ring)',
  /** Tailwind class bundle for focus-visible */
  className:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]',
} as const;

/* ---------- Min touch targets (WCAG 2.1 AA) ---------- */

export const touchTarget = {
  /** Minimum 44×44px interactive surface */
  min:     44,
  minPx:   '44px',
  /** Compact (allowed for dense lists if parent row is ≥44px) */
  compact: 36,
  compactPx: '36px',
} as const;

/* ---------- Motion ---------- */

export const duration = {
  instant: 0,
  fast:    150,
  normal:  200,
  slow:    300,
  slower:  500,
} as const;

export const easing = {
  premium:      'cubic-bezier(0.16, 1, 0.3, 1)',
  smooth:       'cubic-bezier(0.4, 0, 0.2, 1)',
  bounceSubtle: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  easeOut:      'cubic-bezier(0, 0, 0.2, 1)',
  easeIn:       'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/* ---------- Z-index scale ---------- */

export const zIndex = {
  base:      0,
  dropdown:  10,
  sticky:    20,
  fixed:     30,
  backdrop:  40,
  modal:     50,
  popover:   60,
  tooltip:   70,
  toast:     80,
} as const;
