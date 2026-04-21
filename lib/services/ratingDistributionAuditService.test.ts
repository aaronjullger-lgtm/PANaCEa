/**
 * Unit tests for lib/services/ratingDistributionAuditService.ts
 *
 * Pure functions only — getRatingDistributionAudit requires Prisma.
 *
 * Constants (from source):
 *   HEALTHY_AGAIN_MIN = 15,  HEALTHY_AGAIN_MAX = 55
 *   WARNING_AGAIN_MIN = 10,  WARNING_AGAIN_MAX = 65
 *   MIN_BUCKET_SIZE   = 10   (below this → always 'healthy')
 *   MIN_BREAKDOWN_SIZE = 5
 */

import { describe, it, expect } from 'vitest';
import {
  computeBucket,
  assessAnomalyLevel,
  detectTrendSlope,
  generateAnomalies,
  type RatingBucket,
  type SystemRatingBreakdown,
  type SessionTypeBreakdown,
} from './ratingDistributionAuditService';

// ─── computeBucket ────────────────────────────────────────────────────────────

describe('computeBucket', () => {
  it('computes total as againCount + goodCount', () => {
    const bucket = computeBucket(30, 70);
    expect(bucket.total).toBe(100);
  });

  it('computes againPct as (again / total) * 100 rounded to 1dp', () => {
    const bucket = computeBucket(30, 70);
    expect(bucket.againPct).toBe(30.0);
  });

  it('computes goodPct as (good / total) * 100 rounded to 1dp', () => {
    const bucket = computeBucket(30, 70);
    expect(bucket.goodPct).toBe(70.0);
  });

  it('againPct + goodPct = 100 for any non-zero total', () => {
    for (const [a, g] of [[1, 9], [3, 7], [50, 50], [99, 1], [7, 13]]) {
      const b = computeBucket(a, g);
      expect(b.againPct + b.goodPct).toBeCloseTo(100, 0);
    }
  });

  it('returns zeros for all-good (again=0)', () => {
    const bucket = computeBucket(0, 50);
    expect(bucket.againPct).toBe(0);
    expect(bucket.goodPct).toBe(100);
    expect(bucket.total).toBe(50);
  });

  it('returns 100% again when all are again', () => {
    const bucket = computeBucket(50, 0);
    expect(bucket.againPct).toBe(100);
    expect(bucket.goodPct).toBe(0);
  });

  it('returns all zeros when both counts are 0', () => {
    const bucket = computeBucket(0, 0);
    expect(bucket.total).toBe(0);
    expect(bucket.againPct).toBe(0);
    expect(bucket.goodPct).toBe(0);
  });

  it('rounds to 1 decimal place (not more)', () => {
    // 1/3 ≈ 33.3333... → should round to 33.3
    const bucket = computeBucket(1, 2);
    const decimals = bucket.againPct.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 1).toBe(true);
  });

  it('preserves exact integer percentage without fractional noise', () => {
    expect(computeBucket(25, 75).againPct).toBe(25.0);
    expect(computeBucket(50, 50).againPct).toBe(50.0);
  });
});

// ─── assessAnomalyLevel ───────────────────────────────────────────────────────

