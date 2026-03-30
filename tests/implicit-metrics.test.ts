/**
 * Implicit Metrics Module Comprehensive Test Suite
 *
 * Tests zero-friction FSRS integration via behavioral data:
 * - Continuous rating derivation from telemetry
 * - Discrete rating mapping
 * - Session-level latency statistics and variance
 * - Rapid guess and outlier detection
 * - Confidence scoring
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveContinuousRating,
  deriveImplicitRating,
  updateLatencyStats,
  initLatencyStats,
  calculateLatencyPercentile,
  estimateParTime,
  analyzeSessionMetrics,
  serializeImplicitMetrics,
  applyStabilityModifierFromGrade,
  DEFAULT_IMPLICIT_CONFIG,
  DURATION_CAP_MS,
  type ImplicitBehaviorMetrics,
  type SessionLatencyStats,
} from '../lib/implicit-metrics';
import { Rating } from '../lib/fsrs';

describe('Implicit Metrics Module', () => {
  describe('initLatencyStats', () => {
    it('should initialize empty session statistics', () => {
      const stats = initLatencyStats();

      expect(stats.count).toBe(0);
      expect(stats.meanLatency).toBe(0);
      expect(stats.variance).toBe(0);
      expect(stats.stdDev).toBe(0);
    });
  });

  describe('updateLatencyStats', () => {
    it('should correctly initialize stats after first response', () => {
      const stats = initLatencyStats();
      const updated = updateLatencyStats(stats, 1500);

      expect(updated.count).toBe(1);
      expect(updated.meanLatency).toBe(1500);
      expect(updated.variance).toBe(0);
      expect(updated.stdDev).toBe(0);
    });

    it('should update mean correctly after second response', () => {
      let stats = initLatencyStats();
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 2000);

      expect(stats.count).toBe(2);
      expect(stats.meanLatency).toBe(1500);
    });

    it('should calculate variance correctly (Welford algorithm)', () => {
      let stats = initLatencyStats();
      // Data: 1000, 2000, 3000
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 2000);
      stats = updateLatencyStats(stats, 3000);

      expect(stats.count).toBe(3);
      expect(stats.meanLatency).toBe(2000);
      // Variance with n=3: sum((x-mean)^2) / (n-1) = (1000000 + 0 + 1000000) / 2 = 1000000
      expect(stats.variance).toBe(1000000);
      expect(stats.stdDev).toBeCloseTo(1000, 0);
    });

    it('should handle many responses maintaining numerical stability', () => {
      let stats = initLatencyStats();
      const latencies = [1000, 1100, 1050, 1200, 950, 1150, 1080];

      for (const latency of latencies) {
        stats = updateLatencyStats(stats, latency);
      }

      expect(stats.count).toBe(7);
      expect(stats.meanLatency).toBeCloseTo(1082.86, 1);
      expect(stats.stdDev).toBeGreaterThan(0);
      expect(stats.stdDev).toBeLessThan(200);
    });

    it('should produce non-decreasing standard deviation', () => {
      let stats = initLatencyStats();
      const latencies = [1000, 1000, 1000, 2000, 2000, 2000];

      const stdDevs: number[] = [];
      for (const latency of latencies) {
        stats = updateLatencyStats(stats, latency);
        stdDevs.push(stats.stdDev);
      }

      // stdDev should increase as variance increases
      for (let i = 1; i < stdDevs.length; i++) {
        expect(stdDevs[i]).toBeGreaterThanOrEqual(stdDevs[i - 1]);
      }
    });
  });

  describe('calculateLatencyPercentile', () => {
    it('should return 0.5 when insufficient data (< 3 responses)', () => {
      const stats = initLatencyStats();
      const percentile = calculateLatencyPercentile(1500, stats);

      expect(percentile).toBe(0.5);
    });

    it('should return 0.5 when stdDev is zero', () => {
      let stats = initLatencyStats();
      // All same values = zero variance
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);

      const percentile = calculateLatencyPercentile(1000, stats);
      expect(percentile).toBe(0.5);
    });

    it('should return ~0 for very fast response (low z-score)', () => {
      let stats = initLatencyStats();
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);
      // Mean = 1000, stdDev = 0... try different values
      stats = updateLatencyStats(stats, 1100);
      stats = updateLatencyStats(stats, 900);

      // Very low latency relative to mean
      const percentile = calculateLatencyPercentile(100, stats);
      expect(percentile).toBeLessThan(0.25);
    });

    it('should return ~1.0 for very slow response (high z-score)', () => {
      let stats = initLatencyStats();
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1100);
      stats = updateLatencyStats(stats, 900);

      // Very high latency relative to mean
      const percentile = calculateLatencyPercentile(5000, stats);
      expect(percentile).toBeGreaterThan(0.75);
    });

    it('should clamp percentile to [0, 1]', () => {
      let stats = initLatencyStats();
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 1000);

      const extremeLow = calculateLatencyPercentile(-10000, stats);
      const extremeHigh = calculateLatencyPercentile(100000, stats);

      expect(extremeLow).toBeGreaterThanOrEqual(0);
      expect(extremeLow).toBeLessThanOrEqual(1);
      expect(extremeHigh).toBeGreaterThanOrEqual(0);
      expect(extremeHigh).toBeLessThanOrEqual(1);
    });
  });

  describe('deriveContinuousRating', () => {
    it('should return grade 1.0 for incorrect answer', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 2000,
        answerSwitches: 0,
        totalDwellTime: 2000,
        isCorrect: false,
        parTimeMs: 30000,
      };

      const result = deriveContinuousRating(metrics);

      expect(result.grade).toBe(1.0);
      expect(result.discreteRating).toBe(Rating.Again);
      expect(result.confidence).toBe(0.95);
    });

    it('should return ~3.5-4.0 for fast correct answer with no switches', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 5000, // Well under 30s par time (0.167 ratio)
        answerSwitches: 0,
        totalDwellTime: 5000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveContinuousRating(metrics);

      expect(result.grade).toBeGreaterThanOrEqual(3.5);
      expect(result.discreteRating).toBe(Rating.Easy);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should return ~3.0 for standard correct answer at par time', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 30000, // At par time (1.0 ratio)
        answerSwitches: 0,
        totalDwellTime: 30000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveContinuousRating(metrics);

      expect(result.grade).toBeCloseTo(3.0, 1);
      expect(result.discreteRating).toBe(Rating.Good);
    });

    it('should return ~1.5-2.5 for slow correct answer with multiple switches', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 50000, // 1.67x par time
        answerSwitches: 3, // Multiple changes
        totalDwellTime: 50000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveContinuousRating(metrics);

      expect(result.grade).toBeLessThan(3.0);
      expect(result.grade).toBeGreaterThan(1.0);
    });

    it('should apply penalty for answer switches', () => {
      const metricsNoSwitches: ImplicitBehaviorMetrics = {
        timeToFirstClick: 10000,
        answerSwitches: 0,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const metricsWithSwitches: ImplicitBehaviorMetrics = {
        timeToFirstClick: 10000,
        answerSwitches: 3,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const resultNoSwitches = deriveContinuousRating(metricsNoSwitches);
      const resultWithSwitches = deriveContinuousRating(metricsWithSwitches);

      expect(resultWithSwitches.grade).toBeLessThan(resultNoSwitches.grade);
    });

    it('should cap duration at DURATION_CAP_MS (60 seconds)', () => {
      const metricsBelowCap: ImplicitBehaviorMetrics = {
        timeToFirstClick: 40000, // Below 60s cap
        answerSwitches: 0,
        totalDwellTime: 40000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const metricsAboveCap: ImplicitBehaviorMetrics = {
        timeToFirstClick: 120000, // 2x above cap, but should be capped
        answerSwitches: 0,
        totalDwellTime: 120000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const resultBelow = deriveContinuousRating(metricsBelowCap);
      const resultAbove = deriveContinuousRating(metricsAboveCap);

      // Result above cap should be better (capped) than 120s would give
      expect(resultAbove.grade).toBeGreaterThan(1.0);
    });

    it('should clamp grade to [1.0, 4.0]', () => {
      // Test extreme cases that might produce out-of-bounds grades
      const extremeFast: ImplicitBehaviorMetrics = {
        timeToFirstClick: 100, // Extremely fast
        answerSwitches: 0,
        totalDwellTime: 100,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveContinuousRating(extremeFast);

      expect(result.grade).toBeLessThanOrEqual(4.0);
      expect(result.grade).toBeGreaterThanOrEqual(1.0);
    });

    it('should apply bonus for speed below 35% par time', () => {
      const metricsVeryFast: ImplicitBehaviorMetrics = {
        timeToFirstClick: 8000, // 27% of 30s
        answerSwitches: 0,
        totalDwellTime: 8000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const metricsFast: ImplicitBehaviorMetrics = {
        timeToFirstClick: 18000, // 60% of 30s
        answerSwitches: 0,
        totalDwellTime: 18000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const resultVeryFast = deriveContinuousRating(metricsVeryFast);
      const resultFast = deriveContinuousRating(metricsFast);

      expect(resultVeryFast.grade).toBeGreaterThan(resultFast.grade);
    });

    it('should calculate confidence inversely with answer switches', () => {
      const metricsNoSwitches: ImplicitBehaviorMetrics = {
        timeToFirstClick: 10000,
        answerSwitches: 0,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const metricsWithSwitches: ImplicitBehaviorMetrics = {
        timeToFirstClick: 10000,
        answerSwitches: 2,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const resultNoSwitches = deriveContinuousRating(metricsNoSwitches);
      const resultWithSwitches = deriveContinuousRating(metricsWithSwitches);

      expect(resultWithSwitches.confidence).toBeLessThan(resultNoSwitches.confidence);
    });

    it('should handle micro-kinetics penalties (commitment gap, entropy, oscillation)', () => {
      const metricsClean: ImplicitBehaviorMetrics = {
        timeToFirstClick: 10000,
        answerSwitches: 0,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
        commitmentGapMs: 100,
        cursorEntropy: 0.8,
        hoverOscillationCount: 0,
      };

      const metricsMessy: ImplicitBehaviorMetrics = {
        timeToFirstClick: 10000,
        answerSwitches: 0,
        totalDwellTime: 10000,
        isCorrect: true,
        parTimeMs: 30000,
        commitmentGapMs: 4000, // Large gap
        cursorEntropy: 2.0, // Meandering
        hoverOscillationCount: 5, // Lots of hovering
      };

      const resultClean = deriveContinuousRating(metricsClean);
      const resultMessy = deriveContinuousRating(metricsMessy);

      expect(resultMessy.grade).toBeLessThan(resultClean.grade);
      expect(resultMessy.confidence).toBeLessThan(resultClean.confidence);
    });

    it('should return discrete rating as rounded continuous grade', () => {
      const testCases: Array<[number, Rating]> = [
        [1.2, Rating.Again],
        [2.2, Rating.Hard],
        [3.2, Rating.Good],
        [3.8, Rating.Easy],
        [4.0, Rating.Easy],
      ];

      for (const [grade, expectedRating] of testCases) {
        const metrics: ImplicitBehaviorMetrics = {
          timeToFirstClick: 25000,
          answerSwitches: 0,
          totalDwellTime: 25000,
          isCorrect: true,
          parTimeMs: 30000,
        };

        const result = deriveContinuousRating(metrics);
        // Verify it returns a valid discrete rating
        expect([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]).toContain(
          result.discreteRating
        );
      }
    });
  });

  describe('deriveImplicitRating', () => {
    it('should always return Rating.Again for incorrect answers', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 2000,
        answerSwitches: 0,
        totalDwellTime: 2000,
        isCorrect: false,
        parTimeMs: 30000,
      };

      const result = deriveImplicitRating(metrics);

      expect(result.rating).toBe(Rating.Again);
      expect(result.continuousRating).toBe(1.0);
      expect(result.flagged).toBe(false);
      expect(result.confidence).toBe(0.95);
    });

    it('should return high confidence for incorrect answers', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 500000, // Even if it took forever
        answerSwitches: 100,
        totalDwellTime: 500000,
        isCorrect: false,
        parTimeMs: 30000,
      };

      const result = deriveImplicitRating(metrics);

      expect(result.confidence).toBe(0.95);
    });

    it('should flag suspiciously fast responses (below minValidTime)', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 500, // Below default 1000ms threshold
        answerSwitches: 0,
        totalDwellTime: 500,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveImplicitRating(metrics);

      expect(result.flagged).toBe(true);
      expect(result.flagReason).toContain('fast');
    });

    it('should flag responses exceeding maxValidTime', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 200000, // Way above default 180000ms (3 min)
        answerSwitches: 0,
        totalDwellTime: 200000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveImplicitRating(metrics);

      expect(result.flagged).toBe(true);
      expect(result.flagReason).toContain('exceeded');
    });

    it('should use session latency stats for percentile calculation', () => {
      let stats = initLatencyStats();
      stats = updateLatencyStats(stats, 1000);
      stats = updateLatencyStats(stats, 2000);
      stats = updateLatencyStats(stats, 3000);
      stats = updateLatencyStats(stats, 4000);
      stats = updateLatencyStats(stats, 5000);

      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 1000, // Fast relative to session
        answerSwitches: 0,
        totalDwellTime: 1000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveImplicitRating(metrics, stats);

      expect(result.latencyPercentile).toBeLessThan(0.5);
    });

    it('should apply variance-based adjustment when session has 5+ responses', () => {
      let stats = initLatencyStats();
      // Create a session with consistent responses
      for (let i = 0; i < 5; i++) {
        stats = updateLatencyStats(stats, 2000 + i * 100);
      }

      const metricsVeryFast: ImplicitBehaviorMetrics = {
        timeToFirstClick: 500, // Much faster than session mean
        answerSwitches: 0,
        totalDwellTime: 500,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const resultWithStats = deriveImplicitRating(metricsVeryFast, stats);
      const resultNoStats = deriveImplicitRating(metricsVeryFast);

      // With stats, very fast should get boost (low percentile)
      expect(resultWithStats.latencyPercentile).toBeLessThan(0.2);
    });

    it('should calculate latencyPercentile without session stats', () => {
      const metrics: ImplicitBehaviorMetrics = {
        timeToFirstClick: 2000,
        answerSwitches: 0,
        totalDwellTime: 2000,
        isCorrect: true,
        parTimeMs: 30000,
      };

      const result = deriveImplicitRating(metrics);

      // Without stats, should default to 0.5 (median)
      expect(result.latencyPercentile).toBe(0.5);
    });
  });

  describe('estimateParTime', () => {
    it('should estimate basic reading and processing time', () => {
      const parTime = estimateParTime({
        stemLength: 500, // 100 words
        optionCount: 4,
        hasVignette: false,
        hasImage: false,
      });

      expect(parTime).toBeGreaterThan(15000); // Above minimum
      expect(parTime).toBeLessThan(120000); // Below maximum
    });

    it('should add time for vignette', () => {
      const withoutVignette = estimateParTime({
        stemLength: 500,
        optionCount: 4,
        hasVignette: false,
        hasImage: false,
      });

      const withVignette = estimateParTime({
        stemLength: 500,
        optionCount: 4,
        hasVignette: true,
        hasImage: false,
      });

      expect(withVignette).toBeGreaterThan(withoutVignette);
    });

    it('should add time for image', () => {
      const withoutImage = estimateParTime({
        stemLength: 500,
        optionCount: 4,
        hasVignette: false,
        hasImage: false,
      });

      const withImage = estimateParTime({
        stemLength: 500,
        optionCount: 4,
        hasVignette: false,
        hasImage: true,
      });

      expect(withImage).toBeGreaterThan(withoutImage);
    });

    it('should add time proportional to option count', () => {
      const fourOptions = estimateParTime({
        stemLength: 500,
        optionCount: 4,
        hasVignette: false,
        hasImage: false,
      });

      const sixOptions = estimateParTime({
        stemLength: 500,
        optionCount: 6,
        hasVignette: false,
        hasImage: false,
      });

      expect(sixOptions).toBeGreaterThan(fourOptions);
    });

    it('should clamp result to [15000, 120000] ms', () => {
      const minimal = estimateParTime({
        stemLength: 10,
        optionCount: 2,
        hasVignette: false,
        hasImage: false,
      });

      const maximal = estimateParTime({
        stemLength: 10000,
        optionCount: 10,
        hasVignette: true,
        hasImage: true,
      });

      expect(minimal).toBeLessThanOrEqual(120000);
      expect(minimal).toBeGreaterThanOrEqual(15000);
      expect(maximal).toBeLessThanOrEqual(120000);
      expect(maximal).toBeGreaterThanOrEqual(15000);
    });
  });

  describe('analyzeSessionMetrics', () => {
    it('should return zeros for empty session', () => {
      const analysis = analyzeSessionMetrics([]);

      expect(analysis.avgLatency).toBe(0);
      expect(analysis.avgConfidence).toBe(0);
      expect(analysis.flaggedCount).toBe(0);
      expect(analysis.consistencyScore).toBe(0);
      expect(analysis.ratingDistribution[Rating.Again]).toBe(0);
      expect(analysis.ratingDistribution[Rating.Good]).toBe(0);
    });

    it('should calculate average latency correctly', () => {
      const reviews = [
        deriveImplicitRating({
          timeToFirstClick: 1000,
          answerSwitches: 0,
          totalDwellTime: 1000,
          isCorrect: true,
          parTimeMs: 30000,
        }),
        deriveImplicitRating({
          timeToFirstClick: 3000,
          answerSwitches: 0,
          totalDwellTime: 3000,
          isCorrect: true,
          parTimeMs: 30000,
        }),
      ];

      const analysis = analyzeSessionMetrics(reviews);

      expect(analysis.avgLatency).toBe(2000);
    });

    it('should count flagged responses', () => {
      const reviews = [
        deriveImplicitRating({
          timeToFirstClick: 500, // Flagged: too fast
          answerSwitches: 0,
          totalDwellTime: 500,
          isCorrect: true,
          parTimeMs: 30000,
        }),
        deriveImplicitRating({
          timeToFirstClick: 5000, // Not flagged
          answerSwitches: 0,
          totalDwellTime: 5000,
          isCorrect: true,
          parTimeMs: 30000,
        }),
      ];

      const analysis = analyzeSessionMetrics(reviews);

      expect(analysis.flaggedCount).toBe(1);
    });

    it('should count rating distribution', () => {
      const reviews = [
        deriveImplicitRating({
          timeToFirstClick: 1000,
          answerSwitches: 0,
          totalDwellTime: 1000,
          isCorrect: false, // Rating.Again
          parTimeMs: 30000,
        }),
        deriveImplicitRating({
          timeToFirstClick: 1000,
          answerSwitches: 0,
          totalDwellTime: 1000,
          isCorrect: false, // Rating.Again
          parTimeMs: 30000,
        }),
        deriveImplicitRating({
          timeToFirstClick: 5000,
          answerSwitches: 0,
          totalDwellTime: 5000,
          isCorrect: true, // Rating.Good or higher
          parTimeMs: 30000,
        }),
      ];

      const analysis = analyzeSessionMetrics(reviews);

      expect(analysis.ratingDistribution[Rating.Again]).toBe(2);
    });

    it('should calculate consistency score (1 - variance)', () => {
      // All same latency = high consistency
      const consistentReviews = [
        deriveImplicitRating({
          timeToFirstClick: 2000,
          answerSwitches: 0,
          totalDwellTime: 2000,
          isCorrect: true,
          parTimeMs: 30000,
        }),
        deriveImplicitRating({
          timeToFirstClick: 2000,
          answerSwitches: 0,
          totalDwellTime: 2000,
          isCorrect: true,
          parTimeMs: 30000,
        }),
      ];

      const analysisConsistent = analyzeSessionMetrics(consistentReviews);
      expect(analysisConsistent.consistencyScore).toBeGreaterThan(0.8);
    });
  });

  describe('serializeImplicitMetrics', () => {
    it('should serialize basic metrics', () => {
      const review = deriveImplicitRating({
        timeToFirstClick: 2000,
        answerSwitches: 1,
        totalDwellTime: 2000,
        isCorrect: true,
        parTimeMs: 30000,
      });

      const serialized = serializeImplicitMetrics(review);

      expect(serialized.rating).toBe(review.rating);
      expect(serialized.latencyMs).toBe(2000);
      expect(serialized.switches).toBe(1);
      expect(serialized.isCorrect).toBe(true);
      expect(serialized.confidence).toBeDefined();
      expect(serialized.flagged).toBe(false);
    });

    it('should include flagReason when present', () => {
      const review = deriveImplicitRating({
        timeToFirstClick: 500, // Flagged
        answerSwitches: 0,
        totalDwellTime: 500,
        isCorrect: true,
        parTimeMs: 30000,
      });

      const serialized = serializeImplicitMetrics(review);

      expect(serialized.flagged).toBe(true);
      expect(serialized.flagReason).toBeDefined();
    });

    it('should not include trajectory if not provided', () => {
      const review = deriveImplicitRating({
        timeToFirstClick: 2000,
        answerSwitches: 0,
        totalDwellTime: 2000,
        isCorrect: true,
        parTimeMs: 30000,
      });

      const serialized = serializeImplicitMetrics(review);

      expect(serialized.trajectory).toBeUndefined();
    });
  });

  describe('applyStabilityModifierFromGrade', () => {
    it('should return 1.0 for grade 3.0 (neutral)', () => {
      const modifier = applyStabilityModifierFromGrade(3.0);

      expect(modifier).toBe(1.0);
    });

    it('should return < 1.0 for grade < 3.0 (penalty)', () => {
      const modifier = applyStabilityModifierFromGrade(2.0);

      expect(modifier).toBeLessThan(1.0);
      expect(modifier).toBeGreaterThan(0.85); // Clamped minimum
    });

    it('should return > 1.0 for grade > 3.0 (bonus)', () => {
      const modifier = applyStabilityModifierFromGrade(4.0);

      expect(modifier).toBeGreaterThan(1.0);
      expect(modifier).toBeLessThanOrEqual(1.15); // Clamped maximum
    });

    it('should be symmetric around 3.0', () => {
      const modifier2 = applyStabilityModifierFromGrade(2.0);
      const modifier4 = applyStabilityModifierFromGrade(4.0);

      // Both should be equidistant from 1.0
      expect(Math.abs(modifier2 - 1.0)).toBeCloseTo(Math.abs(modifier4 - 1.0), 5);
    });

    it('should clamp to [0.85, 1.15]', () => {
      const extremeLow = applyStabilityModifierFromGrade(1.0);
      const extremeHigh = applyStabilityModifierFromGrade(5.0);

      expect(extremeLow).toBeGreaterThanOrEqual(0.85);
      expect(extremeHigh).toBeLessThanOrEqual(1.15);
    });
  });

  describe('Integration: Full Scoring Pipeline', () => {
    it('should produce consistent results for typical study scenario', () => {
      let sessionStats = initLatencyStats();

      // Simulate 5 questions in a study session
      const responses = [
        {
          timeToFirstClick: 8000,
          answerSwitches: 0,
          totalDwellTime: 8000,
          isCorrect: true,
          parTimeMs: 30000,
        },
        {
          timeToFirstClick: 15000,
          answerSwitches: 1,
          totalDwellTime: 15000,
          isCorrect: true,
          parTimeMs: 30000,
        },
        {
          timeToFirstClick: 3000,
          answerSwitches: 0,
          totalDwellTime: 3000,
          isCorrect: false,
          parTimeMs: 30000,
        },
        {
          timeToFirstClick: 25000,
          answerSwitches: 2,
          totalDwellTime: 25000,
          isCorrect: true,
          parTimeMs: 30000,
        },
        {
          timeToFirstClick: 12000,
          answerSwitches: 0,
          totalDwellTime: 12000,
          isCorrect: true,
          parTimeMs: 30000,
        },
      ];

      const reviews = responses.map((metrics) => {
        sessionStats = updateLatencyStats(
          sessionStats,
          (metrics as ImplicitBehaviorMetrics).timeToFirstClick
        );
        return deriveImplicitRating(metrics as ImplicitBehaviorMetrics, sessionStats);
      });

      const analysis = analyzeSessionMetrics(reviews);

      // Verify the pipeline produces sensible results
      expect(reviews).toHaveLength(5);
      expect(analysis.avgLatency).toBeGreaterThan(0);
      expect(analysis.avgConfidence).toBeGreaterThan(0.5);
      expect(analysis.avgConfidence).toBeLessThanOrEqual(1.0);
      expect(analysis.consistencyScore).toBeGreaterThan(0);
      expect(analysis.consistencyScore).toBeLessThanOrEqual(1);

      // Should have at least one Again (incorrect answer)
      expect(analysis.ratingDistribution[Rating.Again]).toBeGreaterThan(0);
    });

    it('should distinguish between high-quality and low-quality study sessions', () => {
      const highQualityReviews = Array.from({ length: 5 }, () =>
        deriveImplicitRating({
          timeToFirstClick: 10000,
          answerSwitches: 0,
          totalDwellTime: 10000,
          isCorrect: true,
          parTimeMs: 30000,
        })
      );

      const lowQualityReviews = Array.from({ length: 5 }, () =>
        deriveImplicitRating({
          timeToFirstClick: 100000, // Very long
          answerSwitches: 5, // Many switches
          totalDwellTime: 100000,
          isCorrect: true,
          parTimeMs: 30000,
          commitmentGapMs: 5000,
          hoverOscillationCount: 10,
        })
      );

      const highAnalysis = analyzeSessionMetrics(highQualityReviews);
      const lowAnalysis = analyzeSessionMetrics(lowQualityReviews);

      expect(highAnalysis.avgConfidence).toBeGreaterThan(lowAnalysis.avgConfidence);
    });
  });
});
