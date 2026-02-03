/**
 * Shared streak calculation with Weekend Mode and Streak Freezes.
 * @see docs/AUDIT_STREAK_FRAGILITY.md
 */

export type StreakGoalDays = 'all' | 'weekdays';

/** Normalize to midnight UTC for date comparison */
function toDateKey(d: Date): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

function toMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday (getUTCDay) */
function getDayOfWeek(d: Date): number {
  return toMidnightUTC(d).getUTCDay();
}

/** True if this day counts toward streak goal (weekdays = Mon–Fri only) */
export function isGoalDay(date: Date, streakGoalDays: StreakGoalDays): boolean {
  if (streakGoalDays === 'all') return true;
  const day = getDayOfWeek(date);
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/** Previous calendar day in UTC */
function prevDay(d: Date): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() - 1);
  return toMidnightUTC(next);
}

/** Last goal day that is on or before `date`. If weekdays and date is Sat/Sun, returns Friday. */
export function lastGoalDayOnOrBefore(date: Date, streakGoalDays: StreakGoalDays): Date {
  const d = toMidnightUTC(date);
  if (streakGoalDays === 'all') return d;
  const day = d.getUTCDay();
  if (day >= 1 && day <= 5) return d;
  // Saturday -> back 1 to Friday; Sunday -> back 2 to Friday
  const back = day === 0 ? 2 : 1;
  const friday = new Date(d);
  friday.setUTCDate(friday.getUTCDate() - back);
  return toMidnightUTC(friday);
}

/** Previous "expected" goal day when walking backward from `date`. */
export function previousGoalDay(date: Date, streakGoalDays: StreakGoalDays): Date {
  if (streakGoalDays === 'all') return prevDay(date);
  let d = prevDay(date);
  while (!isGoalDay(d, streakGoalDays)) {
    d = prevDay(d);
  }
  return d;
}

export interface StreakCalcInput {
  /** Activity dates (each normalized to midnight UTC) */
  activityDates: Date[];
  /** Dates user used a freeze (count as "active" for streak) */
  frozenDates: Date[];
  /** Reference "today" (usually UTC today) */
  today: Date;
  streakGoalDays: StreakGoalDays;
}

export interface StreakCalcResult {
  currentStreak: number;
  isActiveToday: boolean;
  /** For display: most recent day that counted (activity or freeze) */
  lastCountedDate: Date | null;
}

/** Build set of date keys (YYYY-MM-DD) for O(1) lookup */
function dateKeySet(dates: Date[]): Set<string> {
  const set = new Set<string>();
  for (const d of dates) set.add(toDateKey(d));
  return set;
}

/**
 * Compute current streak considering weekend mode and frozen days.
 * "Today" and "expected" walking back use goal-day logic; a day counts if it's in activity or frozen.
 */
export function computeCurrentStreak(input: StreakCalcInput): StreakCalcResult {
  const { activityDates, frozenDates, today, streakGoalDays } = input;
  const todayNorm = toMidnightUTC(today);
  const activityKeys = dateKeySet(activityDates);
  const frozenKeys = dateKeySet(frozenDates);

  const hasOn = (d: Date): boolean =>
    activityKeys.has(toDateKey(d)) || frozenKeys.has(toDateKey(d));

  const sorted = [...activityDates, ...frozenDates]
    .map(toMidnightUTC)
    .filter((d) => isGoalDay(d, streakGoalDays));
  const allKeys = new Set([...activityKeys, ...frozenKeys]);

  if (sorted.length === 0) {
    return { currentStreak: 0, isActiveToday: false, lastCountedDate: null };
  }

  sorted.sort((a, b) => b.getTime() - a.getTime());
  const lastCountedDate = sorted[0] ?? null;

  // Reference: most recent goal day on or before today
  const reference = lastGoalDayOnOrBefore(todayNorm, streakGoalDays);
  const isActiveToday =
    streakGoalDays === 'all' ? allKeys.has(toDateKey(todayNorm)) : allKeys.has(toDateKey(reference));

  // Start expected from reference if active "today", else from previous goal day
  let expected = isActiveToday ? reference : previousGoalDay(reference, streakGoalDays);

  let currentStreak = 0;
  const maxIterations = 400;
  let iterations = 0;

  while (iterations < maxIterations) {
    if (hasOn(expected)) {
      currentStreak++;
      expected = previousGoalDay(expected, streakGoalDays);
    } else {
      break;
    }
    iterations++;
  }

  return {
    currentStreak,
    isActiveToday,
    lastCountedDate,
  };
}

/**
 * Compute longest streak (for stats). Uses same goal-day and frozen logic.
 * Iterates through sorted unique dates (activity + frozen), only counting goal days.
 */
export function computeLongestStreak(input: StreakCalcInput): number {
  const { activityDates, frozenDates, streakGoalDays } = input;
  const allKeys = new Set<string>();
  for (const d of activityDates) allKeys.add(toDateKey(d));
  for (const d of frozenDates) allKeys.add(toDateKey(d));

  const sorted = [...allKeys]
    .map((k) => {
      const [y, m, day] = k.split('-').map(Number);
      return new Date(Date.UTC(y!, m! - 1, day!));
    })
    .filter((d) => isGoalDay(d, streakGoalDays))
    .sort((a, b) => b.getTime() - a.getTime());

  if (sorted.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevExpected = previousGoalDay(prev, streakGoalDays);
    if (curr.getTime() === prevExpected.getTime()) {
      current++;
    } else {
      longest = Math.max(longest, current);
      current = 1;
    }
  }
  return Math.max(longest, current);
}