describe('assessAnomalyLevel', () => {
  // Small bucket → healthy (not enough data)
  it('returns "healthy" when bucketSize < 10 regardless of againPct', () => {
    expect(assessAnomalyLevel(0, 9)).toBe('healthy');
    expect(assessAnomalyLevel(100, 9)).toBe('healthy');
    expect(assessAnomalyLevel(50, 5)).toBe('healthy');
  });

  // Healthy zone: [15, 55]
  it('returns "healthy" when againPct is in healthy range [15, 55]', () => {
    for (const pct of [15, 25, 35, 45, 55]) {
      expect(assessAnomalyLevel(pct, 20), `againPct=${pct}`).toBe('healthy');
    }
  });

  // Warning zone: [10, 15) and (55, 65]
  it('returns "warning" for againPct just below healthy min (e.g. 12)', () => {
    expect(assessAnomalyLevel(12, 20)).toBe('warning');
  });

  it('returns "warning" for againPct just above healthy max (e.g. 60)', () => {
    expect(assessAnomalyLevel(60, 20)).toBe('warning');
  });

  it('returns "warning" at boundary: againPct = 10 (WARNING_AGAIN_MIN)', () => {
    expect(assessAnomalyLevel(10, 20)).toBe('warning');
  });

  it('returns "warning" at boundary: againPct = 65 (WARNING_AGAIN_MAX)', () => {
    expect(assessAnomalyLevel(65, 20)).toBe('warning');
  });

  // Critical zone: < 10 or > 65
  it('returns "critical" for againPct < 10', () => {
    expect(assessAnomalyLevel(5, 20)).toBe('critical');
    expect(assessAnomalyLevel(0, 20)).toBe('critical');
  });

  it('returns "critical" for againPct > 65', () => {
    expect(assessAnomalyLevel(70, 20)).toBe('critical');
    expect(assessAnomalyLevel(100, 20)).toBe('critical');
  });

  it('returns "critical" at boundary 9 (just below WARNING_AGAIN_MIN)', () => {
    expect(assessAnomalyLevel(9, 20)).toBe('critical');
  });

  it('returns "critical" at boundary 66 (just above WARNING_AGAIN_MAX)', () => {
    expect(assessAnomalyLevel(66, 20)).toBe('critical');
  });
});

// ─── detectTrendSlope ─────────────────────────────────────────────────────────

