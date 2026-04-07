/**
 * Interval Display Utility Tests
 *
 * Validates the fractional-interval-safe display utilities that form
 * the FSRS-7 migration boundary layer.
 */

import { describe, it, expect } from 'vitest';
import {
  roundIntervalForDisplay,
  formatIntervalDays,
  intervalToDate,
} from '../lib/utils/intervalDisplay';

describe('roundIntervalForDisplay', () => {
  it('should round fractional days to nearest integer', () => {
    expect(roundIntervalForDisplay(2.3)).toBe(2);
    expect(roundIntervalForDisplay(2.7)).toBe(3);
    expect(roundIntervalForDisplay(0.5)).toBe(1); // minimum 1
    expect(roundIntervalForDisplay(1.0)).toBe(1);
  });

  it('should floor at 1 day minimum', () => {
    expect(roundIntervalForDisplay(0)).toBe(1);
    expect(roundIntervalForDisplay(0.1)).toBe(1);
    expect(roundIntervalForDisplay(-5)).toBe(1);
  });

  it('should handle NaN and Infinity', () => {
    expect(roundIntervalForDisplay(NaN)).toBe(1);
    expect(roundIntervalForDisplay(Infinity)).toBe(1);
    expect(roundIntervalForDisplay(-Infinity)).toBe(1);
  });

  it('should pass through whole numbers unchanged', () => {
    expect(roundIntervalForDisplay(7)).toBe(7);
    expect(roundIntervalForDisplay(30)).toBe(30);
    expect(roundIntervalForDisplay(365)).toBe(365);
  });
});

describe('formatIntervalDays', () => {
  it('should return "today" for 0 or sub-day intervals', () => {
    expect(formatIntervalDays(0)).toBe('today');
    expect(formatIntervalDays(0.3)).toBe('today');
    expect(formatIntervalDays(-1)).toBe('today');
  });

  it('should return "tomorrow" for ~1 day', () => {
    expect(formatIntervalDays(1)).toBe('tomorrow');
    expect(formatIntervalDays(0.8)).toBe('tomorrow'); // rounds to 1
    expect(formatIntervalDays(1.4)).toBe('tomorrow'); // rounds to 1
  });

  it('should return days for 2-6', () => {
    expect(formatIntervalDays(3)).toBe('in 3 days');
    expect(formatIntervalDays(3.7)).toBe('in 4 days'); // fractional rounded
    expect(formatIntervalDays(6)).toBe('in 6 days');
  });

  it('should return weeks for 7-29', () => {
    expect(formatIntervalDays(7)).toBe('in 1 week');
    expect(formatIntervalDays(14)).toBe('in 2 weeks');
    expect(formatIntervalDays(21)).toBe('in 3 weeks');
  });

  it('should return months for 30-364', () => {
    expect(formatIntervalDays(30)).toBe('in 1 month');
    expect(formatIntervalDays(60)).toBe('in 2 months');
    expect(formatIntervalDays(180)).toBe('in 6 months');
  });

  it('should return years for 365+', () => {
    expect(formatIntervalDays(365)).toBe('in 1 year');
    expect(formatIntervalDays(730)).toBe('in 2 years');
  });

  it('should handle NaN and Infinity gracefully', () => {
    expect(formatIntervalDays(NaN)).toBe('today');
    expect(formatIntervalDays(Infinity)).toBe('today');
  });
});

describe('intervalToDate', () => {
  it('should add fractional days precisely', () => {
    const base = new Date('2026-04-07T12:00:00Z');
    const result = intervalToDate(2.5, base);
    // 2.5 days = 60 hours
    const expectedMs = base.getTime() + 2.5 * 24 * 60 * 60 * 1000;
    expect(result.getTime()).toBe(expectedMs);
  });

  it('should handle zero interval', () => {
    const base = new Date('2026-04-07T12:00:00Z');
    const result = intervalToDate(0, base);
    expect(result.getTime()).toBe(base.getTime());
  });

  it('should handle whole-day intervals', () => {
    const base = new Date('2026-04-07T12:00:00Z');
    const result = intervalToDate(7, base);
    const expectedMs = base.getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(result.getTime()).toBe(expectedMs);
  });

  it('should default to now when no base date provided', () => {
    const before = Date.now();
    const result = intervalToDate(1);
    const after = Date.now();
    const expected = before + 24 * 60 * 60 * 1000;
    // Should be within a reasonable margin (~100ms for test execution)
    expect(result.getTime()).toBeGreaterThanOrEqual(expected - 100);
    expect(result.getTime()).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100);
  });
});
