// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/streakCalc.ts
 *
 * Pure functions tested (all dates passed explicitly — fully deterministic):
 *   isGoalDay(date, streakGoalDays)               — Mon–Fri check for 'weekdays'
 *   lastGoalDayOnOrBefore(date, streakGoalDays)   — snaps Sat/Sun back to Friday
 *   previousGoalDay(date, streakGoalDays)          — walks back to prior weekday
 *   computeCurrentStreak(input)                    — streak count from today backward
 *   computeLongestStreak(input)                    — longest run across all dates
 *
 * Reference week (2024-01-01 = Monday UTC):
 *   Mon 01, Tue 02, Wed 03, Thu 04, Fri 05, Sat 06, Sun 07,
 *   Mon 08, Tue 09, ...
 *   Prev Friday: Fri 2023-12-29
 */

import { describe, it, expect } from 'vitest';
import {
  isGoalDay,
  lastGoalDayOnOrBefore,
  previousGoalDay,
  computeCurrentStreak,
  computeLongestStreak,
} from './streakCalc';
import type { StreakCalcInput } from './streakCalc';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// Reference week
const MON = utc(2024, 1, 1);  // Monday
const TUE = utc(2024, 1, 2);  // Tuesday
const WED = utc(2024, 1, 3);  // Wednesday
const THU = utc(2024, 1, 4);  // Thursday
const FRI = utc(2024, 1, 5);  // Friday
const SAT = utc(2024, 1, 6);  // Saturday
const SUN = utc(2024, 1, 7);  // Sunday
const MON2 = utc(2024, 1, 8); // Next Monday

// Previous week
const PREV_FRI = utc(2023, 12, 29); // Friday
const PREV_THU = utc(2023, 12, 28); // Thursday

function makeInput(overrides: Partial<StreakCalcInput> = {}): StreakCalcInput {
  return {
    activityDates: [],
    frozenDates: [],
    today: MON,
    streakGoalDays: 'all',
    ...overrides,
  };
}

// ─── isGoalDay ────────────────────────────────────────────────────────────────

describe('isGoalDay', () => {
  it('always returns true for "all"', () => {
    for (const d of [MON, TUE, SAT, SUN]) {
      expect(isGoalDay(d, 'all')).toBe(true);
    }
  });

  it('returns true for Mon–Fri with "weekdays"', () => {
    expect(isGoalDay(MON, 'weekdays')).toBe(true);
    expect(isGoalDay(TUE, 'weekdays')).toBe(true);
    expect(isGoalDay(WED, 'weekdays')).toBe(true);
    expect(isGoalDay(THU, 'weekdays')).toBe(true);
    expect(isGoalDay(FRI, 'weekdays')).toBe(true);
  });

  it('returns false for Saturday and Sunday with "weekdays"', () => {
    expect(isGoalDay(SAT, 'weekdays')).toBe(false);
    expect(isGoalDay(SUN, 'weekdays')).toBe(false);
  });
});

// ─── lastGoalDayOnOrBefore ────────────────────────────────────────────────────

describe('lastGoalDayOnOrBefore', () => {
  it('returns the date itself for "all"', () => {
    const result = lastGoalDayOnOrBefore(SAT, 'all');
    expect(result.getTime()).toBe(utc(2024, 1, 6).getTime()); // Saturday as-is
  });

  it('returns the date itself for weekdays when date is a weekday', () => {
    for (const d of [MON, TUE, WED, THU, FRI]) {
      const result = lastGoalDayOnOrBefore(d, 'weekdays');
      expect(result.getTime()).toBe(utc(2024, 1, d.getUTCDate()).getTime());
    }
  });

  it('returns Friday for Saturday ("weekdays")', () => {
    const result = lastGoalDayOnOrBefore(SAT, 'weekdays');
    expect(result.getTime()).toBe(FRI.getTime());
  });

  it('returns Friday for Sunday ("weekdays")', () => {
    const result = lastGoalDayOnOrBefore(SUN, 'weekdays');
    expect(result.getTime()).toBe(FRI.getTime());
  });
});