describe('detectTrendSlope', () => {
  it('returns 0 for empty array', () => {
    expect(detectTrendSlope([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(detectTrendSlope([30])).toBe(0);
  });

  it('returns 0 for two values (needs >= 3)', () => {
    expect(detectTrendSlope([20, 40])).toBe(0);
  });

  it('returns positive slope for steadily increasing Again%', () => {
    const slope = detectTrendSlope([20, 30, 40, 50, 60]);
    expect(slope).toBeGreaterThan(0);
  });

  it('returns negative slope for steadily decreasing Again%', () => {
    const slope = detectTrendSlope([60, 50, 40, 30, 20]);
    expect(slope).toBeLessThan(0);
  });

  it('returns near-zero slope for flat data', () => {
    const slope = detectTrendSlope([30, 30, 30, 30, 30]);
    expect(Math.abs(slope)).toBeCloseTo(0, 5);
  });

  it('computes slope of exactly 5 for [10, 15, 20, 25, 30] (perfect linear +5/week)', () => {
    // y = 5x + 10; slope = 5
    const slope = detectTrendSlope([10, 15, 20, 25, 30]);
    expect(slope).toBeCloseTo(5, 3);
  });

  it('computes slope of -10 for [50, 40, 30] (perfect linear -10/week)', () => {
    const slope = detectTrendSlope([50, 40, 30]);
    expect(slope).toBeCloseTo(-10, 3);
  });

  it('handles non-monotonic data without throwing', () => {
    expect(() => detectTrendSlope([30, 45, 25, 55, 20])).not.toThrow();
  });

  it('returns 0 for all-identical values (zero denominator guard)', () => {
    expect(detectTrendSlope([25, 25, 25])).toBe(0);
  });
});

// ─── generateAnomalies ────────────────────────────────────────────────────────

describe('generateAnomalies', () => {
  const healthyOverall: RatingBucket = computeBucket(30, 70); // 30% again — healthy
  const criticalHighOverall: RatingBucket = computeBucket(75, 25); // 75% again — critical
  const criticalLowOverall: RatingBucket = computeBucket(5, 95); // 5% again — critical

  it('returns empty anomalies array when everything is healthy', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], 0);
    expect(anomalies).toEqual([]);
  });

  it('generates overall anomaly when critical-high Again%', () => {
    const anomalies = generateAnomalies(criticalHighOverall, [], [], 0);
    const overall = anomalies.find(a => a.code === 'overall_again_high');
    expect(overall).toBeDefined();
    expect(overall?.level).toBe('critical');
    expect(overall?.message).toMatch(/again rate/i);
  });

  it('generates overall anomaly when critical-low Again%', () => {
    const anomalies = generateAnomalies(criticalLowOverall, [], [], 0);
    const overall = anomalies.find(a => a.code === 'overall_again_low');
    expect(overall).toBeDefined();
    expect(overall?.level).toBe('critical');
  });

  it('generates per-system anomaly for outlier systems with >= 5 reviews', () => {
    const badSystem: SystemRatingBreakdown = {
      ...computeBucket(80, 20),
      system: 'Cardiovascular',
    };
    const anomalies = generateAnomalies(healthyOverall, [badSystem], [], 0);
    const sysAnomaly = anomalies.find(a => a.code.includes('cardiovascular'));
    expect(sysAnomaly).toBeDefined();
    expect(sysAnomaly?.context?.system).toBe('Cardiovascular');
  });

  it('ignores per-system breakdown with < 5 reviews', () => {
    const tinySystem: SystemRatingBreakdown = {
      ...computeBucket(80, 20),
      system: 'ExoticSystem',
      total: 4, // override total to below MIN_BREAKDOWN_SIZE
    } as SystemRatingBreakdown;
    // Manually override total to 4 for this test
    (tinySystem as any).total = 4;
    tinySystem.againCount = 3;
    tinySystem.goodCount = 1;
    const anomalies = generateAnomalies(healthyOverall, [tinySystem], [], 0);
    expect(anomalies.find(a => a.code.includes('exoticsystem'))).toBeUndefined();
  });

  it('generates session_type_discrepancy when TARGETED vs MAIN differ by > 25pp', () => {
    const targeted: SessionTypeBreakdown = {
      ...computeBucket(70, 30), // 70% again
      sessionType: 'TARGETED',
    };
    const main: SessionTypeBreakdown = {
      ...computeBucket(30, 70), // 30% again
      sessionType: 'MAIN',
    };
    const anomalies = generateAnomalies(healthyOverall, [], [targeted, main], 0);
    expect(anomalies.find(a => a.code === 'session_type_discrepancy')).toBeDefined();
  });

  it('does NOT generate session discrepancy when difference <= 25pp', () => {
    const targeted: SessionTypeBreakdown = {
      ...computeBucket(50, 50), // 50% again
      sessionType: 'TARGETED',
    };
    const main: SessionTypeBreakdown = {
      ...computeBucket(30, 70), // 30% again — diff = 20pp
      sessionType: 'MAIN',
    };
    const anomalies = generateAnomalies(healthyOverall, [], [targeted, main], 0);
    expect(anomalies.find(a => a.code === 'session_type_discrepancy')).toBeUndefined();
  });

  it('generates trend anomaly when |slope| > 3', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], 5); // increasing
    const trendAnomaly = anomalies.find(a => a.code === 'again_trend_increasing');
    expect(trendAnomaly).toBeDefined();
    expect(trendAnomaly?.level).toBe('warning');
  });

  it('generates decreasing trend anomaly for negative slope > 3', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], -4);
    expect(anomalies.find(a => a.code === 'again_trend_decreasing')).toBeDefined();
  });

  it('does NOT generate trend anomaly when |slope| <= 3', () => {
    const anomalies = generateAnomalies(healthyOverall, [], [], 2);
    expect(anomalies.find(a => a.code?.includes('trend'))).toBeUndefined();
  });

  it('anomaly objects have required fields: level, code, message', () => {
    const anomalies = generateAnomalies(criticalHighOverall, [], [], 5);
    for (const a of anomalies) {
      expect(['healthy', 'warning', 'critical']).toContain(a.level);
      expect(typeof a.code).toBe('string');
      expect(a.code.length).toBeGreaterThan(0);
      expect(typeof a.message).toBe('string');
    }
  });
});
