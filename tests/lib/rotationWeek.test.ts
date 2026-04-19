/**
 * Tests for lib/time/rotationWeek.ts — the DST-safe replacement for the
 * old inlined `Math.floor(diffMs / (7*86400000)) + 1` formula.
 *
 * These pin:
 *   - Input robustness: null/undefined/invalid/bare-YYYY-MM-DD/ISO/Date.
 *   - Week boundary correctness at day 1/7/8.
 *   - DST immunity on both spring-forward (2026-03-08 LA) and fall-back
 *     (2026-11-01 LA) — the exact scenarios the old formula got wrong.
 *   - Graceful degradation on junk tz (falls back to UTC, does not throw).
 *   - Pre-start guard returns 1, not 0 or a negative.
 */

import { describe, it, expect } from 'vitest';
import { computeRotationWeek, computeRotationDay } from '../../lib/time/rotationWeek';

describe('computeRotationWeek — input validation', () => {
  it('returns undefined for null/undefined/empty', () => {
    expect(computeRotationWeek(null)).toBeUndefined();
    expect(computeRotationWeek(undefined)).toBeUndefined();
    expect(computeRotationWeek('')).toBeUndefined();
  });

  it('returns undefined for unparseable strings', () => {
    expect(computeRotationWeek('not-a-date')).toBeUndefined();
    expect(computeRotationWeek('2026-13-99')).toBeUndefined();
  });

  it('returns undefined for an invalid Date', () => {
    expect(computeRotationWeek(new Date('nope'))).toBeUndefined();
  });

  it('accepts a bare YYYY-MM-DD key', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'America/Los_Angeles',
      new Date('2026-04-18T18:00:00Z')
    );
    expect(week).toBe(3); // day 18 of rotation → Week 3
  });

  it('accepts a full ISO timestamp', () => {
    const week = computeRotationWeek(
      '2026-04-01T12:00:00Z',
      'America/Los_Angeles',
      new Date('2026-04-18T18:00:00Z')
    );
    expect(week).toBe(3);
  });

  it('accepts a Date instance', () => {
    const week = computeRotationWeek(
      new Date('2026-04-01T12:00:00Z'),
      'America/Los_Angeles',
      new Date('2026-04-18T18:00:00Z')
    );
    expect(week).toBe(3);
  });
});

describe('computeRotationWeek — week boundaries', () => {
  it('day 1 (same day as start) is Week 1', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'UTC',
      new Date('2026-04-01T12:00:00Z')
    );
    expect(week).toBe(1);
  });

  it('day 7 is still Week 1', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'UTC',
      new Date('2026-04-07T12:00:00Z')
    );
    expect(week).toBe(1);
  });

  it('day 8 is Week 2', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'UTC',
      new Date('2026-04-08T12:00:00Z')
    );
    expect(week).toBe(2);
  });

  it('day 14 is Week 2', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'UTC',
      new Date('2026-04-14T12:00:00Z')
    );
    expect(week).toBe(2);
  });

  it('day 15 is Week 3', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'UTC',
      new Date('2026-04-15T12:00:00Z')
    );
    expect(week).toBe(3);
  });

  it('returns 1 (not 0 or negative) when `now` is before the start date', () => {
    const week = computeRotationWeek(
      '2026-04-10',
      'UTC',
      new Date('2026-04-01T12:00:00Z')
    );
    expect(week).toBe(1);
  });
});

describe('computeRotationWeek — DST immunity', () => {
  // The old inlined formula `Math.floor(diffMs / (7*86400000)) + 1` loses
  // one hour on each DST spring-forward. A rotation beginning 2026-03-01 in
  // LA crosses 2026-03-08 (clocks jump 02:00 → 03:00). Any reference instant
  // close to the week-5 boundary used to flip a day early.
  it('spring-forward: rotation start 2026-03-01 LA, now 2026-03-29 LA → Week 5', () => {
    // 2026-03-29 in LA is day 29 of rotation (March 1 = day 1).
    // Math.floor(28/7) + 1 = 5. The old diffMs formula tipped to Week 6 here
    // because 28 *calendar* days is only 28*24h - 1h = 671h after DST spring.
    const week = computeRotationWeek(
      '2026-03-01',
      'America/Los_Angeles',
      new Date('2026-03-29T19:00:00Z') // 12:00 local LA
    );
    expect(week).toBe(5);
  });

  it('spring-forward edge: now is midnight local LA on week boundary', () => {
    // 2026-03-08 is day 8 of rotation (start 2026-03-01) → Week 2.
    // DST happens overnight; pick 08:00 UTC = 00:00 PDT (after the jump).
    const week = computeRotationWeek(
      '2026-03-01',
      'America/Los_Angeles',
      new Date('2026-03-08T08:00:00Z')
    );
    expect(week).toBe(2);
  });

  it('fall-back: rotation start 2026-10-01 LA, now 2026-11-08 LA → Week 6', () => {
    // 2026-11-01 LA clocks fall 02:00 → 01:00. Day 39 of rotation.
    // Math.floor(38/7) + 1 = 6. The old formula went to Week 7 here.
    const week = computeRotationWeek(
      '2026-10-01',
      'America/Los_Angeles',
      new Date('2026-11-08T20:00:00Z') // 12:00 local LA
    );
    expect(week).toBe(6);
  });
});

describe('computeRotationWeek — tz fallback', () => {
  it('junk tz falls back to UTC (no throw)', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      'not-a-real-tz',
      new Date('2026-04-08T12:00:00Z')
    );
    expect(week).toBe(2);
  });

  it('default tz (UTC) works when caller omits it', () => {
    const week = computeRotationWeek(
      '2026-04-01',
      undefined,
      new Date('2026-04-15T12:00:00Z')
    );
    expect(week).toBe(3);
  });
});

describe('computeRotationDay — day counter', () => {
  it('returns 1 on the start day', () => {
    expect(
      computeRotationDay('2026-04-01', 'UTC', new Date('2026-04-01T12:00:00Z'))
    ).toBe(1);
  });

  it('returns 7 at day 7', () => {
    expect(
      computeRotationDay('2026-04-01', 'UTC', new Date('2026-04-07T12:00:00Z'))
    ).toBe(7);
  });

  it('returns 8 at the start of week 2', () => {
    expect(
      computeRotationDay('2026-04-01', 'UTC', new Date('2026-04-08T12:00:00Z'))
    ).toBe(8);
  });

  it('returns 1 when rotation has not started', () => {
    expect(
      computeRotationDay('2026-04-10', 'UTC', new Date('2026-04-01T12:00:00Z'))
    ).toBe(1);
  });

  it('is DST-safe across spring-forward', () => {
    // 2026-03-29 in LA is day 29 of a rotation that began 2026-03-01.
    const day = computeRotationDay(
      '2026-03-01',
      'America/Los_Angeles',
      new Date('2026-03-29T19:00:00Z')
    );
    expect(day).toBe(29);
  });

  it('returns undefined on bad input', () => {
    expect(computeRotationDay(null)).toBeUndefined();
    expect(computeRotationDay('junk')).toBeUndefined();
  });
});
