/**
 * PANaCEa Typography Tokens — canonical
 *
 * Three font families, each with a specific role (mirrors the style-system skill
 * conventions so inline-style components in the library/reference views stay
 * consistent with the Tailwind-styled rest of the app).
 */

/* ---------- Font families ---------- */

export const fontFamily = {
  /** Entity names, section headers, navigation */
  heading: "'Poppins', system-ui, sans-serif",
  /** Clinical content, descriptions, labels */
  body:    "'Inter', system-ui, sans-serif",
  /** Lab ranges, dosages, scores, numeric data */
  mono:    "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace",
} as const;

/** Legacy aliases kept for components migrated from the style-system skill */
export const FONT_HEADING = fontFamily.heading;
export const FONT_BODY    = fontFamily.body;
export const FONT_MONO    = fontFamily.mono;

/* ---------- Font size + line height scale ----------
 * Mirrors `fontSize` in tailwind.config.js so class users (`text-h2`) and
 * inline-style users (`fontSize: fontSize.h2.size`) stay in sync.
 */

type ScaleEntry = { size: string; lineHeight: string; letterSpacing?: string; weight?: number };

export const fontSize = {
  'display-xl': { size: '4rem',      lineHeight: '1.05', letterSpacing: '-0.04em',  weight: 700 },
  'display':    { size: '3rem',      lineHeight: '1.08', letterSpacing: '-0.035em', weight: 700 },
  'display-sm': { size: '2.25rem',   lineHeight: '1.12', letterSpacing: '-0.025em', weight: 700 },
  h1:           { size: '2rem',      lineHeight: '1.2',  letterSpacing: '-0.02em',  weight: 600 },
  h2:           { size: '1.5rem',    lineHeight: '1.3',  letterSpacing: '-0.015em', weight: 600 },
  h3:           { size: '1.125rem',  lineHeight: '1.4',  letterSpacing: '-0.005em', weight: 600 },
  'body-lg':    { size: '1.0625rem', lineHeight: '1.6',  letterSpacing: '-0.005em' },
  body:         { size: '0.9375rem', lineHeight: '1.55', letterSpacing: '0' },
  'body-sm':    { size: '0.8125rem', lineHeight: '1.5',  letterSpacing: '0.005em' },
  caption:      { size: '0.75rem',   lineHeight: '1.5',  letterSpacing: '0.03em' },
  overline:     { size: '0.6875rem', lineHeight: '1.5',  letterSpacing: '0.1em',    weight: 600 },
  label:        { size: '0.6875rem', lineHeight: '1.4',  letterSpacing: '0.06em',   weight: 500 },
} as const satisfies Record<string, ScaleEntry>;

/* ---------- Font weights ---------- */

export const fontWeight = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const;

/* ---------- Line heights ---------- */

export const lineHeight = {
  tight:   '1.2',
  snug:    '1.4',
  normal:  '1.55',
  relaxed: '1.6',
  loose:   '1.8',
} as const;

/* ---------- Letter spacing ---------- */

export const letterSpacing = {
  display:  '-0.03em',
  heading:  '-0.02em',
  snug:     '-0.01em',
  normal:   '0',
  label:    '0.05em',
  overline: '0.08em',
  wide:     '0.1em',
} as const;

/* ---------- Text style presets (for inline styles) ---------- */

export const textStyle = {
  /** Card title — Poppins 14px semibold */
  cardTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    letterSpacing: '-0.01em',
  },
  /** Section label — Inter 12px bold uppercase (detail-section labels) */
  sectionLabel: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
  },
  /** Section body — Inter 14px lineHeight 1.6 (detail-section body) */
  sectionBody: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 1.6,
  },
  /** Numeric value — JetBrains Mono tabular */
  numeric: {
    fontFamily: fontFamily.mono,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  /** Badge text — Inter 11px medium */
  badge: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
} as const;

/* ---------- Tailwind class shortcuts ---------- */

export const textClass = {
  /** Page H1 / hub title */
  pageTitle:      'text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-2xl',
  /** Section H2 */
  sectionTitle:   'text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]',
  /** Subhead / description */
  sectionSubtitle:'text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base',
  /** Body support / caption */
  bodySupport:    'text-sm leading-6 text-[var(--color-text-secondary)]',
  /** Muted helper text */
  muted:          'text-sm text-[var(--color-text-muted)]',
} as const;
