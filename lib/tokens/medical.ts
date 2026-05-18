/**
 * Diagnostic Atlas OS tokens
 *
 * Dark-first medical command-center tokens for the StudyPanacea redesign.
 * Values resolve to CSS custom properties defined in index.css so components
 * stay compatible with light/dark theme infrastructure and shadcn variables.
 */

export const diagnosticAtlasColor = {
  background: 'var(--atlas-bg)',
  backgroundSoft: 'var(--atlas-bg-soft)',
  surface: 'var(--atlas-surface)',
  elevatedSurface: 'var(--atlas-surface-elevated)',
  glassSurface: 'var(--atlas-surface-glass)',
  border: 'var(--atlas-border)',
  borderStrong: 'var(--atlas-border-strong)',
  borderGlow: 'var(--atlas-border-glow)',
  cyan: 'var(--atlas-accent-cyan)',
  blue: 'var(--atlas-accent-blue)',
  violet: 'var(--atlas-accent-violet)',
  pulsePink: 'var(--atlas-accent-pulse-pink)',
  successGreen: 'var(--atlas-success-green)',
  warningAmber: 'var(--atlas-warning-amber)',
  mutedText: 'var(--atlas-text-muted)',
  subtleText: 'var(--atlas-text-subtle)',
  clinicalWhite: 'var(--atlas-clinical-white)',
} as const;

export const diagnosticAtlasShadow = {
  glass: 'var(--atlas-shadow-glass)',
  deep: 'var(--atlas-shadow-deep)',
  focus: 'var(--atlas-focus-ring)',
} as const;

export const diagnosticAtlasMotion = {
  fast: 'var(--atlas-motion-duration-fast)',
  normal: 'var(--atlas-motion-duration-normal)',
  ease: 'var(--atlas-motion-ease)',
  scanDuration: 'var(--atlas-scan-duration)',
} as const;

export const diagnosticAtlasClass = {
  theme: 'theme-diagnostic-atlas',
  background: 'bg-atlas-background text-atlas-white',
  medicalGrid: 'atlas-medical-grid',
  radialGlow: 'atlas-radial-glow',
  glassCard: 'atlas-glass-card',
  borderGlow: 'atlas-border-glow',
  scannerLine: 'atlas-scanner-line',
  focusRing: 'atlas-focus-ring',
  noiseOverlay: 'atlas-noise-overlay',
  motionSafe: 'atlas-motion-safe atlas-reduced-motion-safe',
} as const;

export const diagnosticAtlas = {
  color: diagnosticAtlasColor,
  shadow: diagnosticAtlasShadow,
  motion: diagnosticAtlasMotion,
  className: diagnosticAtlasClass,
} as const;

export type DiagnosticAtlasColorToken = keyof typeof diagnosticAtlasColor;
export type DiagnosticAtlasClassToken = keyof typeof diagnosticAtlasClass;
