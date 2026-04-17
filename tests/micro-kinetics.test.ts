import { describe, it, expect } from 'vitest';
import {
  calculateShannonEntropy,
  calculateHoverMetrics,
  analyzeTrajectory,
  serializeTrajectoryMetrics,
  interpretTrajectoryForRating,
  SAMPLING_INTERVAL_MS,
  type RawTrajectory,
  type TrajectoryMetrics,
} from '../lib/micro-kinetics';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a "perfect" straight-line trajectory from (0, 0) to (targetX, targetY).
 * Useful for asserting ideal metrics (MAD=0, efficiency=1, no jitter).
 */
function buildStraightTrajectory(
  targetX: number,
  targetY: number,
  samples = 10,
  dtMs = 40
): RawTrajectory {
  const points = Array.from({ length: samples }, (_, i) => {
    const t = (i + 1) / samples;
    return {
      x: targetX * t,
      y: targetY * t,
      t: (i + 1) * dtMs,
    };
  });
  return {
    startPoint: { x: 0, y: 0 },
    points,
    target: { centerX: targetX, centerY: targetY, width: 100, height: 40 },
    startTime: 0,
    endTime: samples * dtMs,
  };
}

/**
 * Build a detour trajectory that arcs off the ideal path, then arrives at target.
 * `peak` controls how far off-axis the midpoint is.
 */
