/**
 * Date utility functions for EOR scheduling and rotation windows.
 * Uses date-fns for edge-safe date operations.
 */

import {
  differenceInCalendarDays,
  addDays,
  isWithinInterval,
  startOfDay,
  parseISO,
  formatISO,
} from 'date-fns';

/**
 * Calculate the rotation window for EOR study.
 * @param eorTestDate - Exam date (ISO string or Date)
 * @param blockDays - Number of days before exam to start (default 28)
 * @returns Window with start and end dates (Date objects)
 */
export function deriveRotationWindow(
  eorTestDate: string | Date,
  blockDays = 28
): { start: Date; end: Date } {
  const end = eorTestDate instanceof Date ? eorTestDate : parseISO(eorTestDate);
  const start = addDays(end, -blockDays);
  return { start, end };
}

/**
 * Compute the number of calendar days between two dates.
 * Wrapper around date-fns differenceInCalendarDays.
 */
export function daysBetween(a: Date, b: Date): number {
  return differenceInCalendarDays(a, b);
}

/**
 * Check if a date is within a given interval (inclusive).
 */
export function isDateWithinInterval(
  date: Date,
  interval: { start: Date; end: Date }
): boolean {
  return isWithinInterval(date, interval);
}

/**
 * Add days to a date, returning a new Date.
 */
export function addDaysToDate(date: Date, days: number): Date {
  return addDays(date, days);
}

/**
 * Start of day (UTC) normalization.
 */
export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Format date as ISO string (date only, no time).
 */
export function formatDateISO(date: Date): string {
  return formatISO(date, { representation: 'date' });
}

/**
 * Parse ISO string and ensure start of day.
 */
export function parseISODate(iso: string): Date {
  const parsed = parseISO(iso);
  return startOfDay(parsed);
}