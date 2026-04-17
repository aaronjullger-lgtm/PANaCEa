import { describe, it, expect } from 'vitest';
import {
  isGoalDay,
  lastGoalDayOnOrBefore,
  previousGoalDay,
  computeCurrentStreak,
  computeLongestStreak,
} from '../lib/streakCalc';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a UTC midnight Date for YYYY-MM-DD without local-time drift. */
function utc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
}

/** YYYY-MM-DD of a UTC date */
function key(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Anchor dates used across tests
// 2026-04-13 is a Monday, 04-14 Tue, 04-15 Wed, 04-16 Thu, 04-17 Fri
// 04-18 Sat, 04-19 Sun, 04-20 Mon
const MON_APR_13 = utc('2026-04-13');
const FRI_APR_17 = utc('2026-04-17');
const SAT_APR_18 = utc('2026-04-18');
const SUN_APR_19 = utc('2026-04-19');
const MON_APR_20 = utc('2026-04-20');

// ─── isGoalDay ──────────────────────────────────────────────────────────────

describe('isGoalDay', () => {
  it('always returns true when goal mode is "all"', () => {
    expect(isGoalDay(SAT_APR_18, 'all')).toBe(true);
    expect(isGoalDay(SUN_APR_19, 'all')).toBe(true);
    expect(isGoalDay(MON_APR_20, 'all')).toBe(true);
  });

  it('returns true for Mon-Fri in "weekdays" mode', () => {
    expect(isGoalDay(MON_APR_13, 'weekdays')).toBe(true);
    expect(isGoalDay(FRI_APR_17, 'weekdays')).toBe(true);
  });

  it('returns false for Sat and Sun in "weekdays" mode', () => {
    expect(isGoalDay(SAT_APR_18, 'weekdays')).toBe(false);
    expect(isGoalDay(SUN_APR_19, 'weekdays')).toBe(false);
  });
});

// ─── lastGoalDayOnOrBefore ──────────────────────────────────────────────────

describe('lastGoalDayOnOrBefore', () => {
  it('returns the same day in "all" mode', () => {
    expect(key(lastGoalDayOnOrBefore(SAT_APR_18, 'all'))).toBe('2026-04-18');
  });

  it('returns the same day when weekday in "weekdays" mode', () => {
    expect(key(lastGoalDayOnOrBefore(FRI_APR_17, 'weekdays'))).toBe('2026-04-17');
    expect(key(lastGoalDayOnOrBefore(MON_APR_13, 'weekdays'))).toBe('2026-04-13');
  });

  it('rolls Saturday back to Friday in "weekdays" mode', () => {
    expect(key(lastGoalDayOnOrBefore(SAT_APR_18, 'weekdays'))).toBe('2026-04-17');
  });

  it('rolls Sunday back to Friday (2 days) in "weekdays" mode', () => {
    expect(key(lastGoalDayOnOrBefore(SUN_APR_19, 'weekdays'))).toBe('2026-04-17');
  });

  it('normalizes a non-midnight Date to midnight UTC', () => {
    const noon = new Date(Date.UTC(2026, 3, 17, 12, 34, 56)); // Fri noon UTC
    expect(lastGoalDayOnOrBefore(noon, 'weekdays').getUTCHours()).toBe(0);
  });
});

// ─── previousGoalDay ────────────────────────────────────────────────────────

describe('previousGoalDay', () => {
  it('returns yesterday in "all" mode', () => {
    expect(key(previousGoalDay(MON_APR_20, 'all'))).toBe('2026-04-19');
  });

  it('skips weekend when walking back from Monday in "weekdays" mode', () => {
    // Monday → previous goal day = Friday (skipping Sun+Sat)
    expect(key(previousGoalDay(MON_APR_20, 'weekdays'))).toBe('2026-04-17');
  });

  it('returns previous weekday when already on a weekday', () => {
    expect(key(previousGoalDay(FRI_APR_17, 'weekdays'))).toBe('2026-04-16');
  });
});

// ─── computeCurrentStreak ───────────────────────────────────────────────────

describe('computeCurrentStreak', () => {
  it('returns 0 with no activity', () => {
    const result = computeCurrentStreak({
      activityDates: [],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result.currentStreak).toBe(0);
    expect(result.isActiveToday).toBe(false);
    expect(result.lastCountedDate).toBe(null);
  });

  it('counts a single active day as streak=1 (isActiveToday true)', () => {
    const result = computeCurrentStreak({
      activityDates: [MON_APR_20],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result.currentStreak).toBe(1);
    expect(result.isActiveToday).toBe(true);
  });

  it('counts a 5-day consecutive streak in "all" mode', () => {
    const result = computeCurrentStreak({
      activityDates: [
        utc('2026-04-16'),
        utc('2026-04-17'),
        utc('2026-04-18'),
        utc('2026-04-19'),
        utc('2026-04-20'),
      ],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result.currentStreak).toBe(5);
  });

  it('in "weekdays" mode, Mon-Fri counts as 5 even if weekend is empty', () => {
    // Activity on all weekdays of one week. Today = Friday.
    const result = computeCurrentStreak({
      activityDates: [
        MON_APR_13,
        utc('2026-04-14'),
        utc('2026-04-15'),
        utc('2026-04-16'),
        FRI_APR_17,
      ],
      frozenDates: [],
      today: FRI_APR_17,
      streakGoalDays: 'weekdays',
    });
    expect(result.currentStreak).toBe(5);
    expect(result.isActiveToday).toBe(true);
  });

  it('in "weekdays" mode, being inactive on Saturday does not break the streak', () => {
    // Active Mon-Fri, query on Sat. Reference = Fri → streak counts.
    const result = computeCurrentStreak({
      activityDates: [
        MON_APR_13,
        utc('2026-04-14'),
        utc('2026-04-15'),
        utc('2026-04-16'),
        FRI_APR_17,
      ],
      frozenDates: [],
      today: SAT_APR_18,
      streakGoalDays: 'weekdays',
    });
    expect(result.currentStreak).toBe(5);
  });

  it('freeze days count as active for the streak', () => {
    // Only 3 of the last 4 days have real activity; the 4th is a freeze.
    const result = computeCurrentStreak({
      activityDates: [utc('2026-04-17'), utc('2026-04-18'), utc('2026-04-20')],
      frozenDates: [utc('2026-04-19')],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result.currentStreak).toBe(4);
  });

  it('breaks streak on the first missing day walking back', () => {
    const result = computeCurrentStreak({
      activityDates: [utc('2026-04-18'), utc('2026-04-20')], // gap on 04-19
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    // Today counts, expected walks back to 04-19 which is missing → stops.
    expect(result.currentStreak).toBe(1);
  });

  it('returns isActiveToday=false when no activity today, but streak still reflects yesterday', () => {
    const result = computeCurrentStreak({
      activityDates: [utc('2026-04-18'), utc('2026-04-19')],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result.isActiveToday).toBe(false);
    expect(result.currentStreak).toBe(2); // yesterday + day before
  });

  it('sets lastCountedDate to the most recent goal-day activity', () => {
    const result = computeCurrentStreak({
      activityDates: [MON_APR_13, FRI_APR_17],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(key(result.lastCountedDate!)).toBe('2026-04-17');
  });
});

// ─── computeLongestStreak ───────────────────────────────────────────────────

describe('computeLongestStreak', () => {
  it('returns 0 with no activity', () => {
    const result = computeLongestStreak({
      activityDates: [],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result).toBe(0);
  });

  it('returns 1 with a single day of activity', () => {
    const result = computeLongestStreak({
      activityDates: [MON_APR_13],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result).toBe(1);
  });

  it('detects the longest run across multiple gaps', () => {
    const result = computeLongestStreak({
      activityDates: [
        // Run of 3: 01, 02, 03
        utc('2026-03-01'),
        utc('2026-03-02'),
        utc('2026-03-03'),
        // gap
        // Run of 5: 10, 11, 12, 13, 14
        utc('2026-03-10'),
        utc('2026-03-11'),
        utc('2026-03-12'),
        utc('2026-03-13'),
        utc('2026-03-14'),
      ],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result).toBe(5);
  });

  it('treats Sat/Sun as non-gaps in "weekdays" mode', () => {
    // Active every weekday over 2 weeks; weekends don't break it.
    const result = computeLongestStreak({
      activityDates: [
        MON_APR_13,
        utc('2026-04-14'),
        utc('2026-04-15'),
        utc('2026-04-16'),
        FRI_APR_17,
        MON_APR_20,
      ],
      frozenDates: [],
      today: MON_APR_20,
      streakGoalDays: 'weekdays',
    });
    expect(result).toBe(6);
  });

  it('counts freeze days inside the run', () => {
    const result = computeLongestStreak({
      activityDates: [utc('2026-04-14'), utc('2026-04-16')],
      frozenDates: [utc('2026-04-15')],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result).toBe(3);
  });

  it('deduplicates when activity and freeze share the same date', () => {
    const result = computeLongestStreak({
      activityDates: [utc('2026-04-14')],
      frozenDates: [utc('2026-04-14')],
      today: MON_APR_20,
      streakGoalDays: 'all',
    });
    expect(result).toBe(1);
  });
});
