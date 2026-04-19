import { describe, it, expect } from 'vitest';
import {
  FRESHNESS_SLA_DAYS,
  AGING_SLA_DAYS,
  getFreshnessState,
  formatAge,
} from './content-freshness';

describe('content-freshness', () => {
  const NOW = new Date('2026-04-17T12:00:00Z');

  function daysAgo(n: number): Date {
    return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
  }

  it('returns "unknown" for null/undefined/empty inputs', () => {
    expect(getFreshnessState(null, NOW).state).toBe('unknown');
    expect(getFreshnessState(undefined, NOW).state).toBe('unknown');
    expect(getFreshnessState('', NOW).state).toBe('unknown');
  });

  it('returns "unknown" for invalid date strings', () => {
    const r = getFreshnessState('not-a-date', NOW);
    expect(r.state).toBe('unknown');
    expect(r.ageInDays).toBeNull();
    expect(r.referenceDate).toBeNull();
  });

  it('classifies dates within the 90-day SLA as fresh', () => {
    expect(getFreshnessState(daysAgo(0), NOW).state).toBe('fresh');
    expect(getFreshnessState(daysAgo(30), NOW).state).toBe('fresh');
    expect(getFreshnessState(daysAgo(FRESHNESS_SLA_DAYS), NOW).state).toBe('fresh');
  });

  it('classifies 91–180 day content as aging', () => {
    expect(getFreshnessState(daysAgo(FRESHNESS_SLA_DAYS + 1), NOW).state).toBe('aging');
    expect(getFreshnessState(daysAgo(AGING_SLA_DAYS), NOW).state).toBe('aging');
  });

  it('classifies content older than 180 days as stale', () => {
    expect(getFreshnessState(daysAgo(AGING_SLA_DAYS + 1), NOW).state).toBe('stale');
    expect(getFreshnessState(daysAgo(365), NOW).state).toBe('stale');
    expect(getFreshnessState(daysAgo(1000), NOW).state).toBe('stale');
  });

  it('accepts ISO strings as well as Date instances', () => {
    const iso = daysAgo(30).toISOString();
    const r = getFreshnessState(iso, NOW);
    expect(r.state).toBe('fresh');
    expect(r.ageInDays).toBe(30);
    expect(r.referenceDate).toBeInstanceOf(Date);
  });

  it('treats future timestamps as fresh (ageInDays clamped to 0)', () => {
    const future = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
    const r = getFreshnessState(future, NOW);
    expect(r.state).toBe('fresh');
    expect(r.ageInDays).toBe(0);
  });

  describe('formatAge', () => {
    it('returns "never" for null', () => {
      expect(formatAge(null)).toBe('never');
    });
    it('returns "today" for 0 days', () => {
      expect(formatAge(0)).toBe('today');
    });
    it('returns days when < 7', () => {
      expect(formatAge(3)).toBe('3d');
      expect(formatAge(6)).toBe('6d');
    });
    it('returns weeks when 7–29', () => {
      expect(formatAge(7)).toBe('1w');
      expect(formatAge(29)).toBe('4w');
    });
    it('returns months when 30–364', () => {
      expect(formatAge(30)).toBe('1mo');
      expect(formatAge(180)).toBe('6mo');
    });
    it('returns years when ≥ 365', () => {
      expect(formatAge(365)).toBe('1y');
      expect(formatAge(800)).toBe('2y');
    });
  });
});
