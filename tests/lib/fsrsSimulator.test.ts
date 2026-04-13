import { describe, it, expect } from 'vitest';
import {
  simulateRetentionWorkload,
  calculateRecommendedRetention,
  generateWorkloadChart,
  type SimulationParams,
} from '@/lib/fsrs/simulator';
import { defaultParameters, type FSRSParameters } from '@/lib/fsrs';

// Simulation tests are CPU-intensive; extend timeout to prevent flaky failures under load
const SIMULATION_TIMEOUT = 15_000;

/**
 * FSRS Workload Simulator tests
 *
 * Tests the retention optimization engine that helps users balance
 * study time vs retention targets. Core to PANaCEa's value proposition.
 */

const TEST_PARAMS: SimulationParams = {
  fsrsParams: defaultParameters,
  dailyNewCards: 10,
  simulationDays: 30, // Short simulation for test speed
  avgReviewTimeSeconds: 30,
};

describe('simulateRetentionWorkload', () => {
  it('returns 6 retention levels', () => {
    const results = simulateRetentionWorkload(TEST_PARAMS);
    expect(results.length).toBe(6);
    expect(results.map((r) => r.retention)).toEqual([0.8, 0.85, 0.88, 0.9, 0.92, 0.95]);
  });

  it('higher retention requires more daily reviews', () => {
    const results = simulateRetentionWorkload(TEST_PARAMS);
    // Reviews should generally increase with retention target
    const reviews = results.map((r) => r.projectedDailyReviews);
    // Not strictly monotonic due to simulation randomness, but overall trend up
    expect(reviews[5]!).toBeGreaterThan(reviews[0]!); // 0.95 > 0.80
  });

  it('higher retention requires more time', () => {
    const results = simulateRetentionWorkload(TEST_PARAMS);
    expect(results[5]!.timeInvestmentMinutes).toBeGreaterThan(results[0]!.timeInvestmentMinutes);
  });

  it('each result has all required fields', () => {
    const results = simulateRetentionWorkload(TEST_PARAMS);
    for (const r of results) {
      expect(r.retention).toBeGreaterThan(0);
      expect(r.dailyNewCards).toBe(10);
      expect(r.projectedDailyReviews).toBeGreaterThanOrEqual(0);
      expect(r.timeInvestmentMinutes).toBeGreaterThanOrEqual(0);
      expect(r.sustainabilityScore).toBeGreaterThanOrEqual(0);
      expect(r.sustainabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('sustainability score is bounded [0, 100]', () => {
    const results = simulateRetentionWorkload({ ...TEST_PARAMS, simulationDays: 60 });
    for (const r of results) {
      expect(r.sustainabilityScore).toBeGreaterThanOrEqual(0);
      expect(r.sustainabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('scales with daily new cards', () => {
    const small = simulateRetentionWorkload({ ...TEST_PARAMS, dailyNewCards: 5 });
    const large = simulateRetentionWorkload({ ...TEST_PARAMS, dailyNewCards: 30 });
    // More new cards → more reviews at equilibrium
    expect(large[3]!.projectedDailyReviews).toBeGreaterThan(small[3]!.projectedDailyReviews);
  });
});

describe('calculateRecommendedRetention', () => {
  it('recommends higher retention when more time available', () => {
    const low = calculateRecommendedRetention(20, 10, defaultParameters);
    const high = calculateRecommendedRetention(90, 10, defaultParameters);
    expect(high.recommendedRetention).toBeGreaterThanOrEqual(low.recommendedRetention);
  }, SIMULATION_TIMEOUT);

  it('returns explanation string', () => {
    const result = calculateRecommendedRetention(45, 15, defaultParameters);
    expect(result.explanation).toBeTruthy();
    expect(result.explanation.length).toBeGreaterThan(10);
  }, SIMULATION_TIMEOUT);

  it('recommends at least 0.8 retention', () => {
    const result = calculateRecommendedRetention(5, 50, defaultParameters);
    expect(result.recommendedRetention).toBeGreaterThanOrEqual(0.8);
  }, SIMULATION_TIMEOUT);

  it('falls back when time budget is too low', () => {
    const result = calculateRecommendedRetention(5, 50, defaultParameters);
    expect(result.explanation).toContain('reducing');
  }, SIMULATION_TIMEOUT);
});

describe('generateWorkloadChart', () => {
  it('returns 6 data points', () => {
    const data = generateWorkloadChart(TEST_PARAMS);
    expect(data.length).toBe(6);
  });

  it('each point has retention, reviews, and minutes', () => {
    const data = generateWorkloadChart(TEST_PARAMS);
    for (const point of data) {
      expect(point.retention).toBeGreaterThan(0);
      expect(typeof point.reviews).toBe('number');
      expect(typeof point.minutes).toBe('number');
    }
  });
});
