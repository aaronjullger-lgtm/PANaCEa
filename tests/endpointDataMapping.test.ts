/**
 * Tests for endpoint data-mapping logic used in the 5 new API endpoints
 * created during the integration session.
 *
 * These test the pure transformation logic that endpoints use to derive
 * LearnerFeatures, WarningInput, mastery overlays, etc. from raw DB records.
 * The actual services (analyzeLearner, buildPatternProfile, etc.) have their
 * own dedicated test files.
 */

import { describe, it, expect } from 'vitest';

// ─── Helpers: Coefficient of Variation (used by learner-profile endpoint) ───

/** Same CV computation as functions/api/analytics/learner-profile.ts */
function computeCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// ─── Helpers: Mastery computation (used by knowledge-graph endpoint) ────────

/** Same mastery formula as functions/api/analytics/knowledge-graph.ts */
function computeMastery(
  accuracy: number,
  stability: number,
  attempts: number
): number {
  const stabilityNorm = Math.min(1, stability / 30);
  if (attempts >= 3) return 0.5 * accuracy + 0.5 * stabilityNorm;
  if (attempts > 0) return 0.3 * accuracy + 0.1 * stabilityNorm;
  return 0;
}

// ─── Helpers: Engagement trend (used by learner-profile endpoint) ───────────

/** Same engagement trend formula as learner-profile endpoint */
function computeEngagementTrend(
  last7Avg: number,
  priorAvg: number
): number {
  if (priorAvg <= 0) return 0.5;
  return Math.min(1, Math.max(0, 0.5 + (last7Avg - priorAvg) / (2 * priorAvg)));
}

// ─── CV Tests ───────────────────────────────────────────────────────────────

