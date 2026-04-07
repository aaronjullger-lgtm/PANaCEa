/**
 * Tests for lib/services/ratingDistributionAuditService.ts
 *
 * Coverage:
 *   - computeBucket: bucket math with edge cases
 *   - assessAnomalyLevel: threshold classification
 *   - detectTrendSlope: linear regression correctness
 *   - generateAnomalies: full anomaly detection pipeline
 *   - getRatingDistributionAudit: DB-integrated (mocked Prisma)
 *
 * Sprint: Implicit Rating Audit — April 2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeBucket,
  assessAnomalyLevel,
  detectTrendSlope,
  generateAnomalies,
  getRatingDistributionAudit,
  type RatingBucket,
  type SystemRatingBreakdown,
  type SessionTypeBreakdown,
} from '../lib/services/ratingDistributionAuditService';

// ─── computeBucket ──────────────────────────────────────────────────────────

describe('computeBucket', () => {
  it('computes percentages correctly', () => {
    const bucket = computeBucket(30, 70);
    expect(bucket.total).toBe(100);
    expect(bucket.againCount).toBe(30);
    expect(bucket.goodCount).toBe(70);
    expect(bucket.againPct).toBe(30);
    expect(bucket.goodPct).toBe(70);
  });

  it('handles zero total gracefully', () => {
    const bucket = computeBucket(0, 0);
    expect(bucket.total).toBe(0);
    expect(bucket.againPct).toBe(0);
    expect(bucket.goodPct).toBe(0);
  });

  it('handles all-Again case', () => {
    const bucket = computeBucket(50, 0);
    expect(bucket.againPct).toBe(100);
    expect(bucket.goodPct).toBe(0);
  });

  it('handles all-Good case', () => {
    const bucket = computeBucket(0, 50);
    expect(bucket.againPct).toBe(0);
    expect(bucket.goodPct).toBe(100);
  });

  it('rounds to one decimal place', () => {
    // 1/3 = 33.333... → should round to 33.3
    const bucket = computeBucket(1, 2);
    expect(bucket.againPct).toBe(33.3);
    expect(bucket.goodPct).toBe(66.7);
  });

  it('percentages sum to ~100', () => {
    const bucket = computeBucket(17, 43);
    expect(Math.abs(bucket.againPct + bucket.goodPct - 100)).toBeLessThan(0.2);
  });
});

// ─── assessAnomalyLevel ─────────────────────────────────────────────────────

describe('assessAnomalyLevel', () => {
  it('returns healthy for small bucket (insufficient data)', () => {
    expect(assessAnomalyLevel(95, 5)).toBe('healthy');
    expect(assessAnomalyLevel(2, 3)).toBe('healthy');
  });

  it('returns healthy for Again% in 15–55 range', () => {
    expect(assessAnomalyLevel(30, 100)).toBe('healthy');
    expect(assessAnomalyLevel(15, 50)).toBe('healthy');
    expect(assessAnomalyLevel(55, 50)).toBe('healthy');
  });

  it('returns warning for Again% in 10–15 or 55–65 range', () => {
    expect(assessAnomalyLevel(12, 100)).toBe('warning');
    expect(assessAnomalyLevel(60, 100)).toBe('warning');
  });

  it('returns critical for Again% below 10 or above 65', () => {
    expect(assessAnomalyLevel(5, 100)).toBe('critical');
    expect(assessAnomalyLevel(80, 100)).toBe('critical');
    expect(assessAnomalyLevel(0, 50)).toBe('critical');
    expect(assessAnomalyLevel(100, 50)).toBe('critical');
  });

  it('boundary: 10% is exactly warning threshold', () => {
    // < 10 is critical, >= 10 but < 15 is warning
    expect(assessAnomalyLevel(10, 100)).toBe('warning');
    expect(assessAnomalyLevel(9.9, 100)).toBe('critical');
  });
});

// ─── detectTrendSlope ───────────────────────────────────────────────────────

describe('detectTrendSlope', () => {
  it('returns 0 with fewer than 3 data points', () => {
    expect(detectTrendSlope([])).toBe(0);
    expect(detectTrendSlope([30])).toBe(0);
    expect(detectTrendSlope([30, 35])).toBe(0);
  });

  it('detects positive slope (increasing Again%)', () => {
    // Steady increase: 20, 30, 40
    const slope = detectTrendSlope([20, 30, 40]);
    expect(slope).toBe(10); // exact: 10 per week
  });

  it('detects negative slope (decreasing Again%)', () => {
    const slope = detectTrendSlope([40, 30, 20]);
    expect(slope).toBe(-10);
  });

  it('returns near-zero for flat trend', () => {
    const slope = detectTrendSlope([30, 30, 30, 30, 30]);
    expect(slope).toBe(0);
  });

  it('handles noisy but upward data', () => {
    // General upward: 20, 25, 22, 30, 35
    const slope = detectTrendSlope([20, 25, 22, 30, 35]);
    expect(slope).toBeGreaterThan(0);
  });

  it('handles constant values', () => {
    expect(detectTrendSlope([50, 50, 50])).toBe(0);
  });
});

// ─── generateAnomalies ──────────────────────────────────────────────────────

describe('generateAnomalies', () => {
  const healthyOverall: RatingBucket = computeBucket(30, 70);
  const emptyBreakdowns: SystemRatingBreakdown[] = [];
  const emptySessionTypes: SessionTypeBreakdown[] = [];

  it('returns no anomalies for healthy distribution', () => {
    const anomalies = generateAnomalies(healthyOverall, emptyBreakdowns, emptySessionTypes, 0);
    expect(anomalies).toHaveLength(0);
  });

  it('flags overall high Again rate', () => {
    const highAgain = computeBucket(80, 20);
    const anomalies = generateAnomalies(highAgain, [], [], 0);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].code).toBe('overall_again_high');
    expect(anomalies[0].level).toBe('critical');
  });

  it('flags overall low Again rate (grade inflation)', () => {
    const lowAgain = computeBucket(3, 97);
    const anomalies = generateAnomalies(lowAgain, [], [], 0);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].code).toBe('overall_again_low');
  });

  it('flags per-system outliers', () => {
    const systems: SystemRatingBreakdown[] = [
      { system: 'Cardiovascular', ...computeBucket(45, 5) },  // 90% Again - critical
      { system: 'Pulmonary', ...computeBucket(15, 35) },      // 30% Again - healthy
    ];
    const anomalies = generateAnomalies(healthyOverall, systems, [], 0);
    const cvAnomaly = anomalies.find(a => a.code.includes('cardiovascular'));
    expect(cvAnomaly).toBeDefined();
    expect(cvAnomaly!.level).toBe('critical');
  });

  it('skips systems with too few reviews', () => {
    const systems: SystemRatingBreakdown[] = [
      { system: 'Dermatology', ...computeBucket(3, 0) },  // 100% Again but only 3 reviews
    ];
    const anomalies = generateAnomalies(healthyOverall, systems, [], 0);
    expect(anomalies.filter(a => a.code.includes('dermatology'))).toHaveLength(0);
  });

  it('flags session type discrepancy', () => {
    const sessionTypes: SessionTypeBreakdown[] = [
      { sessionType: 'TARGETED', ...computeBucket(40, 60) },  // 40% Again
      { sessionType: 'MAIN', ...computeBucket(5, 95) },       // 5% Again — huge gap
    ];
    const anomalies = generateAnomalies(healthyOverall, [], sessionTypes, 0);
    const discrepancy = anomalies.find(a => a.code === 'session_type_discrepancy');
    expect(discrepancy).toBeDefined();
  });

  it('does not flag session type discrepancy when buckets are small', () => {
    const sessionTypes: SessionTypeBreakdown[] = [
      { sessionType: 'TARGETED', ...computeBucket(3, 1) },  // only 4 reviews
      { sessionType: 'MAIN', ...computeBucket(1, 3) },
    ];
    const anomalies = generateAnomalies(healthyOverall, [], sessionTypes, 0);
    expect(anomalies.filter(a => a.code === 'session_type_discrepancy')).toHaveLength(0);
  });

  it('flags increasing Again trend', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], 5); // +5pp/week
    const trend = anomalies.find(a => a.code === 'again_trend_increasing');
    expect(trend).toBeDefined();
    expect(trend!.level).toBe('warning');
  });

  it('flags decreasing Again trend', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], -4);
    const trend = anomalies.find(a => a.code === 'again_trend_decreasing');
    expect(trend).toBeDefined();
  });

  it('does not flag mild trend', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], 1.5);
    expect(anomalies.filter(a => a.code.includes('trend'))).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DB-integrated getRatingDistributionAudit
// ════════════════════════════════════════════════════════════════════════════

describe('getRatingDistributionAudit', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      reviewLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it('returns a valid audit with empty data', async () => {
    const result = await getRatingDistributionAudit(prisma, 'user-001');

    expect(result.userId).toBe('user-001');
    expect(result.windowDays).toBe(90);
    expect(result.overall.total).toBe(0);
    expect(result.bySystem).toEqual([]);
    expect(result.bySessionType).toEqual([]);
    expect(result.weeklyTrend).toEqual([]);
    expect(result.anomalies).toBeInstanceOf(Array);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('correctly counts Again vs Good from review data', async () => {
    const now = new Date();
    prisma.reviewLog.findMany.mockResolvedValue([
      { grade: 1, system: 'CV', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: false },
      { grade: 1, system: 'CV', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: false },
      { grade: 3, system: 'CV', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: true },
      { grade: 3, system: 'PULM', sessionType: 'MAIN', reviewedAt: now, wasCorrect: true },
      { grade: 3, system: 'PULM', sessionType: 'MAIN', reviewedAt: now, wasCorrect: true },
    ]);

    const result = await getRatingDistributionAudit(prisma, 'user-002');

    expect(result.overall.total).toBe(5);
    expect(result.overall.againCount).toBe(2);
    expect(result.overall.goodCount).toBe(3);
    expect(result.overall.againPct).toBe(40);
    expect(result.overall.goodPct).toBe(60);
  });

  it('breaks down by system', async () => {
    const now = new Date();
    prisma.reviewLog.findMany.mockResolvedValue([
      { grade: 1, system: 'CV', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: false },
      { grade: 3, system: 'CV', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: true },
      { grade: 3, system: 'PULM', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: true },
    ]);

    const result = await getRatingDistributionAudit(prisma, 'user-003');

    expect(result.bySystem).toHaveLength(2);
    const cv = result.bySystem.find(s => s.system === 'CV');
    const pulm = result.bySystem.find(s => s.system === 'PULM');
    expect(cv!.againCount).toBe(1);
    expect(cv!.goodCount).toBe(1);
    expect(pulm!.againCount).toBe(0);
    expect(pulm!.goodCount).toBe(1);
  });

  it('breaks down by session type', async () => {
    const now = new Date();
    prisma.reviewLog.findMany.mockResolvedValue([
      { grade: 1, system: 'CV', sessionType: 'TARGETED', reviewedAt: now, wasCorrect: false },
      { grade: 3, system: 'CV', sessionType: 'MAIN', reviewedAt: now, wasCorrect: true },
      { grade: 3, system: 'CV', sessionType: 'MAIN', reviewedAt: now, wasCorrect: true },
    ]);

    const result = await getRatingDistributionAudit(prisma, 'user-004');

    const targeted = result.bySessionType.find(s => s.sessionType === 'TARGETED');
    const main = result.bySessionType.find(s => s.sessionType === 'MAIN');
    expect(targeted!.total).toBe(1);
    expect(main!.total).toBe(2);
  });

  it('generates weekly trend buckets', async () => {
    // Create reviews across 3 different weeks
    const week1 = new Date('2026-03-09T10:00:00Z'); // Monday
    const week2 = new Date('2026-03-16T10:00:00Z');
    const week3 = new Date('2026-03-23T10:00:00Z');

    prisma.reviewLog.findMany.mockResolvedValue([
      { grade: 1, system: 'CV', sessionType: 'TARGETED', reviewedAt: week1, wasCorrect: false },
      { grade: 3, system: 'CV', sessionType: 'TARGETED', reviewedAt: week1, wasCorrect: true },
      { grade: 3, system: 'CV', sessionType: 'TARGETED', reviewedAt: week2, wasCorrect: true },
      { grade: 1, system: 'CV', sessionType: 'TARGETED', reviewedAt: week3, wasCorrect: false },
    ]);

    const result = await getRatingDistributionAudit(prisma, 'user-005');

    expect(result.weeklyTrend.length).toBe(3);
    // Sorted chronologically
    expect(result.weeklyTrend[0].weekStart).toBe('2026-03-09');
    expect(result.weeklyTrend[1].weekStart).toBe('2026-03-16');
    expect(result.weeklyTrend[2].weekStart).toBe('2026-03-23');
  });

  it('detects anomalies from skewed data', async () => {
    const now = new Date();
    // 95% Again rate — critical
    const reviews = Array.from({ length: 100 }, (_, i) => ({
      grade: i < 95 ? 1 : 3,
      system: 'CV',
      sessionType: 'TARGETED',
      reviewedAt: now,
      wasCorrect: i >= 95,
    }));
    prisma.reviewLog.findMany.mockResolvedValue(reviews);

    const result = await getRatingDistributionAudit(prisma, 'user-006');

    expect(result.anomalies.length).toBeGreaterThan(0);
    const overallAnomaly = result.anomalies.find(a => a.code === 'overall_again_high');
    expect(overallAnomaly).toBeDefined();
    expect(overallAnomaly!.level).toBe('critical');
  });

  it('respects custom windowDays parameter', async () => {
    await getRatingDistributionAudit(prisma, 'user-007', 30);

    // Verify the Prisma query used the correct cutoff
    const call = prisma.reviewLog.findMany.mock.calls[0][0];
    expect(call.where.reviewedAt.gte).toBeInstanceOf(Date);
    const cutoffDays = (Date.now() - call.where.reviewedAt.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(cutoffDays).toBeGreaterThan(29);
    expect(cutoffDays).toBeLessThan(31);
  });

  it('groups null-system reviews under Unknown', async () => {
    const now = new Date();
    prisma.reviewLog.findMany.mockResolvedValue([
      { grade: 1, system: null, sessionType: 'TARGETED', reviewedAt: now, wasCorrect: false },
      { grade: 3, system: null, sessionType: 'TARGETED', reviewedAt: now, wasCorrect: true },
    ]);

    const result = await getRatingDistributionAudit(prisma, 'user-008');

    const unknown = result.bySystem.find(s => s.system === 'Unknown');
    expect(unknown).toBeDefined();
    expect(unknown!.total).toBe(2);
  });
});
