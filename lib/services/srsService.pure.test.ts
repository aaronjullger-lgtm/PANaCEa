// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for pure, data-in/data-out functions in lib/services/srsService.ts
 *
 * Functions tested (no localStorage, no side effects):
 *   formatNextReview       — human-readable label for a due date
 *   calculateForgettingCurve — Ebbinghaus-style retention points
 *   getRetentionStats      — aggregate retention stats for an item array
 *
 * NOTE: Functions that read from localStorage (getNextQuestions, getDueCards, etc.)
 * are excluded — they require jsdom + mock storage.
 */

import { describe, it, expect } from 'vitest';
import {
  formatNextReview,
  calculateForgettingCurve,
  getRetentionStats,
  type SRSItem,
} from './srsService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSRSItem(overrides: Partial<SRSItem> = {}): SRSItem {
  const now = new Date();
  return {
    id: 'item-1',
    userId: 'user-1',
    questionId: 'q-1',
    interval: 7,
    repetition: 3,
    easiness: 2.5,
    dueDate: now,
    lastReviewed: now,
    quality: 4,
    difficulty: 0.3,
    stabilityScore: 0.8,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

// ─── formatNextReview ─────────────────────────────────────────────────────────

describe('formatNextReview', () => {
  it('returns "Due now" for a date exactly now (or very slightly in past within same hour)', () => {
    // Date exactly now → diffDays=0, diffHours=0 → "Due now"
    const now = new Date();
    const result = formatNextReview(now);
    expect(result).toBe('Due now');
  });

  it('returns hours label for a date a few hours in the future', () => {
    const future = new Date(Date.now() + 3 * 60 * 60 * 1000 + 60_000); // 3h + 1min
    const result = formatNextReview(future);
    expect(result).toContain('3 hours');
  });

  it('uses singular "hour" for exactly 1 hour in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000 + 60_000); // 1h + 1min
    const result = formatNextReview(future);
    expect(result).toBe('1 hour');
  });

  it('returns "Tomorrow" for a date 1 day in the future', () => {
    const result = formatNextReview(daysFromNow(1.5)); // > 1 day but < 2
    // diffDays=1 → "Tomorrow"
    expect(result).toBe('Tomorrow');
  });

  it('returns days label for 2-6 days in the future', () => {
    const result = formatNextReview(daysFromNow(3));
    expect(result).toBe('3 days');
  });

  it('returns weeks label for 7-29 days in the future', () => {
    const result = formatNextReview(daysFromNow(14));
    expect(result).toBe('2 weeks');
  });

  it('uses singular "week" for 7 days', () => {
    const result = formatNextReview(daysFromNow(7));
    expect(result).toBe('1 week');
  });

  it('returns months label for >= 30 days in the future', () => {
    const result = formatNextReview(daysFromNow(60));
    expect(result).toBe('2 months');
  });

  it('uses singular "month" for 30 days', () => {
    const result = formatNextReview(daysFromNow(30));
    expect(result).toBe('1 month');
  });

  it('returns overdue label for a date in the past', () => {
    const past = daysFromNow(-3);
    const result = formatNextReview(past);
    expect(result).toContain('overdue');
    expect(result).toContain('3');
  });

  it('uses singular "day" for 1 day overdue', () => {
    // Math.floor(-0.5) = -1 → abs(diffDays) = 1 → "1 day overdue"
    const past = daysFromNow(-0.5);
    const result = formatNextReview(past);
    expect(result).toBe('1 day overdue');
  });

  it('uses plural "days" for 2+ days overdue', () => {
    const past = daysFromNow(-2.5);
    const result = formatNextReview(past);
    expect(result).toContain('days overdue');
  });
});

// ─── calculateForgettingCurve ─────────────────────────────────────────────────

