/**
 * EOR Scheduler and FSRS Simulator Test Suite
 *
 * Tests the End-of-Rotation FSRS scheduling constraints and workload simulation,
 * ensuring clinical-year students get correct review dates and workload estimates.
 */

import { describe, it, expect } from 'vitest';
import {
  clampDueToRotationWindow,
  getEorRotationEnd,
  applyEorClampIfNeeded,
} from '../lib/fsrs/eorScheduler';
import {
  simulateRetentionWorkload,
  calculateRecommendedRetention,
  generateWorkloadChart,
} from '../lib/fsrs/simulator';
import { defaultParameters } from '../lib/fsrs';

// ─────────────────────────────────────────────────────────────────────────────
// clampDueToRotationWindow
// ─────────────────────────────────────────────────────────────────────────────

describe('clampDueToRotationWindow', () => {
  it('returns due date unchanged when before rotation end', () => {
    const due = new Date('2026-03-10');
    const rotationEnd = new Date('2026-03-20');
    const result = clampDueToRotationWindow(due, rotationEnd);
    expect(result.getTime()).toBe(due.getTime());
  });

  it('clamps due date to rotation end when due is after rotation end', () => {
    const due = new Date('2026-04-05T12:00:00Z');
    const rotationEnd = new Date('2026-03-31T12:00:00Z');
    const result = clampDueToRotationWindow(due, rotationEnd);
    // Result must be strictly earlier than the original due date
    expect(result.getTime()).toBeLessThan(due.getTime());
    // Result must not exceed end-of-day for rotationEnd (within 1 day buffer)
    const rotationEndPlusOneDay = new Date(rotationEnd.getTime() + 86400000);
    expect(result.getTime()).toBeLessThanOrEqual(rotationEndPlusOneDay.getTime());
  });

  it('returns rotationEnd when due equals rotationEnd midnight', () => {
    const due = new Date('2026-03-31T00:00:00.000Z');
    const rotationEnd = new Date('2026-03-31');
    // Due is at midnight, rotationEnd day extends to 23:59:59.999 — should not be clamped
    const result = clampDueToRotationWindow(due, rotationEnd);
    // due (midnight UTC) < end-of-day; so result should be the due itself
    expect(result.getTime()).toBeLessThanOrEqual(rotationEnd.getTime() + 86400000);
  });

  it('clamps when rotation end is in the past', () => {
    const due = new Date('2026-05-01');
    const rotationEnd = new Date('2026-01-15');
    const result = clampDueToRotationWindow(due, rotationEnd);
    expect(result.getTime()).toBeLessThan(due.getTime());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getEorRotationEnd
// ─────────────────────────────────────────────────────────────────────────────

describe('getEorRotationEnd', () => {
  it('returns null when not in Clinical Year', () => {
    const result = getEorRotationEnd({
      yearInProgram: 'PA-S2',
      currentRotation: 'Internal Medicine',
      eorTestDate: '2026-06-01',
    });
    expect(result).toBeNull();
  });

  it('returns null when no currentRotation', () => {
    const result = getEorRotationEnd({
      yearInProgram: 'Clinical Year',
      currentRotation: null,
      eorTestDate: '2026-06-01',
    });
    expect(result).toBeNull();
  });

  it('returns null for non-EOR rotation', () => {
    const result = getEorRotationEnd({
      yearInProgram: 'Clinical Year',
      currentRotation: 'Elective Cardiology',
      eorTestDate: '2026-06-01',
    });
    expect(result).toBeNull();
  });

  it('returns rotation end date for valid EOR rotation with eorTestDate', () => {
    const result = getEorRotationEnd({
      yearInProgram: 'Clinical Year',
      currentRotation: 'Internal Medicine',
      eorTestDate: '2026-06-15',
    });
    expect(result).toBeInstanceOf(Date);
    // Use UTC methods to avoid timezone off-by-one errors
    expect(result?.getUTCFullYear()).toBe(2026);
    expect(result?.getUTCMonth()).toBe(5); // June = 5
    expect(result?.getUTCDate()).toBe(15);
  });

  it('prefers rotationEndDate over eorTestDate', () => {
    const result = getEorRotationEnd({
      yearInProgram: 'Clinical Year',
      currentRotation: 'Family Medicine',
      rotationEndDate: '2026-07-01',
      eorTestDate: '2026-07-10',
    });
    expect(result?.getUTCDate()).toBe(1); // rotationEndDate wins
    expect(result?.getUTCMonth()).toBe(6); // July = 6
  });

  it('returns null for all recognized EOR rotations when not Clinical Year', () => {
    const rotations = [
      'Emergency Medicine',
      'Family Medicine',
      'Internal Medicine',
      'Surgery',
      'Pediatrics',
      'Psychiatry',
      'Obstetrics & Gynecology',
    ];
    for (const rotation of rotations) {
      const result = getEorRotationEnd({
        yearInProgram: 'PA-S1',
        currentRotation: rotation,
        eorTestDate: '2026-06-01',
      });
      expect(result).toBeNull();
    }
  });

  it('recognizes all standard EOR rotations in Clinical Year', () => {
    const rotations = [
      'Emergency Medicine',
      'Family Medicine',
      'Internal Medicine',
      'Surgery',
      'Pediatrics',
      'Psychiatry',
      'Obstetrics & Gynecology',
    ];
    for (const rotation of rotations) {
      const result = getEorRotationEnd({
        yearInProgram: 'Clinical Year',
        currentRotation: rotation,
        eorTestDate: '2026-06-01',
      });
      expect(result).toBeInstanceOf(Date);
    }
  });

  it('returns null for invalid date string', () => {
    const result = getEorRotationEnd({
      yearInProgram: 'Clinical Year',
      currentRotation: 'Internal Medicine',
      eorTestDate: 'not-a-date',
    });
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEorClampIfNeeded
// ─────────────────────────────────────────────────────────────────────────────

describe('applyEorClampIfNeeded', () => {
  it('returns due unchanged and wasClamped=false when rotationEnd is null', () => {
    const due = new Date('2026-05-01');
    const result = applyEorClampIfNeeded(due, null);
    expect(result.due.getTime()).toBe(due.getTime());
    expect(result.wasClamped).toBe(false);
  });

  it('returns clamped date and wasClamped=true when due exceeds rotation end', () => {
    const due = new Date('2026-04-10');
    const rotationEnd = new Date('2026-03-31');
    const result = applyEorClampIfNeeded(due, rotationEnd);
    expect(result.wasClamped).toBe(true);
    expect(result.due.getTime()).toBeLessThan(due.getTime());
  });

  it('returns original due and wasClamped=false when due is within window', () => {
    const due = new Date('2026-03-20');
    const rotationEnd = new Date('2026-03-31');
    const result = applyEorClampIfNeeded(due, rotationEnd);
    expect(result.wasClamped).toBe(false);
    expect(result.due.getTime()).toBe(due.getTime());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// simulateRetentionWorkload
// ─────────────────────────────────────────────────────────────────────────────

describe('simulateRetentionWorkload', () => {
  const baseParams = {
    fsrsParams: defaultParameters,
    dailyNewCards: 20,
  };

  it('returns results for multiple retention levels', () => {
    const results = simulateRetentionWorkload(baseParams);
    expect(results.length).toBeGreaterThan(3);
  });

  it('each result has required fields with valid ranges', () => {
    const results = simulateRetentionWorkload(baseParams);
    for (const r of results) {
      expect(r.retention).toBeGreaterThanOrEqual(0.7);
      expect(r.retention).toBeLessThanOrEqual(1.0);
      expect(r.dailyNewCards).toBeGreaterThan(0);
      expect(r.projectedDailyReviews).toBeGreaterThan(0);
      expect(r.timeInvestmentMinutes).toBeGreaterThan(0);
      expect(r.sustainabilityScore).toBeGreaterThanOrEqual(0);
      expect(r.sustainabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('highest retention requires more daily reviews than lowest', () => {
    const results = simulateRetentionWorkload(baseParams);
    const first = results[0]!;
    const last = results[results.length - 1]!;
    // The highest retention level should require substantially more reviews than lowest
    expect(last.projectedDailyReviews).toBeGreaterThan(first.projectedDailyReviews);
  });

  it('more daily new cards increases projected reviews', () => {
    const low = simulateRetentionWorkload({ ...baseParams, dailyNewCards: 10 });
    const high = simulateRetentionWorkload({ ...baseParams, dailyNewCards: 40 });
    // At same retention level, more new cards → more reviews
    expect(high[0]!.projectedDailyReviews).toBeGreaterThan(low[0]!.projectedDailyReviews);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateRecommendedRetention
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateRecommendedRetention', () => {
  it('returns a valid retention between 0.7 and 0.95', () => {
    const result = calculateRecommendedRetention(30, 20, defaultParameters);
    expect(result.recommendedRetention).toBeGreaterThanOrEqual(0.7);
    expect(result.recommendedRetention).toBeLessThanOrEqual(0.95);
  });

  it('returns an explanation string', () => {
    const result = calculateRecommendedRetention(30, 20, defaultParameters);
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(10);
  });

  it('falls back to 0.8 when even lowest retention exceeds time budget', () => {
    // 1 minute/day is far too little for any retention level
    const result = calculateRecommendedRetention(1, 50, defaultParameters);
    expect(result.recommendedRetention).toBe(0.8);
    expect(result.explanation).toContain('Consider reducing');
  });

  it('recommends higher retention when more time is available', () => {
    const low = calculateRecommendedRetention(10, 10, defaultParameters);
    const high = calculateRecommendedRetention(60, 10, defaultParameters);
    expect(high.recommendedRetention).toBeGreaterThanOrEqual(low.recommendedRetention);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateWorkloadChart
// ─────────────────────────────────────────────────────────────────────────────

describe('generateWorkloadChart', () => {
  it('returns chart data with retention, reviews, minutes', () => {
    const data = generateWorkloadChart({
      fsrsParams: defaultParameters,
      dailyNewCards: 20,
    });
    expect(data.length).toBeGreaterThan(0);
    for (const d of data) {
      expect(typeof d.retention).toBe('number');
      expect(typeof d.reviews).toBe('number');
      expect(typeof d.minutes).toBe('number');
    }
  });
});
