/**
 * Time-based Utility Functions
 * Helper functions for working with time and date operations
 */

/**
 * Day names for calendar displays
 */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type CircadianPhase = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Get current UTC date normalized to midnight
 * This ensures consistent date calculations regardless of client timezone
 * @returns Date object set to midnight UTC
 */
export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Get a time-based greeting based on the current hour
 * @returns A greeting string (Good morning, Good afternoon, or Good evening)
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get the time of day as a string
 * @returns 'morning', 'afternoon', or 'evening'
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Get circadian phase based on standard time-of-day definitions
 * @param date Optional date (defaults to current local time)
 * @returns CircadianPhase
 *   morning: 5:00 - 11:59 (5 AM to 11:59 AM)
 *   afternoon: 12:00 - 16:59 (12 PM to 4:59 PM)
 *   evening: 17:00 - 20:59 (5 PM to 8:59 PM)
 *   night: 21:00 - 4:59 (9 PM to 4:59 AM)
 */
export function getCircadianPhase(date: Date = new Date()): CircadianPhase {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const totalMinutes = hour * 60 + minute;

  // Night spans across midnight: 21:00 to 4:59
  if (totalMinutes >= 21 * 60 || totalMinutes < 5 * 60) {
    return 'night';
  }
  if (totalMinutes >= 5 * 60 && totalMinutes < 12 * 60) {
    return 'morning';
  }
  if (totalMinutes >= 12 * 60 && totalMinutes < 17 * 60) {
    return 'afternoon';
  }
  // Remaining: 17:00 to 20:59
  return 'evening';
}

/**
 * Format a date for display
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date and time for display
 * @param date - The date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 * @param date - The date to compare
 * @returns Relative time string
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}