describe('calculateForgettingCurve', () => {
  it('returns an array of data points', () => {
    const item = makeSRSItem({ interval: 7, easiness: 2.5, repetition: 3 });
    const points = calculateForgettingCurve(item);
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
  });

  it('first point has daysSinceReview=0 with label "Now"', () => {
    const item = makeSRSItem({ interval: 7 });
    const points = calculateForgettingCurve(item);
    expect(points[0]!.daysSinceReview).toBe(0);
    expect(points[0]!.label).toBe('Now');
  });

  it('retentionProbability starts near 100 at day 0', () => {
    const item = makeSRSItem({ interval: 7, easiness: 2.5, repetition: 3 });
    const points = calculateForgettingCurve(item);
    expect(points[0]!.retentionProbability).toBeCloseTo(100, 0);
  });

  it('retention decreases over time (monotonically non-increasing)', () => {
    const item = makeSRSItem({ interval: 10, easiness: 2.5, repetition: 3 });
    const points = calculateForgettingCurve(item);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.retentionProbability).toBeLessThanOrEqual(
        points[i - 1]!.retentionProbability + 0.001 // tolerance for floating-point
      );
    }
  });

  it('retentionProbability is always in [0, 100]', () => {
    const item = makeSRSItem({ interval: 7 });
    const points = calculateForgettingCurve(item);
    for (const p of points) {
      expect(p.retentionProbability).toBeGreaterThanOrEqual(0);
      expect(p.retentionProbability).toBeLessThanOrEqual(100);
    }
  });

  it('a point at item.interval is labeled "Next Review"', () => {
    const item = makeSRSItem({ interval: 7 });
    const points = calculateForgettingCurve(item);
    const nextReviewPoint = points.find(p => p.label === 'Next Review');
    expect(nextReviewPoint).toBeDefined();
    expect(nextReviewPoint!.daysSinceReview).toBe(7);
  });

  it('higher easiness produces slower forgetting (higher retention at same day)', () => {
    const easy = makeSRSItem({ interval: 10, easiness: 3.0, repetition: 3 });
    const hard = makeSRSItem({ interval: 10, easiness: 1.5, repetition: 3 });
    const easyPoints = calculateForgettingCurve(easy);
    const hardPoints = calculateForgettingCurve(hard);
    // Both have same interval=10 days → compare retention at the "Next Review" point
    const easyNR = easyPoints.find(p => p.label === 'Next Review')!;
    const hardNR = hardPoints.find(p => p.label === 'Next Review')!;
    expect(easyNR.retentionProbability).toBeGreaterThan(hardNR.retentionProbability);
  });

  it('each point has daysSinceReview, retentionProbability, and label fields', () => {
    const item = makeSRSItem({ interval: 5 });
    const points = calculateForgettingCurve(item);
    for (const p of points) {
      expect(typeof p.daysSinceReview).toBe('number');
      expect(typeof p.retentionProbability).toBe('number');
      expect(typeof p.label).toBe('string');
    }
  });
});

// ─── getRetentionStats ────────────────────────────────────────────────────────

describe('getRetentionStats', () => {
  it('returns zeros for empty array', () => {
    const stats = getRetentionStats([]);
    expect(stats.avgRetention).toBe(0);
    expect(stats.criticalItems).toBe(0);
    expect(stats.solidItems).toBe(0);
    expect(stats.masteredItems).toBe(0);
  });

  it('returns expected fields', () => {
    const item = makeSRSItem({ lastReviewed: new Date() });
    const stats = getRetentionStats([item]);
    expect(typeof stats.avgRetention).toBe('number');
    expect(typeof stats.criticalItems).toBe('number');
    expect(typeof stats.solidItems).toBe('number');
    expect(typeof stats.masteredItems).toBe('number');
  });

  it('item reviewed just now has high retention (mastered)', () => {
    const item = makeSRSItem({
      lastReviewed: new Date(), // just now → 0 days → retention ≈ 100%
      easiness: 2.5,
      repetition: 3,
    });
    const stats = getRetentionStats([item]);
    expect(stats.masteredItems).toBe(1);
    expect(stats.criticalItems).toBe(0);
  });

  it('item last reviewed many days ago has low retention (critical)', () => {
    // Reviewed 30 days ago with low easiness → retention will be very low
    const item = makeSRSItem({
      lastReviewed: new Date(Date.now() - 30 * 86_400_000),
      easiness: 1.3,
      repetition: 1,
    });
    const stats = getRetentionStats([item]);
    expect(stats.criticalItems).toBe(1);
    expect(stats.masteredItems).toBe(0);
  });

  it('criticalItems + solidItems + masteredItems = total items', () => {
    const items = [
      makeSRSItem({ lastReviewed: new Date(), easiness: 2.5, repetition: 3 }),                   // mastered
      makeSRSItem({ lastReviewed: new Date(Date.now() - 30 * 86_400_000), easiness: 1.3, repetition: 1 }), // critical
    ];
    const stats = getRetentionStats(items);
    expect(stats.criticalItems + stats.solidItems + stats.masteredItems).toBe(2);
  });

  it('avgRetention is the mean of per-item retentions (in [0, 100])', () => {
    const item = makeSRSItem({ lastReviewed: new Date(), easiness: 2.5, repetition: 3 });
    const stats = getRetentionStats([item]);
    expect(stats.avgRetention).toBeGreaterThanOrEqual(0);
    expect(stats.avgRetention).toBeLessThanOrEqual(100);
  });

  it('handles multiple items correctly', () => {
    const items = Array.from({ length: 5 }, () =>
      makeSRSItem({ lastReviewed: new Date(), easiness: 2.5, repetition: 3 })
    );
    const stats = getRetentionStats(items);
    expect(stats.masteredItems).toBe(5);
    expect(stats.avgRetention).toBeGreaterThan(80);
  });
});
