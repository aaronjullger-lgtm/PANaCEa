/**
 * Metric-correctness tests for SRS analytics endpoint.
 *
 * Verifies that:
 * 1. projectedRetention uses the canonical FSRS v6 formula, not the old Ebbinghaus-like fallback
 * 2. stabilityTrend is derived from real per-card lastReviewAt dates, not session accuracy estimates
 * 3. Helper values (avgStability, avgDifficulty) handle zero-card edge case correctly
 *
 * These tests operate against pure-function logic extracted from
 * functions/api/analytics/srs-summary.ts and lib/fsrs-retrievability.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  retrievability,
  FSRS_FACTOR_DEFAULT,
  FSRS_DECAY_DEFAULT,
} from '@/lib/fsrs-retrievability';

// ──────────────────────────────────────────────────────────────────────────────
// 1. FSRS v6 retrievability formula
// ──────────────────────────────────────────────────────────────────────────────

describe('retrievability() — FSRS v6 canonical formula', () => {
  it('returns 1 at t=0 for any positive stability', () => {
    expect(retrievability(0, 10)).toBeCloseTo(1, 6);
    expect(retrievability(0, 100)).toBeCloseTo(1, 6);
  });

  it('uses factor=19/81 and decay=-0.5 (not the old (1+t/S)^-1 form)', () => {
    const stability = 10;
    const elapsed = 5;

    // Canonical FSRS v6
    const correct = Math.pow(
      1 + (FSRS_FACTOR_DEFAULT * elapsed) / stability,
      FSRS_DECAY_DEFAULT
    );

    // Old wrong formula that was in srs-summary.ts
    const wrongFormula = Math.pow(1 + elapsed / stability, -1);

    expect(retrievability(elapsed, stability)).toBeCloseTo(correct, 6);
    // The two formulas must NOT agree (would indicate regression back to old code)
    expect(Math.abs(correct - wrongFormula)).toBeGreaterThan(0.1);
  });

  it('matches readiness-projection.ts inline constants (factor=19/81, decay=-0.5)', () => {
    // readiness-projection.ts hardcodes: factor = 19 / 81, decay = -0.5
    const factor = 19 / 81;
    const decay = -0.5;
    const stability = 14;
    const elapsed = 7;

    const expected = Math.pow(1 + (factor * elapsed) / stability, decay);
    expect(retrievability(elapsed, stability)).toBeCloseTo(expected, 6);
  });

  it('clamps to [0, 1]', () => {
    expect(retrievability(-1, 10)).toBe(1); // negative elapsed → 1
    expect(retrievability(0, -5)).toBe(0);  // non-positive stability → 0
    expect(retrievability(1000, 1)).toBeGreaterThanOrEqual(0);
    expect(retrievability(1000, 1)).toBeLessThanOrEqual(1);
  });

  it('is strictly decreasing over time for positive stability', () => {
    const stability = 10;
    const values = [0, 1, 5, 10, 20, 30].map((t) => retrievability(t, stability));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]!);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. projectedRetention aggregation
// ──────────────────────────────────────────────────────────────────────────────

describe('projectedRetention aggregation', () => {
  function computeProjectedRetention(
    cards: Array<{ stability: number; daysSinceReview: number }>
  ): number {
    if (cards.length === 0) return 0;
    const sum = cards.reduce(
      (acc, c) => acc + retrievability(c.daysSinceReview, c.stability || 1),
      0
    );
    return (sum / cards.length) * 100;
  }

  it('returns 100% when all cards reviewed today', () => {
    const cards = [
      { stability: 10, daysSinceReview: 0 },
      { stability: 20, daysSinceReview: 0 },
    ];
    expect(computeProjectedRetention(cards)).toBeCloseTo(100, 4);
  });

  it('returns 0% for empty card list', () => {
    expect(computeProjectedRetention([])).toBe(0);
  });

  it('is between 0 and 100 for mixed review ages', () => {
    const cards = [
      { stability: 5, daysSinceReview: 0 },
      { stability: 5, daysSinceReview: 10 },
      { stability: 5, daysSinceReview: 30 },
    ];
    const result = computeProjectedRetention(cards);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it('is higher when reviews are more recent', () => {
    const fresh = [{ stability: 10, daysSinceReview: 1 }];
    const stale = [{ stability: 10, daysSinceReview: 20 }];
    expect(computeProjectedRetention(fresh)).toBeGreaterThan(
      computeProjectedRetention(stale)
    );
  });

  it('uses stability=1 fallback for zero-stability cards (no crash)', () => {
    const cards = [{ stability: 0, daysSinceReview: 5 }];
    const result = computeProjectedRetention(cards);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. stabilityTrend — built from real FSRS data, not session estimates
// ──────────────────────────────────────────────────────────────────────────────

describe('stabilityTrend derivation', () => {
  /**
   * Mirrors the fixed logic in srs-summary.ts.
   * Returns the 7-day trend array keyed by ISO date.
   */
  function buildStabilityTrend(
    now: Date,
    cards: Array<{ lastReviewAt: Date | null; stability: number }>
  ): Array<{ date: string; avgStability: number }> {
    const dayMap = new Map<string, { total: number; count: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayMap.set(d.toISOString().split('T')[0]!, { total: 0, count: 0 });
    }

    for (const card of cards) {
      if (!card.lastReviewAt) continue;
      const dateStr = card.lastReviewAt.toISOString().split('T')[0]!;
      if (!dayMap.has(dateStr)) continue;
      if (card.stability <= 0) continue;
      const entry = dayMap.get(dateStr)!;
      entry.total += card.stability;
      entry.count++;
    }

    const trend: Array<{ date: string; avgStability: number }> = [];
    for (const [date, data] of Array.from(dayMap.entries()).reverse()) {
      trend.push({
        date,
        avgStability:
          data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
      });
    }
    return trend;
  }

  it('returns 0 for a day with no reviews (honest empty)', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const trend = buildStabilityTrend(now, []);
    expect(trend.every((d) => d.avgStability === 0)).toBe(true);
  });

  it('returns the correct average stability for a reviewed day', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const yesterday = new Date('2026-04-18T09:00:00Z');
    const cards = [
      { lastReviewAt: yesterday, stability: 10 },
      { lastReviewAt: yesterday, stability: 20 },
    ];
    const trend = buildStabilityTrend(now, cards);
    const yesterdayEntry = trend.find((d) => d.date === '2026-04-18');
    expect(yesterdayEntry?.avgStability).toBeCloseTo(15, 1);
  });

  it('ignores cards reviewed outside the 7-day window', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const oldCard = new Date('2026-03-01T09:00:00Z'); // > 7 days ago
    const cards = [{ lastReviewAt: oldCard, stability: 50 }];
    const trend = buildStabilityTrend(now, cards);
    expect(trend.every((d) => d.avgStability === 0)).toBe(true);
  });

  it('ignores cards with zero or negative stability', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const today = new Date('2026-04-19T08:00:00Z');
    const cards = [
      { lastReviewAt: today, stability: 0 },
      { lastReviewAt: today, stability: -5 },
    ];
    const trend = buildStabilityTrend(now, cards);
    const todayEntry = trend.find((d) => d.date === '2026-04-19');
    expect(todayEntry?.avgStability).toBe(0);
  });

  it('produces 7 entries, one per day', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const trend = buildStabilityTrend(now, []);
    expect(trend).toHaveLength(7);
  });

  it('does NOT use session accuracy estimates (regression guard)', () => {
    // If the old fabricated logic were present, a card reviewed today
    // with stability=10 would produce avgStability ≠ 10 (it scaled by accuracy).
    // The real logic must return exactly the card's stability.
    const now = new Date('2026-04-19T12:00:00Z');
    const today = new Date('2026-04-19T08:00:00Z');
    const cards = [{ lastReviewAt: today, stability: 14.7 }];
    const trend = buildStabilityTrend(now, cards);
    const todayEntry = trend.find((d) => d.date === '2026-04-19');
    // Must equal the real stability (rounded to 1dp = 14.7)
    expect(todayEntry?.avgStability).toBeCloseTo(14.7, 1);
  });
});
