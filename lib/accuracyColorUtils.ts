/**
 * Accuracy color utilities (color-blind-safe traffic-light scale).
 * Single source of truth for accuracy-based colors across the app.
 *
 * Scale: ≥80% teal (mastery), 60–80% blue (building), <60% amber (warning).
 * Red is never used for "low" scores to avoid medical alarm and color-blind confusion.
 */

/** Threshold above which we show "mastery" (teal). */
export const ACCURACY_MASTERY_THRESHOLD = 80;

/** Threshold above which we show "building" (blue); below is "warning" (amber). */
export const ACCURACY_BUILDING_THRESHOLD = 60;

/** Hex color for SVG/canvas when accuracy is in mastery range (≥80%). */
export const ACCURACY_COLOR_MASTERY = '#14b8a6';

/** Hex color for building range (60–80%). */
export const ACCURACY_COLOR_BUILDING = '#2563eb';

/** Hex color for warning range (<60%). */
export const ACCURACY_COLOR_WARNING = '#f59e0b';

/**
 * Returns the hex color for a 0–100 accuracy score (for SVG, canvas, or inline styles).
 */
export function getAccuracyHex(score: number): string {
  if (score >= ACCURACY_MASTERY_THRESHOLD) return ACCURACY_COLOR_MASTERY;
  if (score >= ACCURACY_BUILDING_THRESHOLD) return ACCURACY_COLOR_BUILDING;
  return ACCURACY_COLOR_WARNING;
}

/**
 * Returns the Tailwind/CSS text class for accuracy (e.g. text-[var(--color-data-pass)]).
 */
export function getAccuracyTextClass(score: number): string {
  if (score >= ACCURACY_MASTERY_THRESHOLD) return 'text-[var(--color-data-pass)]';
  if (score >= ACCURACY_BUILDING_THRESHOLD) return 'text-[var(--color-accent)]';
  return 'text-[var(--color-data-provisional)]';
}

/**
 * Returns the Tailwind/CSS background class for accuracy bars (e.g. bg-[var(--color-data-pass)]).
 */
export function getAccuracyBarClass(score: number): string {
  if (score >= ACCURACY_MASTERY_THRESHOLD) return 'bg-[var(--color-data-pass)]';
  if (score >= ACCURACY_BUILDING_THRESHOLD) return 'bg-[var(--color-accent)]';
  return 'bg-[var(--color-data-provisional)]';
}

/**
 * Same as getAccuracyBarClass but uses Tailwind semantic names where available (bg-data-pass, bg-data-provisional).
 * Use when your theme defines .bg-data-pass / .bg-data-provisional.
 */
export function getAccuracyBarClassSemantic(score: number): string {
  if (score >= ACCURACY_MASTERY_THRESHOLD) return 'bg-data-pass';
  if (score >= ACCURACY_BUILDING_THRESHOLD) return 'bg-[var(--color-accent)]';
  return 'bg-data-provisional';
}
