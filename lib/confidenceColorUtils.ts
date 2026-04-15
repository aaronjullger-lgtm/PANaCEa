/**
 * Confidence color utilities (red‑yellow‑green gradient).
 * Single source of truth for confidence-based colors across the app.
 *
 * Confidence scores range 0–1 (from scoringEngine).
 * Colors are interpolated between semantic error/warning/success tokens.
 * Use hex colors for SVG/canvas (Cytoscape) and CSS variables for UI.
 */

/** Hex color for low confidence (error) */
export const CONFIDENCE_COLOR_LOW = '#ef4444'; // --color-error light

/** Hex color for medium confidence (warning) */
export const CONFIDENCE_COLOR_MEDIUM = '#f59e0b'; // --color-warning light

/** Hex color for high confidence (success) */
export const CONFIDENCE_COLOR_HIGH = '#10b981'; // --color-success light

/** Hex color for dark theme low confidence (error) */
export const CONFIDENCE_COLOR_LOW_DARK = '#f87171'; // --color-error dark

/** Hex color for dark theme medium confidence (warning) */
export const CONFIDENCE_COLOR_MEDIUM_DARK = '#fbbf24'; // --color-warning dark

/** Hex color for dark theme high confidence (success) */
export const CONFIDENCE_COLOR_HIGH_DARK = '#34d399'; // --color-success dark

/**
 * Returns a hex color interpolated between red (0), yellow (0.5), green (1).
 * Uses light theme semantic colors by default; pass `darkMode = true` for dark theme.
 */
export function getConfidenceHex(confidence: number, darkMode = false): string {
  // Clamp confidence to [0, 1]
  const t = Math.max(0, Math.min(1, confidence));
  
  const low = darkMode ? CONFIDENCE_COLOR_LOW_DARK : CONFIDENCE_COLOR_LOW;
  const medium = darkMode ? CONFIDENCE_COLOR_MEDIUM_DARK : CONFIDENCE_COLOR_MEDIUM;
  const high = darkMode ? CONFIDENCE_COLOR_HIGH_DARK : CONFIDENCE_COLOR_HIGH;

  if (t <= 0.5) {
    // Interpolate between low (red) and medium (yellow)
    const u = t * 2; // 0 → 0, 0.5 → 1
    return interpolateHex(low, medium, u);
  } else {
    // Interpolate between medium (yellow) and high (green)
    const u = (t - 0.5) * 2; // 0.5 → 0, 1 → 1
    return interpolateHex(medium, high, u);
  }
}

/**
 * Returns the Tailwind/CSS text class for confidence (uses CSS variables).
 * Suitable for text elements where theme adaptation is required.
 */
export function getConfidenceTextClass(confidence: number): string {
  if (confidence >= 0.66) return 'text-[var(--color-success)]';
  if (confidence >= 0.33) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-error)]';
}

/**
 * Returns the Tailwind/CSS background class for confidence (uses CSS variables).
 * Suitable for background elements where theme adaptation is required.
 */
export function getConfidenceBgClass(confidence: number): string {
  if (confidence >= 0.66) return 'bg-[var(--color-success)]';
  if (confidence >= 0.33) return 'bg-[var(--color-warning)]';
  return 'bg-[var(--color-error)]';
}

/**
 * Returns the Tailwind/CSS border class for confidence (uses CSS variables).
 */
export function getConfidenceBorderClass(confidence: number): string {
  if (confidence >= 0.66) return 'border-[var(--color-success)]';
  if (confidence >= 0.33) return 'border-[var(--color-warning)]';
  return 'border-[var(--color-error)]';
}

/**
 * Returns a CSS variable reference for the confidence color (suitable for inline styles).
 * Example: `color: var(--color-success)`
 */
export function getConfidenceCssVar(confidence: number): string {
  if (confidence >= 0.66) return 'var(--color-success)';
  if (confidence >= 0.33) return 'var(--color-warning)';
  return 'var(--color-error)';
}

/**
 * Returns a discrete label for confidence (Low / Medium / High).
 */
export function getConfidenceLabel(confidence: number): 'Low' | 'Medium' | 'High' {
  if (confidence >= 0.66) return 'High';
  if (confidence >= 0.33) return 'Medium';
  return 'Low';
}

// --- Internal helpers -------------------------------------------------------

/**
 * Parse a hex color string (#rrggbb) into RGB components.
 */
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const [, r = '00', g = '00', b = '00'] = m;
  return [
    parseInt(r, 16),
    parseInt(g, 16),
    parseInt(b, 16),
  ];
}

/**
 * Convert RGB components to hex string (#rrggbb).
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/**
 * Linearly interpolate between two hex colors.
 * @param hexA Start color (#rrggbb)
 * @param hexB End color (#rrggbb)
 * @param t Interpolation factor (0 → hexA, 1 → hexB)
 */
function interpolateHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = r1 + (r2 - r1) * t;
  const g = g1 + (g2 - g1) * t;
  const b = b1 + (b2 - b1) * t;
  return rgbToHex(r, g, b);
}