function buildDetourTrajectory(
  targetX: number,
  targetY: number,
  peak: number,
  samples = 20,
  dtMs = 40
): RawTrajectory {
  const points = Array.from({ length: samples }, (_, i) => {
    const t = (i + 1) / samples;
    // Parabolic arc: max deviation at t=0.5
    const deviation = peak * 4 * t * (1 - t);
    return {
      x: targetX * t,
      y: targetY * t + deviation,
      t: (i + 1) * dtMs,
    };
  });
  return {
    startPoint: { x: 0, y: 0 },
    points,
    target: { centerX: targetX, centerY: targetY, width: 100, height: 40 },
    startTime: 0,
    endTime: samples * dtMs,
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

describe('SAMPLING_INTERVAL_MS', () => {
  it('is 40ms (25 Hz)', () => {
    expect(SAMPLING_INTERVAL_MS).toBe(40);
  });
});

// ─── calculateShannonEntropy ────────────────────────────────────────────────

describe('calculateShannonEntropy', () => {
  it('returns 0 for empty input', () => {
    expect(calculateShannonEntropy([])).toBe(0);
  });

  it('returns 0 when one outcome is certain (p=1)', () => {
    // H = -1 * log2(1) = 0
    expect(calculateShannonEntropy([1, 0, 0, 0])).toBe(0);
  });

  it('returns log2(n) for uniform distribution over n outcomes', () => {
    // 4 equally probable outcomes → H = log2(4) = 2
    expect(calculateShannonEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2, 5);
    // 2 equally probable → H = log2(2) = 1
    expect(calculateShannonEntropy([0.5, 0.5])).toBeCloseTo(1, 5);
  });

  it('ignores zero-probability entries (avoids -Infinity from log2(0))', () => {
    // Same as [0.5, 0.5] with a 0 slotted in
    expect(calculateShannonEntropy([0.5, 0, 0.5])).toBeCloseTo(1, 5);
  });

  it('biased distribution has entropy less than uniform', () => {
    // [0.8, 0.2] → H = -(0.8*log2(0.8) + 0.2*log2(0.2)) ≈ 0.722
    const biased = calculateShannonEntropy([0.8, 0.2]);
    expect(biased).toBeCloseTo(0.722, 2);
    expect(biased).toBeLessThan(1); // less than uniform 2-outcome entropy
  });
});

// ─── calculateHoverMetrics ──────────────────────────────────────────────────

describe('calculateHoverMetrics', () => {
  it('returns zeroed result for empty hover times', () => {
    const result = calculateHoverMetrics({}, 'A');
    expect(result.hoverEntropy).toBe(0);
    expect(result.peakDistractorHover).toBeNull();
    expect(result.distractorHoverRatio).toBe(0);
    expect(result.normalizedEntropy).toBe(0);
  });

  it('returns zeroed result when total hover time is 0', () => {
    const result = calculateHoverMetrics({ A: 0, B: 0, C: 0, D: 0 }, 'A');
    expect(result.hoverEntropy).toBe(0);
    expect(result.distractorHoverRatio).toBe(0);
  });

  it('identifies peak distractor as option with longest non-selected hover', () => {
    const result = calculateHoverMetrics(
      { A: 100, B: 800, C: 200, D: 400 },
      'A' // Selected A, so B/C/D are distractors; B has peak
    );
    expect(result.peakDistractorHover).toBe('B');
  });

  it('excludes selected option from distractorHovers map', () => {
    const result = calculateHoverMetrics({ A: 100, B: 200, C: 300 }, 'B');
    expect(result.distractorHovers).toEqual({ A: 100, C: 300 });
    expect(result.distractorHovers['B']).toBeUndefined();
  });

  it('computes distractor ratio as (time on other options / total time)', () => {
    const result = calculateHoverMetrics({ A: 200, B: 800 }, 'A');
    // Total = 1000, distractor (B) = 800 → ratio = 0.8
    expect(result.distractorHoverRatio).toBeCloseTo(0.8, 3);
  });

  it('normalizes entropy by max entropy for number of options', () => {
    // 4 options uniform → entropy = log2(4) = 2; normalized = 1
    const uniform = calculateHoverMetrics({ A: 100, B: 100, C: 100, D: 100 }, 'A');
    expect(uniform.hoverEntropy).toBeCloseTo(2, 3);
    expect(uniform.normalizedEntropy).toBeCloseTo(1, 3);
  });

  it('focused attention produces low normalized entropy', () => {
    // 95% of hover time on one option → very low entropy
    const focused = calculateHoverMetrics({ A: 950, B: 20, C: 20, D: 10 }, 'A');
    expect(focused.normalizedEntropy).toBeLessThan(0.3);
  });

  it('returns single-option case without division-by-zero (max entropy = 0)', () => {
    // Single option → log2(1) = 0 → normalized entropy defaults to 0
    const result = calculateHoverMetrics({ A: 500 }, 'A');
    expect(result.hoverEntropy).toBe(0);
    expect(result.normalizedEntropy).toBe(0);
  });
});

// ─── analyzeTrajectory ──────────────────────────────────────────────────────

describe('analyzeTrajectory — straight-line (ideal) trajectory', () => {
  it('returns MAD ≈ 0 and efficiency ≈ 1 for a perfectly straight path', () => {
    const trajectory = buildStraightTrajectory(500, 0);
    const metrics = analyzeTrajectory(trajectory);
    expect(metrics.mad).toBeLessThan(0.01); // near-zero deviation
    expect(metrics.efficiency).toBeCloseTo(1, 1);
    expect(metrics.jitterScore).toBe(0);
    expect(metrics.reversals).toBe(0);
  });

  it('produces high confidence score for a straight path', () => {
    const trajectory = buildStraightTrajectory(500, 0);
    const metrics = analyzeTrajectory(trajectory);
    expect(metrics.confidenceScore).toBeGreaterThan(0.8);
  });

  it('sets idealDistance to Euclidean distance from start to target center', () => {
    // Target at (300, 400); start at (0,0) → ideal = sqrt(300² + 400²) = 500
    const trajectory = buildStraightTrajectory(300, 400);
    const metrics = analyzeTrajectory(trajectory);
    expect(metrics.idealDistance).toBeCloseTo(500, 1);
  });

  it('computes movementTime from start/end timestamps', () => {
    // 10 samples at 40ms = 400ms total
    const trajectory = buildStraightTrajectory(500, 0, 10, 40);
    const metrics = analyzeTrajectory(trajectory);
    expect(metrics.movementTime).toBe(400);
  });
});

describe('analyzeTrajectory — detour trajectory', () => {
  it('produces higher MAD for larger arc deviation', () => {
    const smallArc = analyzeTrajectory(buildDetourTrajectory(500, 0, 20));
    const bigArc = analyzeTrajectory(buildDetourTrajectory(500, 0, 100));
    expect(bigArc.mad).toBeGreaterThan(smallArc.mad);
  });

  it('efficiency drops below 1 for deviated paths', () => {
    const trajectory = buildDetourTrajectory(500, 0, 80);
    const metrics = analyzeTrajectory(trajectory);
    expect(metrics.efficiency).toBeLessThan(1);
    expect(metrics.efficiency).toBeGreaterThan(0);
  });

  it('confidence score drops with larger detour', () => {
    const direct = analyzeTrajectory(buildStraightTrajectory(500, 0));
    const wavy = analyzeTrajectory(buildDetourTrajectory(500, 0, 150));
    expect(wavy.confidenceScore).toBeLessThan(direct.confidenceScore);
  });
});

describe('analyzeTrajectory — edge cases', () => {
  it('handles a single-point trajectory without crashing', () => {
    const trajectory: RawTrajectory = {
      startPoint: { x: 0, y: 0 },
      points: [{ x: 100, y: 0, t: 40 }],
      target: { centerX: 100, centerY: 0, width: 50, height: 20 },
      startTime: 0,
      endTime: 40,
    };
    const metrics = analyzeTrajectory(trajectory);
    // Single point → cannot compute velocities/jitter/hesitation → all 0
    expect(metrics.hesitationIndex).toBe(0);
    expect(metrics.jitterScore).toBe(0);
  });

  it('handles zero-ideal-distance (target == start) without divide-by-zero', () => {
    const trajectory: RawTrajectory = {
      startPoint: { x: 100, y: 100 },
      points: [
        { x: 100, y: 100, t: 40 },
        { x: 101, y: 100, t: 80 },
      ],
      target: { centerX: 100, centerY: 100, width: 50, height: 20 },
      startTime: 0,
      endTime: 80,
    };
    const metrics = analyzeTrajectory(trajectory);
    // No NaN/Infinity leaking through
    expect(Number.isFinite(metrics.mad)).toBe(true);
    expect(Number.isFinite(metrics.auc)).toBe(true);
    expect(Number.isFinite(metrics.confidenceScore)).toBe(true);
  });
});

describe('analyzeTrajectory — hover metrics integration', () => {
  it('includes hover metrics when hover options provided', () => {
    const trajectory = buildStraightTrajectory(500, 0);
    const metrics = analyzeTrajectory(trajectory, {
      hoverTimes: { A: 100, B: 200, C: 300, D: 400 },
      selectedOptionId: 'D',
    });
    expect(metrics.hoverEntropy).toBeGreaterThan(0);
    expect(metrics.peakDistractorHover).toBe('C'); // highest non-selected
    expect(metrics.distractorHovers).toEqual({ A: 100, B: 200, C: 300 });
  });

  it('defaults hover metrics to zero/empty when options omitted', () => {
    const trajectory = buildStraightTrajectory(500, 0);
    const metrics = analyzeTrajectory(trajectory);
    expect(metrics.hoverEntropy).toBe(0);
    expect(metrics.distractorHovers).toEqual({});
    expect(metrics.peakDistractorHover).toBeNull();
    expect(metrics.distractorHoverRatio).toBe(0);
  });
});

// ─── serializeTrajectoryMetrics ─────────────────────────────────────────────

describe('serializeTrajectoryMetrics', () => {
  const sampleMetrics: TrajectoryMetrics = {
    mad: 0.123456,
    auc: 0.234567,
    hesitationIndex: 0.4567,
    jitterScore: 0.2345,
    efficiency: 0.9876,
    movementTime: 453.6,
    pathLength: 500.1,
    idealDistance: 480,
    reversals: 2,
    confidenceScore: 0.7654,
    hoverEntropy: 1.23456,
    distractorHovers: { A: 123.4, B: 456.7 },
    peakDistractorHover: 'B',
    distractorHoverRatio: 0.3456,
  };

  it('rounds mad/auc/hoverEntropy to 3 decimal places', () => {
    const s = serializeTrajectoryMetrics(sampleMetrics);
    expect(s.mad).toBe(0.123);
    expect(s.auc).toBe(0.235);
    expect(s.hoverEntropy).toBe(1.235);
  });

  it('rounds hesitation/jitter/efficiency/confidence/ratio to 2 decimal places', () => {
    const s = serializeTrajectoryMetrics(sampleMetrics);
    expect(s.hesitationIndex).toBe(0.46);
    expect(s.jitterScore).toBe(0.23);
    expect(s.efficiency).toBe(0.99);
    expect(s.confidenceScore).toBe(0.77);
    expect(s.distractorHoverRatio).toBe(0.35);
  });

  it('rounds movementTime to integer ms', () => {
    const s = serializeTrajectoryMetrics(sampleMetrics);
    expect(s.movementTime).toBe(454);
  });

  it('rounds each distractorHover value to integer ms', () => {
    const s = serializeTrajectoryMetrics(sampleMetrics);
    expect(s.distractorHovers).toEqual({ A: 123, B: 457 });
  });

  it('preserves peakDistractorHover unchanged (including null)', () => {
    const s = serializeTrajectoryMetrics(sampleMetrics);
    expect(s.peakDistractorHover).toBe('B');

    const nullCase = serializeTrajectoryMetrics({
      ...sampleMetrics,
      peakDistractorHover: null,
    });
    expect(nullCase.peakDistractorHover).toBeNull();
  });
});

// ─── interpretTrajectoryForRating ───────────────────────────────────────────

describe('interpretTrajectoryForRating', () => {
  function makeMetricsWithConfidence(confidenceScore: number): TrajectoryMetrics {
    return {
      mad: 0,
      auc: 0,
      hesitationIndex: 0,
      jitterScore: 0,
      efficiency: 1,
      movementTime: 400,
      pathLength: 500,
      idealDistance: 500,
      reversals: 0,
      confidenceScore,
      hoverEntropy: 0,
      distractorHovers: {},
      peakDistractorHover: null,
      distractorHoverRatio: 0,
    };
  }

  it('upgrades correct + high-confidence answers', () => {
    const result = interpretTrajectoryForRating(makeMetricsWithConfidence(0.9), true);
    expect(result.suggestedAdjustment).toBe('upgrade');
    expect(result.trajectoryConfidence).toBe('high');
  });

  it('downgrades correct + low-confidence answers (possible lucky guess)', () => {
    const result = interpretTrajectoryForRating(makeMetricsWithConfidence(0.3), true);
    expect(result.suggestedAdjustment).toBe('downgrade');
    expect(result.trajectoryConfidence).toBe('low');
    expect(result.reason.toLowerCase()).toContain('lucky');
  });

  it('no adjustment for correct + medium-confidence', () => {
    const result = interpretTrajectoryForRating(makeMetricsWithConfidence(0.6), true);
    expect(result.suggestedAdjustment).toBe('none');
    expect(result.trajectoryConfidence).toBe('medium');
  });

  it('no adjustment for incorrect answers (always none)', () => {
    expect(interpretTrajectoryForRating(makeMetricsWithConfidence(0.9), false).suggestedAdjustment).toBe('none');
    expect(interpretTrajectoryForRating(makeMetricsWithConfidence(0.6), false).suggestedAdjustment).toBe('none');
    expect(interpretTrajectoryForRating(makeMetricsWithConfidence(0.3), false).suggestedAdjustment).toBe('none');
  });

  it('flags confident-but-wrong as misconception', () => {
    const result = interpretTrajectoryForRating(makeMetricsWithConfidence(0.9), false);
    expect(result.trajectoryConfidence).toBe('high');
    expect(result.reason.toLowerCase()).toContain('misconception');
  });

  it('flags uncertain-and-wrong as knowledge gap', () => {
    const result = interpretTrajectoryForRating(makeMetricsWithConfidence(0.3), false);
    expect(result.trajectoryConfidence).toBe('low');
    expect(result.reason.toLowerCase()).toContain('knowledge gap');
  });

  it('confidence tier thresholds: ≥0.75 high, ≥0.5 medium, <0.5 low', () => {
    // Exactly at 0.75 → high
    expect(interpretTrajectoryForRating(makeMetricsWithConfidence(0.75), true).trajectoryConfidence).toBe('high');
    // Exactly at 0.5 → medium
    expect(interpretTrajectoryForRating(makeMetricsWithConfidence(0.5), true).trajectoryConfidence).toBe('medium');
    // Just below 0.5 → low
    expect(interpretTrajectoryForRating(makeMetricsWithConfidence(0.499), true).trajectoryConfidence).toBe('low');
  });
});
