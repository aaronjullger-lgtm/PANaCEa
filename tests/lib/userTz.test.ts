/**
 * Tests for lib/time/userTz.ts — the single source of truth for
 * user-local-calendar math used by the review forecast, study heatmap,
 * and any other dashboard widget that needs "today" to match the user's
 * wristwatch instead of UTC.
 *
 * These tests pin:
 *   - Validation of IANA zones (bad input → UTC fallback, not a throw).
 *   - `formatLocalDay` produces the *local* YYYY-MM-DD even when it differs
 *     from the UTC date (late-night West Coast, early-morning East Asia).
 *   - `startOfLocalDay` returns the UTC instant at which local midnight
 *     begins — reversible via `formatLocalDay`.
 *   - `addDaysInTz` walks calendar days cleanly across DST transitions
 *     (spring-forward and fall-back).
 *   - `getLocalYear` picks the right year at year boundaries (Dec 31 LA
 *     at 23:00 is 2026, not 2027).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TZ,
  isValidIanaTz,
  normalizeTz,
  getBrowserTimezone,
  formatLocalDay,
  getLocalYear,
  startOfLocalDay,
  startOfLocalDayFromKey,
  addDaysInTz,
} from '../../lib/time/userTz';

describe('userTz — validation', () => {
  it('accepts canonical IANA zones', () => {
    expect(isValidIanaTz('UTC')).toBe(true);
    expect(isValidIanaTz('America/Los_Angeles')).toBe(true);
    expect(isValidIanaTz('Europe/London')).toBe(true);
    expect(isValidIanaTz('Asia/Tokyo')).toBe(true);
    expect(isValidIanaTz('Australia/Sydney')).toBe(true);
  });

  it('rejects obvious junk without throwing', () => {
    expect(isValidIanaTz('not-a-tz')).toBe(false);
    expect(isValidIanaTz('')).toBe(false);
    expect(isValidIanaTz(null)).toBe(false);
    expect(isValidIanaTz(undefined)).toBe(false);
    expect(isValidIanaTz(123)).toBe(false);
  });

  it('normalizeTz returns the zone when valid, UTC when not', () => {
    expect(normalizeTz('America/New_York')).toBe('America/New_York');
    expect(normalizeTz('Pacific/Pago_Pago')).toBe('Pacific/Pago_Pago');
    expect(normalizeTz('junk')).toBe(DEFAULT_TZ);
    expect(normalizeTz(null)).toBe(DEFAULT_TZ);
    expect(normalizeTz('')).toBe(DEFAULT_TZ);
  });

  it('DEFAULT_TZ is UTC', () => {
    expect(DEFAULT_TZ).toBe('UTC');
  });
});

describe('userTz — getBrowserTimezone', () => {
  it('returns a non-empty IANA zone', () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
    expect(isValidIanaTz(tz)).toBe(true);
  });
});

describe('userTz — formatLocalDay', () => {
  it('formats as YYYY-MM-DD', () => {
    const d = new Date('2026-04-18T12:00:00Z');
    const out = formatLocalDay(d, 'UTC');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out).toBe('2026-04-18');
  });

  it('shifts the date backwards for late-night US West Coast', () => {
    // 2026-04-19T05:30:00Z is 22:30 on 2026-04-18 in Los Angeles.
    const late = new Date('2026-04-19T05:30:00Z');
    expect(formatLocalDay(late, 'America/Los_Angeles')).toBe('2026-04-18');
    // Same instant in UTC is already the next day.
    expect(formatLocalDay(late, 'UTC')).toBe('2026-04-19');
  });

  it('shifts the date forward for early-morning East Asia', () => {
    // 2026-04-18T22:00:00Z is 07:00 on 2026-04-19 in Tokyo.
    const early = new Date('2026-04-18T22:00:00Z');
    expect(formatLocalDay(early, 'Asia/Tokyo')).toBe('2026-04-19');
    expect(formatLocalDay(early, 'UTC')).toBe('2026-04-18');
  });

  it('falls back to UTC on junk tz (no throw)', () => {
    const d = new Date('2026-04-18T12:00:00Z');
    expect(formatLocalDay(d, 'junk-tz')).toBe('2026-04-18');
  });
});

describe('userTz — getLocalYear', () => {
  it('returns the user-local year', () => {
    // 2027-01-01T02:30:00Z is 2026-12-31 18:30 in Los Angeles.
    const newYearEveLA = new Date('2027-01-01T02:30:00Z');
    expect(getLocalYear(newYearEveLA, 'America/Los_Angeles')).toBe(2026);
    expect(getLocalYear(newYearEveLA, 'UTC')).toBe(2027);
  });
});

describe('userTz — startOfLocalDay', () => {
  it('returns an instant whose local formatting is YYYY-MM-DD (same day)', () => {
    const ref = new Date('2026-04-18T18:00:00Z');
    const start = startOfLocalDay('America/Los_Angeles', ref);
    // At the returned instant, LA local day must match the expected day.
    expect(formatLocalDay(start, 'America/Los_Angeles')).toBe('2026-04-18');
  });

  it('returned instant is exactly midnight local (hour=0, min=0)', () => {
    const ref = new Date('2026-06-15T18:00:00Z');
    const start = startOfLocalDay('America/New_York', ref);
    const hm = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(start);
    const hour = Number(hm.find((p) => p.type === 'hour')?.value);
    const minute = Number(hm.find((p) => p.type === 'minute')?.value);
    // `24:00` normalizes to 00:00.
    expect([0, 24]).toContain(hour);
    expect(minute).toBe(0);
  });

  it('is consistent with formatLocalDay(ref)', () => {
    const ref = new Date('2026-04-19T05:30:00Z'); // 22:30 LA prev day
    const dayKey = formatLocalDay(ref, 'America/Los_Angeles');
    const start = startOfLocalDay('America/Los_Angeles', ref);
    expect(formatLocalDay(start, 'America/Los_Angeles')).toBe(dayKey);
  });

  it('UTC tz: returns the same-day UTC midnight', () => {
    const ref = new Date('2026-04-18T15:30:00Z');
    const start = startOfLocalDay('UTC', ref);
    expect(start.toISOString()).toBe('2026-04-18T00:00:00.000Z');
  });
});

describe('userTz — startOfLocalDayFromKey', () => {
  it('matches startOfLocalDay(..., noon of that day)', () => {
    const key = '2026-04-18';
    const tz = 'America/Los_Angeles';
    const fromKey = startOfLocalDayFromKey(key, tz);
    expect(formatLocalDay(fromKey, tz)).toBe(key);
  });
});

describe('userTz — addDaysInTz', () => {
  it('advances by whole calendar days in UTC', () => {
    expect(addDaysInTz('2026-04-18', 0, 'UTC')).toBe('2026-04-18');
    expect(addDaysInTz('2026-04-18', 1, 'UTC')).toBe('2026-04-19');
    expect(addDaysInTz('2026-04-18', 7, 'UTC')).toBe('2026-04-25');
    expect(addDaysInTz('2026-04-18', -1, 'UTC')).toBe('2026-04-17');
  });

  it('handles month and year rollover', () => {
    expect(addDaysInTz('2026-04-30', 1, 'UTC')).toBe('2026-05-01');
    expect(addDaysInTz('2026-12-31', 1, 'UTC')).toBe('2027-01-01');
    expect(addDaysInTz('2026-01-01', -1, 'UTC')).toBe('2025-12-31');
  });

  it('is DST-safe across US spring-forward (2026-03-08 in LA)', () => {
    // On 2026-03-08 in America/Los_Angeles clocks jump 02:00 → 03:00.
    // Adding 1 calendar day should still return the next calendar date,
    // not be tripped up by the missing hour.
    expect(addDaysInTz('2026-03-07', 1, 'America/Los_Angeles')).toBe('2026-03-08');
    expect(addDaysInTz('2026-03-08', 1, 'America/Los_Angeles')).toBe('2026-03-09');
  });

  it('is DST-safe across US fall-back (2026-11-01 in LA)', () => {
    // On 2026-11-01 clocks fall 02:00 → 01:00.
    expect(addDaysInTz('2026-10-31', 1, 'America/Los_Angeles')).toBe('2026-11-01');
    expect(addDaysInTz('2026-11-01', 1, 'America/Los_Angeles')).toBe('2026-11-02');
  });

  it('builds a clean 7-day window via addDaysInTz', () => {
    const today = '2026-04-18';
    const window: string[] = [];
    for (let i = 0; i < 7; i++) {
      window.push(addDaysInTz(today, i, 'America/Los_Angeles'));
    }
    expect(window).toEqual([
      '2026-04-18',
      '2026-04-19',
      '2026-04-20',
      '2026-04-21',
      '2026-04-22',
      '2026-04-23',
      '2026-04-24',
    ]);
  });
});