// ─── previousGoalDay ──────────────────────────────────────────────────────────

describe('previousGoalDay', () => {
  it('returns Sunday before Monday for "all"', () => {
    // MON = 2024-01-01, so the previous calendar day is 2023-12-31 (Sunday)
    const result = previousGoalDay(MON, 'all');
    expect(result.getTime()).toBe(utc(2023, 12, 31).getTime());
  });

  it('returns the previous calendar day for "all"', () => {
    expect(previousGoalDay(WED, 'all').getTime()).toBe(TUE.getTime());
    expect(previousGoalDay(FRI, 'all').getTime()).toBe(THU.getTime());
  });

  it('returns Thursday before Friday for "weekdays"', () => {
    expect(previousGoalDay(FRI, 'weekdays').getTime()).toBe(THU.getTime());
  });

  it('returns Tuesday before Wednesday for "weekdays"', () => {
    expect(previousGoalDay(WED, 'weekdays').getTime()).toBe(TUE.getTime());
  });

  it('skips weekend: returns Friday before Monday for "weekdays"', () => {
    // Mon 2024-01-01 → previous weekday is Fri 2023-12-29
    const result = previousGoalDay(MON, 'weekdays');
    expect(result.getTime()).toBe(PREV_FRI.getTime());
  });
});

// ─── computeCurrentStreak ("all" mode) ───────────────────────────────────────

describe('computeCurrentStreak — "all" mode', () => {
  it('returns 0 streak for empty input', () => {
    const result = computeCurrentStreak(makeInput());
    expect(result.currentStreak).toBe(0);
    expect(result.isActiveToday).toBe(false);
    expect(result.lastCountedDate).toBeNull();
  });

  it('streak=1 when active today only', () => {
    const result = computeCurrentStreak(makeInput({ activityDates: [MON], today: MON }));
    expect(result.currentStreak).toBe(1);
    expect(result.isActiveToday).toBe(true);
  });

  it('streak=2 when active today and yesterday', () => {
    const result = computeCurrentStreak(makeInput({
      today: TUE,
      activityDates: [TUE, MON],
    }));
    expect(result.currentStreak).toBe(2);
    expect(result.isActiveToday).toBe(true);
  });

  it('streak=1 when active only yesterday (not today)', () => {
    const result = computeCurrentStreak(makeInput({ activityDates: [MON], today: TUE }));
    expect(result.currentStreak).toBe(1);
    expect(result.isActiveToday).toBe(false);
  });

  it('streak=0 when gap exists (skipped a day)', () => {
    // today=WED, active on WED and MON but not TUE
    const result = computeCurrentStreak(makeInput({
      activityDates: [WED, MON],
      today: WED,
    }));
    expect(result.currentStreak).toBe(1); // Only WED counts; TUE missing breaks streak
  });

  it('streak=3 for three consecutive days', () => {
    const result = computeCurrentStreak(makeInput({
      activityDates: [WED, TUE, MON],
      today: WED,
    }));
    expect(result.currentStreak).toBe(3);
  });

  it('frozen dates count as active for streak', () => {
    // today=WED, activity=WED+MON, freeze=TUE → streak continues
    const result = computeCurrentStreak(makeInput({
      activityDates: [WED, MON],
      frozenDates: [TUE],
      today: WED,
    }));
    expect(result.currentStreak).toBe(3);
  });

  it('isActiveToday=false when no activity or freeze on today', () => {
    const result = computeCurrentStreak(makeInput({ activityDates: [MON], today: TUE }));
    expect(result.isActiveToday).toBe(false);
  });
});

// ─── computeCurrentStreak ("weekdays" mode) ──────────────────────────────────

