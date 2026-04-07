/**
 * Interval Display Utilities
 *
 * Centralizes the conversion of fractional interval days (from FSRS scheduling)
 * into human-readable strings and display-safe integers.
 *
 * FSRS-7 Migration Note:
 * FSRS-7 introduces fractional intervals (e.g., 2.7 days instead of 3 days).
 * All display and storage code should route through these utilities so that
 * the transition from integer to fractional intervals requires changes in
 * only one place. Raw `scheduled_days` floats should be preserved for
 * computation; only round at the display/storage boundary.
 */

/**
 * Round a fractional interval to a display-safe integer.
 * Minimum 1 day (FSRS never schedules "0 days" for real reviews).
 *
 * Use this at the boundary where `scheduled_days` enters API responses
 * or UI components. Do NOT use this for internal FSRS computations.
 */
export function roundIntervalForDisplay(scheduledDays: number): number {
  if (!Number.isFinite(scheduledDays) || scheduledDays < 0) return 1;
  return Math.max(1, Math.round(scheduledDays));
}

/**
 * Format a fractional interval into a human-readable string.
 *
 * Examples:
 *   0 or sub-day → "today"
 *   0.5 → "today" (sub-day review, same-day)
 *   1 → "tomorrow"
 *   3.7 → "in 4 days"
 *   10 → "in 1 week"
 *   45 → "in 2 months"
 *   400 → "in 1 year"
 *
 * When FSRS-7 enables sub-day precision, this function can be extended
 * to output "in 6 hours" etc. without changing any call sites.
 */
export function formatIntervalDays(intervalDays: number): string {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) return 'today';

  const rounded = Math.round(intervalDays);

  if (rounded === 0) return 'today';
  if (rounded === 1) return 'tomorrow';
  if (rounded < 7) return `in ${rounded} days`;
  if (rounded < 30) {
    const weeks = Math.round(rounded / 7);
    return weeks === 1 ? 'in 1 week' : `in ${weeks} weeks`;
  }
  if (rounded < 365) {
    const months = Math.round(rounded / 30);
    return months === 1 ? 'in 1 month' : `in ${months} months`;
  }
  const years = Math.round(rounded / 365);
  return years === 1 ? 'in 1 year' : `in ${years} years`;
}

/**
 * Convert fractional days to a due Date.
 *
 * Preserves sub-day precision from FSRS-7 fractional intervals:
 * 2.5 days from now = exactly 60 hours from now, not rounded to 3 days.
 */
export function intervalToDate(intervalDays: number, from: Date = new Date()): Date {
  const ms = intervalDays * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}
