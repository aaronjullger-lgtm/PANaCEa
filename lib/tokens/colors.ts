/**
 * PANaCEa Color Tokens — canonical
 *
 * Single source of truth for color usage in TypeScript. All values are
 * CSS custom-property references defined in `index.css` (light + .dark).
 *
 * No raw hex values belong in this file. If a value is missing, add it to
 * index.css first, then expose it here.
 *
 * Two flavors are exported for each token:
 *   - `color.xxx`          → string like `var(--color-data-pass)` for inline styles
 *   - `colorClass.xxx.bg`  → Tailwind class for className use
 */

/* ---------- 1. Raw CSS var references (for inline styles) ---------- */

export const color = {
  // Clinical semantic foundation
  semantic: {
    background:      'var(--color-background)',
    surface:         'var(--color-surface)',
    surfaceElevated: 'var(--color-surface-elevated)',
    border:          'var(--color-border)',
    textPrimary:     'var(--color-text-primary)',
    textSecondary:   'var(--color-text-secondary)',
    textMuted:       'var(--color-text-muted)',
    accent:          'var(--color-accent)',
    accentHover:     'var(--color-accent-hover)',
    success:         'var(--color-success)',
    risk:            'var(--color-risk)',
    danger:          'var(--color-danger)',
  },

  // Backgrounds
  bg: {
    primary:   'var(--color-bg-primary)',
    secondary: 'var(--color-bg-secondary)',
    tertiary:  'var(--color-bg-tertiary)',
    surface:   'var(--color-surface)',
    elevated:  'var(--color-surface-elevated)',
    card:      'var(--color-card-bg)',
    overlay:   'var(--color-overlay)',
    glass:     'var(--color-glass-bg)',
  },

  // Text
  text: {
    primary:   'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted:     'var(--color-text-muted)',
    tertiary:  'var(--color-text-tertiary)',
    inverse:   'var(--color-text-inverse)',
  },

  // Borders
  border: {
    default: 'var(--color-border)',
    light:   'var(--color-border-light)',
    glass:   'var(--color-glass-border)',
  },

  // Accent / action
  accent: {
    default:      'var(--color-accent)',
    hover:        'var(--color-accent-hover)',
    secondary:    'var(--color-accent-secondary)',
    light:        'var(--color-accent-light)',
    focusRing:    'var(--color-focus-ring)',
  },

  // Diagnostic Atlas OS redesign tokens
  atlas: {
    background:      'var(--atlas-bg)',
    backgroundSoft:  'var(--atlas-bg-soft)',
    surface:         'var(--atlas-surface)',
    surfaceElevated: 'var(--atlas-surface-elevated)',
    glass:           'var(--atlas-surface-glass)',
    border:          'var(--atlas-border)',
    borderStrong:    'var(--atlas-border-strong)',
    borderGlow:      'var(--atlas-border-glow)',
    cyan:            'var(--atlas-accent-cyan)',
    blue:            'var(--atlas-accent-blue)',
    violet:          'var(--atlas-accent-violet)',
    pulsePink:       'var(--atlas-accent-pulse-pink)',
    successGreen:    'var(--atlas-success-green)',
    warningAmber:    'var(--atlas-warning-amber)',
    textMuted:       'var(--atlas-text-muted)',
    textSubtle:      'var(--atlas-text-subtle)',
    clinicalWhite:   'var(--atlas-clinical-white)',
  },

  // Data-viz / state semantics
  data: {
    pass:        'var(--color-data-pass)',
    fail:        'var(--color-data-fail)',
    provisional: 'var(--color-data-provisional)',
    neutral:     'var(--color-data-neutral)',
    neutralBg:   'var(--color-data-neutral-bg)',
  },

  // Status aliases (same values as data.* — use the name that reads best)
  status: {
    success: 'var(--color-success)',
    risk:    'var(--color-risk)',
    danger:  'var(--color-danger)',
    error:   'var(--color-error)',
    warning: 'var(--color-warning)',
    info:    'var(--color-info)',
  },

  // Shadows
  shadow: {
    soft: 'var(--color-shadow-soft)',
  },

  // Category accents (per major hub / reference config)
  category: {
    toolkit:     'var(--color-category-toolkit)',
    command:     'var(--color-category-command)',
    visual:      'var(--color-category-visual)',
    practice:    'var(--color-category-practice)',
    specialty:   'var(--color-category-specialty)',
    simulation:  'var(--color-category-simulation)',
  },

  // Knowledge-graph node accents
  node: {
    condition: 'var(--color-node-condition)',
    finding:   'var(--color-node-finding)',
    drug:      'var(--color-node-drug)',
    procedure: 'var(--color-node-procedure)',
    system:    'var(--color-node-system)',
    anatomy:   'var(--color-node-anatomy)',
    labTest:   'var(--color-node-lab-test)',
    imaging:   'var(--color-node-imaging)',
    vitalSign: 'var(--color-node-vital-sign)',
    other:     'var(--color-node-other)',
  },
} as const;

