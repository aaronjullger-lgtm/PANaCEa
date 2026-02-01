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
 * Calculate day streak (consecutive days studied) from performance data.
 * Single source of truth for "Day Streak" / "Study Streak" displays.
 */
export function calculateDayStreak(records: { timestamp?: number }[]): {
  current: number;
  best: number;
} {
  if (records.length === 0) return { current: 0, best: 0 };

  const uniqueDates = new Set<string>();
  records.forEach((r) => {
    if (r.timestamp) {
      uniqueDates.add(new Date(r.timestamp).toISOString().split('T')[0] ?? '');
    }
  });
  const dates = Array.from(uniqueDates).sort().reverse();
  if (dates.length === 0) return { current: 0, best: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let current = 0;
  if (dates[0] === todayStr || dates[0] === yesterdayStr) {
    current = 1;
    let checkDate = new Date(dates[0]);
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(checkDate);
      prev.setDate(prev.getDate() - 1);
      const prevStr = prev.toISOString().split('T')[0];
      if (dates[i] === prevStr) {
        current++;
        checkDate = prev;
      } else break;
    }
  }

  let best = 1;
  let temp = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const curr = new Date(dates[i]);
    const next = new Date(dates[i + 1]);
    const diff = Math.round((curr.getTime() - next.getTime()) / (24 * 60 * 60 * 1000));
    if (diff === 1) temp++;
    else {
      best = Math.max(best, temp);
      temp = 1;
    }
  }
  best = Math.max(best, temp);

  return { current, best };
}

/**
 * Calculate question streak (consecutive correct answers) from performance data
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
