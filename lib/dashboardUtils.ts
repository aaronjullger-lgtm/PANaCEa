/**
 * Dashboard Analytics Utilities
 *
 * Shared utility functions for analytics calculations used across
 * the dashboard components.
 */

// Storage key for widget preferences
export const WIDGET_PREFS_KEY = 'panacea_widget_preferences';

/**
 * Calculate accuracy percentage from correct and total counts
 */
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Calculate streak information from performance data
 */
export function calculateStreaks(records: { isCorrect: boolean }[]): {
  current: number;
  best: number;
} {
  if (records.length === 0) {
    return { current: 0, best: 0 };
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    if (!record) continue;
    
    if (record.isCorrect) {
      tempStreak++;
      const nextRecord = records[i + 1];
      if (i === records.length - 1 || (i < records.length - 1 && nextRecord?.isCorrect)) {
        currentStreak = tempStreak;
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
      if (i === records.length - 1) {
        currentStreak = 0;
      }
    }
  }

  return { current: currentStreak, best: bestStreak };
}

/**
 * Load widget preferences from localStorage
 */
export function loadWidgetPreferences<T>(defaultWidgets: T[]): T[] {
  try {
    const stored = localStorage.getItem(WIDGET_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return defaultWidgets;
}

/**
 * Save widget preferences to localStorage
 */
export function saveWidgetPreferences<T>(widgets: T[]): void {
  localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(widgets));
}