/* ---------- 2. Tailwind class shortcuts ---------- */

export const colorClass = {
  semantic: {
    background:      'bg-[var(--color-background)]',
    surface:         'bg-[var(--color-surface)]',
    surfaceElevated: 'bg-[var(--color-surface-elevated)]',
    border:          'border-[var(--color-border)]',
    textPrimary:     'text-[var(--color-text-primary)]',
    textSecondary:   'text-[var(--color-text-secondary)]',
    textMuted:       'text-[var(--color-text-muted)]',
    accent:          'text-[var(--color-accent)]',
    success:         'text-[var(--color-success)]',
    risk:            'text-[var(--color-risk)]',
    danger:          'text-[var(--color-danger)]',
  },
  bg: {
    primary:   'bg-[var(--color-bg-primary)]',
    secondary: 'bg-[var(--color-bg-secondary)]',
    tertiary:  'bg-[var(--color-bg-tertiary)]',
    surface:   'bg-[var(--color-surface)]',
    elevated:  'bg-[var(--color-surface-elevated)]',
  },
  text: {
    primary:   'text-[var(--color-text-primary)]',
    secondary: 'text-[var(--color-text-secondary)]',
    muted:     'text-[var(--color-text-muted)]',
    inverse:   'text-[var(--color-text-inverse)]',
  },
  border: {
    default: 'border-[var(--color-border)]',
  },
  accent: {
    bg:     'bg-[var(--color-accent)]',
    text:   'text-[var(--color-accent)]',
    border: 'border-[var(--color-accent)]',
    ring:   'focus-visible:ring-[var(--color-accent)]',
  },
  atlas: {
    background: 'bg-atlas-background',
    surface:    'bg-atlas-surface',
    elevated:   'bg-atlas-elevated',
    glass:      'bg-atlas-glass',
    border:     'border-atlas-border',
    borderGlow: 'border-atlas-border-glow',
    cyanText:   'text-atlas-cyan',
    blueText:   'text-atlas-blue',
    violetText: 'text-atlas-violet',
    pulseText:  'text-atlas-pulse',
    successText:'text-atlas-success',
    warningText:'text-atlas-warning',
    mutedText:  'text-atlas-muted',
    whiteText:  'text-atlas-white',
  },
  data: {
    passBg:        'bg-[var(--color-data-pass)]',
    passText:      'text-[var(--color-data-pass)]',
    failBg:        'bg-[var(--color-data-fail)]',
    failText:      'text-[var(--color-data-fail)]',
    provisionalBg:   'bg-[var(--color-data-provisional)]',
    provisionalText: 'text-[var(--color-data-provisional)]',
    neutralBg:     'bg-[var(--color-data-neutral)]',
    neutralText:   'text-[var(--color-data-neutral)]',
  },
} as const;

/* ---------- 3. Status bundle (bg + text + border + icon) ---------- */

type StatusBundle = { bg: string; text: string; border: string; icon: string };

export const statusColors = {
  success: {
    bg:     'bg-[var(--color-data-pass)]/10',
    text:   'text-[var(--color-data-pass)]',
    border: 'border-[var(--color-data-pass)]/30',
    icon:   'text-[var(--color-data-pass)]',
  },
  risk: {
    bg:     'bg-[var(--color-risk)]/10',
    text:   'text-[var(--color-risk)]',
    border: 'border-[var(--color-risk)]/30',
    icon:   'text-[var(--color-risk)]',
  },
  danger: {
    bg:     'bg-[var(--color-danger)]/10',
    text:   'text-[var(--color-danger)]',
    border: 'border-[var(--color-danger)]/30',
    icon:   'text-[var(--color-danger)]',
  },
  error: {
    bg:     'bg-[var(--color-data-fail)]/10',
    text:   'text-[var(--color-data-fail)]',
    border: 'border-[var(--color-data-fail)]/30',
    icon:   'text-[var(--color-data-fail)]',
  },
  warning: {
    bg:     'bg-[var(--color-data-provisional)]/10',
    text:   'text-[var(--color-data-provisional)]',
    border: 'border-[var(--color-data-provisional)]/30',
    icon:   'text-[var(--color-data-provisional)]',
  },
  info: {
    bg:     'bg-[var(--color-accent)]/10',
    text:   'text-[var(--color-accent)]',
    border: 'border-[var(--color-accent)]/30',
    icon:   'text-[var(--color-accent)]',
  },
  neutral: {
    bg:     'bg-[var(--color-bg-tertiary)]/60',
    text:   'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-border)]',
    icon:   'text-[var(--color-text-muted)]',
  },
} as const satisfies Record<string, StatusBundle>;

export type StatusKey = keyof typeof statusColors;
export const getStatusColors = (status: StatusKey): StatusBundle =>
  statusColors[status] ?? statusColors.neutral;

/* ---------- 4. Types ---------- */

export type ColorToken = typeof color;
export type ColorClassToken = typeof colorClass;