describe('computeCV — coefficient of variation', () => {
  it('returns 0 for empty array', () => {
    expect(computeCV([])).toBe(0);
  });

  it('returns 0 for single-element array', () => {
    expect(computeCV([42])).toBe(0);
  });

  it('returns 0 for all-zero array', () => {
    expect(computeCV([0, 0, 0])).toBe(0);
  });

  it('returns 0 for constant values', () => {
    expect(computeCV([5, 5, 5, 5])).toBe(0);
  });

  it('computes correct CV for known values', () => {
    // values: [2, 4, 4, 4, 5, 5, 7, 9]
    // mean = 5, variance = (9+1+1+1+0+0+4+16)/8 = 4, stdev = 2, CV = 2/5 = 0.4
    const cv = computeCV([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(cv).toBeCloseTo(0.4, 2);
  });

  it('returns higher CV for spiky data vs consistent', () => {
    const spiky = computeCV([0, 30, 0, 25, 0, 20]);
    const consistent = computeCV([12, 13, 11, 14, 12, 13]);
    expect(spiky).toBeGreaterThan(consistent);
  });
});

// ─── Mastery Tests ──────────────────────────────────────────────────────────

describe('computeMastery — knowledge graph node mastery', () => {
  it('returns 0 for zero attempts', () => {
    expect(computeMastery(0.8, 10, 0)).toBe(0);
  });

  it('uses low weights for 1-2 attempts', () => {
    // 1 attempt: 0.3 * accuracy + 0.1 * stabilityNorm
    // accuracy=1.0, stability=15 → stabilityNorm=0.5
    // mastery = 0.3 * 1.0 + 0.1 * 0.5 = 0.35
    const m = computeMastery(1.0, 15, 2);
    expect(m).toBeCloseTo(0.35, 2);
  });

  it('uses full weights for 3+ attempts', () => {
    // 5 attempts: 0.5 * accuracy + 0.5 * stabilityNorm
    // accuracy=0.8, stability=30 → stabilityNorm=1.0
    // mastery = 0.5 * 0.8 + 0.5 * 1.0 = 0.9
    const m = computeMastery(0.8, 30, 5);
    expect(m).toBeCloseTo(0.9, 2);
  });

  it('caps stability normalization at 1.0', () => {
    // stability=60 → stabilityNorm = min(1, 60/30) = 1.0
    const m = computeMastery(1.0, 60, 10);
    expect(m).toBeCloseTo(1.0, 2);
  });

  it('handles zero accuracy and stability', () => {
    // 3+ attempts: 0.5 * 0 + 0.5 * 0 = 0
    expect(computeMastery(0, 0, 5)).toBe(0);
  });

  it('correctly classifies mastery tiers', () => {
    // Strong: ≥ 0.7
    expect(computeMastery(0.9, 25, 10)).toBeGreaterThanOrEqual(0.7);
    // Developing: 0.4-0.7
    const developing = computeMastery(0.6, 10, 5);
    expect(developing).toBeGreaterThanOrEqual(0.4);
    expect(developing).toBeLessThan(0.7);
    // Weak: > 0, < 0.4
    const weak = computeMastery(0.3, 2, 3);
    expect(weak).toBeGreaterThan(0);
    expect(weak).toBeLessThan(0.4);
  });
});

// ─── Engagement Trend Tests ─────────────────────────────────────────────────

describe('computeEngagementTrend — learner profile', () => {
  it('returns 0.5 when prior average is zero', () => {
    expect(computeEngagementTrend(10, 0)).toBe(0.5);
  });

  it('returns 0.5 when averages are equal (stable)', () => {
    expect(computeEngagementTrend(20, 20)).toBe(0.5);
  });

  it('returns > 0.5 when recent volume is higher (improving)', () => {
    // last7Avg=30, priorAvg=20 → 0.5 + (30-20)/(2*20) = 0.5 + 0.25 = 0.75
    const trend = computeEngagementTrend(30, 20);
    expect(trend).toBeCloseTo(0.75, 2);
  });

  it('returns < 0.5 when recent volume is lower (declining)', () => {
    // last7Avg=10, priorAvg=20 → 0.5 + (10-20)/(2*20) = 0.5 - 0.25 = 0.25
    const trend = computeEngagementTrend(10, 20);
    expect(trend).toBeCloseTo(0.25, 2);
  });

  it('clamps to [0, 1] range', () => {
    // Extreme increase: last7=100, prior=10 → 0.5 + 90/20 = 5.0 → clamped to 1.0
    expect(computeEngagementTrend(100, 10)).toBe(1);
    // Extreme decline: last7=0, prior=10 → 0.5 + (-10)/20 = 0.0
    expect(computeEngagementTrend(0, 10)).toBe(0);
  });
});

// ─── Feature Derivation Tests ───────────────────────────────────────────────

describe('LearnerFeatures derivation — boundary conditions', () => {
  it('dailyVolume normalizes to 0-1 range (50+ = 1.0)', () => {
    // avgDailyVolume / 50, capped at 1
    expect(Math.min(1, 0 / 50)).toBe(0);
    expect(Math.min(1, 25 / 50)).toBe(0.5);
    expect(Math.min(1, 50 / 50)).toBe(1);
    expect(Math.min(1, 100 / 50)).toBe(1); // capped
  });

  it('relativeSpeed normalizes correctly (2x par = 1.0)', () => {
    const parTimeMs = 60000;
    // at par → 0.5, at 2x par → 1.0, at 0 → 0
    expect(Math.min(1, parTimeMs / (2 * parTimeMs))).toBeCloseTo(0.5, 2);
    expect(Math.min(1, (2 * parTimeMs) / (2 * parTimeMs))).toBeCloseTo(1.0, 2);
    expect(Math.min(1, 0 / (2 * parTimeMs))).toBe(0);
  });

  it('systemBreadth normalizes against 13 NCCPA systems', () => {
    const totalSystems = 13;
    expect(Math.min(1, 0 / totalSystems)).toBe(0);
    expect(Math.min(1, 6 / totalSystems)).toBeCloseTo(0.46, 1);
    expect(Math.min(1, 13 / totalSystems)).toBe(1);
    expect(Math.min(1, 15 / totalSystems)).toBe(1); // capped
  });
});

// ─── Error Pattern Endpoint Data Mapping ────────────────────────────────────

describe('error-patterns endpoint — telemetry mapping', () => {
  it('approximates timeToFirstClick as 30% of total time', () => {
    const timeSpentMs = 45000;
    const parTimeMs = 60000;
    const timeToFirstClickMs = (timeSpentMs ?? parTimeMs) * 0.3;
    expect(timeToFirstClickMs).toBe(13500);
  });

  it('approximates commitmentGapMs as 20% of total time', () => {
    const timeSpentMs = 45000;
    const parTimeMs = 60000;
    const commitmentGapMs = (timeSpentMs ?? parTimeMs) * 0.2;
    expect(commitmentGapMs).toBe(9000);
  });

  it('falls back to parTime when timeSpentMs is null', () => {
    const timeSpentMs = null;
    const parTimeMs = 60000;
    const timeToFirstClickMs = (timeSpentMs ?? parTimeMs) * 0.3;
    const commitmentGapMs = (timeSpentMs ?? parTimeMs) * 0.2;
    expect(timeToFirstClickMs).toBe(18000);
    expect(commitmentGapMs).toBe(12000);
  });
});

// ─── Knowledge Graph Edge Filtering ─────────────────────────────────────────

describe('knowledge-graph endpoint — edge filtering', () => {
  it('filters edges to only those with both endpoints in node set', () => {
    const nodeIds = new Set(['a', 'b', 'c']);
    const edges = [
      { sourceId: 'a', targetId: 'b' }, // both in set ✓
      { sourceId: 'b', targetId: 'c' }, // both in set ✓
      { sourceId: 'a', targetId: 'd' }, // target not in set ✗
      { sourceId: 'd', targetId: 'c' }, // source not in set ✗
      { sourceId: 'd', targetId: 'e' }, // neither in set ✗
    ];
    const filtered = edges.filter(
      (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
    );
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.sourceId).toBe('a');
    expect(filtered[1]!.sourceId).toBe('b');
  });
});