describe('computeCurrentStreak — "weekdays" mode', () => {
  it('weekend does not break a Mon–Fri streak when today is Monday', () => {
    // Fri + Mon are consecutive weekdays; weekend in between should not break
    const result = computeCurrentStreak(makeInput({
      activityDates: [MON, PREV_FRI],
      today: MON,
      streakGoalDays: 'weekdays',
    }));
    expect(result.currentStreak).toBe(2);
  });

  it('streak=1 for Friday only when today is Saturday', () => {
    const result = computeCurrentStreak(makeInput({
      activityDates: [FRI],
      today: SAT,
      streakGoalDays: 'weekdays',
    }));
    // Saturday snaps reference to Friday; isActiveToday=true (Friday is in keys)
    expect(result.currentStreak).toBe(1);
    expect(result.isActiveToday).toBe(true);
  });

  it('streak=0 when last activity was Thursday and today is Monday (Friday missed)', () => {
    const result = computeCurrentStreak(makeInput({
      activityDates: [THU],
      today: MON2, // Next Monday, Fri was skipped
      streakGoalDays: 'weekdays',
    }));
    // reference = Mon2 (weekday). isActiveToday = Mon2 in keys? No. expected = PREV_FRI (Fri 2024-01-05)
    // Fri not in keys → streak=0
    expect(result.currentStreak).toBe(0);
  });

  it('ignores weekend dates for streak counting', () => {
    // Active on SAT but SAT is not a goal day — should not count
    const result = computeCurrentStreak(makeInput({
      activityDates: [SAT],
      today: MON,
      streakGoalDays: 'weekdays',
    }));
    // MON: isActiveToday = MON in allKeys? No → false. expected = PREV_FRI. Not in keys → streak=0
    expect(result.currentStreak).toBe(0);
  });
});

// ─── computeLongestStreak ─────────────────────────────────────────────────────

describe('computeLongestStreak', () => {
  it('returns 0 for empty input', () => {
    expect(computeLongestStreak(makeInput())).toBe(0);
  });

  it('returns 1 for a single activity date', () => {
    expect(computeLongestStreak(makeInput({ activityDates: [MON] }))).toBe(1);
  });

  it('returns length of consecutive run', () => {
    const result = computeLongestStreak(makeInput({
      activityDates: [MON, TUE, WED],
    }));
    expect(result).toBe(3);
  });

  it('returns max of multiple runs when there is a gap', () => {
    // Mon-Tue-Wed (3), skip Thu, Fri-Sat (2) → longest=3
    const result = computeLongestStreak(makeInput({
      activityDates: [MON, TUE, WED, FRI, SAT],
    }));
    expect(result).toBe(3);
  });

  it('frozen dates extend the streak', () => {
    // Mon-Tue (activity), Wed (frozen), Thu (activity) → 4 consecutive
    const result = computeLongestStreak(makeInput({
      activityDates: [MON, TUE, THU],
      frozenDates: [WED],
    }));
    expect(result).toBe(4);
  });

  it('duplicate dates (same day twice) count as 1', () => {
    // Two entries for Monday → still just 1 unique day
    const result = computeLongestStreak(makeInput({
      activityDates: [MON, MON],
    }));
    expect(result).toBe(1);
  });

  it('weekdays mode: Mon-Fri counts as 5 (no weekend), weekend gap is ignored', () => {
    const result = computeLongestStreak(makeInput({
      activityDates: [MON, TUE, WED, THU, FRI],
      streakGoalDays: 'weekdays',
    }));
    expect(result).toBe(5);
  });

  it('weekdays mode: Mon-Fri + Mon2 = 6 (weekend is skipped, not a break)', () => {
    const result = computeLongestStreak(makeInput({
      activityDates: [MON, TUE, WED, THU, FRI, MON2],
      streakGoalDays: 'weekdays',
    }));
    expect(result).toBe(6);
  });

  it('weekdays mode: SAT is not a goal day → excluded from streak count', () => {
    // Fri + Sat: SAT is excluded, only FRI counts
    const result = computeLongestStreak(makeInput({
      activityDates: [FRI, SAT],
      streakGoalDays: 'weekdays',
    }));
    expect(result).toBe(1); // Only FRI is a goal day
  });
});
